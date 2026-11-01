// The Gazette's twist for a round: one rule that bends the street for three minutes. The host draws it from the round's seed and
// it travels with the round's data, so every page plays the same one. Words for the headline live in the view.

import { createRng, hash } from './rng.js';
import { STREET_COUNT } from './streets.js';

export const TWIST_IDS = ['quiet', 'gale', 'hail', 'bricks', 'gnomes', 'double', 'golden', 'sale', 'heatwave'];

const BASE = {
  windScale: 1,
  windRound1: true, // round 1's wind is calmer
  hail: [], // when hail falls (ms)
  hailPanes: 0, // panes each shower cracks on every standing house
  specialKind: null, // every special is this
  specialGap: null, // [min, max] ms between specials
  specialFirst: null, // the first special (ms)
  doubleGlazing: false, // a stone cracks a whole pane first
  gold: 0, // golden panes per house
  repairScale: 1,
  storeClose: 90000,
  heatNeed: 3, // glass hits in a row that heat a stone
};

const RULES = {
  quiet: {},
  gale: { windScale: 2.1, windRound1: false },
  hail: { hail: [38000, 82000, 126000], hailPanes: 3 },
  bricks: { specialKind: 'brick', specialGap: [12000, 16000], specialFirst: 20000 },
  gnomes: { specialKind: 'gnome', specialGap: [12000, 16000], specialFirst: 20000 },
  double: { doubleGlazing: true },
  golden: { gold: 3 },
  sale: { repairScale: 0.6, storeClose: 120000 },
  heatwave: { heatNeed: 2 },
};

/** The rules of a twist: every field, the quiet ones filled in. */
export function twistRules(id) {
  return { id: RULES[id] ? id : 'quiet', ...BASE, ...(RULES[id] ?? {}) };
}

export const isTwist = (id) => TWIST_IDS.includes(id);

// Round 1 of a match teaches: a calm twist or none. Later rounds draw from all of them, never the same twice running.
const FIRST = { quiet: 3, golden: 1, sale: 1, bricks: 1, gnomes: 1 };
const LATER = { quiet: 0.6, gale: 1, hail: 1, bricks: 1, gnomes: 1, double: 1, golden: 1, sale: 0.8, heatwave: 1 };

/** The twist for round `round` of a match, from its seed (and not `prev`, the round before's). */
export function pickTwist(seed, round, prev = '') {
  const rng = createRng(hash(`twist:${seed >>> 0}:${round}`));
  const table = round <= 1 ? FIRST : LATER;
  const ids = Object.keys(table).filter((id) => id !== prev || id === 'quiet');
  let sum = 0;
  for (const id of ids) sum += table[id];
  let r = rng.next() * sum;
  for (const id of ids) {
    r -= table[id];
    if (r <= 0) return id;
  }
  return ids[ids.length - 1];
}

/**
 * The twist of round `round` of a match, from a seed per round that every page can draw (`seedOf(r)`, the match's shared random):
 * a chain from round 1, so any page knows any round's twist at any time (the Gazette shows it before the round's data exists).
 */
export function matchTwist(seedOf, round) {
  let prev = '';
  let t = 'quiet';
  for (let r = 1; r <= round; r++) {
    t = pickTwist(seedOf(r), r, prev);
    prev = t;
  }
  return t;
}

/** The golden panes of a round: the same few on every house (fair), from the seed. */
export function goldPanes(seed, round, n, panes = 20, cols = 10) {
  if (n <= 0) return [];
  const rng = createRng(hash(`gold:${seed >>> 0}:${round}`));
  const out = [];
  // One on each floor at least, spread along the front.
  const order = rng.shuffle(Array.from({ length: panes }, (_, p) => p));
  for (const p of order) {
    if (out.length >= n) break;
    const col = p % cols;
    if (out.some((q) => Math.abs((q % cols) - col) < 2)) continue;
    if (out.length === n - 1 && out.every((q) => Math.floor(q / cols) === Math.floor(p / cols))) continue;
    out.push(p);
  }
  return out.sort((a, b) => a - b);
}

// ---------------------------------------------------------------- the Daily Street

export const DAY_MS = 86400000;
export const dayOf = (ms) => Math.floor(ms / DAY_MS);

/** Today's Daily Street: the same street, seed and twist for everyone on that (UTC) day. */
export function dailyOf(day) {
  const rng = createRng(hash(`daily:${day}`));
  const street = rng.int(STREET_COUNT);
  const seed = (hash(`daily-seed:${day}`) % 2147483646) + 1;
  const twists = TWIST_IDS.filter((t) => t !== 'quiet');
  const twist = twists[rng.int(twists.length)];
  return { day, street, seed, twist };
}
