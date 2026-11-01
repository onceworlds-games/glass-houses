// The things that make a street a place, modelled for Palm Springs 1962: fan palms with skirts, queen palms, agave, barrel cactus,
// ocotillo and boulders; a finned two-tone sedan; kidney pools with loungers and an umbrella; and inside, the furniture of the
// period: low sofas, the lounge chair, a walnut credenza, the console TV, an arc lamp, a sputnik light, tulip tables, a bed,
// shelves, a starburst clock and plants. Everything goes into a builder (merged by material).
// Each function draws in its own local space (y up, x right, z toward the viewer) placed by a matrix.

import * as THREE from 'three';
import { createRng } from '../core/rng.js';

const tmpM = new THREE.Matrix4();

/** M × translate(x, y, z) × rotateY(ry) × scale(s). */
export function at(M, x = 0, y = 0, z = 0, ry = 0, s = 1) {
  const m = new THREE.Matrix4().makeRotationY(ry);
  if (s !== 1) m.scale(new THREE.Vector3(s, s, s));
  m.setPosition(x, y, z);
  return M ? new THREE.Matrix4().multiplyMatrices(M, m) : m;
}

function box(B, key, M, w, h, d, x, y, z, color, rx = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)));
  g.translate(x, y, z);
  B.add(key, g, M, color);
}

function cyl(B, key, M, r0, r1, h, x, y, z, color, seg = 10, rx = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg);
  if (rx || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)));
  g.translate(x, y, z);
  B.add(key, g, M, color);
}

/** A tapered leg from (x, y0, z) to the floor, splayed out a little (the period's leg). */
function leg(B, key, M, x, z, h, color, splay = 0.12) {
  const g = new THREE.CylinderGeometry(0.025, 0.012, h, 6);
  g.translate(0, -h / 2, 0);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.sign(z) * splay, 0, -Math.sign(x) * splay)));
  g.translate(x, h, z);
  B.add(key, g, M, color);
}

// ---------------------------------------------------------------- noise for rocks and canopies

