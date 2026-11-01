// Every sound, made with Web Audio: glass bursting, stones whooshing, clunks and clacks, the glazier's squeak, the shop bell, the
// wind and the birds. Far sounds are quieter and duller. Started by the first tap in the game.

let ctx = null;
let master = null;
let sfx = null;
let amb = null;
let noiseBuf = null;
let windGain = null;
let windFilter = null;
let birdsAt = 0;
let night = false;
let snow = false;
let creak = null;
let windAt = 0;

export function audioContext() {
  return ctx;
}

export function startAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
    return null;
  }
  master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp);
  // Then a soft limiter, so a knockout's sting over a shower of glass bends instead of clipping.
  const pre = ctx.createGain();
  pre.gain.value = 0.5;
  const soft = ctx.createWaveShaper();
  const curve = new Float32Array(2049);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = (0.97 * Math.tanh(2 * x)) / Math.tanh(2);
  }
  soft.curve = curve;
  soft.oversample = '2x';
  comp.connect(pre);
  pre.connect(soft);
  soft.connect(ctx.destination);
  sfx = ctx.createGain();
  sfx.gain.value = 0.9;
  sfx.connect(master);
  amb = ctx.createGain();
  amb.gain.value = 0.5;
  amb.connect(master);
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  // The wind: noise through a moving band-pass, always on.
  const wn = ctx.createBufferSource();
  wn.buffer = noiseBuf;
  wn.loop = true;
  windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 400;
  windFilter.Q.value = 0.7;
  windGain = ctx.createGain();
  windGain.gain.value = 0.02;
  wn.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(amb);
  wn.start();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export const musicBus = () => master;

function noise(dur, t0 = 0) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loopStart = Math.random();
  s.loop = true;
  s.start(ctx.currentTime + t0, Math.random() * 1.5);
  s.stop(ctx.currentTime + t0 + dur + 0.05);
  return s;
}

function env(g, t, a, peak, dec) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}

/** Distance makes a sound quieter and duller: returns { gain, cutoff }. */
function far(dist) {
  const d = Math.max(0, dist ?? 0);
  return { gain: 1 / (1 + d / 14), cutoff: 16000 / (1 + d / 10) };
}

function out(dist, pan = 0) {
  const f = far(dist);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.max(600, f.cutoff);
  const g = ctx.createGain();
  g.gain.value = f.gain;
  let node = lp;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    lp.connect(p);
    node = p;
  }
  node.connect(g);
  g.connect(sfx);
  return lp;
}

function tone(freq, type, t0, dur, vol, dest, slideTo) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + t0 + dur);
  const g = ctx.createGain();
  env(g, ctx.currentTime + t0, 0.004, vol, dur);
  o.connect(g);
  g.connect(dest);
  o.start(ctx.currentTime + t0);
  o.stop(ctx.currentTime + t0 + dur + 0.05);
}

// Hushed: no sound is made at all (the trailer's capture skips ahead without a soundtrack to render).
let hushed = false;
export const hush = (on) => (hushed = !!on);
export const isHushed = () => hushed;

const ok = () => !!ctx && ctx.state !== 'closed' && !hushed;

