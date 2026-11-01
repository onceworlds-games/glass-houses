import test from 'node:test';
import assert from 'node:assert/strict';
import { buildField, STREETS, clampToLawn, inLawn } from '../src/core/streets.js';
import { paneAt, paneCentre, toLocal, windAt, solveAim, tracePath, velocityOf, handOf, NO_WIND } from '../src/core/physics.js';
import { PANES, COLS, STORE_CLOSE_MS, WIND_ROUND1, WIND_LATE, KINDS } from '../src/core/config.js';

test('every pane centre maps back to its pane; mullions and the outside do not', () => {
  for (const f of [buildField(0), buildField(4)]) {
    for (const h of f.houses) {
      for (let p = 0; p < PANES; p++) {
        const c = paneCentre(h, p, {});
        const l = toLocal(h, c.x, c.z, {});
        assert.ok(Math.abs(l.d) < 1e-9);
        assert.equal(paneAt(l.u, c.y - h.elev), p);
      }
    }
  }
  assert.equal(paneAt(-6.55 + 0.05, 1.5), -1, 'the edge mullion');
  assert.equal(paneAt(0, 0.2), -2, 'the plinth is off the glass');
  assert.equal(paneAt(20, 2), -2);
});

test('streets: six houses facing the centre, lawns that hold their owner, specials between lawns', () => {
  for (let s = 0; s < STREETS.length; s++) {
    const f = buildField(s);
    assert.equal(f.houses.length, 6);
    for (const h of f.houses) {
      // The facade's normal points at the centre.
      const toC = Math.hypot(h.cx + h.fx * 5, h.cz + h.fz * 5);
      assert.ok(toC < Math.hypot(h.cx, h.cz));
      assert.ok(inLawn(h.lawn, h.spawn.x, h.spawn.z));
      const out = clampToLawn(h.lawn, 0, 0, {});
      assert.ok(inLawn(h.lawn, out.x, out.z, 1e-6));
      // Lawns never overlap.
      for (const o of f.houses) if (o !== h) assert.ok(!inLawn(o.lawn, h.spawn.x, h.spawn.z));
    }
    assert.ok(f.spots.length >= 5);
    for (const sp of f.spots) assert.ok(Number.isFinite(sp.x) && Number.isFinite(sp.z));
  }
});

test('the wind is the same everywhere, inside the street range, calm in round 1 and stronger after the store closes', () => {
  for (let s = 0; s < STREETS.length; s++) {
    const f = buildField(s);
    const [lo, hi] = f.street.wind;
    for (let ms = 0; ms < 180000; ms += 3700) {
      const a = windAt(f, 42, 2, ms, {});
      const b = windAt(f, 42, 2, ms, {});
      assert.deepEqual(a, b);
      const late = ms >= STORE_CLOSE_MS ? WIND_LATE : 1;
      assert.ok(a.s >= lo * late - 1e-9 && a.s <= hi * late + 1e-9, `${f.street.id} ${a.s}`);
      const one = windAt(f, 42, 1, ms, {});
      assert.ok(Math.abs(one.s - a.s * WIND_ROUND1) < 1e-9);
      assert.ok(Math.abs(Math.hypot(a.x, a.z) - a.s) < 1e-9);
    }
  }
});

test('the aim solver hits the pane it aims at, with no wind, from every lawn to every house', () => {
  let tried = 0;
  let hit = 0;
  for (let s = 0; s < STREETS.length; s++) {
    const f = buildField(s);
    for (const from of f.houses) {
      for (const to of f.houses) {
        if (to === from) continue;
        for (const p of [2, 5, 14]) {
          const target = paneCentre(to, p, {});
          for (const high of [false, true]) {
            const aim = solveAim(from.spawn.x, from.elev, from.spawn.z, target, 'stone', { high });
            if (!aim) continue;
            tried++;
            const o = handOf(from.spawn.x, from.elev, from.spawn.z, aim.yaw, {});
            const v = velocityOf('stone', aim.yaw, aim.pitch, aim.power, {});
            const h = tracePath(f, 'stone', o, v, NO_WIND, null, null, 6);
            if (h.what === 'glass' && h.house === to.i && h.pane === p) hit++;
          }
        }
      }
    }
  }
  assert.ok(tried > 1000);
  // Some arcs pass through the oak, a palm or a roof: the bots choose another; most land.
  assert.ok(hit / tried > 0.6, `${hit}/${tried}`);
});

test('every house can be reached with a stone from every lawn', () => {
  for (let s = 0; s < STREETS.length; s++) {
    const f = buildField(s);
    for (const from of f.houses) {
      for (const to of f.houses) {
        if (to === from) continue;
        let ok = false;
        for (let p = 0; p < PANES && !ok; p++) {
          for (const high of [false, true]) {
            const aim = solveAim(from.spawn.x, from.elev, from.spawn.z, paneCentre(to, p, {}), 'stone', { high });
            if (!aim) continue;
            const o = handOf(from.spawn.x, from.elev, from.spawn.z, aim.yaw, {});
            const h = tracePath(f, 'stone', o, velocityOf('stone', aim.yaw, aim.pitch, aim.power, {}), NO_WIND, null, null, 6);
            if (h.what === 'glass' && h.house === to.i) ok = true;
          }
        }
        assert.ok(ok, `${f.street.id}: ${from.i} to ${to.i}`);
      }
    }
  }
});

test('a brick at full power still reaches across Palm Court', () => {
  const f = buildField(0);
  const from = f.houses[0];
  const to = f.houses[3];
  const aim = solveAim(from.spawn.x, 0, from.spawn.z, paneCentre(to, 4, {}), 'brick', { high: false });
  assert.ok(aim && aim.power <= 1);
  assert.ok(KINDS.brick.vmax < KINDS.stone.vmax);
});

test('stones stop on the ground, on the oak, and fall to the sea off Cliff Top', () => {
  const f = buildField(0);
  const g = tracePath(f, 'stone', { x: 15, y: 1.5, z: 0 }, { x: -2, y: 0, z: 0 }, NO_WIND, null, null, 4);
  assert.equal(g.what, 'ground');
  const oak = tracePath(f, 'stone', { x: 10, y: 3, z: 0 }, { x: -20, y: 0, z: 0 }, NO_WIND, null, null, 4);
  assert.equal(oak.what, 'tree');
  const cliff = buildField(3);
  // The open side of the horseshoe: halfway from the last house round to the first.
  const a = cliff.houses[5].angle + (2 * Math.PI - cliff.step * 5) / 2;
  const sea = tracePath(cliff, 'stone', { x: 15 * Math.cos(a), y: 2, z: 15 * Math.sin(a) }, { x: 25 * Math.cos(a), y: 3, z: 25 * Math.sin(a) }, NO_WIND, null, null, 8);
  assert.equal(sea.what, 'sea');
});

test('a stone into an empty frame flies into the house', () => {
  const f = buildField(0);
  const h = f.houses[2];
  const c = paneCentre(h, 4, {});
  const panes = new Uint8Array(PANES).fill(2);
  panes[4] = 0;
  const hit = tracePath(f, 'stone', { x: c.x + h.fx * 2, y: c.y, z: c.z + h.fz * 2 }, { x: -h.fx * 20, y: 0, z: -h.fz * 20 }, NO_WIND, (i) => (i === 2 ? panes : null), null, 2);
  assert.equal(hit.what, 'inside');
  assert.equal(hit.house, 2);
  void COLS;
});
