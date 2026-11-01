// The rigged people: two low-poly bodies (a man and a woman, with their own walks, runs, strafes, hits and falls) loaded once and
// cloned per neighbour, recoloured into each one's clothes. Also the bone tools the throw is made of: point a bone along a
// direction (shoulder to elbow, elbow to wrist), twist the chest, tilt the head, and pin things (hats, a mug, the stone) to bones.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const FILES = { man: 'models/man.glb', woman: 'models/woman.glb' };
const T = {};
let loading = null;
const waiting = [];

/** Starts loading both bodies (once). Resolves true when they are in, false on failure or after `timeout` ms. */
export function loadRigs(timeout = 8000) {
  if (!loading) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loading = Promise.all(
      Object.entries(FILES).map(async ([k, url]) => {
        T[k] = prepare(await loader.loadAsync(url));
      }),
    )
      .then(() => {
        for (const f of waiting.splice(0)) {
          try {
            f();
          } catch (e) {
            console.warn(e);
          }
        }
        return true;
      })
      .catch((e) => {
        console.warn('people', e);
        return false;
      });
  }
  return Promise.race([loading, new Promise((r) => setTimeout(() => r(false), timeout))]);
}

export const rigsReady = () => !!(T.man && T.woman);

/** Runs fn now if the bodies are in, or as soon as they are. */
export function whenRigs(fn) {
  if (rigsReady()) fn();
  else waiting.push(fn);
}

function prepare(gltf) {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene, true);
  const clips = {};
  for (const c of gltf.animations) clips[c.name] = c;
  const meshes = {};
  scene.traverse((o) => {
    if (o.isSkinnedMesh) meshes[o.name] = o;
  });
  return { scene, clips, height: box.max.y - box.min.y, foot: box.min.y, armOnly: new Map() };
}

// ------------------------------------------------------------------ materials

/**
 * Clothes: each of the source's material names to a role. The man: LightBrown shirt, LightBlue trousers, White soles and
 * Red_Dark shoes. The woman: a White top, Orange trousers, Grey shoes, Hair_Blond hair, Hair_Brown brows, Brown eyes.
 */
const ROLE = {
  man: { LightBrown: 'shirt', LightBlue: 'pants', White: 'sole', Red_Dark: 'shoes', Skin: 'skin', Skin_Darker: 'skinDark', Eyebrows: 'brows', Eye: 'eyes', Hair: 'hair' },
  woman: { White: 'shirt', Orange: 'pants', Grey: 'shoes', Skin: 'skin', Hair_Blond: 'hair', Hair_Brown: 'brows', Brown: 'eyes' },
};

const ROUGH = { shirt: 0.78, pants: 0.85, shoes: 0.55, sole: 0.7, skin: 0.62, skinDark: 0.62, hair: 0.7, brows: 0.8, eyes: 0.25 };

/** A shirt with stripes round it (the Twins' tees): stripes run along the body's height in its rest pose. */
function stripeMaterial(color, stripe, z0, z1, count) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
  const a = new THREE.Color(color);
  const b = new THREE.Color(stripe);
  m.onBeforeCompile = (s) => {
    s.uniforms.uA = { value: a };
    s.uniforms.uB = { value: b };
    s.uniforms.uZ = { value: new THREE.Vector3(z0, z1, count) };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vStripe;\nuniform vec3 uZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStripe = (position.z - uZ.x) / (uZ.y - uZ.x) * uZ.z;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vStripe;\nuniform vec3 uA;\nuniform vec3 uB;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(uA, uB, step(0.5, fract(vStripe)));');
  };
  m.customProgramCacheKey = () => 'stripes';
  return m;
}

// ------------------------------------------------------------------ one body

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();

/**
 * A body of `kind` ('man' | 'woman'), `height` metres tall, facing -Z, feet on y = 0, dressed in `look` (role -> colour; `stripe`
 * for a striped shirt). Returns its holder group, mixer, actions by clip name and bones by name (sanitised: 'UpperArmR').
 */
export function makeBody(kind, height, look, opts = {}) {
  const t = T[kind];
  const model = cloneSkinned(t.scene);
  const holder = new THREE.Group();
  const s = height / t.height;
  model.scale.setScalar(s);
  model.position.y = -t.foot * s;
  model.rotation.y = Math.PI;
  holder.add(model);
  const bones = {};
  const mats = [];
  const meshes = [];
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (!o.isSkinnedMesh) return;
    meshes.push(o);
    o.castShadow = opts.shadow !== false;
    o.receiveShadow = false;
    o.frustumCulled = false;
    const role = ROLE[kind][o.material.name] ?? 'shirt';
    let m;
    if (role === 'shirt' && look.stripe) {
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      m = stripeMaterial(look.shirt, look.stripe, bb.min.z, bb.max.z, 9);
    } else {
      m = new THREE.MeshStandardMaterial({ color: look[role] ?? '#888888', roughness: ROUGH[role] ?? 0.75 });
    }
    m.name = role;
    o.material = m;
    mats.push(m);
    if (opts.armOnly) {
      if (/_Body(_\d+)?$/.test(o.name)) o.geometry = armOnly(t, o);
      else o.visible = false;
    }
  });
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const name in t.clips) {
    const a = mixer.clipAction(t.clips[name]);
    a.enabled = true;
    a.setEffectiveWeight(0);
    a.play();
    actions[name] = a;
  }
  holder.updateMatrixWorld(true);
  return { holder, model, mixer, actions, bones, mats, meshes, kind };
}

