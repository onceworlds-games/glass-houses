// A street, built from its field: the ground, the road, the lawns and kerbs, six houses each with its own build (a butterfly roof,
// a Swiss Miss gable, Neutra beams, a folded plate, a chimney, a clerestory), walls in stucco, flagstone, redwood or brick, a pastel
// front door, the breeze-block mailbox wall with the number, a carport with a finned sedan, a kidney pool or a cactus garden, fan
// palms behind; inside, a double-height living room with a loft, lamps that go out when the house does. Around it the desert, palms,
// and the mountains in haze; in the middle the oak (or the car, the planter, the pine, the boulder); the hardware store; the windsock.
// Glass is drawn by glass.js; the people by people.js.

import * as THREE from 'three';
import { createBuilder, houseFrame, sectorGeometry, arcWallGeometry } from './build.js';
import { OWNERS, LIGHTS, drawSymbol } from './palette.js';
import { textures } from './textures.js';
import { SHARED, LIT, swayMaterial, waterMaterial, interiorMaterial, glowMaterial } from './materials.js';
import * as P from './props.js';
import { COLS, ROWS, PANE_W, PANE_H, MULLION, PLINTH, FACADE_W, FACADE_H, HOUSE_DEPTH, ROOF_Y, ROOF_T, ROOF_OVER } from '../core/config.js';
import { roofRise, ROOF_HALF, RISE_FROM } from '../core/houses.js';
import { createRng } from '../core/rng.js';

const HALF_W = FACADE_W / 2;
const CELL_U = PANE_W + MULLION;
const CELL_Y = PANE_H + MULLION;
const ROOF_TOP = ROOF_Y + ROOF_T;
const LOFT_Y = PLINTH + CELL_Y + MULLION / 2;

