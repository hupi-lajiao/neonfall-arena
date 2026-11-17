// NEONFALL ARENA — tuning constants. Everything gameplay-shaping lives here so the
// balance can be adjusted in one place.

export const TAU = Math.PI * 2;

export const PLAYER = {
  radius: 14,
  baseSpeed: 265,          // px per second
  baseMaxHp: 100,
  baseFireRate: 5,         // shots per second
  baseDamage: 1,
  baseMagnet: 90,          // XP shard attraction radius, px
  collectRadius: 22,       // XP shard pickup radius, px
  invulnTime: 0.9,         // seconds of invulnerability after a hit
  shieldRecharge: 12,      // seconds for the Aegis shield to come back
};

export const BULLET = {
  speed: 760,
  radius: 4,
  life: 0.85,              // seconds before a bullet fizzles out
  spreadStep: 0.11,        // radians between projectiles when multishot > 1
};

export const ENEMY_TYPES = {
  chaser: { // triangle: steady seeker, the bread and butter of every wave
    radius: 15, hp: 3, speed: 118, damage: 12, score: 50, xp: 1,
    color: '#ff3860', sides: 3,
  },
  weaver: { // pentagon: fast, fragile, slides side to side on a sine path
    radius: 13, hp: 2, speed: 168, damage: 10, score: 75, xp: 1,
    color: '#ff9f1c', sides: 5, sineAmp: 150, sineFreq: 4.2,
  },
  tank: { // square: slow wall of HP; splits into two minis when destroyed
    radius: 26, hp: 16, speed: 52, damage: 20, score: 150, xp: 3,
    color: '#b517f5', sides: 4,
  },
  mini: { // small triangle spawned by a dying tank; quick and weak
    radius: 10, hp: 1, speed: 185, damage: 8, score: 25, xp: 1,
    color: '#ff6b9d', sides: 3,
  },
};

export const BOSS = {
  name: 'WARDEN',
  radius: 56,
  hp: 300,
  speed: 58,
  damage: 30,
  score: 2000,
  color: '#00e5ff',
  sides: 8,
  minionInterval: 3.4,     // seconds between minion spawns while it lives
  minionCap: 8,
};

export const WAVES = {
  total: 5,                // wave 5 is the boss wave
  bossWave: 5,
  intermission: 2.2,       // seconds of calm between waves
  // Enemies to spawn on wave n (boss wave handled separately).
  count: (n) => 6 + n * 4,
  // Seconds between individual spawns on wave n.
  interval: (n) => Math.max(0.34, 1.05 - n * 0.13),
  // Enemy HP multiplier growth per wave.
  hpScale: (n) => 1 + (n - 1) * 0.14,
};

// XP needed to go from level L to L + 1.
export const xpForLevel = (level) => 6 + (level - 1) * 5;

export const COMBO = {
  window: 2.6,             // seconds to land another kill before the combo decays
  maxCount: 40,            // combo count used for the multiplier caps here
  perKill: 0.05,           // multiplier gain per combo count (max x3.0)
};

export const CAPS = {
  enemies: 130,
  bullets: 320,
  particles: 420,
  texts: 32,
  shards: 220,
};
