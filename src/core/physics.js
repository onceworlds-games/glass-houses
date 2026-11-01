// Stones in flight: gravity and wind, what they hit (glass, frames, houses, the props in the middle, the ground, people), and the
// solver bots and the aiming arc use. No page and no three.js here: node tests run all of it.

import {
  G, DT, KINDS, COLS, ROWS, PANE_W, PANE_H, MULLION, PLINTH, FACADE_W, FACADE_H, HOUSE_DEPTH, ROOF_Y, ROOF_T, ROOF_OVER, EYE, HAND,
  BODY_R, BODY_TOP, BODY_BOTTOM, GHOST_R, GHOST_Y, speedOf, STORE_CLOSE_MS, WIND_ROUND1, WIND_LATE,
} from './config.js';
import { hash, createRng } from './rng.js';

const CELL_U = PANE_W + MULLION;
const CELL_Y = PANE_H + MULLION;
const HALF_W = FACADE_W / 2;

export function toLocal(h, x, z, out) {
  const dx = x - h.cx;
  const dz = z - h.cz;
  out.u = dx * h.rx + dz * h.rz;
  out.d = dx * h.fx + dz * h.fz;
  return out;
}

export function fromLocal(h, u, d, out) {
  out.x = h.cx + h.rx * u + h.fx * d;
  out.z = h.cz + h.rz * u + h.fz * d;
  return out;
}

/** The middle of pane `p` of house `h`, in the world. */
export function paneCentre(h, p, out = {}) {
  const col = p % COLS;
  const row = Math.floor(p / COLS);
  const u = -HALF_W + MULLION + col * CELL_U + PANE_W / 2;
  const y = h.elev + PLINTH + MULLION + row * CELL_Y + PANE_H / 2;
  fromLocal(h, u, 0, out);
  out.y = y;
  out.u = u;
  return out;
}

/** Which pane a point on the facade plane is on: its index, -1 for a mullion, -2 off the glass. `y` is above the house's ground. */
export function paneAt(u, y) {
  const x = u + HALF_W;
  const yy = y - PLINTH;
  if (x < 0 || x > FACADE_W || yy < 0 || yy > FACADE_H) return -2;
  const mx = x % CELL_U;
  const my = yy % CELL_Y;
  if (mx < MULLION || x > FACADE_W - MULLION || my < MULLION || yy > FACADE_H - MULLION) return -1;
  const col = Math.min(COLS - 1, Math.floor(x / CELL_U));
  const row = Math.min(ROWS - 1, Math.floor(yy / CELL_Y));
  return row * COLS + col;
}

// ---------------------------------------------------------------- wind

/** The wind on the street at `ms` into a round: a sideways acceleration (m/s²), the same on every page. */
export function windAt(field, seed, round, ms, out = { x: 0, z: 0, s: 0 }) {
  const st = field.street;
  const r = createRngCached(seed);
  const t = ms / 1000;
  const base = 0.5 + 0.32 * Math.sin((2 * Math.PI * t) / 17 + r.p1) + 0.22 * Math.sin((2 * Math.PI * t) / 7.3 + r.p2);
  const gust = st.gust * 0.18 * Math.sin((2 * Math.PI * t) / 3.1 + r.p3);
  const n = Math.min(1, Math.max(0, base + gust));
  let s = st.wind[0] + (st.wind[1] - st.wind[0]) * n;
  if (round <= 1) s *= WIND_ROUND1;
  if (ms >= STORE_CLOSE_MS) s *= WIND_LATE;
  const a = r.a0 + (r.dir * 2 * Math.PI * t) / r.period + 0.35 * Math.sin((2 * Math.PI * t) / 11 + r.p4);
  out.x = Math.cos(a) * s;
  out.z = Math.sin(a) * s;
  out.s = s;
  return out;
}

const windCache = new Map();
function createRngCached(seed) {
  let w = windCache.get(seed);
  if (!w) {
    const r = createRng(hash(`wind:${seed}`));
    w = { p1: r.range(0, 6.28), p2: r.range(0, 6.28), p3: r.range(0, 6.28), p4: r.range(0, 6.28), a0: r.range(0, 6.28), dir: r.chance(0.5) ? 1 : -1, period: r.range(200, 300) };
    if (windCache.size > 64) windCache.clear();
    windCache.set(seed, w);
  }
  return w;
}

