// NEONFALL ARENA — keyboard, mouse and touch input. The game polls these
// states each frame; discrete menu actions are delivered through callback hooks.

export const keys = new Set();
export const mouse = { x: 0, y: 0, down: false };
export const touch = {
  movePointerId: null,
  aimPointerId: null,
  originX: 0,
  originY: 0,
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  joystickActive: false,
  fire: false,
};

// Callback hooks, assigned by the game: onAction(name) for discrete key presses
// ('start', 'pause', 'mute', 'restart', 'pick1' | 'pick2' | 'pick3'), and
// onClick(x, y) for mouse presses (UI buttons and cards).
export const hooks = { onAction: null, onClick: null };

const ACTION_KEYS = {
  Enter: 'start',
  KeyP: 'pause',
  Escape: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
  Digit1: 'pick1',
  Digit2: 'pick2',
  Digit3: 'pick3',
  Numpad1: 'pick1',
  Numpad2: 'pick2',
  Numpad3: 'pick3',
};

export function initInput(canvas, getMode = () => 'playing') {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    const action = ACTION_KEYS[e.code];
    if (action && !e.repeat && hooks.onAction) hooks.onAction(action);
    // Space doubles as "start / confirm" on menu screens.
    if (e.code === 'Space' && !e.repeat && hooks.onAction) hooks.onAction('start');
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
    touch.movePointerId = null;
    touch.aimPointerId = null;
    touch.moveX = 0;
    touch.moveY = 0;
    touch.joystickActive = false;
    touch.fire = false;
  });

  const point = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, width: rect.width };
  };
  const capture = (e) => {
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer may already be inactive */ }
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    const p = point(e);
    if (e.pointerType === 'mouse') {
      mouse.x = p.x;
      mouse.y = p.y;
      if (e.button === 0) {
        mouse.down = true;
        if (hooks.onClick) hooks.onClick(p.x, p.y);
      }
      capture(e);
      return;
    }

    e.preventDefault();
    capture(e);
    if (getMode() !== 'playing') {
      if (hooks.onClick) hooks.onClick(p.x, p.y);
      return;
    }

    // Left half: floating movement stick. Right half: drag to aim and hold to fire.
    if (touch.movePointerId === null && p.x < p.width / 2) {
      touch.movePointerId = e.pointerId;
      touch.originX = p.x;
      touch.originY = p.y;
      touch.moveX = 0;
      touch.moveY = 0;
      touch.joystickActive = true;
    } else if (touch.aimPointerId === null) {
      touch.aimPointerId = e.pointerId;
      touch.aimX = p.x;
      touch.aimY = p.y;
      touch.fire = true;
      mouse.x = p.x;
      mouse.y = p.y;
    } else if (touch.movePointerId === null) {
      touch.movePointerId = e.pointerId;
      touch.originX = p.x;
      touch.originY = p.y;
      touch.moveX = 0;
      touch.moveY = 0;
      touch.joystickActive = true;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = point(e);
    if (e.pointerType === 'mouse') {
      mouse.x = p.x;
      mouse.y = p.y;
    }
    if (e.pointerId === touch.movePointerId) {
      const dx = p.x - touch.originX;
      const dy = p.y - touch.originY;
      const distance = Math.hypot(dx, dy);
      const radius = 52;
      const scale = distance > radius ? radius / distance : 1;
      touch.moveX = (dx * scale) / radius;
      touch.moveY = (dy * scale) / radius;
    }
    if (e.pointerId === touch.aimPointerId) {
      touch.aimX = p.x;
      touch.aimY = p.y;
      mouse.x = p.x;
      mouse.y = p.y;
    }
  });

  const release = (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) mouse.down = false;
    if (e.pointerId === touch.movePointerId) {
      touch.movePointerId = null;
      touch.moveX = 0;
      touch.moveY = 0;
      touch.joystickActive = false;
    }
    if (e.pointerId === touch.aimPointerId) {
      touch.aimPointerId = null;
      touch.fire = false;
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Movement vector from WASD / arrow keys, normalized. Screen coordinates:
// x right, y down.
export function moveVector() {
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  x += touch.moveX;
  y += touch.moveY;
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  return { x, y };
}

export function firing() {
  return mouse.down || touch.fire || keys.has('Space');
}
