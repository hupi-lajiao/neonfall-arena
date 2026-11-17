// NEONFALL ARENA — game state and simulation. Owns the run lifecycle
// (title -> waves -> boss -> victory / game over), difficulty, spawning,
// combat, enemy AI (chasers, weavers, tanks, shooters, bombers), enemy
// projectiles, item drops, collisions, XP and levelling, combo scoring
// and all the juice timers.

import {
  PLAYER, BULLET, WAVES, BOSS, CAPS, COMBO, DIFFICULTIES, DIFFICULTY_ORDER,
  ENEMY_TYPES, ITEMS, ITEM_DEFS, xpForLevel,
} from './config.js';
import {
  createPlayer, createBullet, createEnemyBullet, createEnemy, createBoss,
  createShard, createItem, rollItemType, burst, ringFx, addText,
  edgeSpawnPoint, waveComposition, pickFrom,
} from './entities.js';
import { rollChoices } from './upgrades.js';
import { mouse, moveVector, firing } from './input.js';
import { sfx } from './audio.js';

export class Game {
  constructor() {
    this.w = 1280;
    this.h = 720;
    this.mode = 'title';        // title | playing | levelup | paused | gameover | victory
    this.difficulty = 'normal'; // key into DIFFICULTIES, picked on the title screen
    this.onAnnounce = null;     // (text) => void, wired to the aria status line
    this.reset();
  }

  announce(text) { if (this.onAnnounce) this.onAnnounce(text); }

  diffDef() { return DIFFICULTIES[this.difficulty]; }
  scoreScale() { return this.diffDef().scoreScale; }

