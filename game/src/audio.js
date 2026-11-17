// NEONFALL ARENA — sound effects synthesized at runtime with WebAudio oscillators.
// No audio files, no network. The context is created lazily on the first user
// gesture (browser autoplay rules), and every effect is a short oscillator blip
// or a filtered noise burst shaped by a gain envelope.

class SoundFX {
  constructor() {
    this.ctx = null;       // AudioContext, created on first gesture
    this.master = null;    // master GainNode
    this.muted = false;
    this.noiseBuf = null;  // shared white-noise buffer for explosions
  }

  // Call from any click / keydown handler. Safe to call repeatedly.
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    // One second of white noise, reused by every explosion.
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  // A single oscillator note with an exponential decay envelope.
  tone({ type = 'square', from = 440, to = null, dur = 0.1, vol = 0.5, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // A burst of white noise through a lowpass filter: explosions and impacts.
  noise({ dur = 0.25, vol = 0.6, freq = 900, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(80, t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  shoot()      { this.tone({ type: 'square', from: 880, to: 320, dur: 0.07, vol: 0.16 }); }
  enemyShoot() { this.tone({ type: 'sawtooth', from: 340, to: 190, dur: 0.11, vol: 0.13 }); }
  fuse()       { this.tone({ type: 'square', from: 1500, to: 1500, dur: 0.05, vol: 0.12 }); this.tone({ type: 'square', from: 1500, dur: 0.05, vol: 0.12, delay: 0.12 }); }
  hit()        { this.tone({ type: 'sawtooth', from: 300, to: 180, dur: 0.05, vol: 0.12 }); }
  explosion()  { this.noise({ dur: 0.28, vol: 0.5, freq: 1100 }); this.tone({ type: 'triangle', from: 160, to: 40, dur: 0.25, vol: 0.4 }); }
  bigBoom()    { this.noise({ dur: 0.7, vol: 0.8, freq: 1600 }); this.tone({ type: 'triangle', from: 120, to: 28, dur: 0.65, vol: 0.6 }); }
  pickup()     { this.tone({ type: 'sine', from: 660, to: 990, dur: 0.08, vol: 0.22 }); }
  itemGet() {
    const notes = [784, 988, 1319];
    notes.forEach((f, i) => this.tone({ type: 'sine', from: f, dur: 0.09, vol: 0.22, delay: i * 0.05 }));
  }
  heal() {
    this.tone({ type: 'sine', from: 520, to: 780, dur: 0.18, vol: 0.25 });
    this.tone({ type: 'sine', from: 780, to: 1040, dur: 0.16, vol: 0.18, delay: 0.08 });
  }
  vacuum()     { this.tone({ type: 'sine', from: 240, to: 1180, dur: 0.28, vol: 0.2 }); }
  hurt()       { this.tone({ type: 'sawtooth', from: 220, to: 70, dur: 0.22, vol: 0.5 }); this.noise({ dur: 0.15, vol: 0.3, freq: 700 }); }
  shieldPop()  { this.tone({ type: 'sine', from: 1200, to: 500, dur: 0.14, vol: 0.35 }); }
  levelUp() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone({ type: 'square', from: f, dur: 0.12, vol: 0.25, delay: i * 0.07 }));
  }
  bossAlarm() {
    for (let i = 0; i < 3; i++) {
      this.tone({ type: 'sawtooth', from: 196, dur: 0.16, vol: 0.4, delay: i * 0.36 });
      this.tone({ type: 'sawtooth', from: 147, dur: 0.16, vol: 0.4, delay: i * 0.36 + 0.18 });
    }
  }
  victory() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => this.tone({ type: 'triangle', from: f, dur: 0.22, vol: 0.3, delay: i * 0.13 }));
  }
  gameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => this.tone({ type: 'triangle', from: f, dur: 0.3, vol: 0.3, delay: i * 0.18 }));
  }
}

export const sfx = new SoundFX();
