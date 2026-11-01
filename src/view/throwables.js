// What a player throws, as they chose it in the locker: a river stone to start, then a baseball, a geode, a lemon, a pine cone, a
// lucky die, a snow globe, a crystal, a meteorite, a golden egg, a tennis ball. All about a stone's size (the rules don't change),
// each one geometry with its colours in the vertices, so a street of them draws as one instanced mesh per kind.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const R = 0.1;

function noise3(x, y, z) {
  return Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 0.5 + Math.sin(x * 4.1 + z * 3.3) * 0.3 + Math.sin(y * 5.7 + x * 2.2) * 0.2;
}

/** Paints every vertex of `g` from its position: fn(x, y, z, out Color) on the unit-ish shape. */
function paint(g, fn) {
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    fn(p.getX(i), p.getY(i), p.getZ(i), c, i);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const clean = (g) => {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) if (!['position', 'normal', 'color'].includes(name)) out.deleteAttribute(name);
  if (!out.attributes.normal) out.computeVertexNormals();
  return out;
};

const merge = (list) => mergeGeometries(list.map(clean), false);

/** A smooth river stone, a little flat, speckled grey with a pale band. */
export function riverStone(r = 0.095, seed = 1) {
  const g = new THREE.IcosahedronGeometry(r, 2);
  const p = g.attributes.position;
  const base = new THREE.Color('#8C857D');
  const band = new THREE.Color('#C9C1B4');
  const dark = new THREE.Color('#5F5952');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / r;
    const y = p.getY(i) / r;
    const z = p.getZ(i) / r;
    const n = noise3(x + seed, y, z) * 0.06;
    p.setXYZ(i, x * r * 1.08 * (1 + n), y * r * 0.74 * (1 + n), z * r * 1.18 * (1 + n));
  }
  paint(g, (x, y, z, c) => {
    const ux = x / r;
    const uy = y / r;
    const speck = Math.abs(Math.sin(ux * 41 + uy * 57 + (z / r) * 33 + seed)) > 0.93;
    const b = Math.abs(uy * 1.2 + ux * 0.35) < 0.12;
    c.copy(base).lerp(band, b ? 0.85 : 0).lerp(dark, speck ? 0.7 : Math.max(0, -uy) * 0.35);
  });
  g.computeVertexNormals();
  return g;
}

/** A ball with a seam: the baseball's red stitches or a tennis ball's white line (the classic two-lobed curve). */
function seamBall(r, body, seam, stitches, fuzz = 0) {
  const g = new THREE.SphereGeometry(r, 64, 44);
  const pts = [];
  const a = 0.7;
  const b = 0.3;
  const c = 2 * Math.sqrt(a * b);
  for (let k = 0; k < 240; k++) {
    const t = (k / 240) * Math.PI * 2;
    pts.push(new THREE.Vector3(a * Math.cos(t) + b * Math.cos(3 * t), c * Math.sin(2 * t), a * Math.sin(t) - b * Math.sin(3 * t)).normalize());
  }
  const bodyC = new THREE.Color(body);
  const seamC = new THREE.Color(seam);
  const n = new THREE.Vector3();
  paint(g, (x, y, z, col) => {
    n.set(x, y, z).normalize();
    let best = 9;
    let at = 0;
    for (let k = 0; k < pts.length; k++) {
      const d = n.distanceToSquared(pts[k]);
      if (d < best) {
        best = d;
        at = k;
      }
    }
    const d = Math.sqrt(best);
    // Stitches: short dashes either side of the seam line; a tennis ball's seam is one soft white band.
    const on = stitches ? d > 0.045 && d < 0.13 && Math.sin(at * 2.4) > 0.1 : d < 0.06;
    col.copy(bodyC);
    if (fuzz) col.offsetHSL(0, 0, Math.sin(x * 900 + z * 700) * 0.5 * fuzz);
    if (stitches && d < 0.03) col.lerp(new THREE.Color('#D8D0C0'), 0.6);
    if (on) col.copy(seamC);
  });
  return g;
}

function geode() {
  const r = 0.1;
  const g = new THREE.IcosahedronGeometry(r, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const n = 1 + noise3(x * 20, y * 20, z * 20) * 0.08;
    x *= n;
    y *= n * 0.9;
    z *= n;
    // Cut open on one side: the hollow full of crystal.
    if (z > r * 0.38) z = r * 0.38 - (r * 0.12) * (1 - Math.hypot(x, y) / r);
    p.setXYZ(i, x, y, z);
  }
  const shell = new THREE.Color('#7B6A5C');
  const rind = new THREE.Color('#E8E0F2');
  const amethyst = new THREE.Color('#7B3FB8');
  const deep = new THREE.Color('#3E1C6E');
  paint(g, (x, y, z, c) => {
    if (z > r * 0.24) {
      const k = Math.hypot(x, y) / r;
      if (k > 0.82) c.copy(rind);
      else c.copy(amethyst).lerp(deep, 1 - k).offsetHSL(0, 0, Math.sin(x * 400 + y * 300) > 0.6 ? 0.18 : 0);
    } else c.copy(shell).offsetHSL(0, 0, noise3(x * 30, y * 30, z * 30) * 0.06);
  });
  g.computeVertexNormals();
  return g;
}

