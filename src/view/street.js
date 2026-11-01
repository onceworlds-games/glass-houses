// A street, built from its field: the ground, the road, the lawns and their kerbs, six glass houses (frames, roofs, flagstone walls,
// lit interiors, the mailbox wall with the house number), the props in the middle, palms and pools, the hardware store and the
// windsock. Glass is drawn by glass.js.

import * as THREE from 'three';
import { createBuilder, houseFrame, sectorGeometry, arcWallGeometry, canvasTexture } from './build.js';
import { OWNERS, LIGHTS, drawSymbol } from './palette.js';
import { COLS, ROWS, PANE_W, PANE_H, MULLION, PLINTH, FACADE_W, FACADE_H, HOUSE_DEPTH, ROOF_Y, ROOF_T, ROOF_OVER } from '../core/config.js';
import { createRng } from '../core/rng.js';

const HALF_W = FACADE_W / 2;
const CELL_U = PANE_W + MULLION;
const CELL_Y = PANE_H + MULLION;

// ------------------------------------------------------------------ textures (made once)

let TEX = null;
function textures() {
  if (TEX) return TEX;
  TEX = {
    flag: canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#C9B79C';
      g.fillRect(0, 0, w, h);
      const r = createRng(7);
      // Irregular flagstones in warm buff and rust.
      for (let y = 0; y < h; ) {
        const rh = 26 + r.int(30);
        for (let x = -r.int(40); x < w; ) {
          const rw = 40 + r.int(60);
          const tone = ['#D8C3A2', '#C7AC86', '#B89874', '#D9CDB3', '#AE8463', '#CDB28E'][r.int(6)];
          g.fillStyle = tone;
          g.fillRect(x + 3, y + 3, rw - 6, rh - 6);
          x += rw;
        }
        y += rh;
      }
      g.globalAlpha = 0.08;
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = r.chance(0.5) ? '#000' : '#fff';
        g.fillRect(r.int(w), r.int(h), 2, 2);
      }
    }),
    breeze: canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#EFE6D6';
      g.fillRect(0, 0, w, h);
      // Breeze blocks: a circle in a square, the cut-outs in shadow.
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) {
          const cx = x * 64 + 32;
          const cy = y * 64 + 32;
          g.fillStyle = '#7B6A58';
          g.beginPath();
          g.arc(cx, cy, 20, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#EFE6D6';
          g.beginPath();
          g.arc(cx, cy, 11, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#9A8A76';
          for (const [dx, dy] of [[-28, -28], [28, -28], [-28, 28], [28, 28]]) {
            g.beginPath();
            g.arc(cx + dx, cy + dy, 9, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      g.strokeStyle = 'rgba(80,60,40,0.25)';
      g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, 125, 125);
      g.beginPath();
      g.moveTo(64, 0);
      g.lineTo(64, 128);
      g.moveTo(0, 64);
      g.lineTo(128, 64);
      g.stroke();
    }),
    grass: canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      const r = createRng(11);
      for (let i = 0; i < 2600; i++) {
        const v = 0.82 + r.next() * 0.3;
        g.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(255 * Math.min(1, v + 0.03))},${Math.round(255 * v * 0.9)})`;
        g.fillRect(r.int(w), r.int(h), 2, 4 + r.int(4));
      }
      // Mower stripes.
      g.globalAlpha = 0.06;
      g.fillStyle = '#000';
      for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 32, h);
    }),
    road: canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      const r = createRng(13);
      for (let i = 0; i < 5000; i++) {
        const v = 0.78 + r.next() * 0.28;
        g.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(255 * v)},${Math.round(255 * v)})`;
        g.fillRect(r.int(w), r.int(h), 2, 2);
      }
    }),
  };
  return TEX;
}

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

// ------------------------------------------------------------------ the street

