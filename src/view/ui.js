// The HUD and the screens in the street's own language: house numbers on enamel plates, a sunburst clock, green street-name
// blades, real-estate signs on the lawns and a tangerine front door to play. Plain DOM over the canvas, laid out around the
// platform's own buttons (ow.ui.reserved).

import { OWNERS, symbolPath } from './palette.js';
import { STREETS, STREET_COUNT } from '../core/streets.js';
import { ROUND_MS, STORE_CLOSE_MS, ROUND_OPTIONS } from '../core/config.js';

const STAR = 'M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6 5.6 21.1 7 14l-5.3-5 7.2-.9z';
const LOCK = 'M7 10V7a5 5 0 0 1 10 0v3h1.5v11h-13V10zm2.5 0h5V7a2.5 2.5 0 0 0-5 0z';
const KEY = 'M14.5 2a7.5 7.5 0 0 0-7.1 9.9L1 18.3V23h4.7v-2.5h2.5V18h2.5l1.4-1.4A7.5 7.5 0 1 0 14.5 2zm2.5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z';

const svg = (d, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${d}"/></svg>`;
const symbolSvg = (symbol) => svg(symbolPath(symbol));

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

const text = (e, t) => {
  const s = String(t);
  if (e.textContent !== s) e.textContent = s;
};

const toggle = (e, cls, on) => {
  if (e.classList.contains(cls) !== !!on) e.classList.toggle(cls, !!on);
};

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function starsHtml(n) {
  let h = '<span class="stars">';
  for (let k = 0; k < 3; k++) h += svg(STAR, k < n ? 'on' : 'off');
  return `${h}</span>`;
}

/**
 * opts: { onPlay, onReady, onStreet(index), onRounds(n), onResume, onPause, onClose (the room-closed card's button) }
 */
export function createUI(root, opts = {}) {
  root.innerHTML = '';
  const reserved = { list: [], w: 1, h: 1 };

  // ------------------------------------------------------------------ title
  const title = el('div', 'screen hidden', root);
  title.id = 'title';
  el('h1', 'mounted', title, '<span>Glass</span><span>Houses</span>');
  const play = el('button', 'door', title, 'Play');
  play.type = 'button';
  play.addEventListener('click', (e) => {
    e.stopPropagation();
    opts.onPlay?.();
  });
  const brass = el('div', 'brass hidden', title);

  // ------------------------------------------------------------------ lobby
  const lobby = el('div', 'screen hidden', root);
  lobby.id = 'lobby';
  const signs = el('div', '', lobby);
  const top = el('div', 'top', lobby);
  const street = el('div', 'street', top);
  const prev = el('button', 'arrow', street, '&lsaquo;');
  const blade = el('div', 'blade', street);
  const next = el('button', 'arrow', street, '&rsaquo;');
  prev.type = next.type = 'button';
  prev.setAttribute('aria-label', 'Previous street');
  next.setAttribute('aria-label', 'Next street');
  const ladder = el('div', 'ladder hidden', top);
  const rungs = STREETS.map((s, i) => {
    const b = el('button', '', ladder);
    b.type = 'button';
    b.addEventListener('click', () => opts.onStreet?.(i));
    return b;
  });
  const rounds = el('div', 'rounds', top);
  el('span', 'lab mounted', rounds, 'Rounds');
  const roundBtns = ROUND_OPTIONS.map((n) => {
    const b = el('button', '', rounds, String(n));
    b.type = 'button';
    b.addEventListener('click', () => opts.onRounds?.(n));
    return b;
  });
  const go = el('button', 'go hidden', lobby, 'Ready');
  go.type = 'button';
  go.addEventListener('click', () => opts.onReady?.());
  let lobbyStreet = 0;
  prev.addEventListener('click', () => opts.onStreet?.(lobbyStreet - 1));
  next.addEventListener('click', () => opts.onStreet?.(lobbyStreet + 1));
  const signEls = [];

  // ------------------------------------------------------------------ play
  const hud = el('div', 'screen hidden', root);
  hud.id = 'hud';
  const flash = el('div', '', hud);
  flash.id = 'flash';
  const plateLayer = el('div', '', hud);
  const plates = [];
  for (let i = 0; i < 6; i++) {
    const p = el('div', 'plate house hidden', plateLayer);
    const owner = OWNERS[i];
    p.style.setProperty('--c', owner.color);
    p.innerHTML = `${symbolSvg(owner.symbol)}<span class="num">20</span><span class="who"></span><span class="pin"></span>`;
    plates.push({ el: p, num: p.querySelector('.num'), who: p.querySelector('.who'), n: -1, x: -1, y: -1, hitUntil: 0 });
  }
  const clock = el('div', '', hud);
  clock.id = 'clock';
  clock.innerHTML = clockSvg();
  const clockTime = el('div', 'time', clock, '3:00');
  const clockArc = clock.querySelector('.arc');
  const clockClosed = el('div', 'closed hidden', clock, 'Closed');
  const wind = el('div', '', hud);
  wind.id = 'wind';
  wind.innerHTML = '<svg viewBox="-32 -32 64 64"><g class="rot"></g></svg>';
  const windRot = wind.querySelector('.rot');
  let windCount = -1;
  const reticle = el('div', '', hud);
  reticle.id = 'reticle';
  const mine = el('div', '', hud);
  mine.id = 'mine';
  const minePlate = el('div', 'plate', mine);
  const mineFill = el('div', 'fill', minePlate);
  const mineSym = el('span', '', minePlate);
  const mineNum = el('span', 'num', minePlate, '20');
  const ammo = el('div', '', mine);
  ammo.id = 'ammo';
  const ammoEls = [];
  for (let k = 0; k < 5; k++) ammoEls.push(el('i', '', ammo));
  let mineOwner = -1;
  let mineN = -1;
  const attacker = el('div', '', hud);
  attacker.id = 'attacker';
  const keyhint = el('div', 'hidden', hud);
  keyhint.id = 'keyhint';
  const watch = el('div', 'mounted hidden', hud);
  watch.id = 'watch';

  // ------------------------------------------------------------------ over everything
  const hint = el('div', 'mounted', root);
  hint.id = 'hint';
  let hintUntil = 0;
  const banner = el('div', '', root);
  banner.id = 'banner';
  let bannerKey = '';
  const standings = el('div', 'hidden', root);
  standings.id = 'standings';
  const card = el('div', 'hidden', root);
  card.id = 'card';
  const cardPanel = el('div', 'panel', card);

  let screen = '';
  const screens = { title, lobby, play: hud };

  const U = {
    get screen() {
      return screen;
    },

    /** 'title', 'lobby', 'play' or 'none'. */
    show(name) {
      if (screen === name) return;
      screen = name;
      for (const [k, e] of Object.entries(screens)) toggle(e, 'hidden', k !== name);
      U.layout();
    },

    title(info) {
      if (info.stars > 0) {
        brass.innerHTML = `${svg(STAR)}${info.stars} / ${info.total}`;
        toggle(brass, 'hidden', false);
      } else toggle(brass, 'hidden', true);
    },

    /**
     * info: { street, unlocked, ladder (alone: the eight blades), pick (this page may change it), stars (per street), rounds,
     *         go (our own Ready button: standalone), signs: [{ x, y, name, owner, ready, you, host, visible }] }
     */
    lobby(info) {
      lobbyStreet = info.street;
      const s = STREETS[info.street];
      toggle(ladder, 'hidden', !info.ladder);
      toggle(street, 'hidden', info.ladder);
      if (info.ladder) {
        for (let i = 0; i < STREET_COUNT; i++) {
          const b = rungs[i];
          const locked = i >= info.unlocked;
          const key = `${locked}:${info.stars[i]}:${i === info.street}`;
          if (b.dataset.key !== key) {
            b.dataset.key = key;
            b.innerHTML = locked ? `${svg(LOCK, 'lock')}<span>${STREETS[i].name}</span>` : `<span>${STREETS[i].name}</span>${starsHtml(info.stars[i])}`;
            toggle(b, 'locked', locked);
            toggle(b, 'sel', i === info.street);
            b.disabled = locked || !info.pick;
          }
        }
      } else {
        const key = `${info.street}:${info.stars[info.street]}`;
        if (blade.dataset.key !== key) {
          blade.dataset.key = key;
          blade.innerHTML = `<span>${s.name}</span>${starsHtml(info.stars[info.street])}`;
        }
        toggle(prev, 'hidden', !info.pick);
        toggle(next, 'hidden', !info.pick);
        prev.disabled = info.street <= 0;
        next.disabled = info.street >= info.unlocked - 1;
      }
      for (let k = 0; k < roundBtns.length; k++) {
        toggle(roundBtns[k], 'sel', ROUND_OPTIONS[k] === info.rounds);
        roundBtns[k].disabled = !info.pick;
      }
      toggle(go, 'hidden', !info.go);
      if (info.go) text(go, info.goLabel ?? 'Ready');
      // A sign on each lawn.
      for (let i = 0; i < info.signs.length; i++) {
        const sg = info.signs[i];
        let e = signEls[i];
        if (!e) {
          const root2 = el('div', 'sign', signs);
          const arrow = el('div', 'you-arrow', root2);
          const board = el('div', 'board', root2);
          el('div', 'post', root2);
          e = signEls[i] = { root: root2, board, arrow, key: '' };
        }
        const owner = OWNERS[sg.owner % OWNERS.length];
        const key = `${sg.name}|${sg.owner}|${sg.ready}|${sg.you}|${sg.host}`;
        if (e.key !== key) {
          e.key = key;
          e.root.style.setProperty('--c', owner.color);
          e.board.innerHTML = `${symbolSvg(owner.symbol)}<span class="nm"></span>${sg.host ? svg(KEY, 'host') : ''}${sg.ready ? '<span class="ok"></span>' : ''}`;
          e.board.querySelector('.nm').textContent = sg.name;
          toggle(e.root, 'you', sg.you);
        }
        toggle(e.root, 'hidden', !sg.visible);
        if (sg.visible) {
          e.root.style.left = `${sg.x.toFixed(1)}px`;
          e.root.style.top = `${sg.y.toFixed(1)}px`;
        }
      }
      for (let i = info.signs.length; i < signEls.length; i++) toggle(signEls[i].root, 'hidden', true);
    },

    /** The house plates: [{ i, x, y, edge, n, out, name, lead, away, visible }] by house. */
    houses(list, now) {
      for (let i = 0; i < plates.length; i++) {
        const p = plates[i];
        const h = list[i];
        if (!h || !h.visible) {
          toggle(p.el, 'hidden', true);
          continue;
        }
        toggle(p.el, 'hidden', false);
        if (h.n !== p.n) {
          if (p.n > h.n && p.n >= 0) {
            p.el.classList.remove('hit');
            void p.el.offsetWidth;
            p.el.classList.add('hit');
            p.hitUntil = now + 400;
          }
          p.n = h.n;
          text(p.num, h.n);
        }
        if (p.hitUntil && now > p.hitUntil) {
          p.hitUntil = 0;
          p.el.classList.remove('hit');
        }
        text(p.who, h.name);
        toggle(p.el, 'out', h.out);
        toggle(p.el, 'lead', h.lead);
        toggle(p.el, 'edge', h.edge);
        toggle(p.el, 'away', h.away);
        if (Math.abs(h.x - p.x) > 0.4 || Math.abs(h.y - p.y) > 0.4) {
          p.x = h.x;
          p.y = h.y;
          p.el.style.left = `${h.x.toFixed(1)}px`;
          p.el.style.top = `${h.y.toFixed(1)}px`;
        }
      }
    },

    /** Your plate: { owner, n, out, ghost, ammo, held, pebbles, repair (0..1), watching } */
    mine(m) {
      toggle(mine, 'hidden', !m);
      if (!m) return;
      if (m.owner !== mineOwner) {
        mineOwner = m.owner;
        const o = OWNERS[m.owner % OWNERS.length];
        minePlate.style.setProperty('--c', o.color);
        mineSym.innerHTML = symbolSvg(o.symbol);
      }
      if (m.n !== mineN) {
        if (m.n < mineN) {
          minePlate.classList.remove('shake');
          void minePlate.offsetWidth;
          minePlate.classList.add('shake');
        }
        mineN = m.n;
        text(mineNum, m.n);
      }
      toggle(minePlate, 'out', m.out);
      mineFill.style.height = `${Math.round((m.repair || 0) * 100)}%`;
      const slots = m.ghost ? 3 : 5;
      for (let k = 0; k < 5; k++) {
        const e = ammoEls[k];
        let cls = '';
        if (k >= slots) cls = 'hidden';
        else if (m.ghost) cls = `pebble${k < m.pebbles ? '' : ' gone'}`;
        else if (k === 0 && m.held) cls = m.held;
        else cls = k < m.ammo ? '' : 'gone';
        if (e.className !== cls) e.className = cls;
      }
    },

    /** The clock: time left, and how far through the round (the store's mark at half). */
    clock(elapsed) {
      text(clockTime, fmt(ROUND_MS - elapsed));
      const k = Math.min(1, Math.max(0, elapsed / ROUND_MS));
      clockArc.setAttribute('stroke-dashoffset', String((1 - k) * 213.6));
      const closed = elapsed >= STORE_CLOSE_MS;
      toggle(clockClosed, 'hidden', !closed);
      clockArc.setAttribute('stroke', closed ? '#C8553D' : '#2BB7B3');
    },

    /** The wind arrow, turned to your view: angle in screen radians (0 = up), 0-3 chevrons. */
    wind(angle, strength) {
      const n = strength < 0.25 ? 0 : strength < 1 ? 1 : strength < 2 ? 2 : 3;
      if (n !== windCount) {
        windCount = n;
        let h = '';
        if (n === 0) h = '<circle r="6" fill="#F3E9D8" stroke="#2A2238" stroke-width="2.5"/>';
        for (let k = 0; k < n; k++) {
          const y = 14 - k * 11;
          h += `<path d="M-14 ${y + 8} L0 ${y - 4} L14 ${y + 8} L14 ${y + 14} L0 ${y + 2} L-14 ${y + 14} Z" fill="#F3E9D8" stroke="#2A2238" stroke-width="2.5" stroke-linejoin="round"/>`;
        }
        windRot.innerHTML = h;
      }
      windRot.setAttribute('transform', `rotate(${((angle * 180) / Math.PI).toFixed(1)})`);
    },

    hint(t, ms = 2200, now = performance.now()) {
      text(hint, t);
      hint.classList.add('on');
      hintUntil = now + ms;
    },

    keyhint(t) {
      toggle(keyhint, 'hidden', !t);
      if (t) text(keyhint, t);
    },

    reticle(on) {
      toggle(reticle, 'hidden', !on);
    },

    /** The arrow at the screen's edge pointing at whoever broke your glass. */
    attacker(x, y, angle, color) {
      attacker.style.setProperty('--c', color);
      attacker.style.left = `${(x - 18).toFixed(1)}px`;
      attacker.style.top = `${(y - 17).toFixed(1)}px`;
      attacker.style.transform = `rotate(${angle.toFixed(3)}rad)`;
      attacker.classList.add('on');
    },
    attackerOff() {
      attacker.classList.remove('on');
    },

    flash(reduced) {
      if (reduced) return;
      flash.classList.add('on');
      void flash.offsetWidth;
      flash.classList.remove('on');
    },

    /** A banner: lines of { t, size: 'big' | 'mid' | 'blade', drop }. Key: redraw only when it changes. */
    banner(key, lines) {
      if (key === bannerKey) return;
      bannerKey = key;
      banner.innerHTML = '';
      if (!lines) return;
      for (const l of lines) {
        if (l.size === 'blade') {
          const b = el('div', 'blade', banner);
          b.textContent = l.t;
          if (l.stars !== undefined) b.insertAdjacentHTML('beforeend', starsHtml(l.stars));
        } else {
          const e = el('div', `mounted ${l.size ?? 'mid'}${l.drop ? ' drop' : ''}`, banner);
          e.textContent = l.t;
        }
      }
    },

    watch(t) {
      toggle(watch, 'hidden', !t);
      if (t) text(watch, t);
    },

    /** The standings after a match: [{ place, name, points, panes, owner, me, stars }] or null. */
    standings(rows, head = 'Standings') {
      toggle(standings, 'hidden', !rows);
      if (!rows) return;
      const key = JSON.stringify(rows) + head;
      if (standings.dataset.key === key) return;
      standings.dataset.key = key;
      standings.innerHTML = '';
      el('div', 'head mounted', standings).textContent = head;
      for (const r of rows) {
        const o = OWNERS[r.owner % OWNERS.length];
        const row = el('div', `plate row${r.me ? ' me' : ''}`, standings);
        row.style.setProperty('--c', o.color);
        el('span', 'place', row).textContent = String(r.place);
        row.insertAdjacentHTML('beforeend', symbolSvg(o.symbol));
        el('span', 'name', row).textContent = r.name;
        if (r.stars > 0) row.insertAdjacentHTML('beforeend', starsHtml(r.stars));
        el('span', 'panes', row).textContent = `${r.panes} broken`;
        el('span', 'pts', row).textContent = String(r.points);
      }
      U.layout();
    },

    /** A card: { msg, buttons: [{ label, main, on }] } or null. */
    card(c) {
      toggle(card, 'hidden', !c);
      if (!c) {
        card.dataset.key = '';
        return;
      }
      const key = c.msg + c.buttons.map((b) => b.label).join('|');
      if (card.dataset.key === key) return;
      card.dataset.key = key;
      cardPanel.innerHTML = '';
      if (c.msg) el('div', 'msg', cardPanel).textContent = c.msg;
      for (const b of c.buttons) {
        const e = el('button', b.main ? 'main' : '', cardPanel, '');
        e.type = 'button';
        e.textContent = b.label;
        e.addEventListener('click', (ev) => {
          ev.stopPropagation();
          b.on();
        });
      }
    },
    get cardOpen() {
      return !card.classList.contains('hidden');
    },

    /** Every frame: hints fade on time. */
    tick(now) {
      if (hintUntil && now > hintUntil) {
        hintUntil = 0;
        hint.classList.remove('on');
      }
    },

    /** The platform's UI over the game: keep the clock, your plate and the lobby's buttons out of it. */
    setReserved(list, w, h) {
      reserved.list = Array.isArray(list) ? list.filter((r) => r && Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.w) && Number.isFinite(r.h)) : [];
      reserved.w = w;
      reserved.h = h;
      U.layout();
    },

    /** The top of the free band: below anything the platform draws across the top centre. */
    get safeTop() {
      return topClear(reserved.w / 2 - 160, 320, 10);
    },

    layout() {
      const W = reserved.w;
      const H = reserved.h;
      // The clock: top centre, below anything of the platform's there.
      const cw = clock.offsetWidth || 104;
      const ct = topClear(W / 2 - cw / 2 - 30, cw + 60, 10);
      clock.style.top = `${ct}px`;
      wind.style.top = `${ct + (clock.offsetHeight || 104) + 12}px`;
      // Your plate: bottom centre, above the platform's buttons and stick.
      const mw = mine.offsetWidth || 180;
      const mh = mine.offsetHeight || 110;
      mine.style.bottom = `${bottomClear(W / 2 - mw / 2, mw, mh, 14)}px`;
      keyhint.style.top = `${topClear(W - 90, 80, 14)}px`;
      // The lobby: our own Ready (off the platform only) above anything the platform keeps at the bottom.
      const lobbyH = reserved.list.find((r) => r.kind === 'lobby');
      const strip = lobbyH ? Math.max(0, H - lobbyH.y) : 0;
      go.style.bottom = `${Math.max(18, strip + 16)}px`;
      const tw = top.offsetWidth || 400;
      top.style.top = `${topClear(W / 2 - tw / 2, tw, 12)}px`;
      const sb = Math.max(lobbyH ? H - lobbyH.y + 10 : 96, 96);
      if (W <= 560) standings.style.bottom = `${sb + (go.classList.contains('hidden') ? 0 : 80)}px`;
      else standings.style.bottom = '';
      play.style.bottom = `${Math.max(28, H * 0.07, bottomClear(W / 2 - 75, 150, 196, 28))}px`;
    },
  };

  function overlaps(r, x, w, y, h) {
    return r.x < x + w && r.x + r.w > x && r.y < y + h && r.y + r.h > y;
  }
  function topClear(x, w, y0) {
    let y = y0;
    for (let k = 0; k < 4; k++) {
      let moved = false;
      for (const r of reserved.list) {
        if (r.kind === 'lobby') continue;
        if (overlaps(r, x, w, y, 60)) {
          y = r.y + r.h + 8;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return y;
  }
  function bottomClear(x, w, h, b0) {
    const H = reserved.h;
    let b = b0;
    for (let k = 0; k < 4; k++) {
      let moved = false;
      for (const r of reserved.list) {
        if (r.kind === 'lobby' || r.kind === 'menu') continue;
        if (overlaps(r, x, w, H - b - h, h)) {
          b = H - r.y + 8;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return b;
  }

  return U;
}

function clockSvg() {
  // A mid-century starburst: long and short brass rays round a cream face, the round's progress round the rim, the store's mark.
  let rays = '';
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const long = k % 2 === 0;
    const r1 = long ? 50 : 44;
    const w = long ? 0.07 : 0.05;
    const p = (r, d) => `${(50 + Math.sin(a + d) * r).toFixed(2)} ${(50 - Math.cos(a + d) * r).toFixed(2)}`;
    rays += `M${p(30, -w * 2.4)} L${p(r1, 0)} L${p(30, w * 2.4)} Z `;
  }
  // The store's mark: half way round (1:30 left).
  return `<svg class="burst" viewBox="0 0 100 100" aria-hidden="true">
    <path d="${rays}" fill="#FFB547" stroke="#2A2238" stroke-width="1.2" stroke-opacity="0.35"/>
    <circle cx="50" cy="50" r="34" fill="#F3E9D8" stroke="#2A2238" stroke-opacity="0.25" stroke-width="1.5"/>
    <circle class="arc" cx="50" cy="50" r="34" fill="none" stroke="#2BB7B3" stroke-width="5" stroke-dasharray="213.6" stroke-dashoffset="213.6" transform="rotate(-90 50 50)"/>
    <rect x="47.5" y="80" width="5" height="10" rx="1" fill="#C8553D"/>
  </svg>`;
}
