// The page: joins the street's server as it loads, draws the title's live street, the lobby, the rounds in first person and the
// results, and turns what happens into sound, shards and shake. Store pictures (?poster=) go to poster.js instead.

import './style.css';
import '@fontsource/josefin-sans/latin-700.css';
import '@fontsource/jost/latin-500.css';
import * as THREE from 'three';
import { createStage } from './view/stage.js';
import { createWorld } from './view/world.js';
import { makeArm } from './view/people.js';
import { loadRigs } from './view/rig.js';
import { createInput } from './view/input.js';
import { createUI } from './view/ui.js';
import { startAudio, audioContext, sound, ambience, hush } from './view/audio.js';
import { music } from './view/music.js';
import { OWNERS } from './view/palette.js';
import { joinRoom, createOnline } from './online.js';
import { createSimRound, lineupSeats } from './core/sim.js';
import { createRound, glassCount } from './core/round.js';
import { buildField, STREETS, STREET_COUNT } from './core/streets.js';
import { tracePath, NO_WIND, handOf, velocityOf } from './core/physics.js';
import { PERSONAS, personaByName } from './core/bots.js';
import { readProfile, applyRound, applyMatch, unlockedCount, totalStars } from './core/progress.js';
import { ROUND_MS, STORE_CLOSE_MS, EYE, REPAIR_MS, ROOF_Y, ROOF_T, SEATS } from './core/config.js';

const params = new URLSearchParams(location.search);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.hostname.endsWith('.localhost');

if (params.has('poster')) {
  import('./view/poster.js')
    .then((m) => m.runPoster(params))
    .catch((err) => {
      document.body.dataset.error = String(err?.stack ?? err);
      document.body.dataset.ready = 'error';
    });
} else {
  boot().catch((err) => {
    console.error('[glass-houses]', err);
    const e = document.createElement('div');
    e.className = 'mounted';
    e.style.cssText = 'position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);font-size:30px;text-align:center';
    e.textContent = 'Something broke. Reload to play.';
    document.getElementById('ui')?.appendChild(e);
  });
}