export function buildStreet(field, quality = 'medium') {
  const T = textures();
  const L = LIGHTS[field.street.light] ?? LIGHTS.golden;
  const snow = !!L.snow;
  const B = createBuilder();
  const root = new THREE.Group();
  const R = field.R;
  const rng = createRng(field.index * 101 + 5);
  const I = new THREE.Matrix4();
  const lawnColor = snow ? '#F4F6F8' : L.ground;
  const sand = L.sand;
  const concrete = snow ? '#E9ECEF' : '#E2D6C2';
  const white = '#F7F2E8';
  const terrace = field.terrace;
  const islandR = field.street.centre === 'planter' ? 3.0 : field.street.centre === 'car' ? 6.2 : 4.6;
  const roadOut = terrace - 0.6;

  // ---------------------------------------------------------------- ground
  // The middle: the island, the road ring, the kerb. Then each house's sector: lawn, patio, the yard behind.
  B.add('ground', sectorGeometry(0, islandR, 0, Math.PI * 2, 0.0, 2, 48, () => (snow ? '#F1F3F5' : '#7F9A45')), I);
  B.add('road', sectorGeometry(islandR, roadOut, 0, Math.PI * 2, 0.0, 2, 72, () => (snow ? '#C9CDD3' : '#5E5552')), I);
  B.add('solid', sectorGeometry(roadOut, terrace + 0.02, 0, Math.PI * 2, 0.02, 1, 72, () => concrete), I);
  // Kerb around the island.
  B.add('solid', arcWallGeometry(islandR, 0, Math.PI * 2, 0, 0.18, 48), I, concrete);
  const outR = R + 46;
  for (const h of field.houses) {
    const a0 = h.angle - field.step / 2;
    const a1 = h.angle + field.step / 2;
    const y = h.elev;
    const lawn = h.lawn;
    if (field.sea && field.inSea(a0 + 0.01) && field.inSea(a1 - 0.01)) continue;
    B.add('lawn', sectorGeometry(terrace, lawn.rMax + 0.4, a0, a1, y + 0.03, 3, 16, () => lawnColor), I);
    B.add('solid', sectorGeometry(lawn.rMax + 0.4, R + 2.6, a0, a1, y + 0.04, 2, 16, () => concrete), I);
    B.add('ground', sectorGeometry(R + 2.6, outR, a0, a1, y, 3, 16, (r) => (r > R + 20 ? sand : snow ? '#EEF1F4' : mixColor(sand, L.ground, 0.4))), I);
    // Out to the horizon, so the far mesas stand on ground.
    B.add('ground', sectorGeometry(outR - 0.5, 460, a0, a1, y - 0.02, 2, 8, () => sand), I);
    // A retaining wall where a terrace stands above the middle, and between terraces of different heights.
    if (y > 0.01) {
      B.add('stone', arcWallGeometry(terrace, a1, a0, 0, y + 0.03, 12), I);
    }
    // Kerbs that mark the edges of this lawn.
    for (const a of [lawn.aMin, lawn.aMax]) {
      const m = new THREE.Matrix4().makeRotationY(-a);
      const mid = (lawn.rMin + lawn.rMax) / 2;
      const g = new THREE.BoxGeometry(lawn.rMax - lawn.rMin + 0.8, 0.12, 0.16);
      g.translate(mid, y + 0.06, 0);
      B.add('solid', g, m, concrete);
    }
  }
  // Terrace side walls where neighbours stand at different heights.
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
  // Cliff Top: the open side drops to the sea.
  let sea = null;
  if (field.sea) {
    const last = field.houses[field.houses.length - 1];
    const first = field.houses[0];
    const s0 = last.angle + field.step / 2;
    const s1 = first.angle - field.step / 2 + Math.PI * 2;
    B.add('lawn', sectorGeometry(terrace, R - 4, s0, s1, 0.03, 2, 24, () => lawnColor), I);
    B.add('cliff', arcWallGeometry(R - 4, s0, s1, -34, 0.03, 24), I, '#B88A62');
    for (const a of [s0, s1]) {
      const g = new THREE.BoxGeometry(outR - (R - 4), 34, 0.6);
      g.translate(R - 4 + (outR - R + 4) / 2, -17, 0);
      B.add('cliff', g, new THREE.Matrix4().makeRotationY(-a), '#A97B55');
    }
    // A low fence along the edge.
    for (let k = 0; k <= 20; k++) {
      const a = s0 + ((s1 - s0) * k) / 20;
      const g = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 5);
      g.translate((R - 4.3) * Math.cos(a), 0.5, (R - 4.3) * Math.sin(a));
      B.add('smooth', g, I, white);
    }
    B.add('smooth', arcWallGeometry(R - 4.3, s0, s1, 0.85, 0.95, 24), I, white);
    sea = new THREE.Mesh(new THREE.CircleGeometry(600, 48), new THREE.MeshStandardMaterial({ color: '#3F7FA6', roughness: 0.25, metalness: 0.1 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -30;
    root.add(sea);
  }

  // ---------------------------------------------------------------- houses
  const plates = [];
  const interiors = [];
  const porch = [];
  const flags = [];
  for (const h of field.houses) {
    const F = houseFrame(h);
    const owner = OWNERS[h.i % OWNERS.length];
    // Plinth and the step in front of the glass.
    B.box('solid', F, FACADE_W + 0.6, PLINTH, HOUSE_DEPTH + 0.8, 0, PLINTH / 2, -HOUSE_DEPTH / 2 + 0.4, concrete);
    // Patio slab out to the lawn.
    B.box('solid', F, FACADE_W + 6.4, 0.08, 2.6, 1.6, 0.06, 1.7, concrete);
    // Flagstone side walls and the back wall.
    for (const s of [-1, 1]) B.box('stone', F, 0.6, ROOF_Y, HOUSE_DEPTH, s * (HALF_W + 0.3), ROOF_Y / 2, -HOUSE_DEPTH / 2, null, 1.6);
    B.box('stone', F, FACADE_W + 1.2, ROOF_Y, 0.4, 0, ROOF_Y / 2, -HOUSE_DEPTH + 0.2, null, 1.6);
    // Roof slab with a white fascia, and a clerestory on top.
    B.box('smooth', F, FACADE_W + 2.4, ROOF_T, HOUSE_DEPTH + 0.6 + ROOF_OVER, 0, ROOF_Y + ROOF_T / 2, (-HOUSE_DEPTH - 0.6 + ROOF_OVER) / 2, white);
    B.box('solid', F, FACADE_W - 3, 1.0, HOUSE_DEPTH * 0.45, -1.2, ROOF_Y + ROOF_T + 0.5, -HOUSE_DEPTH * 0.6, concrete);
    B.box('smooth', F, FACADE_W - 2.6, 0.14, HOUSE_DEPTH * 0.45 + 0.6, -1.2, ROOF_Y + ROOF_T + 1.05, -HOUSE_DEPTH * 0.6, white);
    // Steel mullions: 11 uprights, 3 rails, flush with the glass.
    for (let k = 0; k <= COLS; k++) {
      const u = -HALF_W + k * CELL_U + MULLION / 2;
      B.box('smooth', F, MULLION, FACADE_H, 0.16, u, PLINTH + FACADE_H / 2, 0, white);
    }
    for (let k = 0; k <= ROWS; k++) {
      const y = PLINTH + k * CELL_Y + MULLION / 2;
      B.box('smooth', F, FACADE_W, MULLION, 0.16, 0, y, 0, white);
    }
    // Mailbox wall in breeze block, right of the glass; the house number goes on its street face.
    B.box('breeze', F, 2.2, 1.9, 0.4, HALF_W + 2.0, 0.95, 1.8, null, 0.8);
    B.box('smooth', F, 2.4, 0.08, 0.5, HALF_W + 2.0, 1.94, 1.8, white);
    // The owner's colour: a door in the side wall facing the plate, and a mailbox.
    B.box('solid', F, 0.3, 0.45, 0.35, HALF_W + 3.3, 1.1, 1.8, owner.color);
    B.box('solid', F, 0.06, 1.1, 0.06, HALF_W + 3.3, 0.55, 1.8, '#3A3442');

    // Inside, lit: floors, the upstairs slab behind the middle rail, a back wall in a warm tone, furniture.
    const inter = createBuilder();
    const warm = new THREE.Color(L.interior);
    inter.box('in', F, FACADE_W, 0.05, HOUSE_DEPTH - 0.6, 0, PLINTH + 0.03, -HOUSE_DEPTH / 2, '#B07A4E');
    inter.box('in', F, FACADE_W, 0.22, HOUSE_DEPTH - 1.0, 0, PLINTH + CELL_Y + MULLION / 2 - 0.02, -HOUSE_DEPTH / 2 - 0.4, '#EDE3D2');
    inter.box('in', F, FACADE_W, ROOF_Y - PLINTH, 0.1, 0, (ROOF_Y + PLINTH) / 2, -HOUSE_DEPTH + 0.45, mixColor(L.interior, '#F3E9D8', 0.5));
    inter.box('in', F, FACADE_W, 0.1, HOUSE_DEPTH - 0.6, 0, ROOF_Y - 0.05, -HOUSE_DEPTH / 2, '#F6EEE0');
    // Sofa in the owner's colour, a rug, a sideboard, a lamp; upstairs a shelf and a bed.
    inter.box('in', F, 3.2, 0.5, 0.9, -2.2, PLINTH + 0.3, -4.8, owner.color);
    inter.box('in', F, 3.2, 0.5, 0.25, -2.2, PLINTH + 0.7, -5.15, owner.color);
    inter.box('in', F, 3.8, 0.03, 2.4, -2.0, PLINTH + 0.06, -3.6, '#D9C3A0');
    inter.box('in', F, 2.6, 0.7, 0.5, 3.4, PLINTH + 0.35, -HOUSE_DEPTH + 1.1, '#8A5A3A');
    inter.box('in', F, 0.06, 1.5, 0.06, 1.0, PLINTH + 0.75, -5.0, '#3A3442');
    inter.box('lamp', F, 0.5, 0.45, 0.5, 1.0, PLINTH + 1.6, -5.0, '#FFE2A8');
    inter.box('in', F, 2.8, 1.6, 0.4, -3.6, PLINTH + CELL_Y + 1.0, -HOUSE_DEPTH + 1.0, '#7A5238');
    inter.box('in', F, 2.6, 0.5, 2.0, 3.0, PLINTH + CELL_Y + 0.4, -5.6, '#EDE3D2');
    inter.box('in', F, 2.6, 0.2, 0.7, 3.0, PLINTH + CELL_Y + 0.7, -6.4, owner.color);
    inter.box('lamp', F, 0.4, 0.4, 0.4, -0.6, PLINTH + CELL_Y + 1.5, -HOUSE_DEPTH + 1.3, '#FFE2A8');
    const inMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, emissive: warm, emissiveIntensity: L.night ? 0.32 : 0.16 });
    const lampMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: new THREE.Color('#FFD08A'), emissiveIntensity: L.night ? 2.4 : 1.2 });
    const inGroup = inter.build({ in: inMat, lamp: lampMat }, { noShadow: ['in', 'lamp'] });
    root.add(inGroup);
    interiors.push({ mat: inMat, lamp: lampMat, on: L.night ? 0.32 : 0.16, lampOn: L.night ? 2.4 : 1.2 });

    // The house number on the mailbox wall: a canvas plate, drawn again when the count changes.
    const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    let plate = null;
    if (cv) {
      cv.width = 256;
      cv.height = 200;
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.37), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.35, metalness: 0.1 }));
      const p = new THREE.Vector3(HALF_W + 2.0, 1.0, 2.02).applyMatrix4(F);
      mesh.position.copy(p);
      mesh.lookAt(p.x + h.fx, p.y, p.z + h.fz);
      root.add(mesh);
      plate = { cv, tex, n: -1, out: false, owner };
      plates.push(plate);
    } else plates.push(null);

    // A porch light on the mailbox wall (on in the lobby when its owner is ready, and at night).
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: '#FFE6B0', emissive: new THREE.Color('#FFC46B'), emissiveIntensity: 0 }));
    bulb.position.copy(new THREE.Vector3(HALF_W + 1.1, 1.75, 2.08).applyMatrix4(F));
    root.add(bulb);
    porch.push(bulb);

    // A flag pole at the front corner of the lawn: the owner's colour, and the wind.
    const la = h.lawn.aMax - 0.02;
    const lr = h.lawn.rMax + 0.9;
    const px = lr * Math.cos(la);
    const pz = lr * Math.sin(la);
    const pole = new THREE.CylinderGeometry(0.05, 0.07, 5.2, 6);
    pole.translate(px, h.elev + 2.6, pz);
    B.add('smooth', pole, I, white);
    flags.push(makeFlag(owner, px, h.elev + 4.7, pz));
    root.add(flags[flags.length - 1].mesh);

    // A pool and a palm in the yard beside the house.
    const side = HALF_W + 4.2;
    if (2 * R * Math.sin(field.step / 2) > FACADE_W + 9) {
      B.box('solid', F, 4.4, 0.3, 6.4, side + 0.6, 0.15, -4.5, concrete);
      const water = new THREE.BoxGeometry(3.6, 0.05, 5.6);
      water.translate(side + 0.6, 0.31, -4.5);
      B.add('pool', water, F, '#2BB7B3');
    }
    addPalm(B, new THREE.Vector3(side + 3.4, 0, -9.5).applyMatrix4(F), 6 + rng.next() * 2.5, rng, snow);
  }

  // ---------------------------------------------------------------- the middle
  addCentre(B, field, rng, snow, concrete);

  // Palms and scrub on the far side, a ring of mesas on the horizon.
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + rng.range(-0.1, 0.1);
    if (field.sea && field.inSea(a)) continue;
    const r = R + 24 + rng.range(0, 14);
    const elev = field.groundY(r * Math.cos(a), r * Math.sin(a));
    if (rng.chance(0.55)) addPalm(B, new THREE.Vector3(r * Math.cos(a), elev, r * Math.sin(a)), 7 + rng.next() * 4, rng, snow);
    else addShrub(B, new THREE.Vector3(r * Math.cos(a), elev, r * Math.sin(a)), rng, snow);
  }
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + rng.range(-0.2, 0.2);
    if (field.sea && field.inSea(a)) continue;
    const r = 230 + rng.range(0, 60);
    const g = new THREE.CylinderGeometry(rng.range(18, 40), rng.range(30, 60), rng.range(18, 42), 7);
    g.translate(r * Math.cos(a), 6, r * Math.sin(a));
    // Hazy silhouettes: the far air's colour over the rock.
    B.add('far', g, I, snow ? '#C9D2DC' : L.night ? '#2E2846' : mixColor(mixColor(L.sand, '#B0614A', 0.5), L.skyLow, 0.45));
  }

  // ---------------------------------------------------------------- the hardware store, where the road leaves the ring
  const storeA = field.ring ? field.houses[0].angle - field.step / 2 : field.houses[0].angle - field.step * 0.75;
  const store = buildStore(B, storeA, R, white, concrete);
  root.add(store.group);
  // The road out, under the store.
  B.add('road', sectorGeometry(terrace, R + 18, storeA - 0.12 * (22 / R), storeA + 0.12 * (22 / R), 0.05, 2, 3, () => (snow ? '#C9CDD3' : '#5E5552')), I);

  // ---------------------------------------------------------------- the windsock, big, on a mast by the middle
  const sock = buildWindsock(white);
  const sockA = field.houses[0].angle + Math.PI + field.step * 0.5;
  const sockR = field.street.centre === 'planter' ? 2.9 : islandR - 0.6;
  sock.group.position.set(sockR * Math.cos(sockA), 0, sockR * Math.sin(sockA));
  root.add(sock.group);

  // ---------------------------------------------------------------- materials
  const mats = {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }),
    smooth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.05 }),
    stone: new THREE.MeshStandardMaterial({ map: T.flag, roughness: 0.92, color: snow ? '#DDD8D2' : '#ffffff' }),
    breeze: new THREE.MeshStandardMaterial({ map: T.breeze, roughness: 0.9 }),
    lawn: new THREE.MeshStandardMaterial({ vertexColors: true, map: T.grass, roughness: 1 }),
    ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    road: new THREE.MeshStandardMaterial({ vertexColors: true, map: T.road, roughness: 0.95 }),
    pool: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.2, emissive: new THREE.Color('#1D8C8A'), emissiveIntensity: 0.35 }),
    plant: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }),
    far: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, fog: false }),
    cliff: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
  };
  mats.lawn.map.repeat.set(1, 1);
  const statics = B.build(mats, { noShadow: ['ground', 'road', 'lawn', 'far', 'pool'] });
  root.add(statics);
  // Only nearby things cast shadows; the horizon never does.
  for (const m of statics.children) if (m.name === 'far' || m.name === 'cliff') m.castShadow = false;

  const S = {
    root,
    plates,
    interiors,
    porch,
    flags,
    store,
    sock,
    sea,
    field,
    dispose() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) {
            if (m.map && !Object.values(T).includes(m.map)) m.map.dispose();
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

  /** A house's lights: on, or off when it's out. */
  S.setLit = function setLit(i, lit) {
    const it = interiors[i];
    if (!it) return;
    it.mat.emissiveIntensity = lit ? it.on : 0;
    it.lamp.emissiveIntensity = lit ? it.lampOn : 0;
    it.mat.color.setScalar(lit ? 1 : 0.45);
  };

  S.setPorch = function setPorch(i, on) {
    const b = porch[i];
    if (b) b.material.emissiveIntensity = on ? 3 : L.night ? 1.2 : 0;
  };

  /** Flags and the windsock follow the wind; the store's neon. */
  S.update = function update(dt, t, wind) {
    const s = Math.min(1, (wind?.s ?? 0) / 3);
    const ang = Math.atan2(wind?.z ?? 0, wind?.x ?? 1);
    for (const f of flags) f.update(t, ang, s);
    sock.update(dt, ang, s);
  };

  for (let i = 0; i < field.houses.length; i++) {
    S.setNumber(i, 20, false);
    S.setPorch(i, false);
  }
  return S;
}

