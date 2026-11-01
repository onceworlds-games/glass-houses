import test from 'node:test';
import assert from 'node:assert/strict';
import { buildField } from '../src/core/streets.js';
import { createRound, glassCount, REPAIR_ORDER, LONG_SHOT_M } from '../src/core/round.js';
import { paneCentre, solveAim, velocityOf, handOf, windAt } from '../src/core/physics.js';
import { PANES, COLS, GLASS, CRACKED, BROKEN, REPAIR_MS, STORE_CLOSE_MS, AMMO_MAX } from '../src/core/config.js';
import { TWIST_IDS, twistRules, pickTwist, matchTwist, goldPanes, dailyOf, dayOf, DAY_MS } from '../src/core/twists.js';
import { hash } from '../src/core/rng.js';
import { checkThrow, readPresence, readHouses, readRoundData, readLook } from '../src/core/net.js';
import { createSync } from '../src/core/sync.js';
import { simulate } from '../src/core/sim.js';

const seats = (n = 6) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot: false, skill: 0.5 }));
const round = (opts = {}) => createRound({ field: buildField(opts.street ?? 2), seed: opts.seed ?? 7, round: opts.round ?? 1, seats: seats(), ...opts });

function runFor(R, ms) {
  const end = R.now + ms;
  while (R.now < end) R.stepTick();
}

let shots = 0;
/** A stone (or `kind`) from seat `from`, half a metre in front of pane `p` of house `h` and flying into it. */
function shoot(R, from, h, p, kind = 'stone', extra = {}) {
  const f = R.field.houses[h];
  const c = paneCentre(f, p, {});
  const msg = { k: 'throw', id: `t${shots++}`, by: `p${from}`, kind, r: R.roundNo, o: [Math.round((c.x + f.fx * 0.5) * 1000), Math.round(c.y * 1000), Math.round((c.z + f.fz * 0.5) * 1000)], v: [Math.round(-f.fx * 15000), 0, Math.round(-f.fz * 15000)], tk: R.tick, ...extra };
  R.addThrow(msg, from);
  runFor(R, 200);
  return msg;
}

/** A stone from seat `from` straight down into the lawn: a miss. */
function miss(R, from) {
  const b = R.bodies[from];
  R.addThrow({ k: 'throw', id: `m${shots++}`, by: `p${from}`, kind: 'stone', r: R.roundNo, o: [Math.round(b.x * 1000), 1500, Math.round(b.z * 1000)], v: [0, -15000, 0], tk: R.tick }, from);
  runFor(R, 300);
}

const events = (R, type) => R.events.filter((e) => e.type === type);

// ---------------------------------------------------------------- twists

test('the Gazette: round 1 is calm, later rounds draw from every twist, never the same twice running', () => {
  const first = new Set();
  const later = new Set();
  for (let s = 1; s < 400; s++) {
    first.add(pickTwist(s, 1));
    const a = pickTwist(s, 2);
    later.add(a);
    assert.notEqual(pickTwist(s, 3, a), a === 'quiet' ? '__' : a);
    assert.equal(pickTwist(s, 2), a, 'the same seed draws the same twist');
  }
  for (const id of first) assert.ok(['quiet', 'golden', 'sale', 'bricks', 'gnomes'].includes(id), id);
  for (const id of TWIST_IDS) assert.ok(later.has(id), `${id} comes up`);
  assert.equal(twistRules('nonsense').id, 'quiet');
  assert.equal(twistRules('gale').windScale > 1, true);
});

test("a match's twists: every page works out any round's twist from the shared random, calm first, never twice running", () => {
  for (let m = 0; m < 30; m++) {
    const seedOf = (r) => (hash(`m${m}:twist:${r}`) % 2147483646) + 1;
    const list = [1, 2, 3, 4, 5].map((r) => matchTwist(seedOf, r));
    assert.ok(['quiet', 'golden', 'sale', 'bricks', 'gnomes'].includes(list[0]), list.join());
    for (let r = 1; r < 5; r++) assert.ok(list[r] !== list[r - 1] || list[r] === 'quiet', list.join());
    // The same answer asked again, or asked round by round.
    assert.deepEqual(list, [1, 2, 3, 4, 5].map((r) => matchTwist(seedOf, r)));
  }
});

