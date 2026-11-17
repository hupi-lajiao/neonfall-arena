import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../game/src/game.js';
import { keys, touch, mouse, moveVector, firing } from '../game/src/input.js';
import { rollChoices, UPGRADES } from '../game/src/upgrades.js';

function resetInput() {
  keys.clear();
  mouse.down = false;
  mouse.x = 0;
  mouse.y = 0;
  touch.movePointerId = null;
  touch.aimPointerId = null;
  touch.moveX = 0;
  touch.moveY = 0;
  touch.joystickActive = false;
  touch.fire = false;
}

beforeEach(resetInput);

function travelDistance(fps) {
  const game = new Game();
  game.w = 10000;
  game.h = 1000;
  game.player.x = 5000;
  game.player.y = 500;
  keys.add('KeyD');
  for (let i = 0; i < fps; i++) game.updatePlayer(1 / fps);
  return game.player.x - 5000;
}

test('player movement is nearly frame-rate independent', () => {
  const at60 = travelDistance(60);
  resetInput();
  const at120 = travelDistance(120);
  assert.ok(Math.abs(at60 - at120) < 2, `60 FPS moved ${at60}px; 120 FPS moved ${at120}px`);
});

test('resize recentres the player and existing world objects', () => {
  const game = new Game();
  const enemy = { x: 900, y: 500 };
  const shard = { x: 1000, y: 600 };
  game.enemies.push(enemy);
  game.shards.push(shard);
  game.resize(800, 600);
  assert.deepEqual([game.player.x, game.player.y], [400, 300]);
  assert.deepEqual([enemy.x, enemy.y], [660, 440]);
  assert.deepEqual([shard.x, shard.y], [760, 540]);
});

test('keyboard and touch movement combine without exceeding unit speed', () => {
  keys.add('KeyD');
  touch.moveX = 0.6;
  touch.moveY = 0.8;
  const vector = moveVector();
  assert.ok(Math.abs(Math.hypot(vector.x, vector.y) - 1) < 1e-9);
});

test('touch hold fires', () => {
  touch.fire = true;
  assert.equal(firing(), true);
});

test('upgrade rolls contain distinct entries', () => {
  const choices = rollChoices(3);
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map((choice) => choice.id)).size, 3);
  assert.ok(choices.every((choice) => UPGRADES.includes(choice)));
});
