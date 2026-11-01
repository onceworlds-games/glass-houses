// One page's side of a round in a match: which houses and bodies this page decides, what it tells the others (presence, and the
// host's state) and what it believes of theirs. No SDK, no DOM: the page's online module feeds it the room, the tests feed it a
// pretend room.
//
//   Your own glass and body: your page. Bots, and players who are away or gone: the host. Every stone: every page, from the throws.

import { buildField } from './streets.js';
import { createRound, rankHouses, glassCount } from './round.js';
import { createBrain, personaByName } from './bots.js';
import { checkThrow, createLimiter, readPresence, readHouses, readBodies, readSpecials, decider } from './net.js';
import { PICKUP_R, SPECIAL_DROP_MS } from './config.js';

const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
};

/**
 * opts: { myId, send(msg), grab(specialId) (ask the host for a special), autoplay (this page's seat plays itself), gentle (the
 * player is new: bots go easy on their house), look() (what this player shows the street: see readLook) }
 */
export function createSync(opts) {
  const S = {
    R: null,
    field: null,
    data: null,
    key: '',
    ids: [],
    seats: [],
    mySeat: -1,
    hostId: '',
    isHost: false,
    brains: [],
    thrown: new Set(),
    limiter: createLimiter(),
    targets: new Map(),
    rejected: 0,
    looks: new Map(),
    hotLog: new Map(),
  };

  const seatOf = (id) => S.ids.indexOf(id);
  const deciderOf = (i) => decider(S.seats[i], S.hostId);
  const decides = (i) => deciderOf(i) === opts.myId;

  function makeBrain(i) {
    const seat = S.seats[i];
    const persona = personaByName(seat.name) ?? 'player';
    return createBrain(persona, seat.skill ?? 0.5, `${S.data.seed}:${S.data.round}:${i}`);
  }

  /** The brains this page runs: the host's bots, and this page's own seat in autoplay. */
  function placeBrains() {
    const R = S.R;
    for (let i = 0; i < S.seats.length; i++) {
      const seat = S.seats[i];
      const want = (seat.bot && S.isHost) || (i === S.mySeat && opts.autoplay);
      if (want && !R.brains[i]) R.brains[i] = makeBrain(i);
      if (!want) R.brains[i] = null;
    }
  }

  /** A round begins (or this page arrives in the middle of one). data: from readRoundData; seats: the match's seats. */
  S.begin = function begin(data, seats, hostId, elapsedMs = 0) {
    S.data = data;
    S.key = `${data.round}:${data.seed}`;
    S.ids = data.ids.slice();
    S.field = buildField(data.street);
    S.hostId = hostId;
    S.isHost = hostId === opts.myId;
    S.thrown.clear();
    S.limiter.clear();
    S.targets.clear();
    S.hotLog.clear();
    S.seats = S.ids.map((id) => {
      const s = seats.find((x) => x.id === id);
      return { id, name: s?.name ?? 'Neighbour', bot: s ? !!s.bot : id.startsWith('bot:'), away: !!s?.away, left: s ? !!s.left : true, skill: s?.skill ?? 0.5, gentle: false };
    });
    S.mySeat = seatOf(opts.myId);
    if (S.mySeat >= 0 && opts.gentle) S.seats[S.mySeat].gentle = true;
    S.R = createRound({
      field: S.field,
      seed: data.seed,
      round: data.round,
      twist: data.twist,
      seats: S.seats,
      host: S.isHost,
      decides,
      controls: decides,
      brains: S.seats.map(() => null),
      onThrow: (msg) => opts.send(msg),
      onGrab: (sp) => opts.grab?.(sp.id),
      late: true,
    });
    placeBrains();
    syncAway();
    if (elapsedMs > 0) S.R.advanceTo(elapsedMs);
    return S.R;
  };

  function syncAway() {
    const R = S.R;
    for (let i = 0; i < S.seats.length; i++) {
      const s = S.seats[i];
      R.bodies[i].away = !s.bot && (s.away || s.left);
    }
  }

  /** Who is here and who hosts changed. Houses that are now this page's are taken over from the last word about them. */
  S.roster = function roster(seats, hostId) {
    if (!S.R) return;
    const before = S.seats.map((_, i) => decides(i));
    for (const s of S.seats) {
      const now = seats.find((x) => x.id === s.id);
      s.away = !!now?.away;
      s.left = now ? !!now.left : true;
    }
    S.hostId = hostId;
    S.isHost = hostId === opts.myId;
    S.R.isHost = S.isHost;
    for (let i = 0; i < S.seats.length; i++) if (!before[i] && decides(i)) S.R.adopt(i);
    if (S.isHost) {
      // Specials the last host already put down aren't put down again.
      const top = S.R.specials.reduce((m, s) => Math.max(m, s.id), 0);
      for (const plan of S.R.specialPlan) if (plan.id <= top) plan.spawned = true;
    }
    placeBrains();
    syncAway();
  };

  // ------------------------------------------------------------ what comes in

  /** A message from another page. */
  S.message = function message(msg, fromId) {
    const R = S.R;
    if (!R || !msg || msg.k !== 'throw') return false;
    const seat = checkThrow(msg, {
      round: R.roundNo,
      tick: R.tick,
      field: S.field,
      seatOf,
      fromHost: fromId === S.hostId,
      from: fromId,
      ghost: (i) => R.bodies[i].ghost || R.houses[i].outAt >= 0,
      holds: (i, kind) => R.specials.some((s) => s.holder === i && s.kind === kind && !s.used),
      limiter: S.limiter,
      now: R.now,
    });
    if (typeof seat !== 'number') {
      S.rejected++;
      return false;
    }
    // Hot stones come from a run of hits: at most two in any four throws from one thrower.
    if (msg.kind === 'stone') {
      const log = S.hotLog.get(msg.by) ?? [];
      if (msg.hot === 1 && log.filter(Boolean).length >= 2) delete msg.hot;
      log.push(msg.hot === 1);
      if (log.length > 3) log.shift();
      S.hotLog.set(msg.by, log);
    }
    if (msg.kind === 'brick' || msg.kind === 'gnome') {
      const sp = R.specials.find((s) => s.holder === seat && s.kind === msg.kind && !s.used);
      if (sp) {
        sp.used = true;
        sp.gone = true;
      }
    }
    return R.addThrow(msg, seat);
  };

  /** A player's presence: `raw` as they sent it (their glass), `pose` smoothed for drawing (room.presenceAt). */
  S.remote = function remote(id, raw, pose) {
    const R = S.R;
    const i = seatOf(id);
    if (!R || i < 0 || i === S.mySeat) return;
    const p = readPresence(raw);
    if (!p || p.r !== S.key) return;
    if (p.lk) S.looks.set(i, p.lk);
    if (!decides(i) && p.g !== null) R.setMask(i, p.g, p.c, p.gv, p.out >= 0 ? p.out : undefined, p.ko ? seatOf(p.ko) : -1);
    if (decides(i)) return;
    const q = readPresence(pose) ?? p;
    applyPose(i, q, 1);
  };

  function applyPose(i, p, t) {
    const b = S.R.bodies[i];
    b.x = lerp(b.x, p.x, t);
    b.z = lerp(b.z, p.z, t);
    b.y = S.field.houses[i].elev;
    b.yaw = lerpAngle(b.yaw, p.yaw, t);
    b.pitch = lerp(b.pitch, p.pitch, t);
    b.power = p.pw;
    b.winding = p.pw > 0;
    b.stunUntil = p.st;
    b.repairing = p.rp > 0;
    b.repairMs = p.rp * S.R.repairMs;
    b.held = p.h;
    b.ghost = p.gh === 1;
    b.gx = lerp(b.gx, p.gx, t);
    b.gz = lerp(b.gz, p.gz, t);
  }

  /** The host's word on the houses it decides. */
  S.hostHouses = function hostHouses(value) {
    const R = S.R;
    if (!R || S.isHost) return;
    const h = readHouses(value?.[S.key]);
    for (const [id, m] of Object.entries(h)) {
      const i = seatOf(id);
      if (i < 0 || decides(i)) continue;
      R.setMask(i, m.g, m.c, m.v, m.out >= 0 ? m.out : undefined, m.ko ? seatOf(m.ko) : -1);
    }
  };

  /** The host's bots and away players, where they stand (10 times a second; this page glides them there). */
  S.hostBodies = function hostBodies(value) {
    if (!S.R || S.isHost) return;
    const b = readBodies(value?.[S.key]);
    for (const [id, p] of Object.entries(b)) {
      const i = seatOf(id);
      if (i < 0 || decides(i)) continue;
      S.targets.set(i, p);
    }
  };

  /** The specials on the street, as the host has them. */
  S.hostSpecials = function hostSpecials(value) {
    const R = S.R;
    if (!R || S.isHost) return;
    const list = readSpecials(value?.[S.key]);
    for (const s of list) {
      let sp = R.specials.find((x) => x.id === s.id);
      const holder = s.holder ? seatOf(s.holder) : -1;
      if (!sp) {
        sp = { id: s.id, kind: s.kind, x: s.x, z: s.z, y: S.field.groundY(s.x, s.z), at: s.at, holder: -1, gone: false, a: -1, b: -1 };
        R.specials.push(sp);
        R.emit({ type: 'special', id: sp.id, kind: sp.kind, x: sp.x, z: sp.z });
      }
      if (holder !== sp.holder && holder >= 0) {
        sp.holder = holder;
        R.emit({ type: 'grab', seat: holder, kind: sp.kind, id: sp.id, x: sp.x, z: sp.z });
        if (holder === S.mySeat && !S.thrown.has(sp.id)) R.bodies[holder].held = sp.kind;
      }
      if (s.gone && !sp.gone) {
        sp.gone = true;
        if (sp.holder < 0) R.emit({ type: 'fizzle', id: sp.id, x: sp.x, z: sp.z });
      }
      if (s.gone) sp.asked = true;
    }
  };

  /**
   * A page that reloaded in the middle of a round takes its house back: from its own last presence or from the host's word (the host
   * kept it while it was away), whichever is newer. mask: { g, c, v, out } or null.
   */
  S.restore = function restore(mask) {
    const R = S.R;
    if (!R || S.mySeat < 0 || !mask) return;
    const house = R.houses[S.mySeat];
    if (mask.v < house.version) return;
    house.truth = null;
    R.setMaskForce(S.mySeat, mask.g, mask.c, mask.v, mask.out);
  };

  /** Host: a page asked for a special; the room's clock says it got there first. */
  S.grant = function grant(fromId, specialId) {
    const R = S.R;
    if (!R || !S.isHost) return false;
    const i = seatOf(fromId);
    const sp = R.specials.find((s) => s.id === specialId);
    if (i < 0 || !sp || sp.gone || sp.holder >= 0 || R.now < sp.at + SPECIAL_DROP_MS) return false;
    const b = R.bodies[i];
    if (b.ghost || b.held) return false;
    if (Math.hypot(b.x - sp.x, b.z - sp.z) > PICKUP_R + 1.5) return false;
    sp.holder = i;
    R.emit({ type: 'grab', seat: i, kind: sp.kind, id: sp.id, x: sp.x, z: sp.z });
    return true;
  };

  /** Host: may this page have that special? (The claim's check, before the room's clock picks a winner.) */
  S.canGrab = function canGrab(fromId, specialId) {
    const R = S.R;
    if (!R) return 'no round';
    const sp = R.specials.find((s) => s.id === specialId);
    if (seatOf(fromId) < 0) return 'seat';
    if (!sp || sp.gone || sp.holder >= 0) return 'gone';
    return true;
  };

  // ------------------------------------------------------------ time

  /** Runs the round to `elapsedMs` on the match clock; `dtMs` glides the host's bodies. */
  S.step = function step(elapsedMs, dtMs = 16) {
    const R = S.R;
    if (!R) return;
    const t = Math.min(1, (dtMs / 1000) * 12);
    for (const [i, p] of S.targets) if (!decides(i)) applyPose(i, p, t);
    // A special this page threw is gone from its hand for good.
    const me = S.mySeat >= 0 ? R.bodies[S.mySeat] : null;
    if (me) for (const sp of R.specials) if (sp.holder === S.mySeat && sp.gone) S.thrown.add(sp.id);
    R.advanceTo(elapsedMs);
  };

  // ------------------------------------------------------------ what goes out

  function poseOf(i) {
    const b = S.R.bodies[i];
    const r3 = (v) => Math.round(v * 1000) / 1000;
    return {
      x: r3(b.x),
      z: r3(b.z),
      yaw: r3(b.yaw),
      pitch: r3(b.pitch),
      pw: b.winding ? r3(b.power) : 0,
      st: b.stunUntil > S.R.now ? Math.round(b.stunUntil) : -1,
      rp: b.repairing ? r3(Math.min(1, b.repairMs / S.R.repairMs)) : 0,
      h: b.held ?? null,
      gh: b.ghost ? 1 : 0,
      gx: r3(b.gx),
      gz: r3(b.gz),
    };
  }

  function maskOut(i) {
    const m = S.R.maskOf(i);
    const out = S.R.houses[i].outAt;
    return { g: m.g, c: m.c, v: m.v, out: out >= 0 ? Math.round(out) : -1, ko: m.ko >= 0 ? S.ids[m.ko] ?? '' : '' };
  }

  /** This page's presence: its body and its glass, for this round. */
  S.presence = function presence() {
    if (!S.R || S.mySeat < 0) return { r: S.key };
    const m = maskOut(S.mySeat);
    const lk = opts.look?.() ?? null;
    return { ...poseOf(S.mySeat), g: m.g, c: m.c, gv: m.v, out: m.out, ko: m.ko, lk, r: S.key };
  };

  /** Host: the houses it decides (bots, away players), by seat id, under this round's key. */
  S.houses = function houses() {
    const out = {};
    if (!S.R || !S.isHost) return null;
    for (let i = 0; i < S.seats.length; i++) if (decides(i) && i !== S.mySeat) out[S.ids[i]] = maskOut(i);
    return { [S.key]: out };
  };

  /** Host: bots' and away players' bodies. */
  S.bodies = function bodies() {
    const out = {};
    if (!S.R || !S.isHost) return null;
    for (let i = 0; i < S.seats.length; i++) if (decides(i) && i !== S.mySeat) out[S.ids[i]] = poseOf(i);
    return { [S.key]: out };
  };

  /** Host: the specials (the last few). */
  S.specials = function specials() {
    if (!S.R || !S.isHost) return null;
    const list = S.R.specials.slice(-8).map((s) => ({ id: s.id, kind: s.kind, x: Math.round(s.x * 100) / 100, z: Math.round(s.z * 100) / 100, at: s.at, holder: s.holder >= 0 ? S.ids[s.holder] : '', gone: !!s.gone }));
    return { [S.key]: list };
  };

  /** Places right now (the host ends the round with them). */
  S.ranking = function ranking() {
    return S.R ? rankHouses(S.R.houses, S.ids) : [];
  };

  S.glassOf = (i) => (S.R ? glassCount(S.R.houses[i].panes) : 0);
  S.decides = decides;
  S.seatOf = seatOf;
  return S;
}
