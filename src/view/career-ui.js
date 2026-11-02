// The career on screen: your level, rank and day streak on the title with today's three jobs, the Daily Street's door and the
// Locker's; the Locker (what you throw, its trail, your glass, your lawn: tried on live on your own house behind it); the XP a
// round paid, line by line, with the level bar filling; and the Daily Street's results with the neighbourhood's best of the day.

import { LOOKS, SLOTS, owns, levelFor, rankFor } from '../core/career.js';
import { streetName } from '../core/career.js';
import { gazetteOf, num } from './words.js';
import { flameSvg } from './feel.js';

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
const btn = (cls, parent, html, on) => {
  const b = el('button', cls, parent, html);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    on?.();
  });
  return b;
};

const SWATCH = {
  stone: { river: ['#9A938A', '#6F6962'], baseball: ['#F4F0E6', '#C8283A'], geode: ['#9B5FD8', '#6B5A4C'], lemon: ['#F7DC4A', '#C9A81E'], pinecone: ['#A9733F', '#5E3A1C'], die: ['#F4EFE4', '#C8283A'], globe: ['#BFE4F4', '#6B3E22'], crystal: ['#BFF6FF', '#36B8E0'], meteor: ['#FF7A1A', '#2E2A2C'], egg: ['#FFE08A', '#D9A23A'], tennis: ['#E2EE5A', '#B8C83A'] },
  trail: { plain: ['#FFFFFF', '#D8D2C8'], dust: ['#E2CDA2', '#B89A6A'], ribbon: ['#FFFFFF', '#F08A24'], sparks: ['#FFE08A', '#FF9A1A'], confetti: ['#E8645A', '#2BB7B3'], bubbles: ['#E6FBFF', '#8FD8F0'], rainbow: ['#FF5A5A', '#5A8AFF'], comet: ['#BFF4FF', '#2A6CFF'], hearts: ['#FF8FB8', '#E83F78'], news: ['#F4EFE2', '#2B2622'] },
  tint: { clear: ['#DDEFF0', '#9FC4C6'], sea: ['#7FD8CC', '#2E9A90'], amber: ['#F8C060', '#C87A18'], rose: ['#F8A0B8', '#C8506E'], cobalt: ['#7090F0', '#2040B0'], smoke: ['#6A6A76', '#22222A'], mirror: ['#F0F4F8', '#8A93A0'], stained: ['#D8343A', '#2F5BD8'], mint: ['#B0F4D4', '#4AB888'] },
  lawn: { bare: ['#8FAF4A', '#5C7A30'], flamingos: ['#F59BBE', '#E0608E'], grill: ['#C8553D', '#1E1A22'], loungers: ['#2BB7B3', '#F7F2E8'], tiki: ['#FFB040', '#8A6A3A'], dog: ['#E0A060', '#9A5A2A'], choir: ['#D93A2F', '#3563B8'], car: ['#9ED8C6', '#F7F2E8'], fountain: ['#8FD0E8', '#E8E0D2'], statue: ['#FFD86A', '#B8862B'] },
};
const SLOT_NAME = { stone: 'Stone', trail: 'Trail', tint: 'Glass', lawn: 'Lawn' };
const LOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M7 10V7a5 5 0 0 1 10 0v3h1.5v11h-13V10zm2.5 0h5V7a2.5 2.5 0 0 0-5 0z"/></svg>';

/** What it takes to own a look, in a few words. */
function needOf(item) {
  if (item.level) return `Level ${item.level}`;
  if (item.streak) return `${item.streak} days in a row`;
  if (item.dailies) return `${item.dailies} Daily Streets`;
  return '';
}

/**
 * opts: { onLocker, onDaily, onWear(slot, id), onTry(slot, id), onLockerDone, onDailyAgain, onDailyBack, thumb(key) → picture URL or null,
 *         sound: { tick, levelUp } }
 */