function vnoise(x, y, z, seed) {
  const h = (a, b, c) => {
    let n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + seed * 13.13) * 43758.5453;
    return n - Math.floor(n);
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

/** A lumpy blob (rock or leaf clump): an icosphere pushed about by noise, coloured darker underneath. */
export function blob(r, detail, seed, amp, colorTop, colorBottom, squash = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = vnoise(v.x * 1.7 / r, v.y * 1.7 / r, v.z * 1.7 / r, seed) - 0.5;
    v.multiplyScalar(1 + n * amp);
    v.y *= squash;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const ng = g.index ? g.toNonIndexed() : g;
  const c = new Float32Array(ng.attributes.position.count * 3);
  const top = new THREE.Color(colorTop);
  const bot = new THREE.Color(colorBottom);
  const tc = new THREE.Color();
  for (let i = 0; i < ng.attributes.position.count; i++) {
    const y = ng.attributes.position.getY(i) / (r * squash);
    tc.copy(bot).lerp(top, Math.min(1, Math.max(0, y * 0.5 + 0.55)));
    c.set([tc.r, tc.g, tc.b], i * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return ng;
}

// ---------------------------------------------------------------- plants

/** One fan frond of a Washingtonia: a petiole and a pleated fan that droops at the tips. Local: base at origin, out along +x. */
function fanFrond(len, spread, droop, seed) {
  const r = createRng(seed);
  const pos = [];
  const col = [];
  const segs = 11;
  const radial = 4;
  const pet = len * 0.42;
  const green = new THREE.Color('#5E8A3A');
  const dark = new THREE.Color('#3E6A2A');
  const tip = new THREE.Color('#8CA65A');
  const c = new THREE.Color();
  // Petiole: a thin flat strip.
  const pw = 0.05;
  pos.push(0, -pw, 0, pet, -0.02 - droop * 0.1, 0, pet, -pw * 0.5 - droop * 0.1, pw, 0, -pw, 0, pet, -pw * 0.5 - droop * 0.1, pw, 0, 0, pw);
  for (let k = 0; k < 6; k++) col.push(0.42, 0.44, 0.25);
  // The fan: a disc sector of `segs` folds out from the petiole's tip, each fold a ridge and a valley.
  const fanAt = (a, rr) => {
    const x = pet + Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const d = rr / (len - pet);
    const y = -droop * 0.1 - droop * d * d * (0.6 + 0.4 * Math.abs(Math.sin(a)));
    return [x, y, z];
  };
  for (let s = 0; s < segs; s++) {
    const a0 = -spread / 2 + (spread * s) / segs;
    const a1 = -spread / 2 + (spread * (s + 1)) / segs;
    const am = (a0 + a1) / 2;
    const ridge = s % 2 ? 0.06 : -0.06;
    for (let q = 0; q < radial; q++) {
      const r0 = ((len - pet) * q) / radial;
      const r1 = ((len - pet) * (q + 1)) / radial * (q === radial - 1 ? 0.9 + r.next() * 0.25 : 1);
      const A = fanAt(a0, r0);
      const Bp = fanAt(a1, r0);
      const C = fanAt(am, r1);
      const D = fanAt(a0, r1);
      const E = fanAt(a1, r1);
      A[1] += ridge * (r0 / len);
      C[1] += ridge * 1.6 * (r1 / len);
      pos.push(...A, ...D, ...C, ...A, ...C, ...Bp, ...Bp, ...C, ...E);
      const t = q / radial;
      c.copy(s % 2 ? dark : green).lerp(tip, t * 0.6);
      for (let k = 0; k < 9; k++) col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A Washingtonia fan palm: a tall, slightly curving trunk, the shaggy skirt of dead fronds under the crown, and a head of fan
 * fronds that sway. Height in metres. `snow` dusts it.
 */
export function fanPalm(B, M, height, seed, snow = false) {
  const r = createRng(seed);
  const lean = r.range(0.02, 0.09);
  const dir = r.range(0, Math.PI * 2);
  const ox = Math.cos(dir);
  const oz = Math.sin(dir);
  const segs = 8;
  const pts = [];
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    pts.push(new THREE.Vector3(ox * lean * height * t * t, height * t, oz * lean * height * t * t));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trunk = new THREE.TubeGeometry(curve, 12, 0.24, 7, false);
  // Taper: thicker at the foot.
  const tp = trunk.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < tp.count; i++) {
    v.fromBufferAttribute(tp, i);
    const t = v.y / height;
    const c = curve.getPoint(Math.min(1, Math.max(0, t)));
    const k = 1.25 - t * 0.45;
    tp.setXYZ(i, c.x + (v.x - c.x) * k, v.y, c.z + (v.z - c.z) * k);
  }
  trunk.computeVertexNormals();
  B.add('sway', trunk, M, snow ? '#9C8A78' : '#8C7560', (y) => Math.pow(Math.max(0, y) / height, 2) * 0.55);
  const top = curve.getPoint(1);
  // The skirt: a ragged hang of dead fronds (some are trimmed to a short boot).
  const skirtH = height * (r.chance(0.5) ? 0.2 : 0.08);
  const skirt = new THREE.CylinderGeometry(0.34, 0.5, skirtH, 10, 4, true);
  const sp = skirt.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    v.fromBufferAttribute(sp, i);
    const n = vnoise(v.x * 4, v.y * 3, v.z * 4, seed) - 0.5;
    v.x *= 1 + n * 0.35;
    v.z *= 1 + n * 0.35;
    if (v.y < -skirtH * 0.4) v.y += n * 0.5;
    sp.setXYZ(i, v.x, v.y, v.z);
  }
  skirt.computeVertexNormals();
  skirt.translate(top.x, top.y - skirtH / 2 - 0.15, top.z);
  B.add('sway', skirt, M, snow ? '#D8D2C8' : '#8E6E4C', (y) => Math.pow(Math.max(0, y) / height, 2) * 0.6);
  const boss = new THREE.SphereGeometry(0.4, 8, 6);
  boss.translate(top.x, top.y, top.z);
  B.add('sway', boss, M, '#6B6A3A', 0.62);
  // The crown.
  const n = 13 + r.int(4);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r.range(-0.15, 0.15);
    const up = r.range(-0.15, 0.75);
    const len = r.range(2.0, 2.7) * (height > 9 ? 1.1 : 1);
    const f = fanFrond(len, r.range(1.5, 2.0), r.range(0.8, 1.6) * (1.1 - up * 0.6), seed * 31 + k);
    f.rotateX(r.range(-0.3, 0.3));
    f.rotateZ(up);
    f.rotateY(a);
    f.translate(top.x, top.y + 0.1, top.z);
    if (snow) {
      const cc = f.attributes.color;
      for (let i = 0; i < cc.count; i++) cc.setXYZ(i, cc.getX(i) * 0.7 + 0.28, cc.getY(i) * 0.7 + 0.28, cc.getZ(i) * 0.7 + 0.3);
    }
    B.add('sway', f, M, null, (y, x, z) => 0.62 + Math.min(0.38, Math.hypot(x - top.x, z - top.z) / 6));
  }
}

/** A queen palm: a smooth grey trunk and long arching feather fronds. Shorter and softer, for yards. */
export function queenPalm(B, M, height, seed, snow = false) {
  const r = createRng(seed);
  const lean = r.range(0.04, 0.12);
  const dir = r.range(0, Math.PI * 2);
  const pts = [];
  for (let s = 0; s <= 6; s++) {
    const t = s / 6;
    pts.push(new THREE.Vector3(Math.cos(dir) * lean * height * t * t, height * t, Math.sin(dir) * lean * height * t * t));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trunk = new THREE.TubeGeometry(curve, 10, 0.17, 7, false);
  B.add('sway', trunk, M, '#A9A196', (y) => Math.pow(Math.max(0, y) / height, 2) * 0.5);
  const top = curve.getPoint(1);
  // Ring marks.
  for (let k = 1; k < 7; k++) {
    const p = curve.getPoint(k / 7);
    const ring = new THREE.TorusGeometry(0.18, 0.025, 4, 10);
    ring.rotateX(Math.PI / 2);
    ring.translate(p.x, p.y, p.z);
    B.add('sway', ring, M, '#8E877C', Math.pow(k / 7, 2) * 0.5);
  }
  const n = 9;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r.range(-0.2, 0.2);
    const len = r.range(2.6, 3.4);
    const rise = r.range(0.35, 0.85);
    // The rachis: an arch out and down, with leaflets hanging off both sides.
    const pos = [];
    const col = [];
    const steps = 9;
    const c = new THREE.Color();
    const P = (t) => [Math.cos(a) * len * t, rise * Math.sin(t * Math.PI * 0.9) * 1.4 - t * t * 1.6, Math.sin(a) * len * t];
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const A = P(t0);
      const Bq = P(t1);
      const w = 0.55 * Math.sin(Math.PI * Math.min(1, t1 * 1.05)) + 0.08;
      const px = -Math.sin(a) * w;
      const pz = Math.cos(a) * w;
      const drop = -0.32 * w;
      for (const sd of [-1, 1]) {
        pos.push(A[0], A[1], A[2], Bq[0], Bq[1], Bq[2], Bq[0] + px * sd, Bq[1] + drop, Bq[2] + pz * sd);
        pos.push(A[0], A[1], A[2], Bq[0] + px * sd, Bq[1] + drop, Bq[2] + pz * sd, A[0] + px * sd * 0.8, A[1] + drop, A[2] + pz * sd * 0.8);
        c.set(s % 2 ? '#557F33' : '#679640').lerp(new THREE.Color('#9AB45E'), t0 * 0.4);
        if (snow) c.lerp(new THREE.Color('#EEF2F5'), 0.35);
        for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    g.translate(top.x, top.y, top.z);
    B.add('sway', g, M, null, (y, x, z) => 0.55 + Math.min(0.45, Math.hypot(x - top.x, z - top.z) / 5));
  }
}

/** Agave: a rosette of thick blue-green blades curving up to a point. */
export function agave(B, M, size, seed, snow = false) {
  const r = createRng(seed);
  const n = 16;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 * 2.4 + r.range(-0.1, 0.1);
    const tier = k / n;
    const len = size * (1.0 - tier * 0.45);
    const g = new THREE.ConeGeometry(0.11 * size * (1.2 - tier * 0.4), len, 4, 3);
    g.translate(0, len / 2, 0);
    // Curve the blade outward then up.
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const t = y / len;
      p.setXYZ(i, p.getX(i) * 1.6, y, p.getZ(i) * 0.5 + t * t * 0.0);
    }
    g.rotateX(0.35 + (1 - tier) * 0.75);
    g.rotateY(a);
    B.add('sway', g, M, snow ? '#C9D6D8' : ['#7FA39A', '#6E9488', '#8DB0A4'][k % 3], (y) => Math.min(0.25, y * 0.2));
  }
}

/** Barrel cactus: a ribbed ball, a crown of yellow flowers. */
export function barrel(B, M, size, seed) {
  const g = new THREE.SphereGeometry(size, 16, 10);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const rib = 1 + Math.cos(a * 16) * 0.06;
    v.x *= rib;
    v.z *= rib;
    if (v.y < 0) v.y *= 0.55;
    v.y *= 1.15;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.translate(0, size * 0.55, 0);
  B.add('plant', g, M, seed % 2 ? '#5F8A48' : '#6D9550');
  for (let k = 0; k < 6; k++) {
    const f = new THREE.SphereGeometry(size * 0.12, 6, 4);
    const a = (k / 6) * Math.PI * 2;
    f.translate(Math.cos(a) * size * 0.25, size * 1.68, Math.sin(a) * size * 0.25);
    B.add('plant', f, M, '#F2C744');
  }
}

/** Ocotillo: a fan of thin whip-like stems from the ground, each tipped with red. */
export function ocotillo(B, M, height, seed) {
  const r = createRng(seed);
  for (let k = 0; k < 9; k++) {
    const a = r.range(0, Math.PI * 2);
    const tilt = r.range(0.08, 0.32);
    const h = height * r.range(0.7, 1.05);
    const pts = [];
    for (let s = 0; s <= 4; s++) {
      const t = s / 4;
      pts.push(new THREE.Vector3(Math.cos(a) * Math.sin(tilt) * h * t + r.range(-0.05, 0.05), h * t, Math.sin(a) * Math.sin(tilt) * h * t + r.range(-0.05, 0.05)));
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 5, 0.035, 4, false);
    B.add('sway', g, M, '#6B6046', (y) => Math.min(0.5, (y / height) ** 2 * 0.5));
    const tip = new THREE.ConeGeometry(0.06, 0.4, 5);
    tip.translate(pts[4].x, pts[4].y + 0.1, pts[4].z);
    B.add('sway', tip, M, '#E0442E', 0.5);
  }
}

/** A desert boulder (or a pile of them). */
export function boulder(B, M, size, seed, color = '#B9926E', key = 'plant') {
  const g = blob(size, 1, seed, 0.55, color, new THREE.Color(color).multiplyScalar(0.62).getStyle(), 0.62);
  g.translate(0, size * 0.25, 0);
  B.add(key, g, M);
}

/** A low clump of desert scrub (creosote, brittlebush). */
export function scrub(B, M, size, seed, snow = false) {
  const r = createRng(seed);
  for (let k = 0; k < 3; k++) {
    const g = blob(size * r.range(0.6, 1), 1, seed + k, 0.7, snow ? '#F4F6F8' : '#9AA35A', snow ? '#C9D0D6' : '#5F6A35', 0.7);
    g.translate(r.range(-0.5, 0.5) * size, size * 0.35, r.range(-0.5, 0.5) * size);
    B.add('sway', g, M, null, 0.12);
  }
}

/** A potted plant indoors: a pot and a fiddle-leaf fig or a snake plant. */
export function pottedPlant(B, key, M, kind, potColor) {
  const pot = new THREE.CylinderGeometry(0.22, 0.16, 0.4, 12);
  pot.translate(0, 0.2, 0);
  B.add(key, pot, M, potColor);
  if (kind === 'snake') {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const h = 0.6 + (k % 3) * 0.2;
      const g = new THREE.ConeGeometry(0.06, h, 3);
      g.scale(1, 1, 0.3);
      g.rotateY(a);
      g.rotateX(0.08 * Math.sin(a));
      g.translate(Math.cos(a) * 0.07, 0.4 + h / 2, Math.sin(a) * 0.07);
      B.add(key, g, M, k % 2 ? '#4E7A3A' : '#6B8F46');
    }
    return;
  }
  cyl(B, key, M, 0.02, 0.03, 1.1, 0, 0.95, 0, '#6B4A33', 5);
  for (let k = 0; k < 11; k++) {
    const a = k * 2.4;
    const y = 0.75 + (k / 11) * 0.9;
    const g = new THREE.SphereGeometry(0.16, 6, 4);
    g.scale(1, 0.5, 0.25);
    g.rotateZ(0.6);
    g.rotateY(a);
    g.translate(Math.cos(a) * 0.15, y, Math.sin(a) * 0.15);
    B.add(key, g, M, k % 2 ? '#3E6A2E' : '#5A8A3A');
  }
}

// ---------------------------------------------------------------- the car

const CAR_TONES = [
  ['#9ED8C6', '#F7F2E8'],
  ['#F2A7B4', '#F7F2E8'],
  ['#7CC6D8', '#F7F2E8'],
  ['#F2D27A', '#F7F2E8'],
  ['#C8553D', '#F7F2E8'],
  ['#A7B8E8', '#2A2238'],
];

/**
 * A 1959 two-tone sedan, 5.4 m of it: long low body, tail fins, a white hardtop, chrome bumpers and side spear, whitewall tyres.
 * Local: length along x (front +x), width along z, on the ground. Keys: solid (paint), smooth (chrome/white), dark (glass, tyres),
 * lamp (lights).
 */
export function car(B, M, tone = 0) {
  const [paint, roof] = CAR_TONES[tone % CAR_TONES.length];
  const W = 1.95;
  const body = new THREE.Shape();
  const pts = [
    [-2.72, 0.34],
    [2.62, 0.34],
    [2.78, 0.52],
    [2.74, 0.86],
    [2.3, 0.92],
    [0.95, 0.97],
    [-1.75, 0.99],
    [-2.5, 1.04],
    [-2.82, 1.0],
    [-2.86, 0.52],
  ];
  pts.forEach(([x, y], i) => (i ? body.lineTo(x, y) : body.moveTo(x, y)));
  body.closePath();
  const bg = new THREE.ExtrudeGeometry(body, { depth: W, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 2 });
  bg.translate(0, 0, -W / 2);
  B.add('car', bg, M, paint);
  // Tail fins along the rear quarters.
  for (const s of [-1, 1]) {
    const fin = new THREE.Shape();
    fin.moveTo(-1.5, 0.98);
    fin.lineTo(-2.84, 0.98);
    fin.lineTo(-2.78, 1.36);
    fin.closePath();
    const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    fg.translate(0, 0, s * (W / 2 - 0.06) - 0.05);
    B.add('car', fg, M, paint);
    // Bullet tail lights in the fins.
    const tl = new THREE.ConeGeometry(0.07, 0.22, 8);
    tl.rotateZ(Math.PI / 2);
    tl.translate(-2.9, 1.12, s * (W / 2 - 0.02));
    B.add('carLight', tl, M, '#E8402E');
    // Headlights, twin.
    for (const dz of [0.32, 0.6]) {
      const hl = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12);
      hl.rotateZ(Math.PI / 2);
      hl.translate(2.81, 0.7, s * dz);
      B.add('carLight', hl, M, '#FFF4D6');
    }
    // Side spear.
    box(B, 'chrome', M, 3.6, 0.04, 0.03, 0.2, 0.72, s * (W / 2 + 0.07), '#E9EEF2');
  }
  // The greenhouse: glass, then the white hardtop over it, thin pillars.
  const cab = new THREE.Shape();
  cab.moveTo(0.82, 0.98);
  cab.lineTo(0.12, 1.46);
  cab.lineTo(-1.12, 1.46);
  cab.lineTo(-1.62, 0.98);
  cab.closePath();
  const cg = new THREE.ExtrudeGeometry(cab, { depth: W - 0.24, bevelEnabled: false });
  cg.translate(0, 0, -(W - 0.24) / 2);
  B.add('dark', cg, M, '#2F3A44');
  box(B, 'smooth', M, 1.36, 0.07, W - 0.16, -0.5, 1.49, 0, roof);
  for (const s of [-1, 1]) for (const px of [0.47, -1.37]) box(B, 'smooth', M, 0.06, 0.5, 0.06, px, 1.22, s * (W / 2 - 0.12), roof, 0, px > 0 ? 0.85 : -0.75);
  // Chrome bumpers and grille.
  box(B, 'chrome', M, 0.16, 0.2, W + 0.12, 2.82, 0.44, 0, '#E9EEF2');
  box(B, 'chrome', M, 0.16, 0.2, W + 0.12, -2.9, 0.44, 0, '#E9EEF2');
  box(B, 'dark', M, 0.04, 0.2, W - 0.6, 2.8, 0.66, 0, '#3A3442');
  // Wheels: black tyre, white wall, chrome cap; half hidden under the body.
  for (const [x, s] of [[1.75, 1], [1.75, -1], [-1.8, 1], [-1.8, -1]]) {
    const z = s * (W / 2 - 0.08);
    const tyre = new THREE.CylinderGeometry(0.37, 0.37, 0.24, 18);
    tyre.rotateX(Math.PI / 2);
    tyre.translate(x, 0.37, z);
    B.add('dark', tyre, M, '#1E1A20');
    const wall = new THREE.CylinderGeometry(0.27, 0.27, 0.02, 18);
    wall.rotateX(Math.PI / 2);
    wall.translate(x, 0.37, z + s * 0.12);
    B.add('smooth', wall, M, '#F4F2EC');
    const cap = new THREE.CylinderGeometry(0.15, 0.17, 0.04, 12);
    cap.rotateX(Math.PI / 2);
    cap.translate(x, 0.37, z + s * 0.135);
    B.add('chrome', cap, M, '#D8DEE4');
  }
}