test('golden panes: the same few on every house, spread along the front and over both floors', () => {
  const g = goldPanes(99, 2, 3);
  assert.equal(g.length, 3);
  assert.deepEqual(goldPanes(99, 2, 3), g);
  assert.ok(new Set(g.map((p) => Math.floor(p / COLS))).size === 2, 'both floors');
  const R = round({ twist: 'golden', seed: 99, round: 2 });
  for (const h of R.houses) assert.equal(h.gold, g.reduce((m, p) => m | (1 << p), 0));
});

test('the Daily Street is the same street, seed and twist for everyone that day, and changes the next', () => {
  const day = dayOf(Date.UTC(2026, 10, 1, 15));
  assert.equal(dayOf(Date.UTC(2026, 10, 1, 1)), day);
  assert.deepEqual(dailyOf(day), dailyOf(day));
  const d = dailyOf(day);
  assert.ok(d.street >= 0 && d.street < 8 && d.seed > 0 && d.twist !== 'quiet');
  const week = Array.from({ length: 14 }, (_, k) => dailyOf(day + k));
  assert.ok(new Set(week.map((x) => `${x.street}:${x.twist}`)).size >= 8, 'it varies');
  assert.equal(DAY_MS, 86400000);
});

// ---------------------------------------------------------------- heat

test('three glass hits in a row heat the next stone; it breaks two panes, one above the other', () => {
  const R = round();
  for (const b of R.bodies) b.skip = true;
  shoot(R, 0, 3, 1);
  shoot(R, 0, 3, 2);
  assert.equal(R.bodies[0].hot, false);
  shoot(R, 0, 3, 3);
  assert.equal(R.bodies[0].hot, true, 'hot after three');
  assert.ok(events(R, 'hot').length === 1);
  // The page's own throw carries the heat.
  const sent = [];
  R.onThrow = (msg) => sent.push(msg);
  R.bodies[0].input.throwHeld = true;
  runFor(R, 300);
  R.bodies[0].input.throwHeld = false;
  runFor(R, 50);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].hot, 1);
  assert.equal(R.bodies[0].hot, false, 'used up');
  // A hot stone into pane 5 takes pane 15 with it.
  const before = glassCount(R.houses[4].panes);
  shoot(R, 1, 4, 5, 'stone', { hot: 1 });
  assert.equal(R.houses[4].panes[5], BROKEN);
  assert.equal(R.houses[4].panes[15], BROKEN);
  assert.equal(glassCount(R.houses[4].panes), before - 2);
  assert.equal(R.stats[1].hotBroke, 2);
});

test('a miss cools you, and a bonk takes a hot stone away', () => {
  const R = round();
  for (const b of R.bodies) b.skip = true;
  shoot(R, 0, 3, 1);
  shoot(R, 0, 3, 2);
  assert.equal(R.bodies[0].heat, 2);
  miss(R, 0);
  assert.equal(R.bodies[0].heat, 0, 'cooled');
  shoot(R, 0, 3, 3);
  shoot(R, 0, 3, 4);
  shoot(R, 0, 3, 5);
  assert.equal(R.bodies[0].hot, true);
  // A stone into the face of seat 0.
  R.bodies[0].skip = false;
  const b = R.bodies[0];
  R.addThrow({ k: 'throw', id: 'bonk', by: 'p2', kind: 'stone', r: 1, o: [Math.round(b.x * 1000 + 1500), Math.round((b.y + 1.2) * 1000), Math.round(b.z * 1000)], v: [-15000, 0, 0], tk: R.tick }, 2);
  runFor(R, 300);
  assert.ok(b.stunUntil > 0, 'bonked');
  assert.equal(b.hot, false, 'the heat is gone');
});

