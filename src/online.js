// The match on the platform: one join as the page loads, the lobby's settings (street, rounds), createMatch for rounds and results,
// the host's state (bots' houses and bodies, the specials, the tie-break tally), a claim for grabbing a special, and this page's
// presence. The round itself runs in sync.js on every page.

import { createMatch } from '@onceworlds/sdk/match';
import { createHost, t } from '@onceworlds/sdk/host';
import { createBots } from '@onceworlds/sdk/bots';
import { createSync } from './core/sync.js';
import { readRoundData, readHouses, newerMask } from './core/net.js';
import { STREETS, STREET_COUNT } from './core/streets.js';
import { PERSONAS } from './core/bots.js';
import { ROUND_SECONDS, ROUND_OPTIONS, POINTS } from './core/config.js';

export const JOIN = {
  maxPlayers: 6,
  minPlayers: 1,
  lobby: 'bar',
  ownCountdown: true,
  settings: [
    { id: 'street', label: 'Street', options: STREETS.map((s, i) => ({ value: i + 1, label: s.name })), default: 1 },
    { id: 'rounds', label: 'Rounds', options: ROUND_OPTIONS, default: 3 },
  ],
};

export async function joinRoom(ow) {
  if (!ow?.rooms?.join) return null;
  try {
    return await ow.rooms.join(JOIN);
  } catch (err) {
    console.warn('[glass-houses] join failed', err);
    return null;
  }
}

const lineupNames = (street) => STREETS[street].lineup.map((p) => PERSONAS[p].name);

/**
 * opts: { ow, room, autoplay, gentle(streetIndex) → bool, onRound(R, info), onResults(standings, mine), onClose(reason) }
 */