/** Right arm and hand only (for the first-person view): the triangles skinned mostly to the right arm's bones. */
function armOnly(t, mesh) {
  if (t.armOnly.has(mesh.name)) return t.armOnly.get(mesh.name);
  const g = mesh.geometry;
  const bones = mesh.skeleton.bones;
  const keep = new Set();
  bones.forEach((b, i) => {
    if (/(Shoulder|UpperArm|LowerArm|Wrist|Index|Middle|Ring|Pinky|Thumb)\d*R$/.test(b.name)) keep.add(i);
  });
  const si = g.attributes.skinIndex;
  const sw = g.attributes.skinWeight;
  const main = new Int32Array(si.count);
  for (let v = 0; v < si.count; v++) {
    let best = 0;
    let bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(v, k);
      if (w > bw) {
        bw = w;
        best = si.getComponent(v, k);
      }
    }
    main[v] = best;
  }
  const idx = g.index;
  const out = [];
  for (let k = 0; k < idx.count; k += 3) {
    const a = idx.getX(k);
    const b = idx.getX(k + 1);
    const c = idx.getX(k + 2);
    if (keep.has(main[a]) && keep.has(main[b]) && keep.has(main[c])) out.push(a, b, c);
  }
  const ng = g.clone();
  ng.setIndex(out);
  t.armOnly.set(mesh.name, ng);
  return ng;
}

// ------------------------------------------------------------------ bone tools

/** The rest pose of a bone (its local rotation) and its axis toward `child` in its own space: what aim() turns. */
export function restOf(bone, child) {
  return { bone, rest: bone.quaternion.clone(), axis: child.position.clone().normalize() };
}

/**
 * Turns a bone so it points along `dir` (a unit vector in `space`'s frame: the figure's root, x right, y up, -z forward), by
 * weight w over its animated pose. Parents must be up to date; updates the bone's world matrix after.
 */
export function aim(r, dir, space, w) {
  if (w <= 0.001) return;
  const bone = r.bone;
  bone.parent.updateWorldMatrix(true, false);
  space.getWorldQuaternion(_q);
  _v.copy(dir).applyQuaternion(_q);
  bone.parent.getWorldQuaternion(_q2);
  _v.applyQuaternion(_q2.invert()).normalize();
  const ra = r.axis.clone().applyQuaternion(r.rest);
  _q.setFromUnitVectors(ra, _v).multiply(r.rest);
  bone.quaternion.slerp(_q, Math.min(1, w));
  bone.updateWorldMatrix(false, false);
}

/**
 * The mixer only writes a bone when its clip value changes, so bones turned by hand on top of a clip must be put back before the
 * next mixer update: save() right after the update, restore() right before the next.
 */
export function cleanPose(bones) {
  const list = bones.filter(Boolean).map((b) => ({ b, q: b.quaternion.clone() }));
  return {
    save() {
      for (const e of list) e.q.copy(e.b.quaternion);
    },
    restore() {
      for (const e of list) e.b.quaternion.copy(e.q);
    },
  };
}

/** Rotates a bone by `angle` about `axis` (unit, in `space`'s frame) on top of its pose. */
export function turn(bone, axis, angle, space) {
  if (Math.abs(angle) < 1e-4) return;
  bone.parent.updateWorldMatrix(true, false);
  space.getWorldQuaternion(_q);
  _v.copy(axis).applyQuaternion(_q);
  bone.parent.getWorldQuaternion(_q2);
  _v.applyQuaternion(_q2.invert()).normalize();
  _q.setFromAxisAngle(_v, angle);
  bone.quaternion.premultiply(_q);
  bone.updateWorldMatrix(false, false);
}

/**
 * Pins `obj` to `bone` so that in the rest pose it sits at `pos` (and turned by `rotY`, `rotX`, `rotZ`) in `space`'s frame, on
 * top of its own position, rotation and scale. Call while the body is in its rest pose (straight after makeBody).
 */
export function pin(obj, bone, space, pos, rotX = 0, rotY = 0, rotZ = 0) {
  space.updateMatrixWorld(true);
  obj.updateMatrix();
  const want = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ')), new THREE.Vector3(1, 1, 1)).multiply(obj.matrix);
  _m.copy(space.matrixWorld).invert().multiply(bone.matrixWorld);
  const local = _m.invert().multiply(want);
  obj.matrixAutoUpdate = false;
  obj.matrix.copy(local);
  bone.add(obj);
  return obj;
}