// ---------------------------------------------------------------- the yard

/** A kidney pool's outline (local x/z), about w by d. */
export function kidneyShape(w, d) {
  const s = new THREE.Shape();
  const hw = w / 2;
  const hd = d / 2;
  s.moveTo(-hw * 0.2, -hd);
  s.bezierCurveTo(hw * 0.7, -hd * 1.1, hw * 1.05, -hd * 0.35, hw, hd * 0.2);
  s.bezierCurveTo(hw * 0.95, hd * 0.95, hw * 0.25, hd * 1.05, -hw * 0.1, hd * 0.75);
  s.bezierCurveTo(-hw * 0.35, hd * 0.55, -hw * 0.55, hd * 1.05, -hw * 0.85, hd * 0.8);
  s.bezierCurveTo(-hw * 1.1, hd * 0.5, -hw * 1.05, -hd * 0.85, -hw * 0.2, -hd);
  return s;
}

/** A pool: white coping round a kidney of water (the water mesh is returned for its own material). */
export function pool(B, M, w, d, waterKey = 'pool') {
  const shape = kidneyShape(w, d);
  const water = new THREE.ShapeGeometry(shape, 24);
  water.rotateX(-Math.PI / 2);
  water.scale(1, 1, -1);
  water.translate(0, 0.02, 0);
  B.add(waterKey, water, M, '#FFFFFF');
  // Coping: the outline offset outward, as a ring.
  const pts = shape.getSpacedPoints(64);
  const ring = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x * 1.0, p.y * 1.0)));
  const outer = new THREE.Shape();
  const c = pts.reduce((a, p) => a.add(new THREE.Vector2(p.x, p.y)), new THREE.Vector2()).multiplyScalar(1 / pts.length);
  pts.forEach((p, i) => {
    const q = new THREE.Vector2(p.x, p.y).sub(c);
    const l = q.length() || 1;
    q.multiplyScalar((l + 0.35) / l).add(c);
    if (i) outer.lineTo(q.x, q.y);
    else outer.moveTo(q.x, q.y);
  });
  outer.holes.push(ring);
  const cop = new THREE.ExtrudeGeometry(outer, { depth: 0.12, bevelEnabled: false, curveSegments: 4 });
  cop.rotateX(-Math.PI / 2);
  cop.scale(1, 1, -1);
  B.add('smooth', cop, M, '#EFE9DE');
}

