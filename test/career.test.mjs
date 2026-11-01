import test from 'node:test';
import assert from 'node:assert/strict';
import { levelFor, levelNeed, rankFor, LOOKS, SLOTS, owns, lookCode, lookFromCode, looksAtLevel, nextLook, jobsFor, JOBS, dailyScore, PERSONA_LOOKS, TRICKS } from '../src/core/career.js';
import { readProfile, applyRound, wear, unseenLooks, jobsToday, streakToday, defaultProfile, BADGES } from '../src/core/progress.js';
import { readLook } from '../src/core/net.js';

const DAY = 20400;
const round = (extra = {}) => ({ street: 0, won: false, place: 3, glassLeft: 8, broke: 22, lost: 10, intercepts: 0, bonks: 0, gnomeDouble: 0, kos: 1, salvaged: 1, hot: 2, hotBroke: 4, gold: 0, glazed: 3, tricks: 3, trick: { ko: 1, long: 1, payback: 1 }, bestStreak: 4, longest: 39.5, day: DAY, ...extra });

test('levels: 400 XP for the first, 250 more each level, and a rank to go with them', () => {
  assert.deepEqual(levelFor(0), { level: 1, into: 0, need: 400 });
  assert.equal(levelFor(399).level, 1);
  assert.equal(levelFor(400).level, 2);
  assert.equal(levelFor(400 + 650).level, 3);
  assert.equal(levelNeed(10), 400 + 250 * 9);
  assert.equal(rankFor(1), 'New in Town');
  assert.equal(rankFor(12), 'Rock Hound');
  assert.equal(rankFor(99), 'Mayor of the Street');
});

test('a round pays XP for everything that happened in it, itemised', () => {
  const r = applyRound(null, round());
  const labels = r.xp.lines.map((l) => l.label);
  assert.ok(labels.includes('22 panes'));
  assert.ok(labels.includes('Knockout'));
  assert.ok(labels.includes('Long Shot'));
  assert.ok(labels.includes('Third place'));
  assert.ok(labels.includes('First round today'));
  assert.equal(r.xp.total, r.xp.lines.reduce((a, l) => a + l.xp, 0));
  assert.ok(r.xp.total >= 300 && r.xp.total <= 1200, `${r.xp.total}`);
  assert.equal(r.profile.xp, r.xp.total);
  assert.equal(r.level.before, 1);
  assert.ok(r.level.after >= 2, 'a good first round levels you up');
});

test('the pace: a level or two an evening early on, level 10 in a week of evenings, 30 is months away', () => {
  let p = null;
  let d = DAY;
  let rounds = 0;
  const at = {};
  // Six rounds an evening, middling play, a day streak that breaks now and then.
  for (let evening = 0; evening < 60; evening++) {
    d += evening % 9 === 8 ? 2 : 1;
    for (let k = 0; k < 6; k++) {
      const won = (rounds + evening) % 5 === 0;
      p = applyRound(p, round({ day: d, won, place: won ? 1 : 2 + (rounds % 5), glassLeft: won ? 9 : 0, broke: 18 + (rounds % 9), kos: rounds % 2, salvaged: rounds % 3 === 0 ? 1 : 0, trick: rounds % 2 ? { long: 1 } : { payback: 1 } })).profile;
      rounds++;
      const lv = levelFor(p.xp).level;
      at[lv] ??= rounds;
    }
  }
  assert.ok(at[2] <= 2, `level 2 after ${at[2]} rounds`);
  assert.ok(at[5] >= 6 && at[5] <= 20, `level 5 after ${at[5]} rounds`);
  assert.ok(at[10] >= 25 && at[10] <= 70, `level 10 after ${at[10]} rounds`);
  assert.ok(!at[30] || at[30] > 240, `level 30 after ${at[30]} rounds: more than 40 evenings`);
  assert.ok(at[20], 'level 20 is in reach');
});

test('looks: levels unlock them, a save can only wear what it owns, and they go over the network as four numbers', () => {
  const p = defaultProfile();
  assert.ok(owns(p, 'stone', 'river'));
  assert.ok(!owns(p, 'stone', 'baseball'));
  const rich = readProfile({ xp: 1e6, look: { stone: 'egg', trail: 'comet', tint: 'mirror', lawn: 'car' } });
  assert.deepEqual(rich.look, { stone: 'egg', trail: 'comet', tint: 'mirror', lawn: 'car' });
  const cheat = readProfile({ xp: 0, look: { stone: 'egg', trail: 'comet', tint: 'nope', lawn: 'car' } });
  assert.deepEqual(cheat.look, defaultProfile().look);
  assert.deepEqual(wear(p, 'stone', 'egg').look.stone, 'river');
  assert.deepEqual(wear(rich, 'lawn', 'dog').look.lawn, 'dog');
  for (const look of Object.values(PERSONA_LOOKS)) {
    const code = lookCode(look);
    assert.deepEqual(readLook(code), code);
    assert.deepEqual(lookFromCode(code), look);
  }
  assert.deepEqual(lookFromCode([99, -1, 'x', 2]), { stone: 'river', trail: 'plain', tint: 'clear', lawn: LOOKS.lawn[2].id });
  // Almost every early level brings something.
  let empty = 0;
  for (let lv = 2; lv <= 24; lv++) if (!looksAtLevel(lv).length) empty++;
  assert.ok(empty <= 3, `${empty} levels give nothing`);
  assert.equal(nextLook(1).level, 2);
  for (const slot of SLOTS) assert.equal(new Set(LOOKS[slot].map((x) => x.id)).size, LOOKS[slot].length);
});

