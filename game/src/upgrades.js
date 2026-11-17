// NEONFALL ARENA — the level-up upgrade pool. Each entry knows how to describe
// itself and how to apply itself to the player. On level-up the game rolls
// three distinct choices from this pool.

export const UPGRADES = [
  {
    id: 'rapid',
    name: 'RAPID FIRE',
    desc: '+25% fire rate',
    color: '#ffe600',
    apply: (p) => { p.fireRate *= 1.25; },
  },
  {
    id: 'damage',
    name: 'HEAVY ROUNDS',
    desc: '+1 bullet damage',
    color: '#ff3860',
    apply: (p) => { p.damage += 1; },
  },
  {
    id: 'multishot',
    name: 'MULTISHOT',
    desc: '+1 projectile per shot',
    color: '#00e5ff',
    apply: (p) => { p.projectiles += 1; },
  },
  {
    id: 'speed',
    name: 'SWIFT THRUSTERS',
    desc: '+12% move speed',
    color: '#2ee66b',
    apply: (p) => { p.speed *= 1.12; },
  },
  {
    id: 'vitality',
    name: 'VITALITY CORE',
    desc: '+25 max HP and heal 25',
    color: '#ff6b9d',
    apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); },
  },
  {
    id: 'magnet',
    name: 'MAGNET COIL',
    desc: '+60% XP magnet radius',
    color: '#b517f5',
    apply: (p) => { p.magnet *= 1.6; },
  },
  {
    id: 'pierce',
    name: 'PIERCING ROUNDS',
    desc: 'Shots pierce +1 enemy',
    color: '#ff9f1c',
    apply: (p) => { p.pierce += 1; },
  },
  {
    id: 'shield',
    name: 'AEGIS SHIELD',
    desc: 'Shield blocks one hit, recharges 30% faster',
    color: '#7df9ff',
    apply: (p) => {
      p.hasShield = true;
      p.shieldMax = Math.max(4, p.shieldMax * 0.7);
      p.shieldReady = true;
      p.shieldTimer = 0;
    },
  },
];

// Roll `n` distinct upgrades (shuffled copy, take the first n).
export function rollChoices(n = 3) {
  const pool = [...UPGRADES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
