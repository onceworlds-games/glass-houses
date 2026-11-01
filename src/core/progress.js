// A player's progress: ladder stars per street, XP and level, the looks they wear, today's jobs, the day streak, the Daily
// Street, totals for the leaderboards, which hints they have seen, and the badges a round or a match earns. Pure: the page saves
// what this returns (one object under the save key 'profile').

import { STAR_PANES } from './config.js';
import { STREET_COUNT } from './streets.js';
import { dailyOf } from './twists.js';
import { XP, TRICKS, levelFor, jobsFor, jobProgress, ownedLooks, owns, SLOTS, LOOKS, dailyScore } from './career.js';

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
  { id: 'hot-hands', name: 'Hot Hands', description: 'Throw a hot stone: three glass hits in a row.' },
  { id: 'firefighter', name: 'Firefighter', description: 'Knock a hot stone out of the air.' },
  { id: 'salvage', name: 'Salvage', description: 'Win a pane back by knocking a house out.' },
  { id: 'long-shot', name: 'Long Shot', description: 'Break a pane from right across the street.' },
  { id: 'daily-paper', name: 'Daily Paper', description: 'Play the Daily Street.' },
  { id: 'job-done', name: 'Job Done', description: "Finish all three of a day's jobs." },
  { id: 'regular', name: 'Regular', description: 'Play three days in a row.' },
  { id: 'neighbourhood-watch', name: 'Neighbourhood Watch', description: 'Play seven days in a row.' },
  { id: 'rock-hound', name: 'Rock Hound', description: 'Reach level 10.' },
  { id: 'street-legend', name: 'Street Legend', description: 'Reach level 30.' },
];

export const HINTS = ['throw', 'release', 'keep', 'repair', 'grab', 'brick', 'gnome', 'ghost', 'hot', 'salvage', 'gold', 'trick', 'locker'];

export function defaultProfile() {
  return {
    v: 2,
    stars: Array(STREET_COUNT).fill(0),
    panes: 0,
    roundsWon: 0,
    matchesWon: 0,
    intercepts: 0,
    rounds: 0,
    wonOn: 0,
    street: 0,
    hints: {},
    xp: 0,
    kos: 0,
    tricks: 0,
    hot: 0,
    bestStreak: 0,
    longest: 0,
    look: { stone: 'river', trail: 'plain', tint: 'clear', lawn: 'bare' },
    seen: [],
    days: { last: -1, streak: 0, best: 0 },
    jobs: { day: -1, have: [0, 0, 0], paid: [false, false, false], bonus: false },
    daily: { day: -1, best: 0, plays: 0, played: 0, bestEver: 0 },
  };
}

const count = (v, max = 1e9) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
const day = (v) => (Number.isInteger(v) && v >= -1 && v <= 1e6 ? v : -1);

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
  p.xp = count(raw.xp, 1e8);
  p.kos = count(raw.kos);
  p.tricks = count(raw.tricks);
  p.hot = count(raw.hot);
  p.bestStreak = count(raw.bestStreak, 1000);
  p.longest = typeof raw.longest === 'number' && raw.longest >= 0 && raw.longest < 200 ? raw.longest : 0;
  const d = raw.days;
  if (d && typeof d === 'object') p.days = { last: day(d.last), streak: count(d.streak, 1e5), best: count(d.best, 1e5) };
  const j = raw.jobs;
  if (j && typeof j === 'object' && Array.isArray(j.have) && Array.isArray(j.paid)) {
    p.jobs = { day: day(j.day), have: [0, 1, 2].map((k) => count(j.have[k], 1e5)), paid: [0, 1, 2].map((k) => j.paid[k] === true), bonus: j.bonus === true };
  }
  const y = raw.daily;
  if (y && typeof y === 'object') p.daily = { day: day(y.day), best: count(y.best, 99999), plays: count(y.plays, 1e4), played: count(y.played, 1e5), bestEver: count(y.bestEver, 99999) };
  // Looks: only ones this profile owns.
  if (raw.look && typeof raw.look === 'object') for (const slot of SLOTS) if (typeof raw.look[slot] === 'string' && owns(p, slot, raw.look[slot])) p.look[slot] = raw.look[slot];
  if (Array.isArray(raw.seen)) {
    const valid = new Set(SLOTS.flatMap((s) => LOOKS[s].map((x) => `${s}:${x.id}`)));
    p.seen = raw.seen.filter((x) => typeof x === 'string' && valid.has(x)).slice(0, 200);
  }
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

