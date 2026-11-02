/* Brain Blast Arena: shared helpers, save data, sound, heroes and hero drawing */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const choice = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const OUT = '#1b1530';
const FONT = '"Lilita One", "Arial Black", Impact, sans-serif';

// ---------- save data (per browser) ----------
const Save = {
  key: 'brain-blast-arena-v1',
  d: { trophies: 0, hero: 'blaze', level: 2, mode: 'grab', sfx: true, music: true, asked: 0, correct: 0, wins: 0, games: 0, bestStreak: 0, seenHow: false, lv: {}, seenUnlock: {} },
  load() { try { const s = JSON.parse(localStorage.getItem(this.key) || 'null'); if (s && typeof s === 'object') Object.assign(this.d, s); } catch (e) { /* private mode */ } },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.d)); } catch (e) { /* ignore */ } },
};
Save.load();

// ---------- sound (all synthesized, no files) ----------
const Sound = {
  ctx: null, sfx: null, mus: null, noiseBuf: null, last: {},
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx, master = c.createGain(); master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp); comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(master);
    this.mus = c.createGain(); this.mus.connect(master);
    const len = c.sampleRate; this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
  },
  apply() { if (!this.ctx) return; this.sfx.gain.value = Save.d.sfx ? 0.55 : 0; this.mus.gain.value = Save.d.music ? 0.16 : 0; },
  tone(f, dur, type = 'square', vol = 0.25, slide = null, delay = 0, dest = null) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol = 0.3, freq = 1200, type = 'lowpass', delay = 0, dest = null) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  play(name, pitch = 1) {
    if (!this.ctx || !Save.d.sfx) return;
    const now = performance.now(); if (this.last[name] && now - this.last[name] < 45) return; this.last[name] = now;
    const T = (f, d, ty, v, s, dl) => this.tone(f * pitch, d, ty, v, s ? s * pitch : null, dl);
    switch (name) {
      case 'shoot': T(880, 0.08, 'square', 0.08, 440); this.noise(0.05, 0.08, 3000, 'highpass'); break;
      case 'laser': T(1400, 0.18, 'sawtooth', 0.09, 300); break;
      case 'shotgun': this.noise(0.14, 0.25, 900); T(160, 0.1, 'square', 0.1, 60); break;
      case 'star': T(1200, 0.1, 'triangle', 0.12, 1800); T(1600, 0.08, 'sine', 0.06, 2400, 0.04); break;
      case 'lob': T(300, 0.25, 'triangle', 0.1, 700); break;
      case 'hit': this.noise(0.06, 0.18, 2200); T(220, 0.05, 'square', 0.05, 110); break;
      case 'hurt': T(200, 0.12, 'sawtooth', 0.1, 90); break;
      case 'boom': this.noise(0.45, 0.5, 600); T(120, 0.4, 'sine', 0.35, 35); break;
      case 'crate': this.noise(0.25, 0.4, 1400); T(180, 0.15, 'square', 0.1, 70); break;
      case 'gem': T(1318, 0.12, 'sine', 0.2); T(1760, 0.18, 'sine', 0.18, null, 0.07); break;
      case 'trap': T(600, 0.3, 'sawtooth', 0.16, 80); this.noise(0.2, 0.2, 4000, 'highpass'); break;
      case 'cube': [523, 659, 784, 1046].forEach((f, i) => T(f, 0.14, 'triangle', 0.16, null, i * 0.06)); break;
      case 'correct': [523, 659, 784, 1046, 1318].forEach((f, i) => T(f, 0.2, 'square', 0.09, null, i * 0.07)); break;
      case 'wrong': T(330, 0.22, 'square', 0.12, 300); T(220, 0.35, 'square', 0.12, 160, 0.2); break;
      case 'super': T(220, 0.5, 'sawtooth', 0.14, 1200); this.noise(0.4, 0.2, 2000, 'bandpass'); break;
      case 'ready': T(660, 0.1, 'triangle', 0.15); T(990, 0.18, 'triangle', 0.15, null, 0.08); break;
      case 'ko': T(500, 0.3, 'square', 0.14, 60); this.noise(0.3, 0.3, 1500); break;
      case 'tick': T(1000, 0.06, 'square', 0.08); break;
      case 'go': T(523, 0.12, 'square', 0.12); T(784, 0.12, 'square', 0.12, null, 0.1); T(1046, 0.3, 'square', 0.14, null, 0.2); break;
      case 'click': T(700, 0.05, 'triangle', 0.15, 900); break;
      case 'dash': this.noise(0.25, 0.3, 2500, 'bandpass'); T(400, 0.2, 'sawtooth', 0.08, 1200); break;
      case 'rule': [784, 988, 1175].forEach((f, i) => T(f, 0.16, 'triangle', 0.14, null, i * 0.09)); break;
      case 'win': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => T(f, 0.24, 'square', 0.11, null, i * 0.12)); break;
      case 'lose': [392, 370, 349, 262].forEach((f, i) => T(f, 0.35, 'triangle', 0.14, null, i * 0.22)); break;
      case 'trophy': [880, 1175, 1568].forEach((f, i) => T(f, 0.12, 'sine', 0.15, null, i * 0.05)); break;
    }
  },
};