/** A house number plate: an enamel plate in the owner's colour, the count in big cream numerals with a hard low-sun shadow. */
export function drawNumberPlate(g, w, h, n, owner, out) {
  g.clearRect(0, 0, w, h);
  const r = 22;
  g.fillStyle = 'rgba(30,20,30,0.35)';
  roundRect(g, 10, 14, w - 14, h - 18, r);
  g.fill();
  g.fillStyle = out ? '#2A2238' : owner.color;
  roundRect(g, 4, 4, w - 14, h - 18, r);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(255,248,235,0.85)';
  roundRect(g, 13, 13, w - 32, h - 36, r - 8);
  g.stroke();
  g.font = `700 ${Math.round(h * 0.62)}px "Josefin Sans", "Jost", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const label = String(n);
  g.fillStyle = 'rgba(42,34,56,0.55)';
  g.fillText(label, w / 2 - 14 + 8, h / 2 + 4 + 8);
  g.fillStyle = '#F3E9D8';
  g.fillText(label, w / 2 - 14, h / 2 + 4);
  drawSymbol(g, owner.symbol, w - 46, 44, 34, out ? '#5A5068' : 'rgba(255,248,235,0.9)');
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Stretches a geometry's 0..1 UVs to metres (sx by sy). */
function uvScale(g, sx, sy) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
}

function mixColor(a, b, t) {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

/** A pastel of an owner's colour, for doors and accents. */
function pastel(c, k = 0.35) {
  return mixColor(c, '#FFF6EA', k);
}

/** A prism: polygon `pts` ([u, y]...) in the u-y plane, from d0 to d1, with UVs in metres. */
function prism(pts, d0, d1) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d1 - d0, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, d0);
  return g;
}

/** A thin slab from (u0, y0) to (u1, y1) (its top surface), thickness t, from d0 to d1: a roof plane. */
function slope(u0, y0, u1, y1, t, d0, d1, over = 0) {
  const len = Math.hypot(u1 - u0, y1 - y0) + over * 2;
  const g = new THREE.BoxGeometry(len, t, d1 - d0);
  g.rotateZ(Math.atan2(y1 - y0, u1 - u0));
  g.translate((u0 + u1) / 2, (y0 + y1) / 2 - t / 2, (d0 + d1) / 2);
  return g;
}

// ------------------------------------------------------------------ the street

export function buildStreet(field, quality = 'medium') {
  const T = textures();
  const L = LIGHTS[field.street.light] ?? LIGHTS.golden;
  const snow = !!L.snow;
  const night = !!L.night;
  const B = createBuilder();
  const IN = createBuilder();
  const root = new THREE.Group();
  const R = field.R;
  const rng = createRng(field.index * 101 + 5);
  const I = new THREE.Matrix4();
  const lawnColor = snow ? '#F4F6F8' : L.ground;
  const sand = L.sand;
  const concrete = snow ? '#E9ECEF' : '#E6DCCB';
  const white = '#F7F2E8';
  const terrace = field.terrace;
  const islandR = field.street.centre === 'planter' ? 3.0 : field.street.centre === 'car' ? 6.2 : 4.6;
  const roadOut = terrace - 0.6;
  const lowDetail = quality === 'low';
  const el = (L.sunEl * Math.PI) / 180;
  const az = (L.sunAz * Math.PI) / 180;
  const sunDir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  const glows = [];

  // ---------------------------------------------------------------- ground
  B.add('lawn', sectorGeometry(0, islandR, 0, Math.PI * 2, 0.0, 2, 48, () => (snow ? '#F1F3F5' : mixColor(L.ground, '#9DB45A', 0.15))), I);
  B.add('road', sectorGeometry(islandR, roadOut, 0, Math.PI * 2, 0.0, 2, 96, () => (snow ? '#C9CDD3' : night ? '#3E3A44' : '#55504E')), I);
  B.add('solid', sectorGeometry(roadOut, terrace + 0.02, 0, Math.PI * 2, 0.02, 1, 96, () => concrete), I);
  B.add('solid', arcWallGeometry(islandR, 0, Math.PI * 2, 0, 0.18, 64), I, concrete);
  // A dashed centre line on the ring road, in faded yellow.
  if (!snow) {
    const mid = (islandR + roadOut) / 2;
    const dashes = Math.round((2 * Math.PI * mid) / 3);
    for (let k = 0; k < dashes; k++) {
      const a0 = (k / dashes) * Math.PI * 2;
      B.add('paint', sectorGeometry(mid - 0.06, mid + 0.06, a0, a0 + 1.4 / mid, 0.012, 1, 2, () => '#E9C46A'), I);
    }
  }
  const outR = R + 46;
  for (const h of field.houses) {
    const a0 = h.angle - field.step / 2;
    const a1 = h.angle + field.step / 2;
    const y = h.elev;
    const lawn = h.lawn;
    if (field.sea && field.inSea(a0 + 0.01) && field.inSea(a1 - 0.01)) continue;
    B.add('lawn', sectorGeometry(terrace, lawn.rMax + 0.4, a0, a1, y + 0.03, 3, 18, (r) => mixColor(lawnColor, snow ? '#FFFFFF' : '#5C7A30', snow ? 0 : 0.18 * Math.max(0, (r - terrace) / 6))), I);
    B.add('solid', sectorGeometry(lawn.rMax + 0.4, R + 2.6, a0, a1, y + 0.04, 2, 18, () => concrete), I);
    B.add('ground', sectorGeometry(R + 2.6, outR, a0, a1, y, 4, 18, (r) => (snow ? '#EEF1F4' : mixColor(mixColor(sand, L.ground, 0.45), sand, Math.min(1, (r - R - 2.6) / 16)))), I);
    B.add('ground', sectorGeometry(outR - 0.5, 600, a0, a1, y - 0.02, 3, 10, (r) => (snow ? '#E8ECF0' : mixColor(sand, L.fog, Math.min(0.5, (r - outR) / 500)))), I);
    if (y > 0.01) B.add('stone', arcWallGeometry(terrace, a1, a0, 0, y + 0.03, 12), I);
    for (const a of [lawn.aMin, lawn.aMax]) {
      const m = new THREE.Matrix4().makeRotationY(-a);
      const midR = (lawn.rMin + lawn.rMax) / 2;
      const g = new THREE.BoxGeometry(lawn.rMax - lawn.rMin + 0.8, 0.12, 0.16);
      g.translate(midR, y + 0.06, 0);
      B.add('solid', g, m, concrete);
    }
  }
  for (let i = 0; i < field.houses.length; i++) {
    const h = field.houses[i];
    const n = field.houses[(i + 1) % field.houses.length];
    if (!field.ring && i === field.houses.length - 1) break;
    if (Math.abs(h.elev - n.elev) < 0.01) continue;
    const a = h.angle + field.step / 2;
    const lo = Math.min(h.elev, n.elev);
    const hi = Math.max(h.elev, n.elev);
    const len = outR - terrace;
    const g = new THREE.BoxGeometry(len, hi - lo + 0.04, 0.5);
    g.translate(terrace + len / 2, (lo + hi) / 2, 0);
    B.add('stone', g, new THREE.Matrix4().makeRotationY(-a));
  }
  let sea = null;
  if (field.sea) {
    const last = field.houses[field.houses.length - 1];
    const first = field.houses[0];
    const s0 = last.angle + field.step / 2;
    const s1 = first.angle - field.step / 2 + Math.PI * 2;
    B.add('lawn', sectorGeometry(terrace, R - 4, s0, s1, 0.03, 2, 24, () => lawnColor), I);
    B.add('cliff', arcWallGeometry(R - 4, s0, s1, -34, 0.03, 32), I, '#B88A62');
    for (const a of [s0, s1]) {
      const g = new THREE.BoxGeometry(outR - (R - 4), 34, 0.6);
      g.translate(R - 4 + (outR - R + 4) / 2, -17, 0);
      B.add('cliff', g, new THREE.Matrix4().makeRotationY(-a), '#A97B55');
    }
    for (let k = 0; k <= 24; k++) {
      const a = s0 + ((s1 - s0) * k) / 24;
      const g = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 5);
      g.translate((R - 4.3) * Math.cos(a), 0.5, (R - 4.3) * Math.sin(a));
      B.add('smooth', g, I, white);
    }
    B.add('smooth', arcWallGeometry(R - 4.3, s0, s1, 0.85, 0.95, 32), I, white);
    sea = new THREE.Mesh(new THREE.CircleGeometry(900, 64), new THREE.MeshStandardMaterial({ color: '#2E6E96', roughness: 0.12, metalness: 0.0, envMapIntensity: 1.2 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -30;
    root.add(sea);
  }

  // ---------------------------------------------------------------- houses
  const plates = [];
  const porch = [];
  const flags = [];
  const tvs = [];
  for (const h of field.houses) {
    const F = houseFrame(h);
    const owner = OWNERS[h.i % OWNERS.length];
    const st = h.style;
    const hr = createRng(field.index * 977 + h.i * 31 + 3);
    const door = pastel(owner.color, 0.2);
    const trim = hr.chance(0.5) ? white : '#3A3442';
    const wallKey = st.walls === 'stone' ? 'stone' : st.walls === 'brick' ? 'brick' : st.walls === 'board' ? 'board' : 'stucco';
    const wallColor = st.walls === 'board' ? (hr.chance(0.5) ? '#B07A52' : pastel(owner.color, 0.55)) : st.walls === 'stucco' || st.walls === 'breeze' ? (snow ? '#F4F2EE' : '#F4EEE4') : null;
    const wall = (w, hh, d, u, y, dd) => B.box(wallKey, F, w, hh, d, u, y, dd, wallColor, 1);

    // Plinth, step and patio.
    B.box('terrazzo', F, FACADE_W + 0.6, PLINTH, HOUSE_DEPTH + 0.8, 0, PLINTH / 2, -HOUSE_DEPTH / 2 + 0.4, concrete, 1);
    B.box('solid', F, FACADE_W + 6.4, 0.08, 2.6, 1.2, 0.06, 1.7, concrete);
    // Concrete stepping pads across the lawn's edge.
    for (let k = 0; k < 3; k++) B.box('solid', F, 0.9, 0.06, 0.6, HALF_W + 2.0 - k * 0.15, 0.06, 3.3 + k * 0.85, concrete);

    // Side walls and the back wall.
    wall(0.6, ROOF_Y, HOUSE_DEPTH, -(HALF_W + 0.3), ROOF_Y / 2, -HOUSE_DEPTH / 2);
    wall(0.6, ROOF_Y, HOUSE_DEPTH, HALF_W + 0.3, ROOF_Y / 2, -HOUSE_DEPTH / 2);
    wall(FACADE_W + 1.2, ROOF_Y, 0.4, 0, ROOF_Y / 2, -HOUSE_DEPTH + 0.2);
    // The entry wing on the left: a lower block with the front door in a pastel of the owner's colour.
    const ew0 = -HALF_W - 3.4;
    const ew1 = -HALF_W - 0.6;
    wall(ew1 - ew0, 3.25, 5.2, (ew0 + ew1) / 2, 1.625, -3.4);
    B.box('smooth', F, ew1 - ew0 + 0.8, 0.22, 6.2, (ew0 + ew1) / 2 - 0.2, 3.36, -3.0, white);
    B.box('board', F, ew1 - ew0 + 0.6, 0.02, 0.95, (ew0 + ew1) / 2 - 0.2, 3.24, -0.38, '#B9805A', 1);
    // The door: double leaves with raised diamonds, a brass pull, a narrow side light, a step.
    const du = (ew0 + ew1) / 2 + 0.25;
    B.box('solid', F, 1.7, 2.5, 0.1, du, 1.25, -0.78, door);
    for (let k = 0; k < 6; k++) {
      const g = new THREE.BoxGeometry(0.26, 0.26, 0.06);
      g.rotateZ(Math.PI / 4);
      g.translate(du + (k % 2 ? 0.42 : -0.42), 0.55 + Math.floor(k / 2) * 0.7, -0.72);
      B.add('solid', g, F, mixColor(door, '#FFFFFF', 0.4));
    }
    B.box('solid', F, 0.03, 2.5, 0.12, du, 1.25, -0.74, mixColor(door, '#2A2238', 0.3));
    B.box('chrome', F, 0.05, 0.5, 0.05, du + 0.12, 1.2, -0.68, '#E0B860');
    B.box('cglass', F, 0.36, 2.4, 0.06, du - 1.1, 1.25, -0.78, '#26343C');
    B.box('solid', F, 2.4, 0.12, 0.9, du, 0.06, -0.35, concrete);
    // Light by the door.
    const lamp = new THREE.CylinderGeometry(0.09, 0.12, 0.34, 10);
    lamp.translate(du + 1.05, 2.0, -0.7);
    B.add('lampOut', lamp, F, '#FFE2A8', h.i);

    // The roof: a white slab with a deep fascia, a redwood soffit under the cantilever.
    B.box('smooth', F, 2 * ROOF_HALF, ROOF_T, HOUSE_DEPTH + 0.6 + ROOF_OVER, 0, ROOF_Y + ROOF_T / 2, (-HOUSE_DEPTH - 0.6 + ROOF_OVER) / 2, white);
    B.box('smooth', F, 2 * ROOF_HALF + 0.04, ROOF_T + 0.12, 0.12, 0, ROOF_Y + ROOF_T / 2 - 0.06, ROOF_OVER - 0.04, trim === white ? white : '#3A3442');
    B.box('board', F, 2 * ROOF_HALF - 0.1, 0.02, ROOF_OVER + 0.2, 0, ROOF_Y - 0.01, ROOF_OVER / 2 - 0.1, '#C08A5E', 1);
    // A thin owner-colour stripe along the fascia.
    B.box('solid', F, 2 * ROOF_HALF + 0.06, 0.07, 0.02, 0, ROOF_Y + 0.05, ROOF_OVER + 0.03, owner.color);
    roofShape(B, F, st, white, owner, hr, wallKey, wallColor, h.i, IN.tagged(h.i));

    // Mullions: uprights and rails, flush with the glass.
    for (let k = 0; k <= COLS; k++) {
      const u = -HALF_W + k * CELL_U + MULLION / 2;
      B.box('smooth', F, MULLION, FACADE_H, 0.16, u, PLINTH + FACADE_H / 2, 0, trim);
    }
    for (let k = 0; k <= ROWS; k++) {
      const y = PLINTH + k * CELL_Y + MULLION / 2;
      B.box('smooth', F, FACADE_W, MULLION, 0.16, 0, y, 0, trim);
    }

    // The mailbox wall in breeze block, right of the glass: the number on its street face, a mailbox in the owner's colour.
    B.box('breeze', F, 2.2, 1.9, 0.3, HALF_W + 2.0, 0.95, 1.8, null, 1);
    B.box('smooth', F, 2.4, 0.08, 0.42, HALF_W + 2.0, 1.94, 1.8, white);
    B.box('solid', F, 0.2, 1.9, 0.36, HALF_W + 0.95, 0.95, 1.8, white);
    B.box('solid', F, 0.2, 1.9, 0.36, HALF_W + 3.05, 0.95, 1.8, white);
    B.box('solid', F, 0.34, 0.42, 0.4, HALF_W + 3.4, 1.2, 1.8, owner.color);
    B.box('solid', F, 0.06, 1.0, 0.06, HALF_W + 3.4, 0.5, 1.8, '#3A3442');

    // The house number: a canvas plate, drawn again when the count changes.
    const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (cv) {
      cv.width = 256;
      cv.height = 200;
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.37), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.3, metalness: 0.1 }));
      const p = new THREE.Vector3(HALF_W + 2.0, 1.0, 1.97).applyMatrix4(F);
      mesh.position.copy(p);
      mesh.lookAt(p.x + h.fx, p.y, p.z + h.fz);
      root.add(mesh);
      plates.push({ cv, tex, n: -1, out: false, owner });
    } else plates.push(null);

    // A porch light on the mailbox wall (on in the lobby when its owner is ready, and at night).
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: '#FFE6B0', emissive: new THREE.Color('#FFC46B'), emissiveIntensity: 0 }));
    bulb.position.copy(new THREE.Vector3(HALF_W + 0.95, 2.08, 1.8).applyMatrix4(F));
    root.add(bulb);
    porch.push(bulb);

    // The flag on its pole at the lawn's front corner: the owner's colour and the wind.
    const la = h.lawn.aMax - 0.02;
    const lr = h.lawn.rMax + 0.9;
    const px = lr * Math.cos(la);
    const pz = lr * Math.sin(la);
    const pole = new THREE.CylinderGeometry(0.045, 0.07, 5.6, 8);
    pole.translate(px, h.elev + 2.8, pz);
    B.add('chrome', pole, I, '#E9EEF2');
    const ball = new THREE.SphereGeometry(0.09, 8, 6);
    ball.translate(px, h.elev + 5.65, pz);
    B.add('chrome', ball, I, '#E0B860');
    flags.push(makeFlag(owner, px, h.elev + 5.0, pz));
    root.add(flags[flags.length - 1].mesh);

    // The side yard, right of the house.
    yard(B, F, st.yard, h, hr, snow, concrete, white);

    // Palms behind: the skyline every lawn sees across the street.
    const nb = lowDetail ? 1 : 2;
    for (let k = 0; k < nb; k++) {
      const u = k === 0 ? hr.range(-HALF_W - 2, -1) : hr.range(2, HALF_W + 4);
      const d = -HOUSE_DEPTH - hr.range(2.2, 5.5);
      P.fanPalm(B, P.at(F, u, 0, d), hr.range(10, 14.5), field.index * 100 + h.i * 7 + k, snow);
    }
    if (!lowDetail) {
      // A tidy strip of agave and gravel under the glass, either side of the step.
      for (const u of [-HALF_W - 1.4, HALF_W + 4.2]) {
        B.add('ground', new THREE.CylinderGeometry(0.9, 0.95, 0.05, 14).translate(0, 0.04, 0), P.at(F, u, 0, 0.9), snow ? '#F4F6F8' : '#D9C8AE');
        P.agave(B, P.at(F, u, 0.05, 0.9, hr.range(0, 6)), 0.85, h.i * 13 + u, snow);
      }
    }

    // Inside.
    interior(IN.tagged(h.i), F, h, owner, hr, L, T);
  }

  // ---------------------------------------------------------------- the middle
  centre(B, field, rng, snow, concrete);

  // ---------------------------------------------------------------- the desert round the street
  const ring = lowDetail ? 10 : 22;
  for (let k = 0; k < ring; k++) {
    const a = (k / ring) * Math.PI * 2 + rng.range(-0.08, 0.08);
    if (field.sea && field.inSea(a)) continue;
    const r = R + 22 + rng.range(0, 22);
    const elev = field.groundY(r * Math.cos(a), r * Math.sin(a));
    const M = P.at(null, r * Math.cos(a), elev, r * Math.sin(a), rng.range(0, 6));
    const roll = rng.next();
    if (roll < 0.45) P.fanPalm(B, M, rng.range(9, 15), k * 13 + field.index, snow);
    else if (roll < 0.6) P.queenPalm(B, M, rng.range(6, 8), k * 17, snow);
    else if (roll < 0.8) P.boulder(B, M, rng.range(1.2, 2.6), k * 3 + 1, snow ? '#E8ECF0' : '#B9926E');
    else P.scrub(B, M, rng.range(0.8, 1.4), k * 5, snow);
  }
  if (!lowDetail) {
    for (let k = 0; k < 70; k++) {
      const a = rng.range(0, Math.PI * 2);
      if (field.sea && field.inSea(a)) continue;
      const r = R + 18 + rng.range(0, 70);
      const elev = field.groundY(r * Math.cos(a), r * Math.sin(a));
      const M = P.at(null, r * Math.cos(a), elev, r * Math.sin(a), rng.range(0, 6));
      if (rng.chance(0.75)) P.scrub(B, M, rng.range(0.4, 0.9), k * 7 + 3, snow);
      else P.boulder(B, M, rng.range(0.4, 1.1), k * 11, snow ? '#E8ECF0' : '#B9926E');
    }
    // A grove of tall palms in the middle distance, as silhouettes.
    for (let k = 0; k < 26; k++) {
      const a = rng.range(0, Math.PI * 2);
      if (field.sea && field.inSea(a)) continue;
      const r = rng.range(95, 170);
      P.fanPalm(B, P.at(null, r * Math.cos(a), 0, r * Math.sin(a)), rng.range(12, 18), 500 + k, snow);
    }
  }
  mountains(B, L, sunDir, field, rng);

  // ---------------------------------------------------------------- the hardware store, where the road leaves the ring
  const storeA = field.ring ? field.houses[0].angle - field.step / 2 : field.houses[0].angle - field.step * 0.75;
  const store = buildStore(B, storeA, R, white, concrete);
  root.add(store.group);
  B.add('road', sectorGeometry(terrace, R + 18, storeA - 0.12 * (22 / R), storeA + 0.12 * (22 / R), 0.05, 2, 3, () => (snow ? '#C9CDD3' : '#55504E')), I);

  // ---------------------------------------------------------------- the windsock, big, on a mast by the middle
  const sock = buildWindsock(white);
  const sockA = field.houses[0].angle + Math.PI + field.step * 0.5;
  const sockR = field.street.centre === 'planter' ? 2.9 : islandR - 0.6;
  sock.group.position.set(sockR * Math.cos(sockA), 0, sockR * Math.sin(sockA));
  root.add(sock.group);

  // ---------------------------------------------------------------- materials
  const tile = (t, m) => {
    if (t) t.repeat.set(1 / m, 1 / m);
    return t;
  };
  const mats = {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }),
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
    smooth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.04 }),
    chrome: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.16, metalness: 1.0, envMapIntensity: 1.3 }),
    car: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
    dark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.3, envMapIntensity: 1.4 }),
    cglass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.04, metalness: 0.4, envMapIntensity: 1.8 }),
    lamp: glowMaterial(2.2),
    carLight: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.1 }),
    lampOut: glowMaterial(night ? 3.2 : 1.6, true),
    stone: new THREE.MeshStandardMaterial({ map: tile(T.stone, 2.6), roughness: 0.92, color: snow ? '#E6E1DA' : '#ffffff' }),
    brick: new THREE.MeshStandardMaterial({ map: tile(T.brick, 1.6), roughness: 0.9 }),
    board: new THREE.MeshStandardMaterial({ vertexColors: true, map: tile(T.board, 2.4), roughness: 0.78 }),
    stucco: new THREE.MeshStandardMaterial({ vertexColors: true, map: tile(T.stucco, 3), roughness: 0.94 }),
    breeze: new THREE.MeshStandardMaterial({ map: tile(T.breeze, 0.8), roughness: 0.9, alphaTest: 0.5, side: THREE.DoubleSide }),
    terrazzo: new THREE.MeshStandardMaterial({ vertexColors: true, map: tile(T.terrazzo, 2.5), roughness: 0.6 }),
    lawn: new THREE.MeshStandardMaterial({ vertexColors: true, map: tile(T.grass, 5), roughness: 1 }),
    ground: new THREE.MeshStandardMaterial({ vertexColors: true, map: tile(T.sand, 4), roughness: 1 }),
    road: new THREE.MeshStandardMaterial({ vertexColors: true, map: tile(T.road, 7), roughness: 0.92 }),
    pool: waterMaterial(),
    plant: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }),
    sway: swayMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
    far: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }),
    cliff: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
  };
  const statics = B.build(mats, { noShadow: ['ground', 'road', 'lawn', 'far', 'pool', 'paint', 'lampOut', 'lamp', 'cglass'] });
  root.add(statics);
  for (const m of statics.children) if (m.name === 'far' || m.name === 'cliff') m.castShadow = false;

  // Inside: lit by lamps, dimmed when a house is out.
  const inSelf = night ? 0.42 : 0.2;
  const inMats = {
    in: interiorMaterial({ self: inSelf, glow: L.interior }),
    inWood: interiorMaterial({ map: tile(T.walnut, 2), self: inSelf, glow: L.interior }),
    inTerr: interiorMaterial({ map: T.terrazzo, self: inSelf, glow: L.interior }),
    inStone: interiorMaterial({ map: T.stone, self: inSelf * 0.8, glow: L.interior }),
    inBoard: interiorMaterial({ map: T.board, self: inSelf, glow: L.interior }),
    inRug: interiorMaterial({ map: T.rug, self: inSelf, glow: L.interior }),
    inArt: interiorMaterial({ map: T.art, self: inSelf * 1.4, glow: '#FFFFFF' }),
    inLamp: glowMaterial(night ? 3.6 : 2.4, true),
    inGlassTri: interiorMaterial({ self: night ? 2.2 : 0.7, glow: L.interior, roughness: 0.1 }),
    inScreen: glowMaterial(night ? 1.4 : 0.6, true),
  };
  const insides = IN.build(inMats, { noShadow: Object.keys(inMats) });
  for (const m of insides.children) {
    m.castShadow = false;
    m.receiveShadow = m.name !== 'inLamp' && m.name !== 'inScreen';
  }
  root.add(insides);
  for (let i = 0; i < 6; i++) LIT.value[i] = 1;

  const S = {
    root,
    plates,
    porch,
    flags,
    store,
    sock,
    sea,
    field,
    tvs,
    glows,
    dispose() {
      const keep = new Set([...Object.values(T).flat()]);
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) {
            if (m.map && !keep.has(m.map)) m.map.dispose();
            m.dispose();
          }
        }
      });
    },
  };

  /** Draws a house's number when it changed. */
  S.setNumber = function setNumber(i, n, out) {
    const p = plates[i];
    if (!p || (p.n === n && p.out === out)) return;
    p.n = n;
    p.out = out;
    drawNumberPlate(p.cv.getContext('2d'), p.cv.width, p.cv.height, n, p.owner, out);
    p.tex.needsUpdate = true;
  };

  /** A house's lights: 1 on, 0 off (it eases between). */
  const litTo = [1, 1, 1, 1, 1, 1];
  S.setLit = function setLit(i, lit) {
    if (i >= 0 && i < 6) litTo[i] = lit ? 1 : 0;
  };

  S.setPorch = function setPorch(i, on) {
    const b = porch[i];
    if (b) b.material.emissiveIntensity = on ? 3.2 : night ? 1.4 : 0;
  };

  /** Flags, the windsock and the palms follow the wind; lights ease on and off (flicker on the way out). */
  S.update = function update(dt, t, wind) {
    const s = Math.min(1, (wind?.s ?? 0) / 3);
    const ang = Math.atan2(wind?.z ?? 0, wind?.x ?? 1);
    for (const f of flags) f.update(t, ang, s);
    sock.update(dt, ang, s);
    SHARED.time.value = t;
    SHARED.wind.value.set(Math.cos(ang), Math.sin(ang), 0, Math.max(0.15, s));
    for (let i = 0; i < 6; i++) {
      const cur = LIT.value[i];
      if (cur === litTo[i]) continue;
      if (litTo[i] < cur) {
        // Going out: a stutter, then dark.
        const k = Math.max(0, cur - dt * 1.4);
        LIT.value[i] = k < 0.02 ? 0 : k * (0.55 + 0.45 * Math.abs(Math.sin(t * 37 + i)));
        if (k < 0.02) LIT.value[i] = 0;
        else LIT.value[i] = Math.max(0.02, k - (Math.sin(t * 53 + i) > 0.6 ? 0.5 : 0));
      } else LIT.value[i] = Math.min(1, cur + dt * 3);
    }
  };

  for (let i = 0; i < field.houses.length; i++) {
    S.setNumber(i, 20, false);
    S.setPorch(i, false);
  }
  return S;
}

// ------------------------------------------------------------------ the roofs

function roofShape(B, F, st, white, owner, hr, wallKey, wallColor, house, IN) {
  const d0 = -HOUSE_DEPTH - 0.6;
  const d1 = RISE_FROM;
  const H = ROOF_HALF;
  const glassC = '#2A3A44';
  if (st.roof === 'butterfly') {
    // Two wings rising to the sides; under them, clerestory triangles of glass facing the street.
    const rise = roofRise('butterfly', H);
    for (const s of [-1, 1]) {
      B.add('stucco', prism([[0, ROOF_TOP], [s * H, ROOF_TOP], [s * H, ROOF_TOP + rise - 0.2]], d0 + 0.2, d1 - 0.2), F, '#F4EEE4');
      B.add('smooth', slope(s * (H + 0.25), ROOF_TOP + rise + 0.03, 0, ROOF_TOP + 0.03, 0.26, d0, d1 + 0.02), F, white);
      IN.add('inGlassTri', prism([[s * 0.3, ROOF_TOP + 0.06], [s * (H - 0.45), ROOF_TOP + 0.06], [s * (H - 0.45), ROOF_TOP + rise - 0.38]], d1 - 0.24, d1 - 0.16), F, '#8A7A66');
      // Mullions across each triangle.
      for (let k = 1; k < 4; k++) {
        const u = s * (0.3 + ((H - 0.75) * k) / 4);
        const top = ROOF_TOP + 0.06 + (rise - 0.44) * (Math.abs(u) - 0.3) / (H - 0.75);
        B.box('smooth', F, 0.06, top - ROOF_TOP, 0.06, u, (ROOF_TOP + top) / 2, d1 - 0.14, white);
      }
    }
  } else if (st.roof === 'swiss') {
    // The Swiss Miss: a steep gable over the middle, its face in vertical boards with a diamond window.
    const top = roofRise('swiss', 0);
    const half = top / 1.2;
    B.add('board', prism([[-half, ROOF_TOP], [half, ROOF_TOP], [0, ROOF_TOP + top]], d0 + 0.3, d1 - 0.1), F, '#B9805A');
    for (const s of [-1, 1]) B.add('smooth', slope(0, ROOF_TOP + top + 0.18, s * (half + 0.55), ROOF_TOP - 0.4, 0.18, d0, d1 + 0.35, 0), F, '#3A3442');
    const win = new THREE.BoxGeometry(0.9, 0.9, 0.08);
    win.rotateZ(Math.PI / 4);
    win.translate(0, ROOF_TOP + top * 0.42, d1 - 0.06);
    B.add('cglass', win, F, glassC);
    const frame = new THREE.BoxGeometry(1.1, 1.1, 0.05);
    frame.rotateZ(Math.PI / 4);
    frame.translate(0, ROOF_TOP + top * 0.42, d1 - 0.1);
    B.add('smooth', frame, F, white);
    // Pointed finial at the peak.
    const fin = new THREE.ConeGeometry(0.08, 0.7, 6);
    fin.translate(0, ROOF_TOP + top + 0.45, d1 + 0.2);
    B.add('smooth', fin, F, white);
  } else if (st.roof === 'folded') {
    // A folded plate: five folds across the front, each a pair of triangles.
    const pts = [[-H, ROOF_TOP]];
    for (let k = 0; k <= 10; k++) {
      const u = -H + (k / 10) * 2 * H;
      pts.push([u, ROOF_TOP + roofRise('folded', u)]);
    }
    pts.push([H, ROOF_TOP]);
    B.add('stucco', prism(pts.slice(1, -1).map(([u, y]) => [u, y]).concat([[H, ROOF_TOP - 0.01], [-H, ROOF_TOP - 0.01]]), d0, d1), F, '#F7F2E8');
    for (let k = 0; k < 10; k++) {
      const ua = -H + (k / 10) * 2 * H;
      const ub = -H + ((k + 1) / 10) * 2 * H;
      B.add('smooth', slope(ua, ROOF_TOP + roofRise('folded', ua) + 0.02, ub, ROOF_TOP + roofRise('folded', ub) + 0.02, 0.12, d0 - 0.1, d1 + 0.12), F, k % 2 ? '#EDE6DA' : white);
    }
  } else if (st.roof === 'beams') {
    // Neutra's beams: run out past the slab at both sides, painted dark, over a band of clerestory along the back.
    const n = 7;
    for (let k = 0; k < n; k++) {
      const d = d0 + 0.6 + (k / (n - 1)) * (ROOF_OVER - 0.5 - d0 - 0.6);
      B.box('smooth', F, 2 * (H + st.reach), ROOF_T * 0.9, 0.24, 0, ROOF_Y + ROOF_T / 2, d, '#3A3442');
    }
    // A dark fascia over the white.
    B.box('smooth', F, 2 * H + 0.08, ROOF_T + 0.14, 0.14, 0, ROOF_Y + ROOF_T / 2 - 0.06, ROOF_OVER - 0.02, '#3A3442');
    B.box('smooth', F, 2 * H - 2, 0.08, 0.3, 0, ROOF_TOP + 0.3, -HOUSE_DEPTH + 0.6, white);
  } else if (st.roof === 'chimney') {
    // A big flagstone chimney, capped, on the left.
    const c = st.solids[0];
    B.box('stone', F, c.u1 - c.u0, c.y1 - c.y0, c.d1 - c.d0, (c.u0 + c.u1) / 2, (c.y0 + c.y1) / 2, (c.d0 + c.d1) / 2, null, 1);
    B.box('solid', F, c.u1 - c.u0 + 0.3, 0.14, c.d1 - c.d0 + 0.3, (c.u0 + c.u1) / 2, c.y1 + 0.07, (c.d0 + c.d1) / 2, '#E2D8C6');
    B.box('dark', F, (c.u1 - c.u0) * 0.5, 0.1, (c.d1 - c.d0) * 0.5, (c.u0 + c.u1) / 2, c.y1 + 0.15, (c.d0 + c.d1) / 2, '#2A2228');
  } else if (st.roof === 'clerestory') {
    const c = st.solids[0];
    const w = c.u1 - c.u0;
    const dd = c.d1 - c.d0;
    const cu = (c.u0 + c.u1) / 2;
    const cd = (c.d0 + c.d1) / 2;
    IN.add('inGlassTri', new THREE.BoxGeometry(w - 0.1, 0.8, dd - 0.1).translate(cu, ROOF_TOP + 0.45, cd), F, '#2A3640');
    for (let k = 0; k <= 6; k++) B.box('smooth', F, 0.08, 0.85, 0.08, c.u0 + (k / 6) * w, ROOF_TOP + 0.45, c.d1, white);
    B.box('smooth', F, w + 1.0, 0.2, dd + 1.0, cu, c.y1 - 0.1, cd, white);
    B.box(wallKey, F, w - 0.4, 0.15, dd - 0.4, cu, ROOF_TOP + 0.9, cd, wallColor, 1);
  }
  void owner;
  void hr;
  void house;
}

// ------------------------------------------------------------------ the side yard

function yard(B, F, kind, h, hr, snow, concrete, white) {
  const u0 = HALF_W + 0.6;
  if (kind === 'carport') {
    // A thin white roof on four steel posts, a stone wall at the back, the sedan nosed toward the street.
    B.box('smooth', F, 4.6, 0.25, 7.2, u0 + 2.3, 2.675, -5.0, white);
    B.box('board', F, 4.5, 0.02, 7.1, u0 + 2.3, 2.54, -5.0, '#C08A5E', 1);
    for (const [u, d] of [[u0 + 4.4, -1.6], [u0 + 4.4, -8.4], [u0 + 4.4, -5.0]]) B.box('chrome', F, 0.1, 2.55, 0.1, u, 1.275, d, '#3A3442');
    B.box('stone', F, 4.6, 2.55, 0.35, u0 + 2.3, 1.275, -8.6, null, 1);
    B.box('solid', F, 4.4, 0.04, 7.0, u0 + 2.3, 0.02, -5.0, concrete);
    P.car(B, P.at(F, u0 + 2.9, 0, -4.9, -Math.PI / 2), h.i + hr.int(3));
  } else if (kind === 'pool') {
    B.box('solid', F, 6.2, 0.06, 8.4, u0 + 3.4, 0.03, -4.8, concrete);
    P.pool(B, P.at(F, u0 + 3.3, 0.07, -4.9, Math.PI / 2 + 0.2), 6.4, 3.4, 'pool');
    P.lounger(B, P.at(F, u0 + 0.9, 0.06, -2.4, 0.15), ['#E8645A', '#2BB7B3', '#E5B83B'][h.i % 3]);
    P.lounger(B, P.at(F, u0 + 0.9, 0.06, -5.0, 0.05), ['#E8645A', '#2BB7B3', '#E5B83B'][h.i % 3]);
    P.umbrella(B, P.at(F, u0 + 0.9, 0.06, -3.7), '#F4F2EC', ['#E8645A', '#2BB7B3', '#3563B8'][h.i % 3]);
    P.queenPalm(B, P.at(F, u0 + 5.4, 0, -8.6), hr.range(5.5, 7), h.i * 41, snow);
  } else {
    // A desert garden in gravel: boulders, barrel cactus, agave, an ocotillo and a queen palm.
    B.add('ground', new THREE.CylinderGeometry(3.6, 3.7, 0.06, 24).scale(1, 1, 1.35).translate(0, 0.03, 0), P.at(F, u0 + 3.0, 0, -4.6), snow ? '#F4F6F8' : '#D6C4A6');
    P.boulder(B, P.at(F, u0 + 2.1, 0, -6.2, 1), 0.9, h.i * 3 + 1, snow ? '#E8ECF0' : '#B9926E');
    P.boulder(B, P.at(F, u0 + 3.2, 0, -6.6, 2), 0.6, h.i * 3 + 2, snow ? '#E8ECF0' : '#A8805E');
    P.barrel(B, P.at(F, u0 + 1.4, 0, -3.4), 0.4, 1);
    P.barrel(B, P.at(F, u0 + 1.9, 0, -2.6), 0.3, 2);
    P.agave(B, P.at(F, u0 + 4.0, 0, -3.0, 0.4), 1.1, h.i * 7, snow);
    P.ocotillo(B, P.at(F, u0 + 4.4, 0, -6.6), 3.6, h.i * 5);
    P.queenPalm(B, P.at(F, u0 + 2.6, 0, -8.6), hr.range(6, 7.5), h.i * 43, snow);
  }
}

// ------------------------------------------------------------------ inside

function interior(IB, F, h, owner, hr, L, T) {
  const W = FACADE_W;
  const D = HOUSE_DEPTH;
  const floorKey = hr.chance(0.5) ? 'inWood' : 'inTerr';
  // Floor, ceiling, the back wall (walnut panelling or a stone feature wall), the side walls.
  IB.box(floorKey, F, W, 0.05, D - 0.6, 0, PLINTH + 0.03, -D / 2, '#FFFFFF', 1);
  IB.box('in', F, W, 0.1, D - 0.6, 0, ROOF_Y - 0.05, -D / 2, '#F6EEE0');
  const back = hr.chance(0.5) ? 'inBoard' : 'inStone';
  IB.box(back, F, W, ROOF_Y - PLINTH, 0.1, 0, (ROOF_Y + PLINTH) / 2, -D + 0.45, back === 'inBoard' ? '#9A6440' : '#FFFFFF', 1);
  for (const s of [-1, 1]) IB.box('in', F, 0.1, ROOF_Y - PLINTH, D - 0.6, s * (HALF_W - 0.02), (ROOF_Y + PLINTH) / 2, -D / 2, mixColor(L.interior, '#F3E9D8', 0.6));
  // The loft over the left half: its slab hidden behind the middle rail, a railing, a bed and shelves up there.
  const loftR = -0.4;
  IB.box('in', F, loftR + HALF_W, 0.2, D - 0.6, (loftR - HALF_W) / 2, LOFT_Y - 0.05, -D / 2, '#EDE3D2');
  IB.box('inWood', F, loftR + HALF_W, 0.02, D - 0.6, (loftR - HALF_W) / 2, LOFT_Y + 0.06, -D / 2, '#FFFFFF', 1);
  IB.box('in', F, 0.04, 0.9, D - 1.5, loftR, LOFT_Y + 0.5, -D / 2 - 0.3, '#2A2238');
  P.bed(IB, 'in', P.at(F, -3.4, LOFT_Y + 0.05, -6.6, 0), owner.color);
  P.shelves(IB, 'in', P.at(F, -1.4, LOFT_Y, -D + 0.68), 2.2, h.i * 7 + 1);
  P.pottedPlant(IB, 'in', P.at(F, -5.6, LOFT_Y + 0.05, -2.2), 'snake', '#F4F2EC');
  const lampU = -1.6;
  P.propCyl(IB, 'in', P.at(F, lampU, LOFT_Y, -3.0), 0.12, 0.15, 0.8, 0, 0.4, 0, '#E5B83B', 8);
  IB.add('inLamp', new THREE.SphereGeometry(0.22, 10, 8).translate(0, 1.0, 0), P.at(F, lampU, LOFT_Y, -3.0), '#FFE6B8');

  // Downstairs: the sofa facing the glass, the lounge chair, a coffee table, the rug, the credenza and TV, a dining corner.
  const sofaC = hr.chance(0.5) ? owner.color : ['#E8DCC4', '#7E9070', '#C8553D', '#2B8C8A'][hr.int(4)];
  const cushion = mixColor(sofaC, '#FFFFFF', 0.15);
  IB.box('inRug', F, 4.2, 0.02, 2.8, -2.4, PLINTH + 0.07, -4.6, '#FFFFFF');
  P.sofa(IB, 'in', P.at(F, -2.6, PLINTH + 0.05, -6.4, 0), 3.0, sofaC, cushion);
  P.loungeChair(IB, 'in', P.at(F, 0.6, PLINTH + 0.05, -4.2, -0.9));
  IB.box('in', F, 1.7, 0.06, 0.7, -2.5, PLINTH + 0.42, -4.4, '#7A4E30');
  for (const [x, z] of [[-3.2, -4.15], [-1.8, -4.15], [-3.2, -4.65], [-1.8, -4.65]]) IB.box('in', F, 0.04, 0.38, 0.04, x, PLINTH + 0.2, z, '#2A2238');
  P.credenza(IB, 'in', P.at(F, -2.6, PLINTH + 0.05, -D + 0.85), 2.6, ['#E5B83B', '#C8553D', '#2B8C8A']);
  P.consoleTV(IB, 'in', P.at(F, 2.4, PLINTH + 0.05, -D + 0.9, 0), 'inScreen');
  P.arcLamp(IB, 'in', 'inLamp', P.at(F, -4.6, PLINTH + 0.05, -6.8, Math.PI * 0.2));
  P.tulipSet(IB, 'in', P.at(F, 3.7, PLINTH + 0.05, -5.6), owner.color);
  P.sputnik(IB, 'in', 'inLamp', P.at(F, 3.7, ROOF_Y - 0.1, -5.6), 1.4);
  P.pottedPlant(IB, 'in', P.at(F, 5.6, PLINTH + 0.05, -1.4), 'fig', '#C8553D');
  P.pottedPlant(IB, 'in', P.at(F, -5.7, PLINTH + 0.05, -1.4), 'snake', '#2A2238');
  // The double-height wall on the right: a big painting and the starburst clock.
  const art = hr.int(3);
  const pg = new THREE.PlaneGeometry(2.4, 1.8);
  const uv = pg.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (art + uv.getX(i)) / 3);
  pg.translate(3.2, LOFT_Y + 1.1, -D + 0.52);
  IB.add('inArt', pg, F, '#FFFFFF');
  P.starburst(IB, 'in', P.at(F, 0.9, LOFT_Y + 1.2, -D + 0.52));
  void T;
}

// ------------------------------------------------------------------ the middle

function centre(B, field, rng, snow, concrete) {
  const I = new THREE.Matrix4();
  for (const o of field.obstacles) {
    if (o.what === 'fountain') {
      const rim = new THREE.CylinderGeometry(o.r, o.r + 0.12, o.y1, 40, 1);
      uvScale(rim, 2 * Math.PI * o.r, o.y1);
      rim.translate(o.x, o.y1 / 2, o.z);
      B.add('stone', rim, I);
      const cap = new THREE.TorusGeometry(o.r - 0.05, 0.12, 6, 40);
      cap.rotateX(Math.PI / 2);
      cap.translate(o.x, o.y1, o.z);
      B.add('solid', cap, I, concrete);
      const w = new THREE.CircleGeometry(o.r - 0.15, 40);
      w.rotateX(-Math.PI / 2);
      w.translate(o.x, o.y1 - 0.14, o.z);
      B.add('pool', w, I, '#FFFFFF');
    } else if (o.what === 'tree') {
      // A trunk that splits into limbs up into the canopy.
      const h = o.y1 - o.y0 + 0.6;
      const trunk = new THREE.CylinderGeometry(o.r * 0.7, o.r * 1.15, h, 10);
      trunk.translate(o.x, (o.y0 + o.y1) / 2 + 0.3, o.z);
      B.add('plant', trunk, I, snow ? '#5E4A3A' : '#6B4E36');
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + rng.range(-0.3, 0.3);
        const c = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(o.x, o.y1 - 0.8, o.z),
          new THREE.Vector3(o.x + Math.cos(a) * 1.2, o.y1 + 0.6, o.z + Math.sin(a) * 1.2),
          new THREE.Vector3(o.x + Math.cos(a) * 3.0, o.y1 + 1.6 + rng.range(-0.4, 0.6), o.z + Math.sin(a) * 3.0),
        );
        B.add('plant', new THREE.TubeGeometry(c, 6, o.r * 0.32, 6, false), I, snow ? '#5E4A3A' : '#6B4E36');
      }
    } else if (o.what === 'leaves' || o.what === 'branches' || o.what === 'fronds') {
      if (o.what === 'fronds') continue;
      const n = o.what === 'branches' ? 0 : 70;
      for (let k = 0; k < n; k++) {
        const u = rng.range(-1, 1);
        const v = rng.range(0, Math.PI * 2);
        const rr = Math.sqrt(1 - u * u) * rng.range(0.45, 0.8);
        const cx = o.x + Math.cos(v) * rr * o.rx;
        const cz = o.z + Math.sin(v) * rr * o.rz;
        const cy = o.y + u * o.ry * 0.55;
        const s = rng.range(0.22, 0.36) * Math.min(o.rx, o.ry * 1.6);
        const top = snow ? '#E8EEF2' : ['#7FAA48', '#8DB452', '#6E9A40', '#9AB858'][rng.int(4)];
        const g = P.blob(s, 2, k * 7 + 3, 0.6, top, snow ? '#9AA4AE' : '#365A26', 0.78);
        g.translate(cx, cy, cz);
        B.add('sway', g, I, null, 0.12 + 0.1 * (cy - o.y + o.ry) / (2 * o.ry));
      }
      if (o.what === 'branches') {
        // Bare winter limbs, dusted.
        for (let k = 0; k < 16; k++) {
          const a = rng.range(0, Math.PI * 2);
          const c = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(o.x + Math.cos(a) * 1.2, o.y - 0.6, o.z + Math.sin(a) * 1.2),
            new THREE.Vector3(o.x + Math.cos(a) * 2.4, o.y + 0.8, o.z + Math.sin(a) * 2.4),
            new THREE.Vector3(o.x + Math.cos(a + 0.3) * o.rx * 0.9, o.y + rng.range(0.4, 2.0), o.z + Math.sin(a + 0.3) * o.rz * 0.9),
          );
          B.add('plant', new THREE.TubeGeometry(c, 5, 0.09, 5, false), I, k % 2 ? '#6B5A4A' : '#F4F6F8');
        }
      }
    } else if (o.what === 'needles') {
      for (let k = 0; k < 6; k++) {
        const g = new THREE.ConeGeometry(o.rx * (1.05 - k * 0.15), o.ry * 0.62, 12);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i);
          if (y < 0) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * 1.7) * 0.12), y + Math.sin(i * 2.3) * 0.12, p.getZ(i) * (1 + Math.cos(i * 1.3) * 0.12));
        }
        g.computeVertexNormals();
        g.translate(o.x, o.y - o.ry * 0.5 + k * o.ry * 0.3, o.z);
        B.add('sway', g, I, k % 2 ? '#2F5A3A' : '#3A6B44', 0.1 + k * 0.03);
      }
    } else if (o.what === 'car') {
      P.car(B, P.at(null, o.x, 0, o.z, -o.rot, 0.86), 0);
    } else if (o.what === 'palm') {
      P.fanPalm(B, P.at(null, o.x, 0, o.z), o.y1 + 0.3, Math.round(o.x * 10 + o.z), snow);
    } else if (o.what === 'planter') {
      const g = new THREE.CylinderGeometry(o.r, o.r * 0.92, o.y1, 32);
      uvScale(g, 2 * Math.PI * o.r, o.y1);
      g.translate(o.x, o.y1 / 2, o.z);
      B.add('stone', g, I);
      const cap = new THREE.TorusGeometry(o.r, 0.1, 6, 32);
      cap.rotateX(Math.PI / 2);
      cap.translate(o.x, o.y1, o.z);
      B.add('solid', cap, I, concrete);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        P.agave(B, P.at(null, o.x + Math.cos(a) * o.r * 0.6, o.y1, o.z + Math.sin(a) * o.r * 0.6, a), 0.7, k + 3, snow);
      }
      P.queenPalm(B, P.at(null, o.x, o.y1, o.z), 5.0, 77, snow);
    } else if (o.what === 'rock') {
      const g = P.blob(1, 2, 19, 0.45, '#C58A60', '#7A4E36', 1);
      g.scale(o.rx, o.ry, o.rz);
      g.translate(o.x, o.y, o.z);
      B.add('plant', g, I);
      for (let k = 0; k < 4; k++) {
        const a = k * 1.7 + 0.4;
        const g2 = P.blob(rng.range(0.5, 0.9), 1, k + 40, 0.5, '#B9805A', '#6E4632', 0.7);
        g2.translate(o.x + Math.cos(a) * (o.rx + 0.4), 0.2, o.z + Math.sin(a) * (o.rz + 0.4));
        B.add('plant', g2, I);
      }
    }
  }
}

// ------------------------------------------------------------------ the mountains

/** Three ridges of desert mountains round the horizon: far and pale in the haze, the near one darker; lit on the sun's side. */
function mountains(B, L, sunDir, field, rng) {
  const sky = new THREE.Color(L.skyLow);
  const fog = new THREE.Color(L.fog);
  const sunC = new THREE.Color(L.sun);
  const rockLit = new THREE.Color(L.snow ? '#F4F6FA' : L.night ? '#3A3460' : '#C47A5A');
  const rockShade = new THREE.Color(L.snow ? '#A9B4C6' : L.night ? '#1E1A3A' : '#5A3E5E');
  const sh = new THREE.Vector2(sunDir.x, sunDir.z).normalize();
  const layers = [
    { r: 620, h: 95, haze: 0.62, seed: 1 },
    { r: 470, h: 70, haze: 0.42, seed: 2 },
    { r: 330, h: 42, haze: 0.22, seed: 3 },
  ];
  for (const lay of layers) {
    const n = 220;
    const pos = [];
    const col = [];
    const c = new THREE.Color();
    const ridge = (a) => {
      let v = 0;
      let amp = 1;
      let f = 1;
      for (let o = 0; o < 5; o++) {
        v += amp * Math.abs(Math.sin(a * 3 * f + lay.seed * 7.3 + o * 1.9) * Math.cos(a * 2 * f * 1.3 + lay.seed));
        amp *= 0.5;
        f *= 2.1;
      }
      // San Jacinto stands in the west: the ridge is tallest toward the sun's side.
      const toward = 0.5 + 0.5 * Math.cos(a - Math.atan2(sh.y, sh.x));
      return lay.h * (0.25 + 0.75 * v * 0.55) * (0.55 + 0.75 * toward);
    };
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      const h0 = ridge(a0);
      const h1 = ridge(a1);
      const p0 = [Math.cos(a0) * lay.r, Math.sin(a0) * lay.r];
      const p1 = [Math.cos(a1) * lay.r, Math.sin(a1) * lay.r];
      // Facing: the face looks inward; lit when the sun is behind the viewer (the far side from the sun).
      const face = -(Math.cos((a0 + a1) / 2) * sh.x + Math.sin((a0 + a1) / 2) * sh.y);
      const slopeLit = Math.max(0, Math.min(1, face * 0.8 + (h1 - h0) / 30 * Math.sign(face)));
      const top = c.copy(rockShade).lerp(rockLit, slopeLit * (L.night ? 0.4 : 1)).lerp(sunC, slopeLit * 0.15);
      top.lerp(sky, lay.haze);
      const tc = top.clone();
      const bc = top.clone().lerp(fog, 0.55).lerp(sky, 0.2);
      pos.push(p0[0], -8, p0[1], p1[0], h1, p1[1], p1[0], -8, p1[1], p0[0], -8, p0[1], p0[0], h0, p0[1], p1[0], h1, p1[1]);
      col.push(bc.r, bc.g, bc.b, tc.r, tc.g, tc.b, bc.r, bc.g, bc.b, bc.r, bc.g, bc.b, tc.r, tc.g, tc.b, tc.r, tc.g, tc.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    B.add('far', g, null);
  }
  void field;
  void rng;
}

// ------------------------------------------------------------------ flags, the windsock, the store

function makeFlag(owner, x, y, z) {
  const W = 1.7;
  const H = 1.05;
  const g = new THREE.PlaneGeometry(W, H, 10, 3);
  g.translate(W / 2, 0, 0);
  const base = g.attributes.position.array.slice();
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let map = null;
  if (cv) {
    cv.width = 128;
    cv.height = 80;
    const c = cv.getContext('2d');
    c.fillStyle = owner.color;
    c.fillRect(0, 0, 128, 80);
    c.fillStyle = 'rgba(255,248,235,0.9)';
    c.fillRect(0, 0, 10, 80);
    drawSymbol(c, owner.symbol, 68, 40, 46, '#F3E9D8');
    map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace;
  }
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, color: map ? '#ffffff' : owner.color, side: THREE.DoubleSide, roughness: 0.8 }));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  const pos = g.attributes.position;
  return {
    mesh,
    update(t, ang, s) {
      mesh.rotation.y = -ang;
      const amp = 0.08 + 0.25 * s;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const k = bx / W;
        pos.setXYZ(i, bx * (0.75 + 0.25 * s), by - (1 - s) * k * 0.45, Math.sin(t * (4 + 6 * s) - bx * 3) * amp * k + Math.sin(t * 9 - bx * 6 + by * 3) * 0.03 * k);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
    },
  };
}

function buildWindsock(white) {
  const group = new THREE.Group();
  const mastH = 11;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, mastH, 10), new THREE.MeshStandardMaterial({ color: white, roughness: 0.35 }));
  mast.position.y = mastH / 2;
  mast.castShadow = true;
  group.add(mast);
  const pivot = new THREE.Group();
  pivot.position.y = mastH - 0.3;
  group.add(pivot);
  const sock = new THREE.Group();
  pivot.add(sock);
  const Ls = 3.6;
  const parts = [];
  for (let k = 0; k < 5; k++) {
    const r0 = 0.62 - k * 0.075;
    const r1 = 0.62 - (k + 1) * 0.075;
    const g = new THREE.CylinderGeometry(r1, r0, Ls / 5, 16, 1, true);
    g.rotateZ(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: k % 2 ? '#F7F2E8' : '#F06A24', side: THREE.DoubleSide, roughness: 0.7, emissive: new THREE.Color(k % 2 ? '#3a3530' : '#5a2008'), emissiveIntensity: 0.25 }));
    m.castShadow = true;
    sock.add(m);
    parts.push(m);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 16), new THREE.MeshStandardMaterial({ color: '#3A3442', roughness: 0.5 }));
  ring.rotation.y = Math.PI / 2;
  sock.add(ring);
  let droop = 0.9;
  let yaw = 0;
  let wiggle = 0;
  return {
    group,
    update(dt, ang, s) {
      let d = -ang - yaw;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      yaw += d * Math.min(1, dt * 2.5);
      droop += ((1 - s) * 1.2 - droop) * Math.min(1, dt * 2);
      wiggle += dt * (3 + s * 8);
      pivot.rotation.y = yaw;
      sock.rotation.z = -droop + Math.sin(wiggle) * 0.04 * (0.3 + s);
      for (let k = 0; k < parts.length; k++) {
        const seg = parts[k];
        seg.position.x = 0.36 + k * (Ls / 5) * (0.92 + 0.08 * s);
        seg.position.y = -Math.pow(k / 4, 2) * (1 - s) * 0.9;
        seg.rotation.z = -Math.pow(k / 4, 1.5) * (1 - s) * 0.5;
      }
    },
  };
}

function buildStore(B, a, R, white, concrete) {
  const group = new THREE.Group();
  const r = R + 15;
  const F = new THREE.Matrix4();
  const fx = -Math.cos(a);
  const fz = -Math.sin(a);
  F.makeBasis(new THREE.Vector3(-fz, 0, fx), new THREE.Vector3(0, 1, 0), new THREE.Vector3(fx, 0, fz));
  F.setPosition(r * Math.cos(a), 0, r * Math.sin(a));
  // A Googie hardware store: a long box under a swooping canopy, a stone pier, big display windows, a starburst on a pylon.
  B.box('stucco', F, 12, 4.2, 6, 0, 2.1, -3, '#E9C98F', 1);
  B.box('stone', F, 1.6, 4.6, 6.4, -6.6, 2.3, -3, null, 1);
  B.box('smooth', F, 14.5, 0.3, 8.6, 0.2, 4.45, -1.8, white);
  B.box('solid', F, 14.5, 0.2, 0.06, 0.2, 4.35, 2.42, '#E8645A');
  B.box('solid', F, 12.4, 0.5, 1, 0, 0.25, 0.3, concrete);
  B.box('dark', F, 2.0, 2.6, 0.1, 0.4, 1.3, 0.02, '#3A3442');
  B.box('cglass', F, 3.6, 2.4, 0.08, -3.4, 1.7, 0.02, '#2A3A44');
  B.box('cglass', F, 3.6, 2.4, 0.08, 4.0, 1.7, 0.02, '#2A3A44');
  for (const u of [-1.4, 2.2, 5.9]) B.box('smooth', F, 0.12, 2.6, 0.14, u, 1.6, 0.05, white);
  // Goods in the windows: paint cans, a ladder, a lawnmower in mint.
  for (let k = 0; k < 6; k++) B.box('solid', F, 0.3, 0.38, 0.3, -4.6 + k * 0.45, 0.72, -0.4, ['#E8645A', '#2BB7B3', '#E5B83B', '#3563B8', '#F4F2EC', '#8A4F9E'][k]);
  B.box('solid', F, 0.9, 0.5, 0.6, 4.0, 0.78, -0.5, '#9ED8C6');
  // The pylon with its starburst.
  B.box('smooth', F, 0.5, 9.5, 0.5, 6.9, 4.75, 1.6, white);
  for (let k = 0; k < 12; k++) {
    const g = new THREE.BoxGeometry(0.1, k % 2 ? 0.9 : 1.5, 0.08);
    g.translate(0, (k % 2 ? 0.9 : 1.5) / 2, 0);
    g.rotateZ((k / 12) * Math.PI * 2);
    g.translate(6.9, 9.8, 1.6);
    B.add('lamp', g, F, '#FFB547');
  }
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let tex = null;
  let ctx = null;
  if (cv) {
    cv.width = 512;
    cv.height = 160;
    ctx = cv.getContext('2d');
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  const signMat = new THREE.MeshStandardMaterial({ map: tex, color: '#ffffff', emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 1.8, roughness: 0.6 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), signMat);
  const p = new THREE.Vector3(0, 6.3, -0.2).applyMatrix4(F);
  sign.position.copy(p);
  sign.lookAt(p.x + fx, p.y, p.z + fz);
  group.add(sign);
  for (const u of [-3, 3]) {
    const post = new THREE.BoxGeometry(0.2, 1.4, 0.2);
    post.translate(u, 4.9, -0.3);
    B.add('smooth', post, F, white);
  }
  let open = null;
  const S = {
    group,
    set(isOpen) {
      if (open === isOpen || !ctx) return;
      open = isOpen;
      const g = ctx;
      g.clearRect(0, 0, 512, 160);
      g.fillStyle = '#2A2238';
      g.fillRect(0, 0, 512, 160);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '700 54px "Josefin Sans", sans-serif';
      g.shadowColor = '#FFB547';
      g.shadowBlur = 16;
      g.fillStyle = '#FFE1A6';
      g.fillText('HARDWARE', 256, 52);
      g.font = '700 58px "Josefin Sans", sans-serif';
      g.shadowColor = isOpen ? '#7CF0C8' : '#FF5A4A';
      g.fillStyle = isOpen ? '#B8FFE6' : '#FF8A7A';
      g.fillText(isOpen ? 'OPEN' : 'CLOSED', 256, 118);
      tex.needsUpdate = true;
    },
  };
  S.set(true);
  return S;
}
