// NEONFALL ARENA — entity factories and spawn helpers. Entities are plain
// objects kept in arrays on the game state; this module only creates them.

import { PLAYER, BULLET, E_BULLET, ENEMY_TYPES, BOSS, ITEMS, CAPS, TAU } from './config.js';

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
    bounce: 0,           // wall bounces per bullet (upgrade)
    critChance: 0,       // chance per hit to deal triple damage (upgrade)
    xpGain: 1,           // XP multiplier (upgrade)
    regen: 0,            // HP per second (upgrade)
    magnet: PLAYER.baseMagnet,
    fireTimer: 0,        // seconds until the next shot is allowed
    rapidTimer: 0,       // seconds left on the rapid-fire item buff
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

export function createBullet(x, y, angle, damage, pierce, bounce = 0) {
  return {
    x, y,
    vx: Math.cos(angle) * BULLET.speed,
    vy: Math.sin(angle) * BULLET.speed,
    radius: BULLET.radius,
    damage, pierce, bounce,
    life: BULLET.life,
    hitSet: null,        // lazily-created Set of enemies this bullet already hit
  };
}

export function createEnemyBullet(x, y, angle, damage = E_BULLET.damage) {
  return {
    x, y,
    vx: Math.cos(angle) * E_BULLET.speed,
    vy: Math.sin(angle) * E_BULLET.speed,
    radius: E_BULLET.radius,
    damage,
    life: E_BULLET.life,
  };
}

// A regular enemy of the given type, with wave/difficulty scaling applied.
export function createEnemy(type, x, y, hpScale = 1, speedScale = 1) {
  const def = ENEMY_TYPES[type];
  const hp = Math.max(1, Math.round(def.hp * hpScale));
  return {
    type, x, y, vx: 0, vy: 0,
    radius: def.radius,
    hp, maxHp: hp,
    speed: def.speed * speedScale * (0.9 + Math.random() * 0.2),
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
    aim: 0,                        // shooters: current aim at the player
    fireTimer: 0.6 + Math.random() * 0.9,  // shooters: seconds to first shot
    strafe: Math.random() < 0.5 ? -1 : 1,  // shooters: strafe direction
    fuse: -1,                      // bombers: -1 unlit, otherwise seconds left
    exploded: false,               // bombers: went off by themselves
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
    aim: 0, fireTimer: 0, strafe: 1, fuse: -1, exploded: false,
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
    vacuum: false,       // set by the magnet item: fly to the player from anywhere
  };
}

// A dropped item pickup. It drifts a little on spawn, then sits and pulses
// until it is collected or its life runs out.
export function createItem(type, x, y) {
  const a = Math.random() * TAU;
  const s = 26 + Math.random() * 30;
  return {
    type, x, y,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s,
    radius: ITEMS.radius,
    age: 0,
    life: ITEMS.life,
    bob: Math.random() * TAU,
  };
}

// Weighted pick from the ITEMS drop table.
export function rollItemType() {
  let total = 0;
  for (const [, w] of ITEMS.weights) total += w;
  let roll = Math.random() * total;
  for (const [type, w] of ITEMS.weights) {
    roll -= w;
    if (roll <= 0) return type;
  }
  return ITEMS.weights[0][0];
}

export function createText(x, y, str, color = '#ffffff', size = 15) {
  return { x, y, str, color, size, life: 0.9, maxLife: 0.9, vy: -46 };
}

// Burst of neon sparks. `shape` is 'spark' (a square mote), 'glow' (a soft
// round puff) — rings are made with ringFx below.
export function burst(state, x, y, color, count, speed = 260, life = 0.5, size = 3, shape = 'spark') {
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
      shape, r: 0, rv: 0,
    });
  }
}

// An expanding shockwave ring (explosions, bomb items, boss death).
export function ringFx(state, x, y, color, maxR = 90, life = 0.4) {
  if (state.particles.length >= CAPS.particles) return;
  state.particles.push({
    x, y, vx: 0, vy: 0,
    life, maxLife: life,
    color, size: 0,
    shape: 'ring', r: 6, rv: (maxR - 6) / life,
  });
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

// Which enemy types a wave draws from, weighted by repetition. Shooters
// join on wave 3, bombers on wave 4.
export function waveComposition(wave) {
  if (wave <= 1) return ['chaser', 'chaser', 'chaser', 'weaver'];
  if (wave === 2) return ['chaser', 'chaser', 'weaver', 'weaver', 'chaser'];
  if (wave === 3) return ['chaser', 'weaver', 'tank', 'shooter', 'chaser', 'weaver', 'chaser'];
  return ['chaser', 'weaver', 'tank', 'shooter', 'bomber', 'weaver', 'chaser', 'tank', 'bomber', 'shooter'];
}

export function pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