// tiny step sequencer for background music
const Music = {
  on: false, style: 'lobby', step: 0, next: 0, bpm: 118,
  start(style) { this.style = style; this.bpm = style === 'battle' ? 132 : 112; if (!Sound.ctx) return; if (!this.on) { this.on = true; this.step = 0; this.next = Sound.ctx.currentTime + 0.1; } },
  stop() { this.on = false; },
  tick() {
    if (!this.on || !Sound.ctx || !Save.d.music) return;
    const c = Sound.ctx, spb = 60 / this.bpm / 4;
    if (this.next < c.currentTime - 0.5) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.15) { this.play(this.step, this.next); this.step = (this.step + 1) % 64; this.next += spb; }
  },
  play(s, t) {
    const d = Sound.mus, c = Sound.ctx, bar = Math.floor(s / 16), st = s % 16;
    const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]][bar];
    const mf = n => 440 * Math.pow(2, (n - 69) / 12);
    const osc = (f, dur, type, vol, when) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g); g.connect(d); o.start(when); o.stop(when + dur + 0.05);
    };
    const battle = this.style === 'battle';
    if (battle) {
      if (st % 4 === 0) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.2); }
      if (st === 4 || st === 12) Sound.noise(0.12, 0.35, 1800, 'highpass', t - c.currentTime, d);
      if (st % 2 === 1) Sound.noise(0.03, 0.12, 7000, 'highpass', t - c.currentTime, d);
      if (st % 2 === 0) osc(mf(prog[0] - 24), 0.12, 'square', 0.18, t);
      if ([0, 3, 6, 10, 12].includes(st)) osc(mf(prog[(st / 3 | 0) % 3] + 12), 0.1, 'triangle', 0.14, t);
    } else {
      if (st === 0 || st === 8) prog.forEach(n => osc(mf(n), 0.9, 'triangle', 0.09, t));
      if (st % 4 === 0) osc(mf(prog[0] - 12), 0.35, 'sine', 0.3, t);
      if (st % 2 === 0) osc(mf(prog[(st / 2) % 3] + 12), 0.16, 'sine', 0.08, t);
      if (st % 4 === 2) Sound.noise(0.03, 0.08, 8000, 'highpass', t - c.currentTime, d);
    }
  },
};

