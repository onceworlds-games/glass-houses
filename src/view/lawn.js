// What a player keeps on their lawn (career.js LOOKS.lawn): pink flamingos, a barbecue going, sun loungers under an umbrella,
// tiki torches, the dog (a real one: it wanders, eats, jumps when the glass goes and lies down when the house is out), a gnome
// choir that sings, a classic car parked on the grass, a fountain, and at the top a golden statue of a neighbour mid-throw.
// Each house gets at most one, built when first worn, at the edges of its lawn so it never stands in the way.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { createBuilder, houseFrame } from './build.js';
import { at, car, lounger, umbrella, propBox, propCyl } from './props.js';
import { heldMesh } from './people.js';
import { makeBody, whenRigs } from './rig.js';
import { SHAPE } from './particles.js';
import { OWNERS } from './palette.js';
import { createRng } from '../core/rng.js';

const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Puts a loose object at (u, y, d) of frame M facing frame-heading h (0 = toward the street's middle). House frames are mirrored,
 * so a turn in the frame is the other way round in the world. negZ: the object's front is its -Z.
 */
function placeIn(obj, M, u, y, d, h = 0, negZ = false) {
  const fy = Math.atan2(M.elements[8], M.elements[10]);
  obj.position.set(u, y, d).applyMatrix4(M);
  obj.rotation.set(0, fy - h + (negZ ? Math.PI : 0), 0);
  return obj;
}

function materials() {
  return {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
    smooth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.04 }),
    chrome: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.16, metalness: 1.0, envMapIntensity: 1.3 }),
    car: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
    carLight: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.1 }),
    dark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.3, envMapIntensity: 1.4 }),
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    water: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.75, envMapIntensity: 1.8 }),
    gold: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 1, envMapIntensity: 1.6 }),
  };
}

/** A plastic flamingo: a fat pink body, an S-neck, a black-tipped beak, one leg tucked up. */
function flamingo(B, M, pink) {
  const body = new THREE.SphereGeometry(0.22, 14, 10);
  body.scale(1.55, 0.85, 0.85);
  body.rotateZ(0.12);
  body.translate(0, 0.86, 0);
  B.add('smooth', body, M, pink);
  const tail = new THREE.ConeGeometry(0.1, 0.28, 8);
  tail.rotateZ(Math.PI / 2 + 0.3);
  tail.translate(-0.4, 0.92, 0);
  B.add('smooth', tail, M, pink);
  const wing = new THREE.SphereGeometry(0.17, 10, 8);
  wing.scale(1.5, 0.55, 0.3);
  wing.translate(-0.04, 0.9, 0.13);
  B.add('smooth', wing, M, new THREE.Color(pink).offsetHSL(0, 0, -0.08).getStyle());
  const neck = new THREE.TubeGeometry(new THREE.CubicBezierCurve3(new THREE.Vector3(0.26, 0.92, 0), new THREE.Vector3(0.52, 1.18, 0), new THREE.Vector3(0.02, 1.3, 0), new THREE.Vector3(0.24, 1.55, 0)), 16, 0.04, 7, false);
  B.add('smooth', neck, M, pink);
  const head = new THREE.SphereGeometry(0.075, 10, 8);
  head.scale(1.2, 1, 1);
  head.translate(0.27, 1.58, 0);
  B.add('smooth', head, M, pink);
  const beak = new THREE.ConeGeometry(0.035, 0.16, 8);
  beak.rotateZ(-2.3);
  beak.translate(0.38, 1.52, 0);
  B.add('smooth', beak, M, '#F7F2E8');
  const tip = new THREE.ConeGeometry(0.022, 0.07, 6);
  tip.rotateZ(-2.3);
  tip.translate(0.43, 1.47, 0);
  B.add('smooth', tip, M, '#1E1A22');
  for (const z of [-0.07, 0.07]) {
    const eye = new THREE.SphereGeometry(0.014, 6, 4);
    eye.translate(0.31, 1.61, z * 0.6);
    B.add('smooth', eye, M, '#1E1A22');
  }
  // One leg straight into the grass, one folded.
  propCyl(B, 'chrome', M, 0.01, 0.01, 0.72, 0.02, 0.36, -0.04, '#2A2238', 4);
  propCyl(B, 'chrome', M, 0.01, 0.01, 0.36, 0.05, 0.56, 0.05, '#2A2238', 4, 0, 0.9);
}

