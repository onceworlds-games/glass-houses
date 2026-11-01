// A player's career on the street: XP from every round, levels and the neighbourhood rank they bring, the looks those levels
// unlock (what you throw, its trail, your glass, your lawn), three daily jobs that are the same for everyone, and the Daily
// Street's score. Pure tables and sums: progress.js keeps the profile, the page shows it.

import { createRng, hash } from './rng.js';
import { STREETS } from './streets.js';

// ---------------------------------------------------------------- trick shots, as the street calls them

export const TRICKS = {
  ko: { name: 'Knockout', xp: 60 },
  long: { name: 'Long Shot', xp: 40 },
  rainbow: { name: 'Rainbow', xp: 35 },
  intercept: { name: 'Interception', xp: 50 },
  firefighter: { name: 'Firefighter', xp: 40 },
  payback: { name: 'Payback', xp: 25 },
  stand: { name: 'Last Stand', xp: 40 },
  buzzer: { name: 'Buzzer Beater', xp: 50 },
  gold: { name: 'Golden', xp: 30 },
  grave: { name: 'From the Grave', xp: 30 },
  skipper: { name: 'Skipper', xp: 40 },
  run: { name: 'On the Run', xp: 25 },
};
export const trickName = (id) => TRICKS[id]?.name ?? id;

// ---------------------------------------------------------------- XP and levels

export const XP = {
  played: 40,
  pane: 8,
  hotBreak: 4,
  salvage: 20,
  place: [160, 100, 60, 30, 30, 30],
  glassLeft: 4, // per pane, for the house that stands
  job: 150,
  allJobs: 250,
  visit: 40, // the first round of a day, per day of the streak (up to a week)
  dailyStreet: 120,
};

/** XP a level takes: 400 for the first, 250 more each level after (a round is worth 250-600). */
export const levelNeed = (level) => 400 + 250 * (level - 1);
export const MAX_LEVEL = 99;

/** { level, into (XP into this level), need (XP this level takes) } for a total. */
export function levelFor(xp) {
  let level = 1;
  let left = Math.max(0, Math.floor(xp) || 0);
  while (level < MAX_LEVEL && left >= levelNeed(level)) {
    left -= levelNeed(level);
    level++;
  }
  return { level, into: left, need: levelNeed(level) };
}

export const RANKS = [
  [1, 'New in Town'],
  [3, 'Window Shopper'],
  [6, 'Pane in the Neck'],
  [10, 'Rock Hound'],
  [15, 'Stone Skipper'],
  [20, 'Neighbourhood Menace'],
  [25, 'Block Captain'],
  [30, 'Street Legend'],
  [40, 'Glass Baron'],
  [50, 'Mayor of the Street'],
];

export function rankFor(level) {
  let name = RANKS[0][1];
  for (const [at, n] of RANKS) if (level >= at) name = n;
  return name;
}

// ---------------------------------------------------------------- looks: what others see of you on the street

/**
 * Each slot's choices in a fixed order (the order is the wire format: never reorder, only add at the end). `level`: the level that
 * unlocks it; `streak`: a day streak that does; `dailies`: Daily Streets played.
 */
