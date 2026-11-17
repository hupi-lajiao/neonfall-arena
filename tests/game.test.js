import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../game/src/game.js';
import { keys, touch, mouse, moveVector, firing } from '../game/src/input.js';
import { rollChoices, UPGRADES } from '../game/src/upgrades.js';
import { createEnemy, createItem } from '../game/src/entities.js';
import { DIFFICULTIES, ENEMY_TYPES, WAVES, ITEMS } from '../game/src/config.js';

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

test('upgrade pool has twelve distinct cards', () => {
  assert.equal(UPGRADES.length, 12);
  assert.equal(new Set(UPGRADES.map((u) => u.id)).size, 12);
});

test('difficulty scales spawned enemy hp, speed and score', () => {
  const game = new Game();
  game.setDifficulty('hard');
  assert.equal(game.scoreScale(), DIFFICULTIES.hard.scoreScale);
  game.startRun();
  for (let i = 0; i < 90 && game.enemies.length === 0; i++) game.update(1 / 60);
  assert.ok(game.enemies.length > 0, 'an enemy should have spawned');
  const e = game.enemies[0];
  const def = ENEMY_TYPES[e.type];
  const expectedHp = Math.max(1, Math.round(def.hp * WAVES.hpScale(1) * DIFFICULTIES.hard.hpScale));
  assert.equal(e.maxHp, expectedHp);
  assert.ok(e.speed >= def.speed * DIFFICULTIES.hard.speedScale * 0.9 - 1e-9, 'speed scaled up');
  assert.ok(e.speed <= def.speed * DIFFICULTIES.hard.speedScale * 1.1 + 1e-9, 'speed within jitter band');
  game.setDifficulty('easy');
  assert.equal(game.scoreScale(), DIFFICULTIES.easy.scoreScale);
  game.setDifficulty('normal');
  assert.equal(game.scoreScale(), 1);
});

test('shooter fires projectiles at the player', () => {
  const game = new Game();
  game.mode = 'playing';
  const p = game.player;
  const s = createEnemy('shooter', p.x + 300, p.y, 1, 1);
  s.fireTimer = 0;
  game.enemies.push(s);
  game.updateEnemies(1 / 60);
  assert.equal(game.ebullets.length, 1);
  assert.ok(game.ebullets[0].vx < 0, 'projectile should travel toward the player');
});

test('bomber explosion damages nearby enemies and consumes the bomber', () => {
  const game = new Game();
  game.mode = 'playing';
  const p = game.player;
  p.invuln = 99; // keep the player out of this assertion
  const bomber = createEnemy('bomber', p.x + 50, p.y, 1, 1);
  const bystander = createEnemy('chaser', p.x + 100, p.y, 1, 1);
  game.enemies.push(bomber, bystander);
  for (let i = 0; i < 20; i++) game.updateEnemies(0.1);
  assert.ok(!game.enemies.includes(bomber), 'bomber should be gone after exploding');
  assert.ok(!game.enemies.includes(bystander), 'bystander chaser (3 HP) should die to the blast');
  assert.ok(game.kills >= 2, 'both deaths are credited');
});

test('medkit pickup heals the player and is consumed', () => {
  const game = new Game();
  game.mode = 'playing';
  game.player.hp = 50;
  game.items.push(createItem('medkit', game.player.x, game.player.y));
  game.updateItems(1 / 60);
  assert.equal(game.player.hp, 50 + ITEMS.medkitHeal);
  assert.equal(game.items.length, 0);
});

test('rapid pickup grants the rapid-fire buff', () => {
  const game = new Game();
  game.mode = 'playing';
  game.items.push(createItem('rapid', game.player.x, game.player.y));
  game.updateItems(1 / 60);
  assert.equal(game.player.rapidTimer, ITEMS.rapidTime);
  assert.equal(game.items.length, 0);
});
