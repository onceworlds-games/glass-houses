// The game's feel on the screen, over the street: numbers that jump off the glass you break, a crack in the reticle when a stone
// lands, trick shots stamped across the middle, a feed of what the neighbours pulled off, the KNOCKOUT stamp, cracks at the edge
// of the screen when you're hit (on the side it came from), the heat of a hot stone in hand, the Gazette's front page before a
// round and its twist pinned under the clock during it. Plain DOM, pooled, nothing in the way of the pointer.

import { OWNERS } from './palette.js';

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

/** A crack drawn from a point on the screen's edge (SVG path, in a 0..100 box). seed: which crack. */
function crackPath(seed) {
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let d = '';
  for (let k = 0; k < 7; k++) {
    let x = 0;
    let y = 50 + (r() - 0.5) * 30;
    const a = (r() - 0.5) * 1.6;
    d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const len = 18 + r() * 34;
    for (let j = 0; j < 5; j++) {
      const aa = a + (r() - 0.5) * 0.7;
      x += (Math.cos(aa) * len) / 5;
      y += (Math.sin(aa) * len) / 5;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  // A ring between the rays near the edge.
  d += ` M0 ${30 + r() * 8} Q ${8 + r() * 6} 50 0 ${62 + r() * 8}`;
  return d;
}

const FLAME = 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z';

export function createFeel(root) {
  const layer = el('div', '', root);
  layer.id = 'feel';

  // HOT: an orange glow round the screen while a hot stone is in hand.
  const heat = el('div', 'heat', layer);
  // Hit: cracks at the screen's edge on the side the stone came from, and a red rim.
  const cracks = [];
  for (let k = 0; k < 3; k++) {
    const c = el('div', 'edgecrack', layer, `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${crackPath(k + 1)}"/></svg>`);
    cracks.push(c);
  }
  let crackNext = 0;
  // The reticle's hit mark.
  const confirm = el('div', 'confirm', layer, `<svg viewBox="-20 -20 40 40"><path d="M0 -14 L2 -3 L13 -6 L4 2 L11 12 L0 5 L-9 13 L-4 2 L-14 -4 L-2 -3 Z"/></svg>`);
  // Numbers off the glass.
  const plusPool = [];
  for (let k = 0; k < 12; k++) plusPool.push({ e: el('div', 'plus', layer), until: 0 });
  let plusNext = 0;
  // Trick stamps, one after another.
  const stamp = el('div', 'stamp', layer);
  const stampName = el('div', 'nm', stamp);
  const stampXp = el('div', 'xp', stamp);
  const queue = [];
  let stampUntil = 0;
  // The neighbours' feed.
  const feed = el('div', 'feed', layer);
  // KNOCKOUT.
  const ko = el('div', 'ko', layer);
  const koWord = el('div', 'word', ko, 'KNOCKOUT');
  const koLine = el('div', 'line', ko);
  let koUntil = 0;
  // A small toast (salvage, golden pane, heat lost).
  const toast = el('div', 'toast', layer);
  let toastUntil = 0;
  // The Gazette.
  const paper = el('div', 'gazette', layer);
  let paperKey = '';
  // The twist, pinned under the clock.
  const chip = el('div', 'chip hidden', layer);
  const chipName = el('span', 'nm', chip);
  const chipLine = el('span', 'ln', chip);
  let chipKey = '';
  // A warning across the middle (hail).
  const warn = el('div', 'warn', layer);
  let warnUntil = 0;

  const restart = (e, cls) => {
    e.classList.remove(cls);
    void e.offsetWidth;
    e.classList.add(cls);
  };

  const F = {
    /** Hot stone in hand: the screen's edges glow. */
    hot(on) {
      if (heat.classList.contains('on') !== !!on) heat.classList.toggle('on', !!on);
    },

    /** A stone of mine landed on glass: the reticle cracks (gold when it was hot). */
    confirm(hot = false, reduced = false) {
      if (reduced) return;
      confirm.classList.toggle('hot', !!hot);
      restart(confirm, 'on');
    },

    /** "+n" jumping off the glass at screen (x, y). kind: '', 'hot', 'gold', 'ko'. */
    plus(x, y, text, kind = '', now = performance.now()) {
      const p = plusPool[plusNext];
      plusNext = (plusNext + 1) % plusPool.length;
      p.e.textContent = text;
      p.e.className = `plus ${kind}`;
      p.e.style.left = `${x.toFixed(0)}px`;
      p.e.style.top = `${y.toFixed(0)}px`;
      p.e.style.setProperty('--dx', `${((Math.random() - 0.5) * 60).toFixed(0)}px`);
      restart(p.e, 'go');
      p.until = now + 1100;
    },

    /** My trick shots: stamped one after another. list: [{ name, xp }]. */
    trick(list) {
      for (const t of list) if (queue.length < 6) queue.push(t);
    },

    /** Someone else's trick (or knockout) in the feed: { name, seat, text }. */
    feed(item, now = performance.now()) {
      const row = el('div', 'row', feed);
      row.style.setProperty('--c', OWNERS[item.seat % OWNERS.length].color);
      el('span', 'who', row).textContent = item.name;
      el('span', 'what', row).textContent = item.text;
      row.dataset.until = String(now + 4200);
      while (feed.children.length > 4) feed.firstChild.remove();
    },

    /** A knockout: mine (I did it) or someone's; line under the word. */
    knockout(line, mine, now = performance.now()) {
      koLine.textContent = line;
      ko.classList.toggle('mine', !!mine);
      koWord.textContent = mine ? 'KNOCKOUT!' : 'KNOCKOUT';
      restart(ko, 'on');
      koUntil = now + (mine ? 2200 : 1600);
    },

    /** Hit: cracks from the screen's edge at screen-angle `angle` (0 = from ahead/top, π/2 = right). */
    hurt(angle, big = 1, reduced = false) {
      if (reduced) return;
      const c = cracks[crackNext];
      crackNext = (crackNext + 1) % cracks.length;
      // Where a ray from the middle at that angle meets the screen's edge; the crack grows inward from there.
      const w = root.clientWidth || window.innerWidth;
      const h = root.clientHeight || window.innerHeight;
      const dx = Math.sin(angle);
      const dy = -Math.cos(angle);
      const t = Math.min(Math.abs(dx) > 1e-3 ? w / 2 / Math.abs(dx) : 1e9, Math.abs(dy) > 1e-3 ? h / 2 / Math.abs(dy) : 1e9);
      const x = w / 2 + dx * t;
      const y = h / 2 + dy * t;
      const inward = (Math.atan2(-dy, -dx) * 180) / Math.PI;
      c.style.left = `${x.toFixed(0)}px`;
      c.style.top = `${y.toFixed(0)}px`;
      c.style.setProperty('--rot', `${inward.toFixed(0)}deg`);
      c.style.setProperty('--s', String(0.7 + Math.min(0.9, big * 0.2)));
      restart(c, 'on');
    },

    toast(text, kind = '', now = performance.now()) {
      toast.textContent = text;
      toast.className = `toast ${kind}`;
      restart(toast, 'on');
      toastUntil = now + 1800;
    },

    /** The Gazette's front page: { masthead, date, headline, line, street, kicker } or null. */
    gazette(g) {
      const key = g ? `${g.headline}|${g.line}|${g.date}|${g.kicker ?? ''}` : '';
      if (key === paperKey) return;
      paperKey = key;
      paper.classList.toggle('on', !!g);
      if (!g) return;
      paper.innerHTML = '';
      const top = el('div', 'mast', paper);
      el('span', 'l', top).textContent = g.date;
      el('span', 'name', top).textContent = 'The Glass Houses Gazette';
      el('span', 'r', top).textContent = g.price ?? '5¢';
      el('div', 'rule', paper);
      if (g.kicker) el('div', 'kick', paper).textContent = g.kicker;
      el('div', 'head', paper).textContent = g.headline;
      el('div', 'deck', paper).textContent = g.line;
      el('div', 'cols', paper);
    },

    /** The twist under the clock in a round: { name, line } or null. */
    chip(c) {
      const key = c ? `${c.name}|${c.line}` : '';
      if (key === chipKey) return;
      chipKey = key;
      chip.classList.toggle('hidden', !c);
      if (!c) return;
      chipName.textContent = c.name;
      chipLine.textContent = c.line;
    },
    /** Where the chip goes: below this y (the wind's foot). */
    chipAt(y) {
      chip.style.top = `${Math.round(y)}px`;
    },

    warn(text, ms = 2400, now = performance.now()) {
      warn.textContent = text;
      restart(warn, 'on');
      warnUntil = now + ms;
    },

    tick(now) {
      if (stampUntil && now > stampUntil) {
        stampUntil = 0;
        stamp.classList.remove('on');
      }
      if (!stampUntil && queue.length) {
        const t = queue.shift();
        stampName.textContent = t.name;
        stampXp.textContent = t.xp ? `+${t.xp} XP` : '';
        stamp.classList.toggle('big', !!t.big);
        restart(stamp, 'on');
        stampUntil = now + (queue.length ? 900 : 1400);
      }
      if (koUntil && now > koUntil) {
        koUntil = 0;
        ko.classList.remove('on');
      }
      if (toastUntil && now > toastUntil) {
        toastUntil = 0;
        toast.classList.remove('on');
      }
      if (warnUntil && now > warnUntil) {
        warnUntil = 0;
        warn.classList.remove('on');
      }
      for (const row of [...feed.children]) if (now > Number(row.dataset.until)) row.remove();
    },

    /** Everything off (a new round, the title). */
    clear() {
      queue.length = 0;
      stampUntil = 0;
      stamp.classList.remove('on');
      ko.classList.remove('on');
      koUntil = 0;
      toast.classList.remove('on');
      warn.classList.remove('on');
      feed.innerHTML = '';
      F.hot(false);
      F.gazette(null);
      F.chip(null);
    },
  };
  return F;
}

/** Heat pips: an SVG flame. */
export const flameSvg = (cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${FLAME}"/></svg>`;
