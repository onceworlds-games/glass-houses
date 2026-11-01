// The people on the lawns: rounded low-poly figures in their house colour, each neighbour with a look of their own, the throwing arm
// that winds back and snaps through, stars when bonked, a ghost when their house is out. And this player's own arm in first person.

import * as THREE from 'three';
import { createBuilder } from './build.js';
import { OWNERS } from './palette.js';

const SKINS = ['#F1C9A5', '#D9A47E', '#B9805A', '#8D5A3B', '#F5D6B8', '#C68F6A'];

/** The things you can throw, as meshes: a stone, a brick, a garden gnome (and a ghost's pebble). */
export function heldMesh(kind) {
  if (kind === 'brick') {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.15), new THREE.MeshStandardMaterial({ color: '#B4513A', roughness: 0.95 }));
    b.castShadow = true;
    g.add(b);
    return g;
  }
  if (kind === 'gnome') {
    const B = createBuilder();
    const I = new THREE.Matrix4();
    const body = new THREE.CylinderGeometry(0.1, 0.13, 0.2, 8);
    body.translate(0, 0.1, 0);
    B.add('g', body, I, '#3563B8');
    const head = new THREE.SphereGeometry(0.075, 10, 8);
    head.translate(0, 0.25, 0);
    B.add('g', head, I, '#F1C9A5');
    const beard = new THREE.ConeGeometry(0.07, 0.13, 8);
    beard.rotateX(Math.PI);
    beard.translate(0, 0.18, -0.045);
    B.add('g', beard, I, '#F7F2E8');
    const hat = new THREE.ConeGeometry(0.085, 0.2, 8);
    hat.translate(0, 0.38, 0);
    B.add('g', hat, I, '#D93A2F');
    const g = B.build({ g: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }) });
    g.children[0].position.y = -0.18;
    return g;
  }
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.DodecahedronGeometry(kind === 'pebble' ? 0.08 : 0.12, 0), new THREE.MeshStandardMaterial({ color: kind === 'pebble' ? '#C8D7E6' : '#8E867C', roughness: 0.9, flatShading: true }));
  s.scale.set(1, 0.82, 1.1);
  s.castShadow = true;
  g.add(s);
  return g;
}

function addFace(B, I, skin, y) {
  const head = new THREE.SphereGeometry(0.17, 14, 10);
  head.translate(0, y, 0);
  B.add('skin', head, I, skin);
  for (const s of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.025, 6, 4);
    eye.translate(s * 0.06, y + 0.03, -0.155);
    B.add('cloth', eye, I, '#2A2238');
  }
}

