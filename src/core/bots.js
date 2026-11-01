// The neighbours: bots that look at the street the way a player does (houses, stones in the air, the windsock), take a moment to
// react, aim with a person's errors and play to a personality. One brain per seat, called every tick by the round on the page
// that controls it (the host's, or a player's own page in autoplay).

import { G, KINDS, AMMO_MAX, PANES, COLS, STORE_CLOSE_MS, SPECIAL_DROP_MS, holdFor, speedOf, EYE, HAND } from './config.js';
import { solveAim, tracePath, windAt, handOf, paneCentre, NO_WIND, launchAngle } from './physics.js';
import { glassCount } from './round.js';
import { clampToLawn } from './streets.js';
import { createRng, hash } from './rng.js';

export const PERSONAS = {
  walt: { name: 'Walt', cadence: [0.9, 1.5], lob: 0.75, target: 'revenge', repairBelow: 13, acc: 0, wild: 1, intercept: 0, dodge: 0.3, grab: 0.4, burst: 1 },
  twins: { name: 'The Twins', cadence: [0.3, 0.6], lob: 0.15, target: 'nearest', repairBelow: 5, acc: -0.08, wild: 1.25, intercept: -0.1, dodge: 0.85, grab: 0.6, burst: 1, soft: true },
  chad: { name: 'Chad', cadence: [0.35, 0.7], lob: 0, target: 'leader', repairBelow: 0, acc: -0.2, wild: 1.7, intercept: -0.2, dodge: 0.2, grab: 0.5, burst: 1, hard: true },
  lindqvist: { name: 'Mrs. Lindqvist', cadence: [1.0, 1.6], lob: 0.4, target: 'snipe', repairBelow: 9, acc: 0.15, wild: 0.7, intercept: 0.2, dodge: 0.4, grab: 0.2, burst: 1, wind: 0.15 },
  rosa: { name: 'Rosa', cadence: [0.7, 1.2], lob: 0.4, target: 'defend', repairBelow: 11, acc: 0, wild: 1, intercept: 0.05, dodge: 0.5, grab: 0.4, burst: 1 },
  sunny: { name: 'Sunny', cadence: [0.5, 1.0], lob: 0.3, target: 'repairers', repairBelow: 7, acc: 0, wild: 1, intercept: 0, dodge: 0.85, grab: 1, burst: 1, roam: true },
  ray: { name: 'Ray', cadence: [0.9, 1.5], lob: 0.45, target: 'weakest', repairBelow: 10, acc: 0, wild: 1, intercept: 0, dodge: 0.3, grab: 0.3, burst: 1 },
  bev: { name: 'Bev', cadence: [0.25, 0.45], lob: 0.3, target: 'revenge', repairBelow: 10, acc: 0, wild: 1, intercept: 0, dodge: 0.4, grab: 0.4, burst: 3, pause: [2.4, 3.4] },
  // The player's own seat in autoplay and a plain bot with no story.
  player: { name: 'Player', cadence: [0.5, 1.0], lob: 0.35, target: 'leader', repairBelow: 10, acc: 0.05, wild: 0.9, intercept: 0.1, dodge: 0.6, grab: 0.8, burst: 1 },
  // A beginner, for the balance tests: slow, no wind, repairs late.
  beginner: { name: 'Beginner', cadence: [1.0, 1.6], lob: 0.1, target: 'nearest', repairBelow: 6, acc: 0, wild: 1, intercept: -1, dodge: 0, grab: 0.3, burst: 1, noWind: true },
};

export const PERSONA_IDS = ['walt', 'twins', 'chad', 'lindqvist', 'rosa', 'sunny', 'ray', 'bev'];
export const personaByName = (name) => PERSONA_IDS.find((id) => PERSONAS[id].name === name) ?? null;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const DEG = Math.PI / 180;

