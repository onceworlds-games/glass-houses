// The renderer, the camera, the sky, the light and the picture's finish. One per page; the street is swapped inside it.
// Quality: low draws straight to the screen (no shadows, no post); medium adds soft shadows, a bloom on what shines and the grade;
// high adds ambient occlusion and bigger shadow maps.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { LIGHTS } from './palette.js';
import { skyMaterial, paintSky } from './sky.js';

const SHADOW = { low: 0, medium: 1024, high: 2048 };

/** The finish: a warm-cool split grade, a soft vignette, and the moment's punch (a flash, a red edge when you're hurt). */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    lift: { value: new THREE.Color('#2a2050') },
    gain: { value: new THREE.Color('#fff4e6') },
    sat: { value: 1.08 },
    vignette: { value: 0.32 },
    flash: { value: 0 },
    flashCol: { value: new THREE.Color('#ffffff') },
    hurt: { value: 0 },
    aspect: { value: 1.78 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 lift;
    uniform vec3 gain;
    uniform float sat;
    uniform float vignette;
    uniform float flash;
    uniform vec3 flashCol;
    uniform float hurt;
    uniform float aspect;
    varying vec2 vUv;
    void main() {
      vec4 t = texture2D(tDiffuse, vUv);
      vec3 c = t.rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      // Shadows lean toward the lift colour, highlights toward the gain.
      c += lift * 0.07 * (1.0 - smoothstep(0.0, 0.45, l));
      c = mix(c, c * gain, smoothstep(0.3, 0.95, l));
      c = mix(vec3(l), c, sat - hurt * 0.4);
      vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
      float v = smoothstep(0.5, 1.3, length(q) * 1.05);
      c *= 1.0 - v * vignette;
      c = mix(c, vec3(0.72, 0.1, 0.06), hurt * smoothstep(0.38, 1.05, length(q)) * 0.6);
      c = mix(c, flashCol, flash);
      gl_FragColor = vec4(c, t.a);
    }`,
};

export function createStage(canvas, opts = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
  } catch {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: !!opts.preserve });
  }
  let software = false;
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    software = /swiftshader|llvmpipe|softpipe|software/i.test(String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
  } catch {
    /* unknown: assume a graphics chip */
  }
  const webgl2 = renderer.capabilities.isWebGL2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.06, 1400);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), skyMaterial());
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x445522, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);
  scene.fog = new THREE.Fog(0xffffff, 60, 260);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  let cubeRT = null;

  const S = {
    software,
    renderer,
    scene,
    camera,
    sun,
    hemi,
    sky,
    light: LIGHTS.golden,
    quality: opts.quality ?? 'medium',
    sunDir: new THREE.Vector3(),
    width: 1,
    height: 1,
    pixelRatio: 1,
    /** The moment's punch, eased back by the page: 0..1. */
    flash: 0,
    flashColor: new THREE.Color('#ffffff'),
    hurt: 0,
    composer: null,
    envMap: null,
  };

  // ---------------------------------------------------------------- the picture's finish
  let composer = null;
  let bloom = null;
  let gtao = null;
  let grade = null;
  function buildPost() {
    if (composer) {
      composer.renderTarget1?.dispose?.();
      composer.renderTarget2?.dispose?.();
      gtao?.dispose?.();
      bloom?.dispose?.();
    }
    composer = null;
    bloom = null;
    gtao = null;
    grade = null;
    S.composer = null;
    if (S.quality === 'low' || software || opts.noPost) return;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: webgl2 ? 4 : 0 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    if (S.quality === 'high' && webgl2 && !opts.noAO) {
      try {
        gtao = new GTAOPass(scene, camera, 4, 4);
        gtao.output = GTAOPass.OUTPUT.Default;
        gtao.blendIntensity = 0.8;
        gtao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.5, thickness: 1.4, scale: 1.0, samples: 12 });
        gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 10 });
        composer.addPass(gtao);
      } catch {
        gtao = null;
      }
    }
    bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.32, 0.55, 0.92);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    S.composer = composer;
    applyGrade();
    if (S.width > 1) sizePost();
  }
  function sizePost() {
    if (!composer) return;
    composer.setPixelRatio(S.pixelRatio);
    composer.setSize(S.width, S.height);
    if (bloom) bloom.resolution.set(Math.round(S.width * S.pixelRatio * 0.5), Math.round(S.height * S.pixelRatio * 0.5));
    if (grade) grade.uniforms.aspect.value = S.width / S.height;
  }
  function applyGrade() {
    if (!grade) return;
    const L = S.light;
    grade.uniforms.lift.value.set(L.lift ?? '#2a2050');
    grade.uniforms.gain.value.set(L.gain ?? '#fff1e0');
    grade.uniforms.sat.value = L.sat ?? 1.08;
    grade.uniforms.vignette.value = L.vignette ?? 0.3;
    if (bloom) {
      bloom.strength = L.bloom ?? 0.32;
      bloom.threshold = L.bloomAt ?? 0.92;
    }
  }

  /** Points the sun and paints the sky for a street's light. */
  S.setLight = function setLight(name, radius = 22) {
    const L = LIGHTS[name] ?? LIGHTS.golden;
    S.light = L;
    const el = (L.sunEl * Math.PI) / 180;
    const az = (L.sunAz * Math.PI) / 180;
    S.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    sun.color.set(L.sun);
    sun.intensity = L.sunI;
    // The shadow light stays at least 16° up, so the long evening shadows stay inside the map.
    const sel = Math.max(el, (16 * Math.PI) / 180);
    sun.position.set(Math.cos(sel) * Math.sin(az), Math.sin(sel), Math.cos(sel) * Math.cos(az)).multiplyScalar(110);
    sun.target.position.set(0, 0, 0);
    const span = radius + 17;
    const cam = sun.shadow.camera;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.near = 30;
    cam.far = 220;
    cam.updateProjectionMatrix();
    hemi.color.set(L.hemiSky);
    hemi.groundColor.set(L.hemiGround);
    hemi.intensity = L.hemiI;
    paintSky(sky.material, L, S.sunDir);
    scene.fog.color.set(L.fog);
    scene.fog.near = radius * (L.fogNear ?? 2.4);
    scene.fog.far = radius * (L.fogFar ?? 11);
    renderer.toneMappingExposure = L.exposure ?? 1.0;
    applyGrade();
    bakeSky();
  };

  /** The sky alone as the light that fills shadows and the first reflections (before the street is captured). */
  function bakeSky() {
    const envScene = new THREE.Scene();
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), sky.material);
    envScene.add(s2);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(90, 90, 14, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(S.light.sand).multiplyScalar(0.5), side: THREE.BackSide }),
    );
    band.position.y = -4;
    envScene.add(band);
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(envScene, 0.02);
    scene.environment = envRT.texture;
    S.envMap = envRT.texture;
    s2.geometry.dispose();
    band.geometry.dispose();
    band.material.dispose();
  }

  /**
   * Bakes the street itself into the reflections: a cube from the middle of the green, a few metres up, with `hide` (the glass,
   * the people) hidden. Every pane then mirrors the houses across the street, the palms and the sky.
   */
  S.captureStreet = function captureStreet(hide = [], y = 3.2) {
    try {
      if (!cubeRT) cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
      const cubeCam = new THREE.CubeCamera(1, 1200, cubeRT);
      cubeCam.position.set(0, y, 0);
      scene.add(cubeCam);
      const was = hide.map((o) => o.visible);
      for (const o of hide) o.visible = false;
      const fog = scene.fog;
      scene.fog = null;
      sky.position.set(0, y, 0);
      const tm = renderer.toneMapping;
      cubeCam.update(renderer, scene);
      renderer.toneMapping = tm;
      scene.fog = fog;
      scene.remove(cubeCam);
      hide.forEach((o, i) => (o.visible = was[i]));
      const next = pmrem.fromCubemap(cubeRT.texture);
      if (envRT) envRT.dispose();
      envRT = next;
      scene.environment = next.texture;
      S.envMap = next.texture;
      return next.texture;
    } catch (err) {
      console.warn('[glass-houses] street capture', err);
      return S.envMap;
    }
  };

  S.setQuality = function setQuality(q) {
    S.quality = q;
    const size = software ? 0 : SHADOW[q] ?? 1024;
    renderer.shadowMap.enabled = size > 0;
    sun.castShadow = size > 0;
    if (size > 0 && sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
    }
    scene.traverse((o) => {
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) m.needsUpdate = true;
      }
    });
    buildPost();
  };

  S.resize = function resize(w, h, pixelRatio) {
    S.width = Math.max(1, w);
    S.height = Math.max(1, h);
    S.pixelRatio = pixelRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(S.width, S.height, false);
    camera.aspect = S.width / S.height;
    S.setFov(S.fovNow ?? 66);
    sizePost();
  };

  /** The vertical field of view (66° is the game's view), widened in portrait so the street still fits sideways. */
  S.fovNow = 66;
  S.setFov = function setFov(vfov) {
    S.fovNow = vfov;
    const hfov = 78 * (vfov / 66);
    const vfovForH = (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
    const f = camera.aspect < 1.2 ? Math.max(vfov, vfovForH) : vfov;
    const next = Math.min(105, Math.max(14, f));
    if (Math.abs(camera.fov - next) > 1e-3) {
      camera.fov = next;
      camera.updateProjectionMatrix();
    }
  };

  S.render = function render(time = 0) {
    sky.position.copy(camera.position);
    sky.material.uniforms.time.value = time;
    if (composer) {
      if (grade) {
        grade.uniforms.flash.value = S.flash;
        grade.uniforms.flashCol.value.copy(S.flashColor);
        grade.uniforms.hurt.value = S.hurt;
      }
      composer.render();
    } else renderer.render(scene, camera);
  };

  S.setQuality(S.quality);
  return S;
}