// ---------- heroes ----------
const HEROES = {
  blaze: { id: 'blaze', name: 'BLAZE', title: 'Speedy Fox', role: 'Blaster', color: '#ff8a1f', hp: 3200, speed: 245, unlock: 0, superCharge: 2600,
    atk: { type: 'burst', dmg: 360, count: 3, range: 7.5, speed: 1150, reload: 1.25, r: 9, color: '#ffd23f' },
    sup: { type: 'dash', name: 'COMET DASH', dmg: 1400, range: 5.5 },
    blurb: 'Fires a 3-shot burst. Super: rockets forward, smashing everyone in the way.', bars: { hp: 2, dmg: 3, range: 3, speed: 5 } },
  rocky: { id: 'rocky', name: 'ROCKY', title: 'Boulder Golem', role: 'Tank', color: '#8b97ad', hp: 5400, speed: 205, unlock: 0, superCharge: 3000,
    atk: { type: 'shotgun', dmg: 330, count: 5, spread: 0.55, range: 4.4, speed: 980, reload: 1.55, r: 8, color: '#d8c39a' },
    sup: { type: 'leap', name: 'BOULDER SLAM', dmg: 1800, range: 6.5, radius: 2.1 },
    blurb: 'Huge health, close-range rock blast. Super: leaps and slams, smashing walls.', bars: { hp: 5, dmg: 4, range: 1, speed: 2 } },
  luna: { id: 'luna', name: 'LUNA', title: 'Star Witch', role: 'Trickster', color: '#8a5cff', hp: 3000, speed: 228, unlock: 30, superCharge: 2700,
    atk: { type: 'bounce', dmg: 600, count: 2, spread: 0.14, range: 8.5, speed: 880, reload: 1.35, bounces: 2, r: 11, color: '#ffe066' },
    sup: { type: 'storm', name: 'STAR STORM', dmg: 520, count: 16, range: 6 },
    blurb: 'Stars bounce off walls. Super: a storm of stars in every direction.', bars: { hp: 3, dmg: 3, range: 4, speed: 4 } },
  volt: { id: 'volt', name: 'VOLT', title: 'Laser Robot', role: 'Sniper', color: '#2fb6c4', hp: 2600, speed: 215, unlock: 70, superCharge: 3200,
    atk: { type: 'laser', dmg: 1150, count: 1, range: 10.5, speed: 1700, reload: 1.85, r: 10, pierce: true, color: '#5ff4ff' },
    sup: { type: 'beam', name: 'MEGA BEAM', dmg: 2000, range: 13, r: 28 },
    blurb: 'Long-range piercing laser. Super: a mega beam that blasts through walls.', bars: { hp: 1, dmg: 5, range: 5, speed: 3 } },
  pi: { id: 'pi', name: 'PROF. PI', title: 'Pie-Throwing Penguin', role: 'Thrower', color: '#3b4f7a', hp: 2900, speed: 212, unlock: 120, superCharge: 3000,
    atk: { type: 'lob', dmg: 1050, count: 1, range: 7, radius: 1.25, flight: 0.62, reload: 1.7, color: '#ffb36b' },
    sup: { type: 'barrage', name: 'PIE STORM', dmg: 950, count: 7, range: 7, radius: 1.1 },
    blurb: 'Lobs exploding pies over walls. Super: a storm of 7 pies (3.14 was not enough).', bars: { hp: 2, dmg: 4, range: 4, speed: 3 } },
};
const HERO_ORDER = ['blaze', 'rocky', 'luna', 'volt', 'pi'];
const BOT_NAMES = ['Al Gebra', 'Sir Cumference', 'Hypotenoose', 'Sum Ting', 'Polly Gon', 'Rad Ical', 'Tan Gent', 'Cos Mo', 'Frac Tal', 'Dee Vide', 'Mean Mo', 'Theo Rem', 'Pi Rate', 'Ex Ponent', 'Matrix', 'Prime Time', 'Count Dracula', 'Isosceles', 'Al Gorithm', 'Ray Dius', 'Vertex', 'Infinity', 'Decimal Dan', 'Quad Ratic'];