// ---------------------------------------------------------------- aiming

export function dirOf(yaw, pitch, out) {
  const cp = Math.cos(pitch);
  out.x = -Math.sin(yaw) * cp;
  out.y = Math.sin(pitch);
  out.z = -Math.cos(yaw) * cp;
  return out;
}

/** Where a throw leaves the hand: the eye, a little right, down and forward of it. */
export function handOf(x, groundY, z, yaw, out) {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  // Right of the view: (cos yaw, 0, -sin yaw).
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  out.x = x + rx * HAND.right + fx * HAND.fwd;
  out.y = groundY + EYE - HAND.down;
  out.z = z + rz * HAND.right + fz * HAND.fwd;
  return out;
}

/** The launch angle to reach a point `D` away and `H` higher at speed `v`: the low arc or the high one. null when out of reach. */
export function launchAngle(D, H, v, high) {
  const v2 = v * v;
  const disc = v2 * v2 - G * (G * D * D + 2 * H * v2);
  if (disc < 0 || D < 1e-6) return null;
  const root = Math.sqrt(disc);
  return Math.atan((v2 + (high ? root : -root)) / (G * D));
}

// ---------------------------------------------------------------- collisions

const tmp = { u: 0, d: 0 };

function hitStatic(field, x, y, z, r) {
  for (const o of field.obstacles) {
    if (o.type === 'cyl') {
      if (y < o.y0 - r || y > o.y1 + r) continue;
      const dx = x - o.x;
      const dz = z - o.z;
      const rr = o.r + r;
      if (dx * dx + dz * dz <= rr * rr) return o;
    } else if (o.type === 'ell') {
      const ex = (x - o.x) / (o.rx + r);
      const ey = (y - o.y) / (o.ry + r);
      const ez = (z - o.z) / (o.rz + r);
      if (ex * ex + ey * ey + ez * ez <= 1) return o;
    } else if (o.type === 'box') {
      const c = Math.cos(o.rot);
      const s = Math.sin(o.rot);
      const dx = x - o.x;
      const dz = z - o.z;
      const lx = dx * c + dz * s;
      const lz = -dx * s + dz * c;
      if (Math.abs(lx) <= o.hx + r && Math.abs(y - o.y) <= o.hy + r && Math.abs(lz) <= o.hz + r) return o;
    }
  }
  return null;
}

/** A house's solid parts (not its glass): the body behind the facade, the plinth step, the roof slab, the mailbox wall. */
function hitHouseSolid(h, u, d, yl, r, inside) {
  // The roof slab and its cantilever.
  if (u >= -HALF_W - 1.2 - r && u <= HALF_W + 1.2 + r && d >= -HOUSE_DEPTH - 0.6 - r && d <= ROOF_OVER + r && yl >= ROOF_Y - r && yl <= ROOF_Y + ROOF_T + r) return 'roof';
  // The mailbox wall with the house number, right of the glass.
  if (u >= HALF_W + 0.9 - r && u <= HALF_W + 3.1 + r && d >= 1.6 - r && d <= 2.0 + r && yl <= 1.9 + r && yl >= -r) return 'wall';
  // The plinth's front step.
  if (u >= -HALF_W - 0.3 - r && u <= HALF_W + 0.3 + r && d >= -r && d <= 0.8 + r && yl <= PLINTH + r && yl >= -r) return 'plinth';
  if (inside) return null;
  // The house itself, behind the glass.
  if (u >= -HALF_W - 0.3 - r && u <= HALF_W + 0.3 + r && d >= -HOUSE_DEPTH && d <= -r * 0.5 && yl >= -r && yl <= ROOF_Y + r) return 'house';
  return null;
}

/**
 * One step of a stone's flight, from (px,py,pz) by its velocity. Writes the new state into `s` and returns what it hit, or null.
 * `houses` gives each house's pane states (or null for "all glass": the aiming arc). `bodies` are the people and ghosts it may hit.
 * A hit's fields: { what, house, pane, x, y, z, body }.
 */
