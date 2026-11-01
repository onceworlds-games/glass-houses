// The renderer, the camera, the sky and the light. One per page; the street is swapped inside it.

import * as THREE from 'three';
import { LIGHTS } from './palette.js';

const SHADOW = { low: 0, medium: 1024, high: 2048 };

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color() },
      mid: { value: new THREE.Color() },
      low: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 0.2, -1) },
      sunCol: { value: new THREE.Color() },
      night: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(low, mid, smoothstep(-0.02, 0.18, h));
        c = mix(c, top, smoothstep(0.15, 0.75, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12) * (1.0 - night * 0.7);
        if (night > 0.5 && h > 0.05) {
          vec3 q = floor(d * 380.0);
          float st = step(0.9965, hash(q));
          c += vec3(st) * 0.9 * smoothstep(0.05, 0.4, h);
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.08, 900);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMaterial());
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x445522, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);
  scene.fog = new THREE.Fog(0xffffff, 60, 260);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

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
  };

  /** Points the sun and paints the sky for a street's light; bakes the sky into the reflections glass uses. */
  S.setLight = function setLight(name, radius = 22) {
    const L = LIGHTS[name] ?? LIGHTS.golden;
    S.light = L;
    const el = (L.sunEl * Math.PI) / 180;
    const az = (L.sunAz * Math.PI) / 180;
    S.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    sun.color.set(L.sun);
    sun.intensity = L.sunI;
    sun.position.copy(S.sunDir).multiplyScalar(90);
    sun.target.position.set(0, 0, 0);
    const span = radius + 18;
    const cam = sun.shadow.camera;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.near = 10;
    cam.far = 220;
    cam.updateProjectionMatrix();
    hemi.color.set(L.hemiSky);
    hemi.groundColor.set(L.hemiGround);
    hemi.intensity = L.hemiI;
    const u = sky.material.uniforms;
    u.top.value.set(L.skyTop);
    u.mid.value.set(L.skyMid);
    u.low.value.set(L.skyLow);
    u.sunDir.value.copy(S.sunDir);
    u.sunCol.value.set(L.sun);
    u.night.value = L.night ? 1 : 0;
    // The far ground fades into the sky at the horizon.
    scene.fog.color.set(L.fog).lerp(new THREE.Color(L.skyLow), 0.65);
    scene.fog.near = radius * 2.2;
    scene.fog.far = radius * 9;
    renderer.toneMappingExposure = L.night ? 1.25 : L.snow ? 0.82 : 1.0;
    bakeEnv();
  };

  function bakeEnv() {
    // The sky alone, as the reflections in the glass: whole panes flash gold when they face the sun.
    const envScene = new THREE.Scene();
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), sky.material);
    envScene.add(s2);
    // A warm band of the street's ground and the houses opposite, so low reflections aren't empty sky.
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(90, 90, 14, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(S.light.sand).multiplyScalar(0.55), side: THREE.BackSide }),
    );
    band.position.y = -4;
    envScene.add(band);
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(envScene, 0.02);
    scene.environment = envRT.texture;
    s2.geometry.dispose();
    band.geometry.dispose();
    band.material.dispose();
  }

  S.setQuality = function setQuality(q) {
    S.quality = q;
    const size = SHADOW[q] ?? 1024;
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
  };

  S.resize = function resize(w, h, pixelRatio) {
    S.width = Math.max(1, w);
    S.height = Math.max(1, h);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(S.width, S.height, false);
    camera.aspect = S.width / S.height;
    // Portrait keeps the sideways view wide enough to see the street.
    const hfov = 78;
    const vfovForH = (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
    camera.fov = Math.min(100, Math.max(62, camera.aspect < 1.2 ? vfovForH : 66));
    camera.updateProjectionMatrix();
  };

  S.render = function render() {
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
  };

  S.setQuality(S.quality);
  return S;
}