/** Today's jobs with this profile's progress on them (a new day starts them over). */
export function jobsToday(p, today) {
  const list = jobsFor(today, dailyOf(today).twist);
  const same = p.jobs.day === today;
  return list.map((j, k) => {
    const have = same ? Math.min(j.need, p.jobs.have[k]) : 0;
    return { ...j, have, done: have >= j.need };
  });
}

/** The day streak as of `today`: a day missed ends it. */
export function streakToday(p, today) {
  if (p.days.last === today || p.days.last === today - 1) return p.days.streak;
  return 0;
}

/**
 * A round this player played. info: { street, won, place, glassLeft, out, broke, lost, intercepts, bonks, gnomeDouble, kos,
 * salvaged, hot, hotBroke, gold, glazed, tricks, trick: { id: n }, bestStreak, longest, daily (bool: the Daily Street), day (UTC day
 * number, -1 when unknown) }.
 * Returns { profile (a new one), badges (ids earned now, maybe already had), stars (new best on that street, or 0), unlocked (a new
 * street opened: its index, or -1), xp: { total, lines: [{ label, xp }] }, level: { before, after }, looks (newly owned, as
 * "slot:id"), jobs (today's, with `now`: finished by this round), streak ({ n, grew }), daily ({ score, best, personal (a best of
 * the day) } on the Daily Street, else null) }.
 */
