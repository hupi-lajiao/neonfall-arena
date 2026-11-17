// NEONFALL ARENA — all drawing. The static background (nebula washes +
// starfield + perspective grid) is pre-rendered to an offscreen canvas on
// resize; each frame then just blits it and draws the live entities, HUD
// and menu overlays on top. All UI text is Chinese; the game's name stays
// NEONFALL ARENA with a Chinese subtitle.

import { TAU, ENEMY_TYPES, ITEMS, ITEM_DEFS, DIFFICULTIES, DIFFICULTY_ORDER } from './config.js';
import { touch } from './input.js';

const FONT = '"Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", system-ui, sans-serif';

// Soft nebula blobs laid over the deep-space base: [x, y, radius, colour].
const NEBULA = [
  [0.22, 0.28, 0.55, 'rgba(123, 47, 247, 0.20)'],   // violet
  [0.80, 0.20, 0.48, 'rgba(0, 229, 255, 0.13)'],    // cyan
  [0.68, 0.78, 0.52, 'rgba(255, 56, 96, 0.11)'],    // magenta
  [0.12, 0.85, 0.42, 'rgba(46, 110, 255, 0.14)'],   // deep blue
  [0.50, 0.45, 0.34, 'rgba(181, 23, 245, 0.09)'],   // faint purple heart
];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bg = null;
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
  }

  resize(w, h, dpr = 1) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.bg = document.createElement('canvas');
    this.bg.width = Math.round(w * dpr);
    this.bg.height = Math.round(h * dpr);
    const c = this.bg.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Deep-space base.
    const grad = c.createRadialGradient(w / 2, h * 0.42, 60, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    grad.addColorStop(0, '#0a0d24');
    grad.addColorStop(0.55, '#060818');
    grad.addColorStop(1, '#03040a');
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);
    // Nebula: large, soft radial washes of colour over the base.
    for (const [fx, fy, fr, color] of NEBULA) {
      const r = Math.max(w, h) * fr;
      const ng = c.createRadialGradient(w * fx, h * fy, 0, w * fx, h * fy, r);
      ng.addColorStop(0, color);
      ng.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = ng;
      c.fillRect(0, 0, w, h);
    }
    // Starfield.
    for (let i = 0; i < 190; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = Math.random() * 1.4 + 0.3;
      c.globalAlpha = 0.25 + Math.random() * 0.65;
      c.fillStyle = Math.random() < 0.12 ? '#7df9ff' : '#cfd8ff';
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    // Perspective floor grid: a vanishing point above centre, rays fanning out
    // and horizontal lines crowding toward the horizon.
    const horizon = h * 0.60;
    const vx = w / 2;
    c.strokeStyle = 'rgba(64, 224, 255, 0.13)';
    c.lineWidth = 1;
    for (let i = -14; i <= 14; i++) {
      c.beginPath();
      c.moveTo(vx, horizon);
      c.lineTo(vx + i * (w / 9), h + 40);
      c.stroke();
    }
    for (let i = 0; i < 11; i++) {
      const t = i / 10;
      const y = horizon + (h - horizon) * t * t;
      c.globalAlpha = 0.05 + t * 0.12;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.globalAlpha = 1;
    // Horizon glow line.
    const hg = c.createLinearGradient(0, 0, 0, 0);
    hg.addColorStop(0, 'rgba(0,229,255,0)');
    hg.addColorStop(0.5, 'rgba(0,229,255,0.35)');
    hg.addColorStop(1, 'rgba(0,229,255,0)');
    c.fillStyle = hg;
    c.fillRect(0, horizon - 1, w, 2);
  }

  draw(game) {
    const { ctx } = this;
    const w = this.w, h = this.h;
    ctx.save();
    if (game.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    }
    ctx.drawImage(this.bg, 0, 0, w, h);
    this.drawShards(game);
    this.drawItems(game);
    this.drawEnemies(game);
    this.drawBullets(game);
    this.drawEBullets(game);
    if (game.mode !== 'title') this.drawPlayer(game);
    this.drawParticles(game);
    this.drawTexts(game);
    ctx.restore();

    this.drawTouchControls();
    this.drawHud(game);
    if (game.mode === 'title') this.drawTitle(game);
    else if (game.mode === 'levelup') this.drawLevelUp(game);
    else if (game.mode === 'paused') this.drawCentered(game, '已暂停', '按 P 或点击继续');
    else if (game.mode === 'gameover') this.drawEnd(game, false);
    else if (game.mode === 'victory') this.drawEnd(game, true);
  }

  // ---- world entities ------------------------------------------------------

  polygon(x, y, radius, sides, rot) {
    const { ctx } = this;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * TAU;
      const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  drawShards(game) {
    const { ctx } = this;
    ctx.fillStyle = '#2ee66b';
    for (const s of game.shards) {
      const r = s.radius + Math.sin(s.bob) * 1.1;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.bob * 0.7);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(-r / 1.4, -r / 1.4, r * 1.4, r * 1.4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawItems(game) {
    const { ctx } = this;
    const now = performance.now() / 1000;
    for (const item of game.items) {
      const def = ITEM_DEFS[item.type];
      const remaining = item.life - item.age;
      // Blink out in the last seconds before the drop fades.
      let alpha = 1;
      if (remaining < ITEMS.blinkAt) alpha = (Math.sin(now * 16) > -0.2) ? 1 : 0.2;
      const y = item.y + Math.sin(item.bob) * 3;
      ctx.save();
      ctx.globalAlpha = alpha;
      // Pulsing halo ring.
      ctx.beginPath();
      ctx.arc(item.x, y, item.radius + 3 + Math.sin(item.bob * 1.4) * 1.6, 0, TAU);
      ctx.strokeStyle = def.color;
      ctx.globalAlpha = alpha * 0.55;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.globalAlpha = alpha;
      // Dark disc so the icon reads against the nebula.
      ctx.beginPath();
      ctx.arc(item.x, y, item.radius, 0, TAU);
      ctx.fillStyle = 'rgba(6, 8, 22, 0.88)';
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.translate(item.x, y);
      this.drawItemIcon(item.type, def.color);
      ctx.restore();
      // Tiny label under the disc.
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = def.color;
      ctx.font = `10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(def.label, item.x, y + item.radius + 13);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawItemIcon(type, color) {
    const { ctx } = this;
    if (type === 'medkit') {
      ctx.fillStyle = color;
      ctx.fillRect(-7.5, -7.5, 15, 15);
      ctx.fillStyle = '#04140a';
      ctx.fillRect(-1.8, -5, 3.6, 10);
      ctx.fillRect(-5, -1.8, 10, 3.6);
    } else if (type === 'bomb') {
      ctx.beginPath();
      ctx.arc(0, 1.5, 7.5, 0, TAU);
      ctx.fillStyle = '#151828';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, -5);
      ctx.quadraticCurveTo(5, -9, 8, -8);
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      ctx.arc(8, -8, 1.8, 0, TAU);
      ctx.fill();
    } else if (type === 'magnet') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.arc(0, -1, 5.6, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-5.6, -1); ctx.lineTo(-5.6, 6.5);
      ctx.moveTo(5.6, -1); ctx.lineTo(5.6, 6.5);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-7.9, 4.6, 4.6, 3.4);
      ctx.fillRect(3.3, 4.6, 4.6, 3.4);
    } else { // rapid: a lightning bolt
      ctx.beginPath();
      ctx.moveTo(2.5, -9);
      ctx.lineTo(-4, 1);
      ctx.lineTo(-0.5, 1);
      ctx.lineTo(-2.5, 9);
      ctx.lineTo(4.5, -1);
      ctx.lineTo(1, -1);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  drawEnemies(game) {
    const { ctx } = this;
    const now = performance.now() / 1000;
    for (const e of game.enemies) {
      // A lit bomber telegraphs: flashing body plus a faint blast-radius ring.
      if (e.type === 'bomber' && e.fuse >= 0) {
        const def = ENEMY_TYPES.bomber;
        ctx.beginPath();
        ctx.arc(e.x, e.y, def.boomRadius, 0, TAU);
        ctx.fillStyle = `rgba(255, 87, 20, ${0.05 + 0.04 * Math.sin(now * 24)})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 87, 20, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Wide faint stroke under a bright thin one: neon glow without shadowBlur.
      this.polygon(e.x, e.y, e.radius, e.sides, e.rot);
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.stroke();
      const litFuse = e.type === 'bomber' && e.fuse >= 0 && Math.floor(now * 14) % 2 === 0;
      ctx.fillStyle = e.flash > 0 || litFuse ? '#ffffff' : 'rgba(10, 10, 24, 0.72)';
      ctx.fill();
      // Bright core.
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 0.28, 0, TAU);
      ctx.fillStyle = e.flash > 0 || litFuse ? '#ffffff' : e.color;
      ctx.fill();
      if (e.type === 'shooter') {
        // Barrel pointing at the player.
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(e.aim) * e.radius * 0.4, e.y + Math.sin(e.aim) * e.radius * 0.4);
        ctx.lineTo(e.x + Math.cos(e.aim) * (e.radius + 6), e.y + Math.sin(e.aim) * (e.radius + 6));
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if (e.isBoss) {
        this.polygon(e.x, e.y, e.radius * 0.68, e.sides, -e.rot * 1.6);
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (e.hp < e.maxHp) {
        // Mini HP bar over damaged enemies.
        const bw = e.radius * 2;
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 9, bw, 3.5);
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 9, bw * Math.max(0, e.hp / e.maxHp), 3.5);
      }
    }
  }

  drawBullets(game) {
    const { ctx } = this;
    ctx.fillStyle = '#ffe600';
    for (const b of game.bullets) {
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 2.1, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, TAU);
      ctx.fill();
    }
  }

  drawEBullets(game) {
    const { ctx } = this;
    for (const b of game.ebullets) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#ff5d8f';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 2.2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, TAU);
      ctx.fillStyle = '#ffd7e6';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawPlayer(game) {
    const { ctx } = this;
    const p = game.player;
    // Blink while invulnerable.
    if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) ctx.globalAlpha = 0.35;
    // Muzzle flash.
    if (p.flash > 0) {
      const fx = p.x + Math.cos(p.aim) * (p.radius + 14);
      const fy = p.y + Math.sin(p.aim) * (p.radius + 14);
      ctx.fillStyle = 'rgba(255, 230, 0, 0.85)';
      ctx.beginPath();
      ctx.arc(fx, fy, 7, 0, TAU);
      ctx.fill();
    }
    // Hull glow + body.
    ctx.save();
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, TAU);
    ctx.fillStyle = '#0b2b3a';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, TAU);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Nose pointing at the aim.
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.aim) * (p.radius + 7), p.y + Math.sin(p.aim) * (p.radius + 7));
    ctx.lineTo(p.x + Math.cos(p.aim + 2.5) * p.radius * 0.7, p.y + Math.sin(p.aim + 2.5) * p.radius * 0.7);
    ctx.lineTo(p.x + Math.cos(p.aim - 2.5) * p.radius * 0.7, p.y + Math.sin(p.aim - 2.5) * p.radius * 0.7);
    ctx.closePath();
    ctx.fillStyle = '#7df9ff';
    ctx.fill();
    // Core.
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // Aegis shield ring.
    if (p.shieldReady) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 7, 0, TAU);
      ctx.strokeStyle = 'rgba(125, 249, 255, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([7, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  drawParticles(game) {
    const { ctx } = this;
    for (const pt of game.particles) {
      const frac = Math.max(0, pt.life / pt.maxLife);
      if (pt.shape === 'ring') {
        ctx.globalAlpha = frac * 0.8;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, TAU);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (pt.shape === 'glow') {
        ctx.globalAlpha = frac * 0.75;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * 1.9, 0, TAU);
        ctx.fill();
      } else {
        ctx.globalAlpha = frac;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(game) {
    const { ctx } = this;
    ctx.textAlign = 'center';
    for (const t of game.texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life / t.maxLife + 0.25));
      ctx.font = `bold ${t.size}px ${FONT}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---- HUD -------------------------------------------------------------------

  bar(x, y, w, h, frac, back, fill) {
    const { ctx } = this;
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  drawHud(game) {
    if (game.mode === 'title') return;
    const { ctx } = this;
    const p = game.player;
    const compact = this.w < 560;
    const left = compact ? 12 : 18;
    ctx.textAlign = 'left';
    ctx.font = `bold ${compact ? 11 : 13}px ${FONT}`;
    // HP, top-left.
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`生命 ${Math.ceil(p.hp)} / ${p.maxHp}`, left, compact ? 18 : 26);
    const hpWidth = compact ? Math.min(112, this.w * 0.32) : 220;
    this.bar(left, compact ? 25 : 32, hpWidth, compact ? 8 : 13, p.hp / p.maxHp, 'rgba(255,56,96,0.25)', p.hp / p.maxHp > 0.3 ? '#2ee66b' : '#ff3860');
    // Status lines under the HP bar: shield first, then the rapid-fire buff.
    let statusY = compact ? 47 : 62;
    if (p.hasShield) {
      ctx.fillStyle = p.shieldReady ? '#7df9ff' : 'rgba(125,249,255,0.4)';
      ctx.font = `bold ${compact ? 9 : 12}px ${FONT}`;
      ctx.fillText(p.shieldReady ? '◈ 护盾就绪' : '◈ 护盾充能中', left, statusY);
      statusY += compact ? 14 : 18;
    }
    if (p.rapidTimer > 0) {
      ctx.fillStyle = '#ffe600';
      ctx.font = `bold ${compact ? 9 : 12}px ${FONT}`;
      ctx.fillText(`⚡ 急速射击 ${p.rapidTimer.toFixed(0)} 秒`, left, statusY);
    }
    // Wave or boss bar, top-center.
    ctx.textAlign = 'center';
    if (game.boss) {
      ctx.fillStyle = '#00e5ff';
      ctx.font = `bold ${compact ? 11 : 15}px ${FONT}`;
      ctx.fillText('— WARDEN · 守护者 —', this.w / 2, compact ? 18 : 26);
      const bossWidth = Math.min(compact ? this.w - 24 : 380, this.w - 24);
      this.bar(this.w / 2 - bossWidth / 2, compact ? 40 : 32, bossWidth, compact ? 8 : 12, game.boss.hp / game.boss.maxHp, 'rgba(0,229,255,0.15)', '#00e5ff');
    } else if (game.wave > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${compact ? 11 : 16}px ${FONT}`;
      ctx.fillText(`第 ${game.wave} 波 / 共 5 波`, this.w / 2, compact ? 18 : 30);
    }
    // Score, time and difficulty, top-right.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${compact ? 11 : 15}px ${FONT}`;
    ctx.fillText(`分数 ${game.score}`, this.w - left, compact ? 18 : 26);
    const t = game.mode === 'gameover' || game.mode === 'victory' ? game.finalTime : game.time;
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(Math.floor(t % 60)).padStart(2, '0');
    ctx.font = `${compact ? 10 : 13}px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`时间 ${mm}:${ss}`, this.w - left, compact ? 35 : 46);
    ctx.font = `${compact ? 9 : 11}px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(`难度：${DIFFICULTIES[game.difficulty].name}`, this.w - left, compact ? 49 : 64);
    // Combo, under the difficulty line.
    if (game.combo.count >= 2) {
      const mult = game.multiplier().toFixed(1);
      ctx.fillStyle = '#ffe600';
      ctx.font = `bold ${compact ? 10 : 16}px ${FONT}`;
      ctx.fillText(`连击 ×${mult}（${game.combo.count}）`, this.w - left, compact ? 65 : 90);
    }
    // XP bar along the bottom.
    const frac = p.xp / p.xpNext;
    this.bar(left, this.h - 20, this.w - left * 2, compact ? 7 : 10, frac, 'rgba(46,230,107,0.15)', '#2ee66b');
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2ee66b';
    ctx.font = `bold ${compact ? 10 : 12}px ${FONT}`;
    ctx.fillText(`等级 ${p.level}`, left, this.h - (compact ? 25 : 26));
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    if (!compact) {
      ctx.font = `11px ${FONT}`;
      ctx.fillText('M 静音 · P 暂停', this.w - 18, this.h - 26);
    }
  }

  // ---- overlays ---------------------------------------------------------------

  drawTouchControls() {
    if (!touch.joystickActive && !touch.fire) return;
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = 2;
    if (touch.joystickActive) {
      ctx.globalAlpha = 0.48;
      ctx.beginPath();
      ctx.arc(touch.originX, touch.originY, 52, 0, TAU);
      ctx.fillStyle = 'rgba(125,249,255,0.08)';
      ctx.fill();
      ctx.strokeStyle = '#7df9ff';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(touch.originX + touch.moveX * 52, touch.originY + touch.moveY * 52, 21, 0, TAU);
      ctx.fillStyle = 'rgba(125,249,255,0.35)';
      ctx.fill();
      ctx.stroke();
    }
    if (touch.fire) {
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(touch.aimX, touch.aimY, 22, 0, TAU);
      ctx.strokeStyle = '#ffe600';
      ctx.stroke();
    }
    ctx.restore();
  }

  dim(alpha = 0.62) {
    const { ctx } = this;
    ctx.fillStyle = `rgba(3, 4, 12, ${alpha})`;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  drawTitle(game) {
    const { ctx } = this;
    const cx = this.w / 2;
    const titleSize = Math.min(76, Math.max(34, this.w * 0.105));
    const titleY = Math.max(72, this.h * 0.20);
    const subSize = Math.min(17, Math.max(11, this.w * 0.04));
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#e8fbff';
    ctx.font = `900 ${titleSize}px ${FONT}`;
    ctx.fillText('NEONFALL', cx, titleY, this.w - 24);
    ctx.shadowColor = '#ff3860';
    ctx.fillText('ARENA', cx, titleY + titleSize * 1.03, this.w - 24);
    ctx.restore();
    const base = titleY + titleSize * 1.78;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `${subSize}px ${FONT}`;
    ctx.fillText('霓虹竞技场 — 撑过五波攻势，击落守护者 WARDEN', cx, base, this.w - 24);
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.font = `${Math.max(10, subSize - 2)}px ${FONT}`;
    ctx.fillText('WASD / 方向键移动 · 鼠标瞄准 · 按住左键或空格开火', cx, base + 28, this.w - 24);
    ctx.fillText('触屏：左半屏移动 · 右半屏瞄准开火 · 拾取道具强化自己', cx, base + 50, this.w - 24);
    // Difficulty picker: three boxes, the chosen one lit up.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `bold ${Math.max(11, subSize - 1)}px ${FONT}`;
    ctx.fillText('— 选择难度 —', cx, base + 84, this.w - 24);
    game.diffRects = [];
    const boxW = Math.min(190, (this.w - 64) / 3);
    const boxH = 68;
    const gap = 14;
    const totalW = boxW * 3 + gap * 2;
    const x0 = cx - totalW / 2;
    const y0 = base + 98;
    DIFFICULTY_ORDER.forEach((id, i) => {
      const def = DIFFICULTIES[id];
      const x = x0 + i * (boxW + gap);
      game.diffRects.push({ x, y: y0, w: boxW, h: boxH, id });
      const selected = game.difficulty === id;
      ctx.fillStyle = selected ? 'rgba(0, 229, 255, 0.14)' : 'rgba(10, 14, 34, 0.85)';
      ctx.fillRect(x, y0, boxW, boxH);
      ctx.strokeStyle = selected ? '#00e5ff' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = selected ? 2.4 : 1.2;
      ctx.strokeRect(x + 1, y0 + 1, boxW - 2, boxH - 2);
      ctx.fillStyle = selected ? '#e8fbff' : 'rgba(255,255,255,0.8)';
      ctx.font = `bold 19px ${FONT}`;
      ctx.fillText(def.name, x + boxW / 2, y0 + 26, boxW - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `11px ${FONT}`;
      ctx.fillText(def.desc, x + boxW / 2, y0 + 46, boxW - 10);
      ctx.fillStyle = selected ? '#00e5ff' : 'rgba(255,255,255,0.4)';
      ctx.font = `bold 10px ${FONT}`;
      ctx.fillText(`[ ${i + 1} ]`, x + boxW / 2, y0 + boxH - 6, boxW - 10);
    });
    const blink = Math.floor(performance.now() / 550) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ffe600';
      ctx.font = `bold ${Math.min(19, Math.max(12, this.w * 0.05))}px ${FONT}`;
      ctx.fillText('点击或按回车开始', cx, y0 + boxH + 36, this.w - 24);
    }
  }

  drawLevelUp(game) {
    const { ctx } = this;
    this.dim(0.66);
    const cx = this.w / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe600';
    const compact = this.w < 720 || this.h < 480;
    const headingY = compact ? this.h * 0.12 : this.h * 0.30;
    ctx.font = `900 ${compact ? 25 : 34}px ${FONT}`;
    ctx.fillText('升级！', cx, headingY);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `${compact ? 11 : 15}px ${FONT}`;
    ctx.fillText('选择一张升级卡 — 点击卡片或按 1 / 2 / 3', cx, headingY + 27, this.w - 24);
    game.cardRects = [];
    const vertical = this.w < 720 || this.h < 480;
    const cardW = vertical ? Math.min(320, this.w - 28) : 248;
    const cardH = vertical ? Math.max(56, Math.min(108, (this.h - this.h * 0.23 - 24 - 16) / 3)) : 148;
    const gap = vertical ? 8 : 26;
    const y0 = vertical ? this.h * 0.23 : this.h * 0.30 + 62;
    const totalW = cardW * 3 + gap * 2;
    const x0 = vertical ? cx - cardW / 2 : cx - totalW / 2;
    game.choices.forEach((choice, i) => {
      const x = vertical ? x0 : x0 + i * (cardW + gap);
      const y = vertical ? y0 + i * (cardH + gap) : y0;
      game.cardRects.push({ x, y, w: cardW, h: cardH });
      ctx.fillStyle = 'rgba(10, 14, 34, 0.95)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = choice.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, cardW - 2, cardH - 2);
      // Card glyph: a small polygon in the upgrade's colour.
      const glyphY = vertical ? y + cardH * 0.25 : y + 42;
      this.polygon(x + cardW / 2, glyphY, vertical ? 11 : 17, 3 + (i % 4), performance.now() / 900 + i);
      ctx.fillStyle = choice.color;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${vertical ? 14 : 17}px ${FONT}`;
      ctx.fillText(choice.name, x + cardW / 2, vertical ? y + cardH * 0.57 : y + 88, cardW - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = `${vertical ? 10 : 13}px ${FONT}`;
      ctx.fillText(choice.desc, x + cardW / 2, vertical ? y + cardH * 0.79 : y + 112, cardW - 12);
      ctx.fillStyle = choice.color;
      ctx.font = `bold ${vertical ? 10 : 13}px ${FONT}`;
      ctx.fillText(`[ ${i + 1} ]`, x + cardW / 2, vertical ? y + cardH * 0.94 : y + 136);
    });
  }

  drawCentered(game, title, sub) {
    const { ctx } = this;
    this.dim(0.55);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 44px ${FONT}`;
    ctx.fillText(title, this.w / 2, this.h * 0.44);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `16px ${FONT}`;
    ctx.fillText(sub, this.w / 2, this.h * 0.44 + 38);
  }

  drawEnd(game, won) {
    const { ctx } = this;
    this.dim(0.6);
    const cx = this.w / 2;
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = won ? '#2ee66b' : '#ff3860';
    ctx.shadowBlur = 28;
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 52px ${FONT}`;
    ctx.fillText(won ? '胜利！' : '游戏结束', cx, this.h * 0.36);
    ctx.restore();
    const t = game.finalTime;
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(Math.floor(t % 60)).padStart(2, '0');
    const lines = [];
    if (won) lines.push('WARDEN 已被击落，竞技场属于你了。');
    lines.push(`最终分数：${game.score}`);
    lines.push(`难度：${DIFFICULTIES[game.difficulty].name}`);
    lines.push(won ? `通关时间：${mm}:${ss}` : `坚持到第 ${game.wave} 波 · 用时 ${mm}:${ss}`);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `17px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, cx, this.h * 0.36 + 40 + i * 28));
    const blink = Math.floor(performance.now() / 550) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ffe600';
      ctx.font = `bold 18px ${FONT}`;
      ctx.fillText('按 R 或点击重新开始', cx, this.h * 0.36 + 40 + lines.length * 28 + 22);
    }
  }
}
