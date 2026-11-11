'use strict';
/* Utilidades generales y sistema de sonido (WebAudio, todo sintetizado). */

const T = THREE;
const TAU = Math.PI * 2;
const $ = (id) => document.getElementById(id);
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const Store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
};

const Sound = (() => {
  let ctx = null, master = null, noiseBuf = null;
  let muted = Store.get('naves_mute', '0') === '1';
  let lastShot = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(f, f2, dur, vol, type = 'square', when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noise(dur, vol, f = 2000, f2 = 200, when = 0, type = 'lowpass') {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  // ---- música: secuenciador sencillo de 16 pasos ----
  const music = { timer: null, step: 0, next: 0, bpm: 112, root: 45, mode: 'menu' };
  const SCALE = [0, 3, 5, 7, 10, 12, 15];
  const PROG = [0, 0, -4, -2];
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function schedule(step, t) {
    const when = t - ctx.currentTime;
    const s = step % 16, bar = (step >> 4) % 4;
    const root = music.root + PROG[bar];
    const boss = music.mode === 'boss', menu = music.mode === 'menu';
    if (!menu) {
      if (s % 4 === 0) tone(120, 40, 0.16, 0.5, 'sine', when);
      if (s % 8 === 4) noise(0.12, 0.16, 5000, 1200, when);
      if (s % 2 === 1) noise(0.03, 0.05, 9000, 7000, when, 'highpass');
    }
    const bassPat = boss ? [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1] : [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    if (bassPat[s]) tone(hz(root - 12), null, 0.2, menu ? 0.1 : 0.17, 'sawtooth', when);
    const arpOn = menu ? s % 4 === 0 : boss ? true : s % 2 === 0;
    if (arpOn) {
      const idx = (s * 3 + bar * 2 + (step >> 6)) % SCALE.length;
      tone(hz(root + 12 + SCALE[idx]), null, menu ? 0.5 : 0.14, menu ? 0.035 : 0.045, menu ? 'triangle' : 'square', when);
    }
  }

  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    if (music.next < ctx.currentTime) music.next = ctx.currentTime + 0.05;
    while (music.next < ctx.currentTime + 0.2) {
      schedule(music.step, music.next);
      music.next += 60 / music.bpm / 4;
      music.step++;
    }
  }

  return {
    init,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      Store.set('naves_mute', muted ? '1' : '0');
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    music(mode, root) {
      music.mode = mode;
      if (root) music.root = root;
      music.bpm = mode === 'boss' ? 136 : mode === 'menu' ? 96 : 118;
      if (!music.timer) music.timer = setInterval(tick, 60);
    },
    stopMusic() { if (music.timer) { clearInterval(music.timer); music.timer = null; } },
    shoot(kind) {
      if (!ctx) return;
      const now = ctx.currentTime;
      if (now - lastShot < 0.085) return;
      lastShot = now;
      if (kind === 'heavy') { tone(300, 70, 0.16, 0.1, 'sawtooth'); noise(0.08, 0.05, 3000, 500); }
      else if (kind === 'spread') tone(1250, 420, 0.07, 0.045, 'square');
      else tone(900, 260, 0.08, 0.05, 'square');
    },
    eshoot() { tone(420, 180, 0.12, 0.05, 'triangle'); },
    hit() { noise(0.04, 0.06, 6000, 2500); },
    boom(size = 1) {
      const s = clamp(size, 0.5, 4);
      noise(0.25 + 0.18 * s, 0.22 + 0.06 * s, 2600, 90);
      tone(150, 32, 0.22 + 0.12 * s, 0.22, 'sine');
    },
    bigBoom() {
      noise(1.6, 0.6, 3200, 50);
      tone(110, 22, 1.4, 0.5, 'sine');
      noise(0.5, 0.3, 8000, 800, 0.15);
    },
    hurt() { tone(220, 50, 0.35, 0.3, 'sawtooth'); noise(0.3, 0.3, 1800, 150); },
    pickup() { [0, 4, 7, 12].forEach((n, i) => tone(hz(72 + n), null, 0.12, 0.09, 'square', i * 0.05)); },
    powerup() { [0, 5, 9, 12, 17].forEach((n, i) => tone(hz(69 + n), null, 0.14, 0.09, 'triangle', i * 0.045)); },
    special() { tone(90, 900, 0.5, 0.2, 'sawtooth'); noise(0.7, 0.25, 500, 6000); },
    missile() { noise(0.25, 0.08, 900, 3500, 0, 'bandpass'); },
    alarm() { for (let i = 0; i < 4; i++) { tone(620, null, 0.2, 0.13, 'square', i * 0.5); tone(440, null, 0.2, 0.13, 'square', i * 0.5 + 0.25); } },
    laser() { tone(1400, 180, 1.1, 0.12, 'sawtooth'); noise(1.2, 0.12, 5000, 700, 0, 'bandpass'); },
    charge() { tone(120, 1100, 1.0, 0.07, 'sine'); },
    select() { tone(660, 990, 0.08, 0.07, 'triangle'); },
    start() { [0, 7, 12, 19].forEach((n, i) => tone(hz(57 + n), null, 0.2, 0.1, 'sawtooth', i * 0.07)); },
    fanfare() { [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(hz(60 + n), null, 0.3, 0.1, 'square', i * 0.11)); },
    gameOver() { [12, 8, 5, 0].forEach((n, i) => tone(hz(48 + n), null, 0.45, 0.13, 'sawtooth', i * 0.28)); },
  };
})();