export const LOOKS = {
  stone: [
    { id: 'river', name: 'River Stone', level: 1 },
    { id: 'baseball', name: 'Baseball', level: 3 },
    { id: 'geode', name: 'Geode', level: 6 },
    { id: 'lemon', name: 'Lemon', level: 9 },
    { id: 'pinecone', name: 'Pine Cone', level: 12 },
    { id: 'die', name: 'Lucky Die', level: 16 },
    { id: 'globe', name: 'Snow Globe', level: 20 },
    { id: 'crystal', name: 'Crystal', level: 26 },
    { id: 'meteor', name: 'Meteorite', level: 33 },
    { id: 'egg', name: 'Golden Egg', level: 42 },
    { id: 'tennis', name: 'Tennis Ball', dailies: 3 },
  ],
  trail: [
    { id: 'plain', name: 'Streak', level: 1 },
    { id: 'dust', name: 'Dust', level: 4 },
    { id: 'ribbon', name: 'Ribbon', level: 7 },
    { id: 'sparks', name: 'Sparks', level: 11 },
    { id: 'confetti', name: 'Confetti', level: 15 },
    { id: 'bubbles', name: 'Bubbles', level: 19 },
    { id: 'rainbow', name: 'Rainbow', level: 24 },
    { id: 'comet', name: 'Comet', level: 30 },
    { id: 'hearts', name: 'Hearts', streak: 7 },
    { id: 'news', name: 'Newsprint', dailies: 10 },
  ],
  tint: [
    { id: 'clear', name: 'Clear', level: 1 },
    { id: 'sea', name: 'Sea Glass', level: 5 },
    { id: 'amber', name: 'Amber', level: 8 },
    { id: 'rose', name: 'Rose', level: 13 },
    { id: 'cobalt', name: 'Cobalt', level: 18 },
    { id: 'smoke', name: 'Smoked', level: 22 },
    { id: 'mirror', name: 'One-Way Mirror', level: 35 },
    { id: 'stained', name: 'Stained Glass', level: 45 },
    { id: 'mint', name: 'Mint', streak: 3 },
  ],
  lawn: [
    { id: 'bare', name: 'Bare Lawn', level: 1 },
    { id: 'flamingos', name: 'Flamingos', level: 2 },
    { id: 'grill', name: 'Barbecue', level: 10 },
    { id: 'loungers', name: 'Sun Loungers', level: 14 },
    { id: 'tiki', name: 'Tiki Torches', level: 17 },
    { id: 'dog', name: 'The Dog', level: 23 },
    { id: 'choir', name: 'Gnome Choir', level: 28 },
    { id: 'car', name: 'Classic Car', level: 31 },
    { id: 'fountain', name: 'Fountain', level: 38 },
    { id: 'statue', name: 'The Statue', level: 50 },
  ],
};
export const SLOTS = ['stone', 'trail', 'tint', 'lawn'];

/** Whether a profile has a look unlocked. */
export function owns(p, slot, id) {
  const item = LOOKS[slot]?.find((x) => x.id === id);
  if (!item) return false;
  if (item.level) return levelFor(p.xp ?? 0).level >= item.level;
  if (item.streak) return (p.days?.best ?? 0) >= item.streak;
  if (item.dailies) return (p.daily?.played ?? 0) >= item.dailies;
  return false;
}

/** Every look a profile has, as "slot:id". */
export function ownedLooks(p) {
  const out = [];
  for (const slot of SLOTS) for (const item of LOOKS[slot]) if (owns(p, slot, item.id)) out.push(`${slot}:${item.id}`);
  return out;
}

/** The looks a level unlocks (for the results' "New!"). */
export function looksAtLevel(level) {
  const out = [];
  for (const slot of SLOTS) for (const item of LOOKS[slot]) if (item.level === level) out.push({ slot, ...item });
  return out;
}

/** The next look a profile will unlock by levelling, and at what level. */
export function nextLook(level) {
  let best = null;
  for (const slot of SLOTS) for (const item of LOOKS[slot]) if (item.level > level && (!best || item.level < best.level)) best = { slot, ...item };
  return best;
}

/** A look as it goes over the network: four small numbers. Anything unknown is the first choice. */
export function lookCode(look) {
  return SLOTS.map((slot) => Math.max(0, LOOKS[slot].findIndex((x) => x.id === look?.[slot])));
}

export function lookFromCode(code) {
  const out = {};
  SLOTS.forEach((slot, k) => {
    const list = LOOKS[slot];
    const i = Array.isArray(code) && Number.isInteger(code[k]) && code[k] >= 0 && code[k] < list.length ? code[k] : 0;
    out[slot] = list[i].id;
  });
  return out;
}

/** The neighbours show off: each has a look of their own. */
export const PERSONA_LOOKS = {
  walt: { stone: 'river', trail: 'plain', tint: 'clear', lawn: 'choir' },
  ray: { stone: 'baseball', trail: 'dust', tint: 'clear', lawn: 'grill' },
  chad: { stone: 'die', trail: 'sparks', tint: 'smoke', lawn: 'car' },
  lindqvist: { stone: 'geode', trail: 'ribbon', tint: 'stained', lawn: 'fountain' },
  rosa: { stone: 'pinecone', trail: 'confetti', tint: 'sea', lawn: 'flamingos' },
  sunny: { stone: 'lemon', trail: 'rainbow', tint: 'amber', lawn: 'loungers' },
  twins: { stone: 'tennis', trail: 'bubbles', tint: 'mint', lawn: 'dog' },
  bev: { stone: 'globe', trail: 'hearts', tint: 'rose', lawn: 'tiki' },
  player: { stone: 'river', trail: 'plain', tint: 'clear', lawn: 'bare' },
};