test('a level-up shows its new looks once, until the locker has seen them', () => {
  const r = applyRound(null, round());
  assert.ok(r.looks.includes('lawn:flamingos'), r.looks.join());
  assert.ok(unseenLooks(r.profile).includes('lawn:flamingos'));
  const p = wear(r.profile, 'lawn', 'flamingos');
  assert.equal(p.look.lawn, 'flamingos');
  assert.ok(!unseenLooks(p).includes('lawn:flamingos'));
});

test('daily jobs: three kinds a day, the same for everyone, done across rounds and paid once', () => {
  const a = jobsFor(DAY);
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((j) => j.kind)).size, 3);
  assert.deepEqual(jobsFor(DAY), a);
  const kinds = new Set();
  for (let d = 0; d < 60; d++) for (const j of jobsFor(DAY + d)) kinds.add(j.kind);
  assert.ok(kinds.size >= JOBS.length - 1);
  assert.ok(!jobsFor(DAY, 'quiet').some((j) => j.kind === 'gold'));

  // Rounds that do a bit of everything finish every job eventually; each pays once, and all three pay a bonus.
  let p = null;
  let paid = 0;
  let bonus = 0;
  for (let k = 0; k < 12; k++) {
    const r = applyRound(p, round({ won: true, place: 1, intercepts: 1, glazed: 6, daily: k === 0, gold: 2, kos: 2, salvaged: 1, hot: 3, trick: { long: 1, grave: 1, ko: 2 }, tricks: 4 }));
    paid += r.jobs.filter((j) => j.now).length;
    bonus += r.xp.lines.filter((l) => l.label === "All of today's jobs").length;
    p = r.profile;
  }
  assert.equal(paid, 3);
  assert.equal(bonus, 1);
  assert.ok(jobsToday(p, DAY).every((j) => j.done));
  assert.ok(jobsToday(p, DAY + 1).every((j) => j.have === 0), 'a new day starts over');
});

test('the day streak: one more for each day in a row, a missed day starts over, the best is kept', () => {
  let p = null;
  const play = (d) => (p = applyRound(p, round({ day: d })).profile);
  play(DAY);
  play(DAY);
  assert.equal(p.days.streak, 1);
  play(DAY + 1);
  play(DAY + 2);
  assert.equal(p.days.streak, 3);
  assert.equal(streakToday(p, DAY + 3), 3, 'still alive tomorrow');
  assert.equal(streakToday(p, DAY + 4), 0, 'gone after a missed day');
  const r = applyRound(p, round({ day: DAY + 4 }));
  assert.equal(r.profile.days.streak, 1);
  assert.equal(r.profile.days.best, 3);
  assert.ok(applyRound(null, round({ day: DAY })).badges.length > 0);
  // The visit XP is for the first round of a day only.
  const second = applyRound(r.profile, round({ day: DAY + 4 }));
  assert.ok(!second.xp.lines.some((l) => /today|in a row/.test(l.label)));
});

test('the Daily Street: a score from the round, the best of the day kept, days played counted once', () => {
  const s1 = dailyScore({ broke: 20, kos: 1, trick: { ko: 1, long: 1 }, place: 1, glassLeft: 10 });
  assert.equal(s1, 200 + 60 + TRICKS.ko.xp + TRICKS.long.xp + 600 + 150);
  assert.ok(dailyScore({ broke: 5, place: 6, out: true, glassLeft: 10 }) === 50);
  let r = applyRound(null, round({ daily: true, broke: 30 }));
  assert.ok(r.daily.personal);
  assert.equal(r.profile.daily.played, 1);
  const best = r.daily.best;
  r = applyRound(r.profile, round({ daily: true, broke: 2, kos: 0, trick: {} }));
  assert.equal(r.daily.personal, false);
  assert.equal(r.profile.daily.best, best);
  assert.equal(r.profile.daily.played, 1);
  assert.equal(r.profile.daily.plays, 2);
  assert.ok(r.badges.includes('daily-paper'));
  // No ladder stars from the Daily Street.
  const w = applyRound(null, round({ daily: true, won: true, place: 1, glassLeft: 18, street: 3 }));
  assert.equal(w.stars, 0);
});

test('an old save (before levels) reads as a fresh career with its stars kept', () => {
  const p = readProfile({ v: 1, stars: [3, 2, 0, 0, 0, 0, 0, 0], panes: 140, roundsWon: 5, hints: { throw: true } });
  assert.equal(p.xp, 0);
  assert.deepEqual(p.stars.slice(0, 2), [3, 2]);
  assert.equal(p.look.stone, 'river');
  assert.equal(p.days.streak, 0);
  assert.equal(BADGES.length, 20);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, 20);
});