/** A sun lounger: white frame, striped cushion. */
export function lounger(B, M, stripe) {
  box(B, 'smooth', M, 0.7, 0.05, 1.9, 0, 0.32, 0, '#F4F2EC');
  box(B, 'cloth', M, 0.64, 0.07, 1.25, 0, 0.38, 0.3, stripe);
  box(B, 'cloth', M, 0.64, 0.07, 0.62, 0, 0.55, -0.62, stripe, -0.75);
  for (const [x, z] of [[-0.3, 0.85], [0.3, 0.85], [-0.3, -0.85], [0.3, -0.85]]) box(B, 'smooth', M, 0.04, 0.3, 0.04, x, 0.15, z, '#F4F2EC');
}

/** A striped patio umbrella. */
export function umbrella(B, M, a, b) {
  cyl(B, 'smooth', M, 0.03, 0.03, 2.3, 0, 1.15, 0, '#F4F2EC', 6);
  const n = 8;
  for (let k = 0; k < n; k++) {
    const g = new THREE.ConeGeometry(1.4, 0.45, n, 1, true, (k / n) * Math.PI * 2, (Math.PI * 2) / n);
    g.translate(0, 2.3, 0);
    B.add('cloth', g, M, k % 2 ? a : b);
  }
}

// ---------------------------------------------------------------- inside