/** A kettle barbecue with its lid tipped open, coals glowing, a striped cooler and a stack of plates. Returns the coals (local). */
function barbecue(B, M) {
  const bowl = new THREE.SphereGeometry(0.34, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  bowl.translate(0, 0.86, 0);
  B.add('smooth', bowl, M, '#1E1A22');
  const coals = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 16);
  coals.translate(0, 0.8, 0);
  B.add('glow', coals, M, '#FF6A1A');
  const grate = new THREE.TorusGeometry(0.31, 0.012, 4, 24);
  grate.rotateX(Math.PI / 2);
  grate.translate(0, 0.86, 0);
  B.add('chrome', grate, M, '#C8CED8');
  for (let k = -3; k <= 3; k++) propBox(B, 'chrome', M, 0.012, 0.012, 0.58 * Math.sqrt(1 - (k / 3.6) ** 2), k * 0.085, 0.865, 0, '#C8CED8');
  // Sausages on the grate.
  for (let k = 0; k < 4; k++) {
    const s = new THREE.CapsuleGeometry(0.026, 0.16, 4, 8);
    s.rotateZ(Math.PI / 2);
    s.rotateY(k * 0.2 - 0.3);
    s.translate(-0.12 + k * 0.08, 0.89, -0.05 + k * 0.03);
    B.add('smooth', s, M, '#8A3A22');
  }
  const lid = new THREE.SphereGeometry(0.34, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  lid.rotateX(-1.25);
  lid.translate(0, 1.05, -0.42);
  B.add('smooth', lid, M, '#C8553D');
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    propCyl(B, 'chrome', M, 0.016, 0.016, 0.72, Math.cos(a) * 0.2, 0.36, Math.sin(a) * 0.2, '#D8DEE4', 5, Math.sin(a) * 0.25, -Math.cos(a) * 0.25);
  }
  // A cooler.
  propBox(B, 'smooth', M, 0.6, 0.36, 0.38, 0.75, 0.18, 0.2, '#E8645A');
  propBox(B, 'smooth', M, 0.62, 0.06, 0.4, 0.75, 0.39, 0.2, '#F7F2E8');
  propBox(B, 'smooth', M, 0.22, 0.04, 0.05, 0.75, 0.44, 0.2, '#F7F2E8');
  // A folding table with plates.
  propBox(B, 'smooth', M, 0.9, 0.04, 0.6, -0.85, 0.72, 0.1, '#F7F2E8');
  for (const [x, z] of [[-1.2, -0.1], [-0.5, -0.1], [-1.2, 0.3], [-0.5, 0.3]]) propCyl(B, 'chrome', M, 0.015, 0.015, 0.7, x, 0.35, z, '#C8CED8', 4);
  for (let k = 0; k < 5; k++) propCyl(B, 'smooth', M, 0.12, 0.1, 0.012, -0.9, 0.75 + k * 0.014, 0.05, '#FFFFFF', 14);
  propCyl(B, 'smooth', M, 0.05, 0.05, 0.22, -0.55, 0.85, 0.2, '#C8282E', 10);
  propCyl(B, 'smooth', M, 0.045, 0.045, 0.2, -0.65, 0.84, 0.28, '#E5B83B', 10);
  return new THREE.Vector3(0, 0.9, 0);
}

/** A tiki torch: bamboo pole, a woven cup. Returns where the flame sits (local). */
function tiki(B, M) {
  propCyl(B, 'solid', M, 0.04, 0.05, 1.9, 0, 0.95, 0, '#C9A86A', 7);
  for (let k = 1; k < 5; k++) propCyl(B, 'solid', M, 0.052, 0.052, 0.035, 0, k * 0.4, 0, '#A88A50', 7);
  const cup = new THREE.CylinderGeometry(0.13, 0.07, 0.26, 10);
  cup.translate(0, 1.98, 0);
  B.add('solid', cup, M, '#7A5A30');
  const band = new THREE.TorusGeometry(0.115, 0.018, 4, 12);
  band.rotateX(Math.PI / 2);
  band.translate(0, 2.0, 0);
  B.add('solid', band, M, '#4E3820');
  // The flame's hot core (the flicker over it is particles).
  const core = new THREE.SphereGeometry(0.1, 10, 8);
  core.scale(1, 2.1, 1);
  core.translate(0, 2.22, 0);
  B.add('glow', core, M, '#FFB040');
  const tip = new THREE.ConeGeometry(0.06, 0.26, 8);
  tip.translate(0, 2.42, 0);
  B.add('glow', tip, M, '#FFE08A');
  return new THREE.Vector3(0, 2.18, 0);
}