/** One figure. persona: a neighbour's id or 'player'. */
export function makeFigure(seat, persona, scale = 1) {
  const owner = OWNERS[seat % OWNERS.length];
  const skin = SKINS[(seat * 7 + (persona?.length ?? 0)) % SKINS.length];
  const B = createBuilder();
  const I = new THREE.Matrix4();
  const shirt = persona === 'twins' ? owner.color : owner.color;
  const pants = persona === 'bev' ? '#F2A7C3' : persona === 'chad' ? '#3A4A6A' : '#4A4250';
  // Legs.
  for (const s of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.075, 0.07, 0.8, 8);
    leg.translate(s * 0.1, 0.4, 0);
    B.add('cloth', leg, I, pants);
    const shoe = new THREE.BoxGeometry(0.13, 0.08, 0.24);
    shoe.translate(s * 0.1, 0.04, -0.04);
    B.add('cloth', shoe, I, persona === 'sunny' ? '#F7F2E8' : '#2A2238');
    if (persona === 'sunny') {
      for (const z of [-0.12, 0.06]) {
        const w = new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8);
        w.rotateZ(Math.PI / 2);
        w.translate(s * 0.1, 0.0, z);
        B.add('cloth', w, I, '#FF5A8A');
      }
    }
  }
  // Torso: a rounded block in the owner's colour.
  const torso = new THREE.CapsuleGeometry(0.2, 0.42, 4, 10);
  torso.scale(1.05, 1, 0.75);
  torso.translate(0, 1.12, 0);
  B.add('cloth', torso, I, persona === 'bev' ? '#F2A7C3' : shirt);
  if (persona === 'twins') {
    for (const y of [0.98, 1.12, 1.26]) {
      const band = new THREE.CylinderGeometry(0.212, 0.212, 0.05, 12);
      band.scale(1.05, 1, 0.75);
      band.translate(0, y, 0);
      B.add('cloth', band, I, '#F7F2E8');
    }
  }
  if (persona === 'ray' || persona === 'rosa') {
    const apron = new THREE.BoxGeometry(0.3, 0.55, 0.02);
    apron.translate(0, 0.98, -0.16);
    B.add('cloth', apron, I, persona === 'ray' ? '#C8553D' : '#7FA06A');
  }
  if (persona === 'bev') {
    const robe = new THREE.CylinderGeometry(0.23, 0.3, 0.55, 10);
    robe.translate(0, 0.72, 0);
    B.add('cloth', robe, I, '#F2A7C3');
    const stripe = new THREE.BoxGeometry(0.08, 0.5, 0.02);
    stripe.translate(0, 1.15, -0.155);
    B.add('cloth', stripe, I, owner.color);
  }
  // The other arm, hanging.
  const arm = new THREE.CylinderGeometry(0.055, 0.05, 0.58, 8);
  arm.translate(-0.27, 1.05, 0);
  B.add('cloth', arm, I, persona === 'chad' ? skin : shirt);
  const hand = new THREE.SphereGeometry(0.06, 8, 6);
  hand.translate(-0.27, 0.74, 0);
  B.add('skin', hand, I, skin);
  addFace(B, I, skin, 1.6);
  // Hair and hats.
  const top = new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  top.translate(0, 1.62, 0.01);
  if (persona === 'walt') {
    const cap = new THREE.CylinderGeometry(0.19, 0.19, 0.08, 14);
    cap.translate(0, 1.74, 0.0);
    B.add('cloth', cap, I, '#7A6A55');
    const brim = new THREE.BoxGeometry(0.2, 0.03, 0.14);
    brim.translate(0, 1.72, -0.2);
    B.add('cloth', brim, I, '#7A6A55');
    const tache = new THREE.BoxGeometry(0.13, 0.035, 0.03);
    tache.translate(0, 1.55, -0.165);
    B.add('cloth', tache, I, '#D8D2C8');
  } else if (persona === 'lindqvist' || persona === 'rosa') {
    const brim = new THREE.CylinderGeometry(0.36, 0.36, 0.03, 18);
    brim.translate(0, 1.73, 0);
    B.add('cloth', brim, I, persona === 'rosa' ? '#E3C98A' : '#F7F2E8');
    const crown = new THREE.CylinderGeometry(0.15, 0.18, 0.14, 14);
    crown.translate(0, 1.8, 0);
    B.add('cloth', crown, I, persona === 'rosa' ? '#E3C98A' : '#F7F2E8');
    if (persona === 'lindqvist') {
      for (const s of [-1, 1]) {
        const lens = new THREE.TorusGeometry(0.04, 0.012, 4, 10);
        lens.translate(s * 0.065, 1.63, -0.17);
        B.add('cloth', lens, I, '#2A2238');
      }
    }
  } else if (persona === 'chad') {
    B.add('cloth', top, I, '#C99A4A');
    const band = new THREE.TorusGeometry(0.172, 0.025, 6, 16);
    band.rotateX(Math.PI / 2);
    band.translate(0, 1.68, 0);
    B.add('cloth', band, I, '#E8645A');
  } else if (persona === 'sunny') {
    B.add('cloth', top, I, '#2A2238');
    const visor = new THREE.CylinderGeometry(0.19, 0.19, 0.04, 14, 1, true);
    visor.translate(0, 1.7, 0);
    B.add('cloth', visor, I, '#2BB7B3');
    const bill = new THREE.BoxGeometry(0.24, 0.02, 0.16);
    bill.translate(0, 1.69, -0.22);
    B.add('cloth', bill, I, '#2BB7B3');
  } else if (persona === 'bev') {
    B.add('cloth', top, I, '#B0715A');
    for (let k = 0; k < 5; k++) {
      const c = new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8);
      c.rotateZ(Math.PI / 2);
      c.translate(0, 1.72 + (k % 2) * 0.04, -0.1 + k * 0.05);
      B.add('cloth', c, I, k % 2 ? '#7CC6E8' : '#FFB547');
    }
  } else {
    B.add('cloth', top, I, ['#3A2A20', '#7A4A2A', '#D9B26A', '#1E1A22', '#A0522D', '#5A3A2A'][seat % 6]);
  }
  const mats = {
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
    skin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
  };
  const body = B.build(mats);
  const root = new THREE.Group();
  root.add(body);

  // The throwing arm: a pivot at the right shoulder.
  const shoulder = new THREE.Group();
  shoulder.position.set(0.27, 1.32, 0);
  const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.58, 8), new THREE.MeshStandardMaterial({ color: persona === 'chad' ? skin : persona === 'bev' ? '#F2A7C3' : shirt, roughness: 0.75 }));
  armMesh.position.y = -0.27;
  armMesh.castShadow = true;
  shoulder.add(armMesh);
  const handMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 }));
  handMesh.position.y = -0.58;
  shoulder.add(handMesh);
  const holds = { stone: heldMesh('stone'), brick: heldMesh('brick'), gnome: heldMesh('gnome') };
  for (const k in holds) {
    holds[k].position.y = -0.66;
    holds[k].visible = false;
    shoulder.add(holds[k]);
  }
  root.add(shoulder);

  // Bonk stars.
  const stars = new THREE.Group();
  const starMat = new THREE.MeshBasicMaterial({ color: '#FFD45A' });
  for (let k = 0; k < 3; k++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), starMat);
    s.position.set(Math.cos((k / 3) * Math.PI * 2) * 0.28, 0, Math.sin((k / 3) * Math.PI * 2) * 0.28);
    stars.add(s);
  }
  stars.position.y = 1.95;
  stars.visible = false;
  root.add(stars);

  // A second twin, for show.
  let twin = null;
  if (persona === 'twins') {
    root.scale.setScalar(0.78);
    twin = body.clone();
    twin.position.set(0.85, 0, 0.25);
    root.add(twin);
  }
  if (scale !== 1) root.scale.multiplyScalar(scale);

  // Ghost: a sheet in the owner's colour.
  const ghost = new THREE.Group();
  const gm = new THREE.MeshStandardMaterial({ color: owner.color, transparent: true, opacity: 0.55, emissive: new THREE.Color(owner.color), emissiveIntensity: 0.6, roughness: 0.4, depthWrite: false });
  const gHead = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), gm);
  const gSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.9, 16, 1, true), gm);
  gSkirt.position.y = -0.45;
  ghost.add(gHead, gSkirt);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#2A2238' }));
    eye.position.set(s * 0.17, 0.12, -0.45);
    ghost.add(eye);
  }
  ghost.visible = false;

  let swing = 0;
  let lastThrow = -1e9;
  const F = {
    root,
    ghost,
    seat,
    persona,
    /** Draws a body from the round. t: round ms. */
    update(b, t, dt, mine) {
      const show = !b.ghost && !mine && !b.skip;
      root.visible = show;
      ghost.visible = b.ghost && !mine && !b.skip;
      if (b.ghost) {
        ghost.position.set(b.gx, b.gy ?? 3.5, b.gz);
        ghost.rotation.y = b.yaw;
        ghost.position.y += Math.sin(t / 400 + seat) * 0.1;
        return;
      }
      if (!show) return;
      const speed = Math.hypot(b.vx || 0, b.vz || 0);
      root.position.set(b.x, b.y + Math.abs(Math.sin(t / 110)) * Math.min(0.06, speed * 0.02), b.z);
      root.rotation.y = b.yaw;
      // The arm: back as it winds up, through on the throw, a wipe while repairing.
      if (b.lastThrowAt > lastThrow) {
        lastThrow = b.lastThrowAt;
        swing = 1;
      }
      swing = Math.max(0, swing - dt * 4);
      let rx;
      if (b.winding) rx = -(0.6 + 1.9 * (b.power ?? 0));
      else if (swing > 0) rx = 1.3 * swing - 0.2;
      else if (b.repairing) rx = -1.4 + Math.sin(t / 120) * 0.35;
      else rx = Math.sin(t / 700 + seat) * 0.05;
      shoulder.rotation.x += (rx - shoulder.rotation.x) * Math.min(1, dt * (b.winding ? 10 : 18));
      shoulder.rotation.z = b.repairing ? Math.sin(t / 120) * 0.3 : 0;
      const held = b.held ?? (b.ammo > 0 ? 'stone' : null);
      for (const k in holds) holds[k].visible = k === held && swing < 0.5;
      stars.visible = b.stunUntil > t;
      if (stars.visible) stars.rotation.y = t / 160;
    },
    dispose() {
      root.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) o.material.dispose?.();
      });
      ghost.traverse((o) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
    },
  };
  return F;
}

