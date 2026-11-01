// Pages in a pretend room: each runs the real round through `sync`, throws go out as messages, glass in presence, the host's
// houses, bots and specials in host state, all arriving a little late. A host that reloads, a player who drops and comes back and a
// latecomer who watches.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSync } from '../src/core/sync.js';
import { glassCount } from '../src/core/round.js';
import { newerMask } from '../src/core/net.js';

const LATENCY = 60;

function createRoom(data) {
  const room = {
    t: 0,
    pages: new Map(),
    queue: [],
    host: 'ann',
    state: {},
    presence: new Map(),
    away: new Set(),
    seats: () => data.ids.map((id) => ({ id, name: id.startsWith('bot:') ? ['Walt', 'Rosa', 'Ray', 'Bev'][Number(id.slice(4)) - 1] : id, bot: id.startsWith('bot:'), away: room.away.has(id), left: false, skill: 0.5 })),
  };
  room.open = (id, opts = {}) => {
    const page = { id, sync: null, rejected: 0 };
    page.sync = createSync({
      myId: id,
      autoplay: opts.autoplay ?? true,
      send: (msg) => room.queue.push({ at: room.t + LATENCY, from: id, kind: 'msg', msg: JSON.parse(JSON.stringify(msg)) }),
      grab: (sid) => room.queue.push({ at: room.t + LATENCY, from: id, kind: 'grab', sid }),
    });
    page.sync.begin(data, room.seats(), room.host, room.t);
    // A page that arrives late hears the room's state and everyone's last presence.
    const mine = room.presence.get(id)?.value;
    const hostWord = room.state.houses?.[page.sync.key]?.[id];
    page.sync.restore(newerMask(mine && mine.r === page.sync.key ? { g: mine.g, c: mine.c, v: mine.gv, out: mine.out } : null, hostWord ? { ...hostWord } : null));
    room.pages.set(id, page);
    room.roster();
    return page;
  };
  room.close = (id) => {
    room.pages.delete(id);
    room.away.add(id);
    room.queue = room.queue.filter((q) => q.from !== id);
    if (room.host === id) room.host = [...room.pages.keys()][0];
    room.roster();
  };
  room.back = (id) => {
    room.away.delete(id);
    return room.open(id);
  };
  room.roster = () => {
    for (const p of room.pages.values()) p.sync.roster(room.seats(), room.host);
  };
  room.step = (ms) => {
    const end = room.t + ms;
    while (room.t < end) {
      room.t += 16;
      for (const p of room.pages.values()) p.sync.step(room.t, 16);
      // Presence at 20 Hz, host state at 10 Hz.
      if (room.t % 48 === 0) {
        for (const p of room.pages.values()) {
          const pres = p.sync.presence();
          room.queue.push({ at: room.t + LATENCY, from: p.id, kind: 'presence', value: JSON.parse(JSON.stringify(pres)) });
        }
      }
      if (room.t % 96 === 0) {
        const h = room.pages.get(room.host);
        if (h) {
          room.state = { houses: h.sync.houses(), bodies: h.sync.bodies(), specials: h.sync.specials() };
          room.queue.push({ at: room.t + LATENCY, from: h.id, kind: 'state', value: JSON.parse(JSON.stringify(room.state)) });
        }
      }
      const due = room.queue.filter((q) => q.at <= room.t);
      room.queue = room.queue.filter((q) => q.at > room.t);
      for (const q of due) {
        if (q.kind === 'presence') room.presence.set(q.from, { value: q.value });
        for (const p of room.pages.values()) {
          if (p.id === q.from && q.kind !== 'grab') continue;
          if (q.kind === 'msg') {
            if (!p.sync.message(q.msg, q.from)) p.rejected++;
          } else if (q.kind === 'presence') p.sync.remote(q.from, q.value, q.value);
          else if (q.kind === 'state' && p.id !== room.host) {
            p.sync.hostHouses(q.value.houses);
            p.sync.hostBodies(q.value.bodies);
            p.sync.hostSpecials(q.value.specials);
          } else if (q.kind === 'grab' && p.id === room.host) p.sync.grant(q.from, q.sid);
        }
      }
    }
  };
  return room;
}