export function createCareerUI(root, titleEl, opts = {}) {
  // ------------------------------------------------------------------ the title
  const card = el('div', 'career', titleEl);
  const lvl = el('div', 'lvl', card, '<span class="n">1</span>');
  const lvlN = lvl.querySelector('.n');
  const info = el('div', 'info', card);
  const rank = el('div', 'rank', info, 'New in Town');
  const bar = el('div', 'bar', info, '<i></i>');
  const barI = bar.querySelector('i');
  const sub = el('div', 'sub', info, '0 / 400 XP');
  const streak = el('div', 'streak hidden', card, `${flameSvg()}<span></span>`);
  const streakN = streak.querySelector('span');
  const community = el('div', 'community hidden', titleEl);

  const jobs = el('div', 'jobs', titleEl);
  el('div', 'jh', jobs, "Today's jobs");
  const jobRows = [0, 1, 2].map(() => {
    const r = el('div', 'job', jobs);
    const t = el('span', 't', r);
    const n = el('span', 'n', r);
    const b = el('div', 'jb', r, '<i></i>');
    return { r, t, n, i: b.querySelector('i') };
  });

  const lockerBtn = btn('side locker-btn', titleEl, '<span class="k">Locker</span><span class="new hidden">New</span>', () => opts.onLocker?.());
  const lockerNew = lockerBtn.querySelector('.new');
  const dailyBtn = btn('side daily-btn', titleEl, '<span class="k">Daily Street</span><span class="st"></span><span class="tw"></span><span class="best"></span>', () => opts.onDaily?.());
  const dSt = dailyBtn.querySelector('.st');
  const dTw = dailyBtn.querySelector('.tw');
  const dBest = dailyBtn.querySelector('.best');

  // ------------------------------------------------------------------ the locker
  const locker = el('div', 'screen hidden', root);
  locker.id = 'locker';
  const lhead = el('div', 'lhead mounted', locker, 'Locker');
  const sheet = el('div', 'sheet', locker);
  const tabs = el('div', 'tabs', sheet);
  const tabEls = {};
  const tiles = el('div', 'tiles', sheet);
  const foot = el('div', 'foot', sheet);
  const lockerNote = el('div', 'note', foot);
  btn('done', foot, 'Done', () => opts.onLockerDone?.());
  let slotNow = 'stone';
  let lockerProfile = null;
  let trying = null;
  for (const slot of SLOTS) tabEls[slot] = btn('tab', tabs, `${SLOT_NAME[slot]}<i class="dot hidden"></i>`, () => showSlot(slot));

  function showSlot(slot) {
    slotNow = slot;
    drawLocker();
    const first = LOOKS[slot].find((x) => x.id === lockerProfile?.look[slot]);
    if (first) opts.onTry?.(slot, first.id);
  }

  function drawLocker() {
    const p = lockerProfile;
    if (!p) return;
    const unseen = new Set(U.unseen ?? []);
    for (const slot of SLOTS) {
      tabEls[slot].classList.toggle('sel', slot === slotNow);
      tabEls[slot].querySelector('.dot').classList.toggle('hidden', ![...unseen].some((x) => x.startsWith(`${slot}:`)));
    }
    tiles.innerHTML = '';
    for (const item of LOOKS[slotNow]) {
      const have = owns(p, slotNow, item.id);
      const on = p.look[slotNow] === item.id;
      const sw = SWATCH[slotNow][item.id] ?? ['#ccc', '#888'];
      const t = btn(`tile${on ? ' sel' : ''}${have ? '' : ' locked'}${unseen.has(`${slotNow}:${item.id}`) ? ' new' : ''}${trying === item.id ? ' trying' : ''}`, tiles, '', () => {
        trying = item.id;
        if (have) opts.onWear?.(slotNow, item.id);
        else opts.onTry?.(slotNow, item.id);
        drawLocker();
      });
      const pic = opts.thumb?.(`${slotNow}:${item.id}`);
      if (pic) {
        const im = el('img', 'th', t);
        im.src = pic;
        im.alt = '';
        im.draggable = false;
      } else {
        const s = el('span', `sw ${slotNow} ${slotNow}-${item.id}`, t);
        s.style.setProperty('--a', sw[0]);
        s.style.setProperty('--b', sw[1]);
      }
      if (!have) el('span', 'lock', t, LOCK_SVG);
      el('span', 'nm', t).textContent = item.name;
      el('span', 'req', t).textContent = have ? (on ? 'On' : '') : needOf(item);
    }
    const sel = LOOKS[slotNow].find((x) => x.id === trying);
    lockerNote.textContent = sel && !owns(p, slotNow, sel.id) ? `${sel.name}: ${needOf(sel)}` : '';
  }

  // ------------------------------------------------------------------ the XP after a round
  const xp = el('div', 'hidden', root);
  xp.id = 'xp';
  let xpTimers = [];
  let countRaf = 0;

  // ------------------------------------------------------------------ the Daily Street's results
  const daily = el('div', 'hidden', root);
  daily.id = 'dailyres';

  const U = {
    unseen: [],
    /** The title's career: { profile, today, jobs: [{ text, have, need, done }], streak, daily: { street, twist, best }, unseen, panesToday } */
    title(c) {
      const p = c.profile;
      const L = levelFor(p.xp);
      lvlN.textContent = String(L.level);
      rank.textContent = rankFor(L.level);
      barI.style.width = `${Math.round((L.into / L.need) * 100)}%`;
      sub.textContent = `${num(L.into)} / ${num(L.need)} XP`;
      streak.classList.toggle('hidden', !(c.streak > 0));
      streakN.textContent = String(c.streak);
      streak.title = `${c.streak} day${c.streak === 1 ? '' : 's'} in a row`;
      jobs.classList.toggle('hidden', !c.jobs?.length);
      (c.jobs ?? []).forEach((j, k) => {
        const r = jobRows[k];
        r.t.textContent = j.text;
        r.n.textContent = j.done ? 'Done' : `${j.have}/${j.need}`;
        r.i.style.width = `${Math.round((j.have / j.need) * 100)}%`;
        r.r.classList.toggle('done', j.done);
      });
      lockerNew.classList.toggle('hidden', !(c.unseen?.length > 0));
      if (c.daily) {
        dSt.textContent = streetName(c.daily.street);
        dTw.textContent = gazetteOf(c.daily.twist).chip;
        dBest.textContent = c.daily.best > 0 ? `Best ${num(c.daily.best)}` : 'Not played';
        dailyBtn.classList.toggle('played', c.daily.best > 0);
      }
      if (c.panesToday > 0) {
        community.textContent = `${num(c.panesToday)} panes broken today`;
        community.classList.remove('hidden');
      } else community.classList.add('hidden');
    },

    /** The locker: open with a profile (redrawn on every change), or null to close. */
    locker(p, unseen = []) {
      locker.classList.toggle('hidden', !p);
      if (!p) {
        trying = null;
        lockerProfile = null;
        return;
      }
      const first = !lockerProfile;
      lockerProfile = p;
      U.unseen = unseen;
      if (first) {
        // Open on the slot with something new in it.
        const fresh = unseen.find(Boolean);
        slotNow = fresh ? fresh.split(':')[0] : slotNow;
        trying = p.look[slotNow];
        opts.onTry?.(slotNow, trying);
      }
      drawLocker();
    },
    /** Pictures arrived: draw the tiles again. */
    redraw() {
      if (lockerProfile) drawLocker();
    },
    get lockerOpen() {
      return !locker.classList.contains('hidden');
    },
    get lockerSlot() {
      return slotNow;
    },
    /** The locker's header and sheet heights (the camera frames the house above the sheet). */
    get lockerSheet() {
      return sheet.offsetHeight || 0;
    },
    get lockerSheetW() {
      return sheet.offsetWidth || 0;
    },

    /**
     * The XP a round paid: res from applyRound (xp, level, looks, jobs, streak, daily), or null to hide. Lines tick in one by one,
     * the bar fills, a level up stamps.
     */
    xp(res, profileXp) {
      if (!res && xp.classList.contains('hidden')) return;
      for (const t of xpTimers) clearTimeout(t);
      xpTimers = [];
      xp.classList.toggle('hidden', !res);
      if (!res) return;
      xp.innerHTML = '';
      // A till receipt from the hardware store.
      const rc = el('div', 'rc', xp);
      el('div', 'xh', rc, 'XP');
      const list = el('div', 'lines', rc);
      const lines = res.xp.lines.slice(0, 12);
      if (res.xp.lines.length > 12) {
        const rest = res.xp.lines.slice(11).reduce((a, l) => a + l.xp, 0);
        lines[11] = { label: 'And more', xp: rest };
      }
      lines.forEach((l, k) => {
        const r = el('div', 'ln', list);
        el('span', 'l', r).textContent = l.label;
        el('b', '', r).textContent = `+${num(l.xp)}`;
        r.style.animationDelay = `${0.25 + k * 0.16}s`;
        xpTimers.push(setTimeout(() => opts.sound?.tick?.(k), 250 + k * 160));
      });
      const tot = el('div', 'tot', rc);
      tot.style.animationDelay = `${0.35 + lines.length * 0.16}s`;
      xpTimers.push(setTimeout(() => opts.sound?.till?.(), 350 + lines.length * 160));
      el('span', '', tot).textContent = 'Total';
      el('b', '', tot).textContent = `+${num(res.xp.total)} XP`;
      const before = levelFor(Math.max(0, profileXp - res.xp.total));
      const after = levelFor(profileXp);
      const lv = el('div', 'lv', rc);
      const badge = el('span', 'badge', lv, String(before.level));
      const b2 = el('div', 'bar', lv, '<i></i>');
      const bi = b2.querySelector('i');
      bi.style.width = `${Math.round((before.into / before.need) * 100)}%`;
      const start = 450 + lines.length * 160;
      const up = after.level > before.level;
      xpTimers.push(
        setTimeout(() => {
          bi.style.transition = 'width 0.7s cubic-bezier(0.3, 0.8, 0.3, 1)';
          bi.style.width = up ? '100%' : `${Math.round((after.into / after.need) * 100)}%`;
        }, start),
      );
      if (up) {
        xpTimers.push(
          setTimeout(() => {
            badge.textContent = String(after.level);
            badge.classList.add('pop');
            bi.style.transition = 'none';
            bi.style.width = '0%';
            void bi.offsetWidth;
            bi.style.transition = 'width 0.6s ease-out';
            bi.style.width = `${Math.round((after.into / after.need) * 100)}%`;
            const upEl = el('div', 'up', rc);
            el('div', 'w', upEl).textContent = `Level ${after.level}`;
            el('div', 'r', upEl).textContent = rankFor(after.level) !== rankFor(before.level) ? `New rank: ${rankFor(after.level)}` : '';
            const looks = (res.looks ?? []).map((k) => {
              const [slot, id] = k.split(':');
              return LOOKS[slot]?.find((x) => x.id === id)?.name;
            });
            if (looks.length) el('div', 'unl', upEl).textContent = `Unlocked: ${looks.filter(Boolean).join(', ')}`;
            opts.sound?.levelUp?.();
          }, start + 750),
        );
      }
      const done = (res.jobs ?? []).filter((j) => j.now);
      if (done.length) {
        const jb = el('div', 'jobsdone', rc);
        jb.style.animationDelay = `${(start + (up ? 1300 : 700)) / 1000}s`;
        for (const j of done) el('div', '', jb).textContent = `Job done: ${j.text}`;
      }
      if (res.streak?.grew && res.streak.n > 1) {
        const s = el('div', 'streakline', rc, `${flameSvg()}<span></span>`);
        s.querySelector('span').textContent = `${res.streak.n} days in a row`;
        s.style.animationDelay = `${(start + 300) / 1000}s`;
      }
    },

    /**
     * The Daily Street's results: { score, best, personal, street, twist, place, wall: [{ name, score, me }] | null (loading), plays }
     * or null to hide.
     */
    daily(d) {
      if (!d && daily.classList.contains('hidden')) return;
      // The paper arrives once; the wall loading in redraws it without counting the score up again.
      const fresh = daily.classList.contains('hidden');
      daily.classList.toggle('hidden', !d);
      cancelAnimationFrame(countRaf);
      if (!d) return;
      daily.innerHTML = '';
      const paper = el('div', 'paper', daily);
      const mast = el('div', 'mast', paper);
      el('span', 'name', mast).textContent = 'The Daily Street';
      el('div', 'rule', paper);
      el('div', 'kick', paper).textContent = `${streetName(d.street)} · ${gazetteOf(d.twist).chip}`;
      const sc = el('div', 'score', paper);
      const v = el('span', 'v', sc);
      v.textContent = num(fresh ? 0 : d.score);
      if (fresh && d.score > 0) {
        // The headline figure rolls up like a press counter.
        const t0 = performance.now() + 350;
        const roll = () => {
          // The page's clock, not the frame's timestamp (they disagree under a capture's virtual time).
          const k = Math.min(1, Math.max(0, (performance.now() - t0) / 900));
          v.textContent = num(Math.round(d.score * (1 - (1 - k) ** 3)));
          if (k < 1) countRaf = requestAnimationFrame(roll);
        };
        countRaf = requestAnimationFrame(roll);
      }
      const lb = el('span', `l${d.personal ? ' pb' : ''}${d.personal && fresh ? ' stamp' : ''}`, sc);
      lb.textContent = d.personal ? 'Your best today!' : `Your best: ${num(d.best)}`;
      const wall = el('div', 'wall', paper);
      el('div', 'wh', wall).textContent = "Today's best on the street";
      if (!d.wall) el('div', 'wait', wall).textContent = 'Reading the paper…';
      else if (!d.wall.length) el('div', 'wait', wall).textContent = 'You are the first today.';
      else
        d.wall.slice(0, 8).forEach((w, k) => {
          const r = el('div', `wr${w.me ? ' me' : ''}`, wall);
          el('span', 'k', r).textContent = String(k + 1);
          el('span', 'n', r).textContent = w.name;
          el('span', 's', r).textContent = num(w.score);
        });
      if (d.plays > 0) el('div', 'plays', paper).textContent = `${num(d.plays)} ${d.plays === 1 ? 'play' : 'plays'} today`;
      const row = el('div', 'btns', paper);
      btn('again', row, 'Again', () => opts.onDailyAgain?.());
      btn('back main', row, 'Done', () => opts.onDailyBack?.());
    },
    get dailyOpen() {
      return !daily.classList.contains('hidden');
    },
  };
  return U;
}