test('a hot stone breaks through double glazing; a plain one only cracks the ground floor', () => {
  const R = round({ twist: 'double' });
  for (const b of R.bodies) b.skip = true;
  shoot(R, 0, 3, 2);
  assert.equal(R.houses[3].panes[2], CRACKED, 'ground floor: cracked');
  shoot(R, 0, 3, 2);
  assert.equal(R.houses[3].panes[2], BROKEN, 'then broken');
  shoot(R, 0, 3, 12);
  assert.equal(R.houses[3].panes[12], BROKEN, 'upstairs: one stone');
  shoot(R, 0, 3, 6, 'stone', { hot: 1 });
  assert.equal(R.houses[3].panes[6], BROKEN, 'hot: straight through');
});

// ---------------------------------------------------------------- knockout salvage

test('knocking a house out gives the knocker a pane of their own back', () => {
  const R = round();
  for (const b of R.bodies) b.skip = true;
  R.houses[0].panes[REPAIR_ORDER[0]] = BROKEN;
  R.houses[0].panes[REPAIR_ORDER[3]] = BROKEN;
  const h = R.houses[3];
  h.panes.fill(BROKEN);
  h.panes[7] = GLASS;
  shoot(R, 0, 3, 7);
  assert.ok(h.outAt >= 0, 'out');
  assert.equal(h.koBy, 0);
  assert.equal(R.houses[0].panes[REPAIR_ORDER[0]], GLASS, 'salvaged');
  assert.equal(R.houses[0].panes[REPAIR_ORDER[3]], BROKEN, 'just the one');
  assert.equal(R.stats[0].kos, 1);
  assert.equal(R.stats[0].salvaged, 1);
  assert.ok(events(R, 'trick').some((e) => e.seat === 0 && e.ids.includes('ko')));
  // With no glass to win back it heats the next stone instead.
  const L = round();
  for (const b of L.bodies) b.skip = true;
  L.houses[2].panes.fill(BROKEN);
  L.houses[2].panes[0] = GLASS;
  shoot(L, 5, 2, 0);
  assert.equal(L.bodies[5].hot, true);
});

test('a knockout told by another page salvages on the knocker\'s page, once', () => {
  // This page decides only house 1 (its own); house 4 is someone else's.
  const R = round({ decides: (h) => h === 1, controls: (s) => s === 1 });
  R.houses[1].panes[REPAIR_ORDER[0]] = BROKEN;
  const empty = 0;
  R.setMask(4, empty, 0, 5, 12000, 1);
  assert.ok(R.houses[4].outAt >= 0);
  assert.equal(R.houses[1].panes[REPAIR_ORDER[0]], GLASS);
  assert.ok(events(R, 'out').some((e) => e.house === 4 && e.by === 1));
  R.houses[1].panes[REPAIR_ORDER[0]] = BROKEN;
  R.setMask(4, empty, 0, 6, 12000, 1);
  assert.equal(R.houses[1].panes[REPAIR_ORDER[0]], BROKEN, 'once');
});

// ---------------------------------------------------------------- the other twists

test('golden panes refill your stones and heat the next', () => {
  const R = round({ twist: 'golden', seed: 41, round: 2 });
  for (const b of R.bodies) b.skip = true;
  const p = R.gold[0];
  R.bodies[0].ammo = 1;
  shoot(R, 0, 2, p);
  assert.equal(R.houses[2].panes[p], BROKEN);
  assert.equal(R.bodies[0].hot, true);
  assert.equal(R.bodies[0].ammo, AMMO_MAX);
  assert.equal(R.houses[2].gold & (1 << p), 0, 'gold once');
  assert.ok(events(R, 'trick').some((e) => e.ids.includes('gold')));
});

test('hail: each shower cracks a few panes on every house and breaks what it cracked before, never the last pane', () => {
  const R = round({ twist: 'hail' });
  const [first, second] = R.rules.hail;
  runFor(R, first + 50);
  for (const h of R.houses) {
    assert.equal(h.panes.filter((v) => v === CRACKED).length, R.rules.hailPanes);
    assert.equal(glassCount(h.panes), PANES);
  }
  // House 2 fixes its cracks in time; the others don't.
  for (let p = 0; p < PANES; p++) if (R.houses[2].panes[p] === CRACKED) R.houses[2].panes[p] = GLASS;
  R.houses[5].panes.fill(BROKEN);
  R.houses[5].panes[0] = CRACKED;
  runFor(R, second - first);
  assert.equal(glassCount(R.houses[2].panes), PANES, 'repaired in time');
  assert.equal(glassCount(R.houses[3].panes), PANES - R.rules.hailPanes, 'the cracks broke');
  assert.equal(glassCount(R.houses[5].panes), 1, 'the last pane stays');
  assert.ok(events(R, 'hail').length >= 2);
});

