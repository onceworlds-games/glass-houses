// The people on the lawns: rigged bodies in their house colour, each neighbour dressed as themselves, walking, strafing, flinching
// and falling through crossfaded clips, with the throw laid over the top as its own motion (cock, draw back, snap, follow
// through). Stars when bonked; a sheet ghost rising out of them when their house falls. And this player's own arm in first person,
// cut from the same body.

import * as THREE from 'three';
import { createBuilder } from './build.js';
import { OWNERS } from './palette.js';
import { SHARED } from './materials.js';
import { throwableMesh } from './throwables.js';
import { whenRigs, makeBody, restOf, aim, turn, pin, placeOf, boxOf, disposeBody, cleanPose, gripOf, palmOf, rollTo, curl } from './rig.js';

const SKINS = ['#E9B98F', '#C98D62', '#A86E48', '#7A4A2E', '#F0CBA6', '#B97B52'];
const HAIRS = ['#2A1D16', '#6B3E22', '#C9974E', '#141018', '#8E4A26', '#4A2E1E'];

// ------------------------------------------------------------------ what you throw

function noise3(x, y, z) {
  return Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 0.5 + Math.sin(x * 4.1 + z * 3.3) * 0.3 + Math.sin(y * 5.7 + x * 2.2) * 0.2;
}

/** A river stone: smooth, a little flat, speckled grey with a lighter band. */
function stoneGeometry(r, seed = 1) {
  const g = new THREE.IcosahedronGeometry(r, 2);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const base = new THREE.Color('#8C857D');
  const band = new THREE.Color('#C9C1B4');
  const dark = new THREE.Color('#5F5952');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / r;
    const y = p.getY(i) / r;
    const z = p.getZ(i) / r;
    const n = noise3(x + seed, y, z) * 0.06;
    p.setXYZ(i, x * r * 1.08 * (1 + n), y * r * 0.74 * (1 + n), z * r * 1.18 * (1 + n));
    const speck = Math.abs(Math.sin(x * 41 + y * 57 + z * 33 + seed)) > 0.93;
    const b = Math.abs(y * 0.9 + x * 0.35) < 0.12;
    c.copy(base).lerp(band, b ? 0.85 : 0).lerp(dark, speck ? 0.7 : Math.max(0, -y) * 0.35);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** The things you can throw, as meshes: a stone, a brick, a garden gnome (and a ghost's pebble). */
export function heldMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'brick') {
    const B = createBuilder();
    const I = new THREE.Matrix4();
    const body = new THREE.BoxGeometry(0.3, 0.1, 0.15, 3, 1, 2);
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * 7.1) * 0.015), p.getY(i), p.getZ(i) * (1 + Math.cos(i * 3.3) * 0.02));
    B.add('b', body, I, '#B4513A');
    for (const x of [-0.08, 0.08]) {
      const frog = new THREE.CylinderGeometry(0.032, 0.032, 0.012, 10);
      frog.translate(x, 0.047, 0);
      B.add('b', frog, I, '#6E2C20');
    }
    const chip = new THREE.BoxGeometry(0.06, 0.03, 0.03);
    chip.translate(0.13, 0.045, 0.06);
    B.add('b', chip, I, '#D9C7AE');
    g.add(B.build({ b: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }) }));
  } else if (kind === 'gnome') {
    const B = createBuilder();
    const I = new THREE.Matrix4();
    const body = new THREE.CylinderGeometry(0.09, 0.13, 0.2, 10);
    body.translate(0, 0.1, 0);
    B.add('g', body, I, '#3563B8');
    const belt = new THREE.CylinderGeometry(0.105, 0.11, 0.03, 10);
    belt.translate(0, 0.12, 0);
    B.add('g', belt, I, '#3A2A20');
    const head = new THREE.SphereGeometry(0.075, 12, 9);
    head.translate(0, 0.25, 0);
    B.add('g', head, I, '#F1C9A5');
    const nose = new THREE.SphereGeometry(0.025, 8, 6);
    nose.translate(0, 0.245, -0.072);
    B.add('g', nose, I, '#E89A80');
    const beard = new THREE.ConeGeometry(0.075, 0.15, 10);
    beard.rotateX(Math.PI);
    beard.translate(0, 0.17, -0.04);
    B.add('g', beard, I, '#F7F2E8');
    const hat = new THREE.ConeGeometry(0.088, 0.24, 10);
    hat.rotateX(0.18);
    hat.translate(0, 0.4, 0.02);
    B.add('g', hat, I, '#D93A2F');
    for (const s of [-1, 1]) {
      const boot = new THREE.SphereGeometry(0.045, 8, 6);
      boot.scale(1, 0.6, 1.4);
      boot.translate(s * 0.05, 0.01, -0.03);
      B.add('g', boot, I, '#3A2A20');
    }
    const m = B.build({ g: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }) });
    m.children[0].position.y = -0.18;
    g.add(m);
    return g;
  } else if (kind === 'pebble') {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 1), new THREE.MeshStandardMaterial({ color: '#BFD6EE', emissive: new THREE.Color('#9FC4F0'), emissiveIntensity: 0.9, roughness: 0.3 }));
    s.scale.set(1, 0.8, 1.1);
    g.add(s);
  } else {
    const s = new THREE.Mesh(stoneGeometry(0.095), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
    g.add(s);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

// ------------------------------------------------------------------ who wears what

const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

/** A neighbour's body and clothes. Shirts are in the owner's colour; the rest says who they are. */
function dress(seat, persona) {
  const owner = OWNERS[seat % OWNERS.length].color;
  const skin = SKINS[(seat * 7 + (persona?.length ?? 0)) % SKINS.length];
  const hair = HAIRS[(seat * 5 + (persona?.length ?? 0)) % HAIRS.length];
  const base = { skin, skinDark: mix(skin, '#5A3020', 0.18), hair, brows: mix(hair, '#000000', 0.3), eyes: '#1A1418', shirt: owner, pants: '#3E3A48', shoes: '#2A2230', sole: '#E8E2D6' };
  switch (persona) {
    case 'walt':
      return { kind: 'man', height: 1.74, look: { ...base, hair: '#D8D2C8', brows: '#BDB6AA', pants: '#8A7F6A', shoes: '#5A3A26' } };
    case 'ray':
      return { kind: 'man', height: 1.82, look: { ...base, hair: '#3A2418', pants: '#3D5A80', shoes: '#4A3426' } };
    case 'chad':
      return { kind: 'man', height: 1.86, look: { ...base, hair: '#D9B26A', brows: '#A8844A', pants: '#2E3A5A', shoes: '#F2EEE6', sole: '#E8645A' } };
    case 'twins':
      return { kind: 'man', height: 1.08, twin: 'woman', look: { ...base, stripe: '#F7F2E8', pants: '#3D5A80', shoes: '#E8645A', sole: '#F7F2E8' } };
    case 'lindqvist':
      return { kind: 'woman', height: 1.66, look: { ...base, hair: '#C8C2BC', brows: '#8A847E', pants: '#B9A8D8', shoes: '#F7F2E8' } };
    case 'rosa':
      return { kind: 'woman', height: 1.62, look: { ...base, hair: '#1E1612', pants: '#6E7A4A', shoes: '#5A3A26' } };
    case 'sunny':
      return { kind: 'woman', height: 1.64, look: { ...base, hair: '#16121A', pants: '#F7F2E8', shoes: '#F7F2E8' } };
    case 'bev':
      return { kind: 'woman', height: 1.68, look: { ...base, hair: '#B0715A', shirt: '#F2A7C3', pants: '#F2A7C3', shoes: '#F2A7C3' } };
    default:
      return { kind: seat % 2 ? 'woman' : 'man', height: seat % 2 ? 1.68 : 1.78, look: base };
  }
}

const mat = (color, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

function mesh(geo, material, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  return m;
}

/**
 * Puts obj in a hand. 'tool': its handle (+y, the far end -y) runs along the fingers; 'upright': stands up when the arm hangs;
 * 'ball': as it is.
 */
function inHand(obj, body, side, space, mode = 'ball', off = 0.045) {
  const g = gripOf(body, side, space, off);
  // The rest pose's hand points along g.dir: a tool's far end (-y), or a mug's foot, goes that way.
  if (mode !== 'ball') obj.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), g.dir));
  const at = mode === 'tool' ? g.p.clone().addScaledVector(g.dir, 0.06) : g.p;
  pin(obj, body.bones[`Wrist${side}`], space, at);
  return obj;
}

