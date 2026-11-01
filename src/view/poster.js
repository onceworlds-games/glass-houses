// Store pictures: one staged frame each, drawn by the game's own renderer from a real round frozen at its best moment (no SDK, no
// room, no HUD). ?poster=cover | action | win | multi | icon | badge-<id>. Sets document.body.dataset.ready = '1' when it's on screen.

import { createStage } from './stage.js';
import { createWorld } from './world.js';
import { createSimRound } from '../core/sim.js';
import { createRng } from '../core/rng.js';
import { solveAim, velocityOf, handOf, tracePath, NO_WIND, paneCentre } from '../core/physics.js';
import { PANES, BROKEN, GLASS, CRACKED } from '../core/config.js';

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

export async function runPoster(params) {
  const name = params.get('poster') ?? 'cover';
  const w = Number(params.get('w')) || window.innerWidth || 1280;
  const h = Number(params.get('h')) || window.innerHeight || 720;
  // The same picture every time: the shards' scatter comes from a seed too.
  const rng = createRng(`poster:${name}`);
  Math.random = rng.next;
  document.body.dataset.flow = 'poster';
  await Promise.race([Promise.all([document.fonts.load('700 40px "Josefin Sans"'), document.fonts.load('500 20px Jost')]).catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
  await document.fonts.ready;
  if (name.startsWith('badge-')) {
    badge(name.slice(6), w, h);
    await frame();
    document.body.dataset.ready = '1';
    return;
  }
  const canvas = document.getElementById('view');
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const stage = createStage(canvas, { preserve: true, quality: 'high' });
  stage.resize(w, h, 1);
  const W = createWorld(stage);
  const stages = { cover, action, win, multi, icon, look };
  const run = stages[name] ?? cover;
  run(stage, W, w, h, params);
  stage.render(12);
  await frame();
  stage.render(12);
  await frame();
  document.body.dataset.ready = '1';
}

// ------------------------------------------------------------------ staging helpers

function round(street, seed, ms, personas) {
  const R = createSimRound(street, seed, { personas: personas ?? undefined, round: 2 });
  while (R.now < ms) R.stepTick();
  R.events.length = 0;
  return R;
}

let ids = 0;
/** Puts a stone in the air from seat `from` at a pane of house `to`, then runs it `ms` along its way. */
function throwAt(R, from, to, pane, kind = 'stone', high = false, ms = 300) {
  const b = R.bodies[from];
  const target = paneCentre(R.field.houses[to], pane, {});
  const aim = solveAim(b.x, b.y, b.z, target, kind, { high, extra: 0.06 });
  if (!aim) return null;
  b.yaw = aim.yaw;
  b.pitch = aim.pitch;
  const o = handOf(b.x, b.y, b.z, aim.yaw, {});
  const v = velocityOf(kind, aim.yaw, aim.pitch, aim.power, {});
  const msg = { k: 'throw', id: `poster:${ids++}`, by: R.seats[from].id, kind, r: R.roundNo, o: [o.x * 1000, o.y * 1000, o.z * 1000].map(Math.round), v: [v.x * 1000, v.y * 1000, v.z * 1000].map(Math.round), tk: R.tick };
  R.addThrow(msg, from);
  const s = R.stones[R.stones.length - 1];
  if (s) {
    delete s.pendingUntil;
    // Fly it without the rest of the street moving.
    const steps = Math.round(ms / (1000 / 120));
    for (let k = 0; k < steps && s.alive; k++) {
      s.x += s.vx / 120;
      s.y += s.vy / 120;
      s.z += s.vz / 120;
      s.vy -= 9.8 / 120;
    }
  }
  return s;
}

/** Breaks these panes of a house (shards in the air, `ms` after the hit). */
function shatter(W, R, house, panes, dir, ms) {
  for (const p of panes) R.houses[house].panes[p] = BROKEN;
  W.glass.sync(R.houses);
  for (const p of panes) W.glass.burst(house, p, dir, 1.4);
  for (let t = 0; t < ms; t += 16) W.glass.update(0.016);
}

function setPanes(R, house, broken = [], cracked = []) {
  const ps = R.houses[house].panes;
  ps.fill(GLASS);
  for (const p of broken) ps[p] = BROKEN;
  for (const p of cracked) ps[p] = CRACKED;
}

function lookFrom(stage, x, y, z, tx, ty, tz, fov) {
  const c = stage.camera;
  c.position.set(x, y, z);
  c.lookAt(tx, ty, tz);
  if (fov) {
    c.fov = fov;
    c.updateProjectionMatrix();
  }
  c.updateMatrixWorld();
}

function setup(W, R) {
  W.setStreet(R.field.index, 'high');
  W.cast(R.seats.map((s) => s.persona));
}

function draw(W, R, wind) {
  W.draw(R, 0.016, 12000, wind ?? R.windNow());
}

function mounted(text, css) {
  const ui = document.getElementById('ui');
  const e = document.createElement('div');
  e.className = 'mounted';
  e.style.cssText = `position:absolute;${css}`;
  e.innerHTML = text;
  ui.appendChild(e);
  return e;
}

// ------------------------------------------------------------------ the pictures

/** The cover: a neighbour on their lawn winding up, the dotted arc soaring onto the next glass front, a pane there bursting. */
function cover(stage, W, w, h) {
  const R = round(0, 4242, 30000);
  setup(W, R);
  W.me = -1;
  setPanes(R, 0, [3, 14]);
  setPanes(R, 1, [0, 11, 19]);
  setPanes(R, 2, [2, 6, 7, 15, 16, 17], [9]);
  setPanes(R, 3, [4, 5, 13]);
  setPanes(R, 4, [8, 18]);
  setPanes(R, 5, [10, 11, 12, 1]);
  const f = R.field;
  const b = R.bodies[0];
  const hh = f.houses[1];
  b.x = hh.spawn.x * 0.15 + f.houses[0].spawn.x * 0.85;
  b.z = hh.spawn.z * 0.15 + f.houses[0].spawn.z * 0.85;
  const target = paneCentre(hh, 15, {});
  const aim = solveAim(b.x, b.y, b.z, target, 'stone', { extra: 0.04 });
  b.yaw = aim.yaw;
  b.pitch = aim.pitch;
  b.winding = true;
  b.power = aim.power;
  shatter(W, R, 1, [13], { x: hh.fx, y: 0.3, z: hh.fz }, 130);
  draw(W, R);
  // Into the wind-up pose (the arm eases there over a few frames).
  for (let k = 0; k < 12; k++) W.figures[0].update(b, R.now, 0.05, false);
  const o = handOf(b.x, b.y, b.z, aim.yaw, {});
  const v = velocityOf('stone', aim.yaw, aim.pitch, aim.power, {});
  const pts = [];
  const end = tracePath(f, 'stone', o, v, NO_WIND, R.panesOf, R.bodies, 4, 1 / 60, (x, y, z) => pts.push(x, y, z), 0);
  const from = 3;
  const n = Math.min(64, pts.length / 3 - from);
  const arr = new Float32Array(64 * 3);
  for (let k = 0; k < n; k++) {
    const i = from + Math.floor((k / Math.max(1, n - 1)) * (pts.length / 3 - from - 1));
    arr.set(pts.slice(i * 3, i * 3 + 3), k * 3);
  }
  W.fx.arc(arr, n, end, 'stone');
  // From the green, side-on to the throw: thrower on the left, the target front on the right.
  const mx = (b.x + target.x) / 2;
  const mz = (b.z + target.z) / 2;
  const dx = target.x - b.x;
  const dz = target.z - b.z;
  const d = Math.hypot(dx, dz);
  let px = dz / d;
  let pz = -dx / d;
  if (px * -mx + pz * -mz < 0) {
    px = -px;
    pz = -pz;
  }
  const back = d * 0.66;
  lookFrom(stage, mx + px * back + (dx / d) * 0.6, 1.3, mz + pz * back + (dz / d) * 0.6, mx + (dx / d) * 0.6, 3.3, mz + (dz / d) * 0.6, 60);
  mounted('<span style="display:block">Glass</span><span style="display:block;margin-left:0.55em">Houses</span>', `left:${Math.round(w * 0.05)}px;top:${Math.round(h * 0.05)}px;font-size:${Math.round(h * 0.15)}px;`);
}

/** Puts stone s `back` metres short of point t on its way there at `speed`. */
function inbound(s, from, t, back, speed = 22) {
  const dx = t.x - from.x;
  const dy = t.y - from.y;
  const dz = t.z - from.z;
  const d = Math.hypot(dx, dy, dz) || 1;
  s.x = t.x - (dx / d) * back;
  s.y = t.y - (dy / d) * back;
  s.z = t.z - (dz / d) * back;
  s.vx = (dx / d) * speed;
  s.vy = (dy / d) * speed;
  s.vz = (dz / d) * speed;
}

/** Action: a pane exploding out toward you, the next stone a stride from the glass beside it. */
function action(stage, W) {
  const R = round(0, 77, 26000);
  setup(W, R);
  const hh = R.field.houses[1];
  setPanes(R, 1, [0, 9, 18]);
  const c = paneCentre(hh, 14, {});
  shatter(W, R, 1, [14], { x: hh.fx, y: 0.3, z: hh.fz }, 110);
  shatter(W, R, 1, [5], { x: hh.fx * 0.7, y: 0.15, z: hh.fz * 0.7 }, 60);
  const cam = { x: c.x + hh.fx * 6.2 + hh.rx * 1.6, y: c.y - 1.0, z: c.z + hh.fz * 6.2 + hh.rz * 1.6 };
  const s = throwAt(R, 4, 1, 16, 'stone', false, 0);
  if (s) inbound(s, { x: cam.x + hh.rx * 2, y: cam.y + 1.5, z: cam.z + hh.rz * 2 }, paneCentre(hh, 16, {}), 1.6);
  draw(W, R);
  lookFrom(stage, cam.x, cam.y, cam.z, c.x - hh.rx * 0.6, c.y - 0.5, c.z - hh.rz * 0.6, 60);
}

/** The win: the last house standing glittering at sunset, every other one dark, shards everywhere. */
function win(stage, W) {
  const R = round(1, 9090, 60000);
  setup(W, R);
  for (let i = 0; i < 6; i++) {
    if (i === 3) continue;
    R.houses[i].panes.fill(BROKEN);
    R.houses[i].outAt = 50000;
    R.bodies[i].ghost = true;
    R.bodies[i].gx = Math.cos(i) * 8;
    R.bodies[i].gz = Math.sin(i) * 8;
  }
  setPanes(R, 3, [0, 1, 10, 9, 19, 12]);
  const hh = R.field.houses[3];
  // The last shards of the others still settling.
  for (const k of [2, 4]) shatter(W, R, k, [12, 13, 14], { x: R.field.houses[k].fx, y: 0.2, z: R.field.houses[k].fz }, 400);
  const b = R.bodies[3];
  b.x = hh.spawn.x + hh.fx * 1.5;
  b.z = hh.spawn.z + hh.fz * 1.5;
  b.yaw = Math.atan2(hh.fx, hh.fz);
  b.lastThrowAt = 11950;
  draw(W, R);
  lookFrom(stage, hh.cx + hh.fx * 16 + hh.rx * 4, hh.elev + 2.0, hh.cz + hh.fz * 16 + hh.rz * 4, hh.cx - hh.rx * 1, hh.elev + 3.0, hh.cz - hh.rz * 1, 62);
}

/** Several neighbours at once: the street at night, stones in the air between the lawns, trails glowing. */
function multi(stage, W) {
  const R = round(5, 3131, 40000);
  setup(W, R);
  for (let i = 0; i < 6; i++) {
    const broken = [];
    for (let p = 0; p < PANES; p++) if ((p * 7 + i * 3) % 5 === 0) broken.push(p);
    setPanes(R, i, broken);
  }
  // From under the oak, looking out at two neighbours trading stones across the lawns.
  throwAt(R, 4, 5, 5, 'stone', false, 550);
  throwAt(R, 5, 4, 5, 'stone', false, 650);
  throwAt(R, 4, 0, 5, 'stone', false, 300);
  throwAt(R, 5, 4, 5, 'stone', false, 1000);
  const f = R.field;
  shatter(W, R, 5, [6, 7], { x: f.houses[5].fx, y: 0.2, z: f.houses[5].fz }, 160);
  shatter(W, R, 4, [15], { x: f.houses[4].fx, y: 0.2, z: f.houses[4].fz }, 110);
  R.bodies[4].winding = true;
  R.bodies[4].power = 0.8;
  draw(W, R);
  for (let k = 0; k < 12; k++) W.figures[4].update(R.bodies[4], R.now, 0.05, false);
  lookFrom(stage, 5.6, 2.4, 0.6, 20, 3.2, 0.6, 62);
}

/** The icon: a whole glass front at golden hour with a pane bursting, a stone flying at it from just past the lens. */
function icon(stage, W) {
  const R = round(0, 5150, 14000);
  setup(W, R);
  const hh = R.field.houses[2];
  setPanes(R, 2, [], [16]);
  shatter(W, R, 2, [14, 15], { x: hh.fx, y: 0.3, z: hh.fz }, 90);
  for (let k = 0; k < 2; k++) W.glass.burst(2, 14 + k, { x: hh.fx, y: 0.4, z: hh.fz }, 1.6);
  for (let t = 0; t < 60; t += 16) W.glass.update(0.016);
  const cam = { x: hh.cx + hh.fx * 12.5 + hh.rx * 4.5, y: hh.elev + 1.3, z: hh.cz + hh.fz * 12.5 + hh.rz * 4.5 };
  const look = { x: hh.cx + hh.rx * 0.6, y: hh.elev + 2.6, z: hh.cz + hh.rz * 0.6 };
  const s = throwAt(R, 0, 2, 3, 'stone', false, 0);
  if (s) inbound(s, cam, paneCentre(hh, 3, {}), Math.hypot(look.x - cam.x, look.z - cam.z) - 4.5);
  draw(W, R);
  lookFrom(stage, cam.x, cam.y, cam.z, look.x, look.y, look.z, 58);
}

/**
 * Any view of any street, for looking at the art: ?poster=look&street=0&house=2&dist=14&side=3&up=2 (a house from its lawn), or
 * &cam=x,y,z&at=x,y,z; &fov=60, &broken=n (panes out per house), &ms=round time.
 */
function look(stage, W, w, h, params) {
  const street = Number(params.get('street') ?? 0);
  const R = round(street, 4242, Number(params.get('ms') ?? 20000));
  setup(W, R);
  W.me = -1;
  const nb = Number(params.get('broken') ?? 3);
  for (let i = 0; i < 6; i++) {
    const br = [];
    for (let p = 0; p < PANES && br.length < nb; p++) if ((p * 7 + i * 5) % 9 === 0) br.push(p);
    setPanes(R, i, br);
  }
  const out = (params.get('out') ?? '').split(',').filter(Boolean).map(Number);
  for (const i of out) {
    R.houses[i].panes.fill(BROKEN);
    R.houses[i].outAt = 1000;
  }
  draw(W, R);
  for (let k = 0; k < 40; k++) W.street.update(0.05, 12 + k * 0.05, R.windNow());
  if (params.get('glass') === 'mirror') {
    W.glass.group.traverse((o) => {
      if (o.material?.envMapIntensity !== undefined) {
        o.material.opacity = 1;
        o.material.roughness = 0;
        o.material.roughnessMap = null;
        o.material.metalness = 1;
        o.material.color.set('#ffffff');
        o.material.needsUpdate = true;
      }
    });
  }
  const v = (k) => (params.get(k) ?? '').split(',').map(Number);
  if (params.get('cam')) {
    const c = v('cam');
    const a = v('at');
    lookFrom(stage, c[0], c[1], c[2], a[0], a[1], a[2], Number(params.get('fov') ?? 60));
  } else {
    const hh = R.field.houses[Number(params.get('house') ?? 1)];
    const d = Number(params.get('dist') ?? 16);
    const sd = Number(params.get('side') ?? 0);
    const up = Number(params.get('up') ?? 1.7);
    lookFrom(stage, hh.cx + hh.fx * d + hh.rx * sd, hh.elev + up, hh.cz + hh.fz * d + hh.rz * sd, hh.cx + hh.rx * sd * 0.3, hh.elev + Number(params.get('aty') ?? 3), hh.cz + hh.rz * sd * 0.3, Number(params.get('fov') ?? 60));
  }
  void w;
  void h;
}

// ------------------------------------------------------------------ badges: a bold symbol on a coloured disc

const BADGE_ART = {
  'first-stone': { bg: '#C8553D', art: stone(0, 0, 1.25) },
  shattered: { bg: '#2BB7B3', art: pane(true) },
  'last-house-standing': { bg: '#F08A24', art: house() },
  'glass-half-full': { bg: '#3563B8', art: half() },
  'not-a-scratch': { bg: '#2BB7B3', art: `${pane(false)}${sparkle(30, -34, 1)}${sparkle(-26, 26, 0.6)}` },
  interception: { bg: '#8A4F9E', art: `${stone(-34, 16, 0.75)}${stone(34, -16, 0.75)}${spark()}` },
  'gnome-run': { bg: '#E8645A', art: gnome() },
  fore: { bg: '#E5B83B', art: fore() },
  'house-proud': { bg: '#2F6B4F', art: burst() },
  'the-whole-street': { bg: '#C8553D', art: street() },
};

function badge(id, w, h) {
  const b = BADGE_ART[id] ?? { bg: '#F08A24', art: stone(0, 0, 1.2) };
  const ui = document.getElementById('ui');
  document.getElementById('view').style.display = 'none';
  document.documentElement.style.background = document.body.style.background = '#2A2238';
  ui.innerHTML = `<svg viewBox="-128 -128 256 256" width="${w}" height="${h}" style="position:absolute;inset:0">
    <circle r="124" fill="#120E1A" opacity="0.5" cx="5" cy="7"/>
    <circle r="120" fill="${b.bg}"/>
    <circle r="108" fill="none" stroke="#F3E9D8" stroke-width="5" opacity="0.9"/>
    <g transform="translate(4 6)" opacity="0.35" fill="#2A2238" stroke="#2A2238">${b.art}</g>
    <g>${b.art}</g>
  </svg>`;
  // The shadow copy: every fill and stroke in ink.
  const shadow = ui.querySelector('g[opacity]');
  shadow.querySelectorAll('*').forEach((n) => {
    if (n.getAttribute('fill') && n.getAttribute('fill') !== 'none') n.setAttribute('fill', '#2A2238');
    if (n.getAttribute('stroke')) n.setAttribute('stroke', '#2A2238');
  });
}

function stone(x, y, s) {
  return `<path transform="translate(${x} ${y}) scale(${s})" d="M-34 6 C-38 -18 -16 -34 8 -32 C30 -30 42 -12 38 8 C34 28 12 36 -8 34 C-26 32 -32 22 -34 6 Z" fill="#B9B0A4" stroke="#F3E9D8" stroke-width="5"/><path transform="translate(${x} ${y}) scale(${s})" d="M-14 -18 C-6 -24 6 -24 14 -20" fill="none" stroke="#F3E9D8" stroke-width="5" stroke-linecap="round"/>`;
}

function pane(broken) {
  let s = '<rect x="-56" y="-66" width="112" height="132" rx="4" fill="#CFEFF0" stroke="#F3E9D8" stroke-width="10"/>';
  s += '<path d="M-56 -66 L-20 -66 L-56 -20 Z" fill="#FFFFFF" opacity="0.6"/>';
  if (broken) s += '<path d="M2 -8 L-30 -58 M2 -8 L44 -50 M2 -8 L50 18 M2 -8 L20 60 M2 -8 L-38 50 M2 -8 L-54 4 M-14 -32 L18 -34 L30 4 L8 28 L-24 20 Z" fill="none" stroke="#2A2238" stroke-width="5" stroke-linejoin="round"/>';
  return s;
}

function half() {
  return '<rect x="-56" y="-66" width="112" height="132" rx="4" fill="#CFEFF0" stroke="#F3E9D8" stroke-width="10"/><rect x="-51" y="0" width="102" height="61" fill="#FFB547"/><line x1="-56" y1="0" x2="56" y2="0" stroke="#F3E9D8" stroke-width="8"/>';
}

function sparkle(x, y, s) {
  return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -26 L6 -6 L26 0 L6 6 L0 26 L-6 6 L-26 0 L-6 -6 Z" fill="#FFF6E0"/>`;
}

function spark() {
  let d = '';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    d += `M${(Math.cos(a) * 12).toFixed(1)} ${(Math.sin(a) * 12).toFixed(1)} L${(Math.cos(a) * 30).toFixed(1)} ${(Math.sin(a) * 30).toFixed(1)} `;
  }
  return `<path d="${d}" stroke="#FFB547" stroke-width="7" stroke-linecap="round" fill="none"/>`;
}

function house() {
  return '<path d="M-78 -20 L78 -20 L78 -8 L-78 -8 Z" fill="#F3E9D8"/><rect x="-66" y="-8" width="132" height="64" fill="#CFEFF0" stroke="#F3E9D8" stroke-width="8"/><path d="M-22 -8 V56 M22 -8 V56 M-66 24 H66" stroke="#F3E9D8" stroke-width="6"/><rect x="-76" y="56" width="152" height="12" fill="#F3E9D8"/><path d="M-60 -4 L-36 -4 L-60 20 Z" fill="#FFFFFF" opacity="0.7"/>';
}

function gnome() {
  return '<path d="M0 -84 L34 -10 L-34 -10 Z" fill="#D93A2F" stroke="#F3E9D8" stroke-width="6" stroke-linejoin="round"/><circle cy="4" r="22" fill="#F1C9A5" stroke="#F3E9D8" stroke-width="5"/><path d="M-22 10 Q0 70 22 10 Z" fill="#F7F2E8"/><path d="M-36 40 Q0 30 36 40 L40 80 L-40 80 Z" fill="#3563B8" stroke="#F3E9D8" stroke-width="6" stroke-linejoin="round"/>';
}

function fore() {
  let s = '<circle cy="14" r="40" fill="#F1C9A5" stroke="#F3E9D8" stroke-width="6"/>';
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + (k - 1) * 0.9;
    const x = Math.cos(a) * 66;
    const y = Math.sin(a) * 56 - 4;
    s += `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(0.95)" d="M0 -18 L5 -6 L18 -6 L8 2 L12 15 L0 7 L-12 15 L-8 2 L-18 -6 L-5 -6 Z" fill="#FFF6E0"/>`;
  }
  return s;
}

function burst() {
  let d = '';
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const r1 = k % 2 ? 62 : 84;
    const p = (r, o) => `${(Math.sin(a + o) * r).toFixed(1)} ${(-Math.cos(a + o) * r).toFixed(1)}`;
    d += `M${p(30, -0.16)} L${p(r1, 0)} L${p(30, 0.16)} Z `;
  }
  return `<path d="${d}" fill="#FFB547"/><circle r="34" fill="#F3E9D8"/><path d="M-16 -2 L-4 12 L18 -14" fill="none" stroke="#2F6B4F" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function street() {
  let s = '';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const x = Math.cos(a) * 68;
    const y = Math.sin(a) * 68;
    s += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((a * 180) / Math.PI + 90).toFixed(1)})"><rect x="-16" y="-12" width="32" height="24" fill="#CFEFF0" stroke="#F3E9D8" stroke-width="5"/><rect x="-19" y="-17" width="38" height="6" fill="#F3E9D8"/></g>`;
  }
  return `${s}<circle r="18" fill="#6F8F3A" stroke="#F3E9D8" stroke-width="5"/>`;
}