export const sound = {
  /** A pane bursts: a bright crash, ringing pings, a tinkle as shards land. own: your house (louder, a thud under it). */
  shatter(dist, pan, own = false, big = 1) {
    if (!ok()) return;
    const dest = out(own ? 0 : dist, pan);
    const t = ctx.currentTime;
    const n = noise(0.5);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2400;
    const g = ctx.createGain();
    env(g, t, 0.002, 0.9 * big, 0.28);
    n.connect(hp);
    hp.connect(g);
    g.connect(dest);
    const pings = 4 + Math.floor(Math.random() * 3);
    for (let k = 0; k < pings; k++) tone(2600 + Math.random() * 4200, 'sine', Math.random() * 0.06, 0.25 + Math.random() * 0.4, 0.12, dest);
    // The tinkle tail: little clicks as shards hit the floor.
    for (let k = 0; k < 10; k++) {
      const at = 0.18 + Math.random() * 0.7;
      tone(3500 + Math.random() * 5000, 'triangle', at, 0.05, 0.05 * (1 - at), dest);
    }
    if (own) tone(90, 'sine', 0, 0.3, 0.6, dest, 50);
  },
  crack(dist, pan) {
    if (!ok()) return;
    const dest = out(dist, pan);
    tone(3800, 'square', 0, 0.03, 0.18, dest);
    tone(5200, 'sine', 0.01, 0.35, 0.1, dest);
  },
  clunk(dist, pan, what) {
    if (!ok()) return;
    const dest = out(dist, pan);
    const f = what === 'frame' || what === 'own' ? 520 : what === 'roof' ? 180 : 260;
    tone(f, 'triangle', 0, 0.12, 0.35, dest, f * 0.6);
    const n = noise(0.08);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2;
    const g = ctx.createGain();
    env(g, ctx.currentTime, 0.002, 0.25, 0.07);
    n.connect(bp);
    bp.connect(g);
    g.connect(dest);
  },
  thud(dist, pan, snowy) {
    if (!ok()) return;
    const dest = out(dist, pan);
    const n = noise(0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = snowy ? 500 : 900;
    const g = ctx.createGain();
    env(g, ctx.currentTime, 0.004, 0.35, 0.16);
    n.connect(lp);
    lp.connect(g);
    g.connect(dest);
  },
  throw(power) {
    if (!ok()) return;
    const dest = out(0, 0.25);
    const n = noise(0.35);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(500 + power * 600, ctx.currentTime);
    bp.frequency.exponentialRampToValueAtTime(2200 + power * 1500, ctx.currentTime + 0.18);
    const g = ctx.createGain();
    env(g, ctx.currentTime, 0.03, 0.5 + power * 0.3, 0.22);
    n.connect(bp);
    bp.connect(g);
    g.connect(dest);
  },
  /** The wind-up creak: a filtered rising rasp that tightens with power. */
  windup(power) {
    if (!ok()) return;
    // Only changes reach the audio thread: a target set every frame piles up on slower devices.
    if (creak ? Math.abs(power - creak.power) < 0.02 && (power > 0) === (creak.power > 0) : power <= 0) return;
    if (!creak) {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuf;
      n.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 9;
      const g = ctx.createGain();
      g.gain.value = 0;
      n.connect(bp);
      bp.connect(g);
      g.connect(sfx);
      n.start();
      creak = { n, bp, g, power: 0 };
    }
    creak.power = power;
    const t = ctx.currentTime;
    creak.bp.frequency.setTargetAtTime(300 + power * 900, t, 0.03);
    creak.g.gain.setTargetAtTime(power > 0 ? 0.05 + power * 0.08 : 0, t, 0.04);
  },
  whoosh(dist, pan, incoming) {
    if (!ok()) return;
    const dest = out(Math.max(0, dist - 3), pan);
    const n = noise(0.5);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(1400, ctx.currentTime);
    bp.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.4);
    const g = ctx.createGain();
    env(g, ctx.currentTime, 0.08, 0.45, 0.35);
    n.connect(bp);
    bp.connect(g);
    g.connect(dest);
    if (incoming) tone(900, 'sine', 0, 0.4, 0.07, dest, 1800);
  },
  clack(dist, pan) {
    if (!ok()) return;
    const dest = out(dist, pan);
    tone(1900, 'square', 0, 0.04, 0.3, dest, 1200);
    tone(2300, 'square', 0.05, 0.04, 0.25, dest, 1500);
    for (let k = 0; k < 6; k++) tone(5000 + Math.random() * 3000, 'sawtooth', 0.02 + Math.random() * 0.12, 0.02, 0.05, dest);
  },
  bonk(dist, pan, me) {
    if (!ok()) return;
    const dest = out(me ? 0 : dist, pan);
    tone(600, 'sine', 0, 0.22, me ? 0.6 : 0.4, dest, 200);
    if (me) tone(3200, 'sine', 0.05, 0.9, 0.04, dest);
  },
  squeak(dist) {
    if (!ok()) return;
    const dest = out(dist, 0);
    tone(1400 + Math.random() * 400, 'sawtooth', 0, 0.09, 0.04, dest, 2200);
  },
  ting(dist) {
    if (!ok()) return;
    const dest = out(dist, 0);
    tone(2637, 'sine', 0, 0.6, 0.22, dest);
    tone(3951, 'sine', 0.02, 0.4, 0.08, dest);
  },
  grab(kind) {
    if (!ok()) return;
    const dest = out(0, 0);
    if (kind === 'brick') tone(140, 'triangle', 0, 0.2, 0.5, dest, 80);
    else {
      tone(900, 'square', 0, 0.08, 0.12, dest, 1500);
      tone(1500, 'square', 0.07, 0.08, 0.1, dest, 1100);
    }
  },
  wheee(dist, pan) {
    if (!ok()) return;
    const dest = out(dist, pan);
    tone(700, 'triangle', 0, 0.8, 0.12, dest, 1800);
  },
  bell() {
    if (!ok()) return;
    const dest = out(0, 0);
    for (const [f, at] of [[1568, 0], [2093, 0.12], [1568, 0.5]]) {
      tone(f, 'sine', at, 1.2, 0.18, dest);
      tone(f * 2.76, 'sine', at, 0.5, 0.05, dest);
    }
    // The door shuts.
    tone(110, 'triangle', 0.9, 0.18, 0.4, dest, 70);
  },
  /** A house falls: a cascade of shatters and a falling vibraphone line. */
  fall(dist, pan, mine) {
    if (!ok()) return;
    for (let k = 0; k < 4; k++) setTimeout(() => sound.shatter(dist, pan, false, 0.7), k * 90);
    const dest = out(mine ? 0 : Math.min(dist, 20), pan);
    [784, 659, 523, 392].forEach((f, k) => tone(f, 'sine', 0.35 + k * 0.16, 0.7, 0.2, dest));
  },
  win(big) {
    if (!ok()) return;
    const dest = out(0, 0);
    const notes = big ? [523, 659, 784, 1047, 1319, 1568] : [587, 740, 880, 1175];
    notes.forEach((f, k) => {
      tone(f, 'sine', k * 0.11, 1.0, 0.2, dest);
      tone(f / 2, 'triangle', k * 0.11, 0.4, 0.12, dest);
    });
  },
  lose() {
    if (!ok()) return;
    const dest = out(0, 0);
    [440, 415, 392, 330].forEach((f, k) => tone(f, 'triangle', k * 0.18, 0.5, 0.16, dest));
  },
  click() {
    if (!ok()) return;
    tone(1800, 'square', 0, 0.025, 0.12, out(0, 0));
  },
  porch(on) {
    if (!ok()) return;
    const dest = out(0, 0);
    tone(on ? 2200 : 1700, 'square', 0, 0.02, 0.15, dest);
    tone(on ? 900 : 700, 'triangle', 0.02, 0.05, 0.12, dest);
  },
  /** A stone catches fire in your hand: a whump, a roar that settles into crackle. */
  ignite() {
    if (!ok()) return;
    const dest = out(0, 0);
    const t = ctx.currentTime;
    tone(70, 'sine', 0, 0.35, 0.7, dest, 40);
    const n = noise(0.7);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.6);
    const g = ctx.createGain();
    env(g, t, 0.02, 0.8, 0.6);
    n.connect(lp);
    lp.connect(g);
    g.connect(dest);
    for (let k = 0; k < 9; k++) tone(1800 + Math.random() * 2600, 'square', 0.1 + Math.random() * 0.5, 0.012, 0.06, dest);
  },
  /** A hot stone in the air: a roar that passes. */
  roar(dist, pan) {
    if (!ok()) return;
    const dest = out(dist, pan);
    const t = ctx.currentTime;
    const n = noise(0.9);
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(1600, t + 0.25);
    bp.frequency.exponentialRampToValueAtTime(400, t + 0.85);
    const g = ctx.createGain();
    env(g, t, 0.05, 0.7, 0.8);
    n.connect(bp);
    bp.connect(g);
    g.connect(dest);
    for (let k = 0; k < 7; k++) tone(1500 + Math.random() * 3000, 'square', Math.random() * 0.7, 0.01, 0.05, dest);
  },
  /** Your stone landed on glass: a bright ding in the ear, higher the hotter your streak. */
  ding(level = 0) {
    if (!ok()) return;
    const dest = out(0, 0);
    const f = 1568 * Math.pow(2, Math.min(4, level) / 12 * 2);
    tone(f, 'sine', 0, 0.35, 0.16, dest);
    tone(f * 1.5, 'sine', 0.035, 0.28, 0.08, dest);
  },
  /** A heat pip lights (n: how many now). */
  heat(n) {
    if (!ok()) return;
    const dest = out(0, 0);
    const f = [523, 659, 784, 988][Math.max(0, Math.min(3, n - 1))];
    tone(f, 'triangle', 0, 0.16, 0.16, dest);
    tone(f * 2, 'sine', 0.02, 0.1, 0.06, dest);
  },
  /** Heat lost: a hiss and a fall. */
  cool() {
    if (!ok()) return;
    const dest = out(0, 0);
    const n = noise(0.35);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const g = ctx.createGain();
    env(g, ctx.currentTime, 0.01, 0.22, 0.32);
    n.connect(hp);
    hp.connect(g);
    g.connect(dest);
    tone(660, 'triangle', 0, 0.3, 0.1, dest, 330);
  },
  /** A knockout: a brass stab, a cymbal; yours gets the full fanfare. */
  ko(mine) {
    if (!ok()) return;
    const dest = out(0, 0);
    const t = ctx.currentTime;
    const stab = (freqs, at, dur, vol) => {
      for (const f of freqs) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * 0.985, t + at);
        o.frequency.exponentialRampToValueAtTime(f, t + at + 0.05);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 2;
        lp.frequency.setValueAtTime(600, t + at);
        lp.frequency.exponentialRampToValueAtTime(3800, t + at + 0.06);
        lp.frequency.exponentialRampToValueAtTime(900, t + at + dur);
        const g = ctx.createGain();
        env(g, t + at, 0.012, vol, dur);
        o.connect(lp);
        lp.connect(g);
        g.connect(dest);
        o.start(t + at);
        o.stop(t + at + dur + 0.05);
      }
    };
    if (mine) {
      stab([392, 494, 587], 0, 0.14, 0.12);
      stab([392, 494, 587], 0.16, 0.14, 0.12);
      stab([523, 659, 784, 1047], 0.32, 0.9, 0.14);
    } else stab([311, 392, 466], 0, 0.5, 0.1);
    const n = noise(1.2);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const g = ctx.createGain();
    env(g, t + (mine ? 0.32 : 0), 0.005, 0.25, 1.1);
    n.connect(hp);
    hp.connect(g);
    g.connect(dest);
    tone(55, 'sine', mine ? 0.32 : 0, 0.5, 0.6, dest, 35);
  },
  /** A trick shot: a quick rising run. */
  trick(n = 1) {
    if (!ok()) return;
    const dest = out(0, 0);
    const notes = [784, 988, 1175, 1568, 1976];
    for (let k = 0; k < Math.min(5, 2 + n); k++) tone(notes[k], 'triangle', k * 0.05, 0.22, 0.13, dest);
    tone(2637, 'sine', 0.05 * (2 + n), 0.5, 0.06, dest);
  },
  /** A golden pane: coins. */
  coin() {
    if (!ok()) return;
    const dest = out(0, 0);
    tone(1319, 'square', 0, 0.07, 0.08, dest);
    tone(1976, 'square', 0.07, 0.4, 0.08, dest);
    tone(2637, 'sine', 0.07, 0.6, 0.06, dest);
  },
  /** A pane glazed back from a knockout. */
  salvage() {
    if (!ok()) return;
    const dest = out(0, 0);
    [1047, 1319, 1568, 2093].forEach((f, k) => tone(f, 'sine', k * 0.06, 0.5, 0.1, dest));
  },
  /** Hail on everything: a rattle of ticks for `secs`. */
  hail(secs = 3) {
    if (!ok()) return;
    const dest = out(4, 0);
    for (let k = 0; k < secs * 70; k++) {
      const at = Math.random() * secs;
      const fade = at < 0.4 ? at / 0.4 : at > secs - 0.6 ? (secs - at) / 0.6 : 1;
      tone(2500 + Math.random() * 5500, Math.random() < 0.5 ? 'square' : 'triangle', at, 0.015, 0.035 * fade, dest);
    }
    const n = noise(secs);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 5000;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.4);
    g.gain.setValueAtTime(0.12, ctx.currentTime + secs - 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + secs);
    n.connect(bp);
    bp.connect(g);
    g.connect(dest);
  },
  /** The paper lands: a slap and a rustle. */
  paper() {
    if (!ok()) return;
    const dest = out(0, 0);
    const n = noise(0.3);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    env(g, ctx.currentTime, 0.003, 0.5, 0.25);
    n.connect(bp);
    bp.connect(g);
    g.connect(dest);
    tone(160, 'sine', 0, 0.12, 0.35, dest, 90);
  },
  /** A level gained: a fanfare. */
  levelUp() {
    if (!ok()) return;
    const dest = out(0, 0);
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, k) => {
      tone(f, 'triangle', k * 0.09, k === 6 ? 1.1 : 0.25, 0.14, dest);
      tone(f / 2, 'sine', k * 0.09, 0.3, 0.08, dest);
    });
  },
  /** A line printed on the receipt: the till's key coming down, a little higher each line. */
  tick(k = 0) {
    if (!ok()) return;
    const dest = out(0, 0);
    const n = noise(0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400 + k * 90;
    bp.Q.value = 3;
    const g = ctx.createGain();
    env(g, ctx.currentTime, 0.002, 0.32, 0.045);
    n.connect(bp);
    bp.connect(g);
    g.connect(dest);
    tone(180 + k * 6, 'triangle', 0, 0.06, 0.22, dest, 120);
    tone(1200 + k * 40, 'square', 0.005, 0.02, 0.04, dest);
  },
  /** The total: the drawer springs out and the bell rings. */
  till() {
    if (!ok()) return;
    const dest = out(0, 0);
    const n = noise(0.12);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    env(g, ctx.currentTime, 0.003, 0.35, 0.12);
    n.connect(bp);
    bp.connect(g);
    g.connect(dest);
    tone(90, 'triangle', 0, 0.16, 0.3, dest, 60);
    for (const [f, v] of [[2093, 0.2], [2637, 0.12], [4186, 0.05]]) tone(f, 'sine', 0.05, 1.4, v, dest);
  },
  /** A dog's bark across the lawns. */
  bark(dist, pan) {
    if (!ok()) return;
    const dest = out(dist, pan);
    for (const at of [0, 0.22]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const t = ctx.currentTime + at;
      o.frequency.setValueAtTime(520, t);
      o.frequency.exponentialRampToValueAtTime(260, t + 0.11);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 2.5;
      const g = ctx.createGain();
      env(g, t, 0.006, 0.4, 0.12);
      o.connect(bp);
      bp.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + 0.2);
    }
  },
  count(n) {
    if (!ok()) return;
    const dest = out(0, 0);
    tone(n > 0 ? 440 : 880, 'triangle', 0, 0.14, 0.35, dest);
    tone(n > 0 ? 220 : 440, 'sine', 0, 0.2, 0.25, dest);
  },
};

