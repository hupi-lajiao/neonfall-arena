// NEONFALL ARENA — game state and simulation. Owns the run lifecycle
// (title -> waves -> boss -> victory / game over), spawning, combat,
// collisions, XP and levelling, combo scoring and all the juice timers.

import { PLAYER, BULLET, WAVES, BOSS, CAPS, COMBO, xpForLevel } from './config.js';
import {
  createPlayer, createBullet, createEnemy, createBoss, createShard,
  burst, addText, edgeSpawnPoint, waveComposition, pickFrom,
} from './entities.js';
import { rollChoices } from './upgrades.js';
import { mouse, moveVector, firing } from './input.js';
import { sfx } from './audio.js';

export class Game {
  constructor() {
    this.w = 1280;
    this.h = 720;
    this.mode = 'title';        // title | playing | levelup | paused | gameover | victory
    this.onAnnounce = null;     // (text) => void, wired to the aria status line
    this.reset();
  }

  announce(text) { if (this.onAnnounce) this.onAnnounce(text); }

  // Keep the arena's contents centred when the viewport changes size.
  // This also fixes the first-load case where the constructor's default
  // 1280x720 dimensions differ from the actual device viewport.
  resize(width, height) {
    const nextW = Math.max(1, Number(width) || 1);
    const nextH = Math.max(1, Number(height) || 1);
    const dx = (nextW - this.w) / 2;
    const dy = (nextH - this.h) / 2;
    const shift = (items) => {
      for (const item of items) {
        if (Number.isFinite(item.x)) item.x += dx;
        if (Number.isFinite(item.y)) item.y += dy;
      }
    };

    shift([this.player]);
    shift(this.enemies);
    shift(this.bullets);
    shift(this.shards);
    shift(this.particles);
    shift(this.texts);
    this.w = nextW;
    this.h = nextH;
    this.player.x = Math.max(this.player.radius, Math.min(this.w - this.player.radius, this.player.x));
    this.player.y = Math.max(this.player.radius, Math.min(this.h - this.player.radius, this.player.y));
    this.cardRects = [];
  }

  reset() {
    this.player = createPlayer(this.w / 2, this.h / 2);
    this.player.xpNext = xpForLevel(1);
    this.bullets = [];
    this.enemies = [];
    this.shards = [];
    this.particles = [];
    this.texts = [];
    this.score = 0;
    this.kills = 0;
    this.time = 0;
    this.wave = 0;
    this.waveState = 'idle';    // spawning | fighting | intermission | boss
    this.toSpawn = 0;
    this.spawnTimer = 0;
    this.interTimer = 0;
    this.boss = null;
    this.combo = { count: 0, timer: 0 };
    this.shake = 0;
    this.choices = [];
    this.cardRects = [];        // filled in by the renderer each frame
    this.pendingLevels = 0;
    this.lastPickupSfx = 0;
    this.finalTime = 0;
  }

  startRun() {
    this.reset();
    this.mode = 'playing';
    this.startWave(1);
    this.announce('Run started. Wave 1.');
  }

  startWave(n) {
    this.wave = n;
    if (n === WAVES.bossWave) {
      this.waveState = 'boss';
      this.boss = createBoss(this.w / 2, 96);
      this.enemies.push(this.boss);
      sfx.bossAlarm();
      addText(this, this.w / 2, this.h * 0.3, '⚠ WARDEN ⚠', '#00e5ff', 34);
      this.shake = Math.max(this.shake, 10);
      this.announce('Warning: the WARDEN has arrived. Defeat it to win.');
    } else {
      this.waveState = 'spawning';
      this.toSpawn = WAVES.count(n);
      this.spawnTimer = 0.4;
      addText(this, this.w / 2, this.h * 0.3, `WAVE ${n}`, '#ffffff', 34);
      this.announce(`Wave ${n}.`);
    }
  }

  multiplier() {
    return 1 + Math.min(this.combo.count, COMBO.maxCount) * COMBO.perKill;
  }

  // ---- input actions routed from main.js ---------------------------------