async function boot() {
  // Join first, so a reload keeps its seat; everything heavy comes after.
  let ow = window.onceworlds ?? null;
  if (!ow) {
    try {
      ow = (await import('@onceworlds/sdk')).default ?? null;
    } catch {
      ow = null;
    }
  }
  let joining = joinRoom(ow);
  const rigs = loadRigs(8000);

  const canvas = document.getElementById('view');
  const uiRoot = document.getElementById('ui');
  const settings = ow?.settings ?? null;
  // A computer drawing without a graphics chip (a software renderer) gets the light version whatever the setting says.
  let software = false;
  const qualityNow = () => {
    if (software) return 'low';
    try {
      return settings?.quality ?? 'medium';
    } catch {
      return 'medium';
    }
  };
  const reduced = () => {
    try {
      return !!settings?.reducedMotion;
    } catch {
      return false;
    }
  };
  const pixelRatio = () => {
    if (software) return 1;
    try {
      return settings?.pixelRatio ? settings.pixelRatio(2) : Math.min(2, window.devicePixelRatio || 1);
    } catch {
      return Math.min(2, window.devicePixelRatio || 1);
    }
  };

  // The title's words and its door first; the street fills in behind them.
  let booted = false;
  let wantPlay = false;
  const ui = createUI(uiRoot, {
    onPlay: () => (booted ? pressPlay() : (wantPlay = true)),
    onReady: () => readyUp(),
    onStreet: (i) => pickStreet(i),
    onRounds: (n) => online?.setSetting('rounds', n),
  });
  ui.show('title');

  await Promise.race([Promise.all([document.fonts.load('700 40px "Josefin Sans"'), document.fonts.load('500 20px Jost')]).catch(() => {}), delay(1200)]);
  // Building the street holds the page for a moment: let the join finish first on a slow machine.
  await Promise.race([joining, delay(2500)]);

  const stage = createStage(canvas, { quality: qualityNow() });
  if (stage.software) {
    software = true;
    stage.setQuality('low');
  }

  const { camera } = stage;
  await rigs;
  const W = createWorld(stage);
  W.setStreet(0);
  let profile = readProfile(null);
  let profileLoaded = false;

  // ------------------------------------------------------------------ state
  let screen = 'title'; // title | game
  let online = null;
  let autoplay = false;
  let autoplayTo = '';
  let menuOpen = false;
  let pausedByHide = false;
  let pausedByMe = false;
  let trauma = 0;
  // The trailer's cameras (local only): '', 'chase', 'orbit', 'weak' (the house with the least glass when it's picked) or
  // 'stone' (riding behind stones headed for glass).
  let camOverride = LOCAL ? params.get('cam') ?? '' : '';
  let camHouse = -1;
  let lastCount = -1;
  let lastFlow = '';
  let arm = null;
  let armSeat = -1;
  let attackerSeat = -1;
  let attackerUntil = 0;
  let readyAskedAt = -1e9;
  let pickedOnce = false;
  let matchStars = 0;
  let squeakAt = 0;
  let outBannerUntil = 0;
  let ghostHintAt = 0;
  let porchSig = '';
  let storeWasOpen = true;
  let lobby = { key: '', R: null };
  let title = { R: null, seed: 11, ms: 0, endAt: 0, shot: -1, shotUntil: 0 };
  const camPos = new THREE.Vector3(0, 14, 30);
  const camLook = new THREE.Vector3(0, 2, 0);
  const tv = new THREE.Vector3();
  const tl = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const stoneLast = new THREE.Vector3();
  let camStone = -1;
  // Breaks seen, for the trailer's capture to find its cuts (local only).
  const breakLog = LOCAL ? [] : null;
  let camHoldUntil = 0;
  const tmpO = { x: 0, y: 0, z: 0 };
  const tmpV = { x: 0, y: 0, z: 0 };
  const arcBuf = new Float32Array(260 * 3);
  const arcPts = new Float32Array(64 * 3);
  let arcN = 0;
  const onArcPoint = (x, y, z, i) => {
    if (i >= 260) return;
    arcBuf[i * 3] = x;
    arcBuf[i * 3 + 1] = y;
    arcBuf[i * 3 + 2] = z;
    arcN = i + 1;
  };

  const reservedList = () => {
    try {
      return (ow && ow.ui && ow.ui.reserved) || [];
    } catch {
      return [];
    }
  };
  const input = createInput(canvas, {
    onConfirm: () => {
      if (screen === 'title') pressPlay();
      else if (ui.screen === 'lobby' && showOwnReady()) readyUp();
    },
    blocked: (x, y) => reservedList().some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h),
  });
  input.onEsc = () => {
    if (screen === 'game' && online?.match.phase === 'round' && !ui.cardOpen) openPauseCard();
  };

  function resize() {
    stage.resize(window.innerWidth, window.innerHeight, pixelRatio());
    ui.setReserved(reservedList(), window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);
  // Sound starts with the first touch in the game, wherever it is.
  window.addEventListener('pointerdown', () => {
    if (screen !== 'game') return;
    startAudio();
    music.start();
  });
  resize();

  // ------------------------------------------------------------------ the platform
  try {
    ow?.ui?.setLook?.({ accent: '#FFB547', panel: '#2F6B4F', text: '#F3E9D8' });
  } catch {
    /* outside the platform */
  }
  try {
    ow?.on?.('reserved', () => ui.setReserved(reservedList(), window.innerWidth, window.innerHeight));
    ow?.on?.('pause', () => (menuOpen = true));
    ow?.on?.('resume', () => (menuOpen = false));
    settings?.on?.('change', () => {
      stage.setQuality(qualityNow());
      resize();
    });
    ow?.rooms?.on?.('moved', (room) => attach(room));
  } catch {
    /* fine */
  }
  let controlsKey = '';
  function setControls(on) {
    const key = on ? 'play' : 'none';
    if (key === controlsKey) return;
    controlsKey = key;
    try {
      ow?.controls?.set(on ? { stick: 'wasd', buttons: [{ id: 'throw', label: 'Throw', key: ' ' }, { id: 'repair', label: 'Repair', key: 'r' }] } : null);
    } catch {
      /* fine */
    }
  }
  setControls(false);

  ow?.save
    ?.get('profile')
    .then((raw) => {
      profile = readProfile(raw);
      profileLoaded = true;
      ui.title({ stars: totalStars(profile), total: STREET_COUNT * 3 });
    })
    .catch(() => (profileLoaded = true));
  const saveProfile = () => ow?.save?.set('profile', profile).catch(() => {});
  const award = (ids) => {
    for (const id of ids) ow?.badges?.award(id).catch(() => {});
  };
  const submit = (board, score) => {
    if (score > 0) ow?.leaderboards?.submit(board, score).catch(() => {});
  };

  // ------------------------------------------------------------------ the room
  function attach(room) {
    online?.dispose();
    online = null;
    if (!room) {
      ui.card({ msg: 'No connection', buttons: [{ label: 'Rejoin', main: true, on: rejoin }] });
      return;
    }
    const devOK = LOCAL || ow?.mode === 'standalone';
    autoplay = devOK && params.get('autoplay') === '1';
    autoplayTo = devOK ? params.get('autoplay-to') ?? '' : '';
    pickedOnce = false;
    online = createOnline({
      room,
      autoplay,
      gentle: (s) => s <= 1 && (profile.stars[s] ?? 0) === 0,
      onPhase: (phase, prev) => phaseChanged(phase, prev),
      onResults: (standings, mine) => matchOver(standings, mine),
      onClose: (reason) => closed(reason),
    });
    if (screen === 'title') hideStrip(true);
    if (autoplay || autoplayTo === 'lobby') pressPlay();
  }

  /** The platform's Ready strip has no place on the title. */
  function hideStrip(on) {
    try {
      online?.room.hideLobby?.(on);
    } catch {
      /* fine */
    }
  }

  function closed(reason) {
    if (reason === 'left' || reason === 'moved') return;
    const msg = reason === 'kicked' ? 'You were removed' : reason === 'replaced' ? 'Playing in another tab' : 'Disconnected';
    const label = reason === 'kicked' ? 'Play' : reason === 'replaced' ? 'Play here' : 'Rejoin';
    input.setActive(false);
    ui.card({ msg, buttons: [{ label, main: true, on: rejoin }] });
  }

  async function rejoin() {
    ui.card(null);
    online?.dispose();
    online = null;
    joining = joinRoom(ow);
    attach(await joining);
  }

  joining.then((room) => attach(room));

  // ------------------------------------------------------------------ title → lobby
  function pressPlay() {
    if (screen !== 'title') return;
    startAudio();
    music.start();
    music.set('menu');
    sound.click();
    screen = 'game';
    hideStrip(false);
    W.sweep();
  }

  const lobbyPlayers = () => {
    const m = online?.match;
    if (!m) return [];
    try {
      return m.lobby.players.slice(0, SEATS);
    } catch {
      return [];
    }
  };
  const alone = () => lobbyPlayers().length <= 1;
  const showOwnReady = () => ow?.mode !== 'platform';

  function readyUp() {
    if (!online || online.match.phase !== 'lobby') return;
    sound.click();
    const me = lobbyPlayers().find((p) => p.me);
    online.ready(!(me?.ready ?? false) || online.room.kind === 'solo');
  }

  function pickStreet(i) {
    if (!online) return;
    const max = alone() || online.isHost ? unlockedCount(profile) : STREET_COUNT;
    const s = Math.max(0, Math.min(max - 1, i));
    if (online.setSetting('street', s + 1)) {
      sound.click();
      profile.street = s;
      saveProfile();
    }
  }

  // ------------------------------------------------------------------ what the street shows: the title's round, the lobby, a round
  let showing = '';
  function show(kind, setup) {
    if (showing === kind) return;
    showing = kind;
    setup();
  }

  function setupRound(R, data) {
    W.setStreet(data.street);
    W.sweep();
    const sync = online.sync;
    W.cast(sync.seats.map((s) => (s.bot ? personaByName(s.name) ?? 'player' : 'player')));
    const me = sync.mySeat;
    if (me >= 0) {
      input.face(R.bodies[me].yaw, 0.12);
      if (armSeat !== me) {
        if (arm) {
          camera.remove(arm.group);
          arm.dispose();
        }
        arm = makeArm(me);
        camera.add(arm.group);
        armSeat = me;
      }
    }
    attackerUntil = 0;
    outBannerUntil = 0;
    ghostHintAt = 0;
  }

  function phaseChanged(phase, prev) {
    if (prev === 'round' && phase !== 'round') {
      roundOver();
      if (ui.cardOpen && !online.room.closed) ui.card(null);
    }
    if (phase === 'round' && online.sync.R && online.sync.mySeat >= 0) {
      if (online.match.round === 1 && profile.rounds < 3) ui.hint('Break their glass', 2200);
    }
    if (phase === 'lobby') {
      lastCount = -1;
      if (prev === 'results' && online.isHost && alone()) {
        // After a solo match the next street that needs a star is already picked.
        const s = online.street;
        const open = unlockedCount(profile);
        if (profile.stars[s] > 0 && s + 1 < open) pickStreet(s + 1);
      }
    }
    if (prev === 'lobby' || (prev === 'countdown' && phase !== 'lobby')) matchStars = 0;
  }

  function roundOver() {
    const sync = online.sync;
    const R = sync.R;
    const me = sync.mySeat;
    if (!R || me < 0) return;
    const ranking = online.match.last?.ranking ?? sync.ranking();
    const myId = online.room.me.id;
    const won = !!ranking[0] && ranking[0].length === 1 && ranking[0][0] === myId;
    const st = R.stats[me];
    const glassLeft = R.houses[me].outAt >= 0 ? 0 : glassCount(R.houses[me].panes);
    const res = applyRound(profile, { street: sync.data.street, won, glassLeft, broke: st.broke, lost: st.lost, intercepts: st.intercepts, bonks: st.bonks, gnomeDouble: st.gnomeDouble });
    res.profile.hints = { ...profile.hints, ...res.profile.hints };
    profile = res.profile;
    matchStars += res.stars;
    saveProfile();
    award(res.badges);
    submit('rounds-won', profile.roundsWon);
    submit('panes', profile.panes);
    submit('stars', totalStars(profile));
    if (won) sound.win(false);
  }

  function matchOver(standings, mine) {
    if (!mine) return;
    const res = applyMatch(profile, mine.place === 1);
    profile = res.profile;
    saveProfile();
    award(res.badges);
    if (mine.place === 1) sound.win(true);
    else sound.lose();
  }

  // ------------------------------------------------------------------ the pause card
  function openPauseCard() {
    if (!online) return;
    const room = online.room;
    const canPause = (room.kind === 'private' && room.isHost) || room.kind === 'solo';
    const buttons = [{ label: 'Resume', main: true, on: resume }];
    if (canPause && !online.match.paused) {
      buttons.push({
        label: 'Pause',
        on: () => {
          try {
            room.pauseMatch(true);
            pausedByMe = true;
          } catch {
            /* the room says no */
          }
          ui.card({ msg: 'Paused', buttons: [{ label: 'Resume', main: true, on: resume }] });
        },
      });
    }
    input.setActive(false);
    ui.card({ msg: '', buttons });
  }

  function resume() {
    ui.card(null);
    if ((pausedByMe || pausedByHide) && online) {
      try {
        online.room.pauseMatch(false);
      } catch {
        /* fine */
      }
    }
    pausedByMe = false;
    pausedByHide = false;
    sound.click();
    if (online?.match.phase === 'round' && !autoplay) {
      input.setActive(true);
      input.requestLock();
    }
  }

  document.addEventListener('visibilitychange', () => {
    const ctx = audioContext();
    if (document.hidden) {
      ctx?.suspend?.().catch?.(() => {});
      const room = online?.room;
      if (room && online.match.phase === 'round' && (room.kind === 'solo' || (room.kind === 'private' && room.isHost && room.online.length <= 1))) {
        try {
          room.pauseMatch(true);
          pausedByHide = true;
        } catch {
          /* fine */
        }
      }
    } else {
      ctx?.resume?.().catch?.(() => {});
      if (pausedByHide) openPauseCard();
    }
  });

  // ------------------------------------------------------------------ what happens, as sound and shards
  const camRight = new THREE.Vector3();
  function spatial(x, y, z) {
    tmp.set(x - camera.position.x, y - camera.position.y, z - camera.position.z);
    const d = tmp.length();
    const pan = d > 0.01 ? Math.max(-1, Math.min(1, tmp.dot(camRight) / d)) : 0;
    return { d, pan };
  }
  const paneTmp = new THREE.Vector3();
  const snowy = () => STREETS[W.index]?.light === 'snow';

  function onEvent(e, R, me, isTitle) {
    switch (e.type) {
      case 'throw': {
        if (e.seat === me) {
          const s = R.stones.find((x) => x.id === e.id);
          sound.throw(s ? Math.min(1, Math.hypot(s.vx, s.vy, s.vz) / 30) : 0.6);
        } else {
          const s = spatial(e.x, e.y, e.z);
          const st = R.stones.find((x) => x.id === e.id);
          const incoming = me >= 0 && st && (st.predHouse === me || st.predBody === me) && st.pred !== 'ground';
          sound.whoosh(s.d, s.pan, !!incoming);
          if (e.kind === 'gnome') sound.wheee(s.d, s.pan);
        }
        break;
      }
      case 'break': {
        const dir = e.vx !== undefined ? { x: e.vx, y: e.vy, z: e.vz } : null;
        if (e.panes?.length) {
          W.glass.paneWorld(e.house, e.panes[0], paneTmp);
          const s = spatial(paneTmp.x, paneTmp.y, paneTmp.z);
          for (const p of e.panes) W.glass.burst(e.house, p, dir, e.kind === 'brick' ? 1.25 : 1, s.d);
          // A flash at the pane: a break reads from across the street.
          W.fx.glint(paneTmp.x, paneTmp.y, paneTmp.z, 1.6 + Math.min(2.4, s.d / 10));
          sound.shatter(s.d, s.pan, e.house === me, e.panes.length);
          if (breakLog && breakLog.length < 200) breakLog.push({ house: e.house, by: e.by, panes: e.panes.length, d: Math.round(s.d) });
          if (s.d < 9) trauma = Math.min(1, trauma + 0.12);
        }
        if (e.cracked >= 0 && !e.panes?.length) {
          W.glass.paneWorld(e.house, e.cracked, paneTmp);
          const s = spatial(paneTmp.x, paneTmp.y, paneTmp.z);
          sound.crack(s.d, s.pan);
        }
        if (e.house === me && me >= 0 && e.panes?.length && !isTitle) hitMe(e.by, e.panes.length);
        break;
      }
      case 'crack': {
        const s = spatial(e.x, e.y, e.z);
        sound.crack(s.d, s.pan);
        W.fx.glint(e.x, e.y, e.z, 0.8);
        break;
      }
      case 'clunk': {
        const s = spatial(e.x, e.y, e.z);
        sound.clunk(s.d, s.pan, e.what);
        W.fx.land(e.x, e.y, e.z, 0, 0, e.what);
        break;
      }
      case 'inside': {
        const s = spatial(e.x, e.y, e.z);
        sound.clunk(s.d, s.pan, 'inside');
        break;
      }
      case 'land':
      case 'skip': {
        const s = spatial(e.x, e.y, e.z);
        sound.thud(s.d, s.pan, snowy());
        W.fx.land(e.x, e.y, e.z, e.vx ?? 0, e.vz ?? 1, e.what ?? 'ground');
        break;
      }
      case 'gone':
        if (e.what === 'sea') W.fx.puff(e.x, -0.2, e.z, '#FFFFFF', 2.2, 1.1, 0, 2, 0);
        break;
      case 'clack': {
        const s = spatial(e.x, e.y, e.z);
        sound.clack(s.d, s.pan);
        W.fx.clack(e.x, e.y, e.z);
        break;
      }
      case 'bonk': {
        const s = spatial(e.x, e.y, e.z);
        sound.bonk(s.d, s.pan, e.seat === me);
        W.fx.glint(e.x, e.y, e.z, 1.3);
        if (e.seat === me && !isTitle) trauma = Math.min(1, trauma + 0.6);
        break;
      }
      case 'poof':
        W.fx.poof(e.x, e.y, e.z, OWNERS[e.seat % OWNERS.length].color);
        break;
      case 'out': {
        const h = W.field.houses[e.house];
        const s = spatial(h.cx, h.elev + 3, h.cz);
        sound.fall(s.d, s.pan, e.house === me);
        W.fx.dust(h.cx + h.fx * 1.5, h.elev + 0.5, h.cz + h.fz * 1.5, 12, '#E8DCC8');
        if (isTitle) {
          title.shot = e.house;
          title.shotUntil = performance.now() + 3600;
        } else if (e.house === me) {
          outBannerUntil = performance.now() + 2600;
          ghostHintAt = performance.now() + 2800;
          trauma = Math.min(1, trauma + 0.5);
        }
        break;
      }
      case 'glaze': {
        W.glass.paneWorld(e.house, e.pane, paneTmp);
        const s = spatial(paneTmp.x, paneTmp.y, paneTmp.z);
        sound.ting(s.d);
        W.fx.glint(paneTmp.x, paneTmp.y, paneTmp.z, 1.4);
        break;
      }
      case 'glazed':
      case 'unbreak':
        W.glass.paneWorld(e.house, e.pane, paneTmp);
        W.fx.glint(paneTmp.x, paneTmp.y, paneTmp.z, 1);
        break;
      case 'grab':
        if (e.seat === me && !isTitle) {
          sound.grab(e.kind);
          once(e.kind === 'brick' ? 'brick' : 'gnome', e.kind === 'brick' ? 'Brick: breaks 3' : 'Gnome: breaks 2', 2400);
        } else W.fx.dust(e.x, R.field.groundY(e.x, e.z) + 0.2, e.z, 4, '#E8DCC8');
        break;
      case 'special':
        W.fx.dust(e.x, R.field.groundY(e.x, e.z) + 0.2, e.z, 6, '#E8DCC8');
        if (!isTitle && me >= 0 && (e.a === me || e.b === me) && !R.bodies[me].ghost) once('grab', 'Grab it!', 2200);
        break;
      case 'fizzle':
        W.fx.dust(e.x, R.field.groundY(e.x, e.z) + 0.2, e.z, 6, '#E8DCC8');
        break;
      default:
        break;
    }
  }

  /** A hint the player sees once, ever. */
  function once(id, text, ms) {
    if (profile.hints[id]) return false;
    profile.hints[id] = true;
    ui.hint(text, ms);
    return true;
  }

  function hitMe(by, n) {
    trauma = Math.min(1, trauma + 0.25 + 0.1 * n);
    ui.flash(reduced());
    if (by >= 0 && by !== online?.sync.mySeat) {
      attackerSeat = by;
      attackerUntil = performance.now() + 1500;
    }
    once('keep', 'Keep yours', 1600);
  }

  // ------------------------------------------------------------------ the title's live street
  function newTitleRound() {
    title.seed = (title.seed * 48271 + 7) % 2147483647;
    title.R = createSimRound(0, title.seed, { personas: ['walt', 'ray', 'rosa', 'bev', 'twins', 'chad'], round: 2 });
    // Start where the stones are already flying.
    const R = title.R;
    while (R.now < 9000) R.stepTick();
    R.events.length = 0;
    title.ms = R.now;
    title.endAt = 0;
    title.shot = -1;
  }

  function stepTitle(dt) {
    if (!title.R || (title.endAt && performance.now() > title.endAt)) newTitleRound();
    const R = title.R;
    show(`title:${title.seed}`, () => {
      W.setStreet(0);
      W.sweep();
      W.cast(R.seats.map((s) => s.persona));
    });
    title.ms += dt * 1000;
    R.advanceTo(title.ms);
    if (!title.endAt && (R.alive() <= 1 || R.now > ROUND_MS - 1000)) {
      R.over = true;
      title.endAt = performance.now() + 4500;
    }
    return R;
  }

  // ------------------------------------------------------------------ the lobby's street
  function lobbyRound() {
    const street = online ? online.street : 0;
    const players = lobbyPlayers();
    const key = `${street}|${players.length}`;
    if (lobby.key !== key || !lobby.R) {
      lobby.key = key;
      lobby.R = createRound({ field: buildField(street), seed: 1, round: 1, seats: lineupSeats(street), host: false });
    }
    show(`lobby:${key}`, () => {
      W.setStreet(street);
      W.sweep();
      const personas = [];
      for (let i = 0; i < SEATS; i++) personas.push(i < players.length ? 'player' : STREETS[street].lineup[i - players.length] ?? 'walt');
      W.cast(personas);
    });
    return lobby.R;
  }

  function lobbyMe() {
    const i = lobbyPlayers().findIndex((p) => p.me);
    return i >= 0 ? i : 0;
  }

  // ------------------------------------------------------------------ the camera
  function lookAtSmooth(pos, look, dt, rate = 2.5) {
    const k = 1 - Math.exp(-dt * rate);
    camPos.lerp(pos, k);
    camLook.lerp(look, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }
  function orbit(R, t, dt, high = false) {
    // A slow crane round the green, inside the ring of lawns, looking across at the far houses.
    const f = R.field;
    const a = t * 0.00005 + 0.6;
    const r = f.R * (high ? 0.62 : 0.5);
    tv.set(Math.cos(a) * r, (high ? 13 : 6.5) + Math.sin(t * 0.00013) * 1.2, Math.sin(a) * r);
    tl.set(-Math.cos(a - 0.35) * f.R * 0.75, 3.2, -Math.sin(a - 0.35) * f.R * 0.75);
    lookAtSmooth(tv, tl, dt, 1.5);
  }

  /** The trailer's stone camera: rides behind a stone headed for glass (yours first), then watches it land. */
  function stoneCam(R, me, now, dt) {
    let s = null;
    for (const o of R.stones) if (o.id === camStone && o.alive) s = o;
    if (!s && now > camHoldUntil) {
      let score = -Infinity;
      for (const o of R.stones) {
        if (!o.alive || o.kind === 'pebble' || o.pred !== 'glass' || o.pendingUntil !== undefined || o.y < 1) continue;
        const v = (o.seat === me ? 1e6 : 0) + o.born;
        if (v > score) {
          score = v;
          s = o;
        }
      }
      if (s) {
        camStone = s.id;
        const h = Math.hypot(s.vx, s.vz) || 1;
        camPos.set(s.x - (s.vx / h) * 4.5 - (s.vz / h) * 1.6, s.y + 1.3, s.z - (s.vz / h) * 4.5 + (s.vx / h) * 1.6);
        camLook.set(s.x + s.vx * 0.35, s.y + s.vy * 0.35, s.z + s.vz * 0.35);
      }
    }
    if (s) {
      camHoldUntil = now + 1300;
      const h = Math.hypot(s.vx, s.vz) || 1;
      // Behind it and a little to its right: the thrower stays out of the lens.
      tv.set(s.x - (s.vx / h) * 4.5 - (s.vz / h) * 1.6, s.y + 1.3, s.z - (s.vz / h) * 4.5 + (s.vx / h) * 1.6);
      tl.set(s.x + s.vx * 0.3, s.y + s.vy * 0.3, s.z + s.vz * 0.3);
      // It stops a few strides short of the glass and watches the stone go in, the whole front in view.
      const hh = R.field.houses[s.predHouse];
      if (hh && (tv.x - hh.cx) * hh.fx + (tv.z - hh.cz) * hh.fz < 6) tv.copy(camPos);
      stoneLast.set(s.x, s.y, s.z);
      lookAtSmooth(tv, tl, dt, 9);
    } else {
      // Between stones the camera stays put and turns to where the last one went.
      tv.copy(camPos);
      lookAtSmooth(tv, stoneLast, dt, 5);
    }
  }

  /** The standing house with the least glass, not yours (-1 when there's none). */
  function weakest(R, me) {
    let h = -1;
    for (let i = 0; i < R.houses.length; i++) {
      if (i === me || R.houses[i].outAt >= 0 || R.glass(i) <= 0) continue;
      if (h < 0 || R.glass(i) < R.glass(h)) h = i;
    }
    return h;
  }

  function houseShot(R, h, t, dt, push = 0) {
    const hh = R.field.houses[h];
    const d = 15 - push * 5;
    const side = Math.sin(t * 0.0003) * 2.5;
    tv.set(hh.cx + hh.fx * d + hh.rx * side, hh.elev + 3.2 + push, hh.cz + hh.fz * d + hh.rz * side);
    tl.set(hh.cx, hh.elev + 2.6, hh.cz);
    lookAtSmooth(tv, tl, dt, 2);
  }

  function lobbyCam(R, t, dt, mine) {
    const f = R.field;
    const a = f.houses[mine].angle + Math.sin(t * 0.00012) * 0.06;
    // Above and behind your house: your lawn and its sign at the bottom, the whole street across.
    const portrait = stage.height > stage.width;
    const back = portrait ? 1.45 : 1.25;
    tv.set(Math.cos(a) * f.R * back, f.R * (portrait ? 1.85 : 1.5), Math.sin(a) * f.R * back);
    tl.set(-Math.cos(a) * f.R * 0.12, 0, -Math.sin(a) * f.R * 0.12);
    lookAtSmooth(tv, tl, dt, 2);
  }

  function firstPerson(R, me, t, dt, isAuto) {
    const b = R.bodies[me];
    const yaw = isAuto ? b.yaw : input.yaw;
    const pitch = isAuto ? b.pitch : input.pitch;
    if (b.ghost) camera.position.set(b.gx, b.gy, b.gz);
    else {
      const speed = Math.hypot(b.vx, b.vz);
      camera.position.set(b.x, b.y + EYE + Math.sin(t / 95) * Math.min(0.03, speed * 0.008), b.z);
    }
    let roll = 0;
    if (b.stunUntil > R.now && !reduced()) roll = Math.sin(t / 70) * 0.07;
    camera.rotation.set(pitch, yaw, roll);
    camPos.copy(camera.position);
    camera.getWorldDirection(tmp);
    camLook.copy(camera.position).addScaledVector(tmp, 10);
  }

  function chase(R, me, dt) {
    const b = R.bodies[me];
    const x = b.ghost ? b.gx : b.x;
    const y = b.ghost ? b.gy : b.y + EYE;
    const z = b.ghost ? b.gz : b.z;
    tv.set(x + Math.sin(b.yaw) * 4.2 + Math.cos(b.yaw) * 1.2, y + 1.6, z + Math.cos(b.yaw) * 4.2 - Math.sin(b.yaw) * 1.2);
    tl.set(x - Math.sin(b.yaw) * 12, y + Math.sin(b.pitch) * 8, z - Math.cos(b.yaw) * 12);
    lookAtSmooth(tv, tl, dt, 6);
  }

  function shake(t) {
    if (reduced() || trauma <= 0) return;
    const s = trauma * trauma;
    camera.rotation.x += s * 0.045 * Math.sin(t / 37);
    camera.rotation.y += s * 0.045 * Math.sin(t / 43 + 1.3);
    camera.rotation.z += s * 0.03 * Math.sin(t / 29 + 2.1);
  }

  // ------------------------------------------------------------------ the arc
  function drawArc(R, me) {
    const b = R.bodies[me];
    if (!b || !b.winding || b.away || R.over) {
      W.fx.hideArc();
      return;
    }
    const kind = b.ghost ? 'pebble' : b.held ?? 'stone';
    if (b.ghost) {
      tmpO.x = b.gx;
      tmpO.y = b.gy - 0.2;
      tmpO.z = b.gz;
    } else handOf(b.x, b.y, b.z, b.yaw, tmpO);
    velocityOf(kind, b.yaw, b.pitch, b.power, tmpV);
    arcN = 0;
    const end = tracePath(R.field, kind, tmpO, tmpV, NO_WIND, R.panesOf, R.bodies, 4, 1 / 60, onArcPoint, me);
    // Skip the first few steps (they'd fill the view), then 64 dots spread along the rest.
    const from = Math.min(4, Math.max(0, arcN - 2));
    const span = arcN - from;
    const n = Math.max(0, Math.min(64, span));
    for (let k = 0; k < n; k++) {
      const i = from + Math.floor((k / Math.max(1, n - 1)) * (span - 1));
      arcPts[k * 3] = arcBuf[i * 3];
      arcPts[k * 3 + 1] = arcBuf[i * 3 + 1];
      arcPts[k * 3 + 2] = arcBuf[i * 3 + 2];
    }
    W.fx.arc(arcPts, n, end, kind);
  }

  // ------------------------------------------------------------------ the house plates over the street
  const plateList = [];
  for (let i = 0; i < SEATS; i++) plateList.push({ i, x: 0, y: 0, edge: false, n: 20, out: false, name: '', lead: false, away: false, visible: false });
  const edgeLeft = [];
  const edgeRight = [];

  function project(x, y, z, out) {
    tmp.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    out.cx = tmp.x;
    out.cz = tmp.z;
    if (tmp.z > -0.5) {
      out.on = false;
      return out;
    }
    tmp.applyMatrix4(camera.projectionMatrix);
    out.x = ((tmp.x + 1) / 2) * stage.width;
    out.y = ((1 - tmp.y) / 2) * stage.height;
    out.on = true;
    return out;
  }
  const proj = { x: 0, y: 0, cx: 0, cz: 0, on: false };

  function housePlates(R, me, firstP, now) {
    const sync = online?.sync;
    const Wd = stage.width;
    const Hd = stage.height;
    const top = ui.safeTop + 120;
    let best = -1;
    let bestN = -1;
    let tie = false;
    for (let i = 0; i < R.houses.length; i++) {
      const h = R.houses[i];
      const n = h.outAt >= 0 ? 0 : glassCount(h.panes);
      if (n > bestN) {
        bestN = n;
        best = i;
        tie = false;
      } else if (n === bestN) tie = true;
    }
    edgeLeft.length = 0;
    edgeRight.length = 0;
    for (let i = 0; i < SEATS; i++) {
      const p = plateList[i];
      const h = R.houses[i];
      const hh = R.field.houses[i];
      if (!h || (firstP && i === me)) {
        p.visible = false;
        continue;
      }
      p.visible = true;
      p.n = h.outAt >= 0 ? 0 : glassCount(h.panes);
      p.out = p.n === 0;
      p.lead = i === best && !tie && bestN > 0;
      const seat = sync?.seats[i];
      p.name = seat?.name ?? R.seats[i]?.name ?? '';
      p.away = !!seat && !seat.bot && (seat.away || seat.left);
      project(hh.cx - hh.fx * 1.5, hh.elev + ROOF_Y + ROOF_T + 1.4, hh.cz - hh.fz * 1.5, proj);
      const margin = 46;
      if (proj.on && proj.x > margin && proj.x < Wd - margin && proj.y > top - 60 && proj.y < Hd * 0.82) {
        p.edge = false;
        p.x = proj.x;
        p.y = Math.max(top - 60 + 30, proj.y);
      } else {
        p.edge = true;
        (proj.cx >= 0 ? edgeRight : edgeLeft).push(p);
        p.sortKey = proj.on ? proj.y : -proj.cz;
      }
    }
    for (const [list, x] of [
      [edgeLeft, 64],
      [edgeRight, Wd - 64],
    ]) {
      list.sort((a, b) => a.sortKey - b.sortKey);
      list.forEach((p, k) => {
        p.x = x;
        p.y = top + k * 44;
      });
    }
    ui.houses(plateList, now);
  }

  // ------------------------------------------------------------------ the loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const match = online?.match ?? null;
    // Readied from the platform's own strip (or a match this page is part of began): straight in from the title.
    if (screen === 'title' && match && match.phase !== 'lobby' && match.phase !== 'results' && (match.me || online.room.me?.ready)) pressPlay();
    const phase = screen === 'title' ? 'title' : match?.phase ?? 'lobby';
    const flow = phase === 'title' ? 'title' : phase === 'lobby' || phase === 'countdown' || phase === 'roundEnd' || phase === 'results' ? phase : 'playing';
    if (flow !== lastFlow) {
      lastFlow = flow;
      document.body.dataset.flow = flow;
    }
    const sync = online?.sync ?? null;
    const live = screen === 'game' && sync?.R && (phase === 'intro' || phase === 'round' || phase === 'roundEnd' || phase === 'results');
    let R;
    let me = -1;
    const isTitle = screen === 'title';
    if (isTitle) R = stepTitle(dt);
    else if (live) {
      R = sync.R;
      me = sync.mySeat;
      show(`round:${sync.key}`, () => setupRound(R, sync.data));
    } else R = lobbyRound();

    // This player's hands on their body, then the round runs to the match clock.
    const playing = !isTitle && phase === 'round' && me >= 0 && R === sync?.R;
    const active = playing && !autoplay && !ui.cardOpen && !menuOpen && !match?.paused;
    input.setActive(active);
    if (playing && !autoplay) input.apply(R.bodies[me].input, null);
    setControls(active);
    try {
      online?.frame(dt, now);
    } catch (err) {
      console.error('[glass-houses] frame', err);
    }
    // Events of a round nobody draws (still on the title) aren't kept.
    if (sync?.R && sync.R !== R) sync.R.events.length = 0;

    // Camera.
    const mine = me >= 0 ? R.bodies[me] : null;
    const cam = camOverride;
    let firstP = false;
    if (isTitle) {
      if (title.shot >= 0 && now < title.shotUntil) houseShot(R, title.shot, now, dt, 1 - (title.shotUntil - now) / 3600);
      else orbit(R, now, dt);
    } else if (phase === 'lobby') lobbyCam(R, now, dt, lobbyMe());
    else if (phase === 'countdown') {
      // Down from above onto your lawn.
      const f = R.field;
      const hh = f.houses[lobbyMe()];
      const k = 1 - Math.max(0, Math.min(1, (match.countdown ?? 0) / 3));
      const e = k * k * (3 - 2 * k);
      tv.set(Math.cos(hh.angle) * f.R * (1.0 - 0.25 * e), f.R * 1.4 * (1 - e) + (hh.elev + EYE) * e, Math.sin(hh.angle) * f.R * (1.0 - 0.25 * e));
      tl.set(-Math.cos(hh.angle) * f.R * 0.3 * (1 + e), 2 * e, -Math.sin(hh.angle) * f.R * 0.3 * (1 + e));
      lookAtSmooth(tv, tl, dt, 4);
    } else if ((phase === 'intro' || phase === 'round') && mine) {
      if (cam === 'chase') chase(R, me, dt);
      else if (cam === 'orbit') orbit(R, now, dt, true);
      else if (cam === 'stone') stoneCam(R, me, now, dt);
      else if (cam === 'weak') {
        if (camHouse < 0 || camHouse >= R.houses.length || camHouse === me) camHouse = weakest(R, me);
        if (camHouse >= 0) {
          // Three-quarters on from the lawn, close enough to see each pane go.
          const hh = R.field.houses[camHouse];
          tv.set(hh.cx + hh.fx * 7.5 + hh.rx * 5, hh.elev + 1.7, hh.cz + hh.fz * 7.5 + hh.rz * 5);
          tl.set(hh.cx - hh.rx * 1.5, hh.elev + 2.6, hh.cz - hh.rz * 1.5);
          lookAtSmooth(tv, tl, dt, 3);
        }
        else orbit(R, now, dt, true);
      } else {
        firstPerson(R, me, now, dt, autoplay);
        firstP = true;
      }
    } else if (phase === 'roundEnd' || phase === 'results') {
      const ranking = match.last?.ranking ?? sync?.ranking() ?? [];
      const winId = phase === 'results' ? match.results?.[0]?.id : ranking[0]?.length === 1 ? ranking[0][0] : null;
      const h = winId ? sync.seatOf(winId) : -1;
      if (h >= 0) houseShot(R, h, now, dt, phase === 'results' ? 0.8 : 0.3);
      else orbit(R, now, dt);
    } else orbit(R, now, dt, true);
    shake(now);
    trauma = Math.max(0, trauma - dt * 1.3);
    camera.updateMatrixWorld();
    camRight.set(Math.cos(camera.rotation.y), 0, -Math.sin(camera.rotation.y));

    // The street.
    for (const e of R.events) onEvent(e, R, me, isTitle);
    R.events.length = 0;
    W.me = me;
    W.hideMe = firstP;
    W.ghostsOff = !!R.over || phase === 'roundEnd' || phase === 'results';
    const wind = R.windNow();
    W.draw(R, dt, now, wind);
    if (!isTitle && phase === 'lobby') {
      const players = lobbyPlayers();
      let sig = '';
      for (let i = 0; i < SEATS; i++) {
        W.street.setPorch(i, !!players[i]?.ready);
        sig += players[i]?.ready ? '1' : '0';
      }
      // A porch light switching on (or off) is someone readying.
      if (porchSig && sig !== porchSig) sound.porch(sig.split('1').length > porchSig.split('1').length);
      porchSig = sig;
    } else {
      porchSig = '';
      for (let i = 0; i < SEATS; i++) W.street.setPorch(i, false);
    }
    // The hardware store shutting: its bell, once, as it happens.
    const storeOpen = R.storeOpen();
    if (live && phase === 'round' && storeWasOpen && !storeOpen && R.now < STORE_CLOSE_MS + 1000) sound.bell();
    storeWasOpen = storeOpen;
    if (arm) {
      arm.group.visible = firstP && !!mine && !(mine.ghost && mine.pebbles <= 0);
      if (arm.group.visible) arm.update(mine, R.now, dt, mine.ghost);
    }
    if (mine && (firstP || cam) && playing) drawArc(R, me);
    else W.fx.hideArc();

    // Sound that follows state.
    if (mine && playing) {
      sound.windup(mine.winding ? mine.power : 0);
      if (mine.repairing && now > squeakAt) {
        squeakAt = now + 320;
        sound.squeak(0);
      }
    } else sound.windup(0);
    ambience(wind.s, dt, { night: STREETS[W.index]?.light === 'night', snow: snowy(), quiet: isTitle });
    if (!isTitle) {
      let mode = 'menu';
      if (phase === 'round' || phase === 'intro') {
        const alive = R.alive();
        mode = alive <= 2 ? 'frantic' : alive <= 3 ? 'tense' : R.now >= STORE_CLOSE_MS ? 'late' : 'play';
      }
      music.set(mode);
    }

    hud(R, me, phase, match, now, firstP);
    stage.render(now / 1000);
  }

  // ------------------------------------------------------------------ the HUD for this moment
  function hud(R, me, phase, match, now, firstP) {
    ui.tick(now);
    if (screen === 'title') {
      ui.show('title');
      ui.banner('', null);
      ui.standings(null);
      return;
    }
    if (!online) {
      ui.show('none');
      return;
    }
    const sync = online.sync;
    const room = online.room;
    // Standings: after a round (the match so far), the results, and the lobby after them.
    const results = match.results;
    if (phase === 'roundEnd' || phase === 'results' || (phase === 'lobby' && results)) {
      const list = phase === 'roundEnd' ? match.standings : results ?? match.standings;
      const tl = online.tally();
      const rows = (list ?? []).slice(0, SEATS).map((s) => ({
        place: s.place,
        name: s.name,
        points: s.points,
        panes: tl[s.id]?.broke ?? 0,
        owner: Math.max(0, sync.ids.indexOf(s.id)),
        me: s.id === room.me.id,
        stars: s.id === room.me.id && phase !== 'roundEnd' ? matchStars : 0,
      }));
      ui.standings(rows, phase === 'roundEnd' ? `Round ${match.round}` : 'Standings');
    } else ui.standings(null);

    if (phase === 'lobby') {
      ui.show('lobby');
      const players = lobbyPlayers();
      const street = online.street;
      const signs = [];
      const f = R.field;
      for (let i = 0; i < SEATS; i++) {
        const hh = f.houses[i];
        const p = players[i];
        const lp = project(hh.spawn.x, hh.elev + 2.4, hh.spawn.z, proj);
        signs.push({
          x: lp.x,
          y: lp.y,
          visible: lp.on && lp.x > 30 && lp.x < stage.width - 30 && lp.y > 60 && lp.y < stage.height - 40,
          name: p ? p.name : PERSONAS[STREETS[street].lineup[i - players.length]]?.name ?? '',
          owner: i,
          ready: !!p?.ready,
          you: !!p?.me,
          host: !!p?.host && room.kind !== 'public',
        });
      }
      ui.lobby({
        street,
        unlocked: unlockedCount(profile),
        ladder: players.length <= 1,
        pick: online.isHost,
        stars: profile.stars,
        rounds: online.rounds,
        go: showOwnReady(),
        goLabel: players.find((p) => p.me)?.ready && room.kind !== 'solo' ? 'Not ready' : 'Ready',
        signs,
      });
      ui.banner('', null);
      // Alone as host, the street last picked comes back once.
      if (!pickedOnce && profileLoaded && online.isHost && players.length <= 1) {
        pickedOnce = true;
        if (profile.street !== street && profile.street < unlockedCount(profile)) pickStreet(profile.street);
      }
      // (A room of one counts its host as ready already: it still has to start.)
      if (autoplay && now - readyAskedAt > 1500 && (room.kind === 'solo' || !players.find((p) => p.me)?.ready)) {
        readyAskedAt = now;
        const want = Number(params.get('street'));
        if (want >= 1 && want <= STREET_COUNT && online.isHost && online.street !== want - 1) online.setSetting('street', want);
        const rounds = Number(params.get('rounds'));
        if ([1, 3, 5].includes(rounds) && online.isHost && online.rounds !== rounds) online.setSetting('rounds', rounds);
        online.ready(true);
      }
      return;
    }
    if (phase === 'countdown') {
      ui.show('none');
      const n = Math.max(1, Math.ceil(match.countdown ?? 0));
      if (n !== lastCount) {
        lastCount = n;
        sound.count(n);
      }
      ui.banner(`cd${n}`, [{ t: String(n), size: 'big', drop: true }]);
      return;
    }
    lastCount = -1;
    if (phase === 'roundEnd' || phase === 'results') {
      ui.show('none');
      ui.watch(null);
      if (phase === 'roundEnd') {
        const ranking = match.last?.ranking ?? sync.ranking();
        const top = ranking[0] ?? [];
        let t;
        if (top.length !== 1) t = 'A tie';
        else if (top[0] === room.me.id) t = 'Your house stands';
        else {
          const name = match.seats.find((s) => s.id === top[0])?.name ?? 'A neighbour';
          t = `${name}${name.endsWith('s') ? "'" : "'s"} house stands`;
        }
        ui.banner(`re${match.round}${t}`, [{ t, size: 'mid', drop: true }]);
      } else {
        const win = match.results?.[0];
        const t = !win ? 'Results' : win.id === room.me.id ? 'You win' : `${win.name} wins`;
        ui.banner(`rs${t}`, [{ t, size: 'mid', drop: true }]);
      }
      return;
    }
    // Intro and round.
    ui.show('play');
    if (!sync.R || R !== sync.R) return;
    const elapsed = phase === 'round' ? R.now : 0;
    ui.clock(elapsed);
    const wind = R.wind;
    const yaw = camera.rotation.y;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    ui.wind(Math.atan2(wind.x * rx + wind.z * rz, wind.x * fx + wind.z * fz), wind.s);
    housePlates(R, me, firstP, now);
    const b = me >= 0 ? R.bodies[me] : null;
    if (b) {
      const h = R.houses[me];
      const out = h.outAt >= 0 || glassCount(h.panes) === 0;
      ui.mine({ owner: me, n: out ? 0 : glassCount(h.panes), out, ghost: b.ghost, ammo: b.ammo, held: b.held, pebbles: b.pebbles, repair: b.repairing ? Math.min(1, b.repairMs / REPAIR_MS) : 0 });
      ui.watch(null);
    } else {
      ui.mine(null);
      const full = match.seats.filter((s) => !s.bot).length >= SEATS;
      ui.watch(full ? 'Next match' : 'Next round');
    }
    ui.reticle(firstP && !!b);
    const touch = input.touch || !!ow?.controls?.touch;
    const active = phase === 'round' && b && !autoplay;
    ui.keyhint(active && !touch && !ui.cardOpen ? (input.locked ? 'Esc' : input.lockFailed ? null : 'Click') : null);

    // Banners: the round's name, your house falling.
    if (phase === 'intro') {
      const s = STREETS[sync.data.street];
      ui.banner(`in${match.round}`, [
        { t: `Round ${match.round}`, size: 'mid', drop: true },
        { t: s.name, size: 'blade' },
      ]);
    } else if (now < outBannerUntil) ui.banner('out', [{ t: 'Your house is out', size: 'mid', drop: true }]);
    else ui.banner('', null);

    // Hints at the moment they matter.
    if (active && b && !b.ghost) {
      if (!profile.hints.throw && R.now > 2600) {
        if (b.winding) {
          profile.hints.throw = true;
          once('release', 'Let go to throw', 1400);
        } else ui.hint(touch ? 'Hold Throw' : 'Hold to wind up', 400);
      }
      const n = glassCount(R.houses[me].panes);
      if (n <= 17 && R.storeOpen() && !b.repairing) once('repair', touch ? 'Hold Repair' : 'Hold R to repair', 2400);
    }
    if (b && b.ghost && ghostHintAt && now > ghostHintAt) {
      ghostHintAt = 0;
      once('ghost', 'Pebbles crack glass', 2400);
    }

    // The arrow at whoever just broke your glass.
    if (attackerSeat >= 0 && now < attackerUntil && b) {
      const a = R.bodies[attackerSeat];
      const ax = a.ghost ? a.gx : a.x;
      const ay = a.ghost ? a.gy : a.y + 1.4;
      const az = a.ghost ? a.gz : a.z;
      // Its bearing from where you look: ahead is the top edge, behind the bottom.
      tmp.set(ax, ay, az).applyMatrix4(camera.matrixWorldInverse);
      const angle = Math.atan2(tmp.x, -tmp.z);
      const rxE = stage.width / 2 - 44;
      const ryE = stage.height / 2 - 70;
      ui.attacker(stage.width / 2 + Math.sin(angle) * rxE, stage.height / 2 - Math.cos(angle) * ryE, angle, OWNERS[attackerSeat % OWNERS.length].color);
    } else ui.attackerOff();
  }

  // Debug hooks for the trailer's capture (local only).
  if (LOCAL || ow?.mode === 'standalone') {
    if (params.get('hush') === '1') hush(true);
    window.__glass = {
      hush,
      /** The breaks seen since the last call. */
      breaks: () => (breakLog ? breakLog.splice(0) : []),
      /** Standing houses. */
      get alive() {
        return online?.sync?.R?.alive() ?? 0;
      },
      cam: (m) => {
        camOverride = m || '';
        camHouse = -1;
      },
      get phase() {
        return online?.match.phase ?? 'none';
      },
      /** The round's clock (ms). */
      get t() {
        return online?.sync?.R?.now ?? 0;
      },
      /** Draw calls in the last frame (shadows included). */
      get calls() {
        return stage.renderer.info.render.calls;
      },
    };
  }

  ui.title({ stars: 0, total: STREET_COUNT * 3 });
  booted = true;
  if (wantPlay) pressPlay();
  requestAnimationFrame(frame);
}