/** A long low sofa on tapered legs. w: length. */
export function sofa(B, key, M, w, color, cushion) {
  box(B, key, M, w, 0.22, 0.86, 0, 0.32, 0, color);
  box(B, key, M, w - 0.3, 0.14, 0.7, 0, 0.5, 0.06, cushion);
  box(B, key, M, w - 0.3, 0.42, 0.16, 0, 0.66, -0.34, cushion, -0.12);
  for (const s of [-1, 1]) box(B, key, M, 0.14, 0.3, 0.84, s * (w / 2 - 0.07), 0.54, 0, color);
  for (const [x, z] of [[-w / 2 + 0.15, 0.32], [w / 2 - 0.15, 0.32], [-w / 2 + 0.15, -0.32], [w / 2 - 0.15, -0.32]]) leg(B, key, M, x, z, 0.21, '#5A3A26');
}

/** The lounge chair and ottoman: walnut shells, black leather, a swivel base. */
export function loungeChair(B, key, M) {
  cyl(B, key, M, 0.05, 0.05, 0.3, 0, 0.15, 0, '#2A2238', 6);
  for (let k = 0; k < 5; k++) box(B, key, M, 0.04, 0.03, 0.42, Math.sin((k / 5) * 6.28) * 0.18, 0.02, Math.cos((k / 5) * 6.28) * 0.18, '#2A2238');
  box(B, key, M, 0.78, 0.12, 0.72, 0, 0.38, 0.05, '#6B4429', 0.12);
  box(B, key, M, 0.66, 0.12, 0.62, 0, 0.47, 0.06, '#1E1A22', 0.12);
  box(B, key, M, 0.78, 0.62, 0.1, 0, 0.78, -0.33, '#6B4429', -0.3);
  box(B, key, M, 0.66, 0.56, 0.1, 0, 0.8, -0.26, '#1E1A22', -0.3);
  box(B, key, M, 0.6, 0.12, 0.42, 0, 0.4, 0.95, '#1E1A22');
  box(B, key, M, 0.68, 0.06, 0.5, 0, 0.32, 0.95, '#6B4429');
  cyl(B, key, M, 0.04, 0.04, 0.3, 0, 0.15, 0.95, '#2A2238', 6);
}