  action(name) {
    if (name === 'start') {
      if (this.mode === 'title' || this.mode === 'gameover' || this.mode === 'victory') this.startRun();
    } else if (name === 'pause') {
      if (this.mode === 'playing') { this.mode = 'paused'; this.announce('Paused.'); }
      else if (this.mode === 'paused') { this.mode = 'playing'; this.announce('Resumed.'); }
    } else if (name === 'restart') {
      if (this.mode === 'gameover' || this.mode === 'victory' || this.mode === 'paused') this.startRun();
    } else if (name.startsWith('pick') && this.mode === 'levelup') {
      this.pickChoice(Number(name.slice(4)) - 1);
    }
  }

  click(x, y) {
    if (this.mode === 'title' || this.mode === 'gameover' || this.mode === 'victory') {
      this.startRun();
    } else if (this.mode === 'paused') {
      this.mode = 'playing';
    } else if (this.mode === 'levelup') {
      for (let i = 0; i < this.cardRects.length; i++) {
        const r = this.cardRects[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { this.pickChoice(i); return; }
      }
    }
  }

  pickChoice(i) {
    const choice = this.choices[i];
    if (!choice) return;
    choice.apply(this.player);
    sfx.levelUp();
    this.pendingLevels--;
    if (this.pendingLevels > 0) {
      this.choices = rollChoices(3);
    } else {
      this.choices = [];
      this.mode = 'playing';
      this.announce(`Upgrade chosen: ${choice.name}.`);
    }
  }

  // ---- XP / levels ---------------------------------------------------------

  gainXp(amount) {
    const p = this.player;
    p.xp += amount;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = xpForLevel(p.level);
      this.pendingLevels++;
    }
  }

  enterLevelUpIfNeeded() {
    if (this.pendingLevels > 0 && this.mode === 'playing') {
      this.mode = 'levelup';
      this.choices = rollChoices(3);
      addText(this, this.player.x, this.player.y - 34, 'LEVEL UP!', '#ffe600', 22);
      this.announce(`Level ${this.player.level}. Choose an upgrade.`);
    }
  }

  // ---- combat --------------------------------------------------------------

  damagePlayer(amount, fromX, fromY) {
    const p = this.player;
    if (p.invuln > 0 || this.mode !== 'playing') return;
    const dx = p.x - fromX, dy = p.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    if (p.shieldReady) {
      p.shieldReady = false;
      p.shieldTimer = p.shieldMax;
      p.invuln = 0.6;
      p.vx += (dx / d) * 320; p.vy += (dy / d) * 320;
      burst(this, p.x, p.y, '#7df9ff', 18, 300, 0.4, 3);
      addText(this, p.x, p.y - 26, 'SHIELD BLOCK', '#7df9ff', 14);
      sfx.shieldPop();
      return;
    }
    p.hp -= amount;
    p.invuln = PLAYER.invulnTime;
    p.vx += (dx / d) * 380; p.vy += (dy / d) * 380;
    this.shake = Math.max(this.shake, 13);
    burst(this, p.x, p.y, '#ff3860', 16, 280, 0.45, 3);
    sfx.hurt();
    if (p.hp <= 0) {
      p.hp = 0;
      this.mode = 'gameover';
      this.finalTime = this.time;
      burst(this, p.x, p.y, '#00e5ff', 60, 420, 0.9, 4);
      burst(this, p.x, p.y, '#ffffff', 30, 300, 0.7, 3);
      this.shake = 24;
      sfx.gameOver();
      this.announce(`Game over. Score ${this.score}, wave ${this.wave}.`);
    }
  }

  killEnemy(e) {
    this.kills++;
    this.combo.count++;
    this.combo.timer = COMBO.window;
    const gained = Math.round(e.score * this.multiplier());
    this.score += gained;
    addText(this, e.x, e.y - e.radius - 4, `+${gained}`, e.color, e.isBoss ? 26 : 14);
    burst(this, e.x, e.y, e.color, e.isBoss ? 90 : 16, e.isBoss ? 520 : 300, e.isBoss ? 1.0 : 0.5, 3.5);
    for (let i = 0; i < e.xp; i++) {
      if (this.shards.length < CAPS.shards) this.shards.push(createShard(e.x, e.y, 1));
    }
    if (e.type === 'tank') {
      for (let i = 0; i < 2; i++) {
        const mini = createEnemy('mini', e.x + (i === 0 ? -14 : 14), e.y + (i === 0 ? -8 : 8), 1);
        this.enemies.push(mini);
      }
    }
    if (e.isBoss) {
      this.boss = null;
      this.mode = 'victory';
      this.finalTime = this.time;
      this.shake = 26;
      sfx.bigBoom();
      sfx.victory();
      this.announce(`Victory! Final score ${this.score}.`);
    } else {
      sfx.explosion();
    }
  }

