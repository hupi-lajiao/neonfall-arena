// NEONFALL ARENA — keyboard and mouse state. The game polls `keys` and `mouse`
// each frame; discrete events (start, pause, mute, upgrade picks) are delivered
// through one-shot callback hooks the game registers.

export const keys = new Set();
export const mouse = { x: 0, y: 0, down: false };

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

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    const action = ACTION_KEYS[e.code];
    if (action && !e.repeat && hooks.onAction) hooks.onAction(action);
    // Space doubles as "start / confirm" on menu screens.
    if (e.code === 'Space' && !e.repeat && hooks.onAction) hooks.onAction('start');
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (e.button === 0) {
      mouse.down = true;
      if (hooks.onClick) hooks.onClick(e.clientX, e.clientY);
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
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
  if (x !== 0 && y !== 0) { const inv = Math.SQRT1_2; x *= inv; y *= inv; }
  return { x, y };
}

export function firing() {
  return mouse.down || keys.has('Space');
}