/** A bone's place in `space`'s frame (the body's root), now. */
export function placeOf(bone, space, out = new THREE.Vector3()) {
  bone.updateWorldMatrix(true, false);
  out.setFromMatrixPosition(bone.matrixWorld);
  return space.worldToLocal(out);
}

/**
 * Where a hand holds things, in `space`'s frame (rest pose): in the palm, a little off it. side 'R' or 'L'. Also returns the
 * hand's direction (wrist to knuckles) and the palm's normal.
 */
export function gripOf(body, side, space, off = 0.045) {
  const B = body.bones;
  const w = placeOf(B[`Wrist${side}`], space);
  const mid = placeOf(B[`Middle1${side}`] ?? B[`Wrist${side}`], space);
  const tip = placeOf(B[`Middle3${side}`] ?? B[`Middle1${side}`] ?? B[`Wrist${side}`], space);
  const ind = placeOf(B[`Index1${side}`] ?? B[`Wrist${side}`], space);
  const pin_ = placeOf(B[`Pinky1${side}`] ?? B[`Wrist${side}`], space);
  const a = mid.clone().sub(w);
  const b = ind.clone().sub(pin_);
  const n = new THREE.Vector3().crossVectors(a, b).normalize();
  if (side === 'R') n.negate();
  // Halfway from the wrist to the middle finger's second joint: the middle of a closed hand.
  const p = w.clone().lerp(tip, 0.55).addScaledVector(n, off);
  return { p, dir: a.normalize(), palm: n };
}

/** The palm's normal of hand `side` now, in `space`'s frame (out of the palm, the side a held thing sits). */
export function palmOf(body, side, space, out = new THREE.Vector3()) {
  const B = body.bones;
  const w = placeOf(B[`Wrist${side}`], space, _p0);
  const mid = placeOf(B[`Middle1${side}`], space, _p1);
  const ind = placeOf(B[`Index1${side}`], space, _p2);
  const pk = placeOf(B[`Pinky1${side}`], space, _p3);
  mid.sub(w);
  ind.sub(pk);
  out.crossVectors(mid, ind).normalize();
  if (side === 'R') out.negate();
  return out;
}
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _p3 = new THREE.Vector3();

/** Curls the fingers of hand `side` toward the palm by `amount` radians a joint (the thumb by `thumb`). */
export function curl(body, side, space, amount, thumb = amount * 0.5) {
  const B = body.bones;
  const n = palmOf(body, side, space, _c0);
  const w = placeOf(B[`Wrist${side}`], space, _c1);
  const m = placeOf(B[`Middle1${side}`], space, _c2).sub(w).normalize();
  const ax = _c3.crossVectors(m, n).normalize();
  for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) {
    for (let k = 1; k <= 3; k++) {
      const bone = B[`${f}${k}${side}`];
      if (bone) turn(bone, ax, amount * (k === 1 ? 0.8 : 1), space);
    }
  }
  for (let k = 1; k <= 2; k++) {
    const bone = B[`Thumb${k}${side}`];
    if (bone) turn(bone, m, thumb * (side === 'R' ? -1 : 1), space);
  }
}
const _c0 = new THREE.Vector3();
const _c1 = new THREE.Vector3();
const _c2 = new THREE.Vector3();
const _c3 = new THREE.Vector3();

/** Rolls `bone` about `axis` (unit, `space`'s frame) so that `normal` (now) turns toward `want`, by weight w. */
export function rollTo(bone, axis, normal, want, space, w = 1) {
  const n = _p0.copy(normal).addScaledVector(axis, -normal.dot(axis));
  const d = _p1.copy(want).addScaledVector(axis, -want.dot(axis));
  if (n.lengthSq() < 1e-6 || d.lengthSq() < 1e-6) return;
  const angle = Math.atan2(axis.dot(_p2.crossVectors(n, d)), n.dot(d));
  turn(bone, axis, angle * w, space);
}

/** The bounding box of one of the body's meshes (by name ending), in `space`'s frame, as posed now. */
export function boxOf(body, ending, space) {
  space.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const inv = new THREE.Matrix4().copy(space.matrixWorld).invert();
  for (const m of body.meshes) {
    if (!new RegExp(`${ending}(_\\d+)?$`).test(m.name)) continue;
    const p = new THREE.Vector3();
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 3) {
      m.getVertexPosition(i, p);
      p.applyMatrix4(m.matrixWorld).applyMatrix4(inv);
      box.expandByPoint(p);
    }
  }
  return box;
}

export function disposeBody(body) {
  body.mixer.stopAllAction();
  body.mixer.uncacheRoot(body.model);
  for (const m of body.mats) m.dispose();
}
