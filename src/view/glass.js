// The glass: every pane of every house in one instanced mesh, cracks and the jagged teeth left in broken frames in two more, and the
// shards a break throws (a capped pool that settles into glittering piles).

import * as THREE from 'three';
import { COLS, PANES, PANE_W, PANE_H, MULLION, PLINTH, FACADE_W, GLASS, CRACKED, BROKEN } from '../core/config.js';
import { houseFrame, canvasTexture } from './build.js';
import { createRng } from '../core/rng.js';

const HALF_W = FACADE_W / 2;
const CELL_U = PANE_W + MULLION;
const CELL_Y = PANE_H + MULLION;
const SHARDS = { low: 220, medium: 600, high: 1100 };

/** The tints a player can wear on their glass (career.js LOOKS.tint): colour and how much. Stained glass is per pane. */
export const TINTS = {
  clear: null,
  sea: ['#46C6B8', 0.6],
  amber: ['#F0A030', 0.65],
  rose: ['#F07090', 0.6],
  cobalt: ['#3060E0', 0.65],
  smoke: ['#1E1E26', 0.8],
  mint: ['#80E8B4', 0.55],
  mirror: ['#C8CED8', 3],
  stained: 'stained',
};
const STAINED = ['#D8343A', '#2F5BD8', '#F0B030', '#3AA05A', '#8A3FB8', '#F07030'];

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
  const tinted = !!opts.tinted;
  const clock = opts.clock ?? { value: 0 };
  const sheen = opts.sheen ?? 0;
  const reflect = (opts.reflect ?? 4.5).toFixed(2);
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = `#define REFLECT ${reflect}\n#define SHEEN ${sheen.toFixed(2)}\n${sheen > 0 ? '#define SHEEN_ON\n' : ''}${shader.fragmentShader}`;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vGlassUv;\nvarying float vGlassSeed;\nvarying vec4 vPaneTint;${tilted ? '\nattribute vec2 tilt;' : ''}${tinted ? '\nattribute vec4 paneTint;' : ''}`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>\nvGlassUv = uv;\nvGlassSeed = ${tilted ? 'tilt.x * 13.0 + tilt.y * 7.0' : '0.0'};\nvPaneTint = ${tinted ? 'paneTint' : 'vec4(0.0)'};`);
    shader.uniforms.uGlassTime = clock;
    if (tilted) shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = normalize(objectNormal + vec3(tilt, 0.0));');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGlassUv;\nvarying float vGlassSeed;\nvarying vec4 vPaneTint;\nuniform float uGlassTime;')
      .replace(
        '#include <opaque_fragment>',
        `{
          float fres = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 4.0);
          // Window glass reflects about a fifth of the bright street straight on, nearly all of it at a glance.
          #ifdef SHEEN_ON
          // Float glass is a touch green-blue, and so is what it reflects: cool fronts against warm rooms.
          vec3 cool = vec3(0.68, 0.88, 1.06);
          #else
          vec3 cool = vec3(1.0);
          #endif
          outgoingLight += totalSpecular * (REFLECT + fres * 14.0) * cool;
          diffuseColor.a = mix(diffuseColor.a, 0.94, fres);
          #ifdef SHEEN_ON
          // Tinted float glass: a cool body colour, brighter toward the top where it takes the sky, and two soft diagonal
          // streaks that sit a little differently on every pane.
          vec2 g = vGlassUv;
          float d = fract(g.x * 0.75 + g.y * 0.42 + vGlassSeed) ;
          float streak = smoothstep(0.09, 0.0, abs(d - 0.38)) * 0.6 + smoothstep(0.03, 0.0, abs(d - 0.53)) * 0.4;
          vec3 body = vec3(0.03, 0.075, 0.1) * (0.5 + g.y);
          if (vPaneTint.w > 2.5) {
            // One-way mirror: silver, and it gives back the whole street.
            body = vec3(0.16, 0.17, 0.19) * (0.6 + g.y * 0.6);
            outgoingLight += totalSpecular * 5.0;
            diffuseColor.a = max(diffuseColor.a, 0.88);
          } else if (vPaneTint.w > 1.5) {
            // A golden pane: leaf gold, and a glint that sweeps across it.
            float sweep = smoothstep(0.07, 0.0, abs(fract(g.x * 0.55 + g.y * 0.45 - uGlassTime * 0.32 + vGlassSeed * 0.2) - 0.5));
            body = vec3(0.62, 0.4, 0.06) * (0.55 + g.y * 0.7) + vec3(1.0, 0.86, 0.45) * sweep * 0.9;
            outgoingLight += totalSpecular * 2.0 * vec3(1.0, 0.8, 0.4);
            diffuseColor.a = max(diffuseColor.a, 0.9);
          } else if (vPaneTint.w > 0.0) {
            body = mix(body, vPaneTint.rgb * (0.45 + g.y * 0.55) * 0.42, vPaneTint.w);
            diffuseColor.a = max(diffuseColor.a, 0.6 + vPaneTint.w * 0.22);
          }
          outgoingLight += (body + vec3(1.0, 0.97, 0.92) * streak * 0.11) * SHEEN;
          diffuseColor.a = max(diffuseColor.a, 0.6 + streak * 0.15 * SHEEN);
          #endif
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => `glass:${tilted}:${tinted}:${reflect}:${sheen}`;
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
  return { teeth: new THREE.ShapeGeometry(outer), edge: edgeGeometry(pts) };
}

/** A thin bright ribbon along the broken edge, on the glass side: the fresh edge catches the light from across the street. */
function edgeGeometry(pts) {
  const pos = [];
  const W = 0.05;
  const n = pts.length;
  // Outward (toward the frame) at each point: away from the pane's middle.
  const out = pts.map(([x, y]) => {
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ax, ay] = pts[i];
    const [bx, by] = pts[j];
    const [aox, aoy] = out[i];
    const [box, boy] = out[j];
    const a2 = [ax + aox * W, ay + aoy * W];
    const b2 = [bx + box * W, by + boy * W];
    pos.push(ax, ay, 0.004, bx, by, 0.004, b2[0], b2[1], 0.004, ax, ay, 0.004, b2[0], b2[1], 0.004, a2[0], a2[1], 0.004);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
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
  const clock = { value: 0 };
  const paneMat = glassMaterial({ roughnessMap: smudge, roughness: 1.0, opacity: 0.62, tilt: true, tinted: true, clock, reflect: 3.2, sheen: 1 });
  // Pre-mirrored: the house frames mirror, and an instance matrix can't flip a mesh's facing the way an object's matrix does.
  const paneGeo = new THREE.PlaneGeometry(PANE_W, PANE_H).scale(-1, 1, 1);
  const panes = new THREE.InstancedMesh(paneGeo, paneMat, total);
  panes.renderOrder = 2;
  const broken = [teethGeometry(1), teethGeometry(2), teethGeometry(3)];
  const teethGeos = broken.map((b) => b.teeth.scale(-1, 1, 1));
  const edgeGeos = broken.map((b) => b.edge.scale(-1, 1, 1));
  const teethMat = glassMaterial({ opacity: 0.62, env: 2.8, roughness: 0.04, color: '#1A2C2C', side: THREE.DoubleSide, reflect: 5.5, sheen: 1 });
  const teeth = teethGeos.map((g) => {
    const m = new THREE.InstancedMesh(g, teethMat, total);
    m.count = 0;
    m.renderOrder = 2;
    return m;
  });
  const edgeMat = new THREE.MeshBasicMaterial({ color: '#E8FFFF', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  // In each hole, a soft dark rim just behind the glass line: the opening reads as an opening from across the street.
  const holeTex = canvasTexture(
    64,
    96,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const img = g.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = Math.abs(x / (w - 1) - 0.5) * 2;
          const dy = Math.abs(y / (h - 1) - 0.5) * 2;
          const r = Math.max(dx, dy * 0.92);
          const a = Math.min(1, Math.max(0, (r - 0.35) / 0.65)) ** 1.6 * 0.75 + 0.12;
          const k = (y * w + x) * 4;
          img.data[k] = 18;
          img.data[k + 1] = 14;
          img.data[k + 2] = 20;
          img.data[k + 3] = Math.round(a * 255);
        }
      }
      g.putImageData(img, 0, 0);
    },
    false,
  );
  const holeMat = new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const holeGeo = new THREE.PlaneGeometry(PANE_W, PANE_H).translate(0, 0, -0.06);
  const holes = new THREE.InstancedMesh(holeGeo, holeMat, total);
  holes.count = 0;
  holes.renderOrder = 1;
  const edges = edgeGeos.map((g) => {
    const m = new THREE.InstancedMesh(g, edgeMat, total);
    m.count = 0;
    m.renderOrder = 3;
    return m;
  });
  const crackMat = new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false, opacity: 0.9, color: '#ffffff' });
  const cracks = new THREE.InstancedMesh(paneGeo, crackMat, total);
  cracks.count = 0;
  cracks.renderOrder = 3;
  const group = new THREE.Group();
  group.add(panes, cracks, holes, ...teeth, ...edges);
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
  // Each pane's tint (rgb, amount; 2 = a golden pane, 3 = mirror): what its owner wears, and the Gazette's golden panes.
  const tintArr = new Float32Array(total * 4);
  const tintAttr = new THREE.InstancedBufferAttribute(tintArr, 4);
  tintAttr.setUsage(THREE.DynamicDrawUsage);
  paneGeo.setAttribute('paneTint', tintAttr);
  const wearing = new Array(n).fill('clear');
  const goldMask = new Array(n).fill(0);
  const tc = new THREE.Color();
  function paintHouse(h) {
    const t = TINTS[wearing[h]] ?? null;
    for (let p = 0; p < PANES; p++) {
      const i = (h * PANES + p) * 4;
      if (goldMask[h] & (1 << p)) {
        tintArr.set([1, 0.8, 0.3, 2], i);
        continue;
      }
      if (!t) {
        tintArr.set([0, 0, 0, 0], i);
        continue;
      }
      if (t === 'stained') {
        tc.set(STAINED[(p * 7 + h * 3 + Math.floor(p / COLS)) % STAINED.length]);
        tintArr.set([tc.r, tc.g, tc.b, 0.85], i);
      } else {
        tc.set(t[0]);
        tintArr.set([tc.r, tc.g, tc.b, t[1]], i);
      }
    }
    tintAttr.needsUpdate = true;
  }
  panes.instanceMatrix.needsUpdate = true;
  if (panes.instanceColor) panes.instanceColor.needsUpdate = true;
  const state = new Uint8Array(total).fill(GLASS);
  const variant = new Uint8Array(total).map((_, i) => i % 3);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const nudge = new THREE.Matrix4().makeTranslation(0, 0, 0.012);
  const flip = new THREE.Matrix4().makeRotationZ(Math.PI);
  let dirty = false;

  // ---------------------------------------------------------------- shards
  // Flying shards: slivers and chunks (one sliver stretched per shard) that flash as they leave, spin, catch the sun, bounce and
  // skitter. Big pieces slide out of the frame whole and burst again where they land. Once still, a shard moves to the piles,
  // which only grow until the round is swept.
  const cap = SHARDS[quality] ?? SHARDS.medium;
  const pileCap = cap * 2;
  const shardGeo = new THREE.BufferGeometry();
  // A thin wedge with a bevelled edge, so it catches light edge-on too.
  const sv0 = [
    [0, 0.13, 0],
    [-0.06, -0.07, 0],
    [0.07, -0.08, 0],
  ];
  const T = 0.006;
  const verts = [];
  for (const z of [T, -T]) for (const v of sv0) verts.push(v[0], v[1], z);
  const idx = [0, 1, 2, 5, 4, 3, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0];
  shardGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  shardGeo.setIndex(idx);
  shardGeo.computeVertexNormals();
  const shardMat = new THREE.MeshStandardMaterial({ color: '#A9D8D6', metalness: 0.75, roughness: 0.03, envMapIntensity: 2.4, side: THREE.DoubleSide, emissive: new THREE.Color('#7FC9CC'), emissiveIntensity: 0.18, transparent: true, opacity: 0.8 });
  // Each shard glints white as it turns edge-on (so a spinning one twinkles), and burns white for a moment as it leaves.
  shardMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        float glint = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        #if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )
        float leaving = max(0.0, vColor.r - 1.2);
        #else
        float leaving = 0.0;
        #endif
        totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * (glint * 1.1 + leaving * 0.45);
      }`,
    );
  };
  shardMat.customProgramCacheKey = () => 'glass-shard';
  // Lying in the grass: mostly see-through, a glint where the sun finds it.
  const pileMat = new THREE.MeshStandardMaterial({ color: '#9CCBCB', metalness: 0.6, roughness: 0.04, envMapIntensity: 1.6, side: THREE.DoubleSide, transparent: true, opacity: 0.42, depthWrite: false });
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, cap);
  shards.count = cap;
  shards.frustumCulled = false;
  const flash = new THREE.Color();
  for (let i = 0; i < cap; i++) shards.setColorAt(i, flash.setRGB(1, 1, 1));
  const piles = new THREE.InstancedMesh(shardGeo, pileMat, pileCap);
  piles.count = 0;
  piles.frustumCulled = false;
  group.add(shards, piles);
  const P = new Float32Array(cap * 3);
  const V = new Float32Array(cap * 3);
  const Rr = new Float32Array(cap * 3);
  const W = new Float32Array(cap * 3);
  const Sx = new Float32Array(cap);
  const Sy = new Float32Array(cap);
  const Fl = new Float32Array(cap);
  const life = new Float32Array(cap);
  const live = new Uint8Array(cap);
  const bigOne = new Uint8Array(cap);
  const Tc = new Float32Array(cap * 3).fill(1);
  const shardTint = [1, 1, 1];
  let next = 0;
  let pileNext = 0;
  let pileCount = 0;
  for (let i = 0; i < cap; i++) shards.setMatrixAt(i, zero);
  shards.instanceMatrix.needsUpdate = true;
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();

  // Glitter: bright points that twinkle as they fall (additive, no depth write).
  const GL = cap;
  const gPos = new Float32Array(GL * 3);
  const gVel = new Float32Array(GL * 3);
  const gLife = new Float32Array(GL).fill(-1);
  const gSeed = new Float32Array(GL);
  const glitterGeo = new THREE.BufferGeometry();
  glitterGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  glitterGeo.setAttribute('seed', new THREE.BufferAttribute(gSeed, 1));
  glitterGeo.setAttribute('life', new THREE.BufferAttribute(gLife, 1));
  const glitterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
    vertexShader: `
      attribute float seed;
      attribute float life;
      uniform float uTime;
      uniform float uScale;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = pow(abs(sin(uTime * (9.0 + seed * 7.0) + seed * 40.0)), 6.0);
        vA = life < 0.0 ? 0.0 : clamp(1.0 - life / 1.4, 0.0, 1.0) * (0.25 + 0.75 * tw);
        gl_PointSize = life < 0.0 ? 0.0 : uScale * (0.07 + 0.12 * tw) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float star = max(0.0, 1.0 - (abs(c.x) * abs(c.y) * 60.0 + length(c) * 1.6));
        float core = smoothstep(0.5, 0.0, length(c));
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.9) * (star + core * 0.6) * vA, 1.0);
      }`,
  });
  const glitter = new THREE.Points(glitterGeo, glitterMat);
  glitter.frustumCulled = false;
  glitter.renderOrder = 5;
  group.add(glitter);
  let gNext = 0;
  let gTime = 0;

  function sparkle(x, y, z, n, spread, up) {
    for (let k = 0; k < n; k++) {
      const i = gNext;
      gNext = (gNext + 1) % GL;
      gPos[i * 3] = x + (Math.random() - 0.5) * spread;
      gPos[i * 3 + 1] = y + (Math.random() - 0.5) * spread;
      gPos[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
      gVel[i * 3] = (Math.random() - 0.5) * 3;
      gVel[i * 3 + 1] = Math.random() * up;
      gVel[i * 3 + 2] = (Math.random() - 0.5) * 3;
      gLife[i] = Math.random() * 0.3;
      gSeed[i] = Math.random();
    }
  }

  /** Lands are where big pieces burst again and shards tinkle: main.js plays them. */
  const lands = [];

  function spawn(x, y, z, vx, vy, vz, sx, sy, big) {
    const i = next;
    next = (next + 1) % cap;
    P[i * 3] = x;
    P[i * 3 + 1] = y;
    P[i * 3 + 2] = z;
    V[i * 3] = vx;
    V[i * 3 + 1] = vy;
    V[i * 3 + 2] = vz;
    Rr[i * 3] = Math.random() * 6;
    Rr[i * 3 + 1] = Math.random() * 6;
    Rr[i * 3 + 2] = Math.random() * 6;
    const spin = big ? 2.5 : 24;
    W[i * 3] = (Math.random() - 0.5) * spin;
    W[i * 3 + 1] = (Math.random() - 0.5) * spin;
    W[i * 3 + 2] = (Math.random() - 0.5) * spin;
    Sx[i] = sx;
    Sy[i] = sy;
    Fl[i] = floorAt(x, z);
    life[i] = 0;
    live[i] = 1;
    bigOne[i] = big ? 1 : 0;
    Tc[i * 3] = shardTint[0];
    Tc[i * 3 + 1] = shardTint[1];
    Tc[i * 3 + 2] = shardTint[2];
    return i;
  }

  function toPile(i) {
    // Lies flat-ish where it fell, for good.
    e.set(Math.PI / 2 + (Math.random() - 0.5) * 0.5, Rr[i * 3 + 1], (Math.random() - 0.5) * 0.5);
    q.setFromEuler(e);
    pv.set(P[i * 3], Fl[i] + 0.004, P[i * 3 + 2]);
    sv.set(Sx[i] * 0.7, Sy[i] * 0.7, 1);
    m.compose(pv, q, sv);
    piles.setMatrixAt(pileNext, m);
    pileNext = (pileNext + 1) % pileCap;
    pileCount = Math.min(pileCap, pileCount + 1);
    piles.count = pileCount;
    piles.instanceMatrix.needsUpdate = true;
    live[i] = 0;
    shards.setMatrixAt(i, zero);
  }

  function floorAt(x, z) {
    // Inside a house the floor is its plinth.
    for (const h of field.houses) {
      const dx = x - h.cx;
      const dz = z - h.cz;
      const u = dx * h.rx + dz * h.rz;
      const d = dx * h.fx + dz * h.fz;
      if (Math.abs(u) < HALF_W + 0.3 && d < 0.8 && d > -11) return h.elev + PLINTH + 0.01;
    }
    return field.groundY(x, z) + 0.02;
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
      let nh = 0;
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
          edges[v].setMatrixAt(counts[v], m);
          holes.setMatrixAt(nh++, paneM[i]);
          teeth[v].setMatrixAt(counts[v]++, m);
        }
      }
      cracks.count = nc;
      holes.count = nh;
      holes.instanceMatrix.needsUpdate = true;
      cracks.instanceMatrix.needsUpdate = true;
      for (let v = 0; v < 3; v++) {
        teeth[v].count = counts[v];
        teeth[v].instanceMatrix.needsUpdate = true;
        edges[v].count = counts[v];
        edges[v].instanceMatrix.needsUpdate = true;
      }
      panes.instanceMatrix.needsUpdate = true;
    },

    /**
     * A pane bursts: shards fly the way the stone was going, some back out onto the patio, a big piece or two slides out whole,
     * glitter hangs in the air. `far`: how far the camera is (far breaks throw bigger pieces, so they still read).
     */
    burst(h, p, dir, big = 1, far = 12) {
      const c = new THREE.Vector3().setFromMatrixPosition(paneM[h * PANES + p]);
      const house = field.houses[h];
      const lowQ = cap < 300;
      const count = Math.round((34 + Math.random() * 16) * big * (lowQ ? 0.5 : 1));
      const sp = Math.hypot(dir?.x ?? 0, dir?.y ?? 0, dir?.z ?? 0) || 1;
      const dx = (dir?.x ?? -house.fx) / sp;
      const dz = (dir?.z ?? -house.fz) / sp;
      const grow = 1 + Math.min(1.2, Math.max(0, (far - 10) / 18));
      // Shards keep the pane's colour.
      const ti = (h * PANES + p) * 4;
      const amt = tintArr[ti + 3] >= 2 ? (tintArr[ti + 3] >= 3 ? 0.3 : 0.9) : tintArr[ti + 3] * 0.8;
      for (let k = 0; k < 3; k++) shardTint[k] = 1 + (tintArr[ti + k] * 1.2 - 1) * Math.min(1, amt);
      for (let k = 0; k < count; k++) {
        const back = Math.random() < 0.34;
        const along = back ? -0.08 - Math.random() * 0.18 : 0.25 + Math.random() * 0.45;
        const ox = (Math.random() - 0.5) * PANE_W * 0.95;
        const oy = (Math.random() - 0.5) * PANE_H * 0.95;
        const s = (0.3 + Math.random() * Math.random() * 1.3) * grow;
        spawn(
          c.x + house.rx * ox,
          c.y + oy,
          c.z + house.rz * ox,
          dx * 10 * along + house.fx * (back ? 1.4 : 0) + (Math.random() - 0.5) * 2.6,
          Math.random() * 3.4 - 0.8 + (back ? 1 : 0),
          dz * 10 * along + house.fz * (back ? 1.4 : 0) + (Math.random() - 0.5) * 2.6,
          s * (0.6 + Math.random() * 0.8),
          s * (0.8 + Math.random() * 1.4),
          false,
        );
      }
      // One or two big pieces that drop out of the frame and burst again below.
      const nBig = lowQ ? 1 : 1 + (Math.random() < 0.5 ? 1 : 0);
      for (let k = 0; k < nBig; k++) {
        const ox = (Math.random() - 0.5) * PANE_W * 0.5;
        const oy = (Math.random() - 0.1) * PANE_H * 0.4;
        spawn(c.x + house.rx * ox, c.y + oy, c.z + house.rz * ox, house.fx * (0.3 + Math.random() * 0.6) + dx * 0.4, 0.3, house.fz * (0.3 + Math.random() * 0.6) + dz * 0.4, 3.4 + Math.random() * 1.5, 4 + Math.random() * 2, true);
      }
      sparkle(c.x + house.fx * 0.3, c.y, c.z + house.fz * 0.3, lowQ ? 14 : 30, PANE_W, 2.5);
    },

    /** Big pieces that hit the ground since the last call: { x, y, z } (then cleared). */
    lands,

    /** What a house's owner wears on their glass (a LOOKS.tint id). */
    setTint(h, id) {
      if (h < 0 || h >= n || wearing[h] === id) return;
      wearing[h] = TINTS[id] !== undefined ? id : 'clear';
      paintHouse(h);
    },

    /** Which of a house's panes are golden today (a bitmask over its panes). */
    setGold(h, mask) {
      if (h < 0 || h >= n || goldMask[h] === (mask | 0)) return;
      goldMask[h] = mask | 0;
      paintHouse(h);
    },

    /** Moves the shards still in the air; still ones go to the piles. */
    update(dt) {
      let moved = false;
      gTime += dt;
      clock.value = gTime;
      glitterMat.uniforms.uTime.value = gTime;
      for (let i = 0; i < cap; i++) {
        if (live[i] !== 1) continue;
        moved = true;
        life[i] += dt;
        V[i * 3 + 1] -= 9.8 * dt;
        // A little air: flat slivers drift.
        V[i * 3] *= 1 - dt * 0.4;
        V[i * 3 + 2] *= 1 - dt * 0.4;
        P[i * 3] += V[i * 3] * dt;
        P[i * 3 + 1] += V[i * 3 + 1] * dt;
        P[i * 3 + 2] += V[i * 3 + 2] * dt;
        Rr[i * 3] += W[i * 3] * dt;
        Rr[i * 3 + 1] += W[i * 3 + 1] * dt;
        Rr[i * 3 + 2] += W[i * 3 + 2] * dt;
        if (P[i * 3 + 1] <= Fl[i]) {
          P[i * 3 + 1] = Fl[i];
          if (bigOne[i]) {
            // The big piece bursts where it lands.
            const x = P[i * 3];
            const z = P[i * 3 + 2];
            const y = Fl[i] + 0.05;
            live[i] = 0;
            shards.setMatrixAt(i, zero);
            for (let k = 0; k < (cap < 300 ? 8 : 18); k++) {
              const a = Math.random() * Math.PI * 2;
              const v = 1 + Math.random() * 3;
              const s2 = 0.35 + Math.random() * 0.8;
              spawn(x, y, z, Math.cos(a) * v, 1 + Math.random() * 2.5, Math.sin(a) * v, s2 * 0.8, s2 * 1.2, false);
            }
            sparkle(x, y + 0.2, z, 10, 0.6, 2);
            if (lands.length < 16) lands.push({ x, y, z });
            continue;
          }
          if (Math.abs(V[i * 3 + 1]) > 1.1) {
            // A bounce and a skitter.
            V[i * 3 + 1] *= -0.28;
            V[i * 3] *= 0.45;
            V[i * 3 + 2] *= 0.45;
            W[i * 3] *= 0.35;
            W[i * 3 + 2] *= 0.35;
          } else {
            toPile(i);
            continue;
          }
        }
        if (life[i] > 5) {
          toPile(i);
          continue;
        }
        e.set(Rr[i * 3], Rr[i * 3 + 1], Rr[i * 3 + 2]);
        q.setFromEuler(e);
        pv.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
        sv.set(Sx[i], Sy[i], 1);
        m.compose(pv, q, sv);
        shards.setMatrixAt(i, m);
        // A white-hot flash as it leaves the frame, then glass.
        const f = 1 + 2.6 * Math.exp(-life[i] * 9);
        shards.setColorAt(i, flash.setRGB(f * Tc[i * 3], f * Tc[i * 3 + 1], f * Tc[i * 3 + 2]));
      }
      if (moved) {
        shards.instanceMatrix.needsUpdate = true;
        if (shards.instanceColor) shards.instanceColor.needsUpdate = true;
      }
      let anyG = false;
      for (let i = 0; i < GL; i++) {
        if (gLife[i] < 0) continue;
        anyG = true;
        gLife[i] += dt;
        if (gLife[i] > 1.4) {
          gLife[i] = -1;
          continue;
        }
        gVel[i * 3 + 1] -= 2.2 * dt;
        gPos[i * 3] += gVel[i * 3] * dt;
        gPos[i * 3 + 1] += gVel[i * 3 + 1] * dt;
        gPos[i * 3 + 2] += gVel[i * 3 + 2] * dt;
      }
      if (anyG) {
        glitterGeo.attributes.position.needsUpdate = true;
        glitterGeo.attributes.life.needsUpdate = true;
        glitterGeo.attributes.seed.needsUpdate = true;
      }
    },

    /** Point size for the glitter, from the drawing buffer's height. */
    setScale(px) {
      glitterMat.uniforms.uScale.value = px;
    },

    /** A new round: every shard swept up. */
    clear() {
      live.fill(0);
      for (let i = 0; i < cap; i++) shards.setMatrixAt(i, zero);
      shards.instanceMatrix.needsUpdate = true;
      pileCount = 0;
      pileNext = 0;
      piles.count = 0;
      gLife.fill(-1);
      lands.length = 0;
    },

    paneWorld(h, p, out) {
      return out.setFromMatrixPosition(paneM[h * PANES + p]);
    },

    dispose() {
      scene.remove(group);
      paneGeo.dispose();
      shardGeo.dispose();
      for (const g of teethGeos) g.dispose();
      for (const g of edgeGeos) g.dispose();
      edgeMat.dispose();
      holeGeo.dispose();
      holeMat.dispose();
      holeTex?.dispose();
      holes.dispose();
      for (const e of edges) e.dispose();
      paneMat.dispose();
      teethMat.dispose();
      crackMat.map?.dispose();
      smudge?.dispose();
      crackMat.dispose();
      shardMat.dispose();
      pileMat.dispose();
      panes.dispose();
      cracks.dispose();
      shards.dispose();
      piles.dispose();
      glitterGeo.dispose();
      glitterMat.dispose();
      for (const t of teeth) t.dispose();
    },
  };
  return G;
}