/** A walnut credenza on hairpin legs with sliding doors in three colours. */
export function credenza(B, key, M, w, doors) {
  box(B, key, M, w, 0.62, 0.46, 0, 0.62, 0, '#7A4E30');
  const n = doors.length;
  for (let k = 0; k < n; k++) box(B, key, M, w / n - 0.04, 0.52, 0.02, -w / 2 + (k + 0.5) * (w / n), 0.62, 0.24, doors[k]);
  for (const [x, z] of [[-w / 2 + 0.12, 0.16], [w / 2 - 0.12, 0.16], [-w / 2 + 0.12, -0.16], [w / 2 - 0.12, -0.16]]) box(B, key, M, 0.025, 0.31, 0.025, x, 0.155, z, '#2A2238');
  // On top: a lamp base, a vase, a record player.
  cyl(B, key, M, 0.1, 0.13, 0.32, -w / 2 + 0.3, 1.09, 0, '#E5B83B', 10);
  cyl(B, key, M, 0.07, 0.04, 0.36, w / 2 - 0.35, 1.11, 0, '#2BB7B3', 8);
  box(B, key, M, 0.45, 0.08, 0.36, 0.1, 0.97, 0, '#3A3442');
}

/** A console television from 1961: a walnut cabinet on legs, a rounded grey-blue screen (lit when `lit`). */
export function consoleTV(B, key, M, screenKey) {
  box(B, key, M, 1.2, 0.72, 0.5, 0, 0.62, 0, '#6B4429');
  for (const [x, z] of [[-0.5, 0.18], [0.5, 0.18], [-0.5, -0.18], [0.5, -0.18]]) leg(B, key, M, x, z, 0.26, '#3A2A20', 0.08);
  box(B, screenKey, M, 0.6, 0.46, 0.02, -0.18, 0.64, 0.255, '#9DB8C4');
  box(B, key, M, 0.3, 0.46, 0.02, 0.38, 0.64, 0.255, '#C9B89A');
  cyl(B, key, M, 0.008, 0.008, 0.5, -0.1, 1.2, 0, '#D8DEE4', 4, 0, 0.5);
  cyl(B, key, M, 0.008, 0.008, 0.5, 0.1, 1.2, 0, '#D8DEE4', 4, 0, -0.5);
}