export function createBrain(personaId, skill, seed) {
  const P = PERSONAS[personaId] ?? PERSONAS.player;
  const rng = createRng(hash(`brain:${seed}:${personaId}`));
  const sAcc = clamp(skill + (P.acc ?? 0), 0, 1);
  const st = {
    mode: 'start',
    thinkAt: 0,
    nextAt: rng.range(900, 2400) - skill * 500,
    target: -1,
    stick: 0,
    aim: null,
    aimUntil: 0,
    burst: 0,
    wander: null,
    wanderAt: 0,
    dodgeUntil: -1,
    dodgeX: 0,
    dodgeZ: 0,
    repairUntil: 0,
    goal: 0,
    grab: null,
    lastSeenThrow: '',
    targetBody: -1,
    windStart: -1e9,
  };
  const tmp = { x: 0, y: 0, z: 0 };
  const lawnTmp = { x: 0, z: 0, clamped: false };

  function moveToward(b, x, z, speed = 1) {
    const dx = x - b.x;
    const dz = z - b.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) {
      b.input.mx = 0;
      b.input.mz = 0;
      return true;
    }
    const ux = dx / d;
    const uz = dz / d;
    const rx = Math.cos(b.yaw);
    const rz = -Math.sin(b.yaw);
    const fx = -Math.sin(b.yaw);
    const fz = -Math.cos(b.yaw);
    const s = Math.min(1, d / 0.8) * speed;
    b.input.mx = (ux * rx + uz * rz) * s;
    b.input.mz = (ux * fx + uz * fz) * s;
    return false;
  }

  function pickWander(R, i) {
    const lawn = R.field.houses[i].lawn;
    const a = lawn.angle + rng.range(lawn.aMin - lawn.angle, lawn.aMax - lawn.angle) * (P.roam ? 1 : 0.6);
    const r = rng.range(lawn.rMin + 0.3, lawn.rMax - 0.3);
    clampToLawn(lawn, r * Math.cos(a), r * Math.sin(a), lawnTmp);
    st.wander = { x: lawnTmp.x, z: lawnTmp.z };
    st.wanderAt = R.now + rng.range(2500, 6000) * (P.roam ? 0.5 : 1);
  }

  function chooseTarget(R, i) {
    const houses = R.houses;
    const me = R.bodies[i];
    const t = R.now;
    const glassMax = Math.max(...houses.map((h, j) => (j === i || h.outAt >= 0 ? 0 : glassCount(h.panes))));
    R.botTargets ??= [];
    const options = [];
    for (let j = 0; j < houses.length; j++) {
      const h = houses[j];
      if (j === i || h.outAt >= 0) continue;
      const g = glassCount(h.panes);
      if (g === 0) continue;
      const f = R.field.houses[j];
      const d = Math.hypot(f.cx - (me.ghost ? me.gx : me.x), f.cz - (me.ghost ? me.gz : me.z));
      let w = P.target === 'nearest' ? (20 / d) ** 2 : (25 / d) ** 0.7;
      // Everyone likes to finish a house off.
      w *= 1 + (PANES - g) / 9;
      if (P.target === 'leader' && g === glassMax) w *= 3;
      if (P.target === 'weakest' || P.target === 'snipe') w *= 1 + (PANES - g) / (P.target === 'snipe' ? 8 : 5);
      if (P.target === 'snipe' && g === glassMax) w *= 1.8;
      if ((P.target === 'revenge' || P.target === 'defend') && houses[i].lastBy === j) w *= 4;
      if (P.target === 'defend' && R.incoming(i).some((s) => s.seat === j)) w *= 3;
      const seat = R.seats[j];
      // A new player on an easy street draws less fire: nobody at first, then one bot at a time, then less than half as much.
      if (seat?.gentle && !me.ghost) {
        if (t < 6000) w = 0;
        else if (t < 30000 && R.botTargets.some((tg, k) => k !== i && tg === j && R.seats[k]?.bot)) w = 0;
        else w *= 0.4;
      }
      const piled = R.botTargets.filter((tg, k) => k !== i && tg === j).length;
      if (piled >= 3) w *= 0.6;
      if (w > 0) options.push({ j, w });
    }
    if (!options.length) return -1;
    if (rng.chance(0.2)) return rng.pick(options).j;
    let sum = 0;
    for (const o of options) sum += o.w;
    let r = rng.next() * sum;
    for (const o of options) {
      r -= o.w;
      if (r <= 0) return o.j;
    }
    return options[options.length - 1].j;
  }

  function pickPane(R, j) {
    const panes = R.houses[j].panes;
    const glass = [];
    for (let p = 0; p < PANES; p++) if (panes[p] > 0) glass.push(p);
    if (!glass.length) return -1;
    // Ground floor a little more often: it's nearer.
    const low = glass.filter((p) => p < COLS);
    if (low.length && rng.chance(0.55)) return rng.pick(low);
    return rng.pick(glass);
  }

  /** A throw at a point, avoiding what is in the way, compensating the wind as well as this bot reads it. */
  function planThrow(R, i, point, house, kind) {
    const b = R.bodies[i];
    const ghost = b.ghost;
    const ox = ghost ? b.gx : b.x;
    const oz = ghost ? b.gz : b.z;
    const oy = ghost ? b.gy - 0.2 : b.y;
    const lobFirst = rng.chance(P.lob);
    let options;
    if (P.hard) options = [{ high: false, power: 1 }, { high: true, power: 1 }, { high: true }];
    else if (P.soft) options = [{ high: false }, { high: false, power: 0.5 }, { high: true }, { high: false, power: 0.9 }];
    else if (lobFirst) options = [{ high: true }, { high: true, power: 0.75 }, { high: false, power: 0.95 }, { high: false, power: 0.7 }];
    else options = [{ high: false, power: 0.95 }, { high: false, power: 0.75 }, { high: false }, { high: true }];
    const wind = windAt(R.field, R.seed, R.roundNo, R.now, { x: 0, z: 0, s: 0 });
    const read = P.noWind ? 0 : clamp(sAcc * 1.1 - 0.05 + (P.wind ?? 0), 0, 1);
    for (const opt of options) {
      let aimAt = { x: point.x, y: point.y, z: point.z };
      let sol = null;
      for (let it = 0; it < 3; it++) {
        sol = solve(ox, oy, oz, aimAt, kind, opt, ghost);
        if (!sol) break;
        if (it === 0) {
          // Is the way clear (no wind)?
          const h = trace(R, i, ox, oy, oz, sol, kind, NO_WIND, ghost);
          if (!(h.house === house && (h.what === 'glass' || h.what === 'frame'))) {
            sol = null;
            break;
          }
        }
        if (read <= 0.01 || wind.s < 0.05) break;
        const h = trace(R, i, ox, oy, oz, sol, kind, wind, ghost);
        const mx = (h.x - point.x) * read;
        const my = (h.y - point.y) * read;
        const mz = (h.z - point.z) * read;
        aimAt = { x: aimAt.x - mx, y: aimAt.y - my, z: aimAt.z - mz };
      }
      if (sol) return sol;
    }
    return null;
  }

  function solve(ox, oy, oz, target, kind, opt, ghost) {
    if (!ghost) return solveAim(ox, oy, oz, target, kind, { high: opt.high, power: opt.power, extra: 0.1 });
    // A ghost throws from its own middle, with no hand.
    const dx = target.x - ox;
    const dz = target.z - oz;
    const D = Math.hypot(dx, dz);
    const H = target.y - oy;
    const k = KINDS[kind];
    let power = opt.power;
    if (power === undefined) {
      const need = Math.sqrt(Math.max(0, G * (H + Math.hypot(H, D)))) * 1.1;
      power = clamp((need - k.vmin) / (k.vmax - k.vmin), 0, 1);
    }
    const ang = launchAngle(D, H, speedOf(kind, power), opt.high);
    if (ang === null) return null;
    return { yaw: Math.atan2(-dx, -dz), pitch: ang, power };
  }

  function trace(R, i, ox, oy, oz, sol, kind, wind, ghost) {
    const v = speedOf(kind, sol.power);
    const cp = Math.cos(sol.pitch);
    const vel = { x: -Math.sin(sol.yaw) * cp * v, y: Math.sin(sol.pitch) * v, z: -Math.cos(sol.yaw) * cp * v };
    let o;
    if (ghost) o = { x: ox, y: oy, z: oz };
    else o = handOf(ox, oy, oz, sol.yaw, { x: 0, y: 0, z: 0 });
    return tracePath(R.field, kind, o, vel, wind, R.panesOf, null, 4, 1 / 60, null, i);
  }

  function addError(sol, scale = 1) {
    const sig = ((1 - sAcc) * 2.5 + 0.25) * DEG * (P.wild ?? 1) * scale;
    sol.yaw += rng.normal() * sig;
    sol.pitch += rng.normal() * sig * 0.8;
    sol.power = clamp(sol.power + rng.normal() * ((1 - sAcc) * 0.06 + 0.01) * scale, 0, 1);
    return sol;
  }

  /** A throw that meets an incoming stone in the air: both share the wind and gravity, so their gap closes in a straight line. */
  function planIntercept(R, i, s) {
    const b = R.bodies[i];
    const wind = windAt(R.field, R.seed, R.roundNo, R.now, { x: 0, z: 0, s: 0 });
    const ax = wind.x;
    const az = wind.z;
    const k = KINDS.stone;
    let best = null;
    const hand = handOf(b.x, b.y, b.z, b.yaw, { x: 0, y: 0, z: 0 });
    const react = 0.12;
    for (let T = 0.4; T <= 1.6; T += 1 / 30) {
      // Where the incoming stone will be T seconds from now.
      const qx = s.x + s.vx * T + 0.5 * ax * T * T;
      const qy = s.y + s.vy * T - 0.5 * G * T * T;
      const qz = s.z + s.vz * T + 0.5 * az * T * T;
      if (qy < b.y + 0.4) break;
      if (s.predAt > 0 && R.now + T * 1000 > s.predAt - 40) break;
      let tw = 0.35;
      let ok = false;
      let vx = 0;
      let vy = 0;
      let vz = 0;
      let power = 0;
      for (let it = 0; it < 4; it++) {
        const tf = T - tw;
        if (tf <= 0.08) break;
        vx = (qx - hand.x - 0.5 * ax * tf * tf) / tf;
        vy = (qy - hand.y + 0.5 * G * tf * tf) / tf;
        vz = (qz - hand.z - 0.5 * az * tf * tf) / tf;
        const sp = Math.hypot(vx, vy, vz);
        power = (sp - k.vmin) / (k.vmax - k.vmin);
        if (power > 1.03 || power < -0.03) {
          ok = false;
          break;
        }
        power = clamp(power, 0, 1);
        tw = holdFor(power) / 1000 + react;
        ok = true;
      }
      if (!ok) continue;
      const sp = Math.hypot(vx, vy, vz);
      const yaw = Math.atan2(-vx, -vz);
      const pitch = Math.asin(clamp(vy / sp, -1, 1));
      best = { yaw, pitch, power };
      break;
    }
    return best;
  }

  function threats(R, i) {
    return R.incoming(i).filter((s) => s.kind !== 'pebble' && s.predAt - R.now > 350 && s.predAt - R.now < 2200);
  }

  function update(R, i, dtMs) {
    const b = R.bodies[i];
    const inp = b.input;
    const t = R.now;
    if (R.over) {
      inp.throwHeld = false;
      inp.repair = false;
      inp.mx = 0;
      inp.mz = 0;
      return;
    }
    // Keep winding up until the round lets go at the planned power.
    if (st.mode === 'wind') {
      if (b.lastThrowAt >= st.windStart || t > st.windStart + 1600) {
        inp.throwHeld = false;
        inp.releasePower = null;
        st.mode = 'cool';
        st.burst--;
        const c = P.cadence;
        let wait = rng.range(c[0], c[1]) * 1000 * (1.0 - 0.3 * skill);
        if (st.burst <= 0 && P.burst > 1) wait = rng.range(P.pause[0], P.pause[1]) * 1000;
        st.nextAt = t + wait;
        R.botTargets ??= [];
        R.botTargets[i] = st.target;
      } else inp.throwHeld = true;
    }
    if (t < st.thinkAt) {
      steer(R, i);
      return;
    }
    st.thinkAt = t + 90 + rng.range(0, 40);

    // Dodging a stone aimed at you.
    if (!b.ghost && t > st.dodgeUntil) {
      const coming = R.incoming(i).find((s) => s.pred === 'body' && s.predBody === i && s.predAt - t < 900 && s.predAt - t > 150);
      if (coming && rng.chance(P.dodge * (0.3 + 0.7 * skill) * 0.5)) {
        const vx = coming.vx;
        const vz = coming.vz;
        const l = Math.hypot(vx, vz) || 1;
        let px = -vz / l;
        let pz = vx / l;
        if (rng.chance(0.5)) {
          px = -px;
          pz = -pz;
        }
        st.dodgeUntil = t + 450;
        st.dodgeX = b.x + px * 3;
        st.dodgeZ = b.z + pz * 3;
      }
    }

    if (st.mode === 'repair') {
      const g = glassCount(R.houses[i].panes);
      const danger = threats(R, i).length > 0 && rng.chance(0.5);
      if (g >= st.goal || t > st.repairUntil || t >= STORE_CLOSE_MS || danger || R.houses[i].outAt >= 0) {
        st.mode = 'idle';
        inp.repair = false;
        st.nextAt = t + rng.range(150, 500);
      } else {
        inp.repair = true;
        inp.mx = 0;
        inp.mz = 0;
        return;
      }
    }
    if (st.mode === 'aim') {
      if (st.aim && t >= st.aimUntil) {
        inp.throwHeld = true;
        inp.releasePower = Math.max(0.001, st.aim.power);
        st.mode = 'wind';
        st.windStart = t;
      }
      steer(R, i);
      return;
    }
    if (st.mode === 'wind') {
      steer(R, i);
      return;
    }
    if (st.mode === 'start' || st.mode === 'cool' || st.mode === 'idle') {
      if (t >= st.nextAt) decide(R, i);
    }
    steer(R, i);
  }

  function decide(R, i) {
    const b = R.bodies[i];
    const inp = b.input;
    const t = R.now;
    inp.repair = false;
    inp.throwHeld = false;
    inp.releasePower = null;
    if (st.mode === 'cool' && st.burst <= 0) st.burst = P.burst;
    if (st.mode === 'start' || st.mode === 'idle') st.burst = Math.max(st.burst, 1);
    st.mode = 'idle';

    if (b.ghost) {
      if (b.pebbles <= 0 || t < b.poofUntil) {
        st.nextAt = t + 400;
        return;
      }
      let j = R.houses[i].lastBy;
      if (j < 0 || j === i || R.houses[j].outAt >= 0 || glassCount(R.houses[j].panes) === 0) j = chooseTarget(R, i);
      if (j < 0) {
        st.nextAt = t + 800;
        return;
      }
      st.target = j;
      const f = R.field.houses[j];
      // Drift towards that house, as far as a ghost may.
      const gr = R.field.ghostR * 0.92;
      st.wander = { x: (f.cx / R.field.R) * gr, z: (f.cz / R.field.R) * gr, ghost: true };
      const d = Math.hypot(f.cx - b.gx, f.cz - b.gz);
      if (d > R.field.R - R.field.ghostR + 4) {
        st.nextAt = t + 300;
        return;
      }
      const p = pickPane(R, j);
      if (p < 0) return;
      const pt = paneCentre(f, p, {});
      const sol = planThrow(R, i, pt, j, 'pebble');
      if (!sol) {
        st.nextAt = t + 500;
        return;
      }
      st.aim = addError(sol, 1.2);
      inp.yaw = st.aim.yaw;
      inp.pitch = st.aim.pitch;
      st.aimUntil = t + rng.range(250, 500);
      st.mode = 'aim';
      return;
    }

    const house = R.houses[i];
    const g = glassCount(house.panes);
    const ammo = b.ammo + (b.held ? 1 : 0);

    // Knock an incoming stone out of the air.
    const chance = clamp(skill - 0.3 + (P.intercept ?? 0), 0, 0.85);
    if (skill + (P.intercept ?? 0) > 0.5 && b.ammo > 0 && !b.held) {
      const list = threats(R, i);
      for (const s of list) {
        if (s.id === st.lastSeenThrow) continue;
        st.lastSeenThrow = s.id;
        if (!rng.chance(chance)) continue;
        const sol = planIntercept(R, i, s);
        if (!sol) continue;
        st.aim = addError(sol, 0.6);
        inp.yaw = st.aim.yaw;
        inp.pitch = st.aim.pitch;
        st.aimUntil = t + 60;
        st.mode = 'aim';
        return;
      }
    }

    // Repair while it's quiet.
    if (t < STORE_CLOSE_MS - 1500 && g <= P.repairBelow && g < PANES && threats(R, i).length === 0 && rng.chance(0.7)) {
      st.mode = 'repair';
      st.goal = Math.min(PANES, P.repairBelow + 1 + rng.int(3));
      st.repairUntil = t + rng.range(4000, 8000);
      inp.repair = true;
      return;
    }

    // A special landed next door.
    if (!b.held) {
      for (const sp of R.specials) {
        if (sp.gone || sp.holder >= 0 || (sp.a !== i && sp.b !== i) || t < sp.at + SPECIAL_DROP_MS * 0.5) continue;
        if (st.grab === sp.id || rng.chance(P.grab)) {
          st.grab = sp.id;
          st.wander = { x: sp.x, z: sp.z, grab: true };
          st.wanderAt = t + 3000;
          st.nextAt = t + 200;
          return;
        }
      }
    }

    if (ammo <= 0) {
      st.nextAt = t + 300;
      return;
    }

    // Sunny bonks people who stand still repairing.
    if (P.target === 'repairers' && !b.held) {
      for (let j = 0; j < R.bodies.length; j++) {
        const o = R.bodies[j];
        if (j === i || o.ghost || !o.repairing) continue;
        const pt = { x: o.x, y: o.y + 1.2, z: o.z };
        const sol = solveAim(b.x, b.y, b.z, pt, 'stone', { high: false, power: 0.9 });
        if (!sol) continue;
        st.aim = addError(sol);
        st.target = j;
        inp.yaw = st.aim.yaw;
        inp.pitch = st.aim.pitch;
        st.aimUntil = t + rng.range(200, 420);
        st.mode = 'aim';
        return;
      }
    }

    if (st.target < 0 || st.stick <= 0 || R.houses[st.target]?.outAt >= 0 || glassCount(R.houses[st.target].panes) === 0) {
      st.target = chooseTarget(R, i);
      st.stick = 3 + rng.int(4);
    }
    if (st.target < 0) {
      st.nextAt = t + 600;
      return;
    }
    const p = pickPane(R, st.target);
    if (p < 0) {
      st.target = -1;
      st.nextAt = t + 200;
      return;
    }
    const kind = b.held ?? 'stone';
    const pt = paneCentre(R.field.houses[st.target], p, {});
    pt.y += rng.range(-0.35, 0.35);
    const f = R.field.houses[st.target];
    const du = rng.range(-0.25, 0.25);
    pt.x += f.rx * du;
    pt.z += f.rz * du;
    // Specials go at the house with the most glass.
    const sol = planThrow(R, i, pt, st.target, kind);
    if (!sol) {
      st.stick = 0;
      st.target = -1;
      st.nextAt = t + 250;
      return;
    }
    st.stick--;
    st.aim = addError(sol);
    inp.yaw = st.aim.yaw;
    inp.pitch = st.aim.pitch;
    // Turning to aim takes a moment: longer for a big turn and a less skilled bot.
    let dy = Math.abs(st.aim.yaw - b.yaw) % (2 * Math.PI);
    if (dy > Math.PI) dy = 2 * Math.PI - dy;
    st.aimUntil = t + 120 + dy * 200 + (1 - skill) * rng.range(100, 350);
    st.mode = 'aim';
    R.botTargets ??= [];
    R.botTargets[i] = st.target;
  }

  function steer(R, i) {
    const b = R.bodies[i];
    const inp = b.input;
    const t = R.now;
    if (b.ghost) {
      if (!st.wander || !st.wander.ghost) {
        inp.mx = 0;
        inp.mz = 0;
        return;
      }
      const dx = st.wander.x - b.gx;
      const dz = st.wander.z - b.gz;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) {
        inp.mx = 0;
        inp.mz = 0;
      } else {
        const rx = Math.cos(b.yaw);
        const rz = -Math.sin(b.yaw);
        const fx = -Math.sin(b.yaw);
        const fz = -Math.cos(b.yaw);
        inp.mx = ((dx / d) * rx + (dz / d) * rz) * 0.8;
        inp.mz = ((dx / d) * fx + (dz / d) * fz) * 0.8;
      }
      return;
    }
    if (st.mode === 'repair') {
      inp.mx = 0;
      inp.mz = 0;
      return;
    }
    if (t < st.dodgeUntil) {
      moveToward(b, st.dodgeX, st.dodgeZ, 1);
      return;
    }
    // People stand still to throw (Sunny doesn't).
    if ((st.mode === 'aim' || st.mode === 'wind') && !P.roam && !(st.wander && st.wander.grab)) {
      inp.mx = 0;
      inp.mz = 0;
      return;
    }
    if (!st.wander || t > st.wanderAt) pickWander(R, i);
    const there = moveToward(b, st.wander.x, st.wander.z, st.wander.grab ? 1 : P.roam ? 0.9 : 0.6);
    if (there && st.wander.grab) {
      st.wander = null;
      st.grab = null;
    }
  }

  return { update, state: st, persona: personaId, skill };
}

/** Skill for a neighbour on a street: the street's range, spread over the seats. */
export function skillFor(street, k, n) {
  const [lo, hi] = street.skill;
  return Math.round((lo + ((hi - lo) * (k + 0.5)) / Math.max(1, n)) * 100) / 100;
}

export { AMMO_MAX, EYE, HAND };
