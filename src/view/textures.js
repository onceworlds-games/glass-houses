// The street's surfaces, painted once on canvases: desert flagstone, painted brick, redwood boards, breeze block you can see through,
// stucco, lawn, asphalt, terrazzo and walnut floors, and the rugs and paintings inside. Tiled in metres (see build.js uvScale).

import * as THREE from 'three';
import { createRng } from '../core/rng.js';

let CACHE = null;

function canvas(w, h) {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

function tex(cv, opts = {}) {
  if (!cv) return null;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Speckle: fine grain over a surface, so nothing reads as flat paint. */
function grain(g, w, h, r, n, alpha = 0.06, size = 2) {
  g.save();
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.4 + r.next() * 0.6);
    g.fillStyle = r.chance(0.5) ? '#000' : '#fff';
    const s = size * (0.5 + r.next());
    g.fillRect(r.next() * w, r.next() * h, s, s);
  }
  g.restore();
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

export function textures() {
  if (CACHE) return CACHE;
  const T = {};

  // Desert flagstone: irregular stones in buff, rose and rust, set in deep mortar; each stone shaded light at the top.
  {
    const cv = canvas(512, 512);
    if (cv) {
      const g = cv.getContext('2d');
      const r = createRng(7);
      g.fillStyle = '#7A6656';
      g.fillRect(0, 0, 512, 512);
      const tones = ['#D8C3A2', '#C7AC86', '#B89874', '#D9CDB3', '#AE8463', '#CDB28E', '#C49A7A', '#E0D0B4', '#A88A6C'];
      for (let y = 0; y < 512; ) {
        const rh = 34 + r.int(40);
        for (let x = -r.int(60); x < 512; ) {
          const rw = 50 + r.int(90);
          const tone = tones[r.int(tones.length)];
          const pts = [
            [x + 4 + r.int(5), y + 4 + r.int(5)],
            [x + rw - 4 - r.int(5), y + 3 + r.int(6)],
            [x + rw - 3 - r.int(6), y + rh - 4 - r.int(5)],
            [x + 3 + r.int(6), y + rh - 3 - r.int(6)],
          ];
          for (const dy of [0, 512, -512]) {
            g.beginPath();
            pts.forEach(([px, py], i) => (i ? g.lineTo(px, py + dy) : g.moveTo(px, py + dy)));
            g.closePath();
            const grd = g.createLinearGradient(0, y + dy, 0, y + rh + dy);
            grd.addColorStop(0, shade(tone, 1.08));
            grd.addColorStop(1, shade(tone, 0.86));
            g.fillStyle = grd;
            g.fill();
          }
          x += rw;
        }
        y += rh;
      }
      grain(g, 512, 512, r, 9000, 0.07, 2);
      T.stone = tex(cv);
    }
  }

  // Painted brick, white, the courses picked out in grey.
  {
    const cv = canvas(256, 256);
    if (cv) {
      const g = cv.getContext('2d');
      const r = createRng(17);
      g.fillStyle = '#CFC8BC';
      g.fillRect(0, 0, 256, 256);
      const bh = 256 / 12;
      for (let row = 0; row < 12; row++) {
        const off = row % 2 ? 32 : 0;
        for (let x = -off; x < 256; x += 64) {
          const v = 0.95 + r.next() * 0.06;
          g.fillStyle = shade('#F4EFE6', v);
          g.fillRect(x + 2, row * bh + 2, 60, bh - 3);
        }
      }
      grain(g, 256, 256, r, 3000, 0.05, 2);
      T.brick = tex(cv);
    }
  }

  // Vertical boards (board and batten), tinted by vertex colour.
  {
    const cv = canvas(256, 256);
    if (cv) {
      const g = cv.getContext('2d');
      const r = createRng(23);
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, 256, 256);
      for (let x = 0; x < 256; x += 32) {
        const v = 0.9 + r.next() * 0.1;
        g.fillStyle = shade('#FFFFFF', v);
        g.fillRect(x, 0, 32, 256);
        // Grain lines.
        g.strokeStyle = 'rgba(0,0,0,0.06)';
        for (let k = 0; k < 4; k++) {
          g.beginPath();
          const gx = x + 4 + r.next() * 24;
          g.moveTo(gx, 0);
          g.bezierCurveTo(gx + r.range(-3, 3), 80, gx + r.range(-3, 3), 170, gx, 256);
          g.stroke();
        }
        // The batten.
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(x + 29, 0, 3, 256);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(x, 0, 2, 256);
      }
      T.board = tex(cv);
    }
  }

  // Breeze block: square blocks with a four-petal cut-out you can see through (alpha), for screens and walls.
  {
    const cv = canvas(256, 256);
    if (cv) {
      const g = cv.getContext('2d');
      g.clearRect(0, 0, 256, 256);
      for (let by = 0; by < 2; by++) {
        for (let bx = 0; bx < 2; bx++) {
          const ox = bx * 128;
          const oy = by * 128;
          g.fillStyle = '#F2ECE2';
          g.fillRect(ox + 3, oy + 3, 122, 122);
          g.globalCompositeOperation = 'destination-out';
          const cx = ox + 64;
          const cy = oy + 64;
          for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            g.beginPath();
            g.ellipse(cx + dx * 26, cy + dy * 26, 20, 20, 0, 0, Math.PI * 2);
            g.fill();
          }
          g.beginPath();
          g.arc(cx, cy, 10, 0, Math.PI * 2);
          g.fill();
          g.globalCompositeOperation = 'source-over';
          // Inner reveal: a shaded lip round each hole.
          g.strokeStyle = 'rgba(120,100,80,0.45)';
          g.lineWidth = 3;
          for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            g.beginPath();
            g.ellipse(cx + dx * 26, cy + dy * 26, 21, 21, 0, Math.PI * 0.9, Math.PI * 1.9);
            g.stroke();
          }
        }
      }
      T.breeze = tex(cv);
    }
  }

  // Stucco: a soft, irregular trowel texture (multiplied by the vertex colour).
  {
    const cv = canvas(256, 256);
    if (cv) {
      const g = cv.getContext('2d');
      const r = createRng(29);
      g.fillStyle = '#F6F2EA';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 260; i++) {
        g.globalAlpha = 0.05;
        g.fillStyle = r.chance(0.5) ? '#C8B8A0' : '#FFFFFF';
        g.beginPath();
        g.ellipse(r.next() * 256, r.next() * 256, 6 + r.next() * 22, 3 + r.next() * 9, r.next() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      grain(g, 256, 256, r, 5000, 0.05, 1.5);
      T.stucco = tex(cv);
    }
  }

  // Lawn: blades in light and dark, mower stripes, clover patches. White-based: the vertex colour gives the green.
  {
    const cv = canvas(512, 512);
    if (cv) {
      const g = cv.getContext('2d');
      const r = createRng(11);
      g.fillStyle = '#E6EEDC';
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 260; i++) {
        g.globalAlpha = 0.12;
        g.fillStyle = r.chance(0.5) ? '#B8C8A0' : '#FFFFFF';
        g.beginPath();
        g.arc(r.next() * 512, r.next() * 512, 8 + r.next() * 30, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      for (let i = 0; i < 16000; i++) {
        const v = 0.74 + r.next() * 0.34;
        g.fillStyle = `rgb(${Math.round(255 * v * 0.98)},${Math.round(255 * Math.min(1, v + 0.04))},${Math.round(255 * v * 0.86)})`;
        const x = r.next() * 512;
        const y = r.next() * 512;
        g.save();
        g.translate(x, y);
        g.rotate(r.range(-0.5, 0.5));
        g.fillRect(0, 0, 1.6, 5 + r.next() * 6);
        g.restore();
      }
      g.globalAlpha = 0.07;
      g.fillStyle = '#000';
      for (let x = 0; x < 512; x += 128) g.fillRect(x, 0, 64, 512);
      T.grass = tex(cv);
    }
  }

  // Asphalt: fine aggregate, tar seams.
  {
    const cv = canvas(512, 512);
    if (cv) {
      const g = cv.getContext('2d');
      const r = createRng(13);
      g.fillStyle = '#E8E8E8';
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 26000; i++) {
        const v = 0.7 + r.next() * 0.42;
        g.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(252 * v)},${Math.round(246 * v)})`;
        g.fillRect(r.next() * 512, r.next() * 512, 1.5 + r.next() * 1.5, 1.5 + r.next() * 1.5);
      }
      g.strokeStyle = 'rgba(30,26,24,0.16)';
      g.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        let x = r.next() * 512;
        let y = 0;
        g.moveTo(x, y);
        while (y < 512) {
          x += r.range(-14, 14);
          y += r.range(10, 30);
          g.lineTo(x, y);
        }
        g.stroke();
      }
      T.road = tex(cv);
    }
  }

  // Desert sand: ripples and pebbles.
  {
    const cv = canvas(256, 256);
    if (cv) {
      const g = cv.getContext('2d');
      const r = createRng(37);
      g.fillStyle = '#F1E9DC';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4000; i++) {
        g.fillStyle = r.chance(0.5) ? 'rgba(140,110,80,0.18)' : 'rgba(255,255,255,0.3)';
        g.fillRect(r.next() * 256, r.next() * 256, 1 + r.next() * 2.5, 1 + r.next() * 2);
      }
      T.sand = tex(cv);
    }
  }

  // Terrazzo floor: cream with chips of rust, sage and black.
  {
    const cv = canvas(256, 256);
    if (cv) {
      const g = cv.getContext('2d');
      const r = createRng(41);
      g.fillStyle = '#EDE4D3';
      g.fillRect(0, 0, 256, 256);
      const chips = ['#B5653F', '#7E9070', '#2E2A30', '#D9B98A', '#FFFFFF'];
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = chips[r.int(chips.length)];
        g.beginPath();
        const x = r.next() * 256;
        const y = r.next() * 256;
        const s = 1 + r.next() * 3.5;
        g.moveTo(x, y);
        g.lineTo(x + s, y + r.range(-s, s));
        g.lineTo(x + r.range(-s, s), y + s);
        g.fill();
      }
      T.terrazzo = tex(cv);
    }
  }

  // Walnut floor boards.
  {
    const cv = canvas(256, 256);
    if (cv) {
      const g = cv.getContext('2d');
      const r = createRng(43);
      for (let y = 0; y < 256; y += 32) {
        for (let x = -r.int(200); x < 256; ) {
          const len = 120 + r.int(140);
          g.fillStyle = shade('#8A5A3A', 0.85 + r.next() * 0.3);
          g.fillRect(x, y, len, 31);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(x + len - 1, y, 1, 31);
          x += len;
        }
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(0, y + 31, 256, 1);
      }
      grain(g, 256, 256, r, 2000, 0.06, 2);
      T.walnut = tex(cv);
    }
  }

  // Rugs: a shag in mustard, a geometric in teal and rust.
  {
    const cv = canvas(256, 256);
    if (cv) {
      const g = cv.getContext('2d');
      g.fillStyle = '#E8D6A8';
      g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#C8553D';
      g.fillRect(16, 16, 224, 224);
      g.fillStyle = '#F3E9D8';
      g.fillRect(28, 28, 200, 200);
      g.fillStyle = '#2B8C8A';
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          g.save();
          g.translate(52 + x * 50, 52 + y * 50);
          g.rotate(Math.PI / 4);
          g.fillRect(-12, -12, 24, 24);
          g.restore();
        }
      }
      T.rug = tex(cv, { repeat: false });
    }
  }

  // Paintings for the back walls: big colour-field abstracts in the period's palette, three side by side in one texture.
  {
    const cv = canvas(384, 96);
    if (cv) {
      const g = cv.getContext('2d');
      const palettes = [
        ['#E8645A', '#F2B544', '#2BB7B3', '#F3E9D8'],
        ['#3563B8', '#F08A24', '#F3E9D8', '#2A2238'],
        ['#8A4F9E', '#E5B83B', '#F3E9D8', '#7E9070'],
      ];
      for (let k = 0; k < 3; k++) {
        const p = palettes[k];
        const r = createRng(50 + k);
        g.save();
        g.beginPath();
        g.rect(k * 128, 0, 128, 96);
        g.clip();
        g.translate(k * 128, 0);
        g.fillStyle = p[2];
        g.fillRect(0, 0, 128, 96);
        for (let i = 0; i < 5; i++) {
          g.fillStyle = p[i % 4];
          if (r.chance(0.5)) {
            g.beginPath();
            g.arc(r.range(20, 108), r.range(20, 76), r.range(10, 30), 0, Math.PI * 2);
            g.fill();
          } else g.fillRect(r.range(0, 90), r.range(0, 70), r.range(20, 60), r.range(12, 40));
        }
        g.strokeStyle = '#2A2238';
        g.lineWidth = 6;
        g.strokeRect(0, 0, 128, 96);
        g.restore();
      }
      T.art = tex(cv, { repeat: false });
    }
  }

  CACHE = T;
  return T;
}

/** A small texture for a canvas-drawn thing, not tiled. */
export function drawTexture(w, h, draw) {
  const cv = canvas(w, h);
  if (!cv) return null;
  draw(cv.getContext('2d'), w, h);
  return tex(cv, { repeat: false });
}