export function stepStone(s, field, wind, panesOf, bodies, hit, dt = DT) {
  const k = KINDS[s.kind] ?? KINDS.stone;
  const r = k.r;
  const x0 = s.x;
  const y0 = s.y;
  const z0 = s.z;
  s.vx += wind.x * dt;
  s.vz += wind.z * dt;
  s.vy -= G * dt;
  const x1 = x0 + s.vx * dt;
  const y1 = y0 + s.vy * dt;
  const z1 = z0 + s.vz * dt;
  s.x = x1;
  s.y = y1;
  s.z = z1;
  hit.what = null;
  hit.house = -1;
  hit.pane = -1;
  hit.body = -1;
  // Glass first: the facade plane is thin, so crossings are found exactly.
  let bestS = 2;
  for (const h of field.houses) {
    if (s.inside === h.i) continue;
    toLocal(h, x0, z0, tmp);
    const d0 = tmp.d;
    toLocal(h, x1, z1, tmp);
    const d1 = tmp.d;
    if (!(d0 > 0 && d1 <= 0)) continue;
    const f = d0 / (d0 - d1);
    if (f >= bestS) continue;
    const xh = x0 + (x1 - x0) * f;
    const zh = z0 + (z1 - z0) * f;
    const yh = y0 + (y1 - y0) * f;
    toLocal(h, xh, zh, tmp);
    const pane = paneAt(tmp.u, yh - h.elev);
    if (pane === -2) continue;
    bestS = f;
    hit.what = pane === -1 ? 'frame' : 'glass';
    hit.house = h.i;
    hit.pane = pane;
    hit.x = xh;
    hit.y = yh;
    hit.z = zh;
  }
  if (hit.what === 'glass') {
    const panes = panesOf ? panesOf(hit.house) : null;
    if (panes && panes[hit.pane] === 0) {
      // An empty frame: the stone flies into the house.
      s.inside = hit.house;
      hit.what = null;
      hit.house = -1;
      hit.pane = -1;
    } else return hit;
  } else if (hit.what === 'frame') return hit;

  if (s.inside !== undefined && s.inside >= 0) {
    const h = field.houses[s.inside];
    toLocal(h, x1, z1, tmp);
    if (tmp.d < -1.4 || y1 < h.elev + PLINTH + 0.1) {
      hit.what = 'inside';
      hit.house = h.i;
      hit.x = x1;
      hit.y = Math.max(y1, h.elev + PLINTH);
      hit.z = z1;
      return hit;
    }
  }

  // People and ghosts.
  if (bodies) {
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b || b.skip) continue;
      if (b.ghost) {
        if (s.kind === 'pebble') continue;
        const dx = x1 - b.gx;
        const dy = y1 - (b.gy ?? GHOST_Y);
        const dz = z1 - b.gz;
        const rr = GHOST_R + r;
        if (dx * dx + dy * dy + dz * dz <= rr * rr) {
          hit.what = 'ghost';
          hit.body = i;
          hit.x = x1;
          hit.y = y1;
          hit.z = z1;
          return hit;
        }
        continue;
      }
      if (s.kind === 'pebble' || i === s.seat) continue;
      // Test the end of the step and its middle: people are 0.7 m wide and stones move at most 0.25 m a step.
      for (let m = 0; m < 2; m++) {
        const px = m === 0 ? x1 : (x0 + x1) / 2;
        const py = m === 0 ? y1 : (y0 + y1) / 2;
        const pz = m === 0 ? z1 : (z0 + z1) / 2;
        const top = b.y + BODY_TOP;
        const bottom = b.y + BODY_BOTTOM;
        const cy = Math.min(top, Math.max(bottom, py));
        const dx = px - b.x;
        const dy = py - cy;
        const dz = pz - b.z;
        const rr = BODY_R + r;
        if (dx * dx + dy * dy + dz * dz <= rr * rr) {
          hit.what = 'body';
          hit.body = i;
          hit.x = px;
          hit.y = py;
          hit.z = pz;
          return hit;
        }
      }
    }
  }

  // Houses' solid parts.
  for (const h of field.houses) {
    toLocal(h, x1, z1, tmp);
    if (tmp.u < -HALF_W - 3.5 || tmp.u > HALF_W + 3.5 || tmp.d < -HOUSE_DEPTH - 1 || tmp.d > ROOF_OVER + 1) continue;
    const part = hitHouseSolid(h, tmp.u, tmp.d, y1 - h.elev, r, s.inside === h.i);
    if (part) {
      hit.what = part;
      hit.house = h.i;
      hit.x = x1;
      hit.y = y1;
      hit.z = z1;
      return hit;
    }
  }

  const o = hitStatic(field, x1, y1, z1, r);
  if (o) {
    hit.what = o.what;
    hit.x = x1;
    hit.y = y1;
    hit.z = z1;
    return hit;
  }

  const gy = field.groundY(x1, z1);
  if (gy <= -20) {
    // Over the cliff: it falls to the sea.
    if (y1 < -4) {
      hit.what = 'sea';
      hit.x = x1;
      hit.y = y1;
      hit.z = z1;
      return hit;
    }
  } else if (y1 - r <= gy) {
    hit.what = field.groundY(x0, z0) < gy - 0.05 && y0 - r < gy ? 'terrace' : 'ground';
    hit.x = x1;
    hit.y = Math.max(gy, y1);
    hit.z = z1;
    return hit;
  }
  if (x1 * x1 + z1 * z1 > (field.R + 70) * (field.R + 70) || y1 < -25) {
    hit.what = 'gone';
    hit.x = x1;
    hit.y = y1;
    hit.z = z1;
    return hit;
  }
  return null;
}