/** The street's ambience: wind by strength, birds by day, crickets at night, a hush in the snow. */
export function ambience(windStrength, dt, opts = {}) {
  if (!ok() || !windGain) return;
  night = !!opts.night;
  snow = !!opts.snow;
  // The wind follows four times a second (its glide is half a second anyway).
  windAt -= dt;
  if (windAt <= 0) {
    windAt = 0.25;
    const t = ctx.currentTime;
    const s = Math.min(1, windStrength / 3);
    windGain.gain.setTargetAtTime(0.015 + s * (snow ? 0.06 : 0.09), t, 0.5);
    windFilter.frequency.setTargetAtTime(250 + s * 700, t, 0.5);
  }
  birdsAt -= dt;
  if (birdsAt <= 0 && !opts.quiet) {
    birdsAt = 1.5 + Math.random() * 4;
    const dest = out(18 + Math.random() * 20, Math.random() * 2 - 1);
    if (night) {
      for (let k = 0; k < 6; k++) tone(4200, 'square', k * 0.06, 0.02, 0.025, dest);
    } else if (!snow) {
      const base = 2400 + Math.random() * 1600;
      for (let k = 0; k < 3; k++) tone(base * (1 + k * 0.08), 'sine', k * 0.09, 0.07, 0.04, dest, base * 1.25);
    }
  }
}

export function setVolume(v) {
  if (master) master.gain.value = v;
}
