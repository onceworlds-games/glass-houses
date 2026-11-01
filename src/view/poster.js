// Store pictures: one staged frame each, drawn by the game's own renderer from a real round frozen at its best moment (no SDK, no
// room, no HUD). ?poster=cover | action | win | multi | icon | badge-<id>. Sets document.body.dataset.ready = '1' when it's on screen.

import { createStage } from './stage.js';
import { createWorld } from './world.js';
import { createSimRound } from '../core/sim.js';
import { createRng } from '../core/rng.js';
import { solveAim, velocityOf, handOf, tracePath, NO_WIND, paneCentre } from '../core/physics.js';
import { PANES, BROKEN, GLASS, CRACKED } from '../core/config.js';
import { loadRigs } from './rig.js';
import { makeArm } from './people.js';

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

export async function runPoster(params) {
  const name = params.get('poster') ?? 'cover';
  const w = Number(params.get('w')) || window.innerWidth || 1280;
  const h = Number(params.get('h')) || window.innerHeight || 720;
  // The same picture every time: the shards' scatter comes from a seed too.
  const rng = createRng(`poster:${name}`);
  Math.random = rng.next;
  document.body.dataset.flow = 'poster';
  await Promise.race([Promise.all([document.fonts.load('700 40px "Josefin Sans"'), document.fonts.load('500 20px Jost'), document.fonts.load('400 40px "Abril Fatface"')]).catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
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
  await loadRigs();
  const W = createWorld(stage);
  const stages = { cover, action, win, multi, icon, look, people, fp };
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
  W.glass.setScale(720 / (2 * Math.tan((50 * Math.PI) / 360)));
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
  if (params.get('burst')) {
    // ?burst=house:pane.pane&bms=ms after: shards in the air.
    const [hs, ps] = params.get('burst').split(':');
    const hb = R.field.houses[Number(hs)];
    shatter(W, R, Number(hs), ps.split('.').map(Number), { x: -hb.fx * 9, y: 1, z: -hb.fz * 9 }, Number(params.get('bms') ?? 200));
  }
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

/**
 * The people, close: the street's six in a row on a lawn, each in a pose (?pose=idle,run,left,wind,throw,hit... per seat; ?at= s
 * into it; ?personas= to recast), the camera in front (?dist=, ?up=, ?aty=, ?side=, ?fov=).
 */
function people(stage, W, w, h, params) {
  const street = Number(params.get('street') ?? 0);
  const R = round(street, 4242, 2000);
  const cast = params.get('personas') ? params.get('personas').split(',') : R.seats.map((s) => s.persona);
  W.setStreet(R.field.index, 'high');
  W.cast(cast);
  W.me = -1;
  const hh = R.field.houses[Number(params.get('house') ?? 0)];
  const poses = (params.get('pose') ?? 'idle').split(',');
  const at = Number(params.get('at') ?? 0.5);
  const gap = Number(params.get('gap') ?? 1.3);
  const d = Number(params.get('dist') ?? 5);
  const sd = Number(params.get('side') ?? 0);
  const cam = { x: hh.cx + hh.fx * (6 + d) + hh.rx * sd, y: hh.elev + Number(params.get('up') ?? 1.3), z: hh.cz + hh.fz * (6 + d) + hh.rz * sd };
  draw(W, R);
  for (let i = 0; i < 6; i++) {
    const b = R.bodies[i];
    const u = (i - 2.5) * gap;
    b.x = hh.cx + hh.fx * 6 + hh.rx * u;
    b.z = hh.cz + hh.fz * 6 + hh.rz * u;
    b.y = hh.elev;
    b.yaw = Math.atan2(-(cam.x - b.x), -(cam.z - b.z)) + Number(params.get('turn') ?? 0);
    b.pitch = 0.1;
    const pose = poses[i % poses.length];
    const fwd = { x: -Math.sin(b.yaw), z: -Math.cos(b.yaw) };
    const rt = { x: Math.cos(b.yaw), z: -Math.sin(b.yaw) };
    const sp = pose === 'walk' ? 1.6 : 3.8;
    const v = { run: fwd, walk: fwd, back: { x: -fwd.x, z: -fwd.z }, left: { x: -rt.x, z: -rt.z }, right: rt }[pose];
    b.vx = v ? v.x * sp : 0;
    b.vz = v ? v.z * sp : 0;
    b.winding = pose === 'wind';
    const pw = params.get('powers') ? params.get('powers').split(',').map(Number) : null;
    b.power = pose === 'wind' ? (pw ? pw[i % pw.length] : Number(params.get('power') ?? 0.8)) : 0;
    b.repairing = pose === 'repair';
    b.ammo = 3;
    b.held = null;
    b.lastThrowAt = -1e9;
    b.stunUntil = -1;
    const ats = params.get('ats') ? params.get('ats').split(',').map(Number) : null;
    const steps = Math.round((ats ? ats[i % ats.length] : at) * 60);
    const f = W.figures[i];
    if (pose === 'ghost') {
      b.ghost = true;
      b.gx = b.x;
      b.gz = b.z;
      b.gy = hh.elev + 2.2;
    }
    if (pose === 'hit') b.stunUntil = R.now + 5000;
    if (pose === 'wave') f.wave();
    if (pose === 'cheer') f.cheer();
    if (pose === 'throw') {
      // Drawn back first, then let go.
      b.winding = true;
      b.power = 0.9;
      for (let k = 0; k < 30; k++) f.update(b, R.now, 1 / 60, false);
      b.winding = false;
      b.lastThrowAt = R.now;
    }
    for (let k = 0; k < Math.max(1, steps); k++) f.update(b, R.now + (pose === 'throw' ? k * 16.7 : 0), 1 / 60, false);
  }
  for (let k = 0; k < 40; k++) W.street.update(0.05, 12 + k * 0.05, R.windNow());
  lookFrom(stage, cam.x, cam.y, cam.z, hh.cx + hh.fx * 6 + hh.rx * sd * 0.3, hh.elev + Number(params.get('aty') ?? 1.0), hh.cz + hh.fz * 6 + hh.rz * sd * 0.3, Number(params.get('fov') ?? 50));
  void w;
  void h;
}

/** First person: the arm and hand at a moment of the throw (?pose=rest|wind|throw|repair, ?power=, ?at= s after release). */
function fp(stage, W, w, h, params) {
  const street = Number(params.get('street') ?? 0);
  const R = round(street, 4242, 4000);
  setup(W, R);
  const me = Number(params.get('seat') ?? 0);
  W.me = me;
  W.hideMe = true;
  const b = R.bodies[me];
  const tgt = R.field.houses[Number(params.get('target') ?? 3)];
  const pane = paneCentre(tgt, 15, {});
  const aim = solveAim(b.x, b.y, b.z, pane, 'stone', { extra: 0.04 });
  b.yaw = aim?.yaw ?? b.yaw;
  b.pitch = Number(params.get('pitch') ?? 0.05);
  b.vx = b.vz = 0;
  b.ammo = 4;
  b.held = params.get('held') || null;
  b.lastThrowAt = -1e9;
  b.stunUntil = -1;
  const pose = params.get('pose') ?? 'rest';
  const arm = makeArm(me);
  stage.camera.add(arm.group);
  draw(W, R);
  b.winding = pose === 'wind';
  b.power = Number(params.get('power') ?? 0.8);
  b.repairing = pose === 'repair';
  for (let k = 0; k < 40; k++) arm.update(b, R.now + k * 16, 1 / 60, false);
  if (pose === 'throw') {
    b.winding = true;
    for (let k = 0; k < 30; k++) arm.update(b, R.now, 1 / 60, false);
    b.winding = false;
    b.lastThrowAt = R.now;
    const n = Math.round(Number(params.get('at') ?? 0.05) * 60);
    for (let k = 0; k <= n; k++) arm.update(b, R.now + k * 16.7, 1 / 60, false);
  }
  for (let k = 0; k < 40; k++) W.street.update(0.05, 12 + k * 0.05, R.windNow());
  const c = stage.camera;
  c.position.set(b.x, b.y + 1.6, b.z);
  c.rotation.set(b.pitch, b.yaw, 0);
  c.fov = Number(params.get('fov') ?? 70);
  c.updateProjectionMatrix();
  c.updateMatrixWorld(true);
  void w;
  void h;
}

// ------------------------------------------------------------------ badges: a bold symbol on a coloured disc

const FLAME_D = 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z';

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
  'hot-hands': { bg: '#B8372B', art: `${flame(0, -18, 6.2, '#FFB547')}${flame(0, -2, 3.6, '#FFE08A')}${stone(0, 34, 0.86)}` },
  firefighter: { bg: '#3563B8', art: `${stone(-42, 40, 0.86)}${flame(44, -60, 4.4, '#FFB547')}${flame(44, -44, 2.4, '#FFE08A')}${stone(44, -28, 0.8)}<g transform="scale(1.25)">${spark()}</g>` },
  salvage: { bg: '#6F8F3A', art: salvage() },
  'long-shot': { bg: '#8A4F9E', art: longShot() },
  'daily-paper': { bg: '#E5B83B', art: paper() },
  'job-done': { bg: '#2BB7B3', art: clipboard() },
  regular: { bg: '#F08A24', art: calendar('3') },
  'neighbourhood-watch': { bg: '#2F6B4F', art: calendar('7') },
  'rock-hound': { bg: '#E8645A', art: level('10') },
  'street-legend': { bg: '#4B2E6B', art: `<g transform="translate(0 14) scale(0.88)">${level('30')}</g>${crown()}` },
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

function flame(x, y, s, fill) {
  return `<path transform="translate(${x} ${y}) scale(${s}) translate(-12 -12)" d="${FLAME_D}" fill="${fill}" stroke="#F3E9D8" stroke-width="${(5 / s).toFixed(2)}" stroke-linejoin="round"/>`;
}

function salvage() {
  const pane = '<rect x="-34" y="-42" width="68" height="80" rx="3" fill="#CFEFF0" stroke="#F3E9D8" stroke-width="8"/><path d="M-34 -42 L-12 -42 L-34 -14 Z" fill="#FFFFFF" opacity="0.7"/>';
  const arrow = '<path d="M-62 40 A70 70 0 1 1 60 40" fill="none" stroke="#FFB547" stroke-width="12" stroke-linecap="round"/><path d="M72 32 L44 26 L50 62 Z" fill="#FFB547" stroke="#FFB547" stroke-width="4" stroke-linejoin="round"/>';
  return `${arrow}${pane}`;
}

function longShot() {
  const arc = '<path d="M-70 66 Q -14 -118 56 -18" fill="none" stroke="#F3E9D8" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 17"/>';
  const pane = '<g transform="translate(64 -6) rotate(8)"><rect x="-26" y="-32" width="52" height="64" rx="3" fill="#CFEFF0" stroke="#F3E9D8" stroke-width="7"/><path d="M-2 -4 L-14 -30 M-2 -4 L14 -30 M-2 -4 L24 -8 M-2 -4 L18 30 M-2 -4 L-8 30 M-2 -4 L-24 6 M-10 -14 L6 -16 L12 0 L0 10 L-12 4 Z" fill="none" stroke="#2A2238" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/></g>';
  return `${arc}${pane}${stone(-72, 66, 0.5)}${sparkle(40, -70, 0.6)}`;
}

function paper() {
  let s = '<g transform="rotate(-7)"><rect x="-74" y="-64" width="148" height="128" rx="4" fill="#FBF6EC" stroke="#F3E9D8" stroke-width="6"/>';
  s += '<text x="0" y="-26" text-anchor="middle" font-family="Abril Fatface" font-size="30" fill="#2A2238">GAZETTE</text>';
  s += '<rect x="-60" y="-18" width="120" height="5" fill="#2A2238"/>';
  s += '<rect x="-60" y="-4" width="56" height="52" fill="#CFEFF0" stroke="#2A2238" stroke-width="3"/><path d="M-56 44 L-34 18 L-20 32 L-8 22 L-8 44 Z" fill="#6F8F3A"/>';
  for (let k = 0; k < 5; k++) s += `<rect x="6" y="${-2 + k * 11}" width="${k === 4 ? 34 : 54}" height="5" rx="2" fill="#B9B0A4"/>`;
  return `${s}</g>`;
}

function clipboard() {
  let s = '<rect x="-58" y="-70" width="116" height="150" rx="10" fill="#A0703C" stroke="#F3E9D8" stroke-width="6"/>';
  s += '<rect x="-46" y="-52" width="92" height="120" rx="3" fill="#FBF6EC"/>';
  s += '<rect x="-26" y="-82" width="52" height="24" rx="6" fill="#B9B0A4" stroke="#F3E9D8" stroke-width="5"/>';
  for (let k = 0; k < 3; k++) {
    const y = -26 + k * 34;
    s += `<path d="M-36 ${y} l8 9 l16 -18" fill="none" stroke="#2F6B4F" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<rect x="-2" y="${y - 3}" width="40" height="7" rx="3" fill="#B9B0A4"/>`;
  }
  return s;
}

function calendar(n) {
  let s = '<rect x="-62" y="-60" width="124" height="134" rx="10" fill="#FBF6EC" stroke="#F3E9D8" stroke-width="6"/>';
  s += '<path d="M-62 -26 V-50 a10 10 0 0 1 10 -10 H52 a10 10 0 0 1 10 10 V-26 Z" fill="#D93A2F"/>';
  s += '<rect x="-36" y="-76" width="12" height="30" rx="6" fill="#F3E9D8"/><rect x="24" y="-76" width="12" height="30" rx="6" fill="#F3E9D8"/>';
  s += `<text x="0" y="58" text-anchor="middle" font-family="Abril Fatface" font-size="86" fill="#2A2238">${n}</text>`;
  return `${s}${flame(58, 56, 2.6, '#FFB547')}`;
}

function level(n) {
  let d = '';
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const r = k % 2 ? 72 : 92;
    d += `${k ? 'L' : 'M'}${(Math.sin(a) * r).toFixed(1)} ${(-Math.cos(a) * r).toFixed(1)} `;
  }
  return `<path d="${d}Z" fill="#FFB547" stroke="#F3E9D8" stroke-width="5" stroke-linejoin="round"/><circle r="58" fill="#FBF6EC"/><text x="0" y="22" text-anchor="middle" font-family="Abril Fatface" font-size="${n.length > 1 ? 62 : 78}" fill="#2A2238">${n}</text>`;
}

function crown() {
  return '<path d="M-46 -50 L-54 -90 L-24 -72 L0 -102 L24 -72 L54 -90 L46 -50 Z" fill="#FFD25A" stroke="#F3E9D8" stroke-width="6" stroke-linejoin="round"/><circle cx="0" cy="-70" r="7" fill="#D93A2F"/>';
}