const DATA = { street: 0, seed: 4242, round: 2, ids: ['ann', 'bob', 'bot:1', 'bot:2', 'bot:3', 'bot:4'], out: {}, end: -1 };

/** Every page's view of every house is close to what the deciding page says (a throw in flight can differ). */
function agree(room, slack = 3) {
  const pages = [...room.pages.values()];
  for (let h = 0; h < DATA.ids.length; h++) {
    const decider = pages.find((p) => p.sync.decides(h));
    if (!decider) continue;
    const truth = glassCount(decider.sync.R.houses[h].panes);
    for (const p of pages) {
      const seen = glassCount(p.sync.R.houses[h].panes);
      assert.ok(Math.abs(seen - truth) <= slack, `house ${h}: ${p.id} sees ${seen}, ${decider.id} decides ${truth}`);
    }
  }
}

test('two players and four bots: pages agree on the glass, and every real throw is accepted', () => {
  const room = createRoom(DATA);
  room.open('ann');
  room.open('bob');
  let hits = 0;
  for (let k = 0; k < 40; k++) {
    room.step(1000);
    agree(room);
  }
  for (const p of room.pages.values()) {
    assert.equal(p.rejected, 0, `${p.id} dropped real throws`);
    hits += p.sync.R.stats.reduce((a, s) => a + s.thrown, 0);
  }
  assert.ok(hits > 100);
  // The bots are run once, on the host.
  assert.ok(room.pages.get('ann').sync.R.brains[2]);
  assert.equal(room.pages.get('bob').sync.R.brains[2], null);
});

test('a player who drops keeps their house (the host decides it) and takes it back on return', () => {
  const room = createRoom(DATA);
  room.open('ann');
  room.open('bob');
  room.step(15000);
  room.close('bob');
  assert.ok(room.pages.get('ann').sync.decides(1), 'the host decides an away player’s house');
  room.step(10000);
  const whileAway = room.pages.get('ann').sync.R.houses[1];
  const kept = glassCount(whileAway.panes);
  const bob = room.back('bob');
  assert.ok(bob.sync.decides(1));
  assert.equal(glassCount(bob.sync.R.houses[1].panes), kept, 'bob carries on from the host’s word');
  room.step(5000);
  agree(room);
});

test('the host reloads: the other page takes over the bots, the specials and the away house, and nothing stops', () => {
  const room = createRoom(DATA);
  room.open('ann');
  room.open('bob');
  room.step(26000);
  room.close('ann');
  assert.equal(room.host, 'bob');
  const bob = room.pages.get('bob').sync;
  assert.ok(bob.isHost && bob.R.isHost);
  assert.ok(bob.R.brains[2], 'bob runs the bots now');
  assert.ok(bob.decides(0) && bob.decides(2));
  const thrownBefore = bob.R.stats[3].thrown;
  room.step(8000);
  assert.ok(bob.R.stats[3].thrown > thrownBefore, 'the bots kept throwing');
  room.back('ann');
  assert.equal(room.host, 'bob', 'the host role stays where it went');
  room.step(8000);
  agree(room);
  for (const p of room.pages.values()) assert.equal(p.rejected, 0);
});

test('a latecomer watches: no seat, no house, the same street', () => {
  const room = createRoom(DATA);
  room.open('ann');
  room.open('bob');
  room.step(20000);
  const carol = room.open('carol');
  assert.equal(carol.sync.mySeat, -1);
  assert.deepEqual(carol.sync.presence(), { r: carol.sync.key });
  room.step(6000);
  agree(room, 4);
  // Next round she takes a bot's seat.
  const next = { ...DATA, round: 3, ids: ['ann', 'bob', 'carol', 'bot:1', 'bot:2', 'bot:3'] };
  for (const p of room.pages.values()) p.sync.begin(next, next.ids.map((id) => ({ id, name: id, bot: id.startsWith('bot:') })), room.host, 0);
  assert.equal(carol.sync.mySeat, 2);
  assert.ok(carol.sync.decides(2));
});
