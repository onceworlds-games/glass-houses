// The page: joins the street's server as it loads, draws the title's live street, the lobby, the rounds in first person and the
// results, and turns what happens into sound, shards and shake. Store pictures (?poster=) go to poster.js instead.

import './style.css';
import '@fontsource/josefin-sans/latin-700.css';
import '@fontsource/jost/latin-500.css';
import '@fontsource/abril-fatface/latin-400.css';
import * as THREE from 'three';
import { createStage } from './view/stage.js';
import { createWorld } from './view/world.js';
import { makeArm } from './view/people.js';
import { loadRigs } from './view/rig.js';
import { createInput } from './view/input.js';
import { createUI } from './view/ui.js';
import { createFeel } from './view/feel.js';
import { createCareerUI } from './view/career-ui.js';
import { gazetteOf, dateline } from './view/words.js';
import { makeThumbs, thumb, FOCUS } from './view/thumbs.js';
import { SHAPE } from './view/particles.js';
import { startAudio, audioContext, sound, ambience, hush } from './view/audio.js';
import { music } from './view/music.js';
import { OWNERS } from './view/palette.js';
import { joinRoom, createOnline } from './online.js';
import { createSimRound, lineupSeats } from './core/sim.js';
import { createRound, glassCount, rankHouses } from './core/round.js';
import { buildField, STREETS, STREET_COUNT } from './core/streets.js';
import { tracePath, NO_WIND, handOf, velocityOf } from './core/physics.js';
import { PERSONAS, personaByName, createBrain } from './core/bots.js';
import { readProfile, applyRound, applyMatch, unlockedCount, totalStars, jobsToday, streakToday, wear, unseenLooks } from './core/progress.js';
import { TRICKS, XP, PERSONA_LOOKS, lookCode, lookFromCode, levelFor, wallOf } from './core/career.js';
import { dailyOf, dayOf } from './core/twists.js';
import { ROUND_MS, STORE_CLOSE_MS, EYE, REPAIR_MS, ROOF_Y, ROOF_T, SEATS, TICK_MS, STRAFE } from './core/config.js';

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
  const feel = createFeel(uiRoot);
  const career = createCareerUI(uiRoot, ui.titleEl, {
    onLocker: () => booted && openLocker(),
    onDaily: () => booted && startDaily(),
    onWear: (slot, id) => wearLook(slot, id),
    onTry: (slot, id) => tryLook(slot, id),
    onLockerDone: () => closeLocker(),
    onDailyAgain: () => startDaily(),
    onDailyBack: () => backToTitle(),
    thumb: (key) => thumb(key),
    sound: { tick: (k) => sound.tick(k), till: () => sound.till(), levelUp: () => sound.levelUp() },
  });
  /** Today, as the platform's clock has it (a UTC day number). */
  const today = () => {
    try {
      return dayOf(ow?.now ? ow.now() : Date.now());
    } catch {
      return dayOf(Date.now());
    }
  };

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
  // Who this is (for the Daily Street's wall).
  const who = { id: '', name: '' };
  ow?.player
    ?.get?.()
    .then((p) => {
      who.id = String(p?.id ?? '');
      who.name = String(p?.name ?? '').slice(0, 24);
    })
    .catch(() => {});

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
  // The Daily Street (a round of your own against the neighbours, the same for everyone today) and the Locker.
  let daily = null;
  let locker = null;
  // The feel: slow motion after a knockout, the lens kicking on a throw, the hail's shower, the dog's bark.
  let slowUntil = 0;
  let fovKick = 0;
  let hailUntil = 0;
  let barkAt = 0;
  let goUntil = 0;
  let paperKey = '';
  let panesToday = 0;
  let panesAt = -1e9;
  let looksSig = '';
  const camPos = new THREE.Vector3(0, 14, 30);
  const camLook = new THREE.Vector3(0, 2, 0);
  const tv = new THREE.Vector3();
  const tl = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const handTmp = new THREE.Vector3();
  const handFace = new THREE.Vector3();
  let strafeLean = 0;
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
      else if (screen === 'daily' && daily?.shown) startDaily();
      else if (ui.screen === 'lobby' && showOwnReady()) readyUp();
    },
    blocked: (x, y) => reservedList().some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h),
  });
  input.onEsc = () => {
    if (screen === 'game' && online?.match.phase === 'round' && !ui.cardOpen) openPauseCard();
    else if (screen === 'daily' && !ui.cardOpen) openDailyCard();
    else if (screen === 'locker') closeLocker();
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
      refreshTitle();
    })
    .catch(() => (profileLoaded = true));
  const saveProfile = () => ow?.save?.set('profile', profile).catch(() => {});
  const award = (ids) => {
    for (const id of ids) ow?.badges?.award(id).catch(() => {});
  };
  const submit = (board, score) => {
    if (score > 0) ow?.leaderboards?.submit(board, score).catch(() => {});
  };

  /** The title's career: level, streak, today's jobs, the Daily Street's door, the Locker's "New". */
  function refreshTitle() {
    const d = today();
    const D = dailyOf(d);
    ui.title({ stars: totalStars(profile), total: STREET_COUNT * 3 });
    career.title({
      profile,
      jobs: jobsToday(profile, d),
      streak: streakToday(profile, d),
      daily: { street: D.street, twist: D.twist, best: profile.daily.day === d ? profile.daily.best : 0 },
      unseen: unseenLooks(profile),
      panesToday,
    });
  }
  /** Panes the whole game broke today (once a minute, on the title). */
  function fetchCommunity(now) {
    if (now - panesAt < 60000 || !ow?.data?.game) return;
    panesAt = now;
    ow.data.game
      .get('panes-today')
      .then((v) => {
        const n = typeof v === 'number' ? v : Number(v?.value ?? v?.total ?? 0);
        if (Number.isFinite(n) && n !== panesToday) {
          panesToday = n;
          refreshTitle();
        }
      })
      .catch(() => {});
  }

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
      look: () => lookCode(profile.look),
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
      arm.setStone(profile.look.stone);
    }
    attackerUntil = 0;
    outBannerUntil = 0;
    ghostHintAt = 0;
    looksSig = '';
    feel.clear();
    fx0();
  }

  /** The feel's leftovers from a round before: hail, slow motion, the lens. */
  function fx0() {
    W.fx.hail(false);
    hailUntil = 0;
    slowUntil = 0;
    fovKick = 0;
    goUntil = 0;
    paperKey = '';
  }

  /** What each seat of a match's round wears: a bot its persona's, a player what their page says, you yours. */
  function matchLooks(sync, me) {
    return sync.seats.map((s, i) => {
      if (i === me) return profile.look;
      if (s.bot) return PERSONA_LOOKS[personaByName(s.name) ?? 'player'] ?? null;
      const code = sync.looks.get(i);
      return code ? lookFromCode(code) : null;
    });
  }
  function useLooks(list) {
    const sig = JSON.stringify(list);
    if (sig === looksSig) return;
    looksSig = sig;
    W.setLooks(list);
  }
  const personaLooks = (personas) => personas.map((p, i) => (p === 'player' ? null : PERSONA_LOOKS[p] ?? null));

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
    const res = settle(roundInfo(R, me, won, placeIn(ranking, myId), sync.data.street, false));
    matchStars += res.stars;
    career.xp(res, profile.xp);
    if (won) sound.win(false);
  }

  /** Where an id finished in a ranking (groups of tied ids, best first). */
  function placeIn(ranking, id) {
    let place = 1;
    for (const group of ranking) {
      if (group.includes(id)) return place;
      place += group.length;
    }
    return 6;
  }

  /** What one seat did in a round, as the career counts it. */
  function roundInfo(R, seat, won, place, street, isDaily) {
    const st = R.stats[seat];
    const h = R.houses[seat];
    const out = h.outAt >= 0;
    return {
      street,
      won,
      place,
      out,
      glassLeft: out ? 0 : glassCount(h.panes),
      broke: st.broke,
      lost: st.lost,
      intercepts: st.intercepts,
      bonks: st.bonks,
      gnomeDouble: st.gnomeDouble,
      kos: st.kos,
      salvaged: st.salvaged,
      hot: st.hot,
      hotBroke: st.hotBroke,
      gold: st.gold,
      glazed: st.glazed,
      tricks: st.tricks,
      trick: st.trick,
      bestStreak: st.bestStreak,
      longest: st.longest,
      daily: isDaily,
      day: today(),
    };
  }

  /** A round played: the profile moves on, badges and boards, the street's count of panes. */
  function settle(info) {
    const res = applyRound(profile, info);
    res.profile.hints = { ...profile.hints, ...res.profile.hints };
    profile = res.profile;
    saveProfile();
    award(res.badges);
    submit('rounds-won', profile.roundsWon);
    submit('panes', profile.panes);
    submit('stars', totalStars(profile));
    submit('level', levelFor(profile.xp).level);
    submit('knockouts', profile.kos);
    if (info.broke > 0) {
      ow?.data?.game?.add('panes-today', Math.max(1, Math.min(120, info.broke))).catch?.(() => {});
      panesToday += info.broke;
    }
    return res;
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
      if (screen === 'daily' && daily?.phase === 'round' && !daily.paused && !dailyAuto) openDailyCard();
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

  /** A seat's name in the round being drawn. */
  const seatName = (R, i) => (online?.sync?.R === R ? online.sync.seats[i]?.name : null) ?? R.seats[i]?.name ?? 'A neighbour';
  /** Where a point in the street is on the screen (null behind the camera). */
  function screenOf(x, y, z) {
    project(x, y, z, proj);
    return proj.on ? { x: proj.x, y: proj.y } : null;
  }

  function onEvent(e, R, me, isTitle) {
    const nowP = performance.now();
    const mineOn = !isTitle && me >= 0;
    switch (e.type) {
      case 'throw': {
        if (e.seat === me) {
          const s = R.stones.find((x) => x.id === e.id);
          const pw = s ? Math.min(1, Math.hypot(s.vx, s.vy, s.vz) / 30) : 0.6;
          sound.throw(pw);
          if (e.hot) sound.roar(0, 0);
          // The lens kicks out with the arm.
          if (!isTitle && !reduced()) fovKick = Math.min(9, fovKick + 1.5 + pw * 2.5 + (e.hot ? 3 : 0));
        } else {
          const s = spatial(e.x, e.y, e.z);
          const st = R.stones.find((x) => x.id === e.id);
          const incoming = me >= 0 && st && (st.predHouse === me || st.predBody === me) && st.pred !== 'ground';
          sound.whoosh(s.d, s.pan, !!incoming);
          if (e.hot) sound.roar(s.d, s.pan);
          if (e.kind === 'gnome') sound.wheee(s.d, s.pan);
        }
        break;
      }
      case 'break': {
        const dir = e.vx !== undefined ? { x: e.vx, y: e.vy, z: e.vz } : null;
        if (e.panes?.length) {
          W.glass.paneWorld(e.house, e.panes[0], paneTmp);
          const s = spatial(paneTmp.x, paneTmp.y, paneTmp.z);
          for (const p of e.panes) W.glass.burst(e.house, p, dir, e.kind === 'brick' ? 1.25 : e.hot ? 1.2 : 1, s.d);
          // A flash at the pane and a burst of glitter: a break reads from across the street.
          W.fx.glint(paneTmp.x, paneTmp.y, paneTmp.z, 1.6 + Math.min(2.4, s.d / 10));
          W.fx.shatter(paneTmp.x, paneTmp.y, paneTmp.z, { far: s.d, dir, hot: !!e.hot });
          sound.shatter(s.d, s.pan, e.house === me, e.panes.length);
          if (breakLog && breakLog.length < 200) breakLog.push({ house: e.house, by: e.by, panes: e.panes.length, d: Math.round(s.d) });
          if (s.d < 9) trauma = Math.min(1, trauma + 0.12);
          W.lawns.react(e.house, 'hit', nowP);
          if (W.looks[e.house]?.lawn === 'dog' && nowP > barkAt) {
            barkAt = nowP + 1600;
            const hh = W.field.houses[e.house];
            const sd = spatial(hh.cx + hh.fx * 4, hh.elev + 0.5, hh.cz + hh.fz * 4);
            setTimeout(() => sound.bark(sd.d, sd.pan), 180);
          }
          // Yours: the reticle cracks, a ding (higher the hotter the streak) and the XP jumps off the glass.
          if (mineOn && e.by === me && e.house !== me) {
            feel.confirm(!!e.hot, reduced());
            sound.ding(Math.max(0, (R.bodies[me]?.streak ?? 1) - 1));
            const sp = screenOf(paneTmp.x, paneTmp.y, paneTmp.z);
            if (sp) feel.plus(sp.x, sp.y, `+${(XP.pane + (e.hot ? XP.hotBreak : 0)) * e.panes.length}`, e.hot ? 'hot' : '', nowP);
          }
        }
        if (e.cracked >= 0 && !e.panes?.length) {
          W.glass.paneWorld(e.house, e.cracked, paneTmp);
          const s = spatial(paneTmp.x, paneTmp.y, paneTmp.z);
          sound.crack(s.d, s.pan);
          if (mineOn && e.by === me && e.house !== me) feel.confirm(false, reduced());
        }
        if (e.house === me && me >= 0 && e.panes?.length && !isTitle) hitMe(e.by, e.panes.length, R, me);
        break;
      }
      case 'crack': {
        const s = spatial(e.x, e.y, e.z);
        sound.crack(s.d, s.pan);
        W.fx.glint(e.x, e.y, e.z, 0.8);
        if (mineOn && e.by === me && e.house !== me) feel.confirm(false, reduced());
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
        W.fx.land(e.x, e.y, e.z, e.vx ?? 0, e.vz ?? 1, e.what ?? 'ground', !!e.hot);
        break;
      }
      case 'gone':
        if (e.what === 'sea') W.fx.puff(e.x, -0.2, e.z, '#FFFFFF', 2.2, 1.1, 0, 2, 0);
        break;
      case 'clack': {
        const s = spatial(e.x, e.y, e.z);
        sound.clack(s.d, s.pan);
        W.fx.clack(e.x, e.y, e.z);
        if (e.hot) W.fx.embers(e.x, e.y, e.z, 26);
        break;
      }
      case 'bonk': {
        const s = spatial(e.x, e.y, e.z);
        sound.bonk(s.d, s.pan, e.seat === me);
        W.fx.glint(e.x, e.y, e.z, 1.3);
        if (e.seat === me && !isTitle) {
          trauma = Math.min(1, trauma + 0.6);
          if (e.by >= 0) feel.hurt(bearing(R, e.by), 2, reduced());
        }
        break;
      }
      case 'poof':
        W.fx.poof(e.x, e.y, e.z, OWNERS[e.seat % OWNERS.length].color);
        break;
      case 'heat':
        if (mineOn && e.seat === me) {
          if (e.lost) {
            sound.cool();
            feel.toast('Cooled off', 'cool', nowP);
          } else if (!e.cooled) sound.heat(e.heat);
        }
        break;
      case 'hot':
        if (mineOn && e.seat === me) {
          sound.ignite();
          if (!e.salvage) feel.toast(e.gold ? 'Gold! Full hands, hot stone' : 'Hot stone!', 'gold', nowP);
          once('hot', 'Hot stones break two', 2600);
        }
        break;
      case 'trick': {
        if (e.ids.includes('gold')) {
          W.fx.gold(e.x, e.y, e.z);
          if (e.seat === me) sound.coin();
        }
        if (isTitle) break;
        const shown = e.ids.filter((id) => id !== 'ko');
        if (!shown.length) break;
        if (e.seat === me) {
          feel.trick(shown.map((id) => ({ name: TRICKS[id]?.name ?? id, xp: TRICKS[id]?.xp ?? 0, big: id === 'long' || id === 'buzzer' || id === 'firefighter' })));
          sound.trick(shown.length);
        } else feel.feed({ name: seatName(R, e.seat), seat: e.seat, text: shown.map((id) => TRICKS[id]?.name ?? id).join(' + ') }, nowP);
        break;
      }
      case 'out': {
        const h = W.field.houses[e.house];
        const s = spatial(h.cx, h.elev + 3, h.cz);
        sound.fall(s.d, s.pan, e.house === me);
        W.fx.dust(h.cx + h.fx * 1.5, h.elev + 0.5, h.cz + h.fz * 1.5, 12, '#E8DCC8');
        W.lawns.react(e.house, 'out', nowP);
        const by = e.by;
        const ko = by >= 0 && by !== e.house;
        if (ko) W.fx.knockout(h.cx + h.fx * 1.2, h.elev + 2.6, h.cz + h.fz * 1.2, OWNERS[by % OWNERS.length].color);
        if (isTitle) {
          title.shot = e.house;
          title.shotUntil = performance.now() + 3600;
        } else if (e.house === me) {
          outBannerUntil = performance.now() + 2600;
          ghostHintAt = performance.now() + 2800;
          trauma = Math.min(1, trauma + 0.5);
        } else if (ko) {
          const mine = by === me;
          feel.knockout(mine ? `${seatName(R, e.house)} is out` : `${seatName(R, by)} took out ${seatName(R, e.house)}`, mine, nowP);
          sound.ko(mine);
          if (mine && !reduced()) {
            // The moment: everything in the air hangs, the lens punches in.
            slowUntil = nowP + 520;
            fovKick = -7;
            trauma = Math.min(1, trauma + 0.35);
          }
        }
        break;
      }
      case 'salvage': {
        if (e.pane >= 0) {
          W.glass.paneWorld(e.house, e.pane, paneTmp);
          W.fx.salvage(paneTmp.x, paneTmp.y, paneTmp.z);
        }
        if (mineOn && e.house === me) {
          sound.salvage();
          feel.toast(e.pane >= 0 ? 'Salvage: a pane back' : 'Salvage: a hot stone', 'good', nowP);
          once('salvage', 'Knockouts win a pane back', 2400);
        }
        break;
      }
      case 'hail': {
        const secs = Math.max(0.5, (e.at - R.now) / 1000);
        if (!isTitle) {
          feel.warn('Hail!', 2200, nowP);
          sound.hail(Math.min(4.5, secs + 1.8));
        }
        W.fx.hail(true);
        hailUntil = nowP + secs * 1000 + 1800;
        break;
      }
      case 'hailHit': {
        const list = e.panes ?? [];
        for (const p of list) {
          W.glass.paneWorld(e.house, p, paneTmp);
          const s = spatial(paneTmp.x, paneTmp.y, paneTmp.z);
          W.glass.burst(e.house, p, { x: 0, y: -6, z: 0 }, 0.8, s.d);
        }
        const first = list.length ? list[0] : e.cracked?.[0];
        if (first !== undefined) {
          W.glass.paneWorld(e.house, first, paneTmp);
          const s = spatial(paneTmp.x, paneTmp.y, paneTmp.z);
          if (list.length) sound.shatter(s.d, s.pan, e.house === me, list.length);
          else sound.crack(s.d, s.pan);
        }
        if (e.house === me && list.length && !isTitle) hitMe(-1, list.length, R, me);
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

  /** Where a seat is from where you look: 0 ahead (the top of the screen), π/2 to the right. */
  function bearing(R, seat) {
    const a = R.bodies[seat];
    if (!a) return 0;
    tmp.set(a.ghost ? a.gx : a.x, a.ghost ? a.gy : a.y + 1.4, a.ghost ? a.gz : a.z).applyMatrix4(camera.matrixWorldInverse);
    return Math.atan2(tmp.x, -tmp.z);
  }

  /** A hint the player sees once, ever. */
  function once(id, text, ms) {
    if (profile.hints[id]) return false;
    profile.hints[id] = true;
    ui.hint(text, ms);
    return true;
  }

  function hitMe(by, n, R, me) {
    trauma = Math.min(1, trauma + 0.25 + 0.1 * n);
    ui.flash(reduced());
    // Cracks at the edge of the screen on the side it came from (straight down for hail).
    feel.hurt(by >= 0 && by !== me ? bearing(R, by) : 0, n, reduced());
    if (by >= 0 && by !== me) {
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
      const personas = R.seats.map((s) => s.persona);
      W.cast(personas);
      useLooks(personaLooks(personas));
      fx0();
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
      useLooks(personas.map((p, i) => (i < players.length ? (players[i].me ? profile.look : null) : PERSONA_LOOKS[p] ?? null)));
      fx0();
    });
    return lobby.R;
  }

  function lobbyMe() {
    const i = lobbyPlayers().findIndex((p) => p.me);
    return i >= 0 ? i : 0;
  }

  // ------------------------------------------------------------------ the Daily Street: today's street, seed and twist, for everyone
  const DAILY_INTRO_MS = 4200;
  const DAILY_RESULTS_MS = 2600;

  function startDaily(dayOverride) {
    if (screen !== 'title' && screen !== 'daily') return;
    startAudio();
    music.start();
    sound.paper();
    const d = Number.isInteger(dayOverride) ? dayOverride : today();
    const D = dailyOf(d);
    const seats = lineupSeats(D.street).map((s, i) => (i === 0 ? { ...s, id: 'me', name: who.name || 'You', bot: false, persona: 'player' } : s));
    const R = createRound({
      field: buildField(D.street),
      seed: D.seed,
      round: 3,
      twist: D.twist,
      seats,
      host: true,
      // (The trailer's capture lets the street play your seat too: ?daily=auto, local only.)
      brains: seats.map((s, i) => (i === 0 && !dailyAuto ? null : createBrain(i === 0 ? 'player' : s.persona, i === 0 ? 0.75 : s.skill, `daily:${D.seed}:${i}`))),
    });
    daily = { d, D, R, ms: 0, phase: 'intro', t0: last, endAt: 0, shown: false, res: null, paused: false, wall: null, plays: 0 };
    screen = 'daily';
    hideStrip(true);
    career.xp(null);
    career.daily(null);
    ui.card(null);
    showing = '';
    show(`daily:${d}:${performance.now()}`, () => {
      W.setStreet(D.street);
      W.sweep();
      const personas = seats.map((s) => s.persona);
      W.cast(personas);
      looksSig = '';
      useLooks(personas.map((p, i) => (i === 0 ? profile.look : PERSONA_LOOKS[p] ?? null)));
      if (armSeat !== 0) {
        if (arm) {
          camera.remove(arm.group);
          arm.dispose();
        }
        arm = makeArm(0);
        camera.add(arm.group);
        armSeat = 0;
      }
      arm.setStone(profile.look.stone);
    });
    input.face(R.bodies[0].yaw, 0.12);
    feel.clear();
    fx0();
    attackerUntil = 0;
    outBannerUntil = 0;
    ghostHintAt = 0;
  }

  const dailyAuto = (LOCAL || ow?.mode === 'standalone') && params.get('daily') === 'auto';

  function stepDaily(dt, now) {
    const g = daily;
    if (g.phase === 'intro') {
      if (now - g.t0 > DAILY_INTRO_MS) {
        g.phase = 'round';
        goUntil = now + 900;
        sound.count(0);
        if (profile.rounds < 3) ui.hint('Break their glass', 2200);
      }
    } else if (g.phase === 'round') {
      if (!g.paused && !menuOpen) {
        g.ms += dt * 1000;
        g.R.advanceTo(g.ms);
      }
      if (g.R.alive() <= 1 || g.R.now >= ROUND_MS) endDaily(now);
    } else if (g.phase === 'end' && !g.shown && now - g.endAt > DAILY_RESULTS_MS) {
      g.shown = true;
      showDailyResults();
    }
    return g.R;
  }

  /** Your house is out and only the neighbours are left: the rest of the round runs at once. */
  function finishDaily() {
    const g = daily;
    if (!g || g.phase !== 'round') return;
    const R = g.R;
    while (R.alive() > 1 && R.now < ROUND_MS) {
      R.stepTick();
      R.events.length = 0;
    }
    g.ms = R.now;
    W.sweep();
    endDaily(performance.now());
  }

  function endDaily(now) {
    const g = daily;
    if (g.phase !== 'round') return;
    g.phase = 'end';
    g.endAt = now;
    const R = g.R;
    R.over = true;
    const ids = R.seats.map((s) => s.id);
    const ranking = rankHouses(R.houses, ids);
    const won = ranking[0]?.length === 1 && ranking[0][0] === 'me';
    g.won = won;
    g.winner = ranking[0]?.length === 1 ? ids.indexOf(ranking[0][0]) : -1;
    g.res = settle(roundInfo(R, 0, won, placeIn(ranking, 'me'), g.D.street, true));
    if (won) sound.win(false);
    else sound.lose();
    // The neighbourhood's wall: your best of the day goes up; everyone's plays are counted.
    const day = g.d;
    const sc = g.res.daily?.score ?? 0;
    submit('daily-best', sc);
    const gd = ow?.data?.game;
    if (gd) {
      const after = () =>
        gd
          .get('daily-wall')
          .then((list) => {
            if (daily !== g) return;
            g.wall = wallOf(list, day, who.id);
            if (g.shown) showDailyResults();
          })
          .catch(() => {});
      gd.add('daily-plays', 1)
        .then((n) => {
          if (typeof n === 'number') g.plays = n;
        })
        .catch(() => {});
      if (g.res.daily?.personal && sc > 0) gd.push('daily-wall', { d: day, s: sc, st: g.D.street }).then(after, after);
      else after();
    } else g.wall = [];
  }

  function showDailyResults() {
    const g = daily;
    if (!g?.res) return;
    career.xp(g.res, profile.xp);
    career.daily({
      score: g.res.daily?.score ?? 0,
      best: g.res.daily?.best ?? 0,
      personal: !!g.res.daily?.personal,
      street: g.D.street,
      twist: g.D.twist,
      place: 0,
      wall: g.wall,
      plays: g.plays,
    });
  }

  function backToTitle() {
    sound.click();
    screen = 'title';
    daily = null;
    locker = null;
    career.xp(null);
    career.daily(null);
    career.locker(null);
    ui.card(null);
    feel.clear();
    fx0();
    showing = '';
    hideStrip(true);
    music.set('menu');
    refreshTitle();
  }

  // ------------------------------------------------------------------ the Locker: try looks on on your own house
  function openLocker() {
    if (screen !== 'title') return;
    startAudio();
    // The menu tune plays while you try things on.
    music.start();
    music.set('menu');
    sound.click();
    const seats = lineupSeats(0);
    locker = { R: createRound({ field: buildField(0), seed: 5, round: 1, seats, host: true }), ms: 0, next: performance.now() + 600, look: { ...profile.look } };
    screen = 'locker';
    showing = '';
    career.locker(profile, unseenLooks(profile));
    makeThumbs().then(() => career.redraw());
  }

  function closeLocker() {
    // Everything new has been seen now.
    profile.seen = [...new Set([...profile.seen, ...unseenLooks(profile)])];
    saveProfile();
    backToTitle();
  }

  function tryLook(slot, id) {
    if (!locker) return;
    locker.look = { ...profile.look, [slot]: id };
    locker.next = Math.min(locker.next, performance.now() + 250);
    sound.click();
  }

  function wearLook(slot, id) {
    profile = wear(profile, slot, id);
    saveProfile();
    if (locker) locker.look = { ...profile.look };
    career.locker(profile, unseenLooks(profile));
    sound.click();
  }

  function stepLocker(dt, now) {
    const L = locker;
    const R = L.R;
    show('locker', () => {
      W.setStreet(0);
      W.sweep();
      W.cast(R.seats.map((s) => s.persona));
      looksSig = '';
      fx0();
      lockerCam(R, now, 10);
    });
    useLooks(R.seats.map((s, i) => (i === 0 ? L.look : PERSONA_LOOKS[s.persona] ?? null)));
    // A long stay: the street starts over (the round's clock has an end).
    if (L.ms > ROUND_MS - 20000) {
      L.R = createRound({ field: R.field, seed: 5, round: 1, seats: R.seats, host: true });
      L.ms = 0;
      return stepLocker(dt, now);
    }
    L.ms += dt * 1000;
    // Your neighbour-self winds up and throws one into the street now and then: the stone and its trail, as the street sees them.
    const b = R.bodies[0];
    const inp = b.input;
    if (now > L.next) {
      L.next = now + 2300;
      const hh = R.field.houses[0];
      // Off to one side of the green's tree.
      inp.yaw = Math.atan2(hh.fx, hh.fz) + Math.PI + 0.4 + (Math.random() - 0.5) * 0.2;
      inp.pitch = 0.42 + Math.random() * 0.12;
      inp.throwHeld = true;
      inp.releasePower = 0.55 + Math.random() * 0.15;
      b.ammo = 5;
      b.hot = Math.random() < 0.3;
      L.thrown = b.lastThrowAt;
    }
    R.advanceTo(L.ms);
    if (inp.throwHeld && b.lastThrowAt !== L.thrown) inp.throwHeld = false;
    for (const e of R.events) if (e.type === 'land' || e.type === 'skip') W.fx.land(e.x, e.y, e.z, e.vx ?? 0, e.vz ?? 1, e.what ?? 'ground', !!e.hot);
    R.events.length = 0;
    return R;
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
    const f = R.field;
    if (high) {
      // A slow crane high over the green, looking across at the far houses.
      const a = t * 0.00005 + 0.6;
      const r = f.R * 0.62;
      tv.set(Math.cos(a) * r, 13 + Math.sin(t * 0.00013) * 1.2, Math.sin(a) * r);
      tl.set(-Math.cos(a - 0.35) * f.R * 0.75, 3.2, -Math.sin(a - 0.35) * f.R * 0.75);
      lookAtSmooth(tv, tl, dt, 1.5);
      return;
    }
    // Low: a slow dolly along the inside of the ring of lawns, looking ahead along the glass fronts curving away to the right,
    // the oak out of shot to the left. On a street that's an arc it drifts to and fro along the houses.
    const hs = f.houses;
    const first = hs[0].angle;
    const last = hs[hs.length - 1].angle;
    const ring = last - first > Math.PI * 1.5;
    const a = ring ? 0.6 - t * 0.00004 : first + 0.75 + (last - first - 0.45) * (0.5 + 0.5 * Math.sin(t * 0.00003));
    // Upright (a phone), the title's cards cover the middle of the screen: eye level and tilted up, so the lawns, people and
    // glass fill the band between the jobs and the door.
    const portrait = stage.width < stage.height;
    const r = Math.min(f.R * (portrait ? 0.62 : 0.6), f.R - 8.4);
    tv.set(Math.cos(a) * r, (portrait ? 1.7 : 4.4) + Math.sin(t * 0.00013) * 0.6, Math.sin(a) * r);
    const la = portrait ? 0.62 : 0.95;
    const lr = f.R * (portrait ? 1 : 0.86);
    tl.set(Math.cos(a - la) * lr, portrait ? 6.6 : 2.2, Math.sin(a - la) * lr);
    lookAtSmooth(tv, tl, dt, 1.5);
  }

  // The stone camera (captures): beside the glass a stone is about to hit, so it flies in and the pane bursts toward the lens.
  // Yours first, hot ones before cold; it holds a beat on the hit, then cuts to the next.
  const impact = new THREE.Vector3();
  function stoneCam(R, me, now, dt) {
    let s = null;
    for (const o of R.stones) if (o.id === camStone && o.alive) s = o;
    if (!s && now > camHoldUntil) {
      let score = -Infinity;
      for (const o of R.stones) {
        const left = (o.predAt ?? 0) - R.now;
        if (!o.alive || o.kind === 'pebble' || o.pred !== 'glass' || o.predHouse === me || left < 450 || left > 2600) continue;
        const v = (o.seat === me ? 2e6 : 0) + (o.hot ? 1e6 : 0) - left;
        if (v > score) {
          score = v;
          s = o;
        }
      }
      if (s) {
        camStone = s.id;
        const hh = R.field.houses[s.predHouse];
        impact.set(s.predX, s.predY, s.predZ);
        // On the side the stone isn't coming from, a few strides out on the lawn, eye level with the pane.
        const h = Math.hypot(s.vx, s.vz) || 1;
        const along = (s.vx / h) * hh.rx + (s.vz / h) * hh.rz;
        const side = along > 0 ? 1 : -1;
        camPos.set(impact.x + hh.fx * 5.2 + hh.rx * side * 3.2, impact.y + 0.5, impact.z + hh.fz * 5.2 + hh.rz * side * 3.2);
        camLook.set(impact.x - hh.rx * side * 0.9 + hh.fx * 0.6, impact.y - 0.15, impact.z - hh.rz * side * 0.9 + hh.fz * 0.6);
        stoneLast.copy(camLook);
      }
    }
    if (s) camHoldUntil = now + 1100;
    // A slow push in on the glass, held through the hit.
    tv.copy(camPos);
    if (camPos.distanceTo(stoneLast) > 3.6) tv.lerp(stoneLast, Math.min(0.25, dt * 0.35));
    lookAtSmooth(tv, stoneLast, dt, 6);
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

  function houseShot(R, h, t, dt, push = 0, cut = false) {
    const hh = R.field.houses[h];
    const d = 15 - push * 5;
    const side = Math.sin(t * 0.0003) * 2.5;
    tv.set(hh.cx + hh.fx * d + hh.rx * side, hh.elev + 3.2 + push, hh.cz + hh.fz * d + hh.rz * side);
    tl.set(hh.cx, hh.elev + 2.6, hh.cz);
    if (cut) {
      camPos.copy(tv);
      camLook.copy(tl);
    }
    lookAtSmooth(tv, tl, dt, 2);
  }

  // A round's end: when it ended on a knockout, a held beat on the house that fell, then a cut to the one left standing (cuts,
  // so the lens never swings through the oak to get there).
  const endBeat = { R: null, t0: 0, fell: -1, key: -2 };
  const END_BEAT_MS = 1700;
  /** Still on the house that fell (the plate for the one standing waits for the cut). */
  const endHolding = () => endBeat.fell >= 0 && endBeat.key === endBeat.fell && performance.now() - endBeat.t0 < END_BEAT_MS;
  function endShot(R, winner, now, dt, push) {
    if (endBeat.R !== R) {
      endBeat.R = R;
      endBeat.t0 = now;
      endBeat.key = -2;
      let at = -1;
      endBeat.fell = -1;
      R.houses.forEach((h, i) => {
        if (h.outAt > at) {
          at = h.outAt;
          endBeat.fell = i;
        }
      });
      if (endBeat.fell === winner || R.now - at > 600) endBeat.fell = -1;
    }
    const h = endBeat.fell >= 0 && now - endBeat.t0 < END_BEAT_MS ? endBeat.fell : winner;
    const cut = h !== endBeat.key;
    endBeat.key = h;
    if (h >= 0) houseShot(R, h, now, dt, h === endBeat.fell ? 1.1 : push, cut);
    else orbit(R, now, dt);
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
    // Lean into a strafe a little.
    const side = b.ghost ? 0 : (b.vx * Math.cos(yaw) - b.vz * Math.sin(yaw)) / STRAFE;
    strafeLean += ((reduced() ? 0 : -side * 0.03) - strafeLean) * Math.min(1, dt * 8);
    camera.rotation.set(pitch, yaw, roll + strafeLean);
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
  function frame() {
    requestAnimationFrame(frame);
    // The page's own clock, not the frame's timestamp: the two can disagree (a capture's virtual time), and everything else here
    // (slow motion, toasts, the Daily's intro) reads this one.
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const match = online?.match ?? null;
    // Readied from the platform's own strip (or a match this page is part of began): straight in from the title.
    if (screen === 'title' && match && match.phase !== 'lobby' && match.phase !== 'results' && (match.me || online.room.me?.ready)) pressPlay();
    const isTitle = screen === 'title';
    const isDaily = screen === 'daily' && !!daily;
    const isLocker = screen === 'locker' && !!locker;
    let phase;
    if (isTitle) phase = 'title';
    else if (isLocker) phase = 'locker';
    else if (isDaily) phase = daily.phase === 'end' ? 'roundEnd' : daily.phase;
    else phase = match?.phase ?? 'lobby';
    const flow = isDaily ? `daily-${daily.phase}` : phase === 'title' || phase === 'locker' ? phase : phase === 'lobby' || phase === 'countdown' || phase === 'roundEnd' || phase === 'results' ? phase : 'playing';
    if (flow !== lastFlow) {
      lastFlow = flow;
      document.body.dataset.flow = flow;
    }
    const sync = online?.sync ?? null;
    const live = screen === 'game' && sync?.R && (phase === 'intro' || phase === 'round' || phase === 'roundEnd' || phase === 'results');
    let R;
    let me = -1;
    if (isTitle) R = stepTitle(dt);
    else if (isLocker) R = stepLocker(dt, now);
    else if (isDaily) {
      R = stepDaily(dt, now);
      me = 0;
    } else if (live) {
      R = sync.R;
      me = sync.mySeat;
      show(`round:${sync.key}`, () => setupRound(R, sync.data));
      if (me >= 0) useLooks(matchLooks(sync, me));
    } else R = lobbyRound();

    // This player's hands on their body, then the round runs to the match clock.
    const playing = phase === 'round' && me >= 0 && (isDaily || (!isTitle && R === sync?.R));
    const paused = isDaily ? daily.paused : !!match?.paused;
    const auto = autoplay || (isDaily && dailyAuto);
    const active = playing && !auto && !ui.cardOpen && !menuOpen && !paused;
    input.setActive(active);
    if (playing && !auto) input.apply(R.bodies[me].input, null);
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
    } else if (isLocker) lockerCam(R, now, dt);
    else if (phase === 'lobby') lobbyCam(R, now, dt, lobbyMe());
    else if (phase === 'countdown' || (isDaily && phase === 'intro')) {
      // Down from above onto your lawn.
      const f = R.field;
      const hh = f.houses[isDaily ? 0 : lobbyMe()];
      const left = isDaily ? Math.max(0, (DAILY_INTRO_MS - (now - daily.t0)) / 1000) * (3 / (DAILY_INTRO_MS / 1000)) : match.countdown ?? 0;
      const k = 1 - Math.max(0, Math.min(1, left / 3));
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
        } else orbit(R, now, dt, true);
      } else {
        firstPerson(R, me, now, dt, auto);
        firstP = true;
      }
    } else if (isDaily) endShot(R, daily.winner, now, dt, 0.5);
    else if (phase === 'roundEnd' || phase === 'results') {
      const ranking = match.last?.ranking ?? sync?.ranking() ?? [];
      const winId = phase === 'results' ? match.results?.[0]?.id : ranking[0]?.length === 1 ? ranking[0][0] : null;
      const h = winId ? sync.seatOf(winId) : -1;
      if (phase === 'roundEnd') endShot(R, h, now, dt, 0.3);
      else if (h >= 0) houseShot(R, h, now, dt, 0.8);
      else orbit(R, now, dt);
    } else orbit(R, now, dt, true);
    shake(now);
    trauma = Math.max(0, trauma - dt * 1.3);
    // The lens: kicked out by a throw, punched in by a knockout, settling back.
    fovKick *= Math.exp(-dt * 7);
    if (Math.abs(fovKick) < 0.02) fovKick = 0;
    stage.setFov(66 + (firstP ? fovKick : 0));
    camera.updateMatrixWorld();
    camRight.set(Math.cos(camera.rotation.y), 0, -Math.sin(camera.rotation.y));

    // The street.
    for (const e of R.events) onEvent(e, R, me, isTitle || isLocker);
    R.events.length = 0;
    if (hailUntil && now > hailUntil) {
      hailUntil = 0;
      W.fx.hail(false);
    }
    W.me = me;
    W.hideMe = firstP;
    W.ghostsOff = !!R.over || phase === 'roundEnd' || phase === 'results';
    const wind = R.windNow();
    // A knockout of yours: what's in the air hangs for a moment.
    const viewDt = now < slowUntil ? dt * 0.3 : dt;
    W.draw(R, viewDt, now, wind);
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
    if ((live || isDaily) && phase === 'round' && storeWasOpen && !storeOpen && R.now < R.storeClose + 1000) sound.bell();
    storeWasOpen = storeOpen;
    if (arm) {
      arm.group.visible = firstP && !!mine && !(mine.ghost && mine.pebbles <= 0);
      if (arm.group.visible) {
        arm.update(mine, R.now, dt, mine.ghost);
        // A hot stone burns in your hand: lit from inside, a halo on the side you see, flames licking up off its top.
        const burning = mine.hot && !mine.held && !mine.ghost && !reduced();
        arm.setHot(burning, 0.5 + 0.5 * Math.sin(now * 0.023) * Math.sin(now * 0.0071));
        if (burning && arm.stoneAt(handTmp)) {
          handFace.copy(camera.position).sub(handTmp).normalize();
          const cx = handTmp.x + handFace.x * 0.07;
          const cy = handTmp.y + handFace.y * 0.07;
          const cz = handTmp.z + handFace.z * 0.07;
          W.fx.parts.glowAt(cx, cy + 0.01, cz, '#FF7A1A', 0.065, 0.35, SHAPE.puff, true);
          // Flames lick up off its top, with now and then a spark.
          if (Math.random() < dt * 90) {
            const a = Math.random() * Math.PI * 2;
            const sp = Math.random() < 0.12;
            W.fx.parts.emit({ x: cx + Math.cos(a) * 0.05, y: cy + 0.04 + Math.random() * 0.03, z: cz + Math.sin(a) * 0.05, vx: (Math.random() - 0.5) * (sp ? 0.5 : 0.12), vy: sp ? 0.7 + Math.random() * 0.4 : 0.32 + Math.random() * 0.2, vz: (Math.random() - 0.5) * (sp ? 0.5 : 0.12), color: sp ? '#FFE08A' : Math.random() < 0.5 ? '#FFB13A' : '#FF5A14', bright: sp ? 2.2 : 1.7, size: sp ? 0.012 : 0.035 + Math.random() * 0.03, grow: sp ? 0 : 0.6, life: sp ? 0.5 : 0.26 + Math.random() * 0.16, shape: sp ? SHAPE.dot : SHAPE.flame, add: true, rise: sp ? 0 : 1.5, gravity: sp ? 1.2 : 0, drag: 2 });
          }
        }
      }
    }
    if (mine && (firstP || cam) && playing) drawArc(R, me);
    else W.fx.hideArc();
    feel.hot(!!mine && playing && mine.hot && !mine.ghost && !reduced());

    // Sound that follows state.
    if (mine && playing) {
      sound.windup(mine.winding ? mine.power : 0);
      if (mine.repairing && now > squeakAt) {
        squeakAt = now + 320;
        sound.squeak(0);
      }
    } else sound.windup(0);
    ambience(wind.s, dt, { night: STREETS[W.index]?.light === 'night', snow: snowy(), quiet: isTitle || isLocker });
    if (!isTitle && !isLocker) {
      // After a round the band keeps playing, a little softer, under the receipt.
      let mode = phase === 'roundEnd' || phase === 'results' ? 'results' : 'menu';
      if (phase === 'round' || phase === 'intro') {
        const alive = R.alive();
        mode = alive <= 2 ? 'frantic' : alive <= 3 ? 'tense' : R.now >= R.storeClose ? 'late' : 'play';
      }
      music.set(mode);
    }

    hud(R, me, phase, match, now, firstP);
    stage.render(now / 1000);
    drawnR = R;
  }
  let drawnR = null;

  /**
   * The Locker's camera. Stones and trails: over your shoulder as you wind up, then riding along behind the stone. Glass and lawns:
   * your house and its lawn three-quarters on from the green. Either way framed beside (or above) the sheet.
   */
  function lockerCam(R, t, dt) {
    const hh = R.field.houses[0];
    const portrait = stage.height > stage.width;
    const slot = career.lockerSlot;
    if (slot === 'stone' || slot === 'trail') {
      const b = R.bodies[0];
      // Along the throw (toward the middle of the street) and its right.
      const ax = hh.fx;
      const az = hh.fz;
      const rx = -az;
      const rz = ax;
      const lean = portrait ? 0 : 1;
      let s = null;
      for (const o of R.stones) if (o.alive && o.seat === 0) s = o;
      if (s) {
        const h = Math.hypot(s.vx, s.vz) || 1;
        const vx = s.vx / h;
        const vz = s.vz / h;
        tv.set(s.x - vx * 2.4 - vz * 0.9, s.y + 0.55, s.z - vz * 2.4 + vx * 0.9);
        tl.set(s.x + vx * 1.6 - vz * 1.3 * lean, s.y + s.vy * 0.05 - (portrait ? 0.9 : 0), s.z + vz * 1.6 + vx * 1.3 * lean);
        stoneLast.set(s.x, s.y, s.z);
        lookAtSmooth(tv, tl, dt, 8);
        locker.held = t + 500;
        return;
      }
      if (t < (locker.held ?? 0)) {
        // It landed: a beat looking at where.
        tv.copy(camPos);
        lookAtSmooth(tv, stoneLast, dt, 4);
        return;
      }
      tv.set(b.x - ax * 2.8 + rx * 1.2, b.y + 2.1, b.z - az * 2.8 + rz * 1.2);
      tl.set(b.x + ax * 8 + rx * 3.2 * lean, b.y + (portrait ? -0.6 : 1.3), b.z + az * 8 + rz * 3.2 * lean);
      lookAtSmooth(tv, tl, dt, 3.5);
      return;
    }
    // The glass or the lawn piece on show, framed in the part of the screen the sheet leaves free: above it or left of it.
    // Close in front of the oak, so the tree never fills the shot.
    const sway = Math.sin(t * 0.00022) * 0.8;
    let u = 0;
    let y = 2.65;
    let d = 0.6;
    let back = portrait ? 12.5 : 11.5;
    let up = portrait ? 0.6 : 0.9;
    if (slot === 'lawn') {
      const f = FOCUS[locker.look.lawn] ?? [0, 0.6, 4.6, 2];
      [u, y, d] = f;
      back = 4.6 + f[3] * 1.5;
      up = 1.6 + f[3] * 0.5;
    }
    const sx = hh.cx + hh.rx * u + hh.fx * d;
    const sy = hh.elev + y;
    const sz = hh.cz + hh.rz * u + hh.fz * d;
    // Screen-right as seen from the green looking at the house.
    const rx = hh.fz;
    const rz = -hh.fx;
    tv.set(sx + hh.fx * back + rx * sway, sy + up, sz + hh.fz * back + rz * sway);
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    let dep = Math.atan2(up, back);
    let side = 0;
    // (Narrow screens get the sheet along the bottom, wide ones down the right.)
    const sheetW = career.lockerSheetW;
    if (sheetW > stage.width * 0.7) dep += Math.atan(Math.max(0.2, Math.min(0.8, career.lockerSheet / Math.max(1, stage.height))) * tanV);
    else side = back * Math.max(0, Math.min(0.6, sheetW / Math.max(1, stage.width))) * tanV * camera.aspect;
    dep = Math.min(1.35, dep);
    tl.set(sx + rx * side, tv.y - back * Math.tan(dep), sz + rz * side);
    lookAtSmooth(tv, tl, dt, 3);
  }

  // ------------------------------------------------------------------ the HUD for this moment
  function hud(R, me, phase, match, now, firstP) {
    ui.tick(now);
    feel.tick(now);
    if (screen === 'title') {
      ui.show('title');
      ui.banner('', null);
      ui.standings(null);
      fetchCommunity(now);
      return;
    }
    if (screen === 'locker') {
      ui.show('none');
      ui.banner('', null);
      ui.standings(null);
      return;
    }
    if (screen === 'daily' && daily) {
      hudDaily(R, phase, now, firstP);
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
    // The XP a round paid stays up through the round's end and the results.
    if (phase !== 'roundEnd' && phase !== 'results') career.xp(null);
    if (phase !== 'intro') feel.gazette(null);
    if (phase !== 'round') feel.chip(null);
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
      if (phase === 'roundEnd' && endHolding()) ui.banner('', null);
      else if (phase === 'roundEnd') {
        feel.quiet();
        ui.hintOff();
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
    // Before every round of a match, the Gazette with the twist to come (every page draws the same one).
    if (phase === 'intro') frontPage(online.twistAhead(), `Round ${match.round} · ${STREETS[online.street]?.name ?? ''}`);
    if (!sync.R || R !== sync.R) return;
    playHud(R, me, phase, now, firstP, sync.data.street, match.round);
    if (!b0(R, me)) {
      const full = match.seats.filter((s) => !s.bot).length >= SEATS;
      ui.watch(full ? 'Next match' : 'Next round');
    }
  }

  const b0 = (R, me) => (me >= 0 ? R.bodies[me] : null);

  /** The Daily Street's HUD: the round as in a match, then its end and the paper's results. */
  function hudDaily(R, phase, now, firstP) {
    const g = daily;
    ui.standings(null);
    if (g.phase === 'end') {
      ui.show('none');
      ui.watch(null);
      ui.attackerOff();
      feel.gazette(null);
      feel.chip(null);
      if (g.shown || endHolding()) ui.banner('', null);
      else {
        feel.quiet();
        ui.hintOff();
        const w = g.winner >= 0 ? R.seats[g.winner].name : '';
        const t = g.won ? 'Your house stands' : w ? `${w}${w.endsWith('s') ? "'" : "'s"} house stands` : 'A tie';
        ui.banner(`dre${t}`, [{ t, size: 'mid', drop: true }]);
      }
      return;
    }
    ui.show('play');
    playHud(R, 0, phase, now, firstP, g.D.street, 0);
    // Out, with only the neighbours left to settle it: watch as a ghost, or skip to the end.
    if (g.phase === 'round' && R.houses[0].outAt >= 0 && !g.outAsked && !dailyAuto && now > outBannerUntil + 400 && !ui.cardOpen) {
      g.outAsked = true;
      ui.card({
        msg: 'Your house is out',
        buttons: [
          { label: 'Skip to the end', main: true, on: () => (ui.card(null), finishDaily()) },
          { label: 'Keep playing', on: () => dailyResume() },
        ],
      });
    }
  }

  function openDailyCard() {
    if (!daily || daily.phase !== 'round') return;
    daily.paused = true;
    input.setActive(false);
    ui.card({
      msg: 'Paused',
      buttons: [
        { label: 'Resume', main: true, on: () => dailyResume() },
        { label: 'Leave', on: () => backToTitle() },
      ],
    });
  }

  function dailyResume() {
    ui.card(null);
    if (!daily) return;
    daily.paused = false;
    sound.click();
    if (daily.phase === 'round') {
      input.setActive(true);
      input.requestLock();
    }
  }

  /** The Gazette's front page for a twist, with a kicker over the headline; the paper lands with a slap once per page. */
  function frontPage(twist, kicker) {
    const g = gazetteOf(twist);
    const key = `${kicker}|${twist}`;
    if (key !== paperKey) {
      paperKey = key;
      sound.paper();
    }
    feel.gazette({ date: dateline(today()), headline: g.head, line: g.line, kicker });
  }

  /** The HUD in a round (the match's or the Daily Street's): clock, wind, plates, your plate, the twist, hints, the attacker. */
  function playHud(R, me, phase, now, firstP, street, roundNo) {
    const elapsed = phase === 'round' ? R.now : 0;
    ui.clock(elapsed, R.storeClose);
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
      ui.mine({ owner: me, n: out ? 0 : glassCount(h.panes), out, ghost: b.ghost, ammo: b.ammo, held: b.held, pebbles: b.pebbles, repair: b.repairing ? Math.min(1, b.repairMs / R.repairMs) : 0, heat: b.heat, heatNeed: R.rules.heatNeed, hot: b.hot });
      ui.watch(null);
    } else ui.mine(null);
    ui.reticle(firstP && !!b);
    const touch = input.touch || !!ow?.controls?.touch;
    const active = phase === 'round' && b && !autoplay && !(screen === 'daily' && dailyAuto);
    ui.keyhint(active && !touch && !ui.cardOpen ? (input.locked ? 'Esc' : input.lockFailed ? null : 'Click') : null);

    // The Gazette before the round: its twist, the street and the round. Then the twist pinned under the wind.
    // (A match's intro shows its Gazette from hud(): the round's data isn't there yet.)
    const twist = R.twist;
    const g = gazetteOf(twist);
    if (phase === 'intro') {
      if (!roundNo) frontPage(twist, `The Daily Street · ${STREETS[street].name}`);
    } else feel.gazette(null);
    if (phase === 'round' && twist !== 'quiet') {
      feel.chip({ name: g.chip, line: g.tip });
      feel.chipAt(ui.windFoot + 10);
    } else feel.chip(null);
    if (now < outBannerUntil) ui.banner('out', [{ t: 'Your house is out', size: 'mid', drop: true }]);
    else if (now < goUntil) ui.banner('go', [{ t: 'Go!', size: 'big', drop: true }]);
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
      /** The round being drawn. */
      get R() {
        return drawnR;
      },
      world: W,
      get daily() {
        return daily;
      },
      /** A fresh Daily Street (from the title or over the one running); `day`: another day's. */
      playDaily(day) {
        if (screen === 'daily') {
          screen = 'title';
          daily = null;
        }
        startDaily(day);
      },
      /** The Daily's round run on at once to `ms` (a take that starts late in a round). */
      dailySkip(ms) {
        const g = daily;
        if (!g || g.phase === 'end') return;
        g.phase = 'round';
        while (g.R.now < ms && g.R.alive() > 1) {
          g.R.stepTick();
          g.R.events.length = 0;
        }
        g.ms = g.R.now;
        W.sweep();
      },
      get screen() {
        return screen;
      },
      get arm() {
        return arm;
      },
      /** Draw calls in the last frame (shadows included). */
      get calls() {
        return stage.renderer.info.render.calls;
      },
    };
  }

  refreshTitle();
  booted = true;
  if (wantPlay) pressPlay();
  else if ((LOCAL || ow?.mode === 'standalone') && params.get('daily')) startDaily();
  requestAnimationFrame(frame);
}