test('a hail round repairs cracked panes first', () => {
  const R = round({ twist: 'hail' });
  const h = R.houses[1];
  h.panes[REPAIR_ORDER[0]] = BROKEN;
  h.panes[REPAIR_ORDER[5]] = CRACKED;
  assert.equal(R.nextToGlaze(h.panes), REPAIR_ORDER[5]);
  const Q = round();
  Q.houses[1].panes.set(h.panes);
  assert.equal(Q.nextToGlaze(Q.houses[1].panes), REPAIR_ORDER[0]);
});

test('a hardware sale: quicker repairs, and the store stays open longer', () => {
  const R = round({ twist: 'sale' });
  assert.ok(R.repairMs < REPAIR_MS);
  assert.ok(R.storeClose > STORE_CLOSE_MS);
  R.houses[1].panes[0] = BROKEN;
  while (R.now < STORE_CLOSE_MS + 1000) R.stepTick();
  assert.equal(R.storeOpen(), true);
  R.bodies[1].input.repair = true;
  runFor(R, R.repairMs + 50);
  assert.equal(R.houses[1].panes[0], GLASS);
});

test('a gale blows twice as hard, from round 1', () => {
  const quiet = round({ round: 1 });
  const gale = round({ round: 1, twist: 'gale' });
  const a = quiet.windAt(30000, { x: 0, z: 0, s: 0 }).s;
  const b = gale.windAt(30000, { x: 0, z: 0, s: 0 }).s;
  const plain = windAt(gale.field, gale.seed, 2, 30000, { x: 0, z: 0, s: 0 }).s;
  assert.ok(Math.abs(b - plain * gale.rules.windScale) < 1e-9);
  assert.ok(b > a * 3);
});

test('brick delivery and gnome season: every special is one kind, and more of them', () => {
  const plain = round({ round: 2 });
  for (const [twist, kind] of [['bricks', 'brick'], ['gnomes', 'gnome']]) {
    const R = round({ twist, round: 2 });
    assert.ok(R.specialPlan.every((s) => s.kind === kind));
    assert.ok(R.specialPlan.length > plain.specialPlan.length);
  }
});

// ---------------------------------------------------------------- trick shots

test('trick shots: a long shot from across the street, payback on whoever just hit you', () => {
  const R = round({ street: 1, round: 1 });
  for (const b of R.bodies) b.skip = true;
  // Across Sunset Loop, over the car: house 0 to house 3.
  const b = R.bodies[0];
  const target = paneCentre(R.field.houses[3], 4, {});
  const aim = solveAim(b.x, b.y, b.z, target, 'stone', { extra: 0.3, power: 1 });
  const o = handOf(b.x, b.y, b.z, aim.yaw, {});
  const v = velocityOf('stone', aim.yaw, aim.pitch, aim.power, {});
  R.addThrow({ k: 'throw', id: 'long', by: 'p0', kind: 'stone', r: 1, o: [o.x, o.y, o.z].map((x) => Math.round(x * 1000)), v: [v.x, v.y, v.z].map((x) => Math.round(x * 1000)), tk: R.tick }, 0);
  runFor(R, 3000);
  const br = events(R, 'break').find((e) => e.by === 0);
  assert.ok(br, 'it broke');
  assert.ok(br.d >= LONG_SHOT_M, `${br.d} m`);
  assert.ok(events(R, 'trick').some((e) => e.seat === 0 && e.ids.includes('long')));
  // House 3 hits back within a few seconds: payback.
  R.events.length = 0;
  shoot(R, 3, 0, 2);
  assert.ok(events(R, 'trick').some((e) => e.seat === 3 && e.ids.includes('payback')));
  assert.equal(R.stats[3].trick.payback, 1);
});