  setDifficulty(id) {
    if (!DIFFICULTIES[id]) return;
    this.difficulty = id;
    this.announce(`难度：${DIFFICULTIES[id].name}。`);
  }

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
    shift(this.ebullets);
    shift(this.items);
    shift(this.shards);
    shift(this.particles);
    shift(this.texts);
    this.w = nextW;
    this.h = nextH;
    this.player.x = Math.max(this.player.radius, Math.min(this.w - this.player.radius, this.player.x));
    this.player.y = Math.max(this.player.radius, Math.min(this.h - this.player.radius, this.player.y));
    this.cardRects = [];
    this.diffRects = [];
  }

  reset() {
    this.player = createPlayer(this.w / 2, this.h / 2);
    this.player.xpNext = xpForLevel(1);
    this.bullets = [];
    this.ebullets = [];
    this.enemies = [];
    this.items = [];
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
    this.diffRects = [];        // title-screen difficulty boxes, likewise
    this.pendingLevels = 0;
    this.lastPickupSfx = 0;
    this.finalTime = 0;
  }

  startRun() {
    const keep = this.difficulty;
    this.reset();
    this.difficulty = keep;
    this.mode = 'playing';
    this.startWave(1);
    this.announce(`开始游戏，难度${this.diffDef().name}。第 1 波。`);
  }

  startWave(n) {
    this.wave = n;
    if (n === WAVES.bossWave) {
      this.waveState = 'boss';
      const d = this.diffDef();
      this.boss = createBoss(this.w / 2, 96);
      this.boss.hp = this.boss.maxHp = Math.round(this.boss.hp * d.hpScale);
      this.enemies.push(this.boss);
      sfx.bossAlarm();
      addText(this, this.w / 2, this.h * 0.3, '⚠ BOSS：WARDEN ⚠', '#00e5ff', 34);
      this.shake = Math.max(this.shake, 10);
      this.announce('警告：守护者 WARDEN 出现，击落它即可获胜。');
    } else {
      this.waveState = 'spawning';
      this.toSpawn = Math.round(WAVES.count(n) * this.diffDef().countScale);
      this.spawnTimer = 0.4;
      addText(this, this.w / 2, this.h * 0.3, `第 ${n} 波`, '#ffffff', 34);
      this.announce(`第 ${n} 波。`);
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
      if (this.mode === 'playing') { this.mode = 'paused'; this.announce('已暂停。'); }
      else if (this.mode === 'paused') { this.mode = 'playing'; this.announce('继续游戏。'); }
    } else if (name === 'restart') {
      if (this.mode === 'gameover' || this.mode === 'victory' || this.mode === 'paused') this.startRun();
    } else if (name.startsWith('pick')) {
      const idx = Number(name.slice(4)) - 1;
      if (this.mode === 'title') {
        // On the title screen the number keys choose the difficulty instead.
        this.setDifficulty(DIFFICULTY_ORDER[idx]);
      } else if (this.mode === 'levelup') {
        this.pickChoice(idx);
      }
    }
  }

  click(x, y) {
    if (this.mode === 'title') {
      for (const r of this.diffRects) {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          this.setDifficulty(r.id);
          return;
        }
      }
      this.startRun();
    } else if (this.mode === 'gameover' || this.mode === 'victory') {
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
      this.announce(`已选择升级：${choice.name}。`);
    }
  }

  // ---- XP / levels ---------------------------------------------------------

  gainXp(amount) {
    const p = this.player;
    p.xp += amount * p.xpGain;
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
      addText(this, this.player.x, this.player.y - 34, '升级！', '#ffe600', 22);
      this.announce(`升到 ${this.player.level} 级，选择一张升级卡。`);
    }
  }

  // ---- combat --------------------------------------------------------------

  damagePlayer(amount, fromX, fromY) {
    const p = this.player;
    if (p.invuln > 0 || this.mode !== 'playing') return;
    amount *= this.diffDef().damageScale;
    const dx = p.x - fromX, dy = p.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    if (p.shieldReady) {
      p.shieldReady = false;
      p.shieldTimer = p.shieldMax;
      p.invuln = 0.6;
      p.vx += (dx / d) * 320; p.vy += (dy / d) * 320;
      burst(this, p.x, p.y, '#7df9ff', 18, 300, 0.4, 3);
      addText(this, p.x, p.y - 26, '护盾抵挡', '#7df9ff', 14);
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
      burst(this, p.x, p.y, '#ffffff', 30, 300, 0.7, 3, 'glow');
      this.shake = 24;
      sfx.gameOver();
      this.announce(`游戏结束。分数 ${this.score}，坚持到第 ${this.wave} 波。`);
    }
  }

  killEnemy(e) {
    this.kills++;
    this.combo.count++;
    this.combo.timer = COMBO.window;
    const gained = Math.round(e.score * this.multiplier() * this.scoreScale());
    this.score += gained;
    addText(this, e.x, e.y - e.radius - 4, `+${gained}`, e.color, e.isBoss ? 26 : 14);
    burst(this, e.x, e.y, e.color, e.isBoss ? 90 : 16, e.isBoss ? 520 : 300, e.isBoss ? 1.0 : 0.5, 3.5);
    if (e.isBoss) ringFx(this, e.x, e.y, e.color, 260, 0.7);
    for (let i = 0; i < e.xp; i++) {
      if (this.shards.length < CAPS.shards) this.shards.push(createShard(e.x, e.y, 1));
    }
    // Item drops: anything but a self-detonated bomber can leave a pickup.
    if (!e.isBoss && !e.exploded) {
      const chance = e.type === 'tank' ? ITEMS.tankChance : ITEMS.dropChance;
      if (Math.random() < chance && this.items.length < CAPS.items) {
        this.items.push(createItem(rollItemType(), e.x, e.y));
      }
    }
    if (e.type === 'tank') {
      for (let i = 0; i < 2; i++) {
        const mini = createEnemy('mini', e.x + (i === 0 ? -14 : 14), e.y + (i === 0 ? -8 : 8), 1, this.diffDef().speedScale);
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
      this.announce(`胜利！最终分数 ${this.score}。`);
    } else if (!e.exploded) {
      sfx.explosion();
    }
  }

  // Remove every enemy at or below zero HP, crediting the kills. Deaths
  // caused outside the bullet loop (bomber blasts, bomb items) funnel here.
  sweepDead() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        this.enemies.splice(i, 1);
        this.killEnemy(e);
      }
    }
  }

  // A bomber goes off: heavy damage to the player up close, real damage to
  // every other enemy caught in the ring — chain reactions included.
  explodeBomber(e) {
    const def = ENEMY_TYPES.bomber;
    e.hp = 0;
    e.exploded = true;
    ringFx(this, e.x, e.y, '#ffb703', def.boomRadius, 0.35);
    burst(this, e.x, e.y, '#ff5714', 26, 380, 0.6, 3.5);
    burst(this, e.x, e.y, '#ffd60a', 14, 240, 0.45, 3, 'glow');
    this.shake = Math.max(this.shake, 12);
    sfx.bigBoom();
    const p = this.player;
    if (Math.hypot(p.x - e.x, p.y - e.y) < def.boomRadius + p.radius) {
      this.damagePlayer(def.boomPlayerDamage, e.x, e.y);
    }
    for (const other of this.enemies) {
      if (other === e || other.hp <= 0) continue;
      if (Math.hypot(other.x - e.x, other.y - e.y) < def.boomRadius + other.radius) {
        other.hp -= def.boomEnemyDamage * (other.isBoss ? 0.4 : 1);
        other.flash = 0.09;
      }
    }
  }

  applyItem(item) {
    const p = this.player;
    const def = ITEM_DEFS[item.type];
    burst(this, item.x, item.y, def.color, 12, 200, 0.4, 3, 'glow');
    if (item.type === 'medkit') {
      const healed = Math.min(ITEMS.medkitHeal, p.maxHp - p.hp);
      p.hp += healed;
      addText(this, p.x, p.y - 28, `+${Math.round(healed)} 生命`, '#2ee66b', 17);
      sfx.heal();
    } else if (item.type === 'bomb') {
      addText(this, p.x, p.y - 28, '炸弹！', '#ffb703', 22);
      ringFx(this, p.x, p.y, '#ffb703', 300, 0.5);
      this.shake = Math.max(this.shake, 15);
      sfx.bigBoom();
      for (const e of this.enemies) {
        e.hp -= ITEMS.bombDamage * (e.isBoss ? 0.4 : 1);
        e.flash = 0.09;
      }
      this.sweepDead();
    } else if (item.type === 'magnet') {
      for (const s of this.shards) s.vacuum = true;
      addText(this, p.x, p.y - 28, '磁力全吸', '#b517f5', 17);
      sfx.vacuum();
    } else if (item.type === 'rapid') {
      p.rapidTimer = ITEMS.rapidTime;
      addText(this, p.x, p.y - 28, '急速射击！', '#ffe600', 17);
      sfx.itemGet();
    }
    this.announce(`拾取道具：${def.label}。`);
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
    if (this.mode !== 'playing') return; // a bomber blast may have ended the run
    this.updateEBullets(dt);
    this.updateShards(dt);
    this.updateItems(dt);
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
      if (pt.shape === 'ring') pt.r += pt.rv * dt;
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
    if (p.rapidTimer > 0) p.rapidTimer -= dt;
    if (p.regen > 0 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    // Aegis shield recharge.
    if (p.hasShield && !p.shieldReady) {
      p.shieldTimer -= dt;
      if (p.shieldTimer <= 0) {
        p.shieldReady = true;
        addText(this, p.x, p.y - 26, '护盾就绪', '#7df9ff', 13);
        sfx.pickup();
      }
    }

    // Shooting (the rapid-fire item buff multiplies the rate while it lasts).
    p.fireTimer -= dt;
    if (firing() && p.fireTimer <= 0) {
      const rate = p.fireRate * (p.rapidTimer > 0 ? ITEMS.rapidMult : 1);
      p.fireTimer = Math.max(p.fireTimer + 1 / rate, 0);
      const n = p.projectiles;
      for (let i = 0; i < n; i++) {
        const offset = (i - (n - 1) / 2) * BULLET.spreadStep;
        const a = p.aim + offset;
        if (this.bullets.length < CAPS.bullets) {
          this.bullets.push(createBullet(
            p.x + Math.cos(a) * (p.radius + 6),
            p.y + Math.sin(a) * (p.radius + 6),
            a, p.damage, p.pierce, p.bounce,
          ));
        }
      }
      p.flash = 0.05;
      sfx.shoot();
    }
  }

  updateSpawning(dt) {
    const d = this.diffDef();
    if (this.waveState === 'spawning') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.toSpawn > 0) {
        this.spawnTimer = WAVES.interval(this.wave) * d.spawnScale;
        if (this.enemies.length < CAPS.enemies) {
          const pt = edgeSpawnPoint(this.w, this.h);
          const type = pickFrom(waveComposition(this.wave));
          this.enemies.push(createEnemy(type, pt.x, pt.y, WAVES.hpScale(this.wave) * d.hpScale, d.speedScale));
          this.toSpawn--;
        }
      }
      if (this.toSpawn <= 0) this.waveState = 'fighting';
    } else if (this.waveState === 'fighting') {
      if (this.enemies.length === 0) {
        this.waveState = 'intermission';
        this.interTimer = WAVES.intermission;
        const bonus = Math.round(100 * this.wave * this.scoreScale());
        this.score += bonus;
        addText(this, this.w / 2, this.h * 0.3, `第 ${this.wave} 波 · 已肃清 +${bonus}`, '#2ee66b', 24);
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
          const type = pickFrom(['chaser', 'chaser', 'weaver', 'shooter', 'bomber']);
          this.enemies.push(createEnemy(type, pt.x, pt.y, WAVES.hpScale(this.wave) * d.hpScale, d.speedScale));
        }
      }
    }
  }

  updateBullets(dt) {
    const margin = 60;
    const p = this.player;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      // Wall bounce (upgrade): reflect off the arena walls instead of dying.
      if (b.bounce > 0) {
        if (b.x < b.radius) { b.x = b.radius; b.vx = Math.abs(b.vx); b.bounce--; }
        else if (b.x > this.w - b.radius) { b.x = this.w - b.radius; b.vx = -Math.abs(b.vx); b.bounce--; }
        if (b.y < b.radius) { b.y = b.radius; b.vy = Math.abs(b.vy); b.bounce--; }
        else if (b.y > this.h - b.radius) { b.y = this.h - b.radius; b.vy = -Math.abs(b.vy); b.bounce--; }
      }
      if (b.life <= 0 || b.x < -margin || b.x > this.w + margin || b.y < -margin || b.y > this.h + margin) {
        this.bullets.splice(i, 1);
        continue;
      }
      // Collide with enemies.
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (e.hp <= 0) continue;
        if (b.hitSet && b.hitSet.has(e)) continue;
        const dx = e.x - b.x, dy = e.y - b.y;
        const rr = e.radius + b.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        let dmg = b.damage;
        if (p.critChance > 0 && Math.random() < p.critChance) {
          dmg *= 3;
          addText(this, e.x, e.y - e.radius - 14, '暴击！', '#ef476f', 13);
        }
        e.hp -= dmg;
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
      if (e.hp <= 0) continue;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let mx = dx / d, my = dy / d;
      let speed = e.speed;
      if (e.type === 'weaver') {
        const s = Math.sin(this.time * ENEMY_TYPES.weaver.sineFreq + e.phase) * ENEMY_TYPES.weaver.sineAmp;
        mx += (-dy / d) * (s / e.speed);
        my += (dx / d) * (s / e.speed);
        const ml = Math.hypot(mx, my) || 1;
        mx /= ml; my /= ml;
      } else if (e.type === 'shooter') {
        const def = ENEMY_TYPES.shooter;
        e.aim = Math.atan2(dy, dx);
        if (d > def.range + 36) {
          // Too far: close in (mx/my already point at the player).
        } else if (d < def.range - 36) {
          mx = -mx; my = -my; // too close: back away
        } else {
          // In the pocket: strafe sideways around the player.
          mx = (-dy / d) * e.strafe;
          my = (dx / d) * e.strafe;
          speed *= 0.45;
          if (Math.random() < dt * 0.25) e.strafe = -e.strafe;
        }
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && d < def.fireRange) {
          e.fireTimer = def.fireInterval * (0.9 + Math.random() * 0.25);
          if (this.ebullets.length < CAPS.ebullets) {
            this.ebullets.push(createEnemyBullet(
              e.x + Math.cos(e.aim) * (e.radius + 4),
              e.y + Math.sin(e.aim) * (e.radius + 4),
              e.aim,
            ));
            burst(this, e.x + Math.cos(e.aim) * e.radius, e.y + Math.sin(e.aim) * e.radius, e.color, 3, 120, 0.2, 2);
            sfx.enemyShoot();
          }
        }
      } else if (e.type === 'bomber') {
        const def = ENEMY_TYPES.bomber;
        if (e.fuse < 0 && d < def.fuseRange) {
          e.fuse = def.fuseTime;
          sfx.fuse();
        }
        if (e.fuse >= 0) {
          e.fuse -= dt;
          speed *= 0.3; // it plants itself while the fuse burns
          if (e.fuse <= 0) {
            this.explodeBomber(e);
            continue;
          }
        }
      }
      e.x += (mx * speed + e.knockX) * dt;
      e.y += (my * speed + e.knockY) * dt;
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
      if (list[i].hp <= 0) continue;
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (b.hp <= 0) continue;
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
    // Credit anything the bomber blasts finished off.
    this.sweepDead();
    if (this.mode !== 'playing') return;
    // Contact damage.
    for (const e of list) {
      if (e.hp <= 0) continue;
      const dx = p.x - e.x, dy = p.y - e.y;
      const rr = e.radius + p.radius - 2;
      if (dx * dx + dy * dy < rr * rr) {
        this.damagePlayer(e.damage, e.x, e.y);
        if (this.mode !== 'playing') return;
      }
    }
  }

  updateEBullets(dt) {
    const p = this.player;
    const margin = 60;
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -margin || b.x > this.w + margin || b.y < -margin || b.y > this.h + margin) {
        this.ebullets.splice(i, 1);
        continue;
      }
      const dx = p.x - b.x, dy = p.y - b.y;
      const rr = p.radius + b.radius;
      if (dx * dx + dy * dy < rr * rr) {
        this.ebullets.splice(i, 1);
        // The Aegis shield blocks enemy bolts exactly like contact hits.
        this.damagePlayer(b.damage, b.x, b.y);
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
      if (s.vacuum) {
        // Magnet item: every shard on the field homes in at full speed.
        s.x += (dx / (d || 1)) * 640 * dt;
        s.y += (dy / (d || 1)) * 640 * dt;
      } else if (d < p.magnet) {
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

  updateItems(dt) {
    const p = this.player;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.age += dt;
      item.bob += dt * 3;
      if (item.age >= item.life) { this.items.splice(i, 1); continue; }
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vx *= Math.exp(-3 * dt);
      item.vy *= Math.exp(-3 * dt);
      const dx = p.x - item.x, dy = p.y - item.y;
      const rr = p.radius + item.radius + 4;
      if (dx * dx + dy * dy < rr * rr) {
        this.items.splice(i, 1);
        this.applyItem(item);
        if (this.mode !== 'playing') return; // a bomb item may have ended it
      }
    }
  }
}
