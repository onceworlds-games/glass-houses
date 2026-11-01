// Materials that move: plants that sway in the street's wind, pool water that ripples and throws light. One set of shared uniforms
// drives them all (street.update writes the time and the wind).

import * as THREE from 'three';

export const SHARED = {
  time: { value: 0 },
  /** x, z: the wind's direction (unit); w: its strength 0..1. */
  wind: { value: new THREE.Vector4(1, 0, 0, 0.3) },
};

/** A standard material whose vertices with a `sway` weight bend with the wind (palms, fronds, leaves, grass). */
export function swayMaterial(params) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED.time;
    shader.uniforms.uWind = SHARED.wind;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float sway;
        uniform float uTime;
        uniform vec4 uWind;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          // World space already (the street is merged in place). A lean downwind, a slow rock, and a flutter at the tips.
          float ph = uTime * 1.25 + transformed.x * 0.21 + transformed.z * 0.17;
          float s = sway;
          float gust = 0.55 + 0.45 * sin(uTime * 0.37 + transformed.x * 0.05);
          vec2 lean = uWind.xy * uWind.w * 0.55 * gust;
          vec2 rock = vec2(sin(ph), cos(ph * 0.83)) * (0.07 + 0.16 * uWind.w);
          float flutter = sin(uTime * 7.0 + transformed.y * 2.3 + transformed.x * 1.7) * 0.05 * smoothstep(0.6, 1.0, s) * (0.4 + uWind.w);
          transformed.xz += (lean + rock) * s * s;
          transformed.y += flutter - dot(lean, lean) * 0.25 * s * s;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'sway';
  return m;
}

/** Pool water: deep turquoise with moving ripples (in the normal) and a bright caustic net, reflecting the sky. */
export function waterMaterial(color = '#29B6C8') {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.06, metalness: 0.0, envMapIntensity: 1.4 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorld;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        varying vec3 vWorld;
        float wv(vec2 p, vec2 d, float f, float s) { return sin(dot(p, d) * f + uTime * s); }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec2 p = vWorld.xz;
          float dx = wv(p, vec2(0.8, 0.6), 3.1, 1.7) * 0.6 + wv(p, vec2(-0.5, 0.9), 5.3, 2.3) * 0.3 + wv(p, vec2(0.2, -1.0), 8.9, 3.1) * 0.15;
          float dz = wv(p, vec2(0.6, -0.8), 3.7, 1.9) * 0.6 + wv(p, vec2(0.9, 0.4), 6.1, 2.6) * 0.3 + wv(p, vec2(-1.0, 0.1), 9.7, 2.9) * 0.15;
          vec3 bump = normalize(vec3(dx * 0.09, 1.0, dz * 0.09));
          normal = normalize((viewMatrix * vec4(bump, 0.0)).xyz);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec2 p = vWorld.xz * 1.6;
          float c1 = abs(sin(p.x * 2.1 + sin(p.y * 1.7 + uTime * 1.3) + uTime * 0.7));
          float c2 = abs(sin(p.y * 2.3 + sin(p.x * 1.9 - uTime * 1.1) - uTime * 0.6));
          float caustic = pow(1.0 - min(c1, c2), 6.0);
          totalEmissiveRadiance += vec3(0.55, 0.95, 1.0) * caustic * 0.35;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'water';
  return m;
}

/** Each house's lights, 0 (out) to 1 (on): interiors read their house's from their sway slot. */
export const LIT = { value: [1, 1, 1, 1, 1, 1] };

/**
 * Inside a house: lit by its lamps more than by the sky, so it glows a little in its own colours (warm `glow`, `self` strong),
 * and goes dim when the house is out. Pieces carry their house's number in the sway attribute.
 */
export function interiorMaterial({ map = null, glow = '#FFC985', self = 0.18, roughness = 0.82, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness, emissive: new THREE.Color(glow), emissiveIntensity: self, side });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uLit = LIT;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float sway;\nuniform float uLit[6];\nvarying float vLit;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvLit = uLit[int(clamp(sway + 0.5, 0.0, 5.0))];`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vLit;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= diffuseColor.rgb * vLit;\ndiffuseColor.rgb *= mix(0.35, 1.0, vLit);`);
  };
  m.customProgramCacheKey = () => `interior:${!!map}`;
  return m;
}

/** Bulbs and screens: glow in their vertex colour (car lamps, neon); `lit` ties them to a house's lights. */
export function glowMaterial(intensity = 2.5, lit = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: new THREE.Color('#ffffff'), emissiveIntensity: intensity, color: '#000000' });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uLit = LIT;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float sway;\nuniform float uLit[6];\nvarying float vLit;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvLit = ${lit ? 'uLit[int(clamp(sway + 0.5, 0.0, 5.0))]' : '1.0'};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vLit;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb * vLit;`);
  };
  m.customProgramCacheKey = () => `glow:${lit}`;
  return m;
}