export function createOnline(opts) {
  const { room } = opts;
  const host = createHost(room);
  const houses = host.state('houses', { initial: null });
  const bodies = host.state('bodies', { initial: null });
  const specials = host.state('specials', { initial: null });
  const tally = host.state('tally', { initial: {} });
  const offs = [];
  let lastKey = '';
  let rosterSig = '';
  let presenceAt = 0;
  let stateAt = 0;
  let lastSpecials = '';
  let ended = '';

  const sync = createSync({
    myId: room.me.id,
    autoplay: !!opts.autoplay,
    gentle: false,
    send: (msg) => room.send(msg),
    grab: (id) => {
      grabCall({ id }).then((r) => {
        // Not ours after all (someone was there first, or it moved on): it may be asked for again.
        if (r !== 'won') {
          const sp = sync.R?.specials.find((s) => s.id === id);
          if (sp && sp.holder < 0) setTimeout(() => (sp.asked = false), 600);
        }
      });
    },
  });

  const streetSetting = () => Math.max(0, Math.min(STREET_COUNT - 1, (Number(room.settings?.street) || 1) - 1));

  const match = createMatch(room, {
    rounds: 'rounds',
    roundSeconds: ROUND_SECONDS,
    introSeconds: 3,
    roundEndSeconds: 6,
    resultsSeconds: 20,
    points: POINTS,
    admit: 'round',
    startRound(m) {
      const ids = m.seats.map((s) => s.id);
      // Everyone moves one house along each round.
      const k = (m.round - 1) % Math.max(1, ids.length);
      const order = ids.slice(k).concat(ids.slice(0, k));
      return { street: streetSetting(), seed: m.random(`seed:${m.roundId}`).int(2147483647), round: m.round, ids: order };
    },
    onTick(m) {
      const R = sync.R;
      if (!R || m.phase !== 'round' || sync.key !== keyOf(m.data)) return;
      if (R.alive() <= 1 && ended !== sync.key) {
        ended = sync.key;
        m.endRound(sync.ranking());
      }
    },
    score(m) {
      if (sync.R && sync.key === keyOf(m.data)) return sync.ranking();
      return null;
    },
    final(m) {
      // Points, then round wins, then panes broken.
      const tl = tally.get() ?? {};
      const rows = m.seats.map((s) => ({ id: s.id, pts: m.scores[s.id] ?? 0, wins: tl[s.id]?.wins ?? 0, broke: tl[s.id]?.broke ?? 0 }));
      rows.sort((a, b) => b.pts - a.pts || b.wins - a.wins || b.broke - a.broke);
      const out = [];
      let prev = null;
      for (const r of rows) {
        const key = `${r.pts}:${r.wins}:${r.broke}`;
        if (key === prev) out[out.length - 1].push(r.id);
        else out.push([r.id]);
        prev = key;
      }
      return out;
    },
  });

  const bots = createBots(match, { host, fill: 6, names: lineupNames(streetSetting()), skill: STREETS[streetSetting()].skill, every: 4000, think: () => null });

  const grabCall = host.claim('grab', {
    args: { id: t.int(1, 999) },
    key: (a) => String(a.id),
    validate: (c) => sync.canGrab(c.from.id, c.args.id),
    apply: (winner) => {
      sync.grant(winner.from.id, winner.args.id);
      pushState(true);
    },
  });

  function keyOf(d) {
    const r = readRoundData(d);
    return r ? `${r.round}:${r.seed}` : '';
  }

  // ---------------------------------------------------------------- the round on this page

  function beginIfNew() {
    const data = readRoundData(match.data);
    if (!data || (match.phase !== 'intro' && match.phase !== 'round')) return;
    const key = `${data.round}:${data.seed}`;
    if (key === lastKey) return;
    lastKey = key;
    ended = '';
    const solo = match.seats.filter((s) => !s.bot).length === 1;
    sync.begin(data, match.seats, room.host, match.phase === 'round' ? match.elapsed : 0);
    // A new player on an easy street: the neighbours go easy on their house.
    if (sync.mySeat >= 0 && solo && opts.gentle?.(data.street)) sync.seats[sync.mySeat].gentle = true;
    rosterSig = sig();
    // Arriving in the middle (a reload): this page takes its house back from what it or the host said last.
    if (match.phase === 'round' && sync.mySeat >= 0) {
      const mine = room.me?.presence;
      const fromMe = mine && mine.r === key && Number.isInteger(mine.g) ? { g: mine.g, c: mine.c | 0, v: mine.gv | 0, out: typeof mine.out === 'number' ? mine.out : -1 } : null;
      const fromHost = readHouses(houses.get()?.[key])[room.me.id] ?? null;
      sync.restore(newerMask(fromMe, fromHost));
    }
    sync.hostHouses(houses.get());
    sync.hostBodies(bodies.get());
    sync.hostSpecials(specials.get());
    opts.onRound?.(sync.R, data);
  }

  const sig = () => `${room.host}|${match.seats.map((s) => `${s.id}:${s.away ? 1 : 0}${s.left ? 1 : 0}`).join(',')}`;

  function checkRoster() {
    if (!sync.R) return;
    const s = sig();
    if (s === rosterSig) return;
    rosterSig = s;
    sync.roster(match.seats, room.host);
  }

  function pushState(force = false) {
    if (!sync.isHost || !sync.R) return;
    houses.set(sync.houses());
    bodies.set(sync.bodies());
    const sp = sync.specials();
    const js = JSON.stringify(sp);
    if (force || js !== lastSpecials) {
      lastSpecials = js;
      specials.set(sp);
    }
  }

  offs.push(houses.on((v) => sync.hostHouses(v)));
  offs.push(bodies.on((v) => sync.hostBodies(v)));
  offs.push(specials.on((v) => sync.hostSpecials(v)));
  offs.push(
    room.on('message', (data, from) => {
      if (!data || typeof data !== 'object' || data.$ow) return;
      if (match.phase !== 'round') return;
      sync.message(data, from?.id ?? '');
    }),
  );
  offs.push(match.on('change', () => {
    beginIfNew();
    checkRoster();
  }));
  offs.push(
    match.on('phase', (phase, prev) => {
      if (prev === 'round' && sync.R) {
        sync.R.over = true;
        // The host keeps the tally for tie-breaks: round wins and panes broken.
        if (sync.isHost && match.last) {
          const R = sync.R;
          const winner = match.last.ranking?.[0]?.length === 1 ? match.last.ranking[0][0] : null;
          tally.update((d) => {
            const out = d && typeof d === 'object' ? d : {};
            sync.ids.forEach((id, i) => {
              const row = out[id] ?? { wins: 0, broke: 0 };
              row.broke += R.stats[i]?.broke ?? 0;
              if (id === winner) row.wins++;
              out[id] = row;
            });
            return out;
          });
        }
      }
      if (phase === 'lobby' && prev === 'results' && sync.isHost) tally.set({});
      opts.onPhase?.(phase, prev);
    }),
  );
  offs.push(match.on('results', (standings, mine) => opts.onResults?.(standings, mine)));
  offs.push(room.on('close', (reason) => opts.onClose?.(reason)));
  offs.push(room.on('settings', () => useStreetBots()));

  function useStreetBots() {
    const s = streetSetting();
    try {
      match._useBots?.(6, lineupNames(s), STREETS[s].skill);
    } catch {
      /* older helpers: the names stay */
    }
  }

  const O = {
    room,
    match,
    host,
    bots,
    sync,
    get street() {
      return sync.R && (match.phase === 'round' || match.phase === 'intro' || match.phase === 'roundEnd') ? sync.data.street : streetSetting();
    },
    /** Round wins and panes broken this match, by seat id (the host keeps it). */
    tally() {
      const v = tally.get();
      return v && typeof v === 'object' ? v : {};
    },
    get rounds() {
      return Number(room.settings?.rounds) || 3;
    },
    get isHost() {
      return room.isHost;
    },
    get solo() {
      return room.kind === 'solo';
    },
    /** Lobby: the host picks a street or the rounds. Everyone readies again after a change. */
    setSetting(id, value) {
      if (!room.isHost || match.phase !== 'lobby') return false;
      if (room.settings?.[id] === value) return true;
      room.setSetting?.(id, value);
      try {
        if (room.kind !== 'solo') room.clearReady?.();
      } catch {
        /* nothing to clear */
      }
      useStreetBots();
      return true;
    },
    /** Lobby: ready (or a room of one: start). */
    ready(on = true) {
      if (room.kind === 'solo') {
        match.ready(true);
        if (match.lobby?.canStart) match.start();
        return;
      }
      match.ready(on);
    },
    /** Every frame: runs the round to the match clock and says what this page decides. */
    frame(dt, now) {
      beginIfNew();
      checkRoster();
      if (!sync.R) return;
      if (match.phase === 'round' && !match.paused) sync.step(match.elapsed, dt * 1000);
      if (match.phase === 'round') {
        if (now - presenceAt > 50) {
          presenceAt = now;
          room.setPresence(sync.presence());
        }
        // Players' poses, smoothed by the room.
        for (const s of match.seats) {
          if (s.bot || s.id === room.me.id) continue;
          const p = room.players?.get?.(s.id);
          if (!p) continue;
          let pose = null;
          try {
            pose = room.presenceAt(s.id, { angles: ['yaw'], snap: 8 });
          } catch {
            pose = p.presence;
          }
          sync.remote(s.id, p.presence, pose);
        }
        if (now - stateAt > 100) {
          stateAt = now;
          pushState();
        }
      }
    },
    dispose() {
      for (const off of offs) {
        try {
          off();
        } catch {
          /* gone */
        }
      }
      try {
        bots.dispose();
      } catch {
        /* gone */
      }
      try {
        match.dispose?.();
      } catch {
        /* gone */
      }
    },
  };
  return O;
}
