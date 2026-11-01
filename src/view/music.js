// Lounge jazz from a little sequencer: a walking upright bass, brushes and ride, vibraphone chords with tremolo. A ii-V-i in D minor at
// 112. Quieter in menus; bongos when three houses are left, faster at two, a tense vamp after the store closes.

import { audioContext, musicBus, isHushed } from './audio.js';

const MIDI = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Bars of the loop: chord tones (MIDI) for the vibes, and a walking line (4 beats) for the bass.
const PROG = [
  { vibes: [64, 67, 70, 74], bass: [40, 43, 46, 47] }, // Em7b5
  { vibes: [61, 64, 67, 69], bass: [45, 49, 52, 51] }, // A7
  { vibes: [62, 65, 69, 72], bass: [38, 41, 45, 48] }, // Dm7
  { vibes: [62, 65, 69, 71], bass: [50, 48, 47, 45] }, // Dm6
  { vibes: [65, 69, 72, 76], bass: [41, 45, 48, 50] }, // Fmaj7
  { vibes: [67, 70, 74, 77], bass: [43, 46, 50, 49] }, // Gm7
  { vibes: [64, 67, 70, 74], bass: [40, 43, 46, 44] }, // Em7b5
  { vibes: [61, 65, 67, 70], bass: [45, 44, 43, 42] }, // A7b9
];
const VAMP = [
  { vibes: [62, 65, 69, 72], bass: [38, 45, 38, 45] },
  { vibes: [63, 67, 70, 74], bass: [39, 46, 39, 46] },
];

let on = false;
let timer = null;
let nextT = 0;
let step = 0;
let mode = 'menu'; // menu | play | tense | frantic | late | off
let bus = null;
let volume = 0.5;

function voice(freq, type, t, dur, vol, attack = 0.005) {
  const ctx = audioContext();
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
  return { o, g };
}

function vibe(freq, t, dur, vol) {
  const ctx = audioContext();
  const v = voice(freq, 'sine', t, dur, vol, 0.004);
  // Tremolo: the vibraphone's motor.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const depth = ctx.createGain();
  depth.gain.value = vol * 0.35;
  lfo.connect(depth);
  depth.connect(v.g.gain);
  lfo.start(t);
  lfo.stop(t + dur + 0.05);
  voice(freq * 4, 'sine', t, 0.25, vol * 0.12, 0.002);
}

// A few takes of each cymbal and brush, made once.
const hits = new Map();
function hitBuffer(ctx, kind) {
  let set = hits.get(kind);
  if (!set) {
    set = [];
    hits.set(kind, set);
  }
  if (set.length < 3) {
    const len = kind === 'ride' ? 0.35 : kind === 'brush' ? 0.18 : 0.12;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sr * len), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, kind === 'ride' ? 3 : 2);
    set.push(buf);
    return buf;
  }
  return set[Math.floor(Math.random() * set.length)];
}

function hit(t, kind, vol) {
  const ctx = audioContext();
  const s = ctx.createBufferSource();
  s.buffer = hitBuffer(ctx, kind);
  const f = ctx.createBiquadFilter();
  f.type = kind === 'ride' ? 'highpass' : 'bandpass';
  f.frequency.value = kind === 'ride' ? 6500 : kind === 'brush' ? 2500 : 900;
  const g = ctx.createGain();
  g.gain.value = vol;
  s.connect(f);
  f.connect(g);
  g.connect(bus);
  s.start(t);
}

function bongo(t, high, vol) {
  const ctx = audioContext();
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(high ? 420 : 300, t);
  o.frequency.exponentialRampToValueAtTime(high ? 260 : 180, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + 0.2);
}

function schedule() {
  const ctx = audioContext();
  if (!ctx || !on || isHushed()) return;
  const bpm = mode === 'frantic' ? 128 : mode === 'menu' ? 104 : 112;
  const eighth = 60 / bpm / 2;
  // After a stall, pick up from now instead of playing every missed note at once.
  if (nextT < ctx.currentTime - 0.1) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.25) {
    const t = nextT;
    const prog = mode === 'late' || mode === 'frantic' ? VAMP : PROG;
    const bar = Math.floor(step / 8) % prog.length;
    const e = step % 8;
    const chord = prog[bar];
    const loud = mode === 'menu' ? 0.55 : mode === 'results' ? 0.85 : 1;
    // Swing: the off-beat eighths come late.
    const swingT = e % 2 ? t + eighth * 0.32 : t;
    if (e % 2 === 0) {
      const n = chord.bass[e / 2];
      voice(MIDI(n), 'triangle', t, eighth * 1.8, 0.32 * loud, 0.01);
      voice(MIDI(n) * 2, 'sine', t, eighth * 0.6, 0.06 * loud, 0.004);
    }
    if (mode !== 'menu') {
      // Ride: ding, ding-a ding.
      if (e % 2 === 0 || e === 3 || e === 7) hit(swingT, 'ride', 0.05 * (e % 4 === 0 ? 1.2 : 0.8));
      if (e === 2 || e === 6) hit(t, 'brush', 0.12);
      if (mode === 'tense' || mode === 'frantic') {
        if (e % 2 === 1 || e === 4) bongo(swingT, e % 4 === 1, 0.18);
      }
    }
    // Vibes: comping on beat 1 and the "and" of 2.
    if (e === 0 || e === 3 || (mode === 'late' && e === 6)) {
      const dur = eighth * (e === 0 ? 3.2 : 2.4);
      for (const nn of chord.vibes) vibe(MIDI(nn), swingT, dur, 0.035 * loud);
    }
    // A little melody now and then in play.
    if (mode === 'play' && e === 5 && bar % 2 === 1) vibe(MIDI(chord.vibes[3] + 12), swingT, eighth * 2, 0.05);
    nextT += eighth;
    step++;
  }
}

export const music = {
  start() {
    const ctx = audioContext();
    if (!ctx) return;
    if (!bus) {
      bus = ctx.createGain();
      bus.gain.value = volume;
      bus.connect(musicBus());
    }
    if (on) return;
    on = true;
    nextT = ctx.currentTime + 0.1;
    step = 0;
    timer = setInterval(schedule, 60);
  },
  stop() {
    on = false;
    if (timer) clearInterval(timer);
    timer = null;
  },
  set(m) {
    if (m === mode) return;
    mode = m;
    if (bus) bus.gain.setTargetAtTime(m === 'menu' ? volume * 0.7 : volume, audioContext().currentTime, 0.4);
  },
  get mode() {
    return mode;
  },
};
