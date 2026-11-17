// NEONFALL ARENA — entity factories and spawn helpers. Entities are plain
// objects kept in arrays on the game state; this module only creates them.

import { PLAYER, BULLET, ENEMY_TYPES, BOSS, CAPS, TAU } from './config.js';

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    radius: PLAYER.radius,
    hp: PLAYER.baseMaxHp,
    maxHp: PLAYER.baseMaxHp,
    speed: PLAYER.baseSpeed,
    fireRate: PLAYER.baseFireRate,
    damage: PLAYER.baseDamage,
    projectiles: 1,
    pierce: 0,
    magnet: PLAYER.baseMagnet,
    fireTimer: 0,        // seconds until the next shot is allowed
    flash: 0,            // muzzle-flash timer
    invuln: 0,           // seconds of post-hit invulnerability left
    aim: 0,              // radians, toward the mouse
    hasShield: false,    // owns the Aegis shield (granted by upgrade)
    shieldReady: false,  // Aegis shield currently charged
    shieldMax: PLAYER.shieldRecharge,
    shieldTimer: 0,      // seconds until the shield recharges
    level: 1,
    xp: 0,
    xpNext: 0,           // set by the game via xpForLevel(1)
  };
}

export function createBullet(x, y, angle, damage, pierce) {
  return {
    x, y,
    vx: Math.cos(angle) * BULLET.speed,
    vy: Math.sin(angle) * BULLET.speed,
    radius: BULLET.radius,
    damage, pierce,
    life: BULLET.life,
    hitSet: null,        // lazily-created Set of enemies this bullet already hit
  };
}

// A regular enemy of the given type, with wave HP scaling applied.
export function createEnemy(type, x, y, hpScale = 1) {
  const def = ENEMY_TYPES[type];
  const hp = Math.max(1, Math.round(def.hp * hpScale));
  return {
    type, x, y, vx: 0, vy: 0,
    radius: def.radius,
    hp, maxHp: hp,
    speed: def.speed * (0.9 + Math.random() * 0.2),
    damage: def.damage,
    score: def.score,
    xp: def.xp,
    color: def.color,
    sides: def.sides,
    rot: Math.random() * TAU,
    rotSpeed: (Math.random() - 0.5) * 2.4,
    phase: Math.random() * TAU,   // sine phase for weavers
    flash: 0,                      // hit-flash timer
    knockX: 0, knockY: 0,          // knockback velocity, decays over time
    isBoss: false,
  };
}

export function createBoss(x, y) {
  return {
    type: 'boss', x, y, vx: 0, vy: 0,
    radius: BOSS.radius,
    hp: BOSS.hp, maxHp: BOSS.hp,
    speed: BOSS.speed,
    damage: BOSS.damage,
    score: BOSS.score,
    xp: 0,
    color: BOSS.color,
    sides: BOSS.sides,
    rot: 0,
    rotSpeed: 0.7,
    phase: 0,
    flash: 0,
    knockX: 0, knockY: 0,
    isBoss: true,
    minionTimer: BOSS.minionInterval,
  };
}

export function createShard(x, y, value = 1) {
  const a = Math.random() * TAU;
  const d = Math.random() * 14;
  return {
    x: x + Math.cos(a) * d,
    y: y + Math.sin(a) * d,
    vx: 0, vy: 0,
    radius: 5,
    value,
    bob: Math.random() * TAU,
  };
}

export function createText(x, y, str, color = '#ffffff', size = 15) {
  return { x, y, str, color, size, life: 0.9, maxLife: 0.9, vy: -46 };
}

// Burst of neon sparks. `count` is clamped by the global particle cap.
export function burst(state, x, y, color, count, speed = 260, life = 0.5, size = 3) {
  for (let i = 0; i < count; i++) {
    if (state.particles.length >= CAPS.particles) return;
    const a = Math.random() * TAU;
    const s = speed * (0.25 + Math.random() * 0.95);
    const l = life * (0.5 + Math.random() * 0.8);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: l, maxLife: l,
      color, size: size * (0.6 + Math.random() * 0.8),
    });
  }
}

export function addText(state, x, y, str, color, size) {
  if (state.texts.length >= CAPS.texts) state.texts.shift();
  state.texts.push(createText(x, y, str, color, size));
}

// A spawn point just outside a random arena edge, so enemies walk in.
export function edgeSpawnPoint(w, h) {
  const margin = 40;
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: Math.random() * w, y: -margin };
  if (side === 1) return { x: w + margin, y: Math.random() * h };
  if (side === 2) return { x: Math.random() * w, y: h + margin };
  return { x: -margin, y: Math.random() * h };
}

// Which enemy types a wave draws from, weighted by repetition.
export function waveComposition(wave) {
  if (wave <= 1) return ['chaser', 'chaser', 'chaser', 'weaver'];
  if (wave === 2) return ['chaser', 'chaser', 'weaver', 'weaver', 'chaser'];
  if (wave === 3) return ['chaser', 'weaver', 'tank', 'chaser', 'weaver', 'chaser'];
  return ['chaser', 'weaver', 'tank', 'weaver', 'chaser', 'tank', 'chaser', 'weaver'];
}

export function pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
