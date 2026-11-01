// One round on one street: six houses of glass, the people on their lawns, every stone in the air. The same code runs headless
// (tests, the title's attract mode, balance runs) and on every page in a match, where each page only decides what belongs to it
// (`decides(house)`, `controls(seat)`) and predicts the rest.

import {
  TICK_MS, DT, PANES, COLS, GLASS, CRACKED, BROKEN, KINDS, AMMO_MAX, AMMO_REFILL_MS, REPAIR_MS, STUN_MS, IMMUNE_MS, STRAFE, ACCEL,
  ICE_ACCEL, INTERCEPT_R, GHOST_SPEED, GHOST_Y, PEBBLES_MAX, PEBBLE_REFILL_MS, POOF_MS, SPECIAL_FIRST_MS, SPECIAL_LAST_MS,
  SPECIAL_LIFE_MS, SPECIAL_DROP_MS, PICKUP_R, HISTORY_TICKS, STONE_MAX_MS, STORE_CLOSE_MS, ROUND_MS, powerAt, LATE_MAX_MS, MAX_STONES,
  EYE,
} from './config.js';
import { clampToLawn, inLawn } from './streets.js';
import { stepStone, windAt, handOf, velocityOf, tracePath, paneCentre } from './physics.js';
import { createRng, hash } from './rng.js';
import { twistRules, goldPanes } from './twists.js';

const PRED_MS = 650;

// Trick shots: what makes a break worth naming.
export const LONG_SHOT_M = 38;
export const RAINBOW_M = 7;
export const RUN_SPEED = 3.0;
export const PAYBACK_MS = 6000;
export const LAST_STAND = 2;
export const BUZZER_MS = 6000;

/** Panes in the order a glazier re-glazes them: the middle of the facade first, ground floor first. */
export const REPAIR_ORDER = Array.from({ length: PANES }, (_, p) => p).sort((a, b) => {
  const ca = Math.abs((a % COLS) - (COLS - 1) / 2);
  const cb = Math.abs((b % COLS) - (COLS - 1) / 2);
  return ca - cb || Math.floor(a / COLS) - Math.floor(b / COLS) || a - b;
});

export const glassCount = (panes) => {
  let n = 0;
  for (let i = 0; i < panes.length; i++) if (panes[i] > 0) n++;
  return n;
};

/** Whether any pane is broken or cracked (a glazier has work). */
export const needsGlass = (panes) => {
  for (let i = 0; i < panes.length; i++) if (panes[i] < GLASS) return true;
  return false;
};

export function maskOf(panes) {
  let g = 0;
  let c = 0;
  for (let i = 0; i < PANES; i++) {
    if (panes[i] > 0) g |= 1 << i;
    if (panes[i] === CRACKED) c |= 1 << i;
  }
  return { g: g >>> 0, c: c >>> 0 };
}

export function panesFromMask(g, c, out = new Uint8Array(PANES)) {
  for (let i = 0; i < PANES; i++) out[i] = (g >>> i) & 1 ? ((c >>> i) & 1 ? CRACKED : GLASS) : BROKEN;
  return out;
}

function facing(x, z) {
  return Math.atan2(x, z);
}

export function newBody(field, seat) {
  const h = field.houses[seat];
  const x = h.spawn.x;
  const z = h.spawn.z;
  return {
    seat,
    x,
    z,
    y: h.elev,
    vx: 0,
    vz: 0,
    yaw: facing(x, z),
    pitch: 0.12,
    winding: false,
    windMs: 0,
    power: 0,
    ammo: AMMO_MAX,
    ammoMs: 0,
    stunUntil: -1,
    immuneUntil: -1,
    repairing: false,
    repairMs: 0,
    held: null,
    ghost: false,
    gx: 0,
    gz: 0,
    gy: GHOST_Y,
    pebbles: PEBBLES_MAX,
    pebbleMs: 0,
    poofUntil: -1,
    heat: 0,
    hot: false,
    streak: 0,
    away: false,
    skip: false,
    lastThrowAt: -1e9,
    input: { mx: 0, mz: 0, yaw: facing(x, z), pitch: 0.12, throwHeld: false, releasePower: null, repair: false },
  };
}

/**
 * opts: { field, seed, round, twist (the Gazette's, see twists.js), rules (overrides of its rules, for tests), seats: [{ id, name,
 *         bot, persona, skill, gentle }], host, decides(h), controls(s), brains, onThrow(msg), onGrab(special), late (bool: replay
 *         late throws against other stones) }
 */
