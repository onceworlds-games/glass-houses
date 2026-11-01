import test from 'node:test';
import assert from 'node:assert/strict';
import { checkThrow, createLimiter, readPresence, readHouses, readSpecials, readRoundData, decider, newerMask } from '../src/core/net.js';
import { buildField } from '../src/core/streets.js';
import { handOf } from '../src/core/physics.js';
import { defaultProfile, readProfile, applyRound, applyMatch, starsFor, unlockedCount, totalStars, BADGES } from '../src/core/progress.js';

const field = buildField(0);
const ids = ['ann', 'bob', 'bot:1', 'bot:2', 'bot:3', 'bot:4'];

function ctx(over = {}) {
  return {
    round: 2,
    tick: 1200,
    field,
    seatOf: (id) => ids.indexOf(id),
    fromHost: false,
    from: 'ann',
    ghost: () => false,
    holds: () => false,
    limiter: null,
    now: 10000,
    ...over,
  };
}

function good(seat = 0, over = {}) {
  const h = field.houses[seat];
  const o = handOf(h.spawn.x, h.elev, h.spawn.z, 0.3, {});
  return { k: 'throw', id: `${ids[seat]}:2:1`, by: ids[seat], kind: 'stone', r: 2, o: [o.x, o.y, o.z].map((v) => Math.round(v * 1000)), v: [20000, 5000, 0], tk: 1195, ...over };
}

test('a fair throw passes', () => {
  assert.equal(checkThrow(good(), ctx()), 0);
});

test('throws for someone else, from the wrong round or time, too fast, or from off the lawn are dropped', () => {
  assert.equal(checkThrow(good(0, { by: 'bob' }), ctx()), 'sender');
  assert.equal(checkThrow(good(2), ctx()), 'sender', 'only the host throws for bots');
  assert.equal(checkThrow(good(2), ctx({ fromHost: true, from: 'bob' })), 2);
  assert.equal(checkThrow(good(0, { r: 1 }), ctx()), 'round');
  assert.equal(checkThrow(good(0, { tk: 1200 - 400 }), ctx()), 'time');
  assert.equal(checkThrow(good(0, { tk: 1200 + 200 }), ctx()), 'time');
  assert.equal(checkThrow(good(0, { v: [40000, 0, 0] }), ctx()), 'speed');
  assert.equal(checkThrow(good(0, { v: [1000, 0, 0] }), ctx()), 'speed');
  assert.equal(checkThrow(good(0, { o: [0, 1450, 0] }), ctx()), 'origin');
  const high = good(0);
  high.o[1] += 3000;
  assert.equal(checkThrow(high, ctx()), 'origin');
  assert.equal(checkThrow(good(0, { by: 'zed' }), ctx({ from: 'zed' })), 'seat');
  assert.equal(checkThrow({ k: 'throw' }, ctx()), 'shape');
  assert.equal(checkThrow(null, ctx()), 'shape');
  assert.equal(checkThrow(good(0, { o: [NaN, 0, 0] }), ctx()), 'shape');
  assert.equal(checkThrow(good(0, { kind: 'piano' }), ctx()), 'shape');
});

test('specials only from their holder, pebbles only from ghosts', () => {
  assert.equal(checkThrow(good(0, { kind: 'brick', v: [18000, 4000, 0] }), ctx()), 'kind');
  assert.equal(checkThrow(good(0, { kind: 'brick', v: [18000, 4000, 0] }), ctx({ holds: (i, k) => i === 0 && k === 'brick' })), 0);
  assert.equal(checkThrow(good(0, { kind: 'pebble', v: [10000, 0, 0] }), ctx()), 'kind');
  assert.equal(checkThrow(good(0), ctx({ ghost: () => true })), 'kind', 'a ghost throws pebbles only');
  const ghostThrow = { ...good(0), kind: 'pebble', o: [2000, 3400, 1000], v: [10000, 0, 0] };
  assert.equal(checkThrow(ghostThrow, ctx({ ghost: () => true })), 0);
});

test('nobody throws faster than a person can', () => {
  const limiter = createLimiter();
  let ok = 0;
  for (let i = 0; i < 20; i++) if (checkThrow(good(0, { id: `ann:2:${i}` }), ctx({ limiter, now: 10000 + i * 50 })) === 0) ok++;
  assert.ok(ok >= 5 && ok <= 9, `${ok} of 20 in one second`);
});