/**
 * The whole path of a throw, step by step, until it hits something (no other stones; people only if given). Used by the arc
 * (no wind), the bots' aim (with the wind as they read it) and the warning on stones aimed at you. `onPoint(x, y, z, i)` sees each
 * step. Returns the hit (a fresh object) with `t` (seconds), or a 'gone' hit after `maxT`.
 */
export function tracePath(field, kind, o, v, wind, panesOf, bodies, maxT = 4, dt = DT * 2, onPoint = null, seat = -1) {
  const s = { kind, x: o.x, y: o.y, z: o.z, vx: v.x, vy: v.y, vz: v.z, inside: -1, seat };
  const hit = { what: null, house: -1, pane: -1, body: -1, x: 0, y: 0, z: 0, t: 0 };
  const steps = Math.ceil(maxT / dt);
  for (let i = 0; i < steps; i++) {
    const got = stepStone(s, field, wind, panesOf, bodies, hit, dt);
    if (onPoint) onPoint(s.x, s.y, s.z, i);
    if (got) {
      hit.t = (i + 1) * dt;
      return hit;
    }
  }
  hit.what = 'gone';
  hit.x = s.x;
  hit.y = s.y;
  hit.z = s.z;
  hit.t = maxT;
  return hit;
}

const NO_WIND = { x: 0, z: 0, s: 0 };
export { NO_WIND };

/**
 * Aim at a point: the yaw, pitch and power that land a `kind` there from a body at (x, groundY, z), along the low or the high arc,
 * at a given power (or the least power that reaches, plus `extra`). null when it can't reach.
 */
export function solveAim(x, groundY, z, target, kind, opts = {}) {
  const high = !!opts.high;
  const hand = { x: 0, y: 0, z: 0 };
  let yaw = Math.atan2(-(target.x - x), -(target.z - z));
  let pitch = 0;
  let power = opts.power ?? null;
  for (let it = 0; it < 3; it++) {
    handOf(x, groundY, z, yaw, hand);
    const dx = target.x - hand.x;
    const dz = target.z - hand.z;
    const D = Math.hypot(dx, dz);
    const H = target.y - hand.y;
    yaw = Math.atan2(-dx, -dz);
    if (power === null || opts.power === undefined) {
      // The least speed that reaches, then a margin.
      const vmin2 = G * (H + Math.hypot(H, D));
      const k = KINDS[kind] ?? KINDS.stone;
      const need = Math.sqrt(Math.max(0, vmin2)) * (1 + (opts.extra ?? 0.08));
      power = Math.min(1, Math.max(0, (need - k.vmin) / (k.vmax - k.vmin)));
    }
    const v = speedOf(kind, power);
    const ang = launchAngle(D, H, v, high);
    if (ang === null) return null;
    pitch = ang;
  }
  return { yaw, pitch, power };
}

/** A throw's velocity from an aim. */
export function velocityOf(kind, yaw, pitch, power, out = {}) {
  dirOf(yaw, pitch, out);
  const v = speedOf(kind, power);
  out.x *= v;
  out.y *= v;
  out.z *= v;
  return out;
}

export { GHOST_Y };