export function createRound(opts) {
  const field = opts.field;
  const seats = opts.seats;
  const n = seats.length;
  const seedNum = typeof opts.seed === 'number' ? opts.seed >>> 0 : hash(String(opts.seed));
  const decides = opts.decides ?? (() => true);
  const controls = opts.controls ?? (() => true);
  const host = opts.host ?? true;
  const wind = { x: 0, z: 0, s: 0 };
  const hit = { what: null, house: -1, pane: -1, body: -1, x: 0, y: 0, z: 0 };
  const clampOut = { x: 0, z: 0, clamped: false };
  const handTmp = { x: 0, y: 0, z: 0 };
  const velTmp = { x: 0, y: 0, z: 0 };
  const rules = { ...twistRules(opts.twist ?? 'quiet'), ...(opts.rules ?? {}) };
  const gold = goldPanes(seedNum, opts.round ?? 1, rules.gold);
  const goldMask = gold.reduce((m, p) => m | (1 << p), 0) >>> 0;

  const R = {
    field,
    seed: seedNum,
    roundNo: opts.round ?? 1,
    seats,
    tick: 0,
    now: 0,
    over: false,
    houses: field.houses.slice(0, n).map((h) => ({ i: h.i, seat: h.i, panes: new Uint8Array(PANES).fill(GLASS), version: 0, outAt: -1, lastBy: -1, koBy: -1, salvaged: false, hurtBy: -1, hurtAt: -1e9, gold: goldMask, pending: new Map(), hitsTaken: 0 })),
    bodies: seats.map((_, i) => newBody(field, i)),
    stones: [],
    recent: [],
    specials: [],
    events: [],
    stats: seats.map(() => ({ thrown: 0, broke: 0, cracked: 0, glassHits: 0, intercepts: 0, bonks: 0, gnomeDouble: 0, lost: 0, bonked: 0, glazed: 0, kos: 0, salvaged: 0, hot: 0, hotBroke: 0, gold: 0, bestStreak: 0, tricks: 0, trick: {}, longest: 0 })),
    counters: seats.map(() => 0),
    brains: opts.brains ?? seats.map(() => null),
    wind,
    specialPlan: [],
    twist: rules.id,
    rules,
    gold,
    storeClose: rules.storeClose,
    repairMs: Math.round(REPAIR_MS * rules.repairScale),
    hailPlan: rules.hail.map((at, k) => ({ at, k, warned: false, done: false })),
    onThrow: opts.onThrow ?? null,
    onGrab: opts.onGrab ?? null,
    isHost: host,
  };

  // ------------------------------------------------------------ the specials' schedule, from the seed (the host spawns them)

  {
    const rng = createRng(hash(`specials:${seedNum}:${R.roundNo}`));
    const gap = rules.specialGap ?? field.street.specialGap ?? [25000, 35000];
    let t = rules.specialFirst ?? SPECIAL_FIRST_MS;
    let kind = rules.specialKind ?? (rng.chance(0.5) ? 'brick' : 'gnome');
    let id = 1;
    while (t <= SPECIAL_LAST_MS) {
      R.specialPlan.push({ id: id++, kind, at: Math.round(t), r: rng.next() });
      kind = rules.specialKind ?? (kind === 'brick' ? 'gnome' : 'brick');
      t += rng.range(gap[0], gap[1]);
    }
  }

  const emit = (e) => {
    if (R.events.length < 400) R.events.push(e);
  };
  R.emit = emit;

  const panesOf = (h) => (R.houses[h] ? R.houses[h].panes : null);
  R.panesOf = panesOf;
  // A gale blows from round 1 and twice as hard.
  const windRound = rules.windRound1 ? R.roundNo : Math.max(2, R.roundNo);
  const windOf = (t, out) => {
    windAt(field, seedNum, windRound, t, out);
    if (rules.windScale !== 1) {
      out.x *= rules.windScale;
      out.z *= rules.windScale;
      out.s *= rules.windScale;
    }
    return out;
  };
  R.windAt = windOf;
  R.windNow = () => windOf(R.now, wind);
  R.storeOpen = () => R.now < R.storeClose;
  R.glass = (h) => glassCount(R.houses[h].panes);
  R.alive = () => R.houses.filter((h) => h.outAt < 0 && glassCount(h.panes) > 0).length;
  R.decides = decides;
  R.controls = controls;

  // ------------------------------------------------------------ throws

  /** A throw as it goes over the network: positions in mm, velocities in mm/s, the tick it left the hand. */
  function makeThrow(seat, kind, o, v) {
    R.counters[seat]++;
    return {
      k: 'throw',
      // Unique whichever page throws it: a seat throws at most once a tick, and a new host's count starts again.
      id: `${seats[seat].id}:${R.roundNo}:${R.tick}`,
      by: seats[seat].id,
      kind,
      r: R.roundNo,
      o: [Math.round(o.x * 1000), Math.round(o.y * 1000), Math.round(o.z * 1000)],
      v: [Math.round(v.x * 1000), Math.round(v.y * 1000), Math.round(v.z * 1000)],
      tk: R.tick,
    };
  }

  const known = new Set();

  /** Puts a throw in the air on this page, from its message. Late ones are replayed from the tick they left the hand. */
  R.addThrow = function addThrow(msg, seat) {
    if (known.has(msg.id)) return false;
    known.add(msg.id);
    if (known.size > 4000) known.clear();
    if (R.stones.length >= MAX_STONES) return false;
    const s = {
      id: msg.id,
      seat,
      kind: msg.kind,
      x: msg.o[0] / 1000,
      y: msg.o[1] / 1000,
      z: msg.o[2] / 1000,
      vx: msg.v[0] / 1000,
      vy: msg.v[1] / 1000,
      vz: msg.v[2] / 1000,
      ox: msg.o[0] / 1000,
      oy: msg.o[1] / 1000,
      oz: msg.o[2] / 1000,
      px: 0,
      py: 0,
      pz: 0,
      born: msg.tk,
      end: -1,
      inside: -1,
      alive: true,
      skipped: false,
      hot: msg.hot === 1 && msg.kind === 'stone',
      apex: msg.o[1] / 1000,
      run: false,
      effects: [],
      hist: new Float32Array(HISTORY_TICKS * 3),
      pred: null,
      predAt: -1,
      predBody: -1,
    };
    s.px = s.x;
    s.py = s.y;
    s.pz = s.z;
    // On the run: only the thrower's own page knows how fast they were going.
    if (controls(seat) && !R.bodies[seat].ghost) s.run = Math.hypot(R.bodies[seat].vx, R.bodies[seat].vz) >= RUN_SPEED;
    predict(s);
    R.stats[seat].thrown++;
    if (s.hot) R.stats[seat].hot++;
    if (msg.tk >= R.tick) {
      s.pendingUntil = msg.tk;
      R.stones.push(s);
      emit({ type: 'throw', seat, kind: s.kind, x: s.x, y: s.y, z: s.z, id: s.id, hot: s.hot });
      return true;
    }
    // Late: replay it from its tick, against the stones that were in the air then.
    emit({ type: 'throw', seat, kind: s.kind, x: s.x, y: s.y, z: s.z, id: s.id, hot: s.hot, late: R.tick - msg.tk });
    for (let k = msg.tk; k < R.tick && s.alive; k++) {
      s.px = s.x;
      s.py = s.y;
      s.pz = s.z;
      const t = k * TICK_MS;
      windOf(t, wind);
      const got = stepStone(s, field, wind, panesOf, R.bodies, hit);
      record(s, k);
      if (s.y > s.apex) s.apex = s.y;
      if (got) {
        resolve(s, hit, k);
        break;
      }
      if (opts.late !== false) lateIntercept(s, k);
    }
    if (s.alive) R.stones.push(s);
    else retire(s);
    return true;
  };

  function predict(s) {
    windOf(s.born * TICK_MS, wind);
    const h = tracePath(field, s.kind, { x: s.x, y: s.y, z: s.z }, { x: s.vx, y: s.vy, z: s.vz }, wind, panesOf, R.bodies, 4, DT * 2, null, s.seat);
    s.pred = h.what;
    s.predHouse = h.house;
    s.predPane = h.pane;
    s.predBody = h.body;
    s.predAt = s.born * TICK_MS + h.t * 1000;
    s.predX = h.x;
    s.predY = h.y;
    s.predZ = h.z;
  }

  function record(s, k) {
    const i = (k % HISTORY_TICKS) * 3;
    s.hist[i] = s.x;
    s.hist[i + 1] = s.y;
    s.hist[i + 2] = s.z;
  }

  function posAt(s, k, out) {
    // Where a stone was at the end of tick k (its origin before its first tick).
    if (k < s.born) {
      out.x = s.ox;
      out.y = s.oy;
      out.z = s.oz;
      return out;
    }
    const i = (k % HISTORY_TICKS) * 3;
    out.x = s.hist[i];
    out.y = s.hist[i + 1];
    out.z = s.hist[i + 2];
    return out;
  }

  const a0 = { x: 0, y: 0, z: 0 };
  const a1 = { x: 0, y: 0, z: 0 };
  const b0 = { x: 0, y: 0, z: 0 };
  const b1 = { x: 0, y: 0, z: 0 };

  function closest(ax0, ay0, az0, ax1, ay1, az1, bx0, by0, bz0, bx1, by1, bz1) {
    const dx0 = ax0 - bx0;
    const dy0 = ay0 - by0;
    const dz0 = az0 - bz0;
    const ex = ax1 - bx1 - dx0;
    const ey = ay1 - by1 - dy0;
    const ez = az1 - bz1 - dz0;
    const ee = ex * ex + ey * ey + ez * ez;
    let t = ee > 1e-12 ? -(dx0 * ex + dy0 * ey + dz0 * ez) / ee : 0;
    t = Math.min(1, Math.max(0, t));
    const x = dx0 + ex * t;
    const y = dy0 + ey * t;
    const z = dz0 + ez * t;
    return x * x + y * y + z * z;
  }

  /** A late stone, replayed over tick k, against every stone that was in the air then. */
  function lateIntercept(s, k) {
    if (s.kind === 'pebble' || k < R.tick - HISTORY_TICKS + 1) return;
    posAt(s, k - 1, a0);
    if (k === s.born) {
      a0.x = s.ox;
      a0.y = s.oy;
      a0.z = s.oz;
    }
    a1.x = s.x;
    a1.y = s.y;
    a1.z = s.z;
    const lists = [R.stones, R.recent];
    for (const list of lists) {
      for (const o of list) {
        if (o === s || o.kind === 'pebble' || o.pendingUntil !== undefined) continue;
        if (o.born > k) continue;
        if (!o.alive && o.end < k) continue;
        if (k > R.tick - 1 && o.alive) continue;
        posAt(o, k - 1, b0);
        posAt(o, k, b1);
        const r = INTERCEPT_R;
        if (closest(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z) > r * r) continue;
        // Knocked down then: undo what the other stone did after it.
        const x = (a1.x + b1.x) / 2;
        const y = (a1.y + b1.y) / 2;
        const z = (a1.z + b1.z) / 2;
        s.alive = false;
        s.end = k;
        if (o.alive) {
          o.alive = false;
          o.end = k;
        } else rollback(o);
        intercepted(s, o, x, y, z);
        return;
      }
    }
  }

  function rollback(o) {
    for (const e of o.effects) {
      const house = R.houses[e.h];
      if (!house) continue;
      if (house.outAt >= 0 && decides(e.h)) continue;
      house.panes[e.p] = e.prev;
      house.pending.delete(e.p);
      if (decides(e.h)) house.version++;
      emit({ type: 'unbreak', house: e.h, pane: e.p });
    }
    o.effects.length = 0;
  }

  function intercepted(s, o, x, y, z) {
    const later = s.born >= o.born ? s : o;
    const earlier = later === s ? o : s;
    emit({ type: 'clack', x, y, z, by: later.seat, victim: earlier.seat, a: s.id, b: o.id, hot: earlier.hot });
    if (later.seat !== earlier.seat) {
      R.stats[later.seat].intercepts++;
      judge(later, 'hit');
      trick(later.seat, earlier.hot ? ['intercept', 'firefighter'] : ['intercept'], x, y, z, -1);
    }
  }

  // ------------------------------------------------------------ heat: glass hits in a row heat the next stone; a miss cools you

  function judge(s, outcome) {
    if (s.kind === 'pebble' || !controls(s.seat)) return;
    const b = R.bodies[s.seat];
    if (b.ghost) return;
    if (outcome === 'hit') {
      b.streak++;
      if (b.streak > R.stats[s.seat].bestStreak) R.stats[s.seat].bestStreak = b.streak;
      if (b.hot) return;
      b.heat++;
      if (b.heat >= rules.heatNeed) {
        b.heat = 0;
        b.hot = true;
        emit({ type: 'hot', seat: s.seat });
      } else emit({ type: 'heat', seat: s.seat, heat: b.heat });
    } else if (outcome === 'miss') {
      const had = b.heat > 0 || b.streak > 0;
      b.heat = 0;
      b.streak = 0;
      if (had) emit({ type: 'heat', seat: s.seat, heat: 0, cooled: true });
    }
  }

  /** Named shots: counted for whoever threw, shown to everyone. */
  function trick(seat, ids, x, y, z, house) {
    if (!ids.length || seat < 0) return;
    const st = R.stats[seat];
    for (const id of ids) {
      st.tricks++;
      st.trick[id] = (st.trick[id] ?? 0) + 1;
    }
    emit({ type: 'trick', seat, ids, x, y, z, house });
  }

  function retire(s) {
    s.alive = false;
    if (s.end < 0) s.end = R.tick;
    R.recent.push(s);
  }

  // ------------------------------------------------------------ what a stone does when it hits something

  function setPane(h, p, next, s) {
    const house = R.houses[h];
    const prev = house.panes[p];
    if (prev === next) return false;
    house.panes[p] = next;
    if (decides(h)) {
      house.version++;
      house.pending.delete(p);
    } else house.pending.set(p, R.now + PRED_MS);
    if (s) s.effects.push({ h, p, prev });
    return true;
  }

  /** The panes a hit takes: the one it hit, and for a brick, a gnome or a hot stone, its neighbours. */
  function panesHit(s, h, house) {
    const list = [h.pane];
    const col = h.pane % COLS;
    const row0 = h.pane - col;
    if (s.kind === 'brick') {
      if (col > 0) list.push(h.pane - 1);
      if (col < COLS - 1) list.push(h.pane + 1);
    } else if (s.kind === 'gnome' || s.hot) {
      const hh = field.houses[h.house];
      const along = s.vx * hh.rx + s.vz * hh.rz;
      // A hot stone goes through the pane above or below it first; a gnome tumbles along.
      const other = h.pane < COLS ? h.pane + COLS : h.pane - COLS;
      if (s.hot && house.panes[other] > 0) list.push(other);
      else {
        let next = col + (along >= 0 ? 1 : -1);
        if (next < 0 || next >= COLS) next = col + (along >= 0 ? -1 : 1);
        list.push(row0 + next);
      }
    }
    return list;
  }

  function resolve(s, h, k) {
    const t = k * TICK_MS;
    const by = s.seat;
    s.alive = false;
    s.end = k;
    const what = h.what;
    if (what === 'glass') {
      const house = R.houses[h.house];
      if (!house || house.seat === by) {
        emit({ type: 'clunk', what: 'own', x: h.x, y: h.y, z: h.z, by, kind: s.kind, house: h.house });
        judge(s, 'miss');
        return;
      }
      const state = house.panes[h.pane];
      const broken = [];
      let cracked = -1;
      const goldBefore = house.gold;
      // A pebble cracks whole glass; so does a plain stone on a double-glazed ground floor.
      const soft = s.kind === 'pebble' || (rules.doubleGlazing && s.kind === 'stone' && !s.hot && h.pane < COLS);
      if (soft) {
        if (state === GLASS) {
          setPane(h.house, h.pane, CRACKED, s);
          cracked = h.pane;
          R.stats[by].cracked++;
        } else if (setPane(h.house, h.pane, BROKEN, s)) broken.push(h.pane);
      } else {
        for (const p of panesHit(s, h, house)) if (house.panes[p] > 0 && setPane(h.house, p, BROKEN, s)) broken.push(p);
      }
      R.stats[by].glassHits++;
      let golden = false;
      for (const p of broken) {
        if (house.gold & (1 << p)) {
          house.gold &= ~(1 << p);
          golden = true;
        }
      }
      if (broken.length) {
        R.stats[by].broke += broken.length;
        R.stats[house.seat].lost += broken.length;
        if (s.kind === 'gnome' && broken.length >= 2) R.stats[by].gnomeDouble++;
        if (s.hot) R.stats[by].hotBroke += broken.length;
      }
      house.lastBy = by;
      house.hitsTaken++;
      const dist = Math.hypot(h.x - s.ox, h.z - s.oz);
      emit({ type: broken.length ? 'break' : cracked >= 0 ? 'crack' : 'clunk', what: 'glass', house: h.house, panes: broken, pane: h.pane, cracked, kind: s.kind, hot: s.hot, by, x: h.x, y: h.y, z: h.z, vx: s.vx, vy: s.vy, vz: s.vz, d: Math.round(dist), predicted: !decides(h.house), t });
      judge(s, 'hit');
      if (broken.length || cracked >= 0) {
        const tricks = [];
        if (dist > R.stats[by].longest) R.stats[by].longest = Math.round(dist * 10) / 10;
        if (dist >= LONG_SHOT_M && s.kind !== 'pebble') tricks.push('long');
        if (s.apex - s.oy >= RAINBOW_M && s.kind !== 'pebble') tricks.push('rainbow');
        if (s.run) tricks.push('run');
        if (s.kind === 'gnome' && s.skipped && broken.length) tricks.push('skipper');
        if (s.kind === 'pebble' && broken.length) tricks.push('grave');
        const mine = R.houses[by];
        if (mine && mine.hurtBy === h.house && t - mine.hurtAt < PAYBACK_MS && broken.length) {
          tricks.push('payback');
          mine.hurtBy = -1;
        }
        if (mine && mine.outAt < 0 && !R.bodies[by].ghost && glassCount(mine.panes) <= LAST_STAND && broken.length) tricks.push('stand');
        if (t >= ROUND_MS - BUZZER_MS && broken.length) tricks.push('buzzer');
        if (golden && goldBefore !== house.gold) {
          tricks.push('gold');
          R.stats[by].gold++;
          if (controls(by) && !R.bodies[by].ghost) {
            const b = R.bodies[by];
            b.ammo = AMMO_MAX;
            b.ammoMs = 0;
            if (!b.hot) {
              b.hot = true;
              b.heat = 0;
              emit({ type: 'hot', seat: by, gold: true });
            }
          }
        }
        trick(by, tricks, h.x, h.y, h.z, h.house);
      }
      if (broken.length) {
        house.hurtBy = by;
        house.hurtAt = t;
      }
      checkOut(h.house, t);
      return;
    }
    if (what === 'body') {
      const b = R.bodies[h.body];
      const mine = controls(h.body);
      if (mine && t >= b.immuneUntil) {
        b.stunUntil = t + STUN_MS;
        b.immuneUntil = b.stunUntil + IMMUNE_MS;
        b.winding = false;
        b.windMs = 0;
        b.power = 0;
        b.repairing = false;
        b.repairMs = 0;
        // A bonk cools you down.
        if (b.hot || b.heat > 0) emit({ type: 'heat', seat: h.body, heat: 0, cooled: true, lost: b.hot });
        b.hot = false;
        b.heat = 0;
        R.stats[by].bonks++;
        R.stats[h.body].bonked++;
      }
      emit({ type: 'bonk', seat: h.body, by, x: h.x, y: h.y, z: h.z, kind: s.kind, predicted: !mine });
      return;
    }
    if (what === 'ghost') {
      const b = R.bodies[h.body];
      const mine = controls(h.body);
      if (mine && t >= b.poofUntil) {
        b.poofUntil = t + POOF_MS;
        emit({ type: 'poof', seat: h.body, by, x: b.gx, y: b.gy, z: b.gz });
        b.gx = 0.35 * b.gx;
        b.gz = 0.35 * b.gz;
      } else emit({ type: 'poof', seat: h.body, by, x: h.x, y: h.y, z: h.z, predicted: true });
      return;
    }
    if (what === 'ground' && s.kind === 'gnome' && !s.skipped) {
      // A gnome skips once off the ground.
      s.alive = true;
      s.end = -1;
      s.skipped = true;
      s.vy = Math.abs(s.vy) * 0.45;
      s.vx *= 0.72;
      s.vz *= 0.72;
      s.y = h.y + KINDS.gnome.r + 0.02;
      emit({ type: 'skip', x: h.x, y: h.y, z: h.z, by });
      return;
    }
    judge(s, 'miss');
    if (what === 'inside') {
      emit({ type: 'inside', house: h.house, x: h.x, y: h.y, z: h.z, by, kind: s.kind });
      return;
    }
    if (what === 'ground' || what === 'terrace') {
      emit({ type: 'land', what, x: h.x, y: h.y, z: h.z, by, kind: s.kind, vx: s.vx, vz: s.vz, hot: s.hot });
      return;
    }
    if (what === 'sea' || what === 'gone') {
      emit({ type: 'gone', what, x: h.x, y: h.y, z: h.z, by });
      return;
    }
    emit({ type: 'clunk', what, x: h.x, y: h.y, z: h.z, by, kind: s.kind, house: h.house });
  }

  function checkOut(h, t) {
    const house = R.houses[h];
    if (house.outAt >= 0 || !decides(h)) return;
    if (glassCount(house.panes) === 0) {
      house.outAt = t;
      knockedOut(h, house.lastBy, t);
    }
  }
  R.checkOut = checkOut;

  /** A house fell: the knockout is named, and the one who did it gets a pane of their own back. */
  function knockedOut(h, by, t) {
    const house = R.houses[h];
    house.koBy = by;
    emit({ type: 'out', house: h, by, t });
    if (by < 0 || by === h) return;
    R.stats[by].kos++;
    const c = paneCentre(field.houses[h], 4, {});
    trick(by, ['ko'], c.x, c.y, c.z, h);
    salvage(by, h);
  }

  /** Knockout salvage: the knocker's own house gets its first broken pane back (or, with none broken, a hot stone). */
  function salvage(by, from) {
    const mine = R.houses[by];
    const fallen = R.houses[from];
    if (!mine || !fallen || fallen.salvaged || !decides(by) || mine.outAt >= 0) return;
    fallen.salvaged = true;
    R.stats[by].salvaged++;
    const p = nextToGlaze(mine.panes);
    if (p >= 0) {
      setPane(by, p, GLASS, null);
      emit({ type: 'salvage', house: by, pane: p, from });
    } else {
      const b = R.bodies[by];
      if (controls(by) && !b.ghost && !b.hot) {
        b.hot = true;
        b.heat = 0;
        emit({ type: 'hot', seat: by, salvage: true });
      }
      emit({ type: 'salvage', house: by, pane: -1, from });
    }
  }

  /** The pane a glazier fixes next: broken ones first (middle out, ground floor first), then cracked. Hail rounds: cracked first. */
  function nextToGlaze(panes) {
    const first = rules.hail.length ? CRACKED : BROKEN;
    for (const p of REPAIR_ORDER) if (panes[p] === first) return p;
    for (const p of REPAIR_ORDER) if (panes[p] < GLASS) return p;
    return -1;
  }
  R.nextToGlaze = nextToGlaze;

  // ------------------------------------------------------------ people

  function controlBody(i, dtMs) {
    const b = R.bodies[i];
    const t = R.now;
    const brain = R.brains[i];
    if (brain) brain.update(R, i, dtMs);
    const inp = b.input;
    const house = R.houses[i];
    if (!b.ghost && house.outAt >= 0) {
      b.ghost = true;
      b.winding = false;
      b.repairing = false;
      b.held = null;
      b.hot = false;
      b.heat = 0;
      b.streak = 0;
      b.gx = b.x * 0.45;
      b.gz = b.z * 0.45;
      b.gy = GHOST_Y;
      b.pebbles = PEBBLES_MAX;
      b.pebbleMs = 0;
      emit({ type: 'ghost', seat: i });
    }
    const dt = dtMs / 1000;
    const stunned = t < b.stunUntil;
    // Aim: people point straight where they look; bots turn at a person's pace.
    if (brain) {
      const turn = (3 + 3 * (R.seats[i].skill ?? 0.5)) * dt;
      let dy = inp.yaw - b.yaw;
      while (dy > Math.PI) dy -= 2 * Math.PI;
      while (dy < -Math.PI) dy += 2 * Math.PI;
      b.yaw += Math.max(-turn, Math.min(turn, dy));
      const dp = inp.pitch - b.pitch;
      b.pitch += Math.max(-turn, Math.min(turn, dp));
    } else {
      b.yaw = inp.yaw;
      b.pitch = inp.pitch;
    }
    // Moving.
    const fx = -Math.sin(b.yaw);
    const fz = -Math.cos(b.yaw);
    const rx = Math.cos(b.yaw);
    const rz = -Math.sin(b.yaw);
    let mx = inp.mx || 0;
    let mz = inp.mz || 0;
    const m = Math.hypot(mx, mz);
    if (m > 1) {
      mx /= m;
      mz /= m;
    }
    if (b.ghost) {
      const speed = GHOST_SPEED;
      const tx = (rx * mx + fx * mz) * speed;
      const tz = (rz * mx + fz * mz) * speed;
      b.vx += (tx - b.vx) * Math.min(1, dt * 6);
      b.vz += (tz - b.vz) * Math.min(1, dt * 6);
      b.gx += b.vx * dt;
      b.gz += b.vz * dt;
      const r = Math.hypot(b.gx, b.gz);
      if (r > field.ghostR) {
        b.gx *= field.ghostR / r;
        b.gz *= field.ghostR / r;
      }
      b.gy = GHOST_Y + 0.25 * Math.sin(t / 600 + i);
    } else {
      const accel = (field.street.ice ? ICE_ACCEL : ACCEL) * dt;
      const tx = stunned || b.away ? 0 : (rx * mx + fx * mz) * STRAFE;
      const tz = stunned || b.away ? 0 : (rz * mx + fz * mz) * STRAFE;
      const ddx = tx - b.vx;
      const ddz = tz - b.vz;
      const dl = Math.hypot(ddx, ddz);
      if (dl <= accel) {
        b.vx = tx;
        b.vz = tz;
      } else {
        b.vx += (ddx / dl) * accel;
        b.vz += (ddz / dl) * accel;
      }
      const nx = b.x + b.vx * dt;
      const nz = b.z + b.vz * dt;
      clampToLawn(field.houses[i].lawn, nx, nz, clampOut);
      if (clampOut.clamped) {
        b.vx = (clampOut.x - b.x) / Math.max(dt, 1e-6);
        b.vz = (clampOut.z - b.z) / Math.max(dt, 1e-6);
      }
      b.x = clampOut.x;
      b.z = clampOut.z;
      b.y = field.houses[i].elev;
    }
    // Ammo comes back.
    if (b.ammo < AMMO_MAX) {
      b.ammoMs += dtMs;
      while (b.ammoMs >= AMMO_REFILL_MS && b.ammo < AMMO_MAX) {
        b.ammoMs -= AMMO_REFILL_MS;
        b.ammo++;
      }
    } else b.ammoMs = 0;
    if (b.ghost && b.pebbles < PEBBLES_MAX) {
      b.pebbleMs += dtMs;
      while (b.pebbleMs >= PEBBLE_REFILL_MS && b.pebbles < PEBBLES_MAX) {
        b.pebbleMs -= PEBBLE_REFILL_MS;
        b.pebbles++;
      }
    }
    // Winding up and letting go.
    const canThrow = !R.over && !stunned && !b.away && (b.ghost ? b.pebbles > 0 && t >= b.poofUntil : b.held || b.ammo > 0);
    if (inp.throwHeld && !b.winding && canThrow && !b.repairing) {
      b.winding = true;
      b.windMs = 0;
    }
    if (b.winding) {
      if (!canThrow) {
        b.winding = false;
        b.windMs = 0;
        b.power = 0;
      } else {
        b.windMs += dtMs;
        b.power = powerAt(b.windMs);
        const release = !inp.throwHeld || (inp.releasePower !== null && inp.releasePower !== undefined && b.power >= inp.releasePower);
        if (release) throwFrom(i);
      }
    }
    // Repairing.
    const speed = Math.hypot(b.vx, b.vz);
    const want = inp.repair && !b.ghost && !b.winding && !stunned && speed < 0.4 && t < R.storeClose && house.outAt < 0 && needsGlass(house.panes) && decides(i) && !R.over;
    if (want) {
      b.repairing = true;
      b.repairMs += dtMs;
      if (b.repairMs >= R.repairMs) {
        b.repairMs = 0;
        const p = nextToGlaze(house.panes);
        if (p >= 0) {
          setPane(i, p, GLASS, null);
          R.stats[i].glazed++;
          emit({ type: 'glaze', house: i, pane: p, seat: i });
        }
      }
    } else {
      b.repairing = false;
      b.repairMs = 0;
    }
    // Grabbing a special by walking over it.
    if (!b.ghost && !b.held && !stunned) {
      for (const sp of R.specials) {
        if (sp.gone || sp.holder >= 0 || t < sp.at + SPECIAL_DROP_MS) continue;
        const dx = sp.x - b.x;
        const dz = sp.z - b.z;
        if (dx * dx + dz * dz > PICKUP_R * PICKUP_R) continue;
        if (R.isHost) {
          sp.holder = i;
          b.held = sp.kind;
          emit({ type: 'grab', seat: i, kind: sp.kind, id: sp.id, x: sp.x, z: sp.z });
        } else if (!sp.asked) {
          sp.asked = true;
          if (R.onGrab) R.onGrab(sp, i);
        }
        break;
      }
    }
  }

  function throwFrom(i) {
    const b = R.bodies[i];
    const kind = b.ghost ? 'pebble' : b.held ?? 'stone';
    let o;
    if (b.ghost) o = { x: b.gx, y: b.gy - 0.2, z: b.gz };
    else o = handOf(b.x, b.y, b.z, b.yaw, handTmp);
    velocityOf(kind, b.yaw, b.pitch, b.power, velTmp);
    if (b.ghost) b.pebbles--;
    else if (b.held) {
      const sp = R.specials.find((s) => s.holder === i && !s.gone);
      if (sp) sp.gone = true;
      b.held = null;
    } else b.ammo--;
    b.winding = false;
    b.windMs = 0;
    const power = b.power;
    b.power = 0;
    b.lastThrowAt = R.now;
    const msg = makeThrow(i, kind, o, velTmp);
    msg.power = Math.round(power * 100) / 100;
    if (kind === 'stone' && b.hot) {
      msg.hot = 1;
      b.hot = false;
    }
    if (R.onThrow) R.onThrow(msg, i);
    R.addThrow(msg, i);
  }
  R.throwFrom = throwFrom;

  // ------------------------------------------------------------ specials (the host's)

  function spawnSpecials(t) {
    for (const plan of R.specialPlan) {
      if (plan.spawned || t < plan.at) continue;
      plan.spawned = true;
      const options = field.spots.filter((s) => R.houses[s.a]?.outAt < 0 || R.houses[s.b]?.outAt < 0);
      if (!options.length) continue;
      const spot = options[Math.floor(plan.r * options.length) % options.length];
      const sp = { id: plan.id, kind: plan.kind, x: spot.x, z: spot.z, y: field.groundY(spot.x, spot.z), at: plan.at, holder: -1, gone: false, a: spot.a, b: spot.b };
      R.specials.push(sp);
      emit({ type: 'special', id: sp.id, kind: sp.kind, x: sp.x, z: sp.z, a: spot.a, b: spot.b });
    }
    for (const sp of R.specials) {
      if (!sp.gone && sp.holder < 0 && t > sp.at + SPECIAL_DROP_MS + SPECIAL_LIFE_MS) {
        sp.gone = true;
        emit({ type: 'fizzle', id: sp.id, x: sp.x, z: sp.z });
      }
    }
  }

  // ------------------------------------------------------------ hail: each shower breaks what was cracked and cracks a few more

  const HAIL_WARN_MS = 2500;
  function hail(t) {
    for (const plan of R.hailPlan) {
      if (!plan.warned && t >= plan.at - HAIL_WARN_MS) {
        plan.warned = true;
        emit({ type: 'hail', k: plan.k, at: plan.at });
      }
      if (plan.done || t < plan.at) continue;
      plan.done = true;
      for (let h = 0; h < n; h++) {
        const house = R.houses[h];
        if (!decides(h) || house.outAt >= 0) continue;
        const rng = createRng(hash(`hail:${seedNum}:${R.roundNo}:${plan.k}:${h}`));
        const broke = [];
        const cracked = [];
        // The hail never takes a house's last pane.
        let left = glassCount(house.panes);
        for (const p of rng.shuffle(Array.from({ length: PANES }, (_, q) => q))) {
          if (house.panes[p] === CRACKED && left > 1) {
            setPane(h, p, BROKEN, null);
            house.gold &= ~(1 << p);
            broke.push(p);
            left--;
          }
        }
        const glass = rng.shuffle(Array.from({ length: PANES }, (_, q) => q).filter((q) => house.panes[q] === GLASS));
        for (const p of glass.slice(0, rules.hailPanes)) {
          setPane(h, p, CRACKED, null);
          cracked.push(p);
        }
        if (broke.length) R.stats[h].lost += broke.length;
        if (broke.length || cracked.length) emit({ type: 'hailHit', house: h, panes: broke, cracked });
      }
    }
  }

  // ------------------------------------------------------------ one tick

  function stepTick() {
    const k = R.tick;
    const t = k * TICK_MS;
    R.now = t;
    if (R.isHost && !R.over) spawnSpecials(t);
    if (R.hailPlan.length && !R.over) hail(t);
    for (let i = 0; i < n; i++) if (controls(i)) controlBody(i, TICK_MS);
    windOf(t, wind);
    const live = R.stones;
    for (const s of live) {
      if (!s.alive) continue;
      if (s.pendingUntil !== undefined) {
        if (s.pendingUntil > k) continue;
        delete s.pendingUntil;
      }
      s.px = s.x;
      s.py = s.y;
      s.pz = s.z;
      const got = stepStone(s, field, wind, panesOf, R.bodies, hit);
      record(s, k);
      if (s.y > s.apex) s.apex = s.y;
      if (got) resolve(s, hit, k);
      else if (t - s.born * TICK_MS > STONE_MAX_MS) {
        s.alive = false;
        s.end = k;
        judge(s, 'miss');
      }
    }
    // Stones that meet in the air.
    for (let a = 0; a < live.length; a++) {
      const A = live[a];
      if (!A.alive || A.kind === 'pebble' || A.pendingUntil !== undefined || A.end >= 0) continue;
      for (let c = a + 1; c < live.length; c++) {
        const B = live[c];
        if (!B.alive || B.kind === 'pebble' || B.pendingUntil !== undefined) continue;
        const ra = INTERCEPT_R;
        if (closest(A.px, A.py, A.pz, A.x, A.y, A.z, B.px, B.py, B.pz, B.x, B.y, B.z) > ra * ra) continue;
        A.alive = false;
        B.alive = false;
        A.end = k;
        B.end = k;
        intercepted(A, B, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
        break;
      }
    }
    // Retire what ended; forget what is too old to matter to a late throw.
    let w = 0;
    for (let i = 0; i < live.length; i++) {
      const s = live[i];
      if (s.alive) live[w++] = s;
      else retire(s);
    }
    live.length = w;
    if (R.recent.length) {
      let r = 0;
      for (const s of R.recent) if (s.end > k - HISTORY_TICKS) R.recent[r++] = s;
      R.recent.length = r;
    }
    // Predictions nobody confirmed go back to what the deciding page said.
    for (const house of R.houses) {
      if (!house.pending.size) continue;
      for (const [p, until] of house.pending) {
        if (t > until) {
          house.pending.delete(p);
          if (house.truth) {
            const v = house.truth[p];
            if (v !== house.panes[p]) {
              house.panes[p] = v;
              emit({ type: v > 0 ? 'unbreak' : 'break', house: house.i, pane: p, panes: v > 0 ? [] : [p], late: true });
            }
          }
        }
      }
    }
    R.tick = k + 1;
    R.now = R.tick * TICK_MS;
  }
  R.stepTick = stepTick;

  /** Runs every tick up to `ms` into the round. */
  R.advanceTo = function advanceTo(ms) {
    const target = Math.floor(Math.min(ms, ROUND_MS + 20000) / TICK_MS);
    let steps = 0;
    while (R.tick < target && steps < 240) {
      stepTick();
      steps++;
    }
    if (R.tick < target) R.tick = target;
  };

  // ------------------------------------------------------------ what other pages say

  /** The deciding page's word on a house: glass and crack masks, with a version, and who knocked it out (a seat, or -1). */
  R.setMask = function setMask(h, g, c, version, outAt, koBy = -1) {
    const house = R.houses[h];
    if (!house || decides(h)) return;
    if (version < house.version) return;
    const wasOut = house.outAt >= 0;
    house.version = version;
    house.truth = panesFromMask(g >>> 0, c >>> 0, house.truth ?? new Uint8Array(PANES));
    for (let p = 0; p < PANES; p++) {
      const v = house.truth[p];
      if (v === house.panes[p]) {
        house.pending.delete(p);
        continue;
      }
      // A break this page predicted a moment ago stands until the word catches up (or doesn't).
      if (house.pending.has(p) && v > house.panes[p]) continue;
      const before = house.panes[p];
      house.panes[p] = v;
      house.pending.delete(p);
      if (v === BROKEN) house.gold &= ~(1 << p);
      if (v > before) emit({ type: v === GLASS && before === BROKEN ? 'glazed' : 'unbreak', house: h, pane: p });
      else emit({ type: 'break', house: h, panes: v === BROKEN ? [p] : [], pane: p, cracked: v === CRACKED ? p : -1, remote: true });
    }
    if (outAt !== undefined && outAt >= 0 && house.outAt < 0) house.outAt = outAt;
    if (house.outAt < 0 && g === 0) house.outAt = R.now;
    if (!wasOut && house.outAt >= 0) knockedOut(h, Number.isInteger(koBy) && koBy >= 0 && koBy < n ? koBy : house.lastBy, house.outAt);
    else if (house.outAt >= 0 && koBy >= 0 && koBy < n && house.koBy < 0) {
      house.koBy = koBy;
      salvage(koBy, h);
    }
  };

  /** Sets a house from a mask whoever decides it (a reloaded page taking its own house back). */
  R.setMaskForce = function setMaskForce(h, g, c, version, outAt) {
    const house = R.houses[h];
    if (!house) return;
    panesFromMask(g >>> 0, c >>> 0, house.panes);
    house.pending.clear();
    house.version = version;
    if (outAt !== undefined && outAt >= 0) house.outAt = outAt;
    else if (g === 0 && house.outAt < 0) house.outAt = R.now;
  };

  /** Adopts a house this page now decides (its owner went away): from what the others last said. */
  R.adopt = function adopt(h) {
    const house = R.houses[h];
    if (!house) return;
    if (house.truth) house.panes.set(house.truth);
    house.pending.clear();
    house.version++;
  };

  R.maskOf = (h) => {
    const house = R.houses[h];
    const m = maskOf(house.panes);
    return { g: m.g, c: m.c, v: house.version, ko: house.koBy };
  };

  /** Whether a stone in the air is coming at this seat's house or body (for the warning, and the bots). */
  R.incoming = function incoming(seat) {
    const out = [];
    for (const s of R.stones) {
      if (!s.alive || s.seat === seat || s.pendingUntil !== undefined) continue;
      if ((s.pred === 'glass' && s.predHouse === seat) || (s.pred === 'body' && s.predBody === seat) || (s.pred === 'frame' && s.predHouse === seat)) out.push(s);
    }
    return out;
  };

  R.paneWorld = (h, p, out) => paneCentre(field.houses[h], p, out);

  /** Where your eye is (for the camera and the arc). */
  R.eyeOf = (i, out) => {
    const b = R.bodies[i];
    if (b.ghost) {
      out.x = b.gx;
      out.y = b.gy;
      out.z = b.gz;
    } else {
      out.x = b.x;
      out.y = b.y + EYE;
      out.z = b.z;
    }
    return out;
  };

  R.inLawn = (i, x, z) => inLawn(field.houses[i].lawn, x, z, 0.6);
  R.DT = DT;
  R.lateMaxMs = LATE_MAX_MS;
  return R;
}

/** Places from a round: standing houses by glass left, then the fallen in reverse order. Ties share a place. */
export function rankHouses(houses, ids) {
  const rows = houses.map((h, i) => ({ id: ids[i], glass: h.outAt >= 0 ? 0 : glassCount(h.panes), outAt: h.outAt }));
  rows.sort((a, b) => {
    const aa = a.outAt < 0 && a.glass > 0;
    const bb = b.outAt < 0 && b.glass > 0;
    if (aa !== bb) return aa ? -1 : 1;
    if (aa) return b.glass - a.glass;
    return b.outAt - a.outAt;
  });
  const ranking = [];
  let prev = null;
  for (const r of rows) {
    const key = r.outAt < 0 && r.glass > 0 ? `g${r.glass}` : `o${Math.round(r.outAt / 50)}`;
    if (prev === key) ranking[ranking.length - 1].push(r.id);
    else ranking.push([r.id]);
    prev = key;
  }
  return ranking;
}