test('knocking a stone out of the air is a trick, and a hot one doubly so', () => {
  const R = round();
  const a = { k: 'throw', id: 'a', by: 'p0', kind: 'stone', r: 1, o: [0, 5000, -3000], v: [0, 0, 10000], tk: R.tick, hot: 1 };
  const b = { k: 'throw', id: 'b', by: 'p1', kind: 'stone', r: 1, o: [0, 5000, 3000], v: [0, 0, -10000], tk: R.tick + 1 };
  R.addThrow(a, 0);
  runFor(R, 10);
  R.addThrow(b, 1);
  runFor(R, 500);
  const t = events(R, 'trick').find((e) => e.seat === 1);
  assert.ok(t && t.ids.includes('intercept') && t.ids.includes('firefighter'));
});

// ---------------------------------------------------------------- over the network

test('hot stones, looks and knockouts survive the network checks, and nothing else gets through', () => {
  const field = buildField(2);
  const ctx = { round: 1, tick: 10, field, seatOf: (id) => ['ann', 'bob'].indexOf(id), fromHost: false, from: 'ann', ghost: () => false, holds: () => false, now: 0 };
  const h = field.houses[0];
  const base = { k: 'throw', id: 'x', by: 'ann', kind: 'stone', r: 1, o: [Math.round(h.spawn.x * 1000), 1700, Math.round(h.spawn.z * 1000)], v: [0, 0, 20000], tk: 10 };
  assert.equal(checkThrow({ ...base, hot: 1 }, ctx), 0);
  assert.equal(checkThrow({ ...base, hot: 2 }, ctx), 'shape');
  assert.equal(checkThrow({ ...base, hot: 'yes' }, ctx), 'shape');
  assert.equal(readPresence({ ko: 'bot:2', lk: [1, 2, 3, 4] }).ko, 'bot:2');
  assert.deepEqual(readPresence({ lk: [1, 2, 3, 4] }).lk, [1, 2, 3, 4]);
  assert.equal(readPresence({ lk: [1, 2, 99, 4] }).lk, null);
  assert.equal(readLook('nope'), null);
  assert.equal(readHouses({ a: { g: 0, v: 3, out: 1000, ko: 'b' } }).a.ko, 'b');
  assert.equal(readRoundData({ street: 1, seed: 3, round: 2, ids: ['a'], twist: 'hail' }).twist, 'hail');
  assert.equal(readRoundData({ street: 1, seed: 3, round: 2, ids: ['a'], twist: 'lava' }).twist, 'quiet');
});

test('a page takes at most two hot stones in any four from one thrower', () => {
  const S = createSync({ myId: 'ann', send: () => {} });
  S.begin({ street: 2, seed: 5, round: 1, ids: ['ann', 'bob'], twist: 'quiet' }, [{ id: 'ann' }, { id: 'bob' }], 'ann');
  const h = S.field.houses[1];
  let got = 0;
  for (let k = 0; k < 4; k++) {
    const msg = { k: 'throw', id: `b${k}`, by: 'bob', kind: 'stone', r: 1, o: [Math.round(h.spawn.x * 1000), 1700, Math.round(h.spawn.z * 1000)], v: [0, 2000, 20000], tk: S.R.tick, hot: 1 };
    S.message(msg, 'bob');
    for (let i = 0; i < 40; i++) S.R.stepTick();
  }
  got = S.R.stats[1].hot;
  assert.equal(got, 2);
});

// ---------------------------------------------------------------- whole rounds

test('every twist plays whole rounds: they end, and the twist shows in what happens', () => {
  for (const twist of TWIST_IDS) {
    const r = simulate(1, 400, { twist });
    assert.ok(r.duration > 0 && r.duration <= 180001, twist);
    const all = r.stats.reduce((m, s) => ({ hot: m.hot + s.hot, gold: m.gold + s.gold, kos: m.kos + s.kos }), { hot: 0, gold: 0, kos: 0 });
    assert.ok(all.hot > 0, `${twist}: hot stones get thrown`);
    if (twist === 'golden') assert.ok(all.gold > 0);
    assert.ok(all.kos > 0, `${twist}: houses get knocked out`);
  }
});
