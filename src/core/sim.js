// A whole round with nobody at the keys: six brains on a street. The title's attract mode, the posters' staging and the balance
// tests all run this.

import { ROUND_MS, TICK_MS } from './config.js';
import { buildField, STREETS } from './streets.js';
import { createRound, rankHouses, glassCount } from './round.js';
import { createBrain, PERSONAS, skillFor } from './bots.js';
import { pickTwist } from './twists.js';

/** The seats of a street's lineup, with an optional player-like brain in seat 0. */
export function lineupSeats(streetIndex, opts = {}) {
  const street = STREETS[streetIndex];
  const ids = opts.personas ?? [opts.first ?? 'player', ...street.lineup];
  return ids.slice(0, 6).map((p, i) => ({
    id: `s${i}`,
    name: PERSONAS[p]?.name ?? 'Neighbour',
    bot: true,
    persona: p,
    skill: opts.skills ? opts.skills[i] : p === 'player' ? opts.playerSkill ?? 0.6 : skillFor(street, i, 6),
    gentle: !!opts.gentle && i === 0,
  }));
}

export function createSimRound(streetIndex, seed, opts = {}) {
  const field = buildField(streetIndex);
  const seats = opts.seats ?? lineupSeats(streetIndex, opts);
  const round = opts.round ?? 2;
  const R = createRound({
    field,
    seed,
    round,
    twist: opts.twist ?? pickTwist(typeof seed === 'number' ? seed : 0, round),
    rules: opts.rules,
    seats,
    brains: seats.map((s, i) => createBrain(s.persona, s.skill, `${seed}:${i}`)),
  });
  return R;
}

/** Steps a round until one house is left (or none) or time is up. */
export function runRound(R, maxMs = ROUND_MS) {
  const limit = Math.ceil(maxMs / TICK_MS);
  while (!R.over && R.tick < limit) {
    R.stepTick();
    if (R.alive() <= 1) R.over = true;
    R.events.length = 0;
  }
  R.over = true;
  return result(R);
}

export function result(R) {
  const ids = R.seats.map((s) => s.id);
  const ranking = rankHouses(R.houses, ids);
  const winner = ranking[0].length === 1 ? ranking[0][0] : null;
  const wi = winner ? ids.indexOf(winner) : -1;
  return {
    ranking,
    winner,
    winnerSeat: wi,
    duration: R.now,
    timedOut: R.alive() > 1,
    glass: R.houses.map((h) => (h.outAt >= 0 ? 0 : glassCount(h.panes))),
    outAt: R.houses.map((h) => h.outAt),
    stats: R.stats,
  };
}

export function simulate(streetIndex, seed, opts = {}) {
  return runRound(createSimRound(streetIndex, seed, opts), opts.maxMs);
}
