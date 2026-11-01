// Trails: a ribbon behind each stone, built fresh every frame from where it has been, turned to face the camera, fading and
// thinning toward the tail. Two meshes: a soft one and a glowing one (fire, comets).

import * as THREE from 'three';

function softEdge() {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.5, 'rgba(255,255,255,1)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.75)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const MAXP = 24;

function ribbonMesh(cap, map, additive) {
  const verts = cap * MAXP * 2;
  const geo = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.BufferAttribute(new Float32Array(verts * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const uv = new THREE.BufferAttribute(new Float32Array(verts * 2), 2).setUsage(THREE.DynamicDrawUsage);
  const idx = new THREE.BufferAttribute(new Uint16Array(cap * (MAXP - 1) * 6), 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pos);
  geo.setAttribute('color', col);
  geo.setAttribute('uv', uv);
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mat = new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !additive });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = additive ? 7 : 5;
  return { mesh, geo, pos, col, uv, idx, nv: 0, ni: 0, cap: cap * MAXP * 2 };
}

/**
 * Trails keyed by anything (a stone id). push(key, x, y, z, t) records where it is; draw(cam, t, style(key) → {width, life, color(f)
 * → [r,g,b,a], glow}) builds the ribbons. Keys not pushed for a trail's whole life fade out and are dropped.
 */
export function createRibbons(scene, cap = 80) {
  const map = softEdge();
  const soft = ribbonMesh(cap, map, false);
  const glow = ribbonMesh(cap, map, true);
  scene.add(soft.mesh, glow.mesh);
  /** key → { pts: Float32Array(MAXP*4) (x,y,z,t), n, style, last } */
  const trails = new Map();
  const side = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const view = new THREE.Vector3();
  const rgba = [1, 1, 1, 1];

  function begin(r) {
    r.nv = 0;
    r.ni = 0;
  }
  function end(r) {
    r.geo.setDrawRange(0, r.ni);
    for (const a of [r.pos, r.col, r.uv]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, r.nv * a.itemSize);
      a.needsUpdate = true;
    }
    r.idx.clearUpdateRanges();
    r.idx.addUpdateRange(0, r.ni);
    r.idx.needsUpdate = true;
  }

  const R = {
    /** Records a point on key's trail; `style` is kept for when the stone is gone. */
    push(key, x, y, z, t, style) {
      let tr = trails.get(key);
      if (!tr) trails.set(key, (tr = { pts: new Float32Array(MAXP * 4), n: 0, style, last: t }));
      tr.style = style;
      tr.last = t;
      const p = tr.pts;
      if (tr.n > 0) {
        const o = (tr.n - 1) * 4;
        const d = Math.hypot(x - p[o], y - p[o + 1], z - p[o + 2]);
        // Too close: move the head instead of adding a point.
        if (d < 0.12) {
          p[o] = x;
          p[o + 1] = y;
          p[o + 2] = z;
          p[o + 3] = t;
          return;
        }
      }
      if (tr.n === MAXP) {
        p.copyWithin(0, 4);
        tr.n--;
      }
      const o = tr.n * 4;
      p[o] = x;
      p[o + 1] = y;
      p[o + 2] = z;
      p[o + 3] = t;
      tr.n++;
    },

    draw(cam, t) {
      begin(soft);
      begin(glow);
      for (const [key, tr] of trails) {
        const st = tr.style;
        // Points older than the trail's life drop off the tail.
        const life = st.life;
        let drop = 0;
        while (drop < tr.n && t - tr.pts[drop * 4 + 3] > life) drop++;
        if (drop) {
          tr.pts.copyWithin(0, drop * 4);
          tr.n -= drop;
        }
        if (tr.n < 2) {
          if (t - tr.last > life) trails.delete(key);
          continue;
        }
        for (const layer of st.layers) {
          const r = layer.glow ? glow : soft;
          if (r.nv + tr.n * 2 > r.cap) continue;
          const base = r.nv;
          const p = tr.pts;
          for (let i = 0; i < tr.n; i++) {
            const o = i * 4;
            const a = Math.max(0, i - 1) * 4;
            const b = Math.min(tr.n - 1, i + 1) * 4;
            tan.set(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]);
            view.set(cam.x - p[o], cam.y - p[o + 1], cam.z - p[o + 2]);
            side.crossVectors(tan, view);
            const l = side.length() || 1;
            // f: 0 at the tail, 1 at the head; age fades the whole trail once the stone has stopped.
            const f = i / (tr.n - 1);
            const age = Math.min(1, (t - p[o + 3]) / life);
            const tail = layer.tail ?? 0.15;
            const w = layer.width * (tail + (1 - tail) * f);
            layer.color(f, rgba, key);
            const alpha = rgba[3] * (1 - age) * (0.1 + 0.9 * f);
            side.multiplyScalar(w / 2 / l);
            for (const s of [1, -1]) {
              const v = r.nv++;
              r.pos.array[v * 3] = p[o] + side.x * s;
              r.pos.array[v * 3 + 1] = p[o + 1] + side.y * s;
              r.pos.array[v * 3 + 2] = p[o + 2] + side.z * s;
              r.col.array[v * 4] = rgba[0];
              r.col.array[v * 4 + 1] = rgba[1];
              r.col.array[v * 4 + 2] = rgba[2];
              r.col.array[v * 4 + 3] = alpha;
              r.uv.array[v * 2] = f;
              r.uv.array[v * 2 + 1] = s > 0 ? 1 : 0;
            }
          }
          for (let i = 0; i < tr.n - 1; i++) {
            const a = base + i * 2;
            const ix = r.idx.array;
            ix[r.ni++] = a;
            ix[r.ni++] = a + 1;
            ix[r.ni++] = a + 2;
            ix[r.ni++] = a + 1;
            ix[r.ni++] = a + 3;
            ix[r.ni++] = a + 2;
          }
        }
      }
      end(soft);
      end(glow);
    },

    clear() {
      trails.clear();
      begin(soft);
      begin(glow);
      end(soft);
      end(glow);
    },

    dispose() {
      scene.remove(soft.mesh, glow.mesh);
      for (const r of [soft, glow]) {
        r.geo.dispose();
        r.mesh.material.dispose();
      }
      map?.dispose();
    },
  };
  return R;
}
