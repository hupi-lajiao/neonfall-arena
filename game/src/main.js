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
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  game.resize(width, height);
  renderer.resize(width, height, dpr);
}
window.addEventListener('resize', resize);
resize();

initInput(canvas, () => game.mode);
hooks.onAction = (name) => {
  sfx.init(); // first keypress unlocks WebAudio
  if (name === 'mute') {
    const muted = sfx.toggleMute();
    status.textContent = muted ? '已静音。' : '声音已开启。';
    return;
  }
  game.action(name);
};
hooks.onClick = (x, y) => {
  sfx.init(); // first click unlocks WebAudio
  game.click(x, y);
};

status.textContent = 'NEONFALL ARENA 霓虹竞技场。选择难度后点击或按回车开始。';

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
