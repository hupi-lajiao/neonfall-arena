// NEONFALL ARENA — all drawing. The static background (starfield + perspective
// grid) is pre-rendered to an offscreen canvas on resize; each frame then just
// blits it and draws the live entities, HUD and menu overlays on top.

import { TAU } from './config.js';
import { touch } from './input.js';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

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
    // Starfield.
    for (let i = 0; i < 170; i++) {
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
    this.drawEnemies(game);
    this.drawBullets(game);
    if (game.mode !== 'title') this.drawPlayer(game);
    this.drawParticles(game);
    this.drawTexts(game);
    ctx.restore();

    this.drawTouchControls();
    this.drawHud(game);
    if (game.mode === 'title') this.drawTitle(game);
    else if (game.mode === 'levelup') this.drawLevelUp(game);
    else if (game.mode === 'paused') this.drawCentered(game, 'PAUSED', 'Press P or click to resume');
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

  drawEnemies(game) {
    const { ctx } = this;
    for (const e of game.enemies) {
      // Wide faint stroke under a bright thin one: neon glow without shadowBlur.
      this.polygon(e.x, e.y, e.radius, e.sides, e.rot);
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : 'rgba(10, 10, 24, 0.72)';
      ctx.fill();
      // Bright core.
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 0.28, 0, TAU);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.color;
      ctx.fill();
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
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
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
    ctx.fillText(`HP ${Math.ceil(p.hp)} / ${p.maxHp}`, left, compact ? 18 : 26);
    const hpWidth = compact ? Math.min(112, this.w * 0.32) : 220;
    this.bar(left, compact ? 25 : 32, hpWidth, compact ? 8 : 13, p.hp / p.maxHp, 'rgba(255,56,96,0.25)', p.hp / p.maxHp > 0.3 ? '#2ee66b' : '#ff3860');
    if (p.hasShield) {
      ctx.fillStyle = p.shieldReady ? '#7df9ff' : 'rgba(125,249,255,0.4)';
      ctx.font = `bold ${compact ? 9 : 12}px ${FONT}`;
      ctx.fillText(p.shieldReady ? '◈ SHIELD UP' : '◈ SHIELD CHARGING', left, compact ? 47 : 62);
    }
    // Wave or boss bar, top-center.
    ctx.textAlign = 'center';
    if (game.boss) {
      ctx.fillStyle = '#00e5ff';
      ctx.font = `bold ${compact ? 11 : 15}px ${FONT}`;
      ctx.fillText('— WARDEN —', this.w / 2, compact ? 18 : 26);
      const bossWidth = Math.min(compact ? this.w - 24 : 380, this.w - 24);
      this.bar(this.w / 2 - bossWidth / 2, compact ? 40 : 32, bossWidth, compact ? 8 : 12, game.boss.hp / game.boss.maxHp, 'rgba(0,229,255,0.15)', '#00e5ff');
    } else if (game.wave > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${compact ? 11 : 16}px ${FONT}`;
      ctx.fillText(`WAVE ${game.wave} / 5`, this.w / 2, compact ? 18 : 30);
    }
    // Score and time, top-right.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${compact ? 11 : 15}px ${FONT}`;
    ctx.fillText(`SCORE ${game.score}`, this.w - left, compact ? 18 : 26);
    const t = game.mode === 'gameover' || game.mode === 'victory' ? game.finalTime : game.time;
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(Math.floor(t % 60)).padStart(2, '0');
    ctx.font = `${compact ? 10 : 13}px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`TIME ${mm}:${ss}`, this.w - left, compact ? 35 : 46);
    // Combo, under the score.
    if (game.combo.count >= 2) {
      const mult = game.multiplier().toFixed(1);
      ctx.fillStyle = '#ffe600';
      ctx.font = `bold ${compact ? 10 : 16}px ${FONT}`;
      ctx.fillText(`COMBO x${mult}  (${game.combo.count})`, this.w - left, compact ? 49 : 70);
    }
    // XP bar along the bottom.
    const frac = p.xp / p.xpNext;
    this.bar(left, this.h - 20, this.w - left * 2, compact ? 7 : 10, frac, 'rgba(46,230,107,0.15)', '#2ee66b');
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2ee66b';
    ctx.font = `bold ${compact ? 10 : 12}px ${FONT}`;
    ctx.fillText(`LEVEL ${p.level}`, left, this.h - (compact ? 25 : 26));
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    if (!compact) {
      ctx.font = `11px ${FONT}`;
      ctx.fillText('M mute · P pause', this.w - 18, this.h - 26);
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
    const titleY = Math.max(72, this.h * 0.22);
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
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = `${subSize}px ${FONT}`;
    ctx.fillText('Survive four waves of neon hostiles, then bring down the WARDEN.', cx, titleY + titleSize * 1.72, this.w - 24);
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.font = `${Math.max(10, subSize - 2)}px ${FONT}`;
    ctx.fillText('WASD / arrows — move · Mouse — aim · Hold click or Space — fire', cx, titleY + titleSize * 1.72 + 28, this.w - 24);
    ctx.fillText('Touch: left side move · right side aim and fire', cx, titleY + titleSize * 1.72 + 49, this.w - 24);
    ctx.fillText('Collect XP shards and upgrades · P pause · M mute', cx, titleY + titleSize * 1.72 + 70, this.w - 24);
    const blink = Math.floor(performance.now() / 550) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ffe600';
      ctx.font = `bold ${Math.min(20, Math.max(13, this.w * 0.055))}px ${FONT}`;
      ctx.fillText('TAP / CLICK OR PRESS ENTER TO START', cx, titleY + titleSize * 1.72 + 104, this.w - 24);
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
    ctx.fillText('LEVEL UP', cx, headingY);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `${compact ? 11 : 15}px ${FONT}`;
    ctx.fillText('Choose an upgrade — tap a card or press 1 / 2 / 3', cx, headingY + 27, this.w - 24);
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
    ctx.fillText(won ? 'VICTORY' : 'GAME OVER', cx, this.h * 0.36);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `17px ${FONT}`;
    if (won) ctx.fillText('The WARDEN is down. The arena is yours.', cx, this.h * 0.36 + 36);
    ctx.fillText(`Final score: ${game.score}`, cx, this.h * 0.36 + (won ? 68 : 44));
    const t = game.finalTime;
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(Math.floor(t % 60)).padStart(2, '0');
    ctx.fillText(won ? `Clear time: ${mm}:${ss}` : `Survived to wave ${game.wave} · Time ${mm}:${ss}`, cx, this.h * 0.36 + (won ? 96 : 72));
    const blink = Math.floor(performance.now() / 550) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ffe600';
      ctx.font = `bold 18px ${FONT}`;
      ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', cx, this.h * 0.36 + 148);
    }
  }
}
