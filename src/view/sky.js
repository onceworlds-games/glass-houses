// The sky: a painted dome over the street. A gradient from the zenith to a glowing horizon, the sun with its halo, soft cumulus lit
// from the sun's side with warm rims, high cirrus streaks, and stars at night. The same material is baked into the reflections
// the glass shows, so every pane carries the evening.

import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }`;

const fragmentShader = /* glsl */ `
  uniform vec3 top;
  uniform vec3 mid;
  uniform vec3 low;
  uniform vec3 glow;
  uniform vec3 sunDir;
  uniform vec3 sunCol;
  uniform vec3 cloudLit;
  uniform vec3 cloudShade;
  uniform float cover;
  uniform float night;
  uniform float time;
  uniform float sunSize;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int k = 0; k < 5; k++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 sd = normalize(sunDir);
    float s = max(dot(d, sd), 0.0);
    // Toward the sun the horizon burns; away from it the sky cools.
    float sunSide = dot(normalize(vec2(d.x, d.z) + 1e-5), normalize(vec2(sd.x, sd.z) + 1e-5)) * 0.5 + 0.5;
    vec3 c = mix(low, mid, smoothstep(-0.02, 0.14, h));
    c = mix(c, top, smoothstep(0.1, 0.62, h));
    c += glow * pow(sunSide, 3.0) * exp(-max(h, 0.0) * 7.0) * (1.0 - night * 0.8);
    // Below the horizon: a hazy band (the world hides it anyway).
    c = mix(c, low * 0.92, smoothstep(0.0, -0.12, h));

    // Clouds on a flattened dome.
    if (h > -0.02) {
      vec2 uv = d.xz / (h + 0.12);
      float t = time * 0.004;
      float base = fbm(uv * 0.55 + vec2(t, t * 0.4));
      float detail = fbm(uv * 1.9 - vec2(t * 1.7, 0.0));
      float dens = smoothstep(1.0 - cover, 1.0 - cover + 0.28, base * 0.78 + detail * 0.32);
      // Lit from the sun's side: the edge toward the sun glows, the belly is in shade.
      float toward = fbm(uv * 0.55 + vec2(t, t * 0.4) + sd.xz * 0.18);
      float lit = clamp((base - toward) * 4.0 + 0.55, 0.0, 1.0);
      vec3 cc = mix(cloudShade, cloudLit, lit);
      cc += sunCol * pow(s, 6.0) * 0.6 * (1.0 - night);
      float fade = smoothstep(-0.02, 0.12, h) * (1.0 - smoothstep(0.65, 0.98, h) * 0.6);
      c = mix(c, cc, dens * fade * 0.92);
      // High cirrus: long thin streaks.
      float ci = fbm(vec2(uv.x * 0.18, uv.y * 1.6) + vec2(t * 2.0, 3.0));
      float cir = smoothstep(0.58, 0.82, ci) * smoothstep(0.08, 0.35, h) * (1.0 - dens);
      c = mix(c, mix(cloudLit, sunCol, 0.35), cir * 0.35 * (1.0 - night * 0.7));
    }

    // The sun: a hot disc and a soft halo.
    float disc = smoothstep(sunSize, sunSize * 0.82, acos(clamp(dot(d, sd), -1.0, 1.0)));
    c += sunCol * (disc * 5.0 + pow(s, 28.0) * 0.45 + pow(s, 5.0) * 0.16) * (1.0 - night * 0.85);

    if (night > 0.5 && h > 0.04) {
      vec3 q = floor(d * 420.0);
      float st = step(0.9968, fract(sin(dot(q, vec3(12.9898, 78.233, 45.164))) * 43758.5453));
      float tw = 0.6 + 0.4 * sin(time * 2.0 + q.x * 3.1);
      c += vec3(st) * tw * smoothstep(0.05, 0.4, h);
    }
    gl_FragColor = vec4(c, 1.0);
  }`;

export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color() },
      mid: { value: new THREE.Color() },
      low: { value: new THREE.Color() },
      glow: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 0.2, -1) },
      sunCol: { value: new THREE.Color() },
      cloudLit: { value: new THREE.Color() },
      cloudShade: { value: new THREE.Color() },
      cover: { value: 0.4 },
      night: { value: 0 },
      time: { value: 0 },
      sunSize: { value: 0.035 },
    },
    vertexShader,
    fragmentShader,
  });
}

/** Paints the sky for a street's light (see palette.js LIGHTS). */
export function paintSky(mat, L, sunDir) {
  const u = mat.uniforms;
  u.top.value.set(L.skyTop);
  u.mid.value.set(L.skyMid);
  u.low.value.set(L.skyLow);
  u.glow.value.set(L.glow ?? L.sun).multiplyScalar(L.glowI ?? 0.5);
  u.sunDir.value.copy(sunDir);
  u.sunCol.value.set(L.sun);
  u.cloudLit.value.set(L.cloudLit ?? '#FFE2C0');
  u.cloudShade.value.set(L.cloudShade ?? '#B98A9A');
  u.cover.value = L.cover ?? 0.4;
  u.night.value = L.night ? 1 : 0;
  u.sunSize.value = L.sunSize ?? 0.035;
}