function mixColor(a, b, t) {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

function addPalm(B, at, height, rng, snow) {
  const I = new THREE.Matrix4();
  const lean = rng.range(-0.15, 0.15);
  const segs = 6;
  let x = at.x;
  let z = at.z;
  let y = at.y;
  const dir = rng.range(0, Math.PI * 2);
  for (let s = 0; s < segs; s++) {
    const g = new THREE.CylinderGeometry(0.17 - s * 0.012, 0.2 - s * 0.012, height / segs + 0.05, 6);
    const nx = x + Math.cos(dir) * lean * (s + 1) * 0.35;
    const nz = z + Math.sin(dir) * lean * (s + 1) * 0.35;
    g.translate((x + nx) / 2, y + height / segs / 2, (z + nz) / 2);
    B.add('plant', g, I, s % 2 ? '#8A6A4C' : '#7A5C40');
    x = nx;
    z = nz;
    y += height / segs;
  }
  // Fronds: long thin leaves drooping out.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const g = new THREE.ConeGeometry(0.42, 3.4, 4, 1);
    g.rotateX(Math.PI / 2);
    g.scale(1, 0.18, 1);
    g.translate(0, 0, 1.6);
    g.rotateX(0.55 + rng.range(-0.1, 0.25));
    g.rotateY(-a);
    g.translate(x, y + 0.05, z);
    B.add('plant', g, I, snow ? '#7D9182' : k % 2 ? '#4E7A35' : '#5F8C3A');
  }
}

