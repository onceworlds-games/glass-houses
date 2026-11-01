// The glass: every pane of every house in one instanced mesh, cracks and the jagged teeth left in broken frames in two more, and the
// shards a break throws (a capped pool that settles into glittering piles).

import * as THREE from 'three';
import { COLS, PANES, PANE_W, PANE_H, MULLION, PLINTH, FACADE_W, GLASS, CRACKED, BROKEN } from '../core/config.js';
import { houseFrame, canvasTexture } from './build.js';
import { createRng } from '../core/rng.js';

const HALF_W = FACADE_W / 2;
const CELL_U = PANE_W + MULLION;
const CELL_Y = PANE_H + MULLION;
const SHARDS = { low: 160, medium: 360, high: 700 };

/**
 * Glass as light does it: what it reflects is added on top, what is behind shows through, dimmed by the tint. Straight on you see
 * into the room; at a glance along the front it turns to mirror (fresnel). Each pane leans a hair differently (`tilt`), so the
 * reflections of the street break from pane to pane the way real glazing does; faint smudges vary how sharp they are.
 */
export function glassMaterial(opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: opts.map ?? null,
    roughnessMap: opts.roughnessMap ?? null,
    color: opts.color ?? '#10201F',
    metalness: opts.metalness ?? 0.0,
    roughness: opts.roughness ?? 1.0,
    transparent: true,
    opacity: opts.opacity ?? 0.3,
    envMapIntensity: opts.env ?? 2.2,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: false,
  });
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendEquation = THREE.AddEquation;
  const tilted = !!opts.tilt;
  const reflect = (opts.reflect ?? 4.5).toFixed(2);
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = `#define REFLECT ${reflect}\n${shader.fragmentShader}`;
    if (tilted) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 tilt;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = normalize(objectNormal + vec3(tilt, 0.0));');
    }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <opaque_fragment>',
        `{
          float fres = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 4.0);
          // Window glass reflects about a fifth of the bright street straight on, nearly all of it at a glance.
          outgoingLight += totalSpecular * (REFLECT + fres * 14.0);
          diffuseColor.a = mix(diffuseColor.a, 0.94, fres);
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => `glass:${tilted}:${reflect}`;
  return m;
}

/** Faint smudges and streaks in the roughness: glass that has been lived behind. */
function smudgeTexture() {
  return canvasTexture(
    128,
    224,
    (g, w, h) => {
      g.fillStyle = 'rgb(10,10,10)';
      g.fillRect(0, 0, w, h);
      const r = createRng(77);
      for (let i = 0; i < 26; i++) {
        g.globalAlpha = 0.08 + r.next() * 0.1;
        g.fillStyle = 'rgb(120,120,120)';
        g.beginPath();
        g.ellipse(r.next() * w, r.next() * h, 6 + r.next() * 20, 3 + r.next() * 10, r.next() * 3, 0, Math.PI * 2);
        g.fill();
      }
      // Dried rain at the foot.
      g.globalAlpha = 0.25;
      for (let i = 0; i < 40; i++) {
        g.fillStyle = 'rgb(90,90,90)';
        g.fillRect(r.next() * w, h - 10 - r.next() * 34, 1.2, 4 + r.next() * 10);
      }
      g.globalAlpha = 1;
    },
    false,
  );
}

function teethGeometry(seed) {
  const r = createRng(seed);
  const w = PANE_W;
  const h = PANE_H;
  const outer = new THREE.Shape();
  outer.moveTo(-w / 2, -h / 2);
  outer.lineTo(w / 2, -h / 2);
  outer.lineTo(w / 2, h / 2);
  outer.lineTo(-w / 2, h / 2);
  outer.closePath();
  // The hole: a jagged outline a little inside the frame, deeper teeth at random.
  const hole = new THREE.Path();
  const pts = [];
  const edge = (x0, y0, x1, y1, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const depth = r.chance(0.3) ? r.range(0.18, 0.5) : r.range(0.03, 0.12);
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      // Inward normal of a clockwise walk.
      const nx = -(y1 - y0);
      const ny = x1 - x0;
      const l = Math.hypot(nx, ny);
      pts.push([x + (nx / l) * depth, y + (ny / l) * depth]);
    }
  };
  edge(-w / 2, -h / 2, -w / 2, h / 2, 7);
  edge(-w / 2, h / 2, w / 2, h / 2, 5);
  edge(w / 2, h / 2, w / 2, -h / 2, 7);
  edge(w / 2, -h / 2, -w / 2, -h / 2, 5);
  pts.forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y)));
  hole.closePath();
  outer.holes.push(hole);
  return new THREE.ShapeGeometry(outer);
}

function crackTexture() {
  return canvasTexture(
    256,
    384,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const r = createRng(99);
      const cx = w * 0.46;
      const cy = h * 0.42;
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.lineCap = 'round';
      // Radial cracks with kinks, then rings between them.
      const rays = [];
      for (let k = 0; k < 11; k++) {
        const a = (k / 11) * Math.PI * 2 + r.range(-0.2, 0.2);
        let x = cx;
        let y = cy;
        const ray = [[x, y]];
        const len = r.range(120, 260);
        for (let s = 0; s < 6; s++) {
          const aa = a + r.range(-0.25, 0.25);
          x += (Math.cos(aa) * len) / 6;
          y += (Math.sin(aa) * len) / 6;
          ray.push([x, y]);
        }
        rays.push(ray);
        g.lineWidth = 2.2;
        g.beginPath();
        ray.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
        g.stroke();
      }
      g.lineWidth = 1.4;
      for (const ring of [1, 2, 3]) {
        g.beginPath();
        rays.forEach((ray, i) => {
          const p = ray[ring];
          if (i) g.lineTo(p[0], p[1]);
          else g.moveTo(p[0], p[1]);
        });
        g.closePath();
        g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.arc(cx, cy, 7, 0, Math.PI * 2);
      g.fill();
    },
    false,
  );
}

export function createGlass(field, scene, quality = 'medium') {
  const n = field.houses.length;
  const total = n * PANES;
  const frames = field.houses.map(houseFrame);
  const smudge = smudgeTexture();
  if (smudge) smudge.colorSpace = THREE.NoColorSpace;
  const paneMat = glassMaterial({ roughnessMap: smudge, roughness: 1.0, opacity: 0.4, tilt: true });
  // Pre-mirrored: the house frames mirror, and an instance matrix can't flip a mesh's facing the way an object's matrix does.
  const paneGeo = new THREE.PlaneGeometry(PANE_W, PANE_H).scale(-1, 1, 1);
  const panes = new THREE.InstancedMesh(paneGeo, paneMat, total);
  panes.renderOrder = 2;
  const teethGeos = [teethGeometry(1), teethGeometry(2), teethGeometry(3)].map((g) => g.scale(-1, 1, 1));
  const teethMat = glassMaterial({ opacity: 0.5, env: 2.6, roughness: 0.05, color: '#1A2C2C', side: THREE.DoubleSide });
  const teeth = teethGeos.map((g) => {
    const m = new THREE.InstancedMesh(g, teethMat, total);
    m.count = 0;
    m.renderOrder = 2;
    return m;
  });
  const crackMat = new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false, opacity: 0.9, color: '#ffffff' });
  const cracks = new THREE.InstancedMesh(paneGeo, crackMat, total);
  cracks.count = 0;
  cracks.renderOrder = 3;
  const group = new THREE.Group();
  group.add(panes, cracks, ...teeth);
  scene.add(group);

  // Each pane's place in the world.
  const paneM = [];
  const m = new THREE.Matrix4();
  const tint = new THREE.Color();
  const rng = createRng(field.index + 31);
  for (let h = 0; h < n; h++) {
    for (let p = 0; p < PANES; p++) {
      const col = p % COLS;
      const row = Math.floor(p / COLS);
      const u = -HALF_W + MULLION + col * CELL_U + PANE_W / 2;
      const y = PLINTH + MULLION + row * CELL_Y + PANE_H / 2;
      const mm = new THREE.Matrix4().makeTranslation(u, y, 0).premultiply(frames[h]);
      paneM.push(mm);
      panes.setMatrixAt(h * PANES + p, mm);
      // A touch of variation from pane to pane, as real glass has.
      tint.setRGB(0.9 + rng.next() * 0.1, 0.95 + rng.next() * 0.05, 0.95 + rng.next() * 0.05);
      panes.setColorAt(h * PANES + p, tint);
    }
  }
  // Each pane's lean.
  const tilt = new Float32Array(total * 2);
  for (let i = 0; i < total; i++) {
    tilt[i * 2] = (rng.next() - 0.5) * 0.06;
    tilt[i * 2 + 1] = (rng.next() - 0.5) * 0.05;
  }
  paneGeo.setAttribute('tilt', new THREE.InstancedBufferAttribute(tilt, 2));
  panes.instanceMatrix.needsUpdate = true;
  if (panes.instanceColor) panes.instanceColor.needsUpdate = true;
  const state = new Uint8Array(total).fill(GLASS);
  const variant = new Uint8Array(total).map((_, i) => i % 3);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const nudge = new THREE.Matrix4().makeTranslation(0, 0, 0.012);
  const flip = new THREE.Matrix4().makeRotationZ(Math.PI);
  let dirty = false;

  // ---------------------------------------------------------------- shards
  const cap = SHARDS[quality] ?? SHARDS.medium;
  const shardGeo = new THREE.BufferGeometry();
  shardGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.12, 0, -0.07, -0.06, 0, 0.08, -0.08, 0], 3));
  shardGeo.computeVertexNormals();
  const shardMat = new THREE.MeshStandardMaterial({ color: '#E8FAFA', metalness: 0.6, roughness: 0.06, envMapIntensity: 2.8, side: THREE.DoubleSide, emissive: new THREE.Color('#9FE0E2'), emissiveIntensity: 0.55, transparent: true, opacity: 0.9 });
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, cap);
  shards.count = cap;
  shards.frustumCulled = false;
  group.add(shards);
  const P = new Float32Array(cap * 3);
  const V = new Float32Array(cap * 3);
  const Rr = new Float32Array(cap * 3);
  const W = new Float32Array(cap * 3);
  const Sz = new Float32Array(cap);
  const Fl = new Float32Array(cap);
  const life = new Float32Array(cap);
  const live = new Uint8Array(cap);
  let next = 0;
  for (let i = 0; i < cap; i++) shards.setMatrixAt(i, zero);
  shards.instanceMatrix.needsUpdate = true;
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();

  function floorAt(x, z) {
    // Inside a house the floor is its plinth.
    for (const h of field.houses) {
      const dx = x - h.cx;
      const dz = z - h.cz;
      const u = dx * h.rx + dz * h.rz;
      const d = dx * h.fx + dz * h.fz;
      if (Math.abs(u) < HALF_W + 0.3 && d < 0.8 && d > -11) return h.elev + PLINTH + 0.01;
    }
    return field.groundY(x, z) + 0.06;
  }

  const G = {
    group,
    /** Matches the drawn glass to the houses' panes. */
    sync(houses) {
      for (let h = 0; h < Math.min(n, houses.length); h++) {
        const ps = houses[h].panes;
        for (let p = 0; p < PANES; p++) {
          const i = h * PANES + p;
          if (state[i] === ps[p]) continue;
          state[i] = ps[p];
          dirty = true;
        }
      }
      for (let h = houses.length; h < n; h++) {
        for (let p = 0; p < PANES; p++) {
          const i = h * PANES + p;
          if (state[i] !== GLASS) {
            state[i] = GLASS;
            dirty = true;
          }
        }
      }
      if (!dirty) return;
      dirty = false;
      const counts = [0, 0, 0];
      let nc = 0;
      for (let i = 0; i < total; i++) {
        const s = state[i];
        panes.setMatrixAt(i, s === BROKEN ? zero : paneM[i]);
        if (s === CRACKED) {
          m.copy(paneM[i]).multiply(nudge);
          if (i % 2) m.multiply(flip);
          cracks.setMatrixAt(nc++, m);
        } else if (s === BROKEN) {
          const v = variant[i];
          m.copy(paneM[i]);
          if ((i >> 1) % 2) m.multiply(flip);
          teeth[v].setMatrixAt(counts[v]++, m);
        }
      }
      cracks.count = nc;
      cracks.instanceMatrix.needsUpdate = true;
      for (let v = 0; v < 3; v++) {
        teeth[v].count = counts[v];
        teeth[v].instanceMatrix.needsUpdate = true;
      }
      panes.instanceMatrix.needsUpdate = true;
    },

    /** A pane bursts: shards fly the way the stone was going, some back out onto the patio. */
    burst(h, p, dir, big = 1) {
      const c = new THREE.Vector3().setFromMatrixPosition(paneM[h * PANES + p]);
      const house = field.houses[h];
      const count = Math.round((24 + Math.random() * 14) * big * (cap < 200 ? 0.6 : 1));
      const sp = Math.hypot(dir?.x ?? 0, dir?.y ?? 0, dir?.z ?? 0) || 1;
      for (let k = 0; k < count; k++) {
        const i = next;
        next = (next + 1) % cap;
        const back = Math.random() < 0.35;
        const along = back ? -0.15 - Math.random() * 0.25 : 0.25 + Math.random() * 0.35;
        P[i * 3] = c.x + house.rx * (Math.random() - 0.5) * PANE_W * 0.9;
        P[i * 3 + 1] = c.y + (Math.random() - 0.5) * PANE_H * 0.9;
        P[i * 3 + 2] = c.z + house.rz * (Math.random() - 0.5) * PANE_W * 0.9;
        const vx = ((dir?.x ?? -house.fx) / sp) * 9 * along;
        const vz = ((dir?.z ?? -house.fz) / sp) * 9 * along;
        V[i * 3] = vx + house.fx * (back ? 2.5 : 0) + (Math.random() - 0.5) * 3.2;
        V[i * 3 + 1] = Math.random() * 3.5 - 0.5;
        V[i * 3 + 2] = vz + house.fz * (back ? 2.5 : 0) + (Math.random() - 0.5) * 3.2;
        Rr[i * 3] = Math.random() * 6;
        Rr[i * 3 + 1] = Math.random() * 6;
        Rr[i * 3 + 2] = Math.random() * 6;
        W[i * 3] = (Math.random() - 0.5) * 22;
        W[i * 3 + 1] = (Math.random() - 0.5) * 22;
        W[i * 3 + 2] = (Math.random() - 0.5) * 22;
        Sz[i] = 0.5 + Math.random() * 1.6;
        Fl[i] = floorAt(P[i * 3], P[i * 3 + 2]);
        life[i] = 0;
        live[i] = 1;
      }
    },

    /** Moves the shards still in the air; settled ones stay where they fell. */
    update(dt) {
      let moved = false;
      for (let i = 0; i < cap; i++) {
        if (live[i] !== 1) continue;
        moved = true;
        life[i] += dt;
        V[i * 3 + 1] -= 9.8 * dt;
        P[i * 3] += V[i * 3] * dt;
        P[i * 3 + 1] += V[i * 3 + 1] * dt;
        P[i * 3 + 2] += V[i * 3 + 2] * dt;
        Rr[i * 3] += W[i * 3] * dt;
        Rr[i * 3 + 1] += W[i * 3 + 1] * dt;
        Rr[i * 3 + 2] += W[i * 3 + 2] * dt;
        if (P[i * 3 + 1] <= Fl[i]) {
          P[i * 3 + 1] = Fl[i];
          if (Math.abs(V[i * 3 + 1]) > 1.2) {
            // A bounce and a skitter.
            V[i * 3 + 1] *= -0.3;
            V[i * 3] *= 0.5;
            V[i * 3 + 2] *= 0.5;
            W[i * 3] *= 0.4;
            W[i * 3 + 2] *= 0.4;
          } else {
            // Lie flat-ish and stay.
            live[i] = 2;
            Rr[i * 3] = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
            Rr[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
          }
        }
        if (life[i] > 6) live[i] = 2;
        e.set(Rr[i * 3], Rr[i * 3 + 1], Rr[i * 3 + 2]);
        q.setFromEuler(e);
        pv.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
        sv.setScalar(Sz[i]);
        m.compose(pv, q, sv);
        shards.setMatrixAt(i, m);
      }
      if (moved) shards.instanceMatrix.needsUpdate = true;
    },

    /** A new round: every shard swept up. */
    clear() {
      live.fill(0);
      for (let i = 0; i < cap; i++) shards.setMatrixAt(i, zero);
      shards.instanceMatrix.needsUpdate = true;
    },

    paneWorld(h, p, out) {
      return out.setFromMatrixPosition(paneM[h * PANES + p]);
    },

    dispose() {
      scene.remove(group);
      paneGeo.dispose();
      shardGeo.dispose();
      for (const g of teethGeos) g.dispose();
      paneMat.dispose();
      teethMat.dispose();
      crackMat.map?.dispose();
      smudge?.dispose();
      crackMat.dispose();
      shardMat.dispose();
      panes.dispose();
      cracks.dispose();
      shards.dispose();
      for (const t of teeth) t.dispose();
    },
  };
  return G;
}
