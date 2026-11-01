// Everything that moves and isn't a person: what each player throws (their own look) with its trail, hot stones on fire, the aiming
// arc and where it lands, dust and skid marks where a miss lands, sparks when stones meet, knockouts, hail, the specials waiting on
// the lawn lines, leaves (or snow) on the wind.

import * as THREE from 'three';
import { heldMesh } from './people.js';
import { throwable } from './throwables.js';
import { createParticles, SHAPE } from './particles.js';
import { createRibbons } from './ribbons.js';
import { OWNERS } from './palette.js';
import { createRng } from '../core/rng.js';

const CAP = { stone: 64, brick: 12, gnome: 12, pebble: 48 };
const CONFETTI = ['#F08A24', '#E5B83B', '#2BB7B3', '#E8645A', '#3563B8', '#8A4F9E', '#FFFFFF'];
const FIRE = ['#FFE08A', '#FFB040', '#FF7A1A', '#FF4A12'];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

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

/** A throwable's material that can burn: a hot stone glows orange from inside (per instance). */
function heatable(mat) {
  const m = mat.clone();
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  m.onBeforeCompile = (shader, r) => {
    if (prev) prev.call(m, shader, r);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aHot;\nvarying float vHot;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHot = aHot;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHot;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.34, 0.05) * vHot * 2.8;');
  };
  m.customProgramCacheKey = () => `heat:${prevKey}`;
  return m;
}

const solid = (hex, alpha) => {
  const c = new THREE.Color(hex);
  return (f, out) => {
    out[0] = c.r;
    out[1] = c.g;
    out[2] = c.b;
    out[3] = alpha;
  };
};
const gradient = (a, b, alpha) => {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  const c = new THREE.Color();
  return (f, out) => {
    c.copy(ca).lerp(cb, f);
    out[0] = c.r;
    out[1] = c.g;
    out[2] = c.b;
    out[3] = alpha;
  };
};
const rainbow = (alpha) => {
  const c = new THREE.Color();
  return (f, out) => {
    c.setHSL((f * 0.85 + performance.now() / 2400) % 1, 0.85, 0.6);
    out[0] = c.r;
    out[1] = c.g;
    out[2] = c.b;
    out[3] = alpha;
  };
};