  // ---- main update -----------------------------------------------------------

  update(dt) {
    // Particles and floating texts animate in every mode (menus stay alive).
    this.updateFx(dt);
    if (this.mode !== 'playing') return;

    this.time += dt;
    const p = this.player;

    // Combo decay.
    if (this.combo.timer > 0) {
      this.combo.timer -= dt;
      if (this.combo.timer <= 0) this.combo.count = 0;
    }

    this.updatePlayer(dt);
    this.updateSpawning(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateShards(dt);
    this.enterLevelUpIfNeeded();
  }

  updateFx(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { this.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.exp(-2.4 * dt);
      pt.vy *= Math.exp(-2.4 * dt);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 46);
  }

  updatePlayer(dt) {
    const p = this.player;
    p.aim = Math.atan2(mouse.y - p.y, mouse.x - p.x);
    const mv = moveVector();
    // Keyboard velocity plus knockback impulse, which decays quickly.
    const blend = 1 - Math.exp(-10 * dt);
    p.vx += (mv.x * p.speed - p.vx) * blend;
    p.vy += (mv.y * p.speed - p.vy) * blend;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(p.radius, Math.min(this.w - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(this.h - p.radius, p.y));

    if (p.invuln > 0) p.invuln -= dt;
    if (p.flash > 0) p.flash -= dt;

    // Aegis shield recharge.
    if (p.hasShield && !p.shieldReady) {
      p.shieldTimer -= dt;
      if (p.shieldTimer <= 0) {
        p.shieldReady = true;
        addText(this, p.x, p.y - 26, 'SHIELD READY', '#7df9ff', 13);
        sfx.pickup();
      }
    }

    // Shooting.
    p.fireTimer -= dt;
    if (firing() && p.fireTimer <= 0) {
      p.fireTimer = Math.max(p.fireTimer + 1 / p.fireRate, 0);
      const n = p.projectiles;
      for (let i = 0; i < n; i++) {
        const offset = (i - (n - 1) / 2) * BULLET.spreadStep;
        const a = p.aim + offset;
        if (this.bullets.length < CAPS.bullets) {
          this.bullets.push(createBullet(
            p.x + Math.cos(a) * (p.radius + 6),
            p.y + Math.sin(a) * (p.radius + 6),
            a, p.damage, p.pierce,
          ));
        }
      }
      p.flash = 0.05;
      sfx.shoot();
    }
  }

  updateSpawning(dt) {
    if (this.waveState === 'spawning') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.toSpawn > 0) {
        this.spawnTimer = WAVES.interval(this.wave);
        if (this.enemies.length < CAPS.enemies) {
          const pt = edgeSpawnPoint(this.w, this.h);
          const type = pickFrom(waveComposition(this.wave));
          this.enemies.push(createEnemy(type, pt.x, pt.y, WAVES.hpScale(this.wave)));
          this.toSpawn--;
        }
      }
      if (this.toSpawn <= 0) this.waveState = 'fighting';
    } else if (this.waveState === 'fighting') {
      if (this.enemies.length === 0) {
        this.waveState = 'intermission';
        this.interTimer = WAVES.intermission;
        this.score += 100 * this.wave;
        addText(this, this.w / 2, this.h * 0.3, `WAVE ${this.wave} CLEAR  +${100 * this.wave}`, '#2ee66b', 24);
      }
    } else if (this.waveState === 'intermission') {
      this.interTimer -= dt;
      if (this.interTimer <= 0) this.startWave(this.wave + 1);
    } else if (this.waveState === 'boss' && this.boss) {
      this.boss.minionTimer -= dt;
      if (this.boss.minionTimer <= 0) {
        this.boss.minionTimer = BOSS.minionInterval;
        const minions = this.enemies.length - 1;
        if (minions < BOSS.minionCap) {
          const pt = edgeSpawnPoint(this.w, this.h);
          const type = Math.random() < 0.5 ? 'chaser' : 'weaver';
          this.enemies.push(createEnemy(type, pt.x, pt.y, WAVES.hpScale(this.wave)));
        }
      }
    }
  }

