import test from 'node:test';
import assert from 'node:assert/strict';
import { buildField } from '../src/core/streets.js';
import { createRound, rankHouses, glassCount, maskOf, panesFromMask, REPAIR_ORDER } from '../src/core/round.js';
import { paneCentre, solveAim, velocityOf, handOf } from '../src/core/physics.js';
import { PANES, COLS, GLASS, CRACKED, BROKEN, STORE_CLOSE_MS, REPAIR_MS, STUN_MS, TICK_MS, AMMO_MAX, KINDS } from '../src/core/config.js';

const seats = (n = 6) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot: false, skill: 0.5 }));

function round(opts = {}) {
  return createRound({ field: buildField(opts.street ?? 2), seed: opts.seed ?? 7, round: opts.round ?? 1, seats: seats(), ...opts });
}

/** A throw from seat `from` at pane `p` of house `h`, with no wind (round 1 of a calm moment is close enough; tests use flat ones). */
function throwAt(R, from, h, p, kind = 'stone') {
  const b = R.bodies[from];
  const target = paneCentre(R.field.houses[h], p, {});
  const aim = solveAim(b.x, b.y, b.z, target, kind, { extra: 0.3 });
  assert.ok(aim, 'reachable');
  const o = handOf(b.x, b.y, b.z, aim.yaw, {});
  const v = velocityOf(kind, aim.yaw, aim.pitch, aim.power, {});
  const msg = { k: 'throw', id: `${from}:${R.tick}:${Math.random()}`, by: `p${from}`, kind, r: R.roundNo, o: [o.x, o.y, o.z].map((x) => Math.round(x * 1000)), v: [v.x, v.y, v.z].map((x) => Math.round(x * 1000)), tk: R.tick };
  R.addThrow(msg, from);
  return msg;
}

function runFor(R, ms) {
  const end = R.now + ms;
  while (R.now < end) R.stepTick();
}

/** Round 1 on a calm street: the wind is at 30%, so short throws land where the solver says. */
const calm = (opts = {}) => round({ round: 1, ...opts });

test('a house starts with 20 panes of glass and its count is its glass', () => {
  const R = round();
  assert.equal(R.houses.length, 6);
  for (const h of R.houses) assert.equal(glassCount(h.panes), PANES);
  assert.equal(R.alive(), 6);
});

test('masks round-trip glass, cracks and broken panes', () => {
  const panes = new Uint8Array(PANES).fill(GLASS);
  panes[0] = BROKEN;
  panes[5] = CRACKED;
  panes[19] = BROKEN;
  const m = maskOf(panes);
  assert.deepEqual(Array.from(panesFromMask(m.g, m.c)), Array.from(panes));
});

test('repair order starts in the middle of the facade, ground floor first', () => {
  assert.equal(REPAIR_ORDER.length, PANES);
  assert.equal(new Set(REPAIR_ORDER).size, PANES);
  assert.ok([4, 5].includes(REPAIR_ORDER[0]));
  assert.ok(REPAIR_ORDER[0] < COLS);
});

test('a stone breaks the pane it hits, and the count drops', () => {
  const R = calm({ street: 2, seed: 3 });
  // Little Loop has a low planter: a stone from house 0 to house 3 flies over it.
  for (const b of R.bodies) b.skip = true;
  throwAt(R, 0, 3, 4);
  runFor(R, 3000);
  const h = R.houses[3];
  assert.ok(glassCount(h.panes) <= PANES - 1, 'a pane broke');
  assert.ok(R.stats[0].broke >= 1);
  assert.equal(R.stats[3].lost, R.stats[0].broke);
});

test('a brick breaks three in a row, a gnome two', () => {
  for (const [kind, want] of [['brick', 3], ['gnome', 2]]) {
    const R = calm({ street: 2, seed: 5 });
    for (const b of R.bodies) b.skip = true;
    throwAt(R, 0, 2, 4, kind);
    runFor(R, 4000);
    const lost = PANES - glassCount(R.houses[2].panes);
    assert.equal(lost, want, `${kind} breaks ${want}`);
  }
});

test('a pebble cracks glass, a second one breaks it', () => {
  const R = calm({ street: 2 });
  const h = R.houses[1];
  h.panes[3] = GLASS;
  // Straight onto the pane through resolve: put a pebble right in front of it, moving in.
  const c = paneCentre(R.field.houses[1], 3, {});
  const f = R.field.houses[1];
  const shoot = (n) => R.addThrow({ k: 'throw', id: `peb${n}`, by: 'p0', kind: 'pebble', r: 1, o: [Math.round((c.x + f.fx * 0.5) * 1000), Math.round(c.y * 1000), Math.round((c.z + f.fz * 0.5) * 1000)], v: [Math.round(-f.fx * 8000), 0, Math.round(-f.fz * 8000)], tk: R.tick }, 0);
  shoot(1);
  runFor(R, 300);
  assert.equal(h.panes[3], CRACKED);
  shoot(2);
  runFor(R, 300);
  assert.equal(h.panes[3], BROKEN);
});

