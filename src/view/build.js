// Static geometry, merged: every piece is put in the world with a matrix and a colour, and pieces that share a material become one
// mesh (one draw call).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tmpColor = new THREE.Color();

export function createBuilder() {
  const groups = new Map();
  const B = {};

  /**
   * Adds a geometry (consumed), placed by `matrix`, in one colour (or per-vertex colours it already has), under a material key.
   * `sway` (0..1, or a function of the vertex's local height) is how much the wind moves it: palms, fronds, flags of leaves.
   */
  B.add = function add(key, geo, matrix, color, sway = 0) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const n = g.attributes.position.count;
    if (!g.attributes.sway) {
      const w = new Float32Array(n);
      if (typeof sway === 'function') {
        const p = g.attributes.position;
        for (let i = 0; i < n; i++) w[i] = sway(p.getY(i), p.getX(i), p.getZ(i));
      } else if (sway) w.fill(sway);
      g.setAttribute('sway', new THREE.BufferAttribute(w, 1));
    }
    if (matrix) {
      g.applyMatrix4(matrix);
      // A mirroring matrix (a house frame is one) turns triangles inside out: wind them back.
      if (matrix.determinant() < 0) flipWinding(g);
    }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (color !== undefined && color !== null) {
      tmpColor.set(color);
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        c[i * 3] = tmpColor.r;
        c[i * 3 + 1] = tmpColor.g;
        c[i * 3 + 2] = tmpColor.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    } else if (!g.attributes.color) {
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    }
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'sway'].includes(name)) g.deleteAttribute(name);
    let list = groups.get(key);
    if (!list) groups.set(key, (list = []));
    list.push(g);
    return g;
  };

  /** A box of w × h × d with its centre at (x, y, z) in `frame` (a matrix), UVs in metres / `uvScale`. */
  B.box = function box(key, frame, w, h, d, x, y, z, color, uvScale = 0, sway = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (uvScale > 0) scaleBoxUV(g, w, h, d, uvScale);
    g.translate(x, y, z);
    return B.add(key, g, frame, color, sway);
  };

  /** A view of this builder that stamps every piece with `tag` in its sway slot (interiors use it as the house's number). */
  B.tagged = function tagged(tag) {
    return {
      add: (key, g, M, color) => B.add(key, g, M, color, tag),
      box: (key, frame, w, h, d, x, y, z, color, uvScale = 0) => B.box(key, frame, w, h, d, x, y, z, color, uvScale, tag),
    };
  };

  /** Makes one mesh per material key. `materials`: { key: material }. */
  B.build = function build(materials, opts = {}) {
    const out = new THREE.Group();
    for (const [key, list] of groups) {
      const mat = materials[key];
      if (!mat || !list.length) continue;
      const geo = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = key;
      mesh.castShadow = opts.noShadow?.includes(key) ? false : true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      out.add(mesh);
    }
    groups.clear();
    return out;
  };
  return B;
}

/** Reverses every triangle of a non-indexed geometry. */
export function flipWinding(g) {
  for (const a of Object.values(g.attributes)) {
    const arr = a.array;
    const n = a.itemSize;
    for (let i = 0; i + 2 < a.count; i += 3) {
      for (let k = 0; k < n; k++) {
        const j = (i + 1) * n + k;
        const l = (i + 2) * n + k;
        const t = arr[j];
        arr[j] = arr[l];
        arr[l] = t;
      }
    }
  }
}

/** A box's UVs in world metres, so a tiled texture keeps its size on any box. */
function scaleBoxUV(g, w, h, d, s) {
  const uv = g.attributes.uv;
  // BoxGeometry faces: +x, -x, +y, -y, +z, -z; 4 vertices each.
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / s, (uv.getY(i) * dims[f][1]) / s);
    }
  }
}

/** A frame matrix from a house: columns right, up, forward (toward the street), origin at the facade's centre on the ground. It mirrors
 * (right × up = -forward), so whatever is placed with it must wind its triangles the other way: B.add does, the glass pre-mirrors. */
export function houseFrame(h) {
  const m = new THREE.Matrix4();
  m.makeBasis(new THREE.Vector3(h.rx, 0, h.rz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(h.fx, 0, h.fz));
  m.setPosition(h.cx, h.elev, h.cz);
  return m;
}

/** A flat ring sector (or a disc when r0 is 0) at height y, coloured per vertex by `colorAt(r, a)`. */
export function sectorGeometry(r0, r1, a0, a1, y, segR, segA, colorAt) {
  const pos = [];
  const col = [];
  const uv = [];
  const c = new THREE.Color();
  const pt = (r, a) => {
    pos.push(r * Math.cos(a), y, r * Math.sin(a));
    c.set(colorAt(r, a));
    col.push(c.r, c.g, c.b);
    uv.push(r * Math.cos(a), r * Math.sin(a));
  };
  for (let i = 0; i < segR; i++) {
    const ra = r0 + ((r1 - r0) * i) / segR;
    const rb = r0 + ((r1 - r0) * (i + 1)) / segR;
    for (let j = 0; j < segA; j++) {
      const aa = a0 + ((a1 - a0) * j) / segA;
      const ab = a0 + ((a1 - a0) * (j + 1)) / segA;
      // Two triangles, wound to face up.
      pt(ra, aa);
      pt(rb, ab);
      pt(rb, aa);
      pt(ra, aa);
      pt(ra, ab);
      pt(rb, ab);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** A vertical curved wall along a circle from a0 to a1 at radius r, from y0 to y1. */
export function arcWallGeometry(r, a0, a1, y0, y1, seg) {
  const pos = [];
  const uv = [];
  for (let j = 0; j < seg; j++) {
    const aa = a0 + ((a1 - a0) * j) / seg;
    const ab = a0 + ((a1 - a0) * (j + 1)) / seg;
    const A = [r * Math.cos(aa), r * Math.sin(aa)];
    const Bp = [r * Math.cos(ab), r * Math.sin(ab)];
    const ua = r * aa;
    const ub = r * ab;
    pos.push(A[0], y0, A[1], Bp[0], y1, Bp[1], Bp[0], y0, Bp[1], A[0], y0, A[1], A[0], y1, A[1], Bp[0], y1, Bp[1]);
    uv.push(ua, y0, ub, y1, ub, y0, ua, y0, ua, y1, ub, y1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** A canvas texture that tiles. */
export function canvasTexture(w, h, draw, repeat = true) {
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!cv) return null;
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