export function applyRound(prev, info) {
  const p = readProfile(prev);
  const before = unlockedCount(p);
  const owned0 = new Set(ownedLooks(p));
  const lv0 = levelFor(p.xp).level;
  const badges = [];
  const lines = [];
  const add = (label, xp) => {
    if (xp > 0) lines.push({ label, xp: Math.round(xp) });
  };
  const today = Number.isInteger(info.day) && info.day >= 0 ? info.day : -1;
  const trick = info.trick && typeof info.trick === 'object' ? info.trick : {};

  p.rounds++;
  p.panes += count(info.broke);
  p.intercepts += count(info.intercepts);
  p.kos += count(info.kos);
  p.tricks += count(info.tricks);
  p.hot += count(info.hot);
  p.bestStreak = Math.max(p.bestStreak, count(info.bestStreak, 1000));
  if (typeof info.longest === 'number' && info.longest > p.longest && info.longest < 200) p.longest = Math.round(info.longest * 10) / 10;

  // XP.
  add('Played a round', XP.played);
  add(`${count(info.broke)} panes`, XP.pane * count(info.broke));
  add('Hot breaks', XP.hotBreak * count(info.hotBroke));
  for (const [id, t] of Object.entries(TRICKS)) {
    const n = count(trick[id], 999);
    if (n) add(n > 1 ? `${t.name} ×${n}` : t.name, t.xp * n);
  }
  add('Salvage', XP.salvage * count(info.salvaged));
  const place = Number.isInteger(info.place) && info.place >= 1 ? info.place : 6;
  add(place === 1 ? 'First place' : place === 2 ? 'Second place' : place === 3 ? 'Third place' : 'Took part', XP.place[Math.min(5, place - 1)]);
  if (info.won) add('Glass kept', XP.glassLeft * count(info.glassLeft, 20));

  // The day streak: the first round of a day.
  let grew = false;
  if (today >= 0 && p.days.last !== today) {
    p.days.streak = p.days.last === today - 1 ? p.days.streak + 1 : 1;
    p.days.last = today;
    p.days.best = Math.max(p.days.best, p.days.streak);
    grew = true;
    add(p.days.streak > 1 ? `Day ${p.days.streak} in a row` : 'First round today', XP.visit * Math.min(7, p.days.streak));
  }
  if (p.days.streak >= 3) badges.push('regular');
  if (p.days.streak >= 7) badges.push('neighbourhood-watch');

  // The Daily Street.
  let daily = null;
  if (info.daily && today >= 0) {
    const score = dailyScore({ ...info, place, trick });
    if (p.daily.day !== today) {
      p.daily.day = today;
      p.daily.best = 0;
      p.daily.plays = 0;
      p.daily.played++;
      add('Daily Street', XP.dailyStreet);
    }
    p.daily.plays++;
    const personal = score > p.daily.best;
    p.daily.best = Math.max(p.daily.best, score);
    p.daily.bestEver = Math.max(p.daily.bestEver, score);
    daily = { score, best: p.daily.best, personal };
    badges.push('daily-paper');
  }

  // Today's jobs.
  let jobs = [];
  if (today >= 0) {
    if (p.jobs.day !== today) p.jobs = { day: today, have: [0, 0, 0], paid: [false, false, false], bonus: false };
    const list = jobsFor(today, dailyOf(today).twist);
    jobs = list.map((j, k) => {
      p.jobs.have[k] = Math.min(j.need, p.jobs.have[k] + jobProgress(j.kind, { ...info, trick }));
      const done = p.jobs.have[k] >= j.need;
      const now = done && !p.jobs.paid[k];
      if (now) {
        p.jobs.paid[k] = true;
        add(`Job: ${j.text}`, XP.job);
      }
      return { ...j, have: p.jobs.have[k], done, now };
    });
    if (!p.jobs.bonus && p.jobs.paid.every(Boolean)) {
      p.jobs.bonus = true;
      add("All of today's jobs", XP.allJobs);
      badges.push('job-done');
    }
  }

  const total = lines.reduce((a, l) => a + l.xp, 0);
  p.xp = Math.min(1e8, p.xp + total);
  const lv1 = levelFor(p.xp).level;
  if (lv1 >= 10) badges.push('rock-hound');
  if (lv1 >= 30) badges.push('street-legend');

  // Badges from the round itself.
  if (info.broke > 0) badges.push('first-stone');
  if (p.panes >= 50) badges.push('shattered');
  if (info.intercepts > 0) badges.push('interception');
  if (info.bonks > 0) badges.push('fore');
  if (info.gnomeDouble > 0) badges.push('gnome-run');
  if (info.hot > 0) badges.push('hot-hands');
  if (trick.firefighter > 0) badges.push('firefighter');
  if (info.salvaged > 0) badges.push('salvage');
  if (trick.long > 0) badges.push('long-shot');
  let stars = 0;
  if (info.won) {
    p.roundsWon++;
    badges.push('last-house-standing');
    if (info.glassLeft >= 10) badges.push('glass-half-full');
    if (info.lost === 0) badges.push('not-a-scratch');
    const s = Number.isInteger(info.street) && info.street >= 0 && info.street < STREET_COUNT ? info.street : -1;
    if (s >= 0 && !info.daily) {
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
  const looks = ownedLooks(p).filter((x) => !owned0.has(x));
  return {
    profile: p,
    badges,
    stars,
    unlocked: after > before ? after - 1 : -1,
    xp: { total, lines },
    level: { before: lv0, after: lv1 },
    looks,
    jobs,
    streak: { n: p.days.streak, grew },
    daily,
  };
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

/** Puts on a look the profile owns (anything else is ignored), and marks it seen. */
export function wear(prev, slot, id) {
  const p = readProfile(prev);
  if (SLOTS.includes(slot) && owns(p, slot, id)) p.look[slot] = id;
  const key = `${slot}:${id}`;
  if (owns(p, slot, id) && !p.seen.includes(key)) p.seen.push(key);
  return p;
}

const STARTERS = new Set(SLOTS.map((s) => `${s}:${LOOKS[s][0].id}`));
/** Looks the player owns but hasn't looked at yet in the locker. */
export const unseenLooks = (p) => ownedLooks(p).filter((x) => !p.seen.includes(x) && !STARTERS.has(x));