test('your own stones never break your own glass', () => {
  const R = calm({ street: 2 });
  const f = R.field.houses[0];
  const c = paneCentre(f, 3, {});
  R.addThrow({ k: 'throw', id: 'own', by: 'p0', kind: 'stone', r: 1, o: [Math.round((c.x + f.fx * 0.5) * 1000), Math.round(c.y * 1000), Math.round((c.z + f.fz * 0.5) * 1000)], v: [Math.round(-f.fx * 15000), 0, Math.round(-f.fz * 15000)], tk: R.tick }, 0);
  runFor(R, 300);
  assert.equal(glassCount(R.houses[0].panes), PANES);
});

test('a house with no glass is out for the round, and can not be repaired', () => {
  const R = round();
  const h = R.houses[4];
  h.panes.fill(BROKEN);
  R.checkOut(4, 1000);
  assert.ok(h.outAt >= 0);
  assert.equal(R.alive(), 5);
  R.bodies[4].input.repair = true;
  runFor(R, REPAIR_MS * 2);
  assert.equal(glassCount(h.panes), 0);
  assert.equal(R.bodies[4].ghost, true, 'its owner is a ghost');
});

test('repair re-glazes one pane per 2.5 s standing still, only while the store is open', () => {
  const R = round();
  const h = R.houses[1];
  h.panes[REPAIR_ORDER[0]] = BROKEN;
  h.panes[REPAIR_ORDER[1]] = CRACKED;
  R.bodies[1].input.repair = true;
  runFor(R, REPAIR_MS - 100);
  assert.equal(glassCount(h.panes), PANES - 1, 'not yet');
  runFor(R, 200);
  assert.equal(h.panes[REPAIR_ORDER[0]], GLASS);
  runFor(R, REPAIR_MS);
  assert.equal(h.panes[REPAIR_ORDER[1]], GLASS);

  const L = round();
  L.houses[1].panes[0] = BROKEN;
  while (L.now < STORE_CLOSE_MS) L.stepTick();
  L.bodies[1].input.repair = true;
  runFor(L, REPAIR_MS * 2);
  assert.equal(L.houses[1].panes[0], BROKEN, 'the store is closed');
});

test('moving or winding up stops a repair', () => {
  const R = round();
  R.houses[1].panes[REPAIR_ORDER[0]] = BROKEN;
  const inp = R.bodies[1].input;
  inp.repair = true;
  runFor(R, REPAIR_MS * 0.8);
  inp.mx = 1;
  runFor(R, 300);
  inp.mx = 0;
  runFor(R, REPAIR_MS * 0.5);
  assert.equal(R.houses[1].panes[REPAIR_ORDER[0]], BROKEN, 'progress was lost');
});

test('a bonk stuns for a second and stops throwing', () => {
  const R = round({ street: 2 });
  const b = R.bodies[2];
  const by = R.bodies[0];
  R.addThrow({ k: 'throw', id: 'bonk', by: 'p0', kind: 'stone', r: 1, o: [Math.round((b.x + 1) * 1000), Math.round((b.y + 1.2) * 1000), Math.round(b.z * 1000)], v: [-12000, 0, 0], tk: R.tick }, 0);
  runFor(R, 200);
  assert.ok(b.stunUntil > R.now, 'stunned');
  assert.ok(b.stunUntil - R.now <= STUN_MS);
  assert.equal(R.stats[0].bonks, 1);
  void by;
});

test('throwing takes a stone from the pile and it comes back', () => {
  const R = round();
  const b = R.bodies[0];
  b.input.throwHeld = true;
  runFor(R, 300);
  b.input.throwHeld = false;
  runFor(R, 20);
  assert.equal(b.ammo, AMMO_MAX - 1);
  assert.equal(R.stats[0].thrown, 1);
  runFor(R, 900);
  assert.equal(b.ammo, AMMO_MAX);
});

test('a throw leaves at the speed its wind-up gave it', () => {
  const R = round();
  const sent = [];
  R.onThrow = (m) => sent.push(m);
  const b = R.bodies[0];
  b.input.throwHeld = true;
  runFor(R, 1200);
  b.input.throwHeld = false;
  runFor(R, 20);
  const v = Math.hypot(...sent[0].v) / 1000;
  assert.ok(Math.abs(v - KINDS.stone.vmax) < 0.05, `full power: ${v}`);
});