/** The arc lamp: a marble foot, a steel arc, a dome shade glowing underneath. */
export function arcLamp(B, key, lampKey, M) {
  box(B, key, M, 0.36, 0.22, 0.24, 0, 0.11, 0, '#EDE7DD');
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(0, 2.6, 0.2), new THREE.Vector3(0, 1.85, 1.6));
  B.add(key, new THREE.TubeGeometry(curve, 16, 0.018, 5, false), M, '#D8DEE4');
  const shade = new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  shade.translate(0, 1.75, 1.6);
  B.add(key, shade, M, '#D8DEE4');
  const bulb = new THREE.SphereGeometry(0.1, 8, 6);
  bulb.translate(0, 1.72, 1.6);
  B.add(lampKey, bulb, M, '#FFF0C8');
}

/** A sputnik chandelier, hanging: a brass ball with rods ending in bulbs. */
export function sputnik(B, key, lampKey, M, drop) {
  cyl(B, key, M, 0.012, 0.012, drop, 0, -drop / 2, 0, '#C9A24A', 4);
  const c = new THREE.SphereGeometry(0.1, 10, 8);
  c.translate(0, -drop, 0);
  B.add(key, c, M, '#C9A24A');
  const r = createRng(9);
  for (let k = 0; k < 12; k++) {
    const d = new THREE.Vector3(r.range(-1, 1), r.range(-0.7, 0.9), r.range(-1, 1)).normalize();
    const L = 0.42;
    const rod = new THREE.CylinderGeometry(0.008, 0.008, L, 3);
    rod.translate(0, L / 2, 0);
    rod.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)));
    rod.translate(0, -drop, 0);
    B.add(key, rod, M, '#C9A24A');
    const b = new THREE.SphereGeometry(0.045, 6, 4);
    b.translate(d.x * L, -drop + d.y * L, d.z * L);
    B.add(lampKey, b, M, '#FFF0C8');
  }
}

/** A tulip table and two tulip chairs. */
export function tulipSet(B, key, M, seat) {
  const prof = [new THREE.Vector2(0.24, 0), new THREE.Vector2(0.24, 0.02), new THREE.Vector2(0.05, 0.08), new THREE.Vector2(0.04, 0.6), new THREE.Vector2(0.12, 0.7), new THREE.Vector2(0.5, 0.72), new THREE.Vector2(0.5, 0.75), new THREE.Vector2(0, 0.75)];
  B.add(key, new THREE.LatheGeometry(prof, 16), M, '#F4F2EC');
  for (const s of [-1, 1]) {
    const Mc = at(M, s * 0.85, 0, 0, s * Math.PI / 2);
    const cp = [new THREE.Vector2(0.2, 0), new THREE.Vector2(0.2, 0.02), new THREE.Vector2(0.04, 0.06), new THREE.Vector2(0.04, 0.38), new THREE.Vector2(0.26, 0.45), new THREE.Vector2(0.27, 0.8), new THREE.Vector2(0.22, 0.82)];
    B.add(key, new THREE.LatheGeometry(cp, 14, Math.PI * 0.35, Math.PI * 1.3), Mc, '#F4F2EC');
    const cu = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14);
    cu.translate(0, 0.47, 0);
    B.add(key, cu, Mc, seat);
  }
}

/** A low platform bed: walnut headboard, white cover, a throw in the owner's colour, two pillows. */
export function bed(B, key, M, throwColor) {
  box(B, key, M, 1.7, 0.3, 2.1, 0, 0.2, 0, '#6B4429');
  box(B, key, M, 1.6, 0.2, 2.0, 0, 0.45, 0, '#F4F2EC');
  box(B, key, M, 1.62, 0.04, 0.7, 0, 0.56, 0.55, throwColor);
  for (const s of [-1, 1]) box(B, key, M, 0.62, 0.14, 0.36, s * 0.38, 0.62, -0.75, '#FFFFFF');
  box(B, key, M, 2.4, 0.9, 0.08, 0, 0.7, -1.05, '#7A4E30');
  for (const s of [-1, 1]) {
    box(B, key, M, 0.45, 0.4, 0.4, s * 1.25, 0.2, -0.82, '#7A4E30');
  }
}