// ---------- drawing helpers ----------
function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); }
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fs(ctx, fill, lw = 3) { ctx.fillStyle = fill; ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke(); } }
function star(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + i * Math.PI / n; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath();
}
function txt(ctx, s, x, y, size, fill = '#fff', align = 'center', lw = null) {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = lw == null ? Math.max(2, size * 0.24) : lw; ctx.strokeStyle = OUT; ctx.strokeText(s, x, y);
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function eye(ctx, x, y, la, rx = 4.2, ry = 5.4, blink = false, iris = OUT) {
  if (blink) { ctx.beginPath(); ctx.moveTo(x - rx, y); ctx.quadraticCurveTo(x, y + 2.5, x + rx, y); ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke(); return; }
  ell(ctx, x, y, rx, ry); fs(ctx, '#fff', 2);
  const px = x + Math.cos(la) * rx * 0.35 + 0.8, py = y + Math.sin(la) * ry * 0.3;
  circ(ctx, px, py, rx * 0.58); ctx.fillStyle = iris; ctx.fill();
  circ(ctx, px + 1, py - 1.3, rx * 0.22); ctx.fillStyle = '#fff'; ctx.fill();
}

// Each draw function works in "right-facing" space with the feet at (0,0); y goes negative upward.
// a = { t, la (local aim angle), bob, step, back (weapon behind body), recoil, blink }
const HERO_DRAW = {
  blaze(ctx, a) {
    const { t, la, bob, step } = a;
    // tail
    ctx.save(); ctx.translate(-11, -20 + bob); ctx.rotate(-0.6 + Math.sin(t * 6) * 0.18);
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(-18, 10, -28, -4); ctx.quadraticCurveTo(-20, -14, -2, -6); ctx.closePath(); fs(ctx, '#ff8a1f');
    ctx.beginPath(); ctx.moveTo(-20, 2); ctx.quadraticCurveTo(-26, 2, -28, -4); ctx.quadraticCurveTo(-25, -9, -19, -8); ctx.closePath(); fs(ctx, '#fff4e3', 0);
    ctx.restore();
    if (a.back) this._gun(ctx, a);
    ell(ctx, -7 + step * 5, -5, 6.5, 5); fs(ctx, '#b84a0c');
    ell(ctx, 7 - step * 5, -5, 6.5, 5); fs(ctx, '#b84a0c');
    ctx.save(); ctx.translate(0, bob);
    ell(ctx, 0, -21, 14, 14.5); fs(ctx, '#ff8a1f');
    ell(ctx, 3, -19, 7.5, 9); fs(ctx, '#fff4e3', 0);
    // scarf
    rrect(ctx, -13, -36, 26, 8, 4); fs(ctx, '#e8323c', 2.5);
    ctx.beginPath(); ctx.moveTo(-10, -33); ctx.quadraticCurveTo(-22, -34 + Math.sin(t * 9) * 3, -27, -27 + Math.sin(t * 9 + 1) * 3); ctx.lineTo(-20, -27); ctx.quadraticCurveTo(-16, -30, -9, -29); ctx.closePath(); fs(ctx, '#e8323c', 2.5);
    // ears
    for (const [ex, rot] of [[-9, -0.35], [10, 0.3]]) {
      ctx.save(); ctx.translate(ex, -63); ctx.rotate(rot);
      ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(0, -12); ctx.lineTo(8, 6); ctx.closePath(); fs(ctx, '#ff8a1f');
      ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(0, -6); ctx.lineTo(4, 4); ctx.closePath(); fs(ctx, '#ffd9b8', 0);
      ctx.restore();
    }
    circ(ctx, 0, -50, 19); fs(ctx, '#ff8a1f');
    ell(ctx, 8, -43, 12, 8.5); fs(ctx, '#fff4e3', 0);
    ell(ctx, 18.5, -46, 3.6, 3); fs(ctx, OUT, 0);
    ctx.beginPath(); ctx.moveTo(10, -39); ctx.quadraticCurveTo(14, -36, 17, -39); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    eye(ctx, 2, -53, la, 4.2, 5.6, a.blink); eye(ctx, 12, -53, la, 4.2, 5.6, a.blink);
    ctx.beginPath(); ctx.moveTo(-3, -61); ctx.lineTo(6, -59); ctx.moveTo(9, -59); ctx.lineTo(17, -61); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.restore();
    if (!a.back) this._gun(ctx, a);
  },
  _gun(ctx, a) {
    ctx.save(); ctx.translate(6, -25 + a.bob); ctx.rotate(a.la); ctx.translate(-a.recoil * 6, 0);
    rrect(ctx, 0, -5.5, 25, 11, 4); fs(ctx, '#5a6378');
    rrect(ctx, 20, -7, 9, 14, 3); fs(ctx, '#ffb31f');
    rrect(ctx, 4, -9, 10, 4, 2); fs(ctx, '#3a4155', 2);
    circ(ctx, 2, 1, 6); fs(ctx, '#ff8a1f');
    ctx.restore();
  },
  rocky(ctx, a) {
    const { la, bob, step } = a;
    const cannon = () => {
      ctx.save(); ctx.translate(13, -17 + bob); ctx.rotate(a.la); ctx.translate(-a.recoil * 7, 0);
      rrect(ctx, 0, -9, 30, 18, 7); fs(ctx, '#6d7890');
      rrect(ctx, 22, -11, 10, 22, 4); fs(ctx, '#c9b38a');
      circ(ctx, 0, 0, 10); fs(ctx, '#7a869c');
      ctx.restore();
    };
    if (a.back) cannon();
    rrect(ctx, -15 + step * 4, -12, 11, 12, 4); fs(ctx, '#5f6a82');
    rrect(ctx, 4 - step * 4, -12, 11, 12, 4); fs(ctx, '#5f6a82');
    ctx.save(); ctx.translate(0, bob);
    circ(ctx, -21, -28, 9); fs(ctx, '#7a869c');
    ell(ctx, 0, -31, 25, 24); fs(ctx, '#8b97ad');
    ell(ctx, -7, -41, 10, 6, -0.3); fs(ctx, '#aab5c9', 0);
    circ(ctx, -12, -22, 3.5); fs(ctx, '#6d7890', 0); circ(ctx, 12, -16, 2.5); fs(ctx, '#6d7890', 0); circ(ctx, -3, -14, 2); fs(ctx, '#6d7890', 0);
    // mossy cap
    ctx.beginPath(); ctx.ellipse(0, -50, 19, 8, 0, Math.PI, 0); ctx.quadraticCurveTo(10, -44, 0, -45); ctx.quadraticCurveTo(-10, -43, -19, -50); ctx.closePath(); fs(ctx, '#6cc04a', 2.5);
    circ(ctx, -6, -55, 3); fs(ctx, '#8fe36a', 0); circ(ctx, 6, -54, 2.4); fs(ctx, '#8fe36a', 0);
    // glowing eyes
    const e = a.blink ? 1.2 : 4.5;
    rrect(ctx, 3, -39, 8, e, 2); fs(ctx, '#ffe14d', 2); rrect(ctx, 14, -39, 8, e, 2); fs(ctx, '#ffe14d', 2);
    ctx.beginPath(); ctx.moveTo(1, -44); ctx.lineTo(11, -42); ctx.moveTo(14, -42); ctx.lineTo(24, -44); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -30); ctx.lineTo(18, -30); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
    if (!a.back) cannon();
  },
  luna(ctx, a) {
    const { t, la, bob, step } = a;
    const wand = () => {
      ctx.save(); ctx.translate(7, -27 + bob); ctx.rotate(a.la); ctx.translate(-a.recoil * 5, 0);
      rrect(ctx, 0, -2.5, 24, 5, 2.5); fs(ctx, '#8b5a2b', 2);
      star(ctx, 28, 0, 9, 4); fs(ctx, '#ffe066', 2.5);
      circ(ctx, 28, 0, 13 + Math.sin(t * 8) * 1.5); ctx.fillStyle = 'rgba(255,240,140,0.25)'; ctx.fill();
      circ(ctx, 2, 0, 5); fs(ctx, '#ffdcc2', 2);
      ctx.restore();
    };
    if (a.back) wand();
    ell(ctx, -7 + step * 4, -4, 6, 4.5); fs(ctx, '#3a2a6b'); ell(ctx, 7 - step * 4, -4, 6, 4.5); fs(ctx, '#3a2a6b');
    ctx.save(); ctx.translate(0, bob);
    // hair back
    ell(ctx, -6, -40, 14, 15); fs(ctx, '#3b2a7a');
    // robe
    ctx.beginPath(); ctx.moveTo(-17, -6); ctx.lineTo(17, -6); ctx.quadraticCurveTo(14, -22, 9, -36); ctx.lineTo(-9, -36); ctx.quadraticCurveTo(-14, -22, -17, -6); ctx.closePath(); fs(ctx, '#7b4dff');
    ctx.beginPath(); ctx.moveTo(-17, -6); ctx.lineTo(17, -6); ctx.lineTo(16, -10); ctx.lineTo(-16, -10); ctx.closePath(); fs(ctx, '#ffcf3f', 2);
    star(ctx, -5, -20, 3.5, 1.6); fs(ctx, '#ffe066', 0); star(ctx, 7, -26, 2.6, 1.2); fs(ctx, '#ffe066', 0);
    // head
    circ(ctx, 1, -46, 15); fs(ctx, '#ffdcc2');
    ctx.beginPath(); ctx.moveTo(-13, -50); ctx.quadraticCurveTo(-4, -56, 2, -54); ctx.quadraticCurveTo(10, -58, 16, -50); ctx.quadraticCurveTo(10, -62, 0, -61); ctx.quadraticCurveTo(-12, -60, -13, -50); ctx.closePath(); fs(ctx, '#3b2a7a', 2.5);
    circ(ctx, -1, -41, 3); ctx.fillStyle = 'rgba(255,110,150,0.45)'; ctx.fill(); circ(ctx, 14, -41, 3); ctx.fill();
    eye(ctx, 3, -46, la, 3.8, 5, a.blink, '#4a2a9a'); eye(ctx, 11.5, -46, la, 3.8, 5, a.blink, '#4a2a9a');
    ctx.beginPath(); ctx.moveTo(5, -38); ctx.quadraticCurveTo(8, -36, 10, -38); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    // hat
    ell(ctx, 1, -59, 25, 7); fs(ctx, '#5a35d6');
    ctx.beginPath(); ctx.moveTo(-14, -60); ctx.lineTo(14, -60); ctx.quadraticCurveTo(6, -76, -2, -84); ctx.quadraticCurveTo(-10, -92 + Math.sin(t * 3) * 1.5, -20, -86); ctx.quadraticCurveTo(-10, -84, -9, -78); ctx.closePath(); fs(ctx, '#5a35d6');
    ctx.beginPath(); ctx.moveTo(-13, -62); ctx.lineTo(13, -62); ctx.lineTo(11, -67); ctx.lineTo(-11, -67); ctx.closePath(); fs(ctx, '#ffcf3f', 2);
    star(ctx, 2, -73, 5, 2.3); fs(ctx, '#ffe066', 2);
    ctx.restore();
    if (!a.back) wand();
  },
  volt(ctx, a) {
    const { t, la, bob, step } = a;
    const rifle = () => {
      ctx.save(); ctx.translate(8, -25 + bob); ctx.rotate(a.la); ctx.translate(-a.recoil * 8, 0);
      rrect(ctx, -2, -6, 36, 12, 4); fs(ctx, '#3b4766');
      rrect(ctx, 30, -4, 14, 8, 3); fs(ctx, '#5ff4ff', 2.5);
      for (let i = 0; i < 3; i++) { rrect(ctx, 8 + i * 7, -8, 4, 16, 2); fs(ctx, '#2fb6c4', 2); }
      circ(ctx, 0, 1, 6); fs(ctx, '#dfe8f2', 2.5);
      ctx.restore();
    };
    if (a.back) rifle();
    rrect(ctx, -11 + step * 4, -13, 8, 13, 3); fs(ctx, '#2c3a52'); rrect(ctx, 3 - step * 4, -13, 8, 13, 3); fs(ctx, '#2c3a52');
    ctx.save(); ctx.translate(0, bob);
    rrect(ctx, -14, -38, 28, 27, 8); fs(ctx, '#2fb6c4');
    circ(ctx, 0, -25, 5.5); fs(ctx, '#c6fbff', 2);
    circ(ctx, 0, -25, 9 + Math.sin(t * 6)); ctx.fillStyle = 'rgba(95,244,255,0.25)'; ctx.fill();
    // antenna
    ctx.beginPath(); ctx.moveTo(-2, -69); ctx.lineTo(-6, -82); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
    circ(ctx, -6, -84, 4.5); fs(ctx, Math.sin(t * 5) > 0 ? '#ff4f6a' : '#ff9aa9', 2.5);
    rrect(ctx, -18, -70, 36, 31, 11); fs(ctx, '#dfe8f2');
    rrect(ctx, -21, -60, 6, 12, 3); fs(ctx, '#9aa8bd', 2.5);
    rrect(ctx, -9, -63, 27, 14, 7); fs(ctx, '#1b2340', 2.5);
    const eh = a.blink ? 1.5 : 6;
    rrect(ctx, 0, -59 + (6 - eh) / 2, 15, eh, 3); fs(ctx, '#5ff4ff', 0);
    rrect(ctx, -2, -61, 19, 10, 5); ctx.fillStyle = 'rgba(95,244,255,0.2)'; ctx.fill();
    ctx.restore();
    if (!a.back) rifle();
  },
  pi(ctx, a) {
    const { t, la, bob, step } = a;
    const pie = () => {
      ctx.save(); ctx.translate(9, -28 + bob); ctx.rotate(a.la * 0.8); ctx.translate(-a.recoil * 6, 0);
      ell(ctx, 4, 0, 9, 5, 0.3); fs(ctx, '#26324d');
      ell(ctx, 17, -3, 11, 6); fs(ctx, '#e8b46b', 2.5);
      ell(ctx, 17, -5, 8, 3.5); fs(ctx, '#ff6b8b', 0);
      circ(ctx, 17, -9, 3); fs(ctx, '#fff', 1.5);
      ctx.restore();
    };
    if (a.back) pie();
    ell(ctx, -7 + step * 4, -3, 7, 4); fs(ctx, '#ffb02e'); ell(ctx, 8 - step * 4, -3, 7, 4); fs(ctx, '#ffb02e');
    ctx.save(); ctx.translate(0, bob);
    ell(ctx, -17, -28, 5, 12, 0.3); fs(ctx, '#26324d');
    ell(ctx, 0, -32, 19, 27); fs(ctx, '#26324d');
    ell(ctx, 4, -27, 12.5, 19); fs(ctx, '#f5f7ff', 0);
    // bow tie
    ctx.beginPath(); ctx.moveTo(5, -38); ctx.lineTo(-3, -42); ctx.lineTo(-3, -34); ctx.closePath(); fs(ctx, '#e8323c', 2);
    ctx.beginPath(); ctx.moveTo(5, -38); ctx.lineTo(13, -42); ctx.lineTo(13, -34); ctx.closePath(); fs(ctx, '#e8323c', 2);
    circ(ctx, 5, -38, 2.4); fs(ctx, '#b81e2a', 1.5);
    // beak
    ctx.beginPath(); ctx.moveTo(14, -49); ctx.lineTo(26, -46); ctx.lineTo(14, -43); ctx.closePath(); fs(ctx, '#ffb02e', 2.5);
    eye(ctx, 3, -51, la, 3.2, 3.8, a.blink); eye(ctx, 13, -51, la, 3.2, 3.8, a.blink);
    circ(ctx, 3, -51, 6); ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke();
    circ(ctx, 13, -51, 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, -51); ctx.lineTo(7, -51); ctx.stroke();
    // graduation cap
    rrect(ctx, -9, -64, 20, 6, 2); fs(ctx, '#1b1b2b', 2.5);
    ctx.beginPath(); ctx.moveTo(-16, -65); ctx.lineTo(1, -72); ctx.lineTo(19, -65); ctx.lineTo(1, -59); ctx.closePath(); fs(ctx, '#1b1b2b', 2.5);
    ctx.beginPath(); ctx.moveTo(1, -66); ctx.quadraticCurveTo(14, -64, 15 + Math.sin(t * 4) * 2, -55); ctx.lineWidth = 2; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
    circ(ctx, 15 + Math.sin(t * 4) * 2, -54, 2.5); fs(ctx, '#ffd23f', 1.5);
    ctx.restore();
    if (!a.back) pie();
  },
};