/** Hats, glasses, aprons, curlers, a mug: pinned to the bones they move with, placed from the body's rest pose. */
function accessories(body, space, persona, seat, isTwin) {
  const head = body.bones.Head;
  const hb = boxOf(body, '_Head', space);
  const top = hb.max.y;
  const cx = (hb.min.x + hb.max.x) / 2;
  const cz = (hb.min.z + hb.max.z) / 2;
  const hr = (hb.max.x - hb.min.x) / 2;
  const front = hb.min.z;
  const eyeY = hb.min.y + (hb.max.y - hb.min.y) * 0.5;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const owner = OWNERS[seat % OWNERS.length].color;
  const torso = body.bones.Torso ?? body.bones.Chest;
  const hips = body.bones.Hips;
  const chest = placeOf(body.bones.Chest, space);
  const hip = placeOf(hips, space);
  const wristL = body.bones.WristL;
  const wristR = body.bones.WristR;
  const wl = placeOf(wristL, space);

  if (persona === 'walt') {
    const cap = new THREE.Group();
    const tweed = mat('#5E4A36', 0.95);
    const crown = mesh(new THREE.SphereGeometry(hr * 1.28, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), tweed);
    crown.scale.set(1, 0.5, 1.15);
    const bill = mesh(new THREE.CylinderGeometry(hr * 0.95, hr * 1.0, 0.03, 16, 1, false, Math.PI - 0.95, 1.9), mat('#4E3C2A', 0.95));
    bill.position.set(0, -0.01, -hr * 0.62);
    const button = mesh(new THREE.SphereGeometry(0.018, 8, 6), tweed);
    button.position.y = hr * 0.62;
    cap.add(crown, bill, button);
    pin(cap, head, space, V(cx, top - hr * 0.5, cz + 0.01), -0.14);
    const tache = mesh(new THREE.CapsuleGeometry(0.018, 0.07, 3, 8), mat('#E2DCD2', 0.9));
    tache.rotation.z = Math.PI / 2;
    pin(tache, head, space, V(cx, eyeY - (top - eyeY) * 0.55, front + 0.008));
  } else if (persona === 'ray') {
    // A BBQ apron, red with a white pocket, a chef's hat, and a spatula in the other hand.
    const apron = mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.62, 12, 1, true, -0.95, 1.9), mat('#B83A2E', 0.8, { side: THREE.DoubleSide }));
    apron.rotation.y = Math.PI;
    pin(apron, torso, space, V(chest.x, (chest.y + hip.y) / 2 - 0.06, chest.z + 0.02));
    const pocket = mesh(new THREE.PlaneGeometry(0.13, 0.08), mat('#F7F2E8', 0.8, { side: THREE.DoubleSide }));
    pin(pocket, torso, space, V(chest.x, hip.y + 0.08, chest.z - 0.205), 0, Math.PI);
    const spat = new THREE.Group();
    const handle = mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.24, 6), mat('#3A2A20', 0.6));
    const blade = mesh(new THREE.BoxGeometry(0.075, 0.1, 0.006), mat('#C8CCD0', 0.3, { metalness: 0.8 }));
    blade.position.y = -0.17;
    spat.add(handle, blade);
    inHand(spat, body, 'L', space, 'tool');
    const hat = new THREE.Group();
    const band = mesh(new THREE.CylinderGeometry(hr * 0.95, hr * 0.95, 0.07, 16, 1, true), mat('#F7F2E8', 0.9, { side: THREE.DoubleSide }));
    const puff = mesh(new THREE.SphereGeometry(hr * 1.15, 14, 8), mat('#F7F2E8', 0.95));
    puff.scale.set(1, 0.6, 1);
    puff.position.y = 0.09;
    hat.add(band, puff);
    pin(hat, head, space, V(cx, top - 0.01, cz));
  } else if (persona === 'chad') {
    const band = mesh(new THREE.CylinderGeometry(hr * 1.2, hr * 1.2, 0.06, 22, 1, true), mat('#E8645A', 0.8, { side: THREE.DoubleSide }));
    const bandG = new THREE.Group();
    bandG.add(band);
    pin(bandG, head, space, V(cx, eyeY + (top - eyeY) * 0.38, cz + 0.01), -0.1);
    shades(head, space, cx, eyeY + 0.005, front, '#101418', 'aviator');
  } else if (persona === 'twins') {
    if (!isTwin) {
      const cap = new THREE.Group();
      const crown = mesh(new THREE.SphereGeometry(hr * 1.05, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(owner, 0.85));
      // Worn backwards.
      const bill = mesh(new THREE.CylinderGeometry(hr * 0.8, hr * 0.85, 0.02, 14, 1, false, -0.9, 1.8), mat('#F7F2E8', 0.85));
      bill.position.set(0, 0.0, hr * 0.6);
      cap.add(crown, bill);
      pin(cap, head, space, V(cx, top - hr * 0.5, cz), 0.05);
    } else {
      for (const s of [-1, 1]) {
        const tail = mesh(new THREE.CapsuleGeometry(0.035, 0.09, 3, 8), mat(body.mats.find((m) => m.name === 'hair')?.color ?? '#3A2418', 0.7));
        const bow = mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(owner, 0.6));
        bow.position.y = 0.06;
        const g = new THREE.Group();
        g.add(tail, bow);
        pin(g, head, space, V(cx + s * hr * 1.0, eyeY + 0.02, cz + 0.02), 0, 0, s * 0.6);
      }
    }
  } else if (persona === 'lindqvist') {
    sunHat(head, space, cx, top, cz, hr, '#F7F2E8', '#2BB7B3');
    shades(head, space, cx, eyeY + 0.005, front, '#2A2238', 'cateye');
  } else if (persona === 'rosa') {
    sunHat(head, space, cx, top, cz, hr, '#E3C98A', '#C8553D');
    const apron = mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.5, 12, 1, true, -0.9, 1.8), mat('#7FA06A', 0.85, { side: THREE.DoubleSide }));
    apron.rotation.y = Math.PI;
    pin(apron, hips, space, V(hip.x, hip.y - 0.12, hip.z + 0.02));
    const trowel = new THREE.Group();
    const handle = mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.12, 6), mat('#8A5A3A', 0.6));
    const blade = mesh(new THREE.ConeGeometry(0.04, 0.14, 4), mat('#B8BCC0', 0.35, { metalness: 0.7 }));
    blade.scale.z = 0.25;
    blade.rotation.x = Math.PI;
    blade.position.y = -0.13;
    trowel.add(handle, blade);
    inHand(trowel, body, 'L', space, 'tool');
  } else if (persona === 'sunny') {
    const visor = new THREE.Group();
    const band = mesh(new THREE.CylinderGeometry(hr * 1.02, hr * 1.02, 0.045, 18, 1, true), mat('#2BB7B3', 0.6, { side: THREE.DoubleSide }));
    // CylinderGeometry's theta 0 is +z: centred on pi, the bill sticks out in front (-z).
    const bill = mesh(new THREE.CylinderGeometry(hr * 1.65, hr * 1.65, 0.012, 18, 1, false, Math.PI - 0.85, 1.7), mat('#2BB7B3', 0.6));
    bill.position.set(0, -0.012, 0);
    visor.add(band, bill);
    pin(visor, head, space, V(cx, top - (top - eyeY) * 0.6, cz), -0.12);
    for (const side of ['L', 'R']) {
      const foot = body.bones[`Foot${side}`];
      if (!foot) continue;
      const fp = placeOf(foot, space);
      const skate = new THREE.Group();
      const plate = mesh(new THREE.BoxGeometry(0.11, 0.035, 0.28), mat('#F7F2E8', 0.5));
      const toe = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), mat('#FF5A8A', 0.6));
      toe.rotation.z = Math.PI / 2;
      toe.position.set(0, -0.005, -0.15);
      skate.add(plate, toe);
      for (const z of [-0.1, 0.1]) {
        for (const x of [-0.05, 0.05]) {
          const w = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 12), mat('#FF5A8A', 0.4));
          w.rotation.z = Math.PI / 2;
          w.position.set(x, -0.04, z);
          skate.add(w);
        }
      }
      pin(skate, foot, space, V(fp.x, 0.035, fp.z - 0.02));
    }
  } else if (persona === 'bev') {
    for (let k = 0; k < 6; k++) {
      const c = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), mat(k % 2 ? '#7CC6E8' : '#FFB547', 0.5));
      c.rotation.z = Math.PI / 2;
      const a = -0.9 + (k / 5) * 1.8;
      const g = new THREE.Group();
      g.add(c);
      pin(g, head, space, V(cx, top + 0.012 - Math.abs(a) * 0.035, cz - Math.sin(a) * hr * 0.95 + 0.01), a);
    }
    const robe = mesh(new THREE.CylinderGeometry(0.19, 0.27, 0.6, 16, 1, true), mat('#F2A7C3', 0.9, { side: THREE.DoubleSide }));
    pin(robe, hips, space, V(hip.x, hip.y - 0.25, hip.z));
    const belt = mesh(new THREE.TorusGeometry(0.19, 0.022, 6, 18), mat(owner, 0.7));
    belt.rotation.x = Math.PI / 2;
    const bg = new THREE.Group();
    bg.add(belt);
    pin(bg, hips, space, V(hip.x, hip.y + 0.08, hip.z));
    const mug = new THREE.Group();
    const cup = mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 12), mat('#F7F2E8', 0.4));
    const handle = mesh(new THREE.TorusGeometry(0.028, 0.009, 6, 10, Math.PI), mat('#F7F2E8', 0.4));
    handle.position.x = 0.045;
    handle.rotation.z = -Math.PI / 2;
    const coffee = mesh(new THREE.CircleGeometry(0.04, 12), mat('#4A2A18', 0.2));
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 0.045;
    mug.add(cup, handle, coffee);
    inHand(mug, body, 'L', space, 'upright', 0.06);
    // A shawl collar on the robe.
    for (const sd of [-1, 1]) {
      const lapel = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.025), mat('#E58FB0', 0.9));
      pin(lapel, body.bones.Chest, space, V(chest.x + sd * 0.06, chest.y - 0.02, chest.z - 0.125), 0.12, 0, -sd * 0.3);
    }
  }
  return { wristR };
}

