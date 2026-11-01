// The street's colours, and each house's owner colour with its symbol (the shape tells colours apart for everyone).

export const C = {
  lawn: '#6F8F3A',
  cream: '#F3E9D8',
  ink: '#2A2238',
  gold: '#FFB547',
  pool: '#2BB7B3',
  terracotta: '#C8553D',
  peach: '#F4C89A',
};

export const OWNERS = [
  { color: '#F08A24', symbol: 'star', name: 'tangerine' },
  { color: '#E5B83B', symbol: 'boomerang', name: 'mustard' },
  { color: '#2BB7B3', symbol: 'ring', name: 'turquoise' },
  { color: '#E8645A', symbol: 'diamond', name: 'coral' },
  { color: '#3563B8', symbol: 'triangle', name: 'cobalt' },
  { color: '#8A4F9E', symbol: 'square', name: 'plum' },
];

/** An owner's symbol as an SVG path in a 0..24 box. */
export function symbolPath(symbol) {
  switch (symbol) {
    case 'star': {
      // A mid-century starburst: 8 points.
      let d = '';
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2 - Math.PI / 2;
        const r = k % 2 ? 4.6 : 11;
        d += `${k ? 'L' : 'M'}${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`;
      }
      return `${d}Z`;
    }
    case 'boomerang':
      return 'M3 6 Q12 0 21 6 L19 10 Q12 6 5 10 Z M3 6 L5 10 L9 20 L5 21 Z';
    case 'ring':
      return 'M12 2 A10 10 0 1 1 11.99 2 Z M12 7 A5 5 0 1 0 12.01 7 Z';
    case 'diamond':
      return 'M12 1 L22 12 L12 23 L2 12 Z';
    case 'triangle':
      return 'M12 2 L23 21 L1 21 Z';
    case 'square':
      return 'M3 3 H21 V21 H3 Z';
    default:
      return 'M12 2 A10 10 0 1 1 11.99 2 Z';
  }
}

/** The symbol drawn on a 2D canvas, centred at (x, y) with size s. */
export function drawSymbol(ctx, symbol, x, y, s, fill) {
  const p = new Path2D(symbolPath(symbol));
  ctx.save();
  ctx.translate(x - s / 2, y - s / 2);
  ctx.scale(s / 24, s / 24);
  ctx.fillStyle = fill;
  ctx.fill(p, 'evenodd');
  ctx.restore();
}

