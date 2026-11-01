// Everything that moves and isn't a person: stones in the air with their trails, the aiming arc and where it lands, puffs and skid
// marks where a miss lands, sparks when stones meet, the specials waiting on the lawn lines, leaves (or snow) on the wind.

import * as THREE from 'three';
import { heldMesh } from './people.js';
import { createRng } from '../core/rng.js';

const CAP = { stone: 96, brick: 12, gnome: 12, pebble: 48 };

function instanced(kind, cap) {
  const src = heldMesh(kind);
  let mesh = null;
  src.traverse((o) => {
    if (o.isMesh && !mesh) mesh = o;
  });
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld.clone().compose(mesh.position, mesh.quaternion, mesh.scale));
  const im = new THREE.InstancedMesh(geo, mesh.material, cap);
  im.count = 0;
  im.castShadow = true;
  im.frustumCulled = false;
  return im;
}

export function createFx(scene, quality = 'medium') {
  const group = new THREE.Group();
  scene.add(group);
  const stones = {};
  for (const k of Object.keys(CAP)) {
    stones[k] = instanced(k, CAP[k]);
    group.add(stones[k]);
  }
  // Trails: a thin streak behind each stone, red when it's coming at you.
  const trailGeo = new THREE.CylinderGeometry(0.035, 0.0, 1, 5, 1, true);
  trailGeo.translate(0, -0.5, 0);
  const trailMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false });
  const trails = new THREE.InstancedMesh(trailGeo, trailMat, 120);
  trails.count = 0;
  trails.frustumCulled = false;
  group.add(trails);

  // The arc: dots from the hand to where it lands.
  const DOTS = 64;
  const dotMat = new THREE.MeshBasicMaterial({ color: '#FFF4DA', transparent: true, opacity: 0.95, depthWrite: false, fog: false });
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), dotMat, DOTS);
  dots.count = 0;
  dots.frustumCulled = false;
  dots.renderOrder = 6;
  group.add(dots);
  for (let i = 0; i < DOTS; i++) dots.setColorAt(i, new THREE.Color(1, 1, 1));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.46, 28), new THREE.MeshBasicMaterial({ color: '#FFF4DA', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  ring.visible = false;
  ring.renderOrder = 6;
  group.add(ring);
  const cross = new THREE.Group();
  for (const r of [Math.PI / 4, -Math.PI / 4]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.11), ring.material);
    bar.rotation.z = r;
    cross.add(bar);
  }
  cross.visible = false;
  cross.renderOrder = 6;
  group.add(cross);

  // Puffs of dust, sparks, glints: one pool of soft sprites.
  const PUFFS = quality === 'low' ? 40 : 72;
  const puffTex = (() => {
    const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!cv) return null;
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const puffs = [];
  for (let i = 0; i < PUFFS; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: '#E8D3B0', transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false;
    group.add(s);
    puffs.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 1, size: 1, fade: 1 });
  }
  let nextPuff = 0;
  function puff(x, y, z, color, size, life, vx = 0, vy = 0.6, vz = 0, additive = false) {
    const p = puffs[nextPuff];
    nextPuff = (nextPuff + 1) % PUFFS;
    p.s.visible = true;
    p.s.position.set(x, y, z);
    p.s.material.color.set(color);
    p.s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.life = 0;
    p.max = life;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.size = size;
    p.s.scale.setScalar(size);
  }

  // Skid marks where a miss lands: dark streaks on the lawn that fade.
  const MARKS = 40;
  const markMat = new THREE.MeshBasicMaterial({ color: '#3C3020', transparent: true, opacity: 0.35, depthWrite: false });
  const marks = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 1.1).rotateX(-Math.PI / 2), markMat, MARKS);
  marks.count = MARKS;
  marks.frustumCulled = false;
  const markLife = new Float32Array(MARKS);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MARKS; i++) marks.setMatrixAt(i, zero);
  group.add(marks);
  let nextMark = 0;

  // Specials waiting on the lawn lines: a brick or a gnome on a little turning ring.
  const waiting = new Map();

  // Leaves on the wind (snowflakes on Snow Day).
  const LEAVES = quality === 'low' ? 40 : 90;
  const leafGeo = new THREE.PlaneGeometry(0.16, 0.1);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#C9A24A', side: THREE.DoubleSide, roughness: 0.8 });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, LEAVES);
  leaves.frustumCulled = false;
  group.add(leaves);
  const LP = new Float32Array(LEAVES * 4);
  const rng = createRng(5);
  let field = null;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tmpC = new THREE.Color();

  const X = {
    group,
    puff,
    setField(f, snow) {
      field = f;
      leafMat.color.set(snow ? '#FFFFFF' : '#C9A24A');
      leafMat.emissive = new THREE.Color(snow ? '#9aa4b0' : '#000000');
      for (let i = 0; i < LEAVES; i++) {
        const a = rng.range(0, Math.PI * 2);
        const r = rng.range(0, f.R + 8);
        LP[i * 4] = r * Math.cos(a);
        LP[i * 4 + 1] = rng.range(0.5, 12);
        LP[i * 4 + 2] = r * Math.sin(a);
        LP[i * 4 + 3] = rng.range(0, 10);
      }
      X.snow = !!snow;
      for (const w of waiting.values()) group.remove(w.mesh);
      waiting.clear();
      X.clear();
    },

    /** Draws the stones in the air. incoming(stone): whether it's coming at this player. */
    stones(list, t, incoming) {
      const n = { stone: 0, brick: 0, gnome: 0, pebble: 0 };
      let nt = 0;
      for (const s of list) {
        if (!s.alive || s.pendingUntil !== undefined) continue;
        const im = stones[s.kind] ?? stones.stone;
        const k = s.kind in n ? s.kind : 'stone';
        if (n[k] >= CAP[k]) continue;
        const spin = t / 1000;
        e.set(spin * 9 + s.ox, spin * 6 + s.oz, 0);
        q.setFromEuler(e);
        v.set(s.x, s.y, s.z);
        sc.setScalar(1);
        m.compose(v, q, sc);
        im.setMatrixAt(n[k]++, m);
        // The trail: along the velocity, longer when faster.
        if (nt < 120) {
          const sp = Math.hypot(s.vx, s.vy, s.vz);
          if (sp > 1) {
            v.set(s.vx / sp, s.vy / sp, s.vz / sp);
            q.setFromUnitVectors(up, v);
            const len = Math.min(2.6, sp * 0.07) * (s.kind === 'pebble' ? 0.5 : 1);
            sc.set(s.kind === 'brick' || s.kind === 'gnome' ? 2.2 : 1, len, s.kind === 'brick' || s.kind === 'gnome' ? 2.2 : 1);
            v.set(s.x, s.y, s.z);
            m.compose(v, q, sc);
            trails.setMatrixAt(nt, m);
            tmpC.set(incoming(s) ? '#FF6A4A' : s.kind === 'pebble' ? '#BFD8FF' : '#FFFFFF');
            trails.setColorAt(nt, tmpC);
            nt++;
          }
        }
      }
      for (const k of Object.keys(n)) {
        stones[k].count = n[k];
        stones[k].instanceMatrix.needsUpdate = true;
      }
      trails.count = nt;
      trails.instanceMatrix.needsUpdate = true;
      if (trails.instanceColor) trails.instanceColor.needsUpdate = true;
    },

    /** The arc of dots: points along the no-wind path, and what it lands on. */
    arc(points, n, end, kind) {
      const count = Math.min(DOTS, n);
      dots.count = count;
      for (let i = 0; i < count; i++) {
        v.set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
        const f = i / Math.max(1, count - 1);
        // Dots shrink and fade toward the far end.
        sc.setScalar(1.15 - f * 0.55);
        m.compose(v, q.identity(), sc);
        dots.setMatrixAt(i, m);
        tmpC.setRGB(1, 0.96 - f * 0.1, 0.86 - f * 0.25);
        dots.setColorAt(i, tmpC);
      }
      dots.instanceMatrix.needsUpdate = true;
      if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
      ring.visible = false;
      cross.visible = false;
      if (end && count > 1) {
        if (end.what === 'ground' || end.what === 'terrace') {
          ring.visible = true;
          ring.position.set(end.x, end.y + 0.06, end.z);
          ring.rotation.set(-Math.PI / 2, 0, 0);
        } else {
          cross.visible = true;
          cross.position.set(end.x, end.y, end.z);
          cross.lookAt(points[(count - 2) * 3], points[(count - 2) * 3 + 1], points[(count - 2) * 3 + 2]);
          const c = end.what === 'glass' ? '#FFF4DA' : '#FFB547';
          ring.material.color.set(c);
        }
      }
    },
    hideArc() {
      dots.count = 0;
      ring.visible = false;
      cross.visible = false;
    },

    /** A miss lands: a puff where it hit, a skid mark on the grass. */
    land(x, y, z, vx, vz, what) {
      const dust = what === 'ground' && X.snow ? '#FFFFFF' : what === 'ground' ? '#D9C49A' : '#CFC4B4';
      for (let k = 0; k < 4; k++) puff(x + (Math.random() - 0.5) * 0.3, y + 0.15, z + (Math.random() - 0.5) * 0.3, dust, 0.7 + Math.random() * 0.5, 0.9, (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8);
      if (what === 'ground' || what === 'terrace') {
        const i = nextMark;
        nextMark = (nextMark + 1) % MARKS;
        const a = Math.atan2(vx, vz);
        e.set(0, a, 0);
        q.setFromEuler(e);
        v.set(x + Math.sin(a) * 0.45, y + 0.04, z + Math.cos(a) * 0.45);
        sc.set(1, 1, 1);
        m.compose(v, q, sc);
        marks.setMatrixAt(i, m);
        markLife[i] = 6;
        marks.instanceMatrix.needsUpdate = true;
      }
    },

    clack(x, y, z) {
      for (let k = 0; k < 7; k++) puff(x, y, z, '#FFD87A', 0.35 + Math.random() * 0.3, 0.35, (Math.random() - 0.5) * 7, (Math.random() - 0.3) * 6, (Math.random() - 0.5) * 7, true);
      puff(x, y, z, '#FFF4DA', 1.4, 0.18, 0, 0, 0, true);
    },

    glint(x, y, z, size = 1) {
      puff(x, y, z, '#FFF6E0', 1.1 * size, 0.28, 0, 0.2, 0, true);
    },

    poof(x, y, z, color) {
      for (let k = 0; k < 8; k++) puff(x + (Math.random() - 0.5), y + (Math.random() - 0.5), z + (Math.random() - 0.5), color, 1 + Math.random(), 0.7, (Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2, true);
    },

    dust(x, y, z, n = 10, color = '#D9C49A') {
      for (let k = 0; k < n; k++) puff(x + (Math.random() - 0.5) * 6, y + Math.random() * 0.6, z + (Math.random() - 0.5) * 6, color, 1.4 + Math.random() * 1.6, 1.6, (Math.random() - 0.5) * 1.2, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2);
    },

    /** The specials on the street (from the round), kept in step. */
    specials(list, t) {
      const seen = new Set();
      for (const sp of list) {
        if (sp.gone || sp.holder >= 0) continue;
        seen.add(sp.id);
        let w = waiting.get(sp.id);
        if (!w) {
          const mesh = new THREE.Group();
          const obj = heldMesh(sp.kind);
          obj.scale.setScalar(2.4);
          mesh.add(obj);
          const halo = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32), new THREE.MeshBasicMaterial({ color: '#FFB547', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
          halo.rotation.x = -Math.PI / 2;
          halo.position.y = 0.05;
          mesh.add(halo);
          mesh.position.set(sp.x, (sp.y ?? 0) + 6, sp.z);
          group.add(mesh);
          w = { mesh, obj, halo, at: t, y: sp.y ?? 0 };
          waiting.set(sp.id, w);
        }
        // It drops in from above, then turns slowly with a pulsing ring.
        const k = Math.min(1, (t - w.at) / 900);
        const drop = 1 - (1 - k) * (1 - k);
        w.mesh.position.y = w.y + 6 * (1 - drop) + (k >= 1 ? 0.35 + Math.sin(t / 300) * 0.08 : 0.35);
        w.halo.position.y = -w.mesh.position.y + w.y + 0.06;
        w.obj.rotation.y = t / 700;
        w.halo.scale.setScalar(1 + Math.sin(t / 200) * 0.08);
      }
      for (const [id, w] of waiting) {
        if (!seen.has(id)) {
          group.remove(w.mesh);
          w.mesh.traverse((o) => {
            o.geometry?.dispose?.();
            o.material?.dispose?.();
          });
          waiting.delete(id);
        }
      }
    },

    update(dt, t, wind) {
      for (const p of puffs) {
        if (!p.s.visible) continue;
        p.life += dt;
        const k = p.life / p.max;
        if (k >= 1) {
          p.s.visible = false;
          continue;
        }
        p.s.position.x += p.vx * dt;
        p.s.position.y += p.vy * dt;
        p.s.position.z += p.vz * dt;
        p.vy -= dt * 0.5;
        p.s.scale.setScalar(p.size * (1 + k * 1.2));
        p.s.material.opacity = (1 - k) * 0.85;
      }
      let mk = false;
      for (let i = 0; i < MARKS; i++) {
        if (markLife[i] <= 0) continue;
        markLife[i] -= dt;
        if (markLife[i] <= 0) {
          marks.setMatrixAt(i, zero);
          mk = true;
        }
      }
      if (mk) marks.instanceMatrix.needsUpdate = true;
      // Leaves drift with the wind, tumbling; they wrap round the street.
      if (field) {
        const wx = wind?.x ?? 0;
        const wz = wind?.z ?? 0;
        const R = field.R + 10;
        for (let i = 0; i < LEAVES; i++) {
          const o = i * 4;
          LP[o + 3] += dt;
          const sway = Math.sin(LP[o + 3] * 1.7 + i);
          LP[o] += (wx * 1.6 + sway * 0.3) * dt;
          LP[o + 2] += (wz * 1.6 + Math.cos(LP[o + 3] * 1.3 + i) * 0.3) * dt;
          LP[o + 1] -= (X.snow ? 0.6 : 0.35) * dt;
          const r = Math.hypot(LP[o], LP[o + 2]);
          if (LP[o + 1] < 0.1 || r > R) {
            const a = Math.atan2(-wz, -wx) + (Math.random() - 0.5) * 2;
            const rr = Math.random() * R;
            LP[o] = Math.cos(a) * rr;
            LP[o + 2] = Math.sin(a) * rr;
            LP[o + 1] = 2 + Math.random() * 10;
          }
          e.set(LP[o + 3] * 2.1, LP[o + 3] * 1.3, sway);
          q.setFromEuler(e);
          v.set(LP[o], LP[o + 1], LP[o + 2]);
          sc.setScalar(X.snow ? 0.5 : 1);
          m.compose(v, q, sc);
          leaves.setMatrixAt(i, m);
        }
        leaves.instanceMatrix.needsUpdate = true;
      }
    },

    clear() {
      for (const p of puffs) p.s.visible = false;
      for (let i = 0; i < MARKS; i++) {
        marks.setMatrixAt(i, zero);
        markLife[i] = 0;
      }
      marks.instanceMatrix.needsUpdate = true;
      X.hideArc();
      for (const k of Object.keys(stones)) stones[k].count = 0;
      trails.count = 0;
    },
  };
  return X;
}
