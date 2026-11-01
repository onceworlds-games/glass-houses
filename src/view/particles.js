// Particles: one pool of camera-facing quads drawn in two instanced meshes (soft and glowing), each quad a shape from a small
// painted sheet: puffs, sparks, flames, hearts, confetti, scraps of newspaper, bubbles, stars, smoke, rings, hailstones.
// Sparks and hail stretch along the way they fly. Everything is simulated here on the page and only drawn by the GPU.

import * as THREE from 'three';

export const SHAPE = { puff: 0, dot: 1, flame: 2, heart: 3, confetti: 4, news: 5, bubble: 6, star: 7, smoke: 8, ring: 9, shard: 10, leaf: 11, note: 12, drop: 13 };
const GRID = 4;
const CELL = 128;

function atlas() {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = GRID * CELL;
  const g = cv.getContext('2d');
  const at = (i, fn) => {
    g.save();
    g.translate((i % GRID) * CELL + CELL / 2, Math.floor(i / GRID) * CELL + CELL / 2);
    fn(g, CELL / 2);
    g.restore();
  };
  const soft = (g, r, stops) => {
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
    for (const [k, c] of stops) grd.addColorStop(k, c);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
  };
  // A soft puff.
  at(SHAPE.puff, (g, r) => soft(g, r * 0.96, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]));
  // A hot dot: a hard core with a little glow.
  at(SHAPE.dot, (g, r) => soft(g, r * 0.9, [[0, 'rgba(255,255,255,1)'], [0.22, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]));
  // A flame: a teardrop, hot white at the root.
  at(SHAPE.flame, (g, r) => {
    const grd = g.createRadialGradient(0, r * 0.3, 0, 0, r * 0.2, r * 0.9);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.8)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, -r * 0.95);
    g.bezierCurveTo(r * 0.25, -r * 0.4, r * 0.75, r * 0.05, r * 0.55, r * 0.5);
    g.bezierCurveTo(r * 0.4, r * 0.95, -r * 0.4, r * 0.95, -r * 0.55, r * 0.5);
    g.bezierCurveTo(-r * 0.75, r * 0.05, -r * 0.25, -r * 0.4, 0, -r * 0.95);
    g.fill();
  });
  // A heart.
  at(SHAPE.heart, (g, r) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, r * 0.75);
    g.bezierCurveTo(-r * 1.0, r * 0.05, -r * 0.75, -r * 0.85, 0, -r * 0.35);
    g.bezierCurveTo(r * 0.75, -r * 0.85, r * 1.0, r * 0.05, 0, r * 0.75);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.0)';
    g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = 0.35;
    g.beginPath();
    g.ellipse(-r * 0.38, -r * 0.3, r * 0.14, r * 0.08, -0.6, 0, Math.PI * 2);
    g.fill();
  });
  // Confetti: a slip of paper with a fold.
  at(SHAPE.confetti, (g, r) => {
    g.fillStyle = '#fff';
    g.fillRect(-r * 0.32, -r * 0.7, r * 0.64, r * 1.4);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(-r * 0.32, -r * 0.05, r * 0.64, r * 0.75);
  });
  // A scrap of newspaper: torn edges, columns of print, a headline.
  at(SHAPE.news, (g, r) => {
    g.fillStyle = '#F4EFE2';
    g.beginPath();
    const pts = [[-0.8, -0.7], [-0.2, -0.85], [0.3, -0.72], [0.82, -0.8], [0.75, -0.1], [0.86, 0.5], [0.7, 0.82], [0.1, 0.7], [-0.5, 0.86], [-0.84, 0.4], [-0.72, -0.2]];
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * r, y * r) : g.moveTo(x * r, y * r)));
    g.closePath();
    g.fill();
    g.fillStyle = '#2B2622';
    g.fillRect(-r * 0.6, -r * 0.6, r * 1.2, r * 0.22);
    g.fillStyle = 'rgba(43,38,34,0.55)';
    for (let k = 0; k < 6; k++) {
      g.fillRect(-r * 0.6, -r * 0.25 + k * r * 0.16, r * 0.52, r * 0.07);
      g.fillRect(r * 0.04, -r * 0.25 + k * r * 0.16, r * 0.56, r * 0.07);
    }
  });
  // A bubble: a thin bright rim, a highlight.
  at(SHAPE.bubble, (g, r) => {
    soft(g, r * 0.9, [[0, 'rgba(255,255,255,0.05)'], [0.78, 'rgba(255,255,255,0.15)'], [0.9, 'rgba(255,255,255,0.95)'], [1, 'rgba(255,255,255,0)']]);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.ellipse(-r * 0.32, -r * 0.34, r * 0.18, r * 0.1, -0.7, 0, Math.PI * 2);
    g.fill();
  });
  // A four-point star.
  at(SHAPE.star, (g, r) => {
    soft(g, r * 0.4, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -r);
    g.quadraticCurveTo(r * 0.08, -r * 0.08, r, 0);
    g.quadraticCurveTo(r * 0.08, r * 0.08, 0, r);
    g.quadraticCurveTo(-r * 0.08, r * 0.08, -r, 0);
    g.quadraticCurveTo(-r * 0.08, -r * 0.08, 0, -r);
    g.fill();
  });
  // Smoke: a lumpy cloud.
  at(SHAPE.smoke, (g, r) => {
    for (const [x, y, s] of [[0, 0, 0.62], [-0.32, 0.12, 0.45], [0.3, 0.16, 0.48], [0.05, -0.3, 0.42], [-0.18, -0.2, 0.36], [0.28, -0.16, 0.34]]) {
      g.save();
      g.translate(x * r, y * r);
      soft(g, s * r, [[0, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']]);
      g.restore();
    }
  });
  // A ring: a shockwave.
  at(SHAPE.ring, (g, r) => soft(g, r * 0.96, [[0, 'rgba(255,255,255,0)'], [0.72, 'rgba(255,255,255,0)'], [0.86, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]));
  // A sliver of glass.
  at(SHAPE.shard, (g, r) => {
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.moveTo(-r * 0.2, -r * 0.9);
    g.lineTo(r * 0.45, r * 0.4);
    g.lineTo(-r * 0.1, r * 0.85);
    g.closePath();
    g.fill();
  });
  // A leaf.
  at(SHAPE.leaf, (g, r) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -r * 0.85);
    g.quadraticCurveTo(r * 0.7, 0, 0, r * 0.85);
    g.quadraticCurveTo(-r * 0.7, 0, 0, -r * 0.85);
    g.fill();
  });
  // A music note (the gnome choir).
  at(SHAPE.note, (g, r) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(-r * 0.22, r * 0.5, r * 0.3, r * 0.22, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillRect(r * 0.02, -r * 0.8, r * 0.1, r * 1.32);
    g.beginPath();
    g.moveTo(r * 0.02, -r * 0.8);
    g.quadraticCurveTo(r * 0.6, -r * 0.55, r * 0.5, -r * 0.05);
    g.quadraticCurveTo(r * 0.45, -r * 0.4, r * 0.12, -r * 0.45);
    g.closePath();
    g.fill();
  });
  // A drop of water.
  at(SHAPE.drop, (g, r) => {
    const grd = g.createRadialGradient(0, r * 0.25, 0, 0, r * 0.2, r * 0.6);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0.2)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, -r * 0.7);
    g.quadraticCurveTo(r * 0.5, r * 0.1, r * 0.4, r * 0.4);
    g.arc(0, r * 0.4, r * 0.4, 0, Math.PI);
    g.quadraticCurveTo(-r * 0.5, r * 0.1, 0, -r * 0.7);
    g.fill();
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const VERT = `
attribute vec3 center;
attribute vec4 tint;
attribute vec4 prm;
attribute vec3 vel;
varying vec2 vUv;
varying vec4 vTint;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(center, 1.0);
  vec2 c = position.xy * prm.x;
  if (prm.w > 0.0) {
    vec3 vv = (modelViewMatrix * vec4(vel, 0.0)).xyz;
    vec2 d = vv.xy;
    float L = length(d);
    if (L > 1e-4) {
      d /= L;
      c.x *= 1.0 + prm.w * L;
      c = vec2(c.x * d.x - c.y * d.y, c.x * d.y + c.y * d.x);
    }
  } else {
    float cs = cos(prm.y);
    float sn = sin(prm.y);
    c = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
  }
  mvPosition.xy += c;
  gl_Position = projectionMatrix * mvPosition;
  float s = prm.z;
  vec2 cell = vec2(mod(s, ${GRID}.0), ${GRID - 1}.0 - floor(s / ${GRID}.0));
  vUv = (cell + uv) / ${GRID}.0;
  vTint = tint;
  #include <fog_vertex>
}`;

const FRAG = `
uniform sampler2D map;
varying vec2 vUv;
varying vec4 vTint;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(vTint.rgb * t.rgb, vTint.a * t.a);
  if (gl_FragColor.a < 0.003) discard;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function quadMesh(cap, map, additive) {
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const attrs = {
    center: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
    tint: new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4),
    prm: new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4),
    vel: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
  };
  for (const [k, a] of Object.entries(attrs)) {
    a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(k, a);
  }
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: map } }]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    fog: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  mat.uniforms.map.value = map;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = additive ? 7 : 6;
  return { mesh, geo, attrs, mat };
}

/**
 * The pool. emit(o) takes { x, y, z, vx, vy, vz, life, size, grow, color, alpha, shape, add (glow), rot, spin, gravity, drag,
 * stretch, flutter, rise, fadeIn, fadePow, then } and returns nothing; `then` is called with the particle's end position.
 */
export function createParticles(scene, quality = 'medium') {
  const CAP = quality === 'low' ? 600 : 1400;
  const map = atlas();
  const soft = quadMesh(CAP, map, false);
  const glow = quadMesh(CAP, map, true);
  scene.add(soft.mesh, glow.mesh);

  // Structure of arrays: position, velocity, life, look.
  const P = new Float32Array(CAP * 3);
  const V = new Float32Array(CAP * 3);
  const C = new Float32Array(CAP * 3);
  const L = new Float32Array(CAP * 2); // life, max
  const S = new Float32Array(CAP * 6); // size, grow, rot, spin, alpha, stretch
  const F = new Float32Array(CAP * 6); // gravity, drag, flutter, rise, fadeIn, fadePow
  const shape = new Uint8Array(CAP);
  const add = new Uint8Array(CAP);
  const alive = new Uint8Array(CAP);
  const then = new Array(CAP).fill(null);
  let next = 0;
  let live = 0;
  const col = new THREE.Color();

  function emit(o) {
    // Find a free slot near the cursor; when full, the oldest goes.
    let i = next;
    for (let k = 0; k < 16 && alive[i]; k++) i = (i + 1) % CAP;
    next = (i + 1) % CAP;
    if (!alive[i]) live++;
    alive[i] = 1;
    P[i * 3] = o.x;
    P[i * 3 + 1] = o.y;
    P[i * 3 + 2] = o.z;
    V[i * 3] = o.vx ?? 0;
    V[i * 3 + 1] = o.vy ?? 0;
    V[i * 3 + 2] = o.vz ?? 0;
    col.set(o.color ?? '#ffffff');
    if (o.bright) col.multiplyScalar(o.bright);
    C[i * 3] = col.r;
    C[i * 3 + 1] = col.g;
    C[i * 3 + 2] = col.b;
    L[i * 2] = 0;
    L[i * 2 + 1] = o.life ?? 1;
    S[i * 6] = o.size ?? 0.3;
    S[i * 6 + 1] = o.grow ?? 1;
    S[i * 6 + 2] = o.rot ?? Math.random() * 6.28;
    S[i * 6 + 3] = o.spin ?? 0;
    S[i * 6 + 4] = o.alpha ?? 1;
    S[i * 6 + 5] = o.stretch ?? 0;
    F[i * 6] = o.gravity ?? 0;
    F[i * 6 + 1] = o.drag ?? 0;
    F[i * 6 + 2] = o.flutter ?? 0;
    F[i * 6 + 3] = o.rise ?? 0;
    F[i * 6 + 4] = o.fadeIn ?? 0.05;
    F[i * 6 + 5] = o.fadePow ?? 1;
    shape[i] = o.shape ?? SHAPE.puff;
    add[i] = o.add ? 1 : 0;
    then[i] = o.then ?? null;
  }

  // One-frame quads (a hot stone's glow): drawn this frame only.
  const extra = [];
  function glowAt(x, y, z, color, size, alpha = 1, shp = SHAPE.puff, additive = true) {
    if (extra.length < 64) extra.push({ x, y, z, color, size, alpha, shape: shp, add: additive });
  }

  function write(target, k, i) {
    const a = target.attrs;
    a.center.array[k * 3] = P[i * 3];
    a.center.array[k * 3 + 1] = P[i * 3 + 1];
    a.center.array[k * 3 + 2] = P[i * 3 + 2];
    a.vel.array[k * 3] = V[i * 3];
    a.vel.array[k * 3 + 1] = V[i * 3 + 1];
    a.vel.array[k * 3 + 2] = V[i * 3 + 2];
  }

  const X = {
    emit,
    glowAt,
    get count() {
      return live;
    },
    update(dt, t) {
      let ns = 0;
      let ng = 0;
      for (let i = 0; i < CAP; i++) {
        if (!alive[i]) continue;
        const max = L[i * 2 + 1];
        const life = (L[i * 2] += dt);
        if (life >= max) {
          alive[i] = 0;
          live--;
          const fn = then[i];
          then[i] = null;
          if (fn) fn(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
          continue;
        }
        const k = life / max;
        const drag = F[i * 6 + 1];
        if (drag) {
          const f = Math.max(0, 1 - drag * dt);
          V[i * 3] *= f;
          V[i * 3 + 1] *= f;
          V[i * 3 + 2] *= f;
        }
        V[i * 3 + 1] += (F[i * 6 + 3] - F[i * 6]) * dt;
        const fl = F[i * 6 + 2];
        const sway = fl ? Math.sin(t * 0.004 + i * 1.7) * fl : 0;
        P[i * 3] += (V[i * 3] + sway) * dt;
        P[i * 3 + 1] += V[i * 3 + 1] * dt;
        P[i * 3 + 2] += (V[i * 3 + 2] + (fl ? Math.cos(t * 0.0033 + i) * fl : 0)) * dt;
        S[i * 6 + 2] += S[i * 6 + 3] * dt;
        const fadeIn = F[i * 6 + 4];
        const a = S[i * 6 + 4] * Math.min(1, fadeIn > 0 ? k / fadeIn : 1) * Math.pow(1 - k, F[i * 6 + 5]);
        const size = S[i * 6] * (1 + (S[i * 6 + 1] - 1) * k);
        const target = add[i] ? glow : soft;
        const n = add[i] ? ng++ : ns++;
        write(target, n, i);
        const tt = target.attrs.tint.array;
        tt[n * 4] = C[i * 3];
        tt[n * 4 + 1] = C[i * 3 + 1];
        tt[n * 4 + 2] = C[i * 3 + 2];
        tt[n * 4 + 3] = a;
        // Confetti and news flip as they fall: the width breathes.
        const pp = target.attrs.prm.array;
        const sh = shape[i];
        const flip = sh === SHAPE.confetti || sh === SHAPE.news || sh === SHAPE.leaf ? 0.35 + 0.65 * Math.abs(Math.sin(t * 0.009 + i)) : 1;
        pp[n * 4] = size * flip;
        pp[n * 4 + 1] = S[i * 6 + 2];
        pp[n * 4 + 2] = sh;
        pp[n * 4 + 3] = S[i * 6 + 5];
      }
      for (const e of extra) {
        const target = e.add ? glow : soft;
        if ((e.add ? ng : ns) >= CAP) continue;
        const n = e.add ? ng++ : ns++;
        const a = target.attrs;
        a.center.array.set([e.x, e.y, e.z], n * 3);
        a.vel.array.set([0, 0, 0], n * 3);
        col.set(e.color);
        a.tint.array.set([col.r, col.g, col.b, e.alpha], n * 4);
        a.prm.array.set([e.size, 0, e.shape, 0], n * 4);
      }
      extra.length = 0;
      for (const [target, n] of [
        [soft, ns],
        [glow, ng],
      ]) {
        target.geo.instanceCount = n;
        if (!n) continue;
        for (const a of Object.values(target.attrs)) {
          a.clearUpdateRanges();
          a.addUpdateRange(0, n * a.itemSize);
          a.needsUpdate = true;
        }
      }
    },
    clear() {
      alive.fill(0);
      then.fill(null);
      live = 0;
      extra.length = 0;
      soft.geo.instanceCount = 0;
      glow.geo.instanceCount = 0;
    },
    dispose() {
      scene.remove(soft.mesh, glow.mesh);
      for (const t of [soft, glow]) {
        t.geo.dispose();
        t.mat.dispose();
      }
      map?.dispose();
    },
  };
  return X;
}