function sunHat(head, space, cx, top, cz, hr, color, ribbon) {
  const hat = new THREE.Group();
  const brim = mesh(new THREE.CylinderGeometry(hr * 2.6, hr * 2.7, 0.018, 24), mat(color, 0.9));
  const crown = mesh(new THREE.CylinderGeometry(hr * 0.9, hr * 1.05, 0.12, 18), mat(color, 0.9));
  crown.position.y = 0.06;
  const band = mesh(new THREE.CylinderGeometry(hr * 1.06, hr * 1.06, 0.035, 18, 1, true), mat(ribbon, 0.7));
  band.position.y = 0.025;
  hat.add(brim, crown, band);
  pin(hat, head, space, new THREE.Vector3(cx, top - hr * 0.42, cz + 0.01), -0.1);
}

function shades(head, space, cx, y, front, color, style) {
  const g = new THREE.Group();
  const m = mat(color, 0.3, { metalness: 0.2 });
  const lensM = mat(style === 'aviator' ? '#3A4A55' : '#1A1418', 0.15, { metalness: 0.5 });
  for (const s of [-1, 1]) {
    const lens = mesh(new THREE.CircleGeometry(0.032, 14), lensM, false);
    lens.scale.set(style === 'cateye' ? 1.25 : 1.1, style === 'cateye' ? 0.8 : 1.0, 1);
    lens.position.set(s * 0.038, 0, 0);
    lens.rotation.y = Math.PI;
    if (style === 'cateye') lens.rotation.z = s * 0.25;
    const rim = mesh(new THREE.TorusGeometry(0.033, 0.006, 4, 16), m, false);
    rim.scale.copy(lens.scale);
    rim.position.copy(lens.position);
    rim.rotation.z = lens.rotation.z;
    g.add(lens, rim);
  }
  const bridge = mesh(new THREE.BoxGeometry(0.02, 0.006, 0.006), m, false);
  g.add(bridge);
  pin(g, head, space, new THREE.Vector3(cx, y, front - 0.012));
}