function lemon() {
  const r = 0.085;
  const g = new THREE.SphereGeometry(r, 24, 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const u = x / r;
    // Stretched, with a little nub at each end, and dimpled peel.
    const nub = Math.max(0, Math.abs(u) - 0.86) * 1.6;
    const dimple = 1 + Math.sin(x * 900) * Math.sin(y * 800) * Math.sin(z * 850) * 0.012;
    p.setXYZ(i, x * 1.32 * (1 + nub), y * dimple, z * dimple);
  }
  const peel = new THREE.Color('#F2D33A');
  const tip = new THREE.Color('#9BB83A');
  paint(g, (x, y, z, c) => {
    const u = Math.abs(x) / (r * 1.32);
    c.copy(peel).lerp(tip, Math.max(0, u - 0.92) * 8);
  });
  g.computeVertexNormals();
  return g;
}

function pinecone() {
  // Rings of scales round a core, tapering to a point.
  const list = [];
  const core = new THREE.CylinderGeometry(0.03, 0.045, 0.2, 8);
  paint(core, (x, y, z, c) => c.set('#4A2E1A'));
  list.push(core);
  const rings = 7;
  for (let k = 0; k < rings; k++) {
    const f = k / (rings - 1);
    const y = -0.09 + f * 0.18;
    const rad = 0.05 + Math.sin(f * Math.PI) * 0.045 - f * 0.02;
    const n = 7;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + k * 0.45;
      const s = new THREE.ConeGeometry(0.028, 0.055, 4);
      s.rotateX(Math.PI / 2 + 0.5);
      s.translate(0, 0, rad * 0.8);
      s.rotateY(a);
      s.translate(0, y, 0);
      const light = (k + j) % 3 === 0;
      paint(s, (x, yy, z, c) => c.set(light ? '#A9733F' : '#8A5A2E').offsetHSL(0, 0, Math.max(0, z * 0) + (Math.hypot(x, z) > rad ? 0.06 : -0.04)));
      list.push(s);
    }
  }
  return merge(list);
}

function die() {
  const s = 0.15;
  const g = new THREE.BoxGeometry(s, s, s, 10, 10, 10);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  // Round the corners: push each vertex toward a rounded box.
  const h = s / 2;
  const rr = 0.025;
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const cx = Math.max(-h + rr, Math.min(h - rr, v.x));
    const cy = Math.max(-h + rr, Math.min(h - rr, v.y));
    const cz = Math.max(-h + rr, Math.min(h - rr, v.z));
    const d = new THREE.Vector3(v.x - cx, v.y - cy, v.z - cz);
    if (d.lengthSq() > 1e-9) d.setLength(rr);
    p.setXYZ(i, cx + d.x, cy + d.y, cz + d.z);
  }
  const ivory = new THREE.Color('#F4EFE4');
  const pip = new THREE.Color('#C8283A');
  const ink = new THREE.Color('#1F1B26');
  // Pips per face (in face coordinates from -1 to 1).
  const P = {
    1: [[0, 0]],
    2: [[-0.5, -0.5], [0.5, 0.5]],
    3: [[-0.5, -0.5], [0, 0], [0.5, 0.5]],
    4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
    5: [[-0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, 0.5], [0.5, 0.5]],
    6: [[-0.5, -0.55], [0.5, -0.55], [-0.5, 0], [0.5, 0], [-0.5, 0.55], [0.5, 0.55]],
  };
  paint(g, (x, y, z, c) => {
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    const az = Math.abs(z);
    let face;
    let u;
    let w;
    if (ax >= ay && ax >= az) [face, u, w] = [x > 0 ? 3 : 4, z / h, y / h];
    else if (ay >= az) [face, u, w] = [y > 0 ? 1 : 6, x / h, z / h];
    else [face, u, w] = [z > 0 ? 2 : 5, x / h, y / h];
    c.copy(ivory);
    for (const [pu, pw] of P[face]) if ((u - pu) ** 2 + (w - pw) ** 2 < 0.05) c.copy(face === 1 ? pip : ink);
  });
  g.computeVertexNormals();
  return g;
}

function globe() {
  const list = [];
  const ball = new THREE.SphereGeometry(0.085, 22, 16);
  ball.translate(0, 0.025, 0);
  const water = new THREE.Color('#A9D6EC');
  const snow = new THREE.Color('#FFFFFF');
  const house = new THREE.Color('#E0623A');
  paint(ball, (x, y, z, c) => {
    // The scene inside, seen through the glass: a little red house in the snow, flakes all round.
    const yy = y - 0.025;
    c.copy(water);
    if (yy < -0.03) c.copy(snow);
    else if (Math.abs(x) < 0.03 && yy < 0.015 && z > 0) c.copy(house);
    if (Math.sin(x * 600) * Math.sin(y * 520) * Math.sin(z * 580) > 0.55) c.copy(snow);
  });
  list.push(ball);
  const base = new THREE.CylinderGeometry(0.07, 0.085, 0.05, 18);
  base.translate(0, -0.065, 0);
  paint(base, (x, y, z, c) => c.set(Math.abs(y + 0.065) < 0.008 ? '#D9A441' : '#6B3E22'));
  list.push(base);
  return merge(list);
}