export function createFx(scene, quality = 'medium', camera = null) {
  const group = new THREE.Group();
  scene.add(group);
  const parts = createParticles(group, quality);
  const ribbons = createRibbons(group, 80);
  const low = quality === 'low';

  // What's thrown: bricks, gnomes, ghosts' pebbles as they were; stones in each player's own look (made when first thrown).
  const kinds = {};
  for (const k of ['brick', 'gnome', 'pebble']) {
    kinds[k] = instanced(k, CAP[k]);
    group.add(kinds[k]);
  }
  const looks = new Map();
  function lookMesh(id) {
    let L = looks.get(id);
    if (L) return L;
    const t = throwable(id);
    const geo = t.geo.clone();
    const hot = new THREE.InstancedBufferAttribute(new Float32Array(CAP.stone), 1);
    hot.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aHot', hot);
    const im = new THREE.InstancedMesh(geo, heatable(t.mat), CAP.stone);
    im.count = 0;
    im.castShadow = true;
    im.frustumCulled = false;
    group.add(im);
    L = { im, hot, n: 0 };
    looks.set(id, L);
    return L;
  }

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

  /** The old soft puff, now a particle. */
  function puff(x, y, z, color, size, life, vx = 0, vy = 0.6, vz = 0, additive = false) {
    parts.emit({ x, y, z, vx, vy, vz, color, size, grow: 2.2, life, alpha: additive ? 0.9 : 0.8, add: additive, shape: SHAPE.puff, gravity: 0.5, fadePow: 1.2 });
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
  const LEAVES = low ? 40 : 90;
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
  const tmpC = new THREE.Color();

  // ---------------------------------------------------------------- trails
  const styles = new Map();
  /** How a stone's trail looks: its owner's trail, brighter for my own, red when it's coming at me, on fire when hot. */
  function styleFor(kind, trail, seat, mine, incoming, hot) {
    const key = `${kind}|${trail}|${seat}|${mine ? 1 : 0}|${incoming ? 1 : 0}|${hot ? 1 : 0}`;
    let st = styles.get(key);
    if (st) return st;
    const dim = mine ? 1 : 0.6;
    const layers = [];
    let life = 0.22;
    if (kind === 'pebble') layers.push({ width: 0.07, color: solid('#BFD8FF', 0.75 * dim) });
    else if (kind === 'brick' || kind === 'gnome') {
      life = 0.3;
      layers.push({ width: 0.28, color: solid(incoming ? '#FF4A2E' : '#FFFFFF', incoming ? 0.95 : 0.55 * dim) });
    } else {
      const owner = OWNERS[seat % OWNERS.length].color;
      switch (trail) {
        case 'dust':
          layers.push({ width: 0.13, color: solid('#E2CDA2', 0.55 * dim) });
          break;
        case 'ribbon':
          life = 0.45;
          layers.push({ width: 0.2, tail: 0.65, color: gradient('#FFFFFF', owner, 0.92 * Math.max(0.75, dim)) });
          break;
        case 'sparks':
          layers.push({ width: 0.08, glow: true, color: solid('#FFC85A', 0.9 * dim) });
          break;
        case 'confetti':
          layers.push({ width: 0.08, color: solid('#FFFFFF', 0.55 * dim) });
          break;
        case 'bubbles':
          layers.push({ width: 0.06, color: solid('#CFF6FF', 0.45 * dim) });
          break;
        case 'rainbow':
          life = 0.5;
          layers.push({ width: 0.24, tail: 0.45, color: rainbow(0.85 * Math.max(0.75, dim)) });
          break;
        case 'comet':
          life = 0.55;
          layers.push({ width: 0.34, tail: 0.25, glow: true, color: gradient('#2A6CFF', '#BFF4FF', 0.85 * Math.max(0.7, dim)) });
          layers.push({ width: 0.09, glow: true, color: solid('#FFFFFF', 0.9) });
          break;
        case 'hearts':
          layers.push({ width: 0.1, color: solid('#FF8FB8', 0.6 * dim) });
          break;
        case 'news':
          layers.push({ width: 0.12, color: solid('#EFE8D8', 0.6 * dim) });
          break;
        default:
          layers.push({ width: 0.1, color: solid('#FFFFFF', 0.6 * dim) });
      }
      if (incoming) {
        // Coming at me: a hot red streak over whatever it is, so it reads at a glance.
        layers.unshift({ width: 0.17, color: solid('#FF3B26', 0.95) });
        life = Math.max(life, 0.3);
      }
      if (hot) {
        life = Math.max(life, 0.38);
        layers.push({ width: 0.42, tail: 0.2, glow: true, color: gradient('#FF2A08', '#FFD27A', 0.95) });
        layers.push({ width: 0.12, glow: true, color: solid('#FFF4D0', 0.9) });
      }
    }
    st = { life: life * 1000, layers };
    styles.set(key, st);
    return st;
  }

  // What a trail sheds as it flies: particles per second for each look.
  const shedAcc = new Map();
  const SHED = {
    dust: (s, n) => {
      for (let k = 0; k < n; k++) parts.emit({ x: s.x, y: s.y, z: s.z, vx: rand(-0.4, 0.4), vy: rand(-0.1, 0.4), vz: rand(-0.4, 0.4), color: '#D9C49A', size: 0.22, grow: 3, life: 0.8, alpha: 0.45, shape: SHAPE.smoke, drag: 2, fadePow: 1.4 });
    },
    sparks: (s, n) => {
      for (let k = 0; k < n; k++) parts.emit({ x: s.x, y: s.y, z: s.z, vx: s.vx * 0.15 + rand(-3, 3), vy: s.vy * 0.15 + rand(-1, 3), vz: s.vz * 0.15 + rand(-3, 3), color: pick(['#FFD27A', '#FFF2C0', '#FFB040']), bright: 1.6, size: 0.06, life: rand(0.3, 0.55), shape: SHAPE.dot, add: true, stretch: 0.06, gravity: 9, drag: 1 });
    },
    confetti: (s, n) => {
      for (let k = 0; k < n; k++) parts.emit({ x: s.x, y: s.y, z: s.z, vx: rand(-1.2, 1.2), vy: rand(0, 1.5), vz: rand(-1.2, 1.2), color: pick(CONFETTI), size: 0.13, life: 1.5, shape: SHAPE.confetti, gravity: 1.4, drag: 1.8, flutter: 0.9, spin: rand(-9, 9), fadePow: 2 });
    },
    bubbles: (s, n) => {
      for (let k = 0; k < n; k++) parts.emit({ x: s.x, y: s.y, z: s.z, vx: rand(-0.4, 0.4), vy: rand(0, 0.4), vz: rand(-0.4, 0.4), color: '#DDF8FF', size: rand(0.1, 0.24), grow: 1.25, life: rand(1.1, 1.8), shape: SHAPE.bubble, rise: 0.5, drag: 2, flutter: 0.5, alpha: 0.95, fadePow: 3 });
    },
    rainbow: (s, n) => {
      for (let k = 0; k < n; k++) parts.emit({ x: s.x, y: s.y, z: s.z, vx: rand(-0.6, 0.6), vy: rand(-0.3, 0.6), vz: rand(-0.6, 0.6), color: tmpC.setHSL(Math.random(), 0.9, 0.65).getHex(), size: 0.16, life: 0.6, shape: SHAPE.star, add: true, drag: 2, spin: rand(-3, 3) });
    },
    comet: (s, n) => {
      for (let k = 0; k < n; k++) parts.emit({ x: s.x + rand(-0.15, 0.15), y: s.y + rand(-0.15, 0.15), z: s.z + rand(-0.15, 0.15), vx: rand(-0.5, 0.5), vy: rand(-0.5, 0.5), vz: rand(-0.5, 0.5), color: pick(['#BFF4FF', '#FFFFFF', '#8FB8FF']), bright: 1.4, size: rand(0.12, 0.26), life: rand(0.4, 0.8), shape: SHAPE.star, add: true, drag: 2, spin: rand(-4, 4) });
    },
    hearts: (s, n) => {
      for (let k = 0; k < n; k++) parts.emit({ x: s.x, y: s.y, z: s.z, vx: rand(-0.5, 0.5), vy: rand(0, 0.5), vz: rand(-0.5, 0.5), color: pick(['#FF6FA5', '#FF8FB8', '#FF4F7F']), size: rand(0.14, 0.22), grow: 1.2, life: 1.2, shape: SHAPE.heart, rise: 0.8, drag: 2.2, flutter: 0.4, rot: rand(-0.4, 0.4), fadePow: 2 });
    },
    news: (s, n) => {
      for (let k = 0; k < n; k++) parts.emit({ x: s.x, y: s.y, z: s.z, vx: rand(-1, 1), vy: rand(0, 1), vz: rand(-1, 1), color: '#FFFFFF', size: rand(0.2, 0.3), life: 1.9, shape: SHAPE.news, gravity: 0.9, drag: 2.4, flutter: 1.3, spin: rand(-4, 4), fadePow: 2 });
    },
  };
  const RATE = { dust: 30, sparks: 45, confetti: 28, bubbles: 16, rainbow: 10, comet: 22, hearts: 14, news: 9 };

  function burn(s, n, mine) {
    for (let k = 0; k < n; k++) {
      parts.emit({ x: s.x + rand(-0.06, 0.06), y: s.y + rand(-0.06, 0.06), z: s.z + rand(-0.06, 0.06), vx: s.vx * 0.06 + rand(-0.5, 0.5), vy: s.vy * 0.06 + rand(0, 0.8), vz: s.vz * 0.06 + rand(-0.5, 0.5), color: pick(FIRE), bright: 1.5, size: rand(0.2, mine ? 0.36 : 0.3), grow: 0.25, life: rand(0.22, 0.4), shape: SHAPE.flame, add: true, rise: 3, drag: 3, rot: rand(-0.3, 0.3), fadeIn: 0.08 });
    }
    if (Math.random() < n * 0.18) parts.emit({ x: s.x, y: s.y, z: s.z, vx: rand(-0.3, 0.3), vy: 0.6, vz: rand(-0.3, 0.3), color: '#3A3030', size: 0.28, grow: 3.2, life: 1.1, alpha: 0.32, shape: SHAPE.smoke, rise: 0.8, drag: 1.5, spin: rand(-1, 1) });
  }

  // ---------------------------------------------------------------- hail
  let hail = 0;
  let hailAcc = 0;
  let windNow = { x: 0, z: 0 };
  function hailstone() {
    const cx = camera ? camera.position.x : 0;
    const cz = camera ? camera.position.z : 0;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 34;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    const g = field ? field.groundY(x, z) : 0;
    const h = rand(12, 20);
    const vy = -rand(20, 26);
    const vx = windNow.x * 2.2;
    const vz = windNow.z * 2.2;
    const life = h / -vy;
    parts.emit({
      x: x - vx * life,
      y: g + h,
      z: z - vz * life,
      vx,
      vy,
      vz,
      color: '#F4FBFF',
      size: rand(0.05, 0.09),
      life,
      alpha: 0.95,
      shape: SHAPE.dot,
      stretch: 0.11,
      fadeIn: 0.02,
      fadePow: 0.1,
      then: (px, py, pz) => {
        if (Math.random() < 0.6) parts.emit({ x: px, y: g + 0.06, z: pz, vx: rand(-1, 1), vy: rand(2, 3.5), vz: rand(-1, 1), color: '#F4FBFF', size: 0.06, life: 0.35, shape: SHAPE.dot, gravity: 12, fadePow: 0.5 });
        if (Math.random() < 0.25) parts.emit({ x: px, y: g + 0.08, z: pz, vy: 0.2, color: '#FFFFFF', size: 0.25, grow: 2, life: 0.4, alpha: 0.35, shape: SHAPE.puff });
      },
    });
  }

  const X = {
    group,
    puff,
    parts,
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

    /**
     * Draws the stones in the air with their trails. incoming(stone): whether it's coming at this player; lookOf(seat): that
     * player's look ({ stone, trail }) or null; me: this player's seat.
     */
    stones(list, t, incoming, lookOf = () => null, me = -1) {
      const n = { brick: 0, gnome: 0, pebble: 0 };
      for (const L of looks.values()) L.n = 0;
      const dt = X.lastDt ?? 1 / 60;
      for (const s of list) {
        if (!s.alive || s.pendingUntil !== undefined) continue;
        const look = s.kind === 'stone' ? lookOf(s.seat) : null;
        const spin = t / 1000;
        e.set(spin * 9 + s.ox, spin * 6 + s.oz, 0);
        q.setFromEuler(e);
        v.set(s.x, s.y, s.z);
        sc.setScalar(1);
        m.compose(v, q, sc);
        if (s.kind === 'stone') {
          const L = lookMesh(look?.stone ?? 'river');
          if (L.n >= CAP.stone) continue;
          L.im.setMatrixAt(L.n, m);
          L.hot.array[L.n] = s.hot ? 0.75 + 0.25 * Math.sin(t / 40 + s.ox * 9) : 0;
          L.n++;
        } else {
          const k = s.kind in n ? s.kind : 'pebble';
          if (n[k] >= CAP[k]) continue;
          kinds[k].setMatrixAt(n[k]++, m);
        }
        // The trail, and what it sheds.
        const mine = s.seat === me;
        const inc = incoming(s);
        const trail = look?.trail ?? 'plain';
        ribbons.push(s.id, s.x, s.y, s.z, t, styleFor(s.kind, trail, s.seat, mine, inc, s.hot));
        const rate = (s.kind === 'stone' ? RATE[trail] ?? 0 : 0) * (low ? 0.5 : 1) * (mine ? 1 : 0.7);
        const hotRate = s.hot ? (mine ? 70 : 45) * (low ? 0.5 : 1) : 0;
        if (rate || hotRate) {
          const acc = shedAcc.get(s.id) ?? [0, 0];
          acc[0] += rate * dt;
          acc[1] += hotRate * dt;
          const a = Math.floor(acc[0]);
          const b = Math.floor(acc[1]);
          acc[0] -= a;
          acc[1] -= b;
          shedAcc.set(s.id, acc);
          if (a) SHED[trail]?.(s, a);
          if (b) burn(s, b, mine);
        }
        if (s.hot) {
          parts.glowAt(s.x, s.y, s.z, '#FF7A1A', mine ? 1.1 : 0.9, 0.85);
          parts.glowAt(s.x, s.y, s.z, '#FFF0C0', 0.36, 0.9, SHAPE.dot);
        }
      }
      for (const k of Object.keys(n)) {
        kinds[k].count = n[k];
        kinds[k].instanceMatrix.needsUpdate = true;
      }
      for (const L of looks.values()) {
        L.im.count = L.n;
        L.im.instanceMatrix.needsUpdate = true;
        L.hot.needsUpdate = true;
      }
      if (shedAcc.size > 200) shedAcc.clear();
    },

    /** The arc of dots: points along the no-wind path, and what it lands on. hot: the stone in hand is hot. */
    arc(points, n, end, kind, hot = false) {
      const count = Math.min(DOTS, n);
      dots.count = count;
      for (let i = 0; i < count; i++) {
        v.set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
        const f = i / Math.max(1, count - 1);
        // Dots shrink and fade toward the far end.
        sc.setScalar(1.15 - f * 0.55);
        m.compose(v, q.identity(), sc);
        dots.setMatrixAt(i, m);
        if (hot) tmpC.setRGB(1, 0.7 - f * 0.3, 0.3 - f * 0.2);
        else tmpC.setRGB(1, 0.96 - f * 0.1, 0.86 - f * 0.25);
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
          ring.material.color.set(hot ? '#FFB060' : '#FFF4DA');
        } else {
          cross.visible = true;
          cross.position.set(end.x, end.y, end.z);
          cross.lookAt(points[(count - 2) * 3], points[(count - 2) * 3 + 1], points[(count - 2) * 3 + 2]);
          const c = end.what === 'glass' ? (hot ? '#FF8A3A' : '#FFF4DA') : '#FFB547';
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
    land(x, y, z, vx, vz, what, hot = false) {
      const dust = what === 'ground' && X.snow ? '#FFFFFF' : what === 'ground' ? '#D9C49A' : '#CFC4B4';
      for (let k = 0; k < 5; k++) parts.emit({ x: x + rand(-0.15, 0.15), y: y + 0.12, z: z + rand(-0.15, 0.15), vx: rand(-0.6, 0.6) + vx * 0.05, vy: rand(0.4, 1.1), vz: rand(-0.6, 0.6) + vz * 0.05, color: dust, size: rand(0.35, 0.6), grow: 2.4, life: rand(0.7, 1.1), alpha: 0.7, shape: SHAPE.smoke, drag: 1.5, gravity: 0.3, spin: rand(-1, 1) });
      // Clods: a few bits of turf (or snow) thrown up.
      if (what === 'ground') for (let k = 0; k < 5; k++) parts.emit({ x, y: y + 0.08, z, vx: rand(-1.4, 1.4) + vx * 0.08, vy: rand(1.8, 3.4), vz: rand(-1.4, 1.4) + vz * 0.08, color: X.snow ? '#FFFFFF' : pick(['#5C4A2E', '#6F8F3A', '#4E6A2A']), size: rand(0.05, 0.09), life: 0.6, shape: SHAPE.dot, gravity: 9.8, fadePow: 0.3 });
      if (hot) X.embers(x, y + 0.1, z, 10);
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
      for (let k = 0; k < 12; k++) parts.emit({ x, y, z, vx: rand(-7, 7), vy: rand(-2, 6), vz: rand(-7, 7), color: pick(['#FFD87A', '#FFF4DA']), bright: 1.5, size: 0.07, life: rand(0.25, 0.45), shape: SHAPE.dot, add: true, stretch: 0.05, gravity: 9, drag: 1.5 });
      parts.emit({ x, y, z, color: '#FFF4DA', size: 0.8, grow: 2.2, life: 0.18, shape: SHAPE.star, add: true, rot: rand(0, 1) });
      parts.emit({ x, y, z, color: '#FFE6A0', size: 0.4, grow: 5, life: 0.3, alpha: 0.8, shape: SHAPE.ring, add: true });
    },

    glint(x, y, z, size = 1) {
      parts.emit({ x, y, z, vy: 0.2, color: '#FFF6E0', size: 1.1 * size, grow: 1.5, life: 0.3, shape: SHAPE.star, add: true, rot: rand(0, 1.5), fadeIn: 0.1 });
    },

    poof(x, y, z, color) {
      for (let k = 0; k < 10; k++) parts.emit({ x: x + rand(-0.5, 0.5), y: y + rand(-0.5, 0.5), z: z + rand(-0.5, 0.5), vx: rand(-1, 1), vy: rand(0, 1.5), vz: rand(-1, 1), color, size: rand(0.6, 1.1), grow: 2, life: 0.8, alpha: 0.8, shape: SHAPE.smoke, add: true, drag: 2, spin: rand(-2, 2) });
    },

    dust(x, y, z, n = 10, color = '#D9C49A') {
      for (let k = 0; k < n; k++) parts.emit({ x: x + rand(-3, 3), y: y + rand(0, 0.6), z: z + rand(-3, 3), vx: rand(-0.6, 0.6), vy: rand(0.4, 1), vz: rand(-0.6, 0.6), color, size: rand(1.2, 2.6), grow: 2, life: rand(1.4, 2.2), alpha: 0.6, shape: SHAPE.smoke, drag: 0.8, spin: rand(-0.5, 0.5) });
    },

    /** A pane goes: a white flash at the hole (a hot stone's goes up in flames, a golden one in gold). */
    shatter(x, y, z, opts = {}) {
      const far = opts.far ?? 10;
      const k = 1 + Math.min(2, far / 14);
      parts.emit({ x, y, z, color: '#FFFFFF', size: 1.1 * k, grow: 1.8, life: 0.16, shape: SHAPE.star, add: true, rot: rand(0, 1.5) });
      parts.emit({ x, y, z, color: '#DFF8FF', size: 0.5 * k, grow: 4, life: 0.32, alpha: 0.7, shape: SHAPE.ring, add: true });
      if (opts.hot) {
        for (let i = 0; i < (low ? 10 : 22); i++) parts.emit({ x: x + rand(-0.5, 0.5), y: y + rand(-0.5, 0.5), z: z + rand(-0.5, 0.5), vx: rand(-1.5, 1.5), vy: rand(0, 2.5), vz: rand(-1.5, 1.5), color: pick(FIRE), bright: 1.5, size: rand(0.4, 0.8), grow: 0.3, life: rand(0.35, 0.6), shape: SHAPE.flame, add: true, rise: 3, drag: 2 });
        X.embers(x, y, z, low ? 12 : 26);
        for (let i = 0; i < 5; i++) parts.emit({ x: x + rand(-0.4, 0.4), y, z: z + rand(-0.4, 0.4), vy: rand(0.8, 1.4), color: '#2E2828', size: 0.6, grow: 3.4, life: 1.8, alpha: 0.4, shape: SHAPE.smoke, rise: 0.3, drag: 1, spin: rand(-1, 1) });
      }
      if (opts.gold) X.gold(x, y, z);
    },

    /** Sparks of a fire. */
    embers(x, y, z, n) {
      for (let i = 0; i < n; i++) parts.emit({ x, y, z, vx: rand(-4, 4), vy: rand(0, 5), vz: rand(-4, 4), color: pick(['#FFB040', '#FFD27A', '#FF6A1A']), bright: 1.6, size: rand(0.04, 0.08), life: rand(0.5, 1.1), shape: SHAPE.dot, add: true, stretch: 0.05, gravity: 5, drag: 1.2 });
    },

    /** Gold: coins of light and a ring. */
    gold(x, y, z) {
      for (let i = 0; i < (low ? 12 : 26); i++) parts.emit({ x, y, z, vx: rand(-3, 3), vy: rand(1, 5), vz: rand(-3, 3), color: pick(['#FFD54A', '#FFF0A0', '#F2B21E']), bright: 1.4, size: rand(0.12, 0.24), life: rand(0.7, 1.2), shape: SHAPE.star, add: true, gravity: 4, drag: 1, spin: rand(-6, 6) });
      parts.emit({ x, y, z, color: '#FFD54A', size: 0.8, grow: 5, life: 0.5, shape: SHAPE.ring, add: true });
    },

    /** A pane glazed again from a knockout: a ring of light closing on it. */
    salvage(x, y, z) {
      parts.emit({ x, y, z, color: '#BFFFE6', size: 2.4, grow: 0.2, life: 0.45, shape: SHAPE.ring, add: true, fadeIn: 0.2 });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        parts.emit({ x: x + Math.cos(a) * 0.9, y: y - 0.6, z: z + Math.sin(a) * 0.9, vx: -Math.cos(a) * 1.4, vy: 1.6, vz: -Math.sin(a) * 1.4, color: '#DFFFF2', bright: 1.3, size: 0.2, life: 0.6, shape: SHAPE.star, add: true, drag: 2.5 });
      }
    },

    /** A house is out: a shockwave along the lawn, a cloud of dust, the owner's colour in the air. x, y, z: the front door. */
    knockout(x, y, z, color) {
      parts.emit({ x, y: y + 0.3, z, color: '#FFF4DA', size: 2, grow: 9, life: 0.7, alpha: 0.95, shape: SHAPE.ring, add: true, fadePow: 1.5 });
      parts.emit({ x, y: y + 1.5, z, color, size: 3, grow: 5, life: 0.9, alpha: 0.8, shape: SHAPE.ring, add: true, fadeIn: 0.1 });
      parts.emit({ x, y: y + 2, z, color: '#FFFFFF', size: 6, grow: 1.6, life: 0.25, shape: SHAPE.star, add: true });
      for (let i = 0; i < (low ? 10 : 22); i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rand(2, 6);
        parts.emit({ x, y: y + rand(0.2, 1.2), z, vx: Math.cos(a) * sp, vy: rand(0.2, 1.4), vz: Math.sin(a) * sp, color: pick(['#E8DCC8', '#D9C49A', '#CFC4B4']), size: rand(1, 2), grow: 2.4, life: rand(1.4, 2.4), alpha: 0.7, shape: SHAPE.smoke, drag: 1.4, spin: rand(-1, 1) });
      }
      for (let i = 0; i < (low ? 14 : 30); i++) parts.emit({ x, y: y + 1, z, vx: rand(-4, 4), vy: rand(3, 8), vz: rand(-4, 4), color: pick([color, color, '#FFFFFF', '#2A2238']), size: rand(0.14, 0.22), life: rand(1.6, 2.6), shape: SHAPE.confetti, gravity: 3, drag: 1.3, flutter: 1, spin: rand(-9, 9), fadePow: 2 });
    },

    /** Confetti for a win, over x, y, z. */
    confetti(x, y, z, n = 60) {
      for (let i = 0; i < n; i++) parts.emit({ x: x + rand(-2, 2), y: y + rand(0, 2), z: z + rand(-2, 2), vx: rand(-3, 3), vy: rand(2, 7), vz: rand(-3, 3), color: pick(CONFETTI), size: rand(0.14, 0.24), life: rand(2.2, 3.4), shape: SHAPE.confetti, gravity: 2.2, drag: 1.2, flutter: 1, spin: rand(-9, 9), fadePow: 3 });
    },

    /** A hail shower: on or off. */
    hail(on) {
      hail = on ? 1 : 0;
    },
    get hailing() {
      return hail > 0;
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
          w = { mesh, obj, halo, at: t, y: sp.y ?? 0, landed: false, twinkle: 0 };
          waiting.set(sp.id, w);
        }
        // It drops in from above, then turns slowly with a pulsing ring.
        const k = Math.min(1, (t - w.at) / 900);
        const drop = 1 - (1 - k) * (1 - k);
        w.mesh.position.y = w.y + 6 * (1 - drop) + (k >= 1 ? 0.35 + Math.sin(t / 300) * 0.08 : 0.35);
        w.halo.position.y = -w.mesh.position.y + w.y + 0.06;
        w.obj.rotation.y = t / 700;
        w.halo.scale.setScalar(1 + Math.sin(t / 200) * 0.08);
        if (k >= 1 && !w.landed) {
          w.landed = true;
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            parts.emit({ x: sp.x, y: w.y + 0.2, z: sp.z, vx: Math.cos(a) * 3, vy: 0.4, vz: Math.sin(a) * 3, color: '#E8DCC8', size: 0.6, grow: 2, life: 0.9, alpha: 0.7, shape: SHAPE.smoke, drag: 3 });
          }
        }
        if (k >= 1 && t > w.twinkle) {
          w.twinkle = t + 260;
          const a = Math.random() * Math.PI * 2;
          parts.emit({ x: sp.x + Math.cos(a) * 0.8, y: w.y + rand(0.3, 1.2), z: sp.z + Math.sin(a) * 0.8, vy: 0.5, color: '#FFD27A', size: rand(0.14, 0.24), life: 0.6, shape: SHAPE.star, add: true, spin: 2 });
        }
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
      X.lastDt = dt;
      windNow = wind ?? windNow;
      // Hail: hundreds of stones a second while it lasts.
      if (hail > 0) {
        hailAcc += dt * (low ? 140 : 280);
        while (hailAcc >= 1) {
          hailAcc--;
          hailstone();
        }
      }
      parts.update(dt, t);
      if (camera) ribbons.draw(camera.position, t);
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
      parts.clear();
      ribbons.clear();
      shedAcc.clear();
      hail = 0;
      for (let i = 0; i < MARKS; i++) {
        marks.setMatrixAt(i, zero);
        markLife[i] = 0;
      }
      marks.instanceMatrix.needsUpdate = true;
      X.hideArc();
      for (const k of Object.keys(kinds)) kinds[k].count = 0;
      for (const L of looks.values()) L.im.count = 0;
    },
  };
  return X;
}
