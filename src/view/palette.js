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

/** Each street's light: sun, sky, fog, ground tints. */
export const LIGHTS = {
  golden: { sun: '#FFC07A', sunI: 3.2, sunEl: 13, sunAz: 205, skyTop: '#6FA3C8', skyMid: '#F7C98E', skyLow: '#F4A86B', fog: '#F2C79A', hemiSky: '#FCD9AE', hemiGround: '#6F8F3A', hemiI: 1.15, ground: '#6F8F3A', sand: '#D9A86C', interior: '#FFC985', night: false },
  sunset: { sun: '#FF8F5A', sunI: 2.8, sunEl: 7, sunAz: 245, skyTop: '#5A6FA8', skyMid: '#F59A7A', skyLow: '#F06A4E', fog: '#E89A80', hemiSky: '#F7B39A', hemiGround: '#5E7A33', hemiI: 1.0, ground: '#647F35', sand: '#C98D62', interior: '#FFB878', night: false },
  afternoon: { sun: '#FFE0B0', sunI: 3.4, sunEl: 32, sunAz: 160, skyTop: '#5D9BD3', skyMid: '#A9D0EA', skyLow: '#F2DCC0', fog: '#E7D6BE', hemiSky: '#D8E8F2', hemiGround: '#6F8F3A', hemiI: 1.3, ground: '#73923C', sand: '#DDB27A', interior: '#FFD9A0', night: false },
  haze: { sun: '#FFCF8A', sunI: 2.7, sunEl: 16, sunAz: 120, skyTop: '#88A9C2', skyMid: '#EBCB9E', skyLow: '#F1D4AE', fog: '#E9D1AF', hemiSky: '#F1DCC0', hemiGround: '#6A8A3A', hemiI: 1.2, ground: '#6E8C3C', sand: '#CFAE80', interior: '#FFCD8C', night: false },
  night: { sun: '#9DB4FF', sunI: 1.0, sunEl: 35, sunAz: 140, skyTop: '#0E1030', skyMid: '#232250', skyLow: '#3B2E5E', fog: '#1E1C3E', hemiSky: '#4A4E92', hemiGround: '#26331C', hemiI: 0.85, ground: '#3A5124', sand: '#4D4052', interior: '#FFB760', night: true },
  snow: { sun: '#F2F4FF', sunI: 1.6, sunEl: 20, sunAz: 190, skyTop: '#AFC0D2', skyMid: '#DCE3EA', skyLow: '#EEF0F2', fog: '#E2E7EC', hemiSky: '#F4F7FA', hemiGround: '#D9DEE4', hemiI: 1.5, ground: '#EEF1F4', sand: '#E4E8EC', interior: '#FFCB8A', night: false, snow: true },
  dusk: { sun: '#FF9C6B', sunI: 2.3, sunEl: 5, sunAz: 260, skyTop: '#3B3F78', skyMid: '#C9708A', skyLow: '#F2925E', fog: '#C88778', hemiSky: '#D88E8A', hemiGround: '#5B5A32', hemiI: 0.95, ground: '#7A6A3A', sand: '#B8714A', interior: '#FFB070', night: false },
};