  updateBullets(dt) {
    const margin = 60;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -margin || b.x > this.w + margin || b.y < -margin || b.y > this.h + margin) {
        this.bullets.splice(i, 1);
        continue;
      }
      // Collide with enemies.
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (b.hitSet && b.hitSet.has(e)) continue;
        const dx = e.x - b.x, dy = e.y - b.y;
        const rr = e.radius + b.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        e.hp -= b.damage;
        e.flash = 0.09;
        const kb = 200 * (14 / e.radius) * (e.isBoss ? 0.05 : 1);
        const ba = Math.atan2(b.vy, b.vx);
        e.knockX += Math.cos(ba) * kb;
        e.knockY += Math.sin(ba) * kb;
        burst(this, b.x, b.y, e.color, 3, 180, 0.25, 2.5);
        sfx.hit();
        if (e.hp <= 0) {
          this.enemies.splice(j, 1);
          this.killEnemy(e);
          if (this.mode !== 'playing') return; // boss kill ended the run mid-loop
        }
        if (b.pierce > 0) {
          b.pierce--;
          if (!b.hitSet) b.hitSet = new Set();
          b.hitSet.add(e);
        } else {
          this.bullets.splice(i, 1);
        }
        break; // this bullet is done (spent or pierced through one enemy)
      }
    }
  }

  updateEnemies(dt) {
    const p = this.player;
    const list = this.enemies;
    for (const e of list) {
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let mx = dx / d, my = dy / d;
      if (e.type === 'weaver') {
        const s = Math.sin(this.time * 4.2 + e.phase) * 150;
        mx += (-dy / d) * (s / e.speed);
        my += (dx / d) * (s / e.speed);
        const ml = Math.hypot(mx, my) || 1;
        mx /= ml; my /= ml;
      }
      e.x += (mx * e.speed + e.knockX) * dt;
      e.y += (my * e.speed + e.knockY) * dt;
      e.knockX *= Math.exp(-7 * dt);
      e.knockY *= Math.exp(-7 * dt);
      e.rot += e.rotSpeed * dt;
      if (e.flash > 0) e.flash -= dt;
      // Keep them near the arena (they spawn just outside and walk in).
      e.x = Math.max(-70, Math.min(this.w + 70, e.x));
      e.y = Math.max(-70, Math.min(this.h + 70, e.y));
    }
    // Gentle separation so enemies do not stack into one blob.
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 > rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (rr - d) * 0.5;
        const nx = dx / d, ny = dy / d;
        if (!a.isBoss) { a.x -= nx * push * 0.5; a.y -= ny * push * 0.5; }
        if (!b.isBoss) { b.x += nx * push * 0.5; b.y += ny * push * 0.5; }
      }
    }
    // Contact damage.
    for (const e of list) {
      const dx = p.x - e.x, dy = p.y - e.y;
      const rr = e.radius + p.radius - 2;
      if (dx * dx + dy * dy < rr * rr) {
        this.damagePlayer(e.damage, e.x, e.y);
        if (this.mode !== 'playing') return;
      }
    }
  }

  updateShards(dt) {
    const p = this.player;
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.bob += dt * 3;
      const dx = p.x - s.x, dy = p.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d < p.magnet) {
        const pull = 380 * (1 - d / (p.magnet * 1.6));
        s.x += (dx / (d || 1)) * pull * dt;
        s.y += (dy / (d || 1)) * pull * dt;
      }
      if (d < PLAYER.collectRadius) {
        this.shards.splice(i, 1);
        this.gainXp(s.value);
        if (this.time - this.lastPickupSfx > 0.06) {
          sfx.pickup();
          this.lastPickupSfx = this.time;
        }
      }
    }
  }
}
