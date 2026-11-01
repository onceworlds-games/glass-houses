// The Locker's pictures: every stone you can throw and every lawn you can keep, rendered once (lit and turned to show them off)
// by a small renderer of their own that goes away when they're done.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { throwableMesh, THROWABLE_IDS } from './throwables.js';
import { createLawns, loadDog } from './lawn.js';
import { whenRigs } from './rig.js';

const cache = new Map();
let pending = null;

// Where each lawn's piece stands (x, y, z in a plain frame: u, height, d) and how much round it to show.
export const FOCUS = {
  flamingos: [-7.3, 0.7, 4.7, 1.5],
  grill: [7.0, 0.6, 4.4, 1.15],
  loungers: [-6.7, 0.6, 4.1, 1.7],
  tiki: [-7.6, 1.6, 3.3, 1.0],
  dog: [7.2, 0.45, 4.3, 1.6],
  choir: [-6.4, 0.8, 5.5, 1.9],
  car: [-7.4, 0.7, 5.0, 2.4],
  fountain: [7.0, 1.0, 5.0, 1.5],
  statue: [-7.0, 1.5, 4.6, 1.5],
};
const tick = () => new Promise((r) => setTimeout(r, 0));

function frame(cam, s, dir, fill = 1.1) {
  const dist = (s.radius * fill) / Math.sin(((cam.fov / 2) * Math.PI) / 180);
  cam.position.copy(s.center).addScaledVector(dir, dist);
  cam.near = dist / 50;
  cam.far = dist * 4;
  cam.updateProjectionMatrix();
  cam.lookAt(s.center);
}

/** Renders the pictures (once); resolves with the cache. */
export function makeThumbs(size = 144) {
  if (pending) return pending;
  pending = (async () => {
    await new Promise((r) => whenRigs(r));
    await loadDog();
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(size, size, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.setClearColor(0x000000, 0);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      const scene = new THREE.Scene();
      scene.environment = env;
      scene.add(new THREE.HemisphereLight('#FFF4E0', '#6A5A48', 1.3));
      const sun = new THREE.DirectionalLight('#FFF0DC', 2.6);
      sun.position.set(3, 5, 4);
      scene.add(sun);
      const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
      const shot = () => {
        renderer.render(scene, cam);
        return canvas.toDataURL('image/png');
      };

      // Stones: filling the tile, turned a little.
      const dir = new THREE.Vector3(0.35, 0.45, 1).normalize();
      for (const id of THROWABLE_IDS) {
        const m = throwableMesh(id);
        m.rotation.set(0.35, 0.7, 0.15);
        scene.add(m);
        m.updateMatrixWorld(true);
        frame(cam, new THREE.Box3().setFromObject(m, true).getBoundingSphere(new THREE.Sphere()), dir, 0.95);
        cache.set(`stone:${id}`, shot());
        scene.remove(m);
        await tick();
      }

      // Lawns: each piece on a patch of grass, from a little above.
      const house = { i: 0, cx: 0, cz: 0, elev: 0, fx: 0, fz: 1, rx: 1, rz: 0 };
      const root = new THREE.Group();
      scene.add(root);
      const grass = new THREE.Mesh(new THREE.CircleGeometry(30, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7FA444', roughness: 0.95 }));
      grass.position.y = -0.01;
      const fx = { parts: { emit() {}, glowAt() {} } };
      const lawns = createLawns({ houses: [house] }, root, fx, false);
      const ldir = new THREE.Vector3(0.55, 0.7, 1).normalize();
      for (const [id, [u, y, d, r]] of Object.entries(FOCUS)) {
        lawns.set(0, id);
        await tick();
        if (id === 'dog') await loadDog();
        await tick();
        for (let k = 0; k < 4; k++) lawns.update(0.05, k * 50);
        scene.add(grass);
        grass.position.set(u, -0.01, d);
        grass.scale.setScalar(Math.max(0.06, r / 30) * 1.6);
        frame(cam, new THREE.Sphere(new THREE.Vector3(u, y, d), r), ldir, 1.0);
        cache.set(`lawn:${id}`, shot());
        scene.remove(grass);
      }
      lawns.set(0, 'bare');
      lawns.dispose();
      grass.geometry.dispose();
      grass.material.dispose();
      env.dispose();
      pmrem.dispose();
    } catch (err) {
      console.warn('[glass-houses] thumbs', err);
    } finally {
      renderer.dispose();
      renderer.forceContextLoss();
    }
    return cache;
  })();
  return pending;
}

/** A picture, if it's made: 'stone:geode', 'lawn:dog'. */
export const thumb = (key) => cache.get(key) ?? null;
