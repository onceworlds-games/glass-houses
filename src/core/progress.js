// A player's progress: ladder stars per street, totals for the leaderboards, which hints they have seen, and the badges a round
// or a match earns. Pure: the page saves what this returns.

import { STAR_PANES } from './config.js';
import { STREET_COUNT } from './streets.js';

export const BADGES = [
  { id: 'first-stone', name: 'First Stone', description: 'Break your first pane.' },
  { id: 'shattered', name: 'Shattered', description: 'Break 50 panes.' },
  { id: 'last-house-standing', name: 'Last House Standing', description: 'Win a round.' },
  { id: 'glass-half-full', name: 'Glass Half Full', description: 'Win a round with 10 or more panes left.' },
  { id: 'not-a-scratch', name: 'Not a Scratch', description: 'Win a round without losing a pane.' },
  { id: 'interception', name: 'Interception', description: 'Knock a stone out of the air.' },
  { id: 'gnome-run', name: 'Gnome Run', description: 'Break 2 panes with one gnome.' },
  { id: 'fore', name: 'Fore!', description: 'Bonk a neighbour.' },
  { id: 'house-proud', name: 'House Proud', description: 'Win a match.' },
  { id: 'the-whole-street', name: 'The Whole Street', description: 'Win a round on all eight streets.' },
];

export const HINTS = ['throw', 'release', 'keep', 'repair', 'grab', 'brick', 'gnome', 'ghost'];

export function defaultProfile() {
  return { v: 1, stars: Array(STREET_COUNT).fill(0), panes: 0, roundsWon: 0, matchesWon: 0, intercepts: 0, rounds: 0, wonOn: 0, street: 0, hints: {} };
}

const count = (v, max = 1e9) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);

/** A saved profile, cleaned (an old or broken save becomes a fresh one, keeping what fits). */
export function readProfile(raw) {
  const p = defaultProfile();
  if (!raw || typeof raw !== 'object') return p;
  if (Array.isArray(raw.stars)) for (let i = 0; i < STREET_COUNT; i++) p.stars[i] = count(raw.stars[i], 3);
  p.panes = count(raw.panes);
  p.roundsWon = count(raw.roundsWon);
  p.matchesWon = count(raw.matchesWon);
  p.intercepts = count(raw.intercepts);
  p.rounds = count(raw.rounds);
  p.wonOn = count(raw.wonOn, (1 << STREET_COUNT) - 1);
  p.street = count(raw.street, STREET_COUNT - 1);
  if (raw.hints && typeof raw.hints === 'object') for (const h of HINTS) if (raw.hints[h] === true) p.hints[h] = true;
  return p;
}

export const totalStars = (p) => p.stars.reduce((a, b) => a + b, 0);

/** Stars for a round on the ladder: a win, with 8+ panes left, with 15+ left. */
export function starsFor(won, glassLeft) {
  if (!won) return 0;
  let s = 0;
  for (const need of STAR_PANES) if (glassLeft >= need) s++;
  return s;
}

/** How many streets are open: Palm Court, and the one after every street with a star. */
export function unlockedCount(p) {
  let n = 1;
  for (let i = 0; i < STREET_COUNT - 1; i++) if (p.stars[i] > 0) n = Math.max(n, i + 2);
  return Math.min(STREET_COUNT, n);
}

/**
 * A round this player played. info: { street, won, glassLeft, broke, lost, intercepts, bonks, gnomeDouble }.
 * Returns { profile (a new one), badges (ids earned now, maybe already had), stars (new best on that street, or 0), unlocked (a new
 * street opened: its index, or -1) }.
 */
export function applyRound(prev, info) {
  const p = readProfile(prev);
  const before = unlockedCount(p);
  const badges = [];
  p.rounds++;
  p.panes += count(info.broke);
  p.intercepts += count(info.intercepts);
  if (info.broke > 0) badges.push('first-stone');
  if (p.panes >= 50) badges.push('shattered');
  if (info.intercepts > 0) badges.push('interception');
  if (info.bonks > 0) badges.push('fore');
  if (info.gnomeDouble > 0) badges.push('gnome-run');
  let stars = 0;
  if (info.won) {
    p.roundsWon++;
    badges.push('last-house-standing');
    if (info.glassLeft >= 10) badges.push('glass-half-full');
    if (info.lost === 0) badges.push('not-a-scratch');
    const s = Number.isInteger(info.street) && info.street >= 0 && info.street < STREET_COUNT ? info.street : -1;
    if (s >= 0) {
      p.wonOn |= 1 << s;
      const got = starsFor(true, info.glassLeft);
      if (got > p.stars[s]) {
        p.stars[s] = got;
        stars = got;
      }
    }
    if (p.wonOn === (1 << STREET_COUNT) - 1) badges.push('the-whole-street');
  }
  const after = unlockedCount(p);
  return { profile: p, badges, stars, unlocked: after > before ? after - 1 : -1 };
}

/** A match this player finished. */
export function applyMatch(prev, won) {
  const p = readProfile(prev);
  const badges = [];
  if (won) {
    p.matchesWon++;
    badges.push('house-proud');
  }
  return { profile: p, badges };
}
