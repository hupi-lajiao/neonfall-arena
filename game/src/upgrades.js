// NEONFALL ARENA — the level-up upgrade pool. Each entry knows how to describe
// itself and how to apply itself to the player. On level-up the game rolls
// three distinct choices from this pool of twelve.

export const UPGRADES = [
  {
    id: 'rapid',
    name: '急速射击',
    desc: '射速 +25%',
    color: '#ffe600',
    apply: (p) => { p.fireRate *= 1.25; },
  },
  {
    id: 'damage',
    name: '重型弹药',
    desc: '子弹伤害 +1',
    color: '#ff3860',
    apply: (p) => { p.damage += 1; },
  },
  {
    id: 'multishot',
    name: '多重射击',
    desc: '每次射击 +1 发弹道',
    color: '#00e5ff',
    apply: (p) => { p.projectiles += 1; },
  },
  {
    id: 'speed',
    name: '疾风推进',
    desc: '移动速度 +12%',
    color: '#2ee66b',
    apply: (p) => { p.speed *= 1.12; },
  },
  {
    id: 'vitality',
    name: '生命核心',
    desc: '生命上限 +25 并回复 25',
    color: '#ff6b9d',
    apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); },
  },
  {
    id: 'magnet',
    name: '磁力线圈',
    desc: '经验磁吸范围 +60%',
    color: '#b517f5',
    apply: (p) => { p.magnet *= 1.6; },
  },
  {
    id: 'pierce',
    name: '穿透弹',
    desc: '子弹可穿透 +1 名敌人',
    color: '#ff9f1c',
    apply: (p) => { p.pierce += 1; },
  },
  {
    id: 'shield',
    name: '圣盾',
    desc: '护盾抵挡一次伤害，充能快 30%',
    color: '#7df9ff',
    apply: (p) => {
      p.hasShield = true;
      p.shieldMax = Math.max(4, p.shieldMax * 0.7);
      p.shieldReady = true;
      p.shieldTimer = 0;
    },
  },
  {
    id: 'bounce',
    name: '弹跳弹',
    desc: '子弹可在墙壁反弹 +1 次',
    color: '#4cc9f0',
    apply: (p) => { p.bounce += 1; },
  },
  {
    id: 'crit',
    name: '暴击核心',
    desc: '命中 15% 概率造成 3 倍伤害',
    color: '#ef476f',
    apply: (p) => { p.critChance += 0.15; },
  },
  {
    id: 'regen',
    name: '再生装甲',
    desc: '每秒回复 0.8 点生命',
    color: '#06d6a0',
    apply: (p) => { p.regen += 0.8; },
  },
  {
    id: 'wisdom',
    name: '经验增幅',
    desc: '经验获取 +35%',
    color: '#ffd166',
    apply: (p) => { p.xpGain *= 1.35; },
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