// ------------------------------------------------------------------ motion

const V3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

/** Directions (in the body's frame: x right, y up, -z ahead) the upper arm and forearm take through a throw. */
const THROW = {
  cockU: V3(0.85, 0.2, 0.25),
  cockF: V3(0.25, 0.94, 0.2),
  backU: V3(0.72, 0.3, 0.62),
  backF: V3(0.1, 0.88, 0.45),
  relU: V3(0.32, 0.75, -0.58),
  relF: V3(0.08, 0.5, -0.86),
  folU: V3(-0.25, -0.6, -0.75),
  folF: V3(-0.55, -0.6, -0.55),
  // The other arm points at the target while the throwing arm draws back.
  leadU: V3(-0.35, 0.3, -0.9),
  leadF: V3(-0.15, 0.3, -0.95),
  tuckU: V3(-0.45, -0.75, 0.1),
  tuckF: V3(-0.1, -0.2, -1),
  cheerU: V3(-0.2, 0.95, -0.15),
  cheerF: V3(-0.05, 1, 0.05),
};

const nlerp = (out, a, b, t) => out.copy(a).lerp(b, t).normalize();
const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** Plays one body: locomotion blended from the walk/run/strafe clips, one-shots (hit, fall, wave), the throw on top. */
function animator(body, space) {
  const A = body.actions;
  const B = body.bones;
  const arms = {
    uR: restOf(B.UpperArmR, B.LowerArmR),
    fR: restOf(B.LowerArmR, B.WristR),
    uL: restOf(B.UpperArmL, B.LowerArmL),
    fL: restOf(B.LowerArmL, B.WristL),
  };
  const LOCO = ['Idle', 'Run', 'Run_Back', 'Run_Left', 'Run_Right', 'Walk'];
  const w = Object.fromEntries(LOCO.map((k) => [k, k === 'Idle' ? 1 : 0]));
  const shot = { name: null, t: 0, hold: false };
  if (A.Idle) A.Idle.time = Math.random() * A.Idle.getClip().duration;
  for (const k of ['HitRecieve', 'HitRecieve_2', 'Death', 'Wave', 'Interact']) {
    if (!A[k]) continue;
    A[k].setLoop(k === 'Interact' ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    A[k].clampWhenFinished = true;
  }
  const tmpU = new THREE.Vector3();
  const tmpF = new THREE.Vector3();
  const tmpLU = new THREE.Vector3();
  const tmpLF = new THREE.Vector3();
  let throwW = 0;
  let leadW = 0;
  let repairW = 0;
  let cheer = 0;
  const clean = cleanPose([B.UpperArmR, B.LowerArmR, B.UpperArmL, B.LowerArmL, B.Chest, B.Torso, B.Abdomen, B.Neck]);

  return {
    /** A one-shot clip over everything: 'HitRecieve', 'Death', 'Wave'. hold: stay on its last frame until cleared. */
    play(name, hold = false) {
      if (!A[name]) return;
      if (shot.name && shot.name !== name) A[shot.name].setEffectiveWeight(0);
      shot.name = name;
      shot.t = 0;
      shot.hold = hold;
      A[name].reset();
      A[name].timeScale = 1;
      A[name].play();
    },
    clear() {
      if (shot.name) A[shot.name].setEffectiveWeight(0);
      shot.name = null;
    },
    cheer() {
      cheer = 1;
    },
    /**
     * s: { fwd, right (m/s in the body's frame), wind (0..1 drawing back, -1 not), swing (s since the throw, or -1),
     * repairing, pitch }.
     */
    step(s, dt) {
      const speed = Math.hypot(s.fwd, s.right);
      const move = clamp01((speed - 0.25) / 2.6);
      const tw = { Idle: 1 - move, Run: 0, Run_Back: 0, Run_Left: 0, Run_Right: 0, Walk: 0 };
      if (speed > 0.05) {
        const f = Math.max(0, s.fwd);
        const bk = Math.max(0, -s.fwd);
        const r = Math.max(0, s.right);
        const l = Math.max(0, -s.right);
        const sum = f + bk + r + l || 1;
        const slow = clamp01((2.4 - speed) / 1.4);
        tw.Walk = (f / sum) * move * slow;
        tw.Run = (f / sum) * move * (1 - slow);
        tw.Run_Back = (bk / sum) * move;
        tw.Run_Left = (l / sum) * move;
        tw.Run_Right = (r / sum) * move;
      }
      const k = Math.min(1, dt * 9);
      // One-shots fade in fast and out near their end.
      let sw = 0;
      if (shot.name) {
        const a = A[shot.name];
        shot.t += dt;
        const dur = a.getClip().duration;
        const fin = shot.hold ? 1 : clamp01((dur - shot.t) / 0.25);
        sw = Math.min(1, shot.t / 0.08) * fin;
        if (!shot.hold && shot.t >= dur) {
          a.setEffectiveWeight(0);
          shot.name = null;
          sw = 0;
        } else a.setEffectiveWeight(sw);
      }
      repairW += ((s.repairing ? 1 : 0) - repairW) * Math.min(1, dt * 6);
      if (A.Interact) A.Interact.setEffectiveWeight(repairW * (1 - sw));
      const rest = (1 - sw) * (1 - repairW * 0.85);
      for (const name of LOCO) {
        if (!A[name]) continue;
        w[name] += (tw[name] - w[name]) * k;
        A[name].setEffectiveWeight(w[name] * rest);
      }
      const ts = speed > 0.3 ? Math.max(0.7, Math.min(1.35, speed / 3.6)) : 1;
      for (const name of ['Run', 'Run_Back', 'Run_Left', 'Run_Right']) if (A[name]) A[name].timeScale = ts;
      if (A.Walk) A.Walk.timeScale = Math.max(0.6, speed / 1.6);
      clean.restore();
      body.mixer.update(dt);
      clean.save();

      if (sw > 0.95 && shot.name === 'Death') return;
      // The throw, over whatever the clip did.
      let target = 0;
      let lead = 0;
      let active = false;
      if (s.wind >= 0) {
        const p = smooth(clamp01(s.wind));
        nlerp(tmpU, THROW.cockU, THROW.backU, p);
        nlerp(tmpF, THROW.cockF, THROW.backF, p);
        target = 1;
        lead = 0.85;
        active = true;
      } else if (s.swing >= 0 && s.swing < 0.6) {
        const t = s.swing;
        if (t < 0.07) {
          const p = smooth(t / 0.07);
          nlerp(tmpU, THROW.backU, THROW.relU, p);
          nlerp(tmpF, THROW.backF, THROW.relF, p);
          lead = 0.85 * (1 - p);
        } else if (t < 0.24) {
          const p = smooth((t - 0.07) / 0.17);
          nlerp(tmpU, THROW.relU, THROW.folU, p);
          nlerp(tmpF, THROW.relF, THROW.folF, p);
        } else {
          tmpU.copy(THROW.folU);
          tmpF.copy(THROW.folF);
        }
        target = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.3;
        active = true;
      }
      throwW += (target - throwW) * Math.min(1, dt * (target > throwW ? 30 : 10));
      leadW += (lead - leadW) * Math.min(1, dt * 12);
      const tw2 = throwW * (1 - sw) * (1 - repairW);
      // Chest: turns the throwing shoulder back on the draw, through on the release; bends into the follow-through.
      let twist = 0;
      let bend = 0;
      if (s.wind >= 0) twist = 0.3 + 0.5 * smooth(clamp01(s.wind));
      else if (s.swing >= 0 && s.swing < 0.6) {
        const t = s.swing;
        twist = t < 0.07 ? 0.8 - 1.4 * smooth(t / 0.07) : -0.6 * (1 - clamp01((t - 0.24) / 0.36));
        bend = t < 0.07 ? -0.15 * (t / 0.07) : -0.38 * (1 - clamp01((t - 0.2) / 0.4));
      }
      if (tw2 > 0.01) {
        // Spread over the spine so the whole body winds and unwinds, leaning back on the draw and into the throw after.
        if (B.Abdomen) turn(B.Abdomen, UP, twist * 0.45 * tw2, space);
        if (B.Chest) turn(B.Chest, UP, twist * 0.55 * tw2, space);
        if (B.Abdomen) turn(B.Abdomen, RIGHT, (s.wind >= 0 ? 0.12 : bend) * tw2, space);
      }
      if (tw2 > 0.01 && active) {
        aim(arms.uR, tmpU, space, tw2);
        aim(arms.fR, tmpF, space, tw2);
      }
      const lw = leadW * tw2;
      if (lw > 0.01) {
        aim(arms.uL, THROW.leadU, space, lw);
        aim(arms.fL, THROW.leadF, space, lw);
      } else if (s.swing >= 0.07 && s.swing < 0.6 && tw2 > 0.01) {
        aim(arms.uL, THROW.tuckU, space, tw2 * 0.6);
        aim(arms.fL, THROW.tuckF, space, tw2 * 0.6);
      }
      // A fist pump with the free arm (a house knocked out).
      if (cheer > 0) {
        cheer = Math.max(0, cheer - dt * 0.9);
        const c = Math.min(1, cheer * 4) * (1 - sw);
        const pump = 0.75 + 0.25 * Math.sin((1 - cheer) * 20);
        nlerp(tmpLU, THROW.leadU, THROW.cheerU, pump);
        nlerp(tmpLF, THROW.leadF, THROW.cheerF, pump);
        aim(arms.uL, tmpLU, space, c);
        aim(arms.fL, tmpLF, space, c);
      }
      // The head follows the aim up and down.
      if (B.Neck && s.pitch) turn(B.Neck, RIGHT, Math.max(-0.5, Math.min(0.7, s.pitch)) * 0.55 * (1 - sw), space);
    },
  };
}

// ------------------------------------------------------------------ the ghost

const ghostGeo = (() => {
  const pts = [];
  for (let k = 0; k <= 14; k++) {
    const a = (k / 14) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * 0.52, Math.cos(a) * 0.5));
  }
  pts.push(new THREE.Vector2(0.56, -0.3), new THREE.Vector2(0.62, -0.7), new THREE.Vector2(0.7, -0.98));
  return new THREE.LatheGeometry(pts.reverse(), 32);
})();

