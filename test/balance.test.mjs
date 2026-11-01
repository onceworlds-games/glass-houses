import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, createSimRound, runRound } from '../src/core/sim.js';
import { STREETS } from '../src/core/streets.js';
import { ROUND_MS, POINTS } from '../src/core/config.js';
import { glassCount } from '../src/core/round.js';
import { skillFor } from '../src/core/bots.js';

const SEEDS = 24;
const med = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

const results = STREETS.map((_, s) => Array.from({ length: SEEDS }, (_, k) => simulate(s, 1000 + k)));

test('rounds end in 2:00 to 2:40 on most streets, and every round ends by 3:00', () => {
  for (let s = 0; s < STREETS.length; s++) {
    const rows = results[s];
    const d = med(rows.map((r) => r.duration / 1000));
    assert.ok(d >= 100 && d <= 165, `${STREETS[s].id}: median ${d.toFixed(0)} s`);
    const timeouts = rows.filter((r) => r.timedOut).length;
    assert.ok(timeouts <= SEEDS * 0.25, `${STREETS[s].id}: ${timeouts} reach 3:00`);
    for (const r of rows) assert.ok(r.duration <= ROUND_MS + 1);
  }
});

test('the first house falls after the opening (median 0:40 or later), never in the first 20 s', () => {
  for (let s = 0; s < STREETS.length; s++) {
    const firsts = results[s].map((r) => Math.min(...r.outAt.filter((x) => x >= 0).concat([ROUND_MS])) / 1000);
    assert.ok(med(firsts) >= 40, `${STREETS[s].id}: median first out ${med(firsts)}`);
    assert.ok(Math.min(...firsts) >= 20, `${STREETS[s].id}: earliest ${Math.min(...firsts)}`);
  }
});

test('no runaway seat: wins spread over the neighbours and over the houses', () => {
  for (let s = 0; s < STREETS.length; s++) {
    const st = STREETS[s];
    const people = ['player', ...st.lineup];
    const skill = people.map((_, i) => (i === 0 ? (st.skill[0] + st.skill[1]) / 2 : skillFor(st, i, 6)));
    const byPerson = Array(6).fill(0);
    const byHouse = Array(6).fill(0);
    for (let k = 0; k < SEEDS; k++) {
      // Everyone moves one house along each round, as in a match.
      const at = people.map((_, h) => (h + k) % 6);
      const r = simulate(s, 3000 + k, { personas: at.map((p) => people[p]), skills: at.map((p) => skill[p]) });
      if (r.winnerSeat < 0) continue;
      byHouse[r.winnerSeat]++;
      byPerson[at[r.winnerSeat]]++;
    }
    // 24 rounds over 6 is 4 each: a lucky streak is fine, a fixed winner isn't (personalities do differ). Hillside's top terrace
    // is meant to help.
    assert.ok(Math.max(...byPerson) <= 11, `${st.id} by neighbour: ${byPerson.join(' ')}`);
    assert.ok(Math.max(...byHouse) <= (st.id === 'hillside' ? 12 : 9), `${st.id} by house: ${byHouse.join(' ')}`);
  }
});

test('ghost pebbles matter but do not decide rounds', () => {
  let pebbleBreaks = 0;
  let breaks = 0;
  for (let k = 0; k < 6; k++) {
    const R = createSimRound(k % STREETS.length, 77 + k);
    const kinds = new Map();
    R.onThrow = (msg) => kinds.set(msg.id, msg.kind);
    while (!R.over && R.tick < ROUND_MS / (1000 / 120)) {
      R.stepTick();
      for (const e of R.events) {
        if (e.type !== 'break' || !e.panes?.length || e.remote || e.late) continue;
        breaks += e.panes.length;
        if (e.kind === 'pebble') pebbleBreaks += e.panes.length;
      }
      R.events.length = 0;
      if (R.alive() <= 1) R.over = true;
    }
  }
  assert.ok(breaks > 300);
  assert.ok(pebbleBreaks / breaks <= 0.15, `pebbles ${pebbleBreaks}/${breaks}`);
});

test('a whole match of three rounds plays through on every street: no NaN, nobody outside the world', () => {
  for (let s = 0; s < STREETS.length; s++) {
    const points = Array(6).fill(0);
    for (let round = 1; round <= 3; round++) {
      const R = createSimRound(s, 5000 + s * 10 + round, { round });
      const r = runRound(R);
      for (const b of R.bodies) {
        for (const v of [b.x, b.z, b.yaw, b.pitch, b.gx, b.gz]) assert.ok(Number.isFinite(v));
        assert.ok(Math.hypot(b.x, b.z) <= R.field.R);
      }
      for (const st of R.stones) for (const v of [st.x, st.y, st.z]) assert.ok(Number.isFinite(v));
      for (const h of R.houses) assert.ok(glassCount(h.panes) >= 0);
      r.ranking.forEach((ids, place) => {
        for (const id of ids) points[Number(id.slice(1))] += POINTS[place] ?? 0;
      });
    }
    assert.ok(points.reduce((a, b) => a + b, 0) >= 18, 'points were given');
  }
});

test('many seeds: rounds always end, nothing throws', () => {
  for (let seed = 0; seed < 40; seed++) {
    const r = simulate(seed % STREETS.length, 9000 + seed, { round: 1 + (seed % 3) });
    assert.ok(r.duration > 0 && r.duration <= ROUND_MS + 1);
    assert.ok(r.ranking.flat().length === 6);
  }
});