/** A tiered fountain: a basin, a column, a bowl, a finial. Returns the water's parts (local) for the animation. */
function fountain(B, M, snow) {
  const rim = new THREE.TorusGeometry(1.15, 0.12, 8, 32);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, 0.42, 0);
  B.add('stone', rim, M, '#E8E0D2');
  propCyl(B, 'stone', M, 1.15, 1.22, 0.42, 0, 0.21, 0, '#D9CFBE', 32);
  const pool = new THREE.CircleGeometry(1.08, 32);
  pool.rotateX(-Math.PI / 2);
  pool.translate(0, 0.38, 0);
  B.add('water', pool, M, snow ? '#D6E4EE' : '#5FB0C8');
  propCyl(B, 'stone', M, 0.14, 0.2, 1.1, 0, 0.9, 0, '#E8E0D2', 12);
  const bowl = new THREE.SphereGeometry(0.55, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  bowl.scale(1, 0.45, 1);
  bowl.translate(0, 1.5, 0);
  B.add('stone', bowl, M, '#E8E0D2');
  const top = new THREE.CircleGeometry(0.5, 20);
  top.rotateX(-Math.PI / 2);
  top.translate(0, 1.48, 0);
  B.add('water', top, M, snow ? '#D6E4EE' : '#6FC0D8');
  propCyl(B, 'stone', M, 0.06, 0.1, 0.4, 0, 1.7, 0, '#E8E0D2', 10);
  const ball = new THREE.SphereGeometry(0.1, 10, 8);
  ball.translate(0, 1.95, 0);
  B.add('stone', ball, M, '#E8E0D2');
  return { spout: new THREE.Vector3(0, 2.02, 0), lip: 0.55, lipY: 1.5, poolY: 0.4 };
}

/** The gnome choir: five gnomes on a little stage, each in its own hat, a song sheet on a stand. */
function choir(group, M, owner) {
  const hats = ['#D93A2F', '#3563B8', '#E5B83B', '#2BB7B3', owner];
  const gnomes = [];
  for (let k = 0; k < 5; k++) {
    const g = heldMesh('gnome');
    g.scale.setScalar(2.6);
    g.traverse((o) => {
      if (o.isMesh && o.geometry.attributes.color) {
        // Recolour the hat (the red vertices) to this gnome's colour.
        const col = o.geometry.attributes.color;
        const c = new THREE.Color();
        const want = new THREE.Color(hats[k]);
        o.geometry = o.geometry.clone();
        const cc = o.geometry.attributes.color;
        for (let i = 0; i < col.count; i++) {
          c.fromBufferAttribute(col, i);
          if (c.r > 0.6 && c.g < 0.2 && c.b < 0.15) cc.setXYZ(i, want.r, want.g, want.b);
        }
        cc.needsUpdate = true;
      }
    });
    const a = (k - 2) * 0.32;
    const holder = new THREE.Group();
    placeIn(holder, M, Math.sin(a) * 1.4, 0.91 + (k === 2 ? 0.1 : 0), -Math.cos(a) * 1.4 + 1.4, -a, true);
    holder.add(g);
    group.add(holder);
    gnomes.push({ holder, phase: k * 0.7, base: holder.position.y, roll: holder.rotation.y, at: holder.position.clone() });
  }
  return gnomes;
}

