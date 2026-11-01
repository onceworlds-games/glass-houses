// The street on screen: its buildings and light, the glass, the six neighbours and everything in the air, drawn from a round.
// The page, the title's attract round and the posters all draw through this.

import { buildStreet } from './street.js';
import { createGlass } from './glass.js';
import { makeFigure } from './people.js';
import { createFx } from './fx.js';
import { buildField, STREETS } from '../core/streets.js';
import { glassCount } from '../core/round.js';

export function createWorld(stage) {
  const scene = stage.scene;
  const W = {
    index: -1,
    quality: '',
    field: null,
    street: null,
    glass: null,
    fx: createFx(scene, stage.quality),
    figures: [],
    personas: [],
    me: -1,
    hideMe: true,
    /** The round is over: the ghosts go home (they'd float in front of the winner's house). */
    ghostsOff: false,
  };

  // Stones coming at this player get a red trail.
  let drawn = null;
  const incoming = (s) => {
    const me = W.me;
    if (me < 0 || !drawn) return false;
    return ((s.pred === 'glass' || s.pred === 'frame') && s.predHouse === me) || (s.pred === 'body' && s.predBody === me);
  };

  /** Builds street i (once: the same street again keeps what is there). */
  W.setStreet = function setStreet(i, quality = stage.quality) {
    if (W.index === i && W.quality === quality && W.street) return false;
    if (W.street) {
      scene.remove(W.street.root);
      W.street.dispose();
    }
    W.glass?.dispose();
    W.index = i;
    W.quality = quality;
    W.field = buildField(i);
    W.street = buildStreet(W.field, quality);
    scene.add(W.street.root);
    W.glass = createGlass(W.field, scene, quality);
    const light = STREETS[i].light;
    stage.setLight(light, W.field.R);
    W.fx.setField(W.field, light === 'snow');
    // The street itself into every pane's reflection: the houses across, the palms, the sky.
    W.street.update(0, 0, { x: 1, z: 0, s: 0.5 });
    stage.captureStreet([W.glass.group, W.fx.group, ...W.figures.flatMap((f) => [f.root, f.ghost])]);
    return true;
  };

  /** Who lives where: a persona per house ('player' for a person). */
  W.cast = function cast(personas) {
    for (let i = 0; i < 6; i++) {
      const p = personas[i] ?? 'player';
      if (W.personas[i] === p && W.figures[i]) continue;
      const old = W.figures[i];
      if (old) {
        scene.remove(old.root, old.ghost);
        old.dispose();
      }
      const f = makeFigure(i, p);
      scene.add(f.root, f.ghost);
      W.figures[i] = f;
      W.personas[i] = p;
    }
  };

  /** A new round on the same street: shards swept, stones gone. */
  W.sweep = function sweep() {
    W.glass?.clear();
    W.fx.clear();
  };

  /** Draws round R. t: page ms; me: this player's house (hidden in first person) or -1. */
  W.draw = function draw(R, dt, t, wind) {
    drawn = R;
    const st = W.street;
    W.glass.sync(R.houses);
    for (let i = 0; i < R.houses.length; i++) {
      const h = R.houses[i];
      const n = glassCount(h.panes);
      const out = h.outAt >= 0 || n === 0;
      st.setNumber(i, out ? 0 : n, out);
      st.setLit(i, !out);
    }
    for (let i = 0; i < W.figures.length; i++) {
      const b = R.bodies[i];
      if (b) {
        W.figures[i].update(b, R.now, dt, i === W.me && W.hideMe);
        if (W.ghostsOff) W.figures[i].ghost.visible = false;
      } else W.figures[i].root.visible = W.figures[i].ghost.visible = false;
    }
    W.fx.stones(R.stones, t, incoming);
    W.fx.specials(R.specials, R.now);
    st.store.set(R.storeOpen());
    st.update(dt, t / 1000, wind);
    W.fx.update(dt, t, wind);
    W.glass.setScale((stage.height * stage.pixelRatio) / (2 * Math.tan((stage.camera.fov * Math.PI) / 360)));
    W.glass.update(dt);
  };

  return W;
}
