// Each house's own build: its roof, its walls and what stands in its side yard. Roofs and carports are solid (stones clunk off
// them, the aiming arc and the bots know), so the shapes live here with the rules; street.js draws the same numbers.
// Local coordinates: u along the facade (right), d toward the street (the glass is at d = 0), y up from the house's ground.

import { FACADE_W, HOUSE_DEPTH, ROOF_Y, ROOF_T, ROOF_OVER } from './config.js';

const HALF_W = FACADE_W / 2;
export const ROOF_HALF = HALF_W + 1.2;
const ROOF_TOP = ROOF_Y + ROOF_T;

/** Six builds, Palm Springs 1957-63: Alexander butterflies, a Swiss Miss, Neutra's beams, a folded plate, a chimney, a clerestory. */
export const ROOFS = ['butterfly', 'swiss', 'beams', 'folded', 'chimney', 'clerestory'];
export const WALLS = ['stucco', 'stone', 'board', 'brick', 'stone', 'breeze'];
export const YARDS = ['carport', 'pool', 'garden', 'carport', 'pool', 'garden'];

/** The raised shapes start this far behind the glass: the cantilever over the glass stays a flat slab, so a lob dropping onto the
 * top panes never meets them. */
export const RISE_FROM = -1.2;

/** The roof's rise above the flat slab at `u` (metres), behind RISE_FROM. */
export function roofRise(roof, u) {
  const a = Math.abs(u);
  switch (roof) {
    case 'butterfly':
      return 1.6 * Math.min(1, a / ROOF_HALF);
    case 'swiss':
      return Math.max(0, 3.4 - a * 1.2);
    case 'folded': {
      const p = (2 * ROOF_HALF) / 5;
      const k = (u + ROOF_HALF) / p;
      const f = k - Math.floor(k);
      return 0.95 * (1 - Math.abs(2 * f - 1));
    }
    default:
      return 0;
  }
}

/** How far the roof reaches past its usual sides (Neutra's beams run out beyond the slab). */
export function roofReach(roof) {
  return roof === 'beams' ? 0.9 : 0;
}

/** A house's style from its street and seat: the same on every page. */
export function houseStyle(streetIndex, i) {
  const k = (i + streetIndex * 2) % ROOFS.length;
  const roof = ROOFS[k];
  const walls = WALLS[(i + streetIndex) % WALLS.length];
  const yard = YARDS[(i * 5 + streetIndex * 3) % YARDS.length];
  // The entry wing on the left: a low block with its own flat roof, the front door on its street face.
  const solids = [{ u0: -HALF_W - 4.0, u1: -HALF_W - 0.4, d0: -6.1, d1: 0.1, y0: 0, y1: 3.47, what: 'house' }];
  if (roof === 'chimney') solids.push({ u0: -HALF_W + 0.7, u1: -HALF_W + 2.7, d0: -7.4, d1: -5.4, y0: ROOF_Y, y1: ROOF_TOP + 2.7, what: 'roof' });
  if (roof === 'clerestory') solids.push({ u0: -HALF_W + 1.6, u1: HALF_W - 3.8, d0: -HOUSE_DEPTH * 0.82, d1: -HOUSE_DEPTH * 0.36, y0: ROOF_Y, y1: ROOF_TOP + 1.2, what: 'roof' });
  if (yard === 'carport') {
    // A flat roof on steel posts beside the house, with the family car under it.
    solids.push({ u0: HALF_W + 0.6, u1: HALF_W + 5.2, d0: -8.6, d1: -1.4, y0: 2.55, y1: 2.8, what: 'roof' });
    solids.push({ u0: HALF_W + 1.85, u1: HALF_W + 3.95, d0: -7.4, d1: -2.6, y0: 0, y1: 1.35, what: 'car' });
  }
  return { roof, walls, yard, solids, reach: roofReach(roof) };
}

/** The solid part of house `h` (with its style) at local (u, d, y), for a ball of radius r, or null. */
export function hitStyle(st, u, d, y, r) {
  const half = ROOF_HALF + st.reach;
  if (u >= -half - r && u <= half + r && d >= -HOUSE_DEPTH - 0.6 - r && d <= ROOF_OVER + r && y >= ROOF_Y - r) {
    const rise = d < RISE_FROM + r ? roofRise(st.roof, Math.max(-ROOF_HALF, Math.min(ROOF_HALF, u))) : 0;
    if (y <= ROOF_TOP + rise + r) return 'roof';
  }
  for (const b of st.solids) {
    if (u >= b.u0 - r && u <= b.u1 + r && d >= b.d0 - r && d <= b.d1 + r && y >= b.y0 - r && y <= b.y1 + r) return b.what;
  }
  return null;
}

/** The highest point of a house's roof, above its ground (for cameras and the bots' lobs). */
export function roofPeak(st) {
  let top = ROOF_TOP + Math.max(roofRise(st.roof, 0), roofRise(st.roof, ROOF_HALF));
  for (const b of st.solids) if (b.what === 'roof') top = Math.max(top, b.y1);
  return top;
}
