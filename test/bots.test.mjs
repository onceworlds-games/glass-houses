import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimRound, runRound, simulate, lineupSeats } from '../src/core/sim.js';
import { checkThrow, createLimiter } from '../src/core/net.js';
import { STREETS } from '../src/core/streets.js';
import { PERSONAS, PERSONA_IDS, personaByName, createBrain } from '../src/core/bots.js';
import { ROUND_MS } from '../src/core/config.js';

test('every neighbour has a name, and names map back to their brain', () => {
  for (const id of PERSONA_IDS) {
    assert.ok(PERSONAS[id].name);
    assert.equal(personaByName(PERSONAS[id].name), id);
  }
  for (const st of STREETS) {
    assert.equal(st.lineup.length, 5);
    for (const p of st.lineup) assert.ok(PERSONA_IDS.includes(p));
  }
  assert.ok(createBrain('nobody', 0.5, 1).update, 'an unknown persona plays as a plain neighbour');
});

test('bots only throw what a player could: every throw passes the checks every page runs', () => {
  for (let s = 0; s < STREETS.length; s++) {
    const R = createSimRound(s, 100 + s, {});
    const limiter = createLimiter();
    const bad = [];
    let n = 0;
    R.onThrow = (msg, seat) => {
      n++;
      const why = checkThrow(msg, {
        round: R.roundNo,
        tick: R.tick,
        field: R.field,
        seatOf: (id) => R.seats.findIndex((x) => x.id === id),
        fromHost: true,
        from: msg.by,
        ghost: (i) => R.bodies[i].ghost,
        holds: (i, kind) => R.specials.some((sp) => sp.holder === i && sp.kind === kind),
        limiter,
        now: R.now,
      });
      if (why !== seat) bad.push(`${msg.kind} ${why}`);
    };
    runRound(R);
    assert.ok(n > 100, `${STREETS[s].id}: ${n} throws`);
    assert.deepEqual(bad, [], STREETS[s].id);
  }
});

test('bots are not useless: they hit glass, repair, intercept and finish rounds', () => {
  let hits = 0;
  let thrown = 0;
  let glazed = 0;
  let intercepts = 0;
  let decided = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const r = simulate(seed % STREETS.length, seed);
    for (const st of r.stats) {
      hits += st.glassHits;
      thrown += st.thrown;
      glazed += st.glazed;
      intercepts += st.intercepts;
    }
    if (!r.timedOut) decided++;
  }
  assert.ok(hits / thrown > 0.25, `hit rate ${hits / thrown}`);
  assert.ok(glazed > 50);
  assert.ok(intercepts > 0);
  assert.ok(decided >= 10);
});

test('bots are beatable: a clumsy neighbour still wins now and then, sharp ones win most', () => {
  // One skill 0.3 against five at 0.9, same personality everywhere.
  let lowWins = 0;
  const N = 40;
  for (let seed = 1; seed <= N; seed++) {
    const r = simulate(0, seed, { personas: Array(6).fill('player'), skills: [0.3, 0.9, 0.9, 0.9, 0.9, 0.9] });
    if (r.winnerSeat === 0) lowWins++;
  }
  assert.ok(lowWins >= 1, `low skill won ${lowWins}/${N}`);
  assert.ok(lowWins < N / 6, `low skill won ${lowWins}/${N}`);
});

test('a beginner, new to the street, wins its share on Palm Court', () => {
  let wins = 0;
  const N = 40;
  for (let seed = 1; seed <= N; seed++) {
    const r = simulate(0, seed, { first: 'beginner', gentle: true });
    if (r.winnerSeat === 0) wins++;
  }
  assert.ok(wins / N >= 0.15, `beginner won ${wins}/${N}`);
});

test('the lineup seats the street’s neighbours with its skill range', () => {
  for (let s = 0; s < STREETS.length; s++) {
    const seats = lineupSeats(s);
    assert.equal(seats.length, 6);
    const [lo, hi] = STREETS[s].skill;
    for (const seat of seats.slice(1)) assert.ok(seat.skill >= lo && seat.skill <= hi);
  }
  assert.ok(ROUND_MS > 0);
});