/** Wall shelves with books and pots. */
export function shelves(B, key, M, w, seed) {
  const r = createRng(seed);
  const colors = ['#C8553D', '#E5B83B', '#2B8C8A', '#3563B8', '#F3E9D8', '#7E9070', '#8A4F9E', '#2A2238'];
  for (let k = 0; k < 3; k++) {
    const y = 0.5 + k * 0.5;
    box(B, key, M, w, 0.04, 0.3, 0, y, 0, '#7A4E30');
    let x = -w / 2 + 0.05;
    while (x < w / 2 - 0.15) {
      if (r.chance(0.15)) {
        cyl(B, key, M, 0.07, 0.06, 0.2, x + 0.08, y + 0.12, 0, r.pick(colors), 8);
        x += 0.22;
        continue;
      }
      const bw = r.range(0.03, 0.07);
      const bh = r.range(0.2, 0.32);
      box(B, key, M, bw, bh, 0.22, x + bw / 2, y + bh / 2 + 0.02, 0, r.pick(colors));
      x += bw + 0.005;
    }
  }
  for (const s of [-1, 1]) box(B, key, M, 0.03, 1.6, 0.03, s * (w / 2 - 0.1), 1.0, -0.13, '#2A2238');
}

/** The starburst clock: brass rays round a face. */
export function starburst(B, key, M) {
  const face = new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16);
  face.rotateX(Math.PI / 2);
  B.add(key, face, M, '#F4F2EC');
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const len = k % 2 ? 0.28 : 0.42;
    const g = new THREE.BoxGeometry(0.02, len, 0.015);
    g.translate(0, 0.13 + len / 2, 0);
    g.rotateZ(a);
    B.add(key, g, M, '#C9A24A');
    if (k % 2 === 0) {
      const ball = new THREE.SphereGeometry(0.025, 6, 4);
      ball.translate(-Math.sin(a) * (0.13 + len), Math.cos(a) * (0.13 + len), 0);
      B.add(key, ball, M, '#C9A24A');
    }
  }
}

// ---------------------------------------------------------------- lawn ornaments (earned)

/** A plastic pink flamingo on wire legs. */
export function flamingo(B, M) {
  const body = new THREE.SphereGeometry(0.2, 10, 8);
  body.scale(1.5, 0.9, 0.9);
  body.translate(0, 0.78, 0);
  B.add('solid', body, M, '#F27FA6');
  const neck = new THREE.TubeGeometry(new THREE.CubicBezierCurve3(new THREE.Vector3(0.22, 0.86, 0), new THREE.Vector3(0.45, 1.1, 0), new THREE.Vector3(0.05, 1.25, 0), new THREE.Vector3(0.22, 1.42, 0)), 10, 0.035, 5, false);
  B.add('solid', neck, M, '#F27FA6');
  const head = new THREE.SphereGeometry(0.07, 8, 6);
  head.translate(0.24, 1.44, 0);
  B.add('solid', head, M, '#F27FA6');
  const beak = new THREE.ConeGeometry(0.03, 0.14, 6);
  beak.rotateZ(-2.2);
  beak.translate(0.31, 1.39, 0);
  B.add('solid', beak, M, '#2A2238');
  for (const z of [-0.05, 0.05]) cyl(B, 'smooth', M, 0.008, 0.008, 0.66, -0.02, 0.33, z, '#2A2238', 3);
}

/** A tiki torch: bamboo pole, a woven cup (the flame is drawn by fx). Returns where the flame sits (local). */
export function tikiTorch(B, M) {
  cyl(B, 'solid', M, 0.035, 0.04, 1.7, 0, 0.85, 0, '#C9A86A', 6);
  for (let k = 1; k < 5; k++) cyl(B, 'solid', M, 0.045, 0.045, 0.03, 0, k * 0.36, 0, '#A88A50', 6);
  cyl(B, 'solid', M, 0.1, 0.06, 0.2, 0, 1.78, 0, '#8A6A3A', 8);
  return new THREE.Vector3(0, 1.98, 0);
}

/** A kettle grill on three legs. */
export function grill(B, M) {
  const bowl = new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  bowl.translate(0, 0.78, 0);
  B.add('smooth', bowl, M, '#2A2238');
  const lid = new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  lid.translate(0, 0.8, 0);
  B.add('smooth', lid, M, '#C8553D');
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    cyl(B, 'smooth', M, 0.015, 0.015, 0.62, Math.cos(a) * 0.18, 0.31, Math.sin(a) * 0.18, '#D8DEE4', 4, Math.sin(a) * 0.25, -Math.cos(a) * 0.25);
  }
}

export { box as propBox, cyl as propCyl };
void tmpM;
