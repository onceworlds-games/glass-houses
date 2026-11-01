// The eight streets: where the houses stand, what is in the middle, the light, the wind and who lives there.
// Every layout faces one centre point, so every lawn can reach every house.

export const STREETS = [
  {
    id: 'palm-court', name: 'Palm Court', R: 22, spread: 360, rot: 90, elev: [0, 0, 0, 0, 0, 0], centre: 'oak', light: 'golden',
    wind: [0, 1.0], gust: 0.5, ice: false, skill: [0.2, 0.4], specialGap: [25000, 35000],
    lineup: ['walt', 'ray', 'rosa', 'bev', 'twins'],
  },
  {
    id: 'sunset-loop', name: 'Sunset Loop', R: 24, spread: 360, rot: 90, elev: [0, 0, 0, 0, 0, 0], centre: 'car', light: 'sunset',
    wind: [0, 1.5], gust: 0.6, ice: false, skill: [0.3, 0.5], specialGap: [25000, 35000],
    lineup: ['ray', 'bev', 'twins', 'sunny', 'walt'],
  },
  {
    id: 'little-loop', name: 'Little Loop', R: 16, spread: 360, rot: 90, elev: [0, 0, 0, 0, 0, 0], centre: 'planter', light: 'afternoon',
    wind: [0, 1.0], gust: 0.5, ice: false, skill: [0.35, 0.55], specialGap: [25000, 35000],
    lineup: ['twins', 'chad', 'sunny', 'ray', 'rosa'],
  },
  {
    id: 'cliff-top', name: 'Cliff Top', R: 22, spread: 240, rot: 90, elev: [0, 0, 0, 0, 0, 0], centre: 'pine', light: 'haze',
    wind: [0.5, 3.0], gust: 1, ice: false, skill: [0.4, 0.6], specialGap: [25000, 35000], sea: true,
    lineup: ['lindqvist', 'walt', 'chad', 'bev', 'sunny'],
  },
  {
    id: 'hillside', name: 'Hillside', R: 22, spread: 360, rot: 90, elev: [0, 2, 5, 6, 5, 2], centre: 'oak', light: 'golden',
    wind: [0, 1.5], gust: 0.6, ice: false, skill: [0.5, 0.7], specialGap: [25000, 35000],
    lineup: ['rosa', 'chad', 'lindqvist', 'ray', 'twins'],
  },
  {
    id: 'porch-lights', name: 'Porch Lights', R: 22, spread: 360, rot: 90, elev: [0, 0, 0, 0, 0, 0], centre: 'oak', light: 'night',
    wind: [0, 1.5], gust: 0.6, ice: false, skill: [0.55, 0.75], specialGap: [25000, 35000],
    lineup: ['bev', 'sunny', 'walt', 'lindqvist', 'chad'],
  },
  {
    id: 'snow-day', name: 'Snow Day', R: 20, spread: 360, rot: 90, elev: [0, 0, 0, 0, 0, 0], centre: 'bare-oak', light: 'snow',
    wind: [0.5, 2.0], gust: 0.7, ice: true, skill: [0.6, 0.8], specialGap: [25000, 35000],
    lineup: ['twins', 'rosa', 'chad', 'sunny', 'lindqvist'],
  },
  {
    id: 'mesa-drive', name: 'Mesa Drive', R: 26, spread: 360, rot: 90, elev: [0, 0, 0, 0, 0, 0], centre: 'boulder', light: 'dusk',
    wind: [0.5, 3.0], gust: 1, ice: false, skill: [0.75, 0.95], specialGap: [18000, 25000],
    lineup: ['lindqvist', 'chad', 'sunny', 'rosa', 'bev'],
  },
];

export const STREET_COUNT = STREETS.length;

const DEG = Math.PI / 180;