function addShrub(B, at, rng, snow) {
  const I = new THREE.Matrix4();
  for (let k = 0; k < 3; k++) {
    const g = new THREE.IcosahedronGeometry(rng.range(0.6, 1.1), 0);
    g.translate(at.x + rng.range(-0.8, 0.8), at.y + 0.5, at.z + rng.range(-0.8, 0.8));
    B.add('plant', g, I, snow ? '#E6EBEF' : ['#7E8C4A', '#6B7F3F', '#93965A'][rng.int(3)]);
  }
}

function addCentre(B, field, rng, snow, concrete) {
  const I = new THREE.Matrix4();
  for (const o of field.obstacles) {
    if (o.what === 'fountain') {
      const g = new THREE.CylinderGeometry(o.r, o.r + 0.1, o.y1, 32, 1);
      g.translate(o.x, o.y1 / 2, o.z);
      B.add('solid', g, I, concrete);
      const w = new THREE.CylinderGeometry(o.r - 0.3, o.r - 0.3, 0.05, 32);
      w.translate(o.x, o.y1 - 0.12, o.z);
      B.add('pool', w, I, snow ? '#CFE3EA' : '#2BB7B3');
    } else if (o.what === 'tree') {
      const g = new THREE.CylinderGeometry(o.r * 0.75, o.r, o.y1 - o.y0 + 0.6, 8);
      g.translate(o.x, (o.y0 + o.y1) / 2 + 0.3, o.z);
      B.add('plant', g, I, '#6B4A33');
    } else if (o.what === 'leaves' || o.what === 'branches' || o.what === 'fronds') {
      // A canopy of clumps inside the collision ellipsoid.
      const n = o.what === 'fronds' ? 7 : 14;
      for (let k = 0; k < n; k++) {
        const u = rng.range(-1, 1);
        const v = rng.range(0, Math.PI * 2);
        const rr = Math.sqrt(1 - u * u) * 0.62;
        const cx = o.x + Math.cos(v) * rr * o.rx;
        const cz = o.z + Math.sin(v) * rr * o.rz;
        const cy = o.y + u * o.ry * 0.45;
        const s = rng.range(0.42, 0.62) * Math.min(o.rx, o.ry * 1.6);
        const g = o.what === 'fronds' ? new THREE.ConeGeometry(0.4, o.rx * 1.7, 4) : new THREE.IcosahedronGeometry(s, 1);
        if (o.what === 'fronds') {
          g.rotateZ(Math.PI / 2 + 0.4);
          g.rotateY(-v);
          g.scale(1, 0.25, 1);
        }
        g.translate(cx, cy, cz);
        const tone = o.what === 'branches' ? (snow ? '#F4F6F8' : '#8D7A66') : ['#4F7A33', '#5E8A3A', '#6E9640', '#46702E'][rng.int(4)];
        B.add('plant', g, I, tone);
      }
    } else if (o.what === 'needles') {
      for (let k = 0; k < 4; k++) {
        const g = new THREE.ConeGeometry(o.rx * (1 - k * 0.2), o.ry * 0.7, 9);
        g.translate(o.x, o.y - o.ry * 0.45 + k * o.ry * 0.38, o.z);
        B.add('plant', g, I, k % 2 ? '#2F5A3A' : '#3A6B44');
      }
    } else if (o.what === 'car') {
      // A 1960s convertible in mint, parked across the island.
      const F = new THREE.Matrix4().makeRotationY(-o.rot).setPosition(o.x, 0, o.z);
      B.box('smooth', F, o.hx * 2, 0.62, o.hz * 2, 0, 0.62, 0, '#9ED8C6');
      B.box('smooth', F, o.hx * 1.1, 0.4, o.hz * 1.9, -0.2, 1.1, 0, '#9ED8C6');
      B.box('solid', F, o.hx * 0.7, 0.12, o.hz * 1.6, -0.3, 1.32, 0, '#C8553D');
      B.box('smooth', F, 0.1, 0.4, o.hz * 1.7, o.hx * 0.25, 1.4, 0, '#E9F4F7');
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const w = new THREE.CylinderGeometry(0.36, 0.36, 0.25, 12);
        w.rotateX(Math.PI / 2);
        w.translate(sx * o.hx * 0.65, 0.36, sz * o.hz);
        B.add('solid', w, F, '#2A2238');
      }
    } else if (o.what === 'palm') {
      addPalm(B, new THREE.Vector3(o.x, 0, o.z), o.y1, rng, snow);
    } else if (o.what === 'planter') {
      const g = new THREE.CylinderGeometry(o.r, o.r * 0.9, o.y1, 24);
      g.translate(o.x, o.y1 / 2, o.z);
      B.add('solid', g, I, concrete);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const g2 = new THREE.ConeGeometry(0.5, 1.4, 5);
        g2.translate(o.x + Math.cos(a) * o.r * 0.5, o.y1 + 0.6, o.z + Math.sin(a) * o.r * 0.5);
        B.add('plant', g2, I, k % 2 ? '#7FA06A' : '#E8645A');
      }
      const g3 = new THREE.ConeGeometry(0.9, 2.2, 6);
      g3.translate(o.x, o.y1 + 1.1, o.z);
      B.add('plant', g3, I, '#6E9A55');
    } else if (o.what === 'rock') {
      const g = new THREE.IcosahedronGeometry(1, 1);
      g.scale(o.rx, o.ry, o.rz);
      g.translate(o.x, o.y, o.z);
      B.add('plant', g, I, '#B5734E');
    }
  }
}