/** This player's arm in first person: a sleeve in their colour and the stone (or the special) in their hand. */
export function makeArm(seat) {
  const owner = OWNERS[seat % OWNERS.length];
  const group = new THREE.Group();
  const pivot = new THREE.Group();
  group.add(pivot);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.55, 12), new THREE.MeshStandardMaterial({ color: owner.color, roughness: 0.7 }));
  sleeve.rotation.x = Math.PI / 2 - 0.35;
  sleeve.position.set(0, -0.05, 0.22);
  pivot.add(sleeve);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.05, 12), new THREE.MeshStandardMaterial({ color: '#F3E9D8', roughness: 0.7 }));
  cuff.rotation.x = Math.PI / 2 - 0.35;
  cuff.position.set(0, 0.03, -0.03);
  pivot.add(cuff);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshStandardMaterial({ color: SKINS[seat % SKINS.length], roughness: 0.6 }));
  hand.scale.set(1, 0.85, 1.15);
  hand.position.set(0, 0.06, -0.1);
  pivot.add(hand);
  const holds = { stone: heldMesh('stone'), brick: heldMesh('brick'), gnome: heldMesh('gnome'), pebble: heldMesh('pebble') };
  for (const k in holds) {
    holds[k].position.set(0, 0.13, -0.15);
    holds[k].visible = false;
    pivot.add(holds[k]);
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.renderOrder = 10;
    }
  });
  // Rest place: low on the right of the view.
  const rest = new THREE.Vector3(0.27, -0.25, -0.52);
  group.position.copy(rest);
  group.scale.setScalar(0.6);
  let swing = 0;
  let lastThrow = -1e9;
  let bob = 0;
  return {
    group,
    update(b, t, dt, ghost) {
      if (b.lastThrowAt > lastThrow) {
        lastThrow = b.lastThrowAt;
        swing = 1;
      }
      swing = Math.max(0, swing - dt * 3.2);
      bob += dt * Math.hypot(b.vx || 0, b.vz || 0) * 2.2;
      const p = b.winding ? b.power ?? 0 : 0;
      // Wind-up draws the hand back and down; the throw snaps it forward and up, then it comes back.
      const back = p * 0.22;
      const snap = swing > 0 ? Math.sin(swing * Math.PI) * 0.3 : 0;
      group.position.set(rest.x + p * 0.04, rest.y - p * 0.08 + Math.sin(bob) * 0.008 + snap * 0.12, rest.z + back * 0.6 - snap * 0.6);
      pivot.rotation.x = -p * 0.9 + snap * 1.6 + (b.repairing ? Math.sin(t / 110) * 0.25 : 0);
      pivot.rotation.z = b.repairing ? Math.sin(t / 110) * 0.4 : 0;
      const kind = ghost ? (b.pebbles > 0 ? 'pebble' : null) : (b.held ?? (b.ammo > 0 ? 'stone' : null));
      for (const k in holds) holds[k].visible = k === kind && swing < 0.35 && t >= (b.stunUntil ?? -1);
      group.visible = true;
    },
    dispose() {
      group.traverse((o) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
    },
  };
}