/** The golden statue: a neighbour mid-throw on a marble plinth, in gold. */
function statue(group, M, seat) {
  const B = createBuilder();
  propBox(B, 'stone', M, 1.2, 1.1, 1.2, 0, 0.55, 0, '#EDE6DC');
  propBox(B, 'stone', M, 1.4, 0.14, 1.4, 0, 1.17, 0, '#F4EEE6');
  propBox(B, 'stone', M, 1.4, 0.14, 1.4, 0, 0.07, 0, '#F4EEE6');
  propBox(B, 'gold', M, 0.7, 0.18, 0.02, 0, 0.62, 0.61, '#E8B84A');
  const base = B.build({ stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }), gold: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 1 }) });
  group.add(base);
  const holder = new THREE.Group();
  group.add(holder);
  whenRigs(() => {
    const gold = new THREE.MeshStandardMaterial({ color: '#E8B84A', roughness: 0.24, metalness: 1, envMapIntensity: 1.8 });
    const body = makeBody(seat % 2 ? 'woman' : 'man', 1.85, {}, { shadow: true });
    for (const mesh of body.meshes) mesh.material = gold;
    // Frozen at the release of a throw.
    const clip = body.actions.Punch_Right ?? body.actions.Interact ?? body.actions.Wave;
    for (const a of Object.values(body.actions)) a.setEffectiveWeight(0);
    if (clip) {
      clip.setEffectiveWeight(1);
      body.mixer.setTime(clip.getClip().duration * 0.42);
    } else body.mixer.setTime(0);
    // On the plinth, facing the middle of the street.
    placeIn(body.holder, M, 0, 1.24, 0, 0, true);
    holder.add(body.holder);
  });
}

// ------------------------------------------------------------------ the dog

let dogTemplate = null;
let dogLoading = null;
export function loadDog() {
  if (!dogLoading) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    dogLoading = loader
      .loadAsync('models/dog.glb')
      .then((g) => {
        g.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(g.scene, true);
        const clips = {};
        for (const c of g.animations) clips[c.name] = c;
        dogTemplate = { scene: g.scene, clips, height: box.max.y - box.min.y, foot: box.min.y, length: box.max.z - box.min.z };
        return dogTemplate;
      })
      .catch((e) => {
        console.warn('dog', e);
        return null;
      });
  }
  return dogLoading;
}