function makeFlag(owner, x, y, z) {
  const W = 1.6;
  const H = 1.0;
  const g = new THREE.PlaneGeometry(W, H, 8, 2);
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
    drawSymbol(c, owner.symbol, 64, 40, 46, '#F3E9D8');
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
      // The flag points downwind and ripples harder in a stronger wind.
      mesh.rotation.y = -ang;
      const amp = 0.08 + 0.25 * s;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const k = bx / W;
        pos.setXYZ(i, bx * (0.75 + 0.25 * s), by - (1 - s) * k * 0.45, Math.sin(t * (4 + 6 * s) - bx * 3) * amp * k);
      }
      pos.needsUpdate = true;
    },
  };
}

function buildWindsock(white) {
  const group = new THREE.Group();
  const mastH = 11;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, mastH, 8), new THREE.MeshStandardMaterial({ color: white, roughness: 0.4 }));
  mast.position.y = mastH / 2;
  mast.castShadow = true;
  group.add(mast);
  const pivot = new THREE.Group();
  pivot.position.y = mastH - 0.3;
  group.add(pivot);
  // The sock: five stripes, orange and white, a tapered tube along +x.
  const sock = new THREE.Group();
  pivot.add(sock);
  const L = 3.6;
  const parts = [];
  for (let k = 0; k < 5; k++) {
    const r0 = 0.62 - k * 0.075;
    const r1 = 0.62 - (k + 1) * 0.075;
    const g = new THREE.CylinderGeometry(r1, r0, L / 5, 14, 1, true);
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
      // Turns downwind; a calm sock hangs, a full one stands straight out.
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
        seg.position.x = 0.36 + k * (L / 5) * (0.92 + 0.08 * s);
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
  // Faces the middle, standing across the road's end.
  const fx = -Math.cos(a);
  const fz = -Math.sin(a);
  F.makeBasis(new THREE.Vector3(-fz, 0, fx), new THREE.Vector3(0, 1, 0), new THREE.Vector3(fx, 0, fz));
  F.setPosition(r * Math.cos(a), 0, r * Math.sin(a));
  B.box('solid', F, 12, 4.2, 6, 0, 2.1, -3, '#E9C98F');
  B.box('smooth', F, 13, 0.4, 7.4, 0, 4.4, -2.6, white);
  B.box('solid', F, 12.4, 0.5, 1, 0, 0.25, 0.3, concrete);
  B.box('solid', F, 2.0, 2.6, 0.1, 0, 1.3, 0.02, '#3A3442');
  B.box('solid', F, 3.6, 2.0, 0.08, -3.6, 1.6, 0.02, '#6FA3C8');
  B.box('solid', F, 3.6, 2.0, 0.08, 3.6, 1.6, 0.02, '#6FA3C8');
  // The neon: HARDWARE on a sign on the roof, OPEN / CLOSED in the window.
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
  const signMat = new THREE.MeshStandardMaterial({ map: tex, color: '#ffffff', emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 1.6, roughness: 0.6 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), signMat);
  const p = new THREE.Vector3(0, 6.2, -0.2).applyMatrix4(F);
  sign.position.copy(p);
  sign.lookAt(p.x + fx, p.y, p.z + fz);
  group.add(sign);
  const post = new THREE.BoxGeometry(0.2, 1.4, 0.2);
  post.translate(-3, 4.9, -0.3);
  B.add('smooth', post, F, white);
  const post2 = new THREE.BoxGeometry(0.2, 1.4, 0.2);
  post2.translate(3, 4.9, -0.3);
  B.add('smooth', post2, F, white);
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