test('presence, house masks, specials and round data are cleaned', () => {
  assert.equal(readPresence(null), null);
  const p = readPresence({ x: 1e9, z: 'a', yaw: 1, pitch: 0.1, g: 5, c: 7, gv: 3, gh: 1, h: 'piano', r: 'x' });
  assert.equal(p.x, 0);
  assert.equal(p.z, 0);
  assert.equal(p.c, 5, 'cracks only on glass');
  assert.equal(p.h, null);
  assert.equal(p.gh, 1);
  assert.equal(readPresence({ g: -1 }).g, null);
  assert.deepEqual(readHouses({ 'bot:1': { g: 3, c: 1, v: 2 }, bad: { g: 'x' }, worse: null }), { 'bot:1': { g: 3, c: 1, v: 2, out: -1, ko: '' } });
  assert.deepEqual(readHouses([1, 2]), {});
  assert.equal(readSpecials([{ id: 1, kind: 'brick', x: 1, z: 2, at: 25000, holder: 'ann' }, { id: 2, kind: 'anvil', x: 0, z: 0, at: 0 }]).length, 1);
  assert.equal(readRoundData({ street: 9, seed: 1, round: 1, ids: ['a'] }), null);
  assert.deepEqual(readRoundData({ street: 2, seed: 1, round: 1, ids: ['a', 'b'] }).ids, ['a', 'b']);
});

test('who decides a house: its owner while connected, else the host', () => {
  assert.equal(decider({ id: 'ann', bot: false }, 'bob'), 'ann');
  assert.equal(decider({ id: 'ann', bot: false, away: true }, 'bob'), 'bob');
  assert.equal(decider({ id: 'ann', bot: false, left: true }, 'bob'), 'bob');
  assert.equal(decider({ id: 'bot:1', bot: true }, 'bob'), 'bob');
  assert.deepEqual(newerMask({ g: 1, v: 3 }, { g: 2, v: 4 }), { g: 2, v: 4 });
  assert.deepEqual(newerMask({ g: 1, v: 5 }, { g: 2, v: 4 }), { g: 1, v: 5 });
});

test('stars: a win, 8+ panes left, 15+ left; one star opens the next street', () => {
  assert.equal(starsFor(false, 20), 0);
  assert.equal(starsFor(true, 1), 1);
  assert.equal(starsFor(true, 8), 2);
  assert.equal(starsFor(true, 15), 3);
  let p = defaultProfile();
  assert.equal(unlockedCount(p), 1);
  let r = applyRound(p, { street: 0, won: true, glassLeft: 9, broke: 12, lost: 4, intercepts: 1, bonks: 0, gnomeDouble: 0 });
  p = r.profile;
  assert.equal(r.stars, 2);
  assert.equal(r.unlocked, 1);
  assert.equal(unlockedCount(p), 2);
  assert.ok(r.badges.includes('first-stone') && r.badges.includes('last-house-standing') && r.badges.includes('interception'));
  assert.ok(!r.badges.includes('glass-half-full'));
  r = applyRound(p, { street: 0, won: true, glassLeft: 3, broke: 2, lost: 0 });
  assert.equal(r.stars, 0, 'not a new best');
  assert.ok(r.badges.includes('not-a-scratch'));
  assert.equal(totalStars(r.profile), 2);
  assert.ok(applyMatch(p, true).badges.includes('house-proud'));
});

test('winning on all eight streets earns the whole street; fifty panes earns shattered', () => {
  let p = defaultProfile();
  let all = [];
  for (let s = 0; s < 8; s++) {
    const r = applyRound(p, { street: s, won: true, glassLeft: 2, broke: 7, lost: 3 });
    p = r.profile;
    all = all.concat(r.badges);
  }
  assert.ok(all.includes('the-whole-street'));
  assert.ok(all.includes('shattered'));
  assert.equal(unlockedCount(p), 8);
});

test('a broken save becomes a fresh profile', () => {
  const p = readProfile({ stars: [9, -1, 'x', 2], panes: -5, hints: { throw: true, evil: true } });
  assert.deepEqual(p.stars.slice(0, 4), [0, 0, 0, 2]);
  assert.equal(p.panes, 0);
  assert.deepEqual(p.hints, { throw: true });
  assert.equal(BADGES.length, 10);
});
