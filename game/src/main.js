// NEONFALL ARENA — bootstrap. Wires the canvas, input, sound and game loop
// together and keeps the canvas sized to the window.

import { Game } from './game.js';
import { Renderer } from './render.js';
import { initInput, hooks } from './input.js';
import { sfx } from './audio.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');

const game = new Game();
const renderer = new Renderer(canvas);

game.onAnnounce = (text) => { status.textContent = text; };

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  game.w = canvas.width;
  game.h = canvas.height;
  renderer.resize(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

initInput(canvas);
hooks.onAction = (name) => {
  sfx.init(); // first keypress unlocks WebAudio
  if (name === 'mute') {
    const muted = sfx.toggleMute();
    status.textContent = muted ? 'Sound muted.' : 'Sound on.';
    return;
  }
  game.action(name);
};
hooks.onClick = (x, y) => {
  sfx.init(); // first click unlocks WebAudio
  game.click(x, y);
};

status.textContent = 'NEONFALL ARENA. Click or press Enter to start.';

let last = performance.now();
function frame(now) {
  // Clamp the step so a stalled tab does not teleport the world.
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;
  game.update(dt);
  renderer.draw(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
