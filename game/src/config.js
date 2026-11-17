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

// Enemy projectiles (fired by shooters). Slower than the player's shots and
// bright pink, so they read as danger rather than as your own fire.
export const E_BULLET = {
  speed: 305,
  radius: 5,
  life: 3.4,
  damage: 10,
};

// Difficulty presets, chosen on the title screen. spawnScale multiplies the
// spawn *interval* (below 1 = denser waves); every other scale multiplies
// exactly what its name says. Score scale is the reward for the risk.
export const DIFFICULTIES = {
  easy: {
    id: 'easy', name: '简单', desc: '敌人更弱 · 分数 ×0.8',
    hpScale: 0.7, speedScale: 0.9, spawnScale: 1.3, countScale: 0.85,
    damageScale: 0.75, scoreScale: 0.8,
  },
  normal: {
    id: 'normal', name: '正常', desc: '标准体验 · 分数 ×1.0',
    hpScale: 1, speedScale: 1, spawnScale: 1, countScale: 1,
    damageScale: 1, scoreScale: 1,
  },
  hard: {
    id: 'hard', name: '困难', desc: '敌人更强更密 · 分数 ×1.5',
    hpScale: 1.45, speedScale: 1.12, spawnScale: 0.78, countScale: 1.25,
    damageScale: 1.25, scoreScale: 1.5,
  },
};
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

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
  shooter: { // hexagon: keeps its distance, strafes, and fires pink bolts
    radius: 14, hp: 4, speed: 108, damage: 8, score: 100, xp: 2,
    color: '#4895ef', sides: 6,
    range: 265,              // preferred distance from the player, px
    fireInterval: 2.3,       // seconds between shots
    fireRange: 640,          // only opens fire inside this distance
  },
  bomber: { // diamond: sprints at the player, lights its fuse, explodes
    radius: 13, hp: 2, speed: 178, damage: 10, score: 90, xp: 1,
    color: '#ff5714', sides: 4,
    fuseTime: 0.55,          // seconds of flashing telegraph before the blast
    fuseRange: 74,           // lights the fuse inside this distance
    boomRadius: 96,          // explosion radius, px
    boomPlayerDamage: 26,
    boomEnemyDamage: 8,      // friendly fire: the blast hurts other enemies
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

// Item drops: killed enemies sometimes leave a pickup behind. `weights` is
// the relative drop table; tanks roll on the richer `tankChance` instead.
export const ITEMS = {
  dropChance: 0.085,
  tankChance: 0.3,
  life: 9,                 // seconds before a drop fades away
  blinkAt: 2.5,            // starts blinking when this much life remains
  radius: 13,
  weights: [['medkit', 34], ['bomb', 22], ['magnet', 22], ['rapid', 22]],
  medkitHeal: 30,
  bombDamage: 12,          // to every enemy on the field (boss takes 40%)
  rapidMult: 1.6,          // fire-rate multiplier while the buff runs
  rapidTime: 8,            // seconds the rapid-fire buff lasts
};

export const ITEM_DEFS = {
  medkit: { color: '#2ee66b', label: '医疗包' },
  bomb:   { color: '#ffb703', label: '炸弹' },
  magnet: { color: '#b517f5', label: '磁力核心' },
  rapid:  { color: '#ffe600', label: '急速核心' },
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
  ebullets: 140,
  items: 24,
  particles: 560,
  texts: 32,
  shards: 220,
};