// draw a hero with its feet at (x, y)
function drawHero(ctx, id, o) {
  const s = o.s || 1, t = o.t || 0, aim = o.aim == null ? 0.25 : o.aim;
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s);
  if (!o.noShadow) { ell(ctx, 0, 0, 25, 9); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); }
  const face = Math.cos(aim) >= 0 ? 1 : -1;
  const la = Math.atan2(Math.sin(aim), Math.abs(Math.cos(aim)));
  const moving = !!o.moving, ph = o.walk || 0;
  const bob = moving ? -Math.abs(Math.sin(ph)) * 3.5 : Math.sin(t * 2.6) * 1.2;
  const blink = ((t + (o.seed || 0)) % 3.6) < 0.12;
  if (o.squash) ctx.scale(1 + o.squash * 0.12, 1 - o.squash * 0.12);
  ctx.scale(face, 1);
  HERO_DRAW[id](ctx, { t, la, bob, step: moving ? Math.sin(ph) : 0, back: Math.sin(aim) < -0.45, recoil: o.recoil || 0, blink });
  ctx.restore();
}

// paint a portrait of a hero into a canvas (for cards and menus)
function paintPortrait(cv, id, opts = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  if (opts.bg !== false) {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 4, w / 2, h * 0.5, Math.max(w, h) * 0.7);
    g.addColorStop(0, opts.bg1 || '#fff6c9'); g.addColorStop(1, opts.bg2 || HEROES[id].color);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  const s = opts.s || Math.min(w / 96, h / 108);
  drawHero(ctx, id, { x: w / 2, y: h * (opts.feet || 0.9), s, t: opts.t || 0, aim: opts.aim == null ? 0.35 : opts.aim, seed: 1 });
}