/** Each street's light: the sun, the painted sky and its clouds, fog, the fill, the grade. */
export const LIGHTS = {
  golden: {
    sun: '#FFB46E', sunI: 3.3, sunEl: 11, sunAz: 205, sunSize: 0.04,
    skyTop: '#3569B0', skyMid: '#9FB8D2', skyLow: '#FFD3A4', glow: '#FF9A55', glowI: 0.6, cloudLit: '#FFE2C2', cloudShade: '#A88CA6', cover: 0.36,
    fog: '#EBD2B8', fogNear: 3.2, fogFar: 16, hemiSky: '#D9E2EE', hemiGround: '#8C8A50', hemiI: 0.9, exposure: 1.0,
    lift: '#2A3478', gain: '#FFEFD8', sat: 1.12, vignette: 0.3, bloom: 0.34, bloomAt: 0.9,
    ground: '#7C9A44', sand: '#DDC39C', interior: '#FFC985', night: false,
  },
  sunset: {
    sun: '#FF8452', sunI: 3.0, sunEl: 6, sunAz: 245, sunSize: 0.05,
    skyTop: '#3E4C8C', skyMid: '#E98C7C', skyLow: '#FF8C52', glow: '#FF6438', glowI: 0.7, cloudLit: '#FFB490', cloudShade: '#86587E', cover: 0.48,
    fog: '#E8957E', fogNear: 2.4, fogFar: 11, hemiSky: '#F7AE98', hemiGround: '#5E7A33', hemiI: 0.85, exposure: 1.02,
    lift: '#3A2266', gain: '#FFE2CC', sat: 1.12, vignette: 0.34, bloom: 0.4, bloomAt: 0.88,
    ground: '#6A8238', sand: '#C98D62', interior: '#FFB878', night: false,
  },
  afternoon: {
    sun: '#FFF0D6', sunI: 3.5, sunEl: 38, sunAz: 160, sunSize: 0.032,
    skyTop: '#3A84D6', skyMid: '#8EC2EA', skyLow: '#E4EEF0', glow: '#FFF6E8', glowI: 0.18, cloudLit: '#FFFFFF', cloudShade: '#A9B9D2', cover: 0.42,
    fog: '#DCE7EC', fogNear: 2.8, fogFar: 13, hemiSky: '#D8EAF6', hemiGround: '#728F3E', hemiI: 1.1, exposure: 0.98,
    lift: '#20306A', gain: '#FFF8EE', sat: 1.08, vignette: 0.24, bloom: 0.25, bloomAt: 0.95,
    ground: '#76953E', sand: '#DDB27A', interior: '#FFD9A0', night: false,
  },
  haze: {
    sun: '#FFD08C', sunI: 2.9, sunEl: 17, sunAz: 120, sunSize: 0.04,
    skyTop: '#7A9DC2', skyMid: '#E8CEA8', skyLow: '#F5DDBA', glow: '#FFC07A', glowI: 0.45, cloudLit: '#FFF0DC', cloudShade: '#B9A2A6', cover: 0.24,
    fog: '#EBD3B2', fogNear: 2.2, fogFar: 10, hemiSky: '#F1DCC0', hemiGround: '#6A8A3A', hemiI: 1.05, exposure: 1.0,
    lift: '#33306A', gain: '#FFF0DE', sat: 1.06, vignette: 0.28, bloom: 0.3, bloomAt: 0.92,
    ground: '#6E8C3C', sand: '#CFAE80', interior: '#FFCD8C', night: false,
  },
  night: {
    sun: '#A9BEFF', sunI: 0.95, sunEl: 40, sunAz: 140, sunSize: 0.03,
    skyTop: '#0A0D2A', skyMid: '#1C1F4E', skyLow: '#3A2C5E', glow: '#6A3E8E', glowI: 0.4, cloudLit: '#4C4F86', cloudShade: '#191A38', cover: 0.22,
    fog: '#1F1C40', fogNear: 2.2, fogFar: 10, hemiSky: '#4B52A4', hemiGround: '#22301A', hemiI: 0.75, exposure: 1.3,
    lift: '#1A2A70', gain: '#FFE8C8', sat: 1.12, vignette: 0.4, bloom: 0.65, bloomAt: 0.78,
    ground: '#3A5124', sand: '#4D4052', interior: '#FFB760', night: true,
  },
  snow: {
    sun: '#F4F6FF', sunI: 1.5, sunEl: 22, sunAz: 190, sunSize: 0.03,
    skyTop: '#9AB0C8', skyMid: '#D3DCE6', skyLow: '#EEF1F4', glow: '#FFFFFF', glowI: 0.15, cloudLit: '#FFFFFF', cloudShade: '#B6C0CE', cover: 0.75,
    fog: '#E2E7EC', fogNear: 1.6, fogFar: 7, hemiSky: '#F4F7FA', hemiGround: '#D9DEE4', hemiI: 1.35, exposure: 0.86,
    lift: '#2A3A6A', gain: '#F6F8FF', sat: 1.0, vignette: 0.26, bloom: 0.25, bloomAt: 0.96,
    ground: '#EEF1F4', sand: '#E4E8EC', interior: '#FFCB8A', night: false, snow: true,
  },
  dusk: {
    sun: '#FF7A5A', sunI: 2.5, sunEl: 4, sunAz: 260, sunSize: 0.055,
    skyTop: '#28306C', skyMid: '#B3648C', skyLow: '#F28A5C', glow: '#FF5A40', glowI: 0.65, cloudLit: '#FF9E7C', cloudShade: '#5A3A6C', cover: 0.44,
    fog: '#C5847C', fogNear: 2.2, fogFar: 10, hemiSky: '#D88E8A', hemiGround: '#5B5A32', hemiI: 0.85, exposure: 1.05,
    lift: '#36206C', gain: '#FFDCC8', sat: 1.12, vignette: 0.36, bloom: 0.45, bloomAt: 0.86,
    ground: '#7A6A3A', sand: '#B8714A', interior: '#FFB070', night: false,
  },
};