/** A dog for a lawn: wanders its corner, eats from its bowl, jumps when the glass goes, lies down when the house is out. */
function makeDog(group, M, owner) {
  const D = { ready: false, state: 'idle', until: 0, x: 0, z: 0, tx: 0, tz: 0, heading: 0, mood: 'fine', current: null };
  // Its corner of the lawn (frame coords): a box to wander in, a bowl and a kennel.
  const area = { u0: 5.2, u1: 8.4, d0: 3.4, d1: 6.6 };
  const B = createBuilder();
  // The kennel in the owner's colour.
  const K = at(M, 8.6, 0, 3.3, -0.5);
  propBox(B, 'solid', K, 1.0, 0.7, 1.1, 0, 0.35, 0, owner);
  const roof = new THREE.CylinderGeometry(0.01, 0.82, 0.5, 4, 1);
  roof.rotateY(Math.PI / 4);
  roof.scale(1, 1, 1.2);
  roof.translate(0, 0.95, 0);
  B.add('solid', roof, K, '#3A3442');
  propBox(B, 'solid', K, 0.42, 0.48, 0.02, 0, 0.27, 0.56, '#1E1A22');
  // The bowl.
  const bowl = new THREE.CylinderGeometry(0.16, 0.12, 0.08, 14);
  bowl.translate(6.0, 0.04, 3.6);
  B.add('smooth', bowl, M, owner);
  const food = new THREE.CylinderGeometry(0.13, 0.13, 0.02, 12);
  food.translate(6.0, 0.08, 3.6);
  B.add('solid', food, M, '#8A5A2E');
  const mats = { solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), smooth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3 }) };
  group.add(B.build(mats));
  D.bowl = { u: 6.0, d: 3.95 };
  D.x = 6.8;
  D.z = 5;
  loadDog().then((t) => {
    if (!t || D.disposed) return;
    const model = cloneSkinned(t.scene);
    const s = 0.62 / t.height;
    model.scale.setScalar(s);
    model.position.y = -t.foot * s;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });
    const holder = new THREE.Group();
    holder.add(model);
    group.add(holder);
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const [name, clip] of Object.entries(t.clips)) {
      const a = mixer.clipAction(clip);
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      actions[name] = a;
    }
    for (const n of ['Jump_ToIdle', 'Idle_HitReact_Left', 'Idle_HitReact_Right']) {
      if (!actions[n]) continue;
      actions[n].setLoop(THREE.LoopOnce, 1);
      actions[n].clampWhenFinished = true;
    }
    Object.assign(D, { holder, mixer, actions, ready: true });
    play('Idle', 0);
  });
  const frame = { m: M.clone() };

  function play(name, fade = 0.3) {
    const a = D.actions?.[name];
    if (!a || D.current === name) return;
    const prev = D.current ? D.actions[D.current] : null;
    a.reset();
    a.setEffectiveWeight(1);
    a.play();
    if (prev && fade > 0) a.crossFadeFrom(prev, fade, false);
    else if (prev) prev.setEffectiveWeight(0);
    D.current = name;
  }

  function pickTarget() {
    D.tx = rand(area.u0, area.u1);
    D.tz = rand(area.d0, area.d1);
  }

  D.update = function update(dt, t) {
    if (!D.ready) return;
    D.mixer.update(dt);
    const now = t;
    if (D.mood === 'out') {
      play('Idle_2_HeadLow', 0.6);
    } else if (D.state === 'react') {
      if (now > D.until) {
        D.state = 'run';
        pickTarget();
        D.until = now + 2600;
      }
    } else if (D.state === 'walk' || D.state === 'run') {
      const dx = D.tx - D.x;
      const dz = D.tz - D.z;
      const d = Math.hypot(dx, dz);
      const speed = D.state === 'run' ? 3.2 : 0.8;
      play(D.state === 'run' ? 'Gallop' : 'Walk', 0.25);
      if (d < 0.15 || (D.state === 'run' && now > D.until && d < 0.6)) {
        if (D.state === 'run' && now < D.until) pickTarget();
        else {
          D.state = Math.random() < 0.35 ? 'eat' : 'idle';
          if (D.state === 'eat') {
            D.tx = D.bowl.u;
            D.tz = D.bowl.d;
            D.state = 'toBowl';
          }
          D.until = now + rand(2500, 6000);
        }
      } else {
        const want = Math.atan2(dx, dz);
        let diff = want - D.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        D.heading += diff * Math.min(1, dt * 6);
        D.x += Math.sin(D.heading) * speed * dt;
        D.z += Math.cos(D.heading) * speed * dt;
      }
    } else if (D.state === 'toBowl') {
      const dx = D.tx - D.x;
      const dz = D.tz - D.z;
      const d = Math.hypot(dx, dz);
      play('Walk', 0.25);
      if (d < 0.12) {
        D.state = 'eat';
        D.heading = Math.PI;
        D.until = now + rand(3000, 5000);
      } else {
        D.heading = Math.atan2(dx, dz);
        D.x += (dx / d) * 0.8 * dt;
        D.z += (dz / d) * 0.8 * dt;
      }
    } else if (D.state === 'eat') {
      play('Eating', 0.3);
      if (now > D.until) {
        D.state = 'walk';
        pickTarget();
      }
    } else {
      play(Math.floor(now / 7000) % 3 === 2 ? 'Idle_2' : 'Idle', 0.4);
      if (now > D.until) {
        D.state = 'walk';
        pickTarget();
      }
    }
    placeIn(D.holder, frame.m, D.x, 0, D.z, D.heading);
  };

  /** The house was hit (the dog jumps), or is out (it lies down), or a new round (all is well). */
  D.react = function react(what, now) {
    if (!D.ready) return;
    if (what === 'out') {
      D.mood = 'out';
      return;
    }
    if (what === 'fine') {
      D.mood = 'fine';
      D.state = 'idle';
      D.until = now + 2000;
      return;
    }
    if (D.mood === 'out' || D.state === 'react') return;
    D.state = 'react';
    D.until = now + 700;
    const n = Math.random() < 0.5 ? 'Idle_HitReact_Left' : 'Idle_HitReact_Right';
    D.current = null;
    play(n, 0.1);
  };
  D.dispose = function dispose() {
    D.disposed = true;
    D.mixer?.stopAllAction();
  };
  return D;
}

// ------------------------------------------------------------------ the lawns

