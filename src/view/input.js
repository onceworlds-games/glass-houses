// Keys, mouse and touch, turned into what a body reads: where you look, which way you move, whether you're winding up or repairing.
// The mouse is locked only from a click in the world, and only while playing; if a browser refuses, dragging aims instead.

const PITCH_MIN = (-35 * Math.PI) / 180;
const PITCH_MAX = (70 * Math.PI) / 180;

export function createInput(canvas, opts = {}) {
  const I = {
    yaw: 0,
    pitch: 0.12,
    mx: 0,
    mz: 0,
    throwHeld: false,
    repair: false,
    locked: false,
    lockFailed: false,
    refusedAt: -1e9,
    active: false,
    touch: false,
    usedThrow: false,
    usedRepair: false,
    onEsc: null,
    onLockChange: null,
  };
  const keys = new Set();
  let mouseHeld = false;
  let spaceHeld = false;
  let drag = null;
  const aimTouches = new Map();
  let lockAskedAt = -1e9;
  let hadLock = false;
  let refusals = 0;
  // A browser that refuses twice keeps refusing: from then on, dragging aims.
  const refused = (name) => {
    const now = performance.now();
    // One refusal can arrive twice (the promise and the pointerlockerror event).
    if (now - I.refusedAt > 50) refusals++;
    I.refusedAt = now;
    if (name === 'NotSupportedError' || name === 'SecurityError' || refusals >= 2) I.lockFailed = true;
  };

  const clampPitch = () => {
    I.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, I.pitch));
  };

  function look(dx, dy, sens) {
    I.yaw -= dx * sens;
    I.pitch -= dy * sens;
    clampPitch();
  }

  function moveFromKeys() {
    let x = 0;
    let z = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
    I.mx = x;
    I.mz = z;
  }

  function updateThrow() {
    I.throwHeld = I.active && (mouseHeld || spaceHeld || !!drag?.winding);
    if (I.throwHeld) I.usedThrow = true;
  }

  // ---------------------------------------------------------------- keyboard
  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const code = e.code || '';
    if (code === 'Escape') {
      if (!I.locked) I.onEsc?.();
      return;
    }
    if (!I.active) {
      if ((code === 'Space' || code === 'Enter') && !e.repeat) opts.onConfirm?.(e);
      return;
    }
    if (code === 'Space' || e.key === ' ') {
      if (!e.repeat) spaceHeld = true;
      e.preventDefault();
    } else if (code === 'KeyR' || e.key === 'r' || e.key === 'R') {
      I.repair = true;
      I.usedRepair = true;
    } else keys.add(code);
    moveFromKeys();
    updateThrow();
  };
  const onKeyUp = (e) => {
    const code = e.code || '';
    if (code === 'Space' || e.key === ' ') spaceHeld = false;
    else if (code === 'KeyR' || e.key === 'r' || e.key === 'R') I.repair = false;
    else keys.delete(code);
    moveFromKeys();
    updateThrow();
  };

  // ---------------------------------------------------------------- pointer lock
  const lockSupported = () => typeof canvas.requestPointerLock === 'function' && !I.touch;

  I.requestLock = function requestLock() {
    if (!lockSupported() || I.lockFailed || I.locked) return false;
    const now = performance.now();
    if (now - lockAskedAt < 300) return false;
    lockAskedAt = now;
    try {
      const p = canvas.requestPointerLock({ unadjustedMovement: false });
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          refused(err?.name ?? '');
          I.onLockChange?.(false, 'refused');
        });
      }
    } catch (err) {
      refused(err?.name ?? '');
    }
    return true;
  };

  I.releaseLock = function releaseLock() {
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch {
      /* not locked */
    }
  };

  const onLockChange = () => {
    const was = I.locked;
    I.locked = document.pointerLockElement === canvas;
    if (I.locked) {
      hadLock = true;
      refusals = 0;
    }
    if (was && !I.locked) {
      mouseHeld = false;
      updateThrow();
      // A lock the player had and lost is Esc: the menu opens.
      if (hadLock && I.active) I.onEsc?.();
    }
    I.onLockChange?.(I.locked, 'change');
  };
  const onLockError = () => {
    refused('');
    I.onLockChange?.(false, 'refused');
  };

  // ---------------------------------------------------------------- mouse and touch
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch') {
      I.touch = true;
      if (!I.active) return;
      // Aim with a finger anywhere but the platform's stick and buttons.
      if (opts.blocked?.(e.clientX, e.clientY)) return;
      aimTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* fine */
      }
      return;
    }
    if (!I.active || e.button !== 0) return;
    if (I.locked) {
      mouseHeld = true;
      updateThrow();
      return;
    }
    // Ask for the lock first; where it is refused, press-drag-release throws (and the lock is asked again now and then).
    if (I.lockFailed && performance.now() - I.refusedAt > 20000 && lockSupported()) {
      I.lockFailed = false;
      refusals = 0;
    }
    if (!I.lockFailed && performance.now() - I.refusedAt > 1500 && I.requestLock()) return;
    drag = { x: e.clientX, y: e.clientY, winding: true };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
    updateThrow();
  };
  const onPointerMove = (e) => {
    if (e.pointerType === 'touch') {
      const t = aimTouches.get(e.pointerId);
      if (!t || !I.active) return;
      const w = Math.max(320, window.innerWidth);
      look(e.clientX - t.x, e.clientY - t.y, 2.6 / w);
      t.x = e.clientX;
      t.y = e.clientY;
      return;
    }
    if (!I.active) return;
    if (I.locked) {
      look(e.movementX || 0, e.movementY || 0, opts.sensitivity ?? 0.0022);
    } else if (drag) {
      look(e.clientX - drag.x, e.clientY - drag.y, 0.0042);
      drag.x = e.clientX;
      drag.y = e.clientY;
    }
  };
  const onPointerUp = (e) => {
    if (e.pointerType === 'touch') {
      aimTouches.delete(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    mouseHeld = false;
    drag = null;
    updateThrow();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('pointerlockerror', onLockError);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const onBlur = () => {
    keys.clear();
    mouseHeld = false;
    spaceHeld = false;
    drag = null;
    I.repair = false;
    moveFromKeys();
    updateThrow();
  };
  window.addEventListener('blur', onBlur);

  /** Play on or off: off lets go of everything and frees the mouse. */
  I.setActive = function setActive(on) {
    if (I.active === on) return;
    I.active = on;
    if (!on) {
      onBlur();
      aimTouches.clear();
      I.releaseLock();
      hadLock = false;
    }
  };

  /** Copies the controls into a body's input. stick: the platform's analog stick, when it has one. */
  I.apply = function apply(inp, stick) {
    updateThrow();
    inp.yaw = I.yaw;
    inp.pitch = I.pitch;
    let mx = I.mx;
    let mz = I.mz;
    if (stick && (stick.x || stick.y)) {
      mx += stick.x;
      mz -= stick.y;
    }
    inp.mx = mx;
    inp.mz = mz;
    inp.throwHeld = I.throwHeld;
    inp.releasePower = null;
    inp.repair = I.repair && I.active;
  };

  I.face = function face(yaw, pitch = 0.12) {
    I.yaw = yaw;
    I.pitch = pitch;
  };

  return I;
}