function ghostMaterial(color) {
  const m = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.62, emissive: new THREE.Color(color), emissiveIntensity: 0.55, roughness: 0.35, depthWrite: false, side: THREE.DoubleSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = SHARED.time;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        float hem = smoothstep(0.0, -0.98, transformed.y);
        float a = atan(transformed.z, transformed.x);
        transformed.y += sin(a * 6.0 + uTime * 5.0) * 0.07 * hem;
        transformed.xz *= 1.0 + sin(a * 3.0 - uTime * 3.0) * 0.06 * hem;
        transformed.x += sin(uTime * 2.0 + transformed.y * 2.0) * 0.05 * hem;
      }`,
    );
  };
  m.customProgramCacheKey = () => 'ghost';
  return m;
}

function makeGhost(color) {
  const ghost = new THREE.Group();
  const body = new THREE.Mesh(ghostGeo, ghostMaterial(color));
  body.renderOrder = 4;
  ghost.add(body);
  const eyeM = new THREE.MeshBasicMaterial({ color: '#2A2238' });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), eyeM);
    eye.scale.set(0.85, 1.25, 0.5);
    eye.position.set(s * 0.17, 0.14, -0.47);
    ghost.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 14), eyeM);
  mouth.position.set(0, -0.06, -0.5);
  mouth.scale.set(1, 1.3, 1);
  ghost.add(mouth);
  // Two stubby arms that flap.
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), body.material);
    arm.position.set(s * 0.56, -0.18, -0.05);
    arm.rotation.z = s * 1.1;
    ghost.add(arm);
    arms.push(arm);
  }
  ghost.userData.arms = arms;
  ghost.visible = false;
  return ghost;
}

// ------------------------------------------------------------------ a neighbour

/** One figure. persona: a neighbour's id or 'player'. */
export function makeFigure(seat, persona, scale = 1) {
  const owner = OWNERS[seat % OWNERS.length];
  const root = new THREE.Group();
  const ghost = makeGhost(owner.color);
  const d = dress(seat, persona);
  const parts = [];
  const holds = [];

  // Bonk stars over the head.
  const stars = new THREE.Group();
  const starMat = new THREE.MeshBasicMaterial({ color: '#FFD45A', fog: false });
  const starGeo = (() => {
    const sh = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const r = k % 2 ? 0.035 : 0.085;
      if (k) sh.lineTo(Math.sin(a) * r, Math.cos(a) * r);
      else sh.moveTo(Math.sin(a) * r, Math.cos(a) * r);
    }
    return new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false });
  })();
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Mesh(starGeo, starMat);
    s.position.set(Math.cos((k / 4) * Math.PI * 2) * 0.3, 0, Math.sin((k / 4) * Math.PI * 2) * 0.3);
    stars.add(s);
  }
  stars.position.y = d.height + 0.2;
  stars.visible = false;
  root.add(stars);

  function build() {
    const list = [{ kind: d.kind, height: d.height, look: d.look, x: 0, z: 0, twin: false }];
    if (d.twin) {
      list[0].x = -0.38;
      const look2 = { ...d.look, hair: '#6B3E22', stripe: '#2A2238', shoes: '#F7F2E8' };
      list.push({ kind: d.twin, height: d.height * 0.97, look: look2, x: 0.42, z: 0.15, twin: true });
    }
    for (const p of list) {
      const space = new THREE.Group();
      space.position.set(p.x, 0, p.z);
      root.add(space);
      const body = makeBody(p.kind, p.height, p.look);
      // Sunny rides a little higher, on her skates.
      if (persona === 'sunny') body.holder.position.y += 0.07;
      space.add(body.holder);
      space.updateMatrixWorld(true);
      const extra = accessories(body, space, persona, seat, p.twin);
      // What's in the hand, pinned to the wrist so it rides the throw.
      const hand = {};
      for (const k of ['stone', 'brick', 'gnome']) {
        const g = new THREE.Group();
        g.add(heldMesh(k));
        g.visible = false;
        inHand(g, body, 'R', space, 'ball', k === 'stone' ? 0.06 : 0.09);
        hand[k] = g;
      }
      holds.push(hand);
      parts.push({ body, space, anim: animator(body, space) });
    }
  }
  whenRigs(build);

  if (scale !== 1) root.scale.multiplyScalar(scale);

  let lastThrow = -1e9;
  let swingT = -1;
  let wasStunned = false;
  let wasGhost = false;
  let fallT = -1;
  let fallX = 0;
  let fallZ = 0;
  let fallY = 0;
  let fallYaw = 0;
  let ghostT = 1;
  const F = {
    root,
    ghost,
    seat,
    persona,
    /** Waves (the round's intro, the winner on the results). */
    wave() {
      for (const p of parts) p.anim.play('Wave');
    },
    /** A fist in the air: they just knocked a house out. */
    cheer() {
      for (const p of parts) p.anim.cheer();
    },
    /** Draws a body from the round. t: round ms. */
    update(b, t, dt, mine) {
      dt = Math.min(dt, 0.1);
      // The fall: when their house goes, they drop where they stood and the ghost rises out of them.
      if (b.ghost && !wasGhost) {
        fallT = 0;
        fallX = root.position.x;
        fallZ = root.position.z;
        fallY = root.position.y;
        fallYaw = root.rotation.y;
        ghostT = 0;
        for (const p of parts) p.anim.play('Death', true);
      } else if (!b.ghost && wasGhost) {
        fallT = -1;
        for (const p of parts) p.anim.clear();
      }
      wasGhost = b.ghost;
      if (b.ghost) {
        const show = !mine && !b.skip;
        if (fallT >= 0) {
          fallT += dt;
          root.visible = show && fallT < 3.2;
          root.position.set(fallX, fallY - Math.max(0, fallT - 2.4) * 1.2, fallZ);
          root.rotation.y = fallYaw;
          stars.visible = false;
          if (root.visible) for (const p of parts) p.anim.step({ fwd: 0, right: 0, wind: -1, swing: -1, repairing: false, pitch: 0 }, dt);
          if (fallT >= 3.2) fallT = -1;
        } else root.visible = false;
        ghost.visible = show;
        ghostT = Math.min(1, ghostT + dt * 0.8);
        const e = smooth(ghostT);
        const gy = (b.gy ?? 3.5) + Math.sin(t / 400 + seat) * 0.1;
        if (ghostT >= 1) ghost.position.set(b.gx, gy, b.gz);
        else ghost.position.set(fallX + (b.gx - fallX) * e, fallY + 0.6 + (gy - fallY - 0.6) * e, fallZ + (b.gz - fallZ) * e);
        ghost.rotation.y = b.yaw;
        ghost.scale.setScalar(0.4 + 0.6 * smooth(Math.min(1, ghostT * 1.5)));
        const ar = ghost.userData.arms;
        ar[0].rotation.z = -1.1 + Math.sin(t / 160 + seat) * 0.35;
        ar[1].rotation.z = 1.1 - Math.sin(t / 160 + seat + 1) * 0.35;
        return;
      }
      ghost.visible = false;
      const show = !mine && !b.skip;
      root.visible = show;
      if (!show) return;
      root.position.set(b.x, b.y, b.z);
      root.rotation.y = b.yaw;
      // Velocity in the body's own frame: ahead is -z after the turn by yaw.
      const vx = b.vx || 0;
      const vz = b.vz || 0;
      const sy = Math.sin(b.yaw);
      const cy = Math.cos(b.yaw);
      const fwd = -(vx * sy + vz * cy);
      const right = vx * cy - vz * sy;
      if (b.lastThrowAt > lastThrow) {
        lastThrow = b.lastThrowAt;
        swingT = Math.max(0, (t - b.lastThrowAt) / 1000);
      } else if (swingT >= 0) {
        swingT += dt;
        if (swingT > 0.8) swingT = -1;
      }
      const stunned = b.stunUntil > t;
      if (stunned && !wasStunned) for (const p of parts) p.anim.play(Math.random() < 0.5 ? 'HitRecieve' : 'HitRecieve_2');
      wasStunned = stunned;
      const state = { fwd, right, wind: b.winding ? (b.power ?? 0) : -1, swing: swingT, repairing: !!b.repairing, pitch: b.pitch ?? 0 };
      for (const p of parts) p.anim.step(state, dt);
      const held = b.held ?? (b.ammo > 0 ? 'stone' : null);
      const inHand = swingT < 0 || swingT > 0.45;
      for (let i = 0; i < holds.length; i++) {
        const h = holds[i];
        const kind = i === 0 ? held : b.ammo > 1 && !b.held ? 'stone' : null;
        for (const k in h) h[k].visible = k === kind && inHand && !b.repairing;
      }
      stars.visible = stunned;
      if (stars.visible) {
        stars.rotation.y = t / 160;
        for (const s of stars.children) s.rotation.y = -t / 90;
      }
    },
    dispose() {
      for (const p of parts) disposeBody(p.body);
      root.traverse((o) => {
        if (o.isSkinnedMesh) return;
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
      ghost.traverse((o) => {
        if (o.geometry !== ghostGeo) o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
    },
  };
  return F;
}

// ------------------------------------------------------------------ first person

/** Where the camera-space directions of the first-person arm go through a throw (x right, y up, -z ahead). */
const FP = {
  restU: V3(0.1, -0.62, -0.78),
  restF: V3(-0.32, 0.5, -0.8),
  cockU: V3(0.45, -0.37, -0.82),
  cockF: V3(-0.18, 0.8, -0.59),
  backU: V3(0.65, -0.3, -0.7),
  backF: V3(-0.12, 0.88, -0.46),
  relU: V3(0.0, 0.35, -0.94),
  relF: V3(-0.2, 0.2, -0.96),
  folU: V3(-0.2, -0.6, -0.77),
  folF: V3(-0.65, -0.55, -0.52),
  lowU: V3(0.05, -0.9, -0.42),
  lowF: V3(-0.2, -0.3, -0.93),
  // Which way the palm faces: up toward you at rest (the stone sits in it), in toward the middle on the draw, ahead on the release.
  restN: V3(-0.35, 0.6, 0.7),
  cockN: V3(-0.85, 0.2, -0.45),
  backN: V3(-0.8, 0.3, -0.5),
  relN: V3(-0.1, -0.3, -0.95),
  folN: V3(-0.2, -0.9, -0.3),
};

/** This player's arm in first person: their sleeve, their hand closed round the stone (or the special). */
export function makeArm(seat, persona = 'player') {
  const group = new THREE.Group();
  const space = new THREE.Group();
  group.add(space);
  const d = dress(seat, persona);
  const holds = {};
  let stoneId = 'river';
  // A hot stone glows from inside: the same stone, its own material lit orange (the shared one stays as it is).
  let heldMesh = null;
  let coolMat = null;
  let hotMat = null;
  let hotNow = false;
  let ready = false;
  let arms = null;
  let body = null;
  let clean = null;
  const fingers = [];
  whenRigs(() => {
    body = makeBody(d.kind, persona === 'twins' ? 1.6 : d.height, d.look, { armOnly: true, shadow: false });
    space.add(body.holder);
    space.updateMatrixWorld(true);
    const sh = placeOf(body.bones.UpperArmR, space);
    body.holder.position.sub(sh);
    space.updateMatrixWorld(true);
    const B = body.bones;
    arms = { u: restOf(B.UpperArmR, B.LowerArmR), f: restOf(B.LowerArmR, B.WristR) };
    clean = cleanPose([B.UpperArmR, B.LowerArmR, B.WristR]);
    for (const k of ['stone', 'brick', 'gnome', 'pebble']) {
      const g = new THREE.Group();
      g.add(heldMesh(k));
      g.visible = false;
      g.scale.setScalar(0.72);
      inHand(g, body, 'R', space, 'ball', k === 'stone' || k === 'pebble' ? 0.05 : 0.07);
      holds[k] = g;
    }
    wearStone(stoneId);
    for (const n of Object.keys(B)) if (/^(Index|Middle|Ring|Pinky)[123]R$/.test(n)) fingers.push({ bone: B[n], rest: B[n].quaternion.clone() });
    for (const n of ['Thumb1R', 'Thumb2R']) if (B[n]) fingers.push({ bone: B[n], rest: B[n].quaternion.clone(), thumb: true });
    group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.renderOrder = 10;
        o.frustumCulled = false;
      }
    });
    // A long sleeve in the owner's colour over the forearm, a white cuff at the wrist.
    const el = placeOf(B.LowerArmR, space);
    const wr = placeOf(B.WristR, space);
    const len = el.distanceTo(wr);
    const sleeve = new THREE.Group();
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.056, len * 0.86, 14, 1, true), new THREE.MeshStandardMaterial({ color: d.look.shirt, roughness: 0.8, side: THREE.DoubleSide }));
    cloth.position.y = -len * 0.43;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.049, 0.045, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#F7F2E8', roughness: 0.7, side: THREE.DoubleSide }));
    cuff.position.y = -len * 0.86 - 0.01;
    sleeve.add(cloth, cuff);
    sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), wr.clone().sub(el).normalize());
    pin(sleeve, B.LowerArmR, space, el);
    if (body.actions.Idle) body.actions.Idle.setEffectiveWeight(1);
    ready = true;
  });
  // The shoulder sits just below and right of the eye, a little ahead.
  space.position.set(0.25, -0.24, -0.04);
  /** What's in the hand when it's a stone: the player's own (the Locker's look). */
  function wearStone(id) {
    const g = holds.stone;
    if (!g) return;
    g.clear();
    const m = throwableMesh(id);
    m.renderOrder = 10;
    m.frustumCulled = false;
    m.castShadow = false;
    g.add(m);
    heldMesh = m;
    coolMat = m.material;
    if (hotMat) hotMat.dispose();
    hotMat = null;
    if (hotNow) burn(true);
  }
  // (heldMesh, coolMat, hotMat, hotNow: declared at the top, since whenRigs can run its callback at once.)
  function burn(on) {
    hotNow = on;
    if (!heldMesh) return;
    if (on && !hotMat) {
      hotMat = coolMat.clone();
      hotMat.emissive = new THREE.Color('#FF5A12');
      hotMat.emissiveIntensity = 0.9;
    }
    heldMesh.material = on ? hotMat : coolMat;
  }
  let lastThrow = -1e9;
  let swingT = -1;
  let bob = 0;
  let recoil = 0;
  let draw = 0;
  const tU = new THREE.Vector3();
  const tF = new THREE.Vector3();
  const tN = new THREE.Vector3();
  const palm = new THREE.Vector3();
  const side = new THREE.Vector3();
  return {
    group,
    /** How far through the throw (for the camera's kick): s since the release, or -1. */
    get swing() {
      return swingT;
    },
    /** The stone in hand looks like this (a throwable id). */
    setStone(id) {
      if (id === stoneId) return;
      stoneId = id;
      wearStone(id);
    },
    /** The stone in hand burns (a hot stone); `pulse` 0..1 flickers it. */
    setHot(on, pulse = 0.5) {
      if (on !== hotNow) burn(on);
      if (on && hotMat) hotMat.emissiveIntensity = 0.65 + 0.6 * pulse;
    },
    /** Where the stone in hand is (world), if it's showing. */
    stoneAt(out) {
      const g = holds.stone;
      if (!g || !g.visible || !group.visible) return null;
      return g.getWorldPosition(out);
    },
    update(b, t, dt, ghost) {
      dt = Math.min(dt, 0.1);
      if (b.lastThrowAt > lastThrow) {
        lastThrow = b.lastThrowAt;
        swingT = 0;
        recoil = 1;
      } else if (swingT >= 0) {
        swingT += dt;
        if (swingT > 0.9) swingT = -1;
      }
      recoil = Math.max(0, recoil - dt * 5);
      const speed = Math.hypot(b.vx || 0, b.vz || 0);
      bob += dt * (2 + speed * 2.4);
      const winding = b.winding && !b.repairing;
      draw += ((winding ? 1 : 0) - draw) * Math.min(1, dt * 14);
      const p = winding ? smooth(clamp01(b.power ?? 0)) : 0;
      const stunned = (b.stunUntil ?? -1) > t;
      const kind = ghost ? (b.pebbles > 0 ? 'pebble' : null) : (b.held ?? (b.ammo > 0 ? 'stone' : null));
      if (!ready) return;
      clean.restore();
      body.mixer.update(dt);
      clean.save();
      // Rest -> cocked -> drawn back with power; on release snap through, follow down out of view, come back up with the next.
      if (swingT >= 0) {
        const s = swingT;
        if (s < 0.06) {
          const k = smooth(s / 0.06);
          nlerp(tU, FP.backU, FP.relU, k);
          nlerp(tF, FP.backF, FP.relF, k);
          nlerp(tN, FP.backN, FP.relN, k);
        } else if (s < 0.2) {
          const k = smooth((s - 0.06) / 0.14);
          nlerp(tU, FP.relU, FP.folU, k);
          nlerp(tF, FP.relF, FP.folF, k);
          nlerp(tN, FP.relN, FP.folN, k);
        } else if (s < 0.42) {
          const k = smooth((s - 0.2) / 0.22);
          nlerp(tU, FP.folU, FP.lowU, k);
          nlerp(tF, FP.folF, FP.lowF, k);
          nlerp(tN, FP.folN, FP.restN, k);
        } else {
          const k = smooth(clamp01((s - 0.42) / 0.4));
          nlerp(tU, FP.lowU, FP.restU, k);
          nlerp(tF, FP.lowF, FP.restF, k);
          tN.copy(FP.restN);
        }
      } else if (draw > 0.01) {
        nlerp(_a, FP.cockU, FP.backU, p);
        nlerp(_b, FP.cockF, FP.backF, p);
        nlerp(tU, FP.restU, _a, draw);
        nlerp(tF, FP.restF, _b, draw);
        nlerp(_a, FP.cockN, FP.backN, p);
        nlerp(tN, FP.restN, _a, draw);
        // A tremble at full draw.
        if (p > 0.95) tF.x += Math.sin(t / 22) * 0.012;
      } else {
        tU.copy(FP.restU);
        tF.copy(FP.restF);
        tN.copy(FP.restN);
        if (b.repairing) {
          tU.set(0.0, -0.1, -1);
          tF.set(-0.3 + Math.sin(t / 110) * 0.35, 0.35, -0.9);
        }
        if (stunned) tF.y -= 0.4;
        if (!kind) tU.y -= 0.25;
      }
      // Walking sways the arm.
      tU.x += Math.sin(bob) * 0.025 * Math.min(1, speed / 3);
      tU.y += Math.abs(Math.cos(bob)) * 0.03 * Math.min(1, speed / 3);
      aim(arms.u, tU.normalize(), space, 1);
      aim(arms.f, tF.normalize(), space, 1);
      // Turn the forearm so the palm faces where it should, then bend the wrist: back on the draw, a flick on the release.
      rollTo(body.bones.LowerArmR, tF, palmOf(body, 'R', space, palm), tN.normalize(), space, 1);
      const flick = swingT >= 0 && swingT < 0.2 ? 0.8 * Math.sin((swingT / 0.2) * Math.PI) : 0;
      side.crossVectors(tF, palmOf(body, 'R', space, palm)).normalize();
      turn(body.bones.WristR, side, (swingT >= 0 ? 0 : -draw * 0.45) + flick, space);
      // Fingers close round what's held, open as it leaves.
      const open = swingT >= 0 && swingT < 0.35 ? 1 - clamp01((swingT - 0.25) / 0.1) : 0;
      const close = (kind ? 0.95 : 0.35) * (1 - open);
      for (const f of fingers) f.bone.quaternion.copy(f.rest);
      curl(body, 'R', space, 0.62 * close, 0.5 * close);
      // The whole arm kicks back a touch on the release.
      group.position.set(0, -recoil * 0.02, recoil * 0.04);
      for (const k in holds) holds[k].visible = k === kind && (swingT < 0 || swingT > 0.5) && !stunned;
      group.visible = true;
    },
    dispose() {
      if (body) disposeBody(body);
      group.traverse((o) => {
        if (o.isSkinnedMesh || o.userData.shared) return;
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
      hotMat?.dispose();
      hotMat = null;
    },
  };
}