/** fx: the street's effects (for flames, smoke, spray and notes). */
export function createLawns(field, root, fx, snow = false) {
  const n = field.houses.length;
  const wearing = new Array(n).fill('bare');
  const built = new Array(n).fill(null);
  const mats = materials();

  function build(i, id) {
    const h = field.houses[i];
    const F = houseFrame(h);
    const owner = OWNERS[i % OWNERS.length].color;
    const group = new THREE.Group();
    const B = createBuilder();
    const L = { id, group, flames: [], smoke: null, spray: null, gnomes: null, dog: null, house: i };
    const rng = createRng(i * 31 + id.length);
    switch (id) {
      case 'flamingos': {
        const spots = [
          [-7.4, 4.0, 0.4],
          [-6.6, 4.7, 1.1],
          [-7.9, 5.4, -0.3],
          [7.6, 4.4, 2.6],
        ];
        spots.forEach(([u, d, r], k) => flamingo(B, at(F, u, 0, d, r, 0.95 + k * 0.05), k === 3 ? '#F59BBE' : '#F27FA6'));
        break;
      }
      case 'grill': {
        const M = at(F, 7.0, 0, 4.4, -0.6);
        const coal = barbecue(B, M);
        L.smoke = coal.applyMatrix4(M);
        break;
      }
      case 'loungers': {
        lounger(B, at(F, -6.4, 0, 4.6, Math.PI + 0.25), '#2BB7B3');
        lounger(B, at(F, -7.6, 0, 4.4, Math.PI + 0.1), owner);
        umbrella(B, at(F, -7.0, 0, 3.4), '#F7F2E8', owner);
        // A side table with a drink.
        propCyl(B, 'smooth', at(F, -5.6, 0, 3.7), 0.25, 0.25, 0.04, 0, 0.5, 0, '#F7F2E8', 14);
        propCyl(B, 'smooth', at(F, -5.6, 0, 3.7), 0.03, 0.03, 0.5, 0, 0.25, 0, '#F7F2E8', 6);
        propCyl(B, 'smooth', at(F, -5.6, 0, 3.7), 0.04, 0.03, 0.12, 0.06, 0.58, 0, '#F2A23A', 8);
        break;
      }
      case 'tiki': {
        for (const [u, d] of [
          [-7.6, 3.3],
          [7.6, 3.3],
          [-6.2, 7.0],
          [6.2, 7.0],
        ]) {
          const M = at(F, u, 0, d);
          L.flames.push(tiki(B, M).applyMatrix4(M));
        }
        break;
      }
      case 'dog':
        L.dog = makeDog(group, F, owner);
        break;
      case 'choir': {
        const M = at(F, -6.8, 0, 4.4, 0.35);
        // A little stage of boards.
        const stage = new THREE.CylinderGeometry(2.0, 2.1, 0.4, 24, 1, false, Math.PI * 0.6, Math.PI * 0.8);
        stage.translate(0, 0.2, 1.4);
        B.add('solid', stage, M, '#B07A52');
        // The song sheet on its stand.
        propCyl(B, 'chrome', M, 0.015, 0.015, 1.0, 0, 0.5, 2.3, '#2A2238', 4);
        propBox(B, 'smooth', M, 0.42, 0.3, 0.02, 0, 1.05, 2.3, '#F7F2E8', -0.5);
        L.gnomes = choir(group, M, owner);
        break;
      }
      case 'car': {
        car(B, at(F, -7.4, 0, 5.0, Math.PI / 2 + 0.25), i + 2);
        break;
      }
      case 'fountain': {
        const M = at(F, 7.0, 0, 5.0);
        const f = fountain(B, M, snow);
        L.spray = { at: f.spout.clone().applyMatrix4(M), lipY: f.lipY, lip: f.lip, poolY: f.poolY, M };
        break;
      }
      case 'statue':
        statue(group, at(F, -7.0, 0, 4.6), i);
        break;
      default:
        break;
    }
    void rng;
    const mesh = B.build(mats);
    for (const c of mesh.children) {
      c.castShadow = c.name !== 'glow' && c.name !== 'water';
      c.receiveShadow = true;
    }
    group.add(mesh);
    root.add(group);
    return L;
  }

  function drop(i) {
    const L = built[i];
    if (!L) return;
    L.dog?.dispose();
    root.remove(L.group);
    L.group.traverse((o) => {
      if (o.geometry && !o.isSkinnedMesh) o.geometry.dispose();
    });
    built[i] = null;
  }

  const acc = new Float32Array(n);
  const LW = {
    set(i, id) {
      if (i < 0 || i >= n || wearing[i] === id) return;
      wearing[i] = id;
      drop(i);
      if (id && id !== 'bare') built[i] = build(i, id);
    },
    /** The house was hit / is out / is fine again. */
    react(i, what, now) {
      built[i]?.dog?.react(what, now);
    },
    update(dt, t) {
      for (let i = 0; i < n; i++) {
        const L = built[i];
        if (!L) continue;
        L.dog?.update(dt, t);
        acc[i] += dt;
        for (const f of L.flames) {
          fx.parts.glowAt(f.x, f.y + 0.12, f.z, '#FF9A3A', 0.9, 0.55);
          if (Math.random() < dt * 14) fx.parts.emit({ x: f.x + rand(-0.04, 0.04), y: f.y, z: f.z + rand(-0.04, 0.04), vx: rand(-0.1, 0.1), vy: 0.3, vz: rand(-0.1, 0.1), color: Math.random() < 0.5 ? '#FFB040' : '#FF7A1A', bright: 1.4, size: rand(0.22, 0.34), grow: 0.4, life: rand(0.3, 0.5), shape: SHAPE.flame, add: true, rise: 1.6, drag: 2 });
        }
        if (L.smoke) {
          fx.parts.glowAt(L.smoke.x, L.smoke.y, L.smoke.z, '#FF6A1A', 0.8, 0.35);
          if (Math.random() < dt * 4) fx.parts.emit({ x: L.smoke.x + rand(-0.2, 0.2), y: L.smoke.y + 0.1, z: L.smoke.z + rand(-0.2, 0.2), vy: 0.5, color: '#E8E4E0', size: 0.3, grow: 4, life: 3, alpha: 0.35, shape: SHAPE.smoke, rise: 0.15, drag: 0.6, flutter: 0.25, spin: rand(-0.5, 0.5) });
        }
        if (L.spray) {
          const s = L.spray;
          if (Math.random() < dt * 30) {
            const a = Math.random() * Math.PI * 2;
            const v = rand(0.6, 0.9);
            fx.parts.emit({ x: s.at.x, y: s.at.y, z: s.at.z, vx: Math.cos(a) * v, vy: rand(1.4, 2), vz: Math.sin(a) * v, color: snow ? '#FFFFFF' : '#CFEFFF', size: 0.06, life: 0.55, alpha: 0.85, shape: SHAPE.drop, gravity: 9.8, stretch: 0.08 });
          }
          if (Math.random() < dt * 24) {
            const a = Math.random() * Math.PI * 2;
            const lp = new THREE.Vector3(Math.cos(a) * s.lip, s.lipY, Math.sin(a) * s.lip).applyMatrix4(s.M);
            fx.parts.emit({ x: lp.x, y: lp.y, z: lp.z, vx: Math.cos(a) * 0.3, vy: -0.2, vz: Math.sin(a) * 0.3, color: '#DFF4FF', size: 0.05, life: 0.42, alpha: 0.7, shape: SHAPE.drop, gravity: 9.8, stretch: 0.1 });
          }
        }
        if (L.gnomes) {
          for (const g of L.gnomes) {
            g.holder.position.y = g.base + Math.abs(Math.sin(t / 380 + g.phase)) * 0.05;
            g.holder.rotation.y = g.roll + Math.sin(t / 520 + g.phase) * 0.12;
          }
          if (acc[i] > 0.9) {
            acc[i] = 0;
            const g = L.gnomes[Math.floor(Math.random() * L.gnomes.length)];
            fx.parts.emit({ x: g.at.x, y: g.at.y + 1.1, z: g.at.z, vx: rand(-0.2, 0.2), vy: 0.6, vz: rand(-0.2, 0.2), color: ['#FFFFFF', '#FFE6A0', '#BFF4FF'][Math.floor(Math.random() * 3)], size: 0.32, life: 1.8, shape: SHAPE.note, flutter: 0.35, rot: rand(-0.3, 0.3), fadeIn: 0.15, fadePow: 2 });
          }
        }
      }
    },
    dispose() {
      for (let i = 0; i < n; i++) drop(i);
      for (const m of Object.values(mats)) m.dispose();
    },
  };
  return LW;
}
