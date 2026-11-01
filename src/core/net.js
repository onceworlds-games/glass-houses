// What goes over the network, and the checks every page runs on what it reads. Nothing here trusts another page: a throw, a
// presence update or a house mask that doesn't fit is dropped, and a thrower who throws faster than a person can is slowed.

import { KINDS, KIND_IDS, TICK_MS, LATE_MAX_MS, PANES, GHOST_Y, EYE, ROUND_MS } from './config.js';
import { inLawn } from './streets.js';
import { isTwist } from './twists.js';

const MASK = (1 << PANES) - 1;
const MAX_MM = 200000; // 200 m: nothing in the world is further from the centre
const FUTURE_TICKS = Math.ceil(400 / TICK_MS);
const LATE_TICKS = Math.ceil(LATE_MAX_MS / TICK_MS);

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isNum = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64;

/** A token bucket per thrower: 7 throws at once, then one every 0.7 s (a person's pile is 5, back at one per 0.8 s). */
export function createLimiter(capacity = 7, refillMs = 700) {
  const buckets = new Map();
  return {
    take(id, now) {
      let b = buckets.get(id);
      if (!b) buckets.set(id, (b = { tokens: capacity, at: now }));
      const gained = Math.max(0, now - b.at) / refillMs;
      b.tokens = Math.min(capacity, b.tokens + gained);
      b.at = now;
      if (b.tokens < 1) return false;
      b.tokens -= 1;
      return true;
    },
    clear() {
      buckets.clear();
    },
  };
}

/**
 * Checks a throw message. ctx: { round (number), tick (this page's round tick), field, seatOf(id) → index or -1,
 * fromHost (the sender is the room's host), from (the sender's player id), ghost(seat), holds(seat, kind), limiter, now (ms) }.
 * Returns the seat index, or a reason string.
 */
export function checkThrow(msg, ctx) {
  if (!msg || typeof msg !== 'object' || msg.k !== 'throw') return 'shape';
  if (!isId(msg.id) || !isId(msg.by) || !KIND_IDS.includes(msg.kind)) return 'shape';
  if (!isInt(msg.r, 1, 99) || msg.r !== ctx.round) return 'round';
  if (!Array.isArray(msg.o) || msg.o.length !== 3 || !Array.isArray(msg.v) || msg.v.length !== 3) return 'shape';
  for (let i = 0; i < 3; i++) if (!isInt(msg.o[i], -MAX_MM, MAX_MM) || !isInt(msg.v[i], -60000, 60000)) return 'shape';
  if (!isInt(msg.tk, 0, Math.ceil((ROUND_MS + 30000) / TICK_MS))) return 'shape';
  if (msg.hot !== undefined && msg.hot !== 1) return 'shape';
  if (msg.hot === 1 && msg.kind !== 'stone') return 'kind';
  const seat = ctx.seatOf(msg.by);
  if (seat < 0) return 'seat';
  // Bots' throws come from the host; a player throws only for themselves.
  if (msg.by.startsWith('bot:') ? !ctx.fromHost : msg.by !== ctx.from) return 'sender';
  if (msg.tk > ctx.tick + FUTURE_TICKS || msg.tk < ctx.tick - LATE_TICKS) return 'time';
  const ghost = ctx.ghost(seat);
  if (msg.kind === 'pebble' ? !ghost : ghost) return 'kind';
  if ((msg.kind === 'brick' || msg.kind === 'gnome') && !ctx.holds(seat, msg.kind)) return 'kind';
  const k = KINDS[msg.kind];
  const speed = Math.hypot(msg.v[0], msg.v[1], msg.v[2]) / 1000;
  if (speed > k.vmax * 1.05 || speed < k.vmin * 0.9) return 'speed';
  const x = msg.o[0] / 1000;
  const y = msg.o[1] / 1000;
  const z = msg.o[2] / 1000;
  if (ghost) {
    if (Math.hypot(x, z) > ctx.field.ghostR + 1.5 || Math.abs(y - GHOST_Y) > 1.2) return 'origin';
  } else {
    const h = ctx.field.houses[seat];
    if (!h || !inLawn(h.lawn, x, z, 1.5)) return 'origin';
    const hand = y - h.elev;
    if (hand < EYE - 0.8 || hand > EYE + 0.6) return 'origin';
  }
  if (ctx.limiter && !ctx.limiter.take(msg.by, ctx.now)) return 'rate';
  return seat;
}