export const angleDiff = (a, b) => {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

function centreObstacles(kind) {
  switch (kind) {
    case 'oak':
      return [
        { type: 'cyl', x: 0, z: 0, r: 3.5, y0: 0, y1: 0.7, what: 'fountain' },
        { type: 'cyl', x: 0, z: 0, r: 0.7, y0: 0, y1: 5.5, what: 'tree' },
        { type: 'ell', x: 0, y: 6.8, z: 0, rx: 4.8, ry: 3.0, rz: 4.8, what: 'leaves' },
      ];
    case 'bare-oak':
      return [
        { type: 'cyl', x: 0, z: 0, r: 3.5, y0: 0, y1: 0.7, what: 'fountain' },
        { type: 'cyl', x: 0, z: 0, r: 0.7, y0: 0, y1: 5.5, what: 'tree' },
        { type: 'ell', x: 0, y: 6.6, z: 0, rx: 3.8, ry: 2.6, rz: 3.8, what: 'branches' },
      ];
    case 'car':
      return [
        { type: 'box', x: 0, y: 0.7, z: 0, hx: 2.3, hy: 0.7, hz: 0.95, rot: 0.6, what: 'car' },
        { type: 'cyl', x: 3.6, z: 1.8, r: 0.3, y0: 0, y1: 7.2, what: 'palm' },
        { type: 'ell', x: 3.6, y: 7.6, z: 1.8, rx: 2.3, ry: 1.1, rz: 2.3, what: 'fronds' },
        { type: 'cyl', x: -3.2, z: -2.4, r: 0.3, y0: 0, y1: 8.4, what: 'palm' },
        { type: 'ell', x: -3.2, y: 8.8, z: -2.4, rx: 2.3, ry: 1.1, rz: 2.3, what: 'fronds' },
        { type: 'cyl', x: -1.2, z: 3.8, r: 0.28, y0: 0, y1: 6.2, what: 'palm' },
        { type: 'ell', x: -1.2, y: 6.6, z: 3.8, rx: 2.1, ry: 1.0, rz: 2.1, what: 'fronds' },
      ];
    case 'planter':
      return [{ type: 'cyl', x: 0, z: 0, r: 2.4, y0: 0, y1: 0.9, what: 'planter' }];
    case 'pine':
      return [
        { type: 'cyl', x: 0, z: 0, r: 0.6, y0: 0, y1: 6.5, what: 'tree' },
        { type: 'ell', x: 0, y: 7.4, z: 0, rx: 2.6, ry: 4.6, rz: 2.6, what: 'needles' },
      ];
    case 'boulder':
      return [
        { type: 'ell', x: 0, y: 1.0, z: 0, rx: 3.4, ry: 2.4, rz: 3.0, what: 'rock' },
        { type: 'cyl', x: 4.6, z: 1.0, r: 0.35, y0: 0, y1: 4.2, what: 'tree' },
        { type: 'ell', x: 4.6, y: 4.9, z: 1.0, rx: 1.7, ry: 1.1, rz: 1.7, what: 'leaves' },
      ];
    default:
      return [];
  }
}

/** The geometry of a street: houses with their frames and lawns, the props in the middle, the ground, the spots specials land on. */
export function buildField(index) {
  const street = STREETS[Math.max(0, Math.min(STREETS.length - 1, index | 0))];
  const n = 6;
  const R = street.R;
  const ring = street.spread >= 360;
  const step = (ring ? 360 / n : street.spread / (n - 1)) * DEG;
  const first = ring ? street.rot * DEG : (street.rot - street.spread / 2) * DEG;
  const rMin = R - 7.5;
  const rMax = R - 3;
  const rMid = (rMin + rMax) / 2;
  const margin = 0.3 / rMid;
  const houses = [];
  for (let i = 0; i < n; i++) {
    const a = first + i * step;
    const fx = -Math.cos(a);
    const fz = -Math.sin(a);
    houses.push({
      i,
      angle: a,
      cx: R * Math.cos(a),
      cz: R * Math.sin(a),
      fx,
      fz,
      rx: -fz,
      rz: fx,
      elev: street.elev[i] ?? 0,
      lawn: { rMin, rMax, aMin: a - step / 2 + margin, aMax: a + step / 2 - margin, angle: a },
      // Where its owner stands at the start: the middle of the lawn.
      spawn: { x: rMid * Math.cos(a), z: rMid * Math.sin(a) },
    });
  }
  const spots = [];
  for (let i = 0; i < n; i++) {
    const j = i + 1;
    if (j >= n && !ring) continue;
    const a = first + (i + 0.5) * step;
    spots.push({ a: i, b: j % n, x: rMid * Math.cos(a), z: rMid * Math.sin(a) });
  }
  const terrace = R - 8;
  const seaFrom = ring ? null : { from: first + (n - 1) * step + step / 2, to: first - step / 2 + 2 * Math.PI };
  const field = {
    index: STREETS.indexOf(street),
    street,
    R,
    ring,
    step,
    houses,
    obstacles: centreObstacles(street.centre),
    ghostR: R * 0.55,
    terrace,
    spots,
    sea: !!street.sea,
    groundY(x, z) {
      const r = Math.hypot(x, z);
      if (r < terrace) return 0;
      const a = Math.atan2(z, x);
      if (field.sea && r > R - 4 && field.inSea(a)) return -30;
      let best = null;
      let bestD = Infinity;
      for (const h of houses) {
        const d = Math.abs(angleDiff(a, h.angle));
        if (d < bestD) {
          bestD = d;
          best = h;
        }
      }
      return best && bestD <= step / 2 + 1e-6 ? best.elev : 0;
    },
    inSea(a) {
      if (!seaFrom) return false;
      // Angles past the last house and before the first, the open side of the horseshoe.
      const span = seaFrom.to - seaFrom.from;
      let d = (a - seaFrom.from) % (2 * Math.PI);
      if (d < 0) d += 2 * Math.PI;
      return d > 0.05 && d < span - 0.05;
    },
  };
  return field;
}

/** Keeps a body on its lawn: an annular sector around the street's centre. Writes into `out`. */
export function clampToLawn(lawn, x, z, out) {
  let r = Math.hypot(x, z);
  let a = Math.atan2(z, x);
  const d = angleDiff(a, lawn.angle);
  const lo = lawn.aMin - lawn.angle;
  const hi = lawn.aMax - lawn.angle;
  const dc = Math.min(hi, Math.max(lo, d));
  a = lawn.angle + dc;
  r = Math.min(lawn.rMax, Math.max(lawn.rMin, r));
  out.x = r * Math.cos(a);
  out.z = r * Math.sin(a);
  out.clamped = dc !== d || r !== Math.hypot(x, z);
  return out;
}

export function inLawn(lawn, x, z, slack = 0) {
  const r = Math.hypot(x, z);
  const d = angleDiff(Math.atan2(z, x), lawn.angle);
  const slackA = slack / Math.max(1, r);
  return r >= lawn.rMin - slack && r <= lawn.rMax + slack && d >= lawn.aMin - lawn.angle - slackA && d <= lawn.aMax - lawn.angle + slackA;
}