test('two stones that meet in the air knock each other down', () => {
  const R = round({ street: 2 });
  for (const b of R.bodies) b.skip = true;
  R.addThrow({ k: 'throw', id: 'a', by: 'p0', kind: 'stone', r: 1, o: [-5000, 5000, 0], v: [15000, 0, 0], tk: R.tick }, 0);
  R.addThrow({ k: 'throw', id: 'b', by: 'p1', kind: 'stone', r: 1, o: [5000, 5000, 0], v: [-15000, 0, 0], tk: R.tick }, 1);
  const clacks = [];
  for (let i = 0; i < 80; i++) {
    R.stepTick();
    for (const e of R.events) if (e.type === 'clack') clacks.push(e);
    R.events.length = 0;
  }
  assert.equal(clacks.length, 1);
  assert.equal(R.stones.length, 0);
});

test('a late throw that knocks a stone down puts its pane back', () => {
  const R = calm({ street: 2, seed: 9 });
  for (const b of R.bodies) b.skip = true;
  const f = R.field.houses[3];
  const c = paneCentre(f, 4, {});
  // A slow stone into house 3's pane 4, starting 3 m out.
  const o = { x: c.x + f.fx * 3, y: c.y, z: c.z + f.fz * 3 };
  R.addThrow({ k: 'throw', id: 'slow', by: 'p0', kind: 'stone', r: 1, o: [o.x, o.y, o.z].map((x) => Math.round(x * 1000)), v: [Math.round(-f.fx * 15000), 4000, Math.round(-f.fz * 15000)], tk: R.tick }, 0);
  const t0 = R.tick;
  runFor(R, 400);
  assert.equal(R.houses[3].panes[4], BROKEN);
  // A throw from tick t0 that crossed its path half a metre out arrives now.
  R.addThrow({ k: 'throw', id: 'late', by: 'p1', kind: 'stone', r: 1, o: [o.x, o.y, o.z].map((x) => Math.round(x * 1000)), v: [0, 0, 0], tk: t0 }, 1);
  assert.equal(R.houses[3].panes[4], GLASS, 'the pane is back');
});

test('places: standing houses by glass, then the fallen latest first; ties share a place', () => {
  const R = round();
  const ids = R.seats.map((s) => s.id);
  R.houses[0].panes.fill(GLASS);
  R.houses[1].panes.fill(BROKEN);
  R.houses[1].panes[0] = GLASS;
  R.houses[2].panes.fill(BROKEN);
  R.houses[2].outAt = 5000;
  R.houses[3].panes.fill(BROKEN);
  R.houses[3].outAt = 9000;
  R.houses[4].panes.fill(BROKEN);
  R.houses[4].panes[0] = GLASS;
  R.houses[5].panes.fill(BROKEN);
  R.houses[5].outAt = 9000;
  const r = rankHouses(R.houses, ids);
  assert.deepEqual(r, [['p0'], ['p1', 'p4'], ['p3', 'p5'], ['p2']]);
});

test('specials: the first at 0:25, then every gap, none after 2:30, alternating brick and gnome', () => {
  for (let s = 0; s < 20; s++) {
    const R = round({ seed: s });
    const plan = R.specialPlan;
    assert.equal(plan[0].at, 25000);
    for (let i = 1; i < plan.length; i++) {
      assert.notEqual(plan[i].kind, plan[i - 1].kind);
      const gap = plan[i].at - plan[i - 1].at;
      assert.ok(gap >= 24999 && gap <= 35001, `gap ${gap}`);
    }
    assert.ok(plan[plan.length - 1].at <= 150000);
  }
});

test('a special lands between two lawns, waits, can be grabbed, then is thrown', () => {
  const R = round({ seed: 2 });
  while (R.specials.length === 0) R.stepTick();
  const sp = R.specials[0];
  const near = R.field.spots.find((s) => Math.hypot(s.x - sp.x, s.z - sp.z) < 0.01);
  assert.ok(near, 'on a spot between two lawns');
  const b = R.bodies[near.a];
  // Walk it there.
  b.x = sp.x;
  b.z = sp.z;
  runFor(R, 1000);
  b.x = sp.x;
  b.z = sp.z;
  runFor(R, 50);
  assert.equal(b.held, sp.kind);
  b.input.throwHeld = true;
  runFor(R, 400);
  b.input.throwHeld = false;
  runFor(R, 20);
  assert.equal(b.held, null);
  assert.equal(b.ammo, AMMO_MAX, 'the special went, not a stone');
  void TICK_MS;
});