function crystal() {
  const g = new THREE.OctahedronGeometry(0.1, 0);
  g.scale(0.75, 1.35, 0.75);
  paint(g, (x, y, z, c) => c.set(y > 0 ? '#9FF0FF' : '#36B8E0'));
  return clean(g);
}

function meteor() {
  const r = 0.1;
  const g = new THREE.IcosahedronGeometry(r, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = 1 + noise3(x * 25, y * 25, z * 25) * 0.12 - Math.max(0, Math.sin(x * 60) * Math.sin(z * 55)) * 0.06;
    p.setXYZ(i, x * n, y * n * 0.92, z * n);
  }
  const rock = new THREE.Color('#2E2A2C');
  const lava = new THREE.Color('#FF6A1A');
  paint(g, (x, y, z, c) => {
    const vein = Math.abs(Math.sin(x * 70 + Math.sin(y * 40) * 2) * Math.sin(z * 60 + y * 30));
    c.copy(rock).lerp(lava, vein < 0.12 ? 1 - vein / 0.12 : 0);
  });
  g.computeVertexNormals();
  return g;
}

function egg() {
  const pts = [];
  for (let k = 0; k <= 14; k++) {
    const t = k / 14;
    const a = t * Math.PI;
    // Fuller at the bottom.
    const rad = Math.sin(a) * 0.085 * (1 - 0.18 * Math.cos(a));
    pts.push(new THREE.Vector2(Math.max(0.0001, rad), -Math.cos(a) * 0.115));
  }
  const g = new THREE.LatheGeometry(pts, 22);
  paint(g, (x, y, z, c) => c.set('#F2C14E').offsetHSL(0, 0, Math.sin(y * 120) * 0.03));
  return clean(g);
}

const STANDARD = (opts = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, ...opts });

/** Glowing parts (a meteorite's veins, a crystal): the vertex colour, lit from inside. */
function glowing(opts = {}) {
  const { glow, ...rest } = opts;
  void glow;
  const m = STANDARD(rest);
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      #ifdef USE_COLOR
      totalEmissiveRadiance += vColor.rgb * smoothstep(0.55, 0.95, vColor.r - vColor.b * 0.6) * ${(opts.glow ?? 2.4).toFixed(2)};
      #endif`,
    );
  };
  m.customProgramCacheKey = () => `glowing:${opts.glow ?? 2.4}`;
  return m;
}

const BUILD = {
  river: () => ({ geo: riverStone(0.095), mat: STANDARD({ roughness: 0.55 }) }),
  baseball: () => ({ geo: clean(seamBall(0.085, '#F4F0E6', '#C8283A', true)), mat: STANDARD({ roughness: 0.7 }) }),
  geode: () => ({ geo: geode(), mat: STANDARD({ roughness: 0.4, metalness: 0.15 }) }),
  lemon: () => ({ geo: lemon(), mat: STANDARD({ roughness: 0.45 }) }),
  pinecone: () => ({ geo: pinecone(), mat: STANDARD({ roughness: 0.9, flatShading: true }) }),
  die: () => ({ geo: die(), mat: STANDARD({ roughness: 0.25 }) }),
  globe: () => ({ geo: globe(), mat: STANDARD({ roughness: 0.08, metalness: 0.1, envMapIntensity: 2 }) }),
  crystal: () => ({ geo: crystal(), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.3, flatShading: true, emissive: new THREE.Color('#1E8FB0'), emissiveIntensity: 0.8, envMapIntensity: 2.4 }) }),
  meteor: () => ({ geo: meteor(), mat: glowing({ roughness: 0.85, glow: 3 }) }),
  egg: () => ({ geo: egg(), mat: STANDARD({ roughness: 0.18, metalness: 0.9, envMapIntensity: 1.8 }) }),
  tennis: () => ({ geo: clean(seamBall(0.08, '#D7E64A', '#F7F7EE', false, 0.04)), mat: STANDARD({ roughness: 0.95 }) }),
};
export const THROWABLE_IDS = Object.keys(BUILD);

const cache = new Map();
/** Geometry and material for a throwable (shared: don't dispose). Unknown ids are river stones. */
export function throwable(id) {
  const key = BUILD[id] ? id : 'river';
  let t = cache.get(key);
  if (!t) {
    t = BUILD[key]();
    t.geo.computeBoundingSphere();
    cache.set(key, t);
  }
  return t;
}

/** A throwable as an object to hold. */
export function throwableMesh(id) {
  const t = throwable(id);
  const m = new THREE.Mesh(t.geo, t.mat);
  m.castShadow = true;
  m.userData.shared = true;
  return m;
}