// ---------------------------------------------------------------- daily jobs: three a day, the same for everyone

export const JOBS = [
  { kind: 'panes', sizes: [30, 50, 80], text: (n) => `Break ${n} panes` },
  { kind: 'kos', sizes: [2, 3, 5], text: (n) => `Knock out ${n} houses` },
  { kind: 'tricks', sizes: [3, 6, 10], text: (n) => `Land ${n} trick shots` },
  { kind: 'hot', sizes: [3, 5, 8], text: (n) => `Throw ${n} hot stones` },
  { kind: 'wins', sizes: [1, 2, 3], text: (n) => (n === 1 ? 'Win a round' : `Win ${n} rounds`) },
  { kind: 'long', sizes: [1, 2, 4], text: (n) => (n === 1 ? 'Land a long shot' : `Land ${n} long shots`) },
  { kind: 'intercepts', sizes: [1, 2, 3], text: (n) => (n === 1 ? 'Knock a stone out of the air' : `Knock ${n} stones out of the air`) },
  { kind: 'glazed', sizes: [6, 10, 16], text: (n) => `Repair ${n} panes` },
  { kind: 'salvaged', sizes: [1, 2, 3], text: (n) => (n === 1 ? 'Win a pane back with a knockout' : `Win ${n} panes back with knockouts`) },
  { kind: 'grave', sizes: [1, 2, 4], text: (n) => (n === 1 ? 'Break a pane as a ghost' : `Break ${n} panes as a ghost`) },
  { kind: 'daily', sizes: [1], text: () => 'Play the Daily Street' },
  { kind: 'gold', sizes: [2, 3, 5], text: (n) => `Break ${n} golden panes` },
];

/** Today's three jobs (different kinds), for everyone. A golden-pane job only comes on a day whose Daily Street has them. */
export function jobsFor(day, dailyTwist = '') {
  const rng = createRng(hash(`jobs:${day}`));
  const pool = JOBS.filter((j) => j.kind !== 'gold' || dailyTwist === 'golden');
  const picked = rng.shuffle(pool).slice(0, 3);
  return picked.map((j) => {
    const need = j.sizes[rng.int(j.sizes.length)];
    return { kind: j.kind, need, text: j.text(need) };
  });
}

/** How far a round takes a job. */
export function jobProgress(kind, info) {
  switch (kind) {
    case 'panes':
      return info.broke ?? 0;
    case 'kos':
      return info.kos ?? 0;
    case 'tricks':
      return info.tricks ?? 0;
    case 'hot':
      return info.hot ?? 0;
    case 'wins':
      return info.won ? 1 : 0;
    case 'long':
      return info.trick?.long ?? 0;
    case 'intercepts':
      return info.intercepts ?? 0;
    case 'glazed':
      return info.glazed ?? 0;
    case 'salvaged':
      return info.salvaged ?? 0;
    case 'grave':
      return info.trick?.grave ?? 0;
    case 'daily':
      return info.daily ? 1 : 0;
    case 'gold':
      return info.gold ?? 0;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------- the Daily Street's score

export const DAILY_PLACE = [600, 300, 150, 0, 0, 0];

/** One round on the Daily Street, scored: panes, knockouts, tricks, place, and the glass you kept. */
export function dailyScore(info) {
  let s = 0;
  s += 10 * (info.broke ?? 0);
  s += 60 * (info.kos ?? 0);
  for (const [id, n] of Object.entries(info.trick ?? {})) s += (TRICKS[id]?.xp ?? 0) * n;
  s += DAILY_PLACE[Math.max(0, Math.min(5, (info.place ?? 6) - 1))] ?? 0;
  if (!info.out) s += 15 * (info.glassLeft ?? 0);
  return Math.max(0, Math.min(99999, Math.round(s)));
}

/** A street's name, for the Daily Street's headline. */
export const streetName = (i) => STREETS[i]?.name ?? 'The Street';
