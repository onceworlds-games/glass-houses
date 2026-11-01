// Every number the rules use, in one place. Distances in metres, times in milliseconds unless the name says seconds.

export const TICK_HZ = 120;
export const TICK_MS = 1000 / TICK_HZ;
export const DT = 1 / TICK_HZ;
export const G = 9.8;

export const ROUND_MS = 180000;
export const STORE_CLOSE_MS = 90000;
export const ROUND_SECONDS = ROUND_MS / 1000;

// A house's front: 10 columns by 2 storeys of panes in steel mullions, on a plinth.
export const COLS = 10;
export const ROWS = 2;
export const PANES = COLS * ROWS;
export const PANE_W = 1.2;
export const PANE_H = 2.0;
export const MULLION = 0.1;
export const PLINTH = 0.5;
export const FACADE_W = COLS * PANE_W + (COLS + 1) * MULLION; // 13.1
export const FACADE_H = ROWS * PANE_H + (ROWS + 1) * MULLION; // 4.3
export const HOUSE_DEPTH = 11;
export const ROOF_Y = PLINTH + FACADE_H + 0.05; // underside of the roof slab
export const ROOF_T = 0.4;
export const ROOF_OVER = 1.6; // the cantilever in front of the glass
export const ALL_GLASS = (1 << PANES) - 1;

// Pane states.
export const BROKEN = 0;
export const CRACKED = 1;
export const GLASS = 2;

// What can be thrown. vmin/vmax: speed at no wind-up and at full.
export const KINDS = {
  stone: { r: 0.12, vmin: 14, vmax: 30 },
  brick: { r: 0.16, vmin: 12, vmax: 22 },
  gnome: { r: 0.18, vmin: 14, vmax: 30 },
  pebble: { r: 0.08, vmin: 7, vmax: 15 },
};
export const KIND_IDS = ['stone', 'brick', 'gnome', 'pebble'];

export const WIND_UP_MS = 900;
export const AMMO_MAX = 5;
export const AMMO_REFILL_MS = 800;
export const REPAIR_MS = 2500;
export const STUN_MS = 1000;
export const IMMUNE_MS = 500;
export const STRAFE = 4.0;
export const ACCEL = 30;
export const ICE_ACCEL = 8;
export const EYE = 1.6;
export const BODY_R = 0.35;
export const BODY_TOP = 1.75;
export const BODY_BOTTOM = 0.15;
export const INTERCEPT_R = 0.45;
export const HAND = { right: 0.35, down: 0.15, fwd: 0.3 };

export const GHOST_SPEED = 5;
export const GHOST_Y = 3.5;
export const GHOST_R = 0.6;
export const PEBBLES_MAX = 3;
export const PEBBLE_REFILL_MS = 2500;
export const POOF_MS = 2000;

export const SPECIAL_FIRST_MS = 25000;
export const SPECIAL_LAST_MS = 150000;
export const SPECIAL_LIFE_MS = 15000;
export const SPECIAL_DROP_MS = 900;
export const PICKUP_R = 1.15;

export const WIND_ROUND1 = 0.3;
export const WIND_LATE = 1.6;

// How far back a late throw is replayed against other stones, and how long a stone that ended is remembered for it.
export const HISTORY_TICKS = 60;
export const LATE_MAX_MS = 1500;

export const MAX_STONES = 96;
export const STONE_MAX_MS = 6000;

export const SEATS = 6;
export const POINTS = [3, 2, 1];
export const ROUND_OPTIONS = [1, 3, 5];

// Ladder stars: a round win, with this many panes left.
export const STAR_PANES = [0, 8, 15];

export function powerAt(holdMs) {
  const x = Math.min(1, Math.max(0, holdMs / WIND_UP_MS));
  return 1 - (1 - x) * (1 - x);
}

export function holdFor(power) {
  const p = Math.min(1, Math.max(0, power));
  return (1 - Math.sqrt(1 - p)) * WIND_UP_MS;
}

export function speedOf(kind, power) {
  const k = KINDS[kind] ?? KINDS.stone;
  return k.vmin + (k.vmax - k.vmin) * Math.min(1, Math.max(0, power));
}