/** A remote player's presence, cleaned: numbers in range or their defaults; null when it isn't a presence at all. */
export function readPresence(p) {
  if (!p || typeof p !== 'object') return null;
  const num = (v, lo, hi, d) => (isNum(v, lo, hi) ? v : d);
  const g = isInt(p.g, 0, MASK) ? p.g : null;
  const c = isInt(p.c, 0, MASK) ? p.c : 0;
  return {
    x: num(p.x, -200, 200, 0),
    z: num(p.z, -200, 200, 0),
    yaw: num(p.yaw, -100, 100, 0),
    pitch: num(p.pitch, -2, 2, 0),
    pw: num(p.pw, 0, 1, 0),
    st: num(p.st, -1, 1e9, -1),
    rp: num(p.rp, 0, 1, 0),
    h: p.h === 'brick' || p.h === 'gnome' ? p.h : null,
    g,
    c: g === null ? 0 : c & g,
    gv: isInt(p.gv, 0, 1e9) ? p.gv : 0,
    gh: p.gh === 1 ? 1 : 0,
    gx: num(p.gx, -200, 200, 0),
    gz: num(p.gz, -200, 200, 0),
    r: isId(p.r) ? p.r : '',
    out: isNum(p.out, 0, 1e9) ? p.out : -1,
    ko: isId(p.ko) ? p.ko : '',
    lk: readLook(p.lk),
  };
}

/** The host's word on the houses it decides: { [seatId]: { g, c, v, out } }. Bad entries are left out. */
export function readHouses(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  let n = 0;
  for (const [id, m] of Object.entries(value)) {
    if (++n > 32) break;
    if (!isId(id) || !m || typeof m !== 'object') continue;
    if (!isInt(m.g, 0, MASK) || !isInt(m.v, 0, 1e9)) continue;
    out[id] = { g: m.g, c: isInt(m.c, 0, MASK) ? m.c & m.g : 0, v: m.v, out: isNum(m.out, 0, 1e9) ? m.out : -1, ko: isId(m.ko) ? m.ko : '' };
  }
  return out;
}

/** The host's bots and away players' bodies, as presence: { [seatId]: presence }. */
export function readBodies(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  let n = 0;
  for (const [id, p] of Object.entries(value)) {
    if (++n > 32) break;
    if (!isId(id)) continue;
    const r = readPresence(p);
    if (r) out[id] = r;
  }
  return out;
}

/** The special on the street: { id, kind, x, z, at, holder (seat id or ''), gone }. */
export function readSpecials(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const s of value.slice(0, 12)) {
    if (!s || typeof s !== 'object') continue;
    if (!isInt(s.id, 1, 999) || (s.kind !== 'brick' && s.kind !== 'gnome')) continue;
    if (!isNum(s.x, -200, 200) || !isNum(s.z, -200, 200) || !isNum(s.at, 0, 1e9)) continue;
    out.push({ id: s.id, kind: s.kind, x: s.x, z: s.z, at: s.at, holder: isId(s.holder) ? s.holder : '', gone: s.gone === true });
  }
  return out;
}

/** A round's shared data from the match record: { street, seed, round, ids (seat ids in house order) }. */
export function readRoundData(d) {
  if (!d || typeof d !== 'object') return null;
  if (!isInt(d.street, 0, 7) || !isInt(d.seed, 0, 0xffffffff) || !isInt(d.round, 1, 99)) return null;
  if (!Array.isArray(d.ids) || d.ids.length < 1 || d.ids.length > 6 || !d.ids.every(isId)) return null;
  const out = {};
  if (d.out && typeof d.out === 'object') for (const [k, v] of Object.entries(d.out)) if (isId(k) && isNum(v, 0, 1e9)) out[k] = v;
  return { street: d.street, seed: d.seed, round: d.round, ids: d.ids.slice(), out, end: isNum(d.end, 0, 1e9) ? d.end : -1, twist: isTwist(d.twist) ? d.twist : 'quiet', daily: isInt(d.daily, 1, 1e6) ? d.daily : 0 };
}

/** What a player shows the street (their stone, trail, glass and lawn): four small numbers, or null. */
export function readLook(v) {
  if (!Array.isArray(v) || v.length !== 4) return null;
  return v.every((x) => isInt(x, 0, 63)) ? v.slice() : null;
}

/** Who decides a house: its owner's page while they're connected; the host for bots and for players who are away or gone. */
export function decider(seat, hostId) {
  if (!seat) return hostId;
  if (seat.bot || seat.away || seat.left) return hostId;
  return seat.id;
}

/** Of two words about one house, the one to keep: the higher version (a handover keeps counting from the last). */
export function newerMask(a, b) {
  if (!a) return b;
  if (!b) return a;
  return b.v > a.v ? b : a;
}
