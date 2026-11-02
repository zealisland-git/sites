/* Brain Blast Arena: screens, input, HUD, quiz, and the main loop */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const cv = $('#game'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
const LV = BBMath.LEVELS;
const App = { scr: 'title', game: null, t: 0, session: null, last: 'mouse', pauseOn: false, syms: [], hdSel: Save.d.hero };

// ---------- layout ----------
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  if (App.game) App.game.setView(W, H);
}
window.addEventListener('resize', resize); resize();
function setLast(type) {
  if (App.last === type) return; App.last = type;
  document.body.classList.toggle('touch', type === 'touch');
}
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) setLast('touch');

function show(id) {
  $$('.screen').forEach(e => e.classList.toggle('on', e.id === id)); App.scr = id;
  document.body.classList.toggle('playing', id === 'hud');
}
function modal(id, on) { $('#' + id).classList.toggle('on', on); }
function toast(msg, ms = 2200) { const t = $('#toast'); t.innerHTML = msg; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); }
function click() { Sound.init(); Sound.play('click'); }

// ---------- floating math symbols for menus ----------
for (let i = 0; i < 26; i++) App.syms.push({ ch: choice(['π', '∑', '√', '÷', '×', '+', '−', '=', '%', '∞', 'x²', '½', '≠', '≤', 'Δ', 'θ', '7', '3', '9', '!']), x: Math.random(), y: Math.random(), v: rand(0.01, 0.035), r: rand(0, 6), vr: rand(-0.4, 0.4), s: rand(26, 70), a: rand(0.08, 0.18) });

function drawMenu(dt) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.5, Math.max(W, H) * 0.8);
  const purple = App.scr === 'heroes' || App.scr === 'results';
  g.addColorStop(0, purple ? '#7f5cff' : '#4fa2ff'); g.addColorStop(1, purple ? '#2a1478' : '#1532a8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // light rays
  ctx.save(); ctx.translate(W / 2, H * 0.6); ctx.rotate(App.t * 0.08);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, Math.max(W, H) * 1.2, i * TAU / 14, i * TAU / 14 + TAU / 28); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  for (const s of App.syms) {
    s.y -= s.v * dt; s.r += s.vr * dt; if (s.y < -0.1) { s.y = 1.1; s.x = Math.random(); }
    ctx.save(); ctx.translate(s.x * W, s.y * H); ctx.rotate(s.r); ctx.globalAlpha = s.a;
    ctx.font = `${s.s}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(s.ch, 0, 0); ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (App.scr === 'lobby') {
    const portrait = H > W, sc = clamp(Math.min(W, H) / (portrait ? 160 : 235), 1.3, 3.6), fx = W / 2, fy = H * (portrait ? 0.62 : 0.76);
    ell(ctx, fx, fy, 70 * sc, 20 * sc); fs(ctx, '#2a1f5a', 4); ell(ctx, fx, fy - 6 * sc, 64 * sc, 17 * sc); fs(ctx, '#6a7ee0', 0);
    ell(ctx, fx, fy - 7 * sc, 50 * sc, 12 * sc); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
    const hero = Save.d.hero;
    drawHero(ctx, hero, { x: fx, y: fy - 8 * sc, s: sc, t: App.t, aim: 0.25 + Math.sin(App.t * 0.7) * 0.15, seed: 2 });
  } else if (App.scr === 'title') {
    const n = HERO_ORDER.length, sc = clamp(Math.min(W / 560, H / 440), 0.8, 2.2);
    HERO_ORDER.forEach((id, i) => {
      const x = W / 2 + (i - (n - 1) / 2) * Math.min(W / (n + 0.5), 150 * sc), y = H * 0.93 + Math.sin(App.t * 2 + i) * 4;
      drawHero(ctx, id, { x, y, s: sc * (i === 2 ? 1.2 : 1), t: App.t + i, aim: (i < n / 2 ? 0.2 : Math.PI - 0.2), seed: i });
    });
  }
}

// ---------- lobby ----------
function nextUnlock() { return HERO_ORDER.map(id => HEROES[id]).filter(h => h.unlock > Save.d.trophies).sort((a, b) => a.unlock - b.unlock)[0]; }
function refreshLobby() {
  const d = Save.d, h = HEROES[d.hero], L = LV[d.level - 1];
  $('#lb-trophies').textContent = d.trophies;
  $('#lb-acc').textContent = d.asked ? Math.round(100 * d.correct / d.asked) + '%' : '–';
  $('#lb-name').textContent = h.name; $('#lb-title').textContent = `${h.title} · ${h.role}`;
  $('#lb-stars').textContent = '★'.repeat(d.level); $('#lb-lvname').textContent = L.name; $('#lb-lvamc').textContent = L.amc;
  $('#btn-level').style.background = `linear-gradient(${L.color}, #3b4fb5)`;
  const grab = d.mode === 'grab';
  $('#lb-mode').textContent = grab ? 'NUMBER GRAB' : 'BRAIN ROYALE'; $('#lb-modesub').textContent = grab ? '3 vs 3' : 'Solo · 6 players'; $('#lb-modeico').textContent = grab ? '💎' : '☠️';
  $('#btn-mode').style.background = grab ? 'linear-gradient(#c28bff, #7b4dff)' : 'linear-gradient(#7fe36a, #2c9a45)';
  const nu = nextUnlock();
  if (nu) { const prev = Math.max(0, ...HERO_ORDER.map(id => HEROES[id].unlock).filter(u => u <= d.trophies)); $('#road-label').textContent = `Unlock ${nu.name} at ${nu.unlock} 🏆`; $('#road-fill').style.width = clamp((d.trophies - prev) / (nu.unlock - prev) * 100, 4, 100) + '%'; }
  else { $('#road-label').textContent = 'All heroes unlocked! Chase trophies 🏆'; $('#road-fill').style.width = '100%'; }
  $('#btn-sfx').classList.toggle('off', !d.sfx); $('#btn-music').classList.toggle('off', !d.music);
  requestAnimationFrame(() => paintPortrait($('#mini-hero'), d.hero, { bg: false, feet: 0.95, s: 0.62 }));
}
$('#btn-start').onclick = () => { click(); Music.start('lobby'); show('lobby'); refreshLobby(); };
$('#btn-sfx').onclick = () => { Save.d.sfx = !Save.d.sfx; Save.save(); Sound.init(); Sound.apply(); click(); refreshLobby(); };
$('#btn-music').onclick = () => { Save.d.music = !Save.d.music; Save.save(); Sound.init(); Sound.apply(); if (Save.d.music) Music.start('lobby'); click(); refreshLobby(); };
$('#btn-how').onclick = () => { click(); modal('m-how', true); };
$$('[data-close]').forEach(b => b.onclick = () => { click(); b.closest('.modal').classList.remove('on'); if (b.id === 'how-ok' && App.afterHow) { const f = App.afterHow; App.afterHow = null; f(); } });
$$('[data-back]').forEach(b => b.onclick = () => { click(); show(b.dataset.back); refreshLobby(); });

$('#btn-mode').onclick = () => { click(); $$('.mcard').forEach(c => c.classList.toggle('sel', c.dataset.mode === Save.d.mode)); modal('m-mode', true); };
$$('.mcard').forEach(c => c.onclick = () => { click(); Save.d.mode = c.dataset.mode; Save.save(); modal('m-mode', false); refreshLobby(); });

function buildLevels() {
  const box = $('#levels'); box.innerHTML = '';
  LV.forEach(L => {
    const st = Save.d.lv[L.n], acc = st && st.a ? `${Math.round(100 * st.c / st.a)}% of ${st.a}` : 'not tried yet';
    const b = document.createElement('button'); b.className = 'lvcard' + (Save.d.level === L.n ? ' sel' : ''); b.style.background = `linear-gradient(#fff, ${L.color})`;
    b.innerHTML = `<span class="st">${'★'.repeat(L.n)}</span><b>${L.name}</b><small>${L.amc}</small><span class="bonus">+${(L.n - 1) * 2} 🏆 per win</span><span class="accy">${acc}</span>`;
    b.onclick = () => { click(); Save.d.level = L.n; Save.save(); modal('m-level', false); refreshLobby(); };
    box.appendChild(b);
  });
}
$('#btn-level').onclick = () => { click(); buildLevels(); modal('m-level', true); };

// ---------- heroes screen ----------
function buildHeroes() {
  const grid = $('#hero-grid'); grid.innerHTML = '';
  HERO_ORDER.forEach(id => {
    const h = HEROES[id], locked = h.unlock > Save.d.trophies;
    const c = document.createElement('button'); c.className = 'hcard' + (locked ? ' locked' : '') + (App.hdSel === id ? ' sel' : '');
    c.style.background = locked ? '#555' : `linear-gradient(#fff3c4, ${h.color})`;
    c.innerHTML = `<canvas></canvas><div class="hc-name">${h.name}</div>` + (locked ? `<div class="lock ol">🔒<br>${h.unlock} 🏆</div>` : '');
    c.onclick = () => { click(); App.hdSel = id; buildHeroes(); };
    grid.appendChild(c);
    requestAnimationFrame(() => paintPortrait(c.querySelector('canvas'), id, { bg: false, feet: 0.86 }));
  });
  const h = HEROES[App.hdSel], locked = h.unlock > Save.d.trophies;
  $('#hd-name').textContent = h.name; $('#hd-role').textContent = `${h.title} · ${h.role}`;
  $('#hd-blurb').innerHTML = `${h.blurb}<br><b>SUPER: ${h.sup.name}</b>`;
  $('#hd-bars').innerHTML = [['HEALTH', h.bars.hp], ['DAMAGE', h.bars.dmg], ['RANGE', h.bars.range], ['SPEED', h.bars.speed]].map(([k, v]) => `<span>${k}</span><div class="hbar"><i style="width:${v * 20}%"></i></div>`).join('');
  const sel = $('#hd-select');
  sel.disabled = locked; sel.querySelector('span').textContent = locked ? `🔒 ${h.unlock} 🏆` : Save.d.hero === h.id ? 'SELECTED ✓' : 'SELECT';
  requestAnimationFrame(() => paintPortrait($('#hd-canvas'), h.id, { bg1: '#fff6c9', bg2: h.color, feet: 0.88 }));
}
$('#btn-heroes').onclick = () => { click(); App.hdSel = Save.d.hero; show('heroes'); buildHeroes(); };
$('#hd-select').onclick = () => { const h = HEROES[App.hdSel]; if (h.unlock > Save.d.trophies) return; click(); Save.d.hero = h.id; Save.save(); buildHeroes(); };

// ---------- match flow ----------
$('#btn-play').onclick = () => {
  click();
  if (!Save.d.seenHow) { Save.d.seenHow = true; Save.save(); App.afterHow = startMatch; modal('m-how', true); return; }
  startMatch();
};
function startMatch() {
  Sound.init();
  App.session = { asked: 0, correct: 0, streak: 0, best: 0 };
  App.game = new Game({ mode: Save.d.mode, level: Save.d.level, heroId: Save.d.hero, ui: GameUI });
  App.game.setView(W, H); App.pauseOn = false;
  const g = App.game, grab = g.mode === 'grab';
  $('#vs-mode').textContent = grab ? 'NUMBER GRAB' : 'BRAIN ROYALE';
  const card = f => `<div class="vcard${f.isPlayer ? ' me' : ''}"><canvas data-h="${f.hero}"></canvas><b>${f.name}</b></div>`;
  if (grab) { $('#vs-a').innerHTML = g.fighters.filter(f => f.team === 0).map(card).join(''); $('#vs-b').innerHTML = g.fighters.filter(f => f.team === 1).map(card).join(''); $('.vs-x').style.display = ''; }
  else { $('#vs-a').innerHTML = g.fighters.slice(0, 3).map(card).join(''); $('#vs-b').innerHTML = g.fighters.slice(3).map(card).join(''); }
  const L = LV[Save.d.level - 1];
  $('#vs-sub').innerHTML = `Map: ${grab ? 'Crystal Canyon' : 'Brain Jungle'} · Math level: <b style="color:${L.color}">${L.name}</b> (${L.amc})`;
  show('vs'); Music.start('battle');
  requestAnimationFrame(() => $$('#vs canvas').forEach(c => paintPortrait(c, c.dataset.h, { bg: false, feet: 0.88, aim: c.closest('.red') ? Math.PI - 0.35 : 0.35 })));
  clearTimeout(App.vsT); App.vsT = setTimeout(beginMatch, 2600);
}
function beginMatch() {
  if (App.scr !== 'vs') return;
  const g = App.game; show('hud');
  $('#hud-grab').classList.toggle('on', g.mode === 'grab'); $('#hud-roy').classList.toggle('on', g.mode === 'royale');
  $('#feed').innerHTML = ''; $('#dead').classList.remove('on');
  if (g.mode === 'grab') setRule(g.rule);
}
$('#vs').addEventListener('pointerdown', () => { clearTimeout(App.vsT); beginMatch(); });

const GameUI = {
  banner(text, sub, color, dur = 1.6, big = false) {
    const b = $('#banner'); $('#b-main').textContent = text; $('#b-main').style.color = color || '#fff';
    $('#b-sub').textContent = sub || ''; $('#b-sub').style.display = sub ? '' : 'none';
    b.classList.toggle('big', !!big); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(this.bh); this.bh = setTimeout(() => b.classList.remove('on'), dur * 1000);
  },
  feed(a, b, ca, cb) {
    const box = $('#feed'), d = document.createElement('div'); d.className = 'fd';
    d.innerHTML = `<span style="color:${ca}">${esc(a)}</span> ⚔️ <span style="color:${cb}">${esc(b)}</span>`;
    box.prepend(d); while (box.children.length > 4) box.lastChild.remove();
    setTimeout(() => d.remove(), 4500);
  },
  quiz(kind, cb) { Quiz.open(kind, cb); },
  superReady() { const s = $('#ab-super'); s.classList.add('ready'); },
  superUsed() { $('#ab-super').classList.remove('ready'); },
  playerDown(canRespawn) {
    if (!canRespawn) { this.banner('KNOCKED OUT!', '', '#ff6b6b', 1.6); return; }
    $('#dead').classList.add('on'); $('#btn-revive').style.display = '';
  },
  playerUp() { $('#dead').classList.remove('on'); },
  trap(num, rule) { this.banner('TRAP GEM!', `${num} doesn't fit: ${rule.why ? rule.why(num) : ''}`, '#9ffcff', 2.2); },
  newRule(rule) { setRule(rule); this.banner('NEW RULE!', rule.t, '#e8c2ff', 2.2); },
  end(res) { showResults(res); },
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function setRule(rule) {
  $('#rule-txt').textContent = rule.t; $('#rule-hint').textContent = rule.hint || '';
  const r = $('#rule'); r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash');
}

// ---------- HUD ----------
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; const e = document.getElementById(id); if (e) e.textContent = v; } }
function updateHUD() {
  const g = App.game, p = g.player;
  if (g.mode === 'grab') {
    setText('sc-a', String(g.teamGems(0))); setText('sc-b', String(g.teamGems(1)));
    const mid = $('.sc.mid');
    if (g.lead >= 0) { setText('sc-clock', String(Math.ceil(g.cd))); setText('sc-cd', g.lead === 0 ? 'YOU WIN IN' : 'THEY WIN IN'); mid.classList.toggle('cd-us', g.lead === 0); mid.classList.toggle('cd-them', g.lead === 1); }
    else { const c = Math.max(0, Math.ceil(g.clock)); setText('sc-clock', `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`); setText('sc-cd', ''); mid.classList.remove('cd-us', 'cd-them'); }
    $('#rule-fill').style.width = (g.ruleT / g.ruleLen * 100) + '%';
  } else {
    setText('roy-left', String(g.fighters.filter(f => f.alive).length));
    if (g.safe && g.safe.p > 0) setText('roy-hint', p.alive && !g.inSafe(p.x, p.y) ? '☠️ You are in the POISON! Move to the center!' : '☠️ Poison closing · stay near the center');
  }
  const sp = Math.round(p.super * 100), ab = $('#ab-super');
  if (hudCache.sup !== sp) { hudCache.sup = sp; $('#ab-ring').style.setProperty('--p', sp); ab.classList.toggle('ready', sp >= 100); }
  const cd = Math.ceil(g.brainCD), bb = $('#ab-brain');
  bb.classList.toggle('cool', cd > 0 || !p.alive);
  setText('ab-brain-txt', cd > 0 ? `READY IN ${cd}` : 'BRAIN CHARGE');
  if (!p.alive && g.mode === 'grab') setText('dead-s', `Respawning in ${Math.max(1, Math.ceil(p.respawnT))}…`);
}
$('#ab-brain').onclick = () => brainCharge();
function brainCharge() {
  const g = App.game; if (!g || g.phase !== 'play' || g.paused || App.pauseOn || Quiz.isOpen) return;
  const p = g.player; if (!p.alive) return;
  if (g.brainCD > 0) { toast(`Brain Charge ready in ${Math.ceil(g.brainCD)} s`); return; }
  if (p.super >= 1) { toast('Your SUPER is already charged! Use it (SPACE / yellow button)'); return; }
  g.brainCD = 25;
  Quiz.open('charge', ok => { if (ok) { p.super = 1; p.ammo = 3; g.float(p, 'SUPER CHARGED!', '#ffd23f', 22); } });
}
$('#btn-revive').onclick = () => {
  const g = App.game; if (!g || g.player.alive || Quiz.isOpen) return;
  $('#btn-revive').style.display = 'none';
  Quiz.open('revive', ok => { if (ok && !g.player.alive) { g.respawn(g.player); } });
};
$('#btn-pause').onclick = () => setPause(true);
$('#btn-resume').onclick = () => { click(); setPause(false); };
$('#btn-howp').onclick = () => { click(); modal('m-how', true); };
$('#btn-quit').onclick = () => { click(); setPause(false); if (App.game) App.game.over = true; App.game = null; Music.start('lobby'); show('lobby'); refreshLobby(); };
function setPause(on) { if (!App.game || Quiz.isOpen) return; App.pauseOn = on; modal('m-pause', on); if (on) resetHeld(); }
document.addEventListener('visibilitychange', () => { if (document.hidden && App.scr === 'hud' && App.game && !App.game.over && !Quiz.isOpen) setPause(true); });

// ---------- results ----------
function showResults(res) {
  const g = App.game, p = g.player, S = App.session, d = Save.d, L = d.level;
  let title, color, sub, delta;
  const brain = Math.min(5, Math.floor(S.correct / 2));
  if (res.outcome === 'place') {
    const r = res.rank; title = r === 1 ? 'VICTORY!' : `#${r} PLACE`; color = r === 1 ? '#ffd23f' : r <= 3 ? '#7dff6a' : '#ff8a8a';
    sub = r === 1 ? 'Last hero standing!' : r <= 3 ? 'Nice! Top 3 finish.' : 'Knocked out. Power up with more Brain Cubes!';
    delta = [12, 8, 5, 2, -1, -3][r - 1] + (r <= 3 ? (L - 1) * 2 : 0) + brain;
  } else {
    title = res.outcome === 'win' ? 'VICTORY!' : res.outcome === 'lose' ? 'DEFEAT' : 'DRAW';
    color = res.outcome === 'win' ? '#ffd23f' : res.outcome === 'lose' ? '#ff6b6b' : '#fff';
    sub = res.outcome === 'win' ? 'Your team held the gems!' : res.outcome === 'lose' ? 'The other team held the gems.' : 'Time ran out with equal gems.';
    delta = (res.outcome === 'win' ? 8 + (L - 1) * 2 : res.outcome === 'draw' ? 2 : -3) + brain;
  }
  const before = d.trophies; d.trophies = Math.max(0, d.trophies + delta); const real = d.trophies - before;
  d.games++; if (title === 'VICTORY!') d.wins++;
  const unlocked = HERO_ORDER.map(id => HEROES[id]).filter(h => h.unlock > before && h.unlock <= d.trophies);
  Save.save();
  $('#res-title').textContent = title; $('#res-title').style.color = color; $('#res-sub').textContent = sub;
  const acc = S.asked ? Math.round(100 * S.correct / S.asked) + '%' : '–';
  const rows = [['Knockouts', p.stats.ko], ['Damage dealt', p.stats.dmg.toLocaleString('en-US')]];
  if (g.mode === 'grab') rows.push(['Gems grabbed', p.stats.gems]); else rows.push(['Power level', p.power]);
  rows.push(['Problems solved', `${S.correct} / ${S.asked}`], ['Accuracy', acc], ['Best streak', `🔥 ${S.best}`]);
  $('#res-stats').innerHTML = rows.map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join('') + (brain ? `<span class="k">Brain bonus</span><span class="v" style="color:#ff8be6">+${brain} 🏆</span>` : '');
  $('#res-trophy').textContent = `${real >= 0 ? '+' : ''}${real} 🏆  (${d.trophies})`;
  $('#res-unlock').innerHTML = unlocked.map(h => `<span>🎉 NEW HERO UNLOCKED: ${h.name}!</span>`).join(' ');
  show('results'); Music.stop(); Sound.play(title === 'VICTORY!' || (res.rank && res.rank <= 3) ? 'win' : 'lose');
  if (real > 0) setTimeout(() => Sound.play('trophy'), 900);
  requestAnimationFrame(() => paintPortrait($('#res-hero'), p.hero, { bg1: '#fff6c9', bg2: color === '#ff6b6b' || color === '#ff8a8a' ? '#8a8fb0' : HEROES[p.hero].color, feet: 0.88 }));
}
$('#btn-again').onclick = () => { click(); startMatch(); };
$('#btn-lobby').onclick = () => { click(); App.game = null; Music.start('lobby'); show('lobby'); refreshLobby(); };

// ---------- quiz ----------
const KINDS = {
  cube: { badge: '🧊 BRAIN CUBE', cls: '', reward: 'Solve it → <b>+1 POWER</b> (more health & damage) + SUPER charge. Answer fast for a GENIUS bonus!' },
  charge: { badge: '⚡ BRAIN CHARGE', cls: 'charge', reward: 'Solve it → your <b>SUPER</b> is fully charged and your ammo refills!' },
  revive: { badge: '💫 QUICK REVIVE', cls: 'revive', reward: 'Solve it → jump right back into the fight!' },
  second: { badge: '❤️ SECOND CHANCE', cls: 'second', reward: 'Solve it → get back up with half your health! Miss it and you\'re out.' },
  gym: { badge: '🏋️ BRAIN GYM', cls: 'gym', reward: 'Practice mode: no timer pressure. Every answer comes with a solution.' },
};
const Quiz = {
  isOpen: false, pad: null, padOn: false,
  open(kind, cb) {
    this.isOpen = true; this.kind = kind; this.cb = cb; this.done = false; this.result = null;
    const lvl = Save.d.level, L = LV[lvl - 1];
    this.q = BBMath.make(lvl); this.limit = kind === 'gym' ? 0 : L.time; this.t0 = performance.now(); this.elapsedPaused = 0;
    if (App.game) { App.game.paused = true; resetHeld(); }
    const K = KINDS[kind];
    $('.qhead').className = 'qhead ' + K.cls; $('#q-badge').textContent = K.badge; $('#q-level').textContent = `${L.amc} · ${L.name}`;
    $('#q-reward').innerHTML = K.reward; $('#q-topic').textContent = this.q.topic;
    $('#q-text').innerHTML = this.q.q;
    const box = $('#q-choices'); box.className = 'qchoices'; box.innerHTML = '';
    this.q.choices.forEach((c, i) => {
      const b = document.createElement('button'); b.className = 'qc'; b.innerHTML = `<span class="lt">${'ABCDE'[i]}</span><span class="v">${c}</span>`;
      b.onclick = () => this.answer(i); box.appendChild(b);
    });
    $('#q-result').className = 'qresult'; $('#q-next').classList.remove('on'); $('#q-skip').style.display = kind === 'gym' ? 'none' : '';
    $('.qbar').style.display = kind === 'gym' ? 'none' : '';
    this.renderGym();
    this.setPad(false); this.clearPad();
    modal('quiz', true); $('.qcard').scrollTop = 0;
  },
  renderGym() {
    const gy = $('#q-gym'); gy.classList.toggle('on', this.kind === 'gym');
    if (this.kind !== 'gym') return;
    const s = App.gym || (App.gym = { a: 0, c: 0, streak: 0 });
    gy.innerHTML = LV.map(L => `<button class="lvp${Save.d.level === L.n ? ' sel' : ''}" data-l="${L.n}" style="background:${L.color}">${'★'.repeat(L.n)} ${L.name}</button>`).join('') + `<span class="gscore">✅ ${s.c}/${s.a} · 🔥 ${s.streak}</span><button class="tbtn" id="gym-done">Done</button>`;
    gy.querySelectorAll('.lvp').forEach(b => b.onclick = () => { click(); Save.d.level = +b.dataset.l; Save.save(); this.open('gym'); });
    $('#gym-done').onclick = () => { click(); this.isOpen = false; modal('quiz', false); show('lobby'); refreshLobby(); };
  },
  tick() {
    if (!this.isOpen || this.done || !this.limit) return;
    const left = this.limit - (performance.now() - this.t0) / 1000, r = clamp(left / this.limit, 0, 1);
    const f = $('#q-fill'); f.style.width = (r * 100) + '%'; f.style.background = r > 0.5 ? '#3ee046' : r > 0.25 ? '#ffb700' : '#ff4848';
    setText('q-time', String(Math.max(0, Math.ceil(left))));
    if (left <= 0) this.answer(-1);
  },
  answer(i) {
    if (this.done) return; this.done = true;
    const q = this.q, ok = i === q.correct, secs = (performance.now() - this.t0) / 1000, fast = ok && this.limit && secs < this.limit * 0.35;
    this.result = { ok, fast };
    const btns = $$('#q-choices .qc'); $('#q-choices').classList.add('done');
    btns.forEach((b, k) => { if (k === q.correct) b.classList.add('right'); else if (k === i) b.classList.add('wrong'); else b.classList.add('dim'); });
    // stats
    const d = Save.d, lv = d.level; d.asked++; if (ok) d.correct++; d.lv[lv] = d.lv[lv] || { a: 0, c: 0 }; d.lv[lv].a++; if (ok) d.lv[lv].c++;
    let streak;
    if (this.kind === 'gym') { const s = App.gym; s.a++; if (ok) { s.c++; s.streak++; } else s.streak = 0; streak = s.streak; }
    else { const S = App.session; S.asked++; if (ok) { S.correct++; S.streak++; S.best = Math.max(S.best, S.streak); } else S.streak = 0; streak = S.streak; }
    if (ok) d.bestStreak = Math.max(d.bestStreak, streak);
    Save.save();
    const res = $('#q-result');
    const head = ok ? (fast ? '⚡ GENIUS! Lightning fast!' : choice(['✅ CORRECT!', '✅ NAILED IT!', '✅ BRILLIANT!', '✅ YES!'])) : i === -1 ? `⏰ TIME'S UP! The answer is (${'ABCDE'[q.correct]}) ${q.answer}` : i === -2 ? `⏭️ SKIPPED. The answer is (${'ABCDE'[q.correct]}) ${q.answer}` : `❌ NOT QUITE. The answer is (${'ABCDE'[q.correct]}) ${q.answer}`;
    res.innerHTML = `<span class="big">${head}${ok && streak >= 2 ? ` 🔥 ${streak} in a row` : ''}</span>${q.why}`;
    res.className = 'qresult on ' + (ok ? 'good' : 'bad');
    Sound.play(ok ? 'correct' : 'wrong');
    $('#q-next').classList.add('on'); $('#q-next span').textContent = this.kind === 'gym' ? 'NEXT PROBLEM ▶' : 'CONTINUE ▶';
    $('#q-skip').style.display = 'none';
    if (this.kind === 'gym') this.renderGym();
    else if (ok) { clearTimeout(this.autoT); this.autoT = setTimeout(() => { if (this.isOpen && this.done) this.close(); }, 2600); }
    setTimeout(() => res.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
  },
  close() {
    if (!this.isOpen) return;
    clearTimeout(this.autoT);
    if (this.kind === 'gym') { this.open('gym'); return; }
    this.isOpen = false; modal('quiz', false);
    const r = this.result || { ok: false, fast: false };
    if (App.game) { App.game.paused = false; resetHeld(); }
    const cb = this.cb; this.cb = null; if (cb) cb(r.ok, r.fast);
  },
  setPad(on) { this.padOn = on; $('#q-pad').classList.toggle('on', on); $('#q-clear').classList.toggle('on', on); $('#q-scratch').textContent = on ? '✏️ Hide pad' : '✏️ Scratch pad'; if (on) this.sizePad(); },
  sizePad() { const c = $('#q-pad'), r = c.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); } },
  clearPad() { const c = $('#q-pad'); c.getContext('2d').clearRect(0, 0, c.width, c.height); },
};
$('#q-next').onclick = () => { click(); Quiz.close(); };
$('#q-skip').onclick = () => { click(); Quiz.answer(-2); };
$('#q-scratch').onclick = () => { click(); Quiz.setPad(!Quiz.padOn); };
$('#q-clear').onclick = () => { click(); Quiz.clearPad(); };
(function scratch() {
  const c = $('#q-pad'); let drawing = false, lx = 0, ly = 0;
  const pos = e => { const r = c.getBoundingClientRect(), k = c.width / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };
  c.addEventListener('pointerdown', e => { drawing = true; [lx, ly] = pos(e); c.setPointerCapture(e.pointerId); e.preventDefault(); });
  c.addEventListener('pointermove', e => { if (!drawing) return; const [x, y] = pos(e), g = c.getContext('2d'); g.strokeStyle = '#3b2a7a'; g.lineWidth = 3 * (c.width / c.getBoundingClientRect().width); g.lineCap = 'round'; g.beginPath(); g.moveTo(lx, ly); g.lineTo(x, y); g.stroke(); lx = x; ly = y; });
  const up = () => { drawing = false; }; c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
})();
$('#btn-gym').onclick = () => { click(); App.gym = { a: 0, c: 0, streak: 0 }; App.game = null; Quiz.open('gym'); };

// ---------- input ----------
const keys = new Set(), Touch = { move: null, atk: null, sup: null }, mouse = { x: 0, y: 0, has: false };
function resetHeld() { keys.clear(); Touch.move = Touch.atk = Touch.sup = null; if (App.game) { const I = App.game.input; I.fireHeld = false; I.mx = I.my = 0; I.show = 0; } }
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (Quiz.isOpen) {
    const idx = '12345'.indexOf(k) >= 0 ? '12345'.indexOf(k) : 'abcde'.indexOf(k);
    if (!Quiz.done && idx >= 0 && document.activeElement !== $('#q-pad')) { Quiz.answer(idx); e.preventDefault(); }
    else if (Quiz.done && (k === 'enter' || k === ' ')) { Quiz.close(); e.preventDefault(); }
    return;
  }
  if (App.scr !== 'hud' || !App.game) return;
  if (k === 'escape' || k === 'p') { setPause(!App.pauseOn); return; }
  if (App.pauseOn) return;
  if (k === ' ' || k === 'e') { App.game.input.sup = true; e.preventDefault(); return; }
  if (k === 'q') { brainCharge(); return; }
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); setLast('mouse'); e.preventDefault(); }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => resetHeld());
cv.addEventListener('contextmenu', e => e.preventDefault());

function stickLayout() {
  const m = Math.min(W, H);
  return {
    move: { x: clamp(m * 0.24, 90, 170) + 10, y: H - clamp(m * 0.24, 90, 170), r: clamp(m * 0.13, 52, 84) },
    atk: { x: W - clamp(m * 0.2, 78, 140) - 10, y: H - clamp(m * 0.22, 84, 150), r: clamp(m * 0.11, 46, 72) },
    sup: { x: W - clamp(m * 0.2, 78, 140) - 10 - clamp(m * 0.25, 100, 170), y: H - clamp(m * 0.11, 50, 80), r: clamp(m * 0.08, 36, 54) },
  };
}
function worldOf(sx, sy) { const g = App.game, c = g.cam; return { x: (sx - W / 2) / c.s + c.x, y: (sy - H / 2) / c.s + c.y }; }
function mouseAim() {
  const g = App.game; if (!g || !mouse.has || App.last !== 'mouse') return;
  const p = g.player, w = worldOf(mouse.x, mouse.y), I = g.input;
  I.mouse = true; I.aim = Math.atan2(w.y - (p.y - 22), w.x - p.x); I.aimDist = dist(p.x, p.y, w.x, w.y); I.tx = w.x; I.ty = w.y;
}
cv.addEventListener('pointerdown', e => {
  Sound.init();
  if (App.scr !== 'hud' || !App.game || Quiz.isOpen || App.pauseOn) return;
  const I = App.game.input;
  if (e.pointerType === 'mouse') {
    setLast('mouse'); mouse.x = e.clientX; mouse.y = e.clientY; mouse.has = true; mouseAim();
    if (e.button === 0) I.fireHeld = true; else if (e.button === 2) I.sup = true;
    return;
  }
  setLast('touch'); I.mouse = false; I.tx = I.ty = null;
  const L = stickLayout(), x = e.clientX, y = e.clientY, o = { id: e.pointerId, ox: x, oy: y, x, y };
  if (!Touch.sup && dist(x, y, L.sup.x, L.sup.y) < L.sup.r * 1.35) Touch.sup = o;
  else if (!Touch.atk && x > W * 0.5) { if (dist(x, y, L.atk.x, L.atk.y) < L.atk.r * 1.4) { o.ox = L.atk.x; o.oy = L.atk.y; } Touch.atk = o; }
  else if (!Touch.move && x <= W * 0.5) Touch.move = o;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.has = true; if (App.last !== 'mouse') setLast('mouse'); return; }
  for (const k of ['move', 'atk', 'sup']) { const t = Touch[k]; if (t && t.id === e.pointerId) { t.x = e.clientX; t.y = e.clientY; } }
});
function endPointer(e) {
  const g = App.game; if (!g) return; const I = g.input;
  if (e.pointerType === 'mouse') { if (e.button === 0) I.fireHeld = false; return; }
  const L = stickLayout();
  if (Touch.move && Touch.move.id === e.pointerId) Touch.move = null;
  for (const k of ['atk', 'sup']) {
    const t = Touch[k]; if (!t || t.id !== e.pointerId) continue;
    const dx = t.x - t.ox, dy = t.y - t.oy, len = Math.hypot(dx, dy), maxR = L[k].r * 1.3;
    const p = g.player, def = k === 'atk' ? p.def.atk : p.def.sup, R = (def.range || 6) * T;
    if (len > 18) { I.aim = Math.atan2(dy, dx); I.aimDist = clamp(len / maxR, 0.15, 1) * R; I.tx = I.ty = null; if (k === 'atk') I.fire = true; else I.sup = true; }
    else { if (k === 'atk') I.autoFire = true; else I.autoSup = true; }
    Touch[k] = null; I.show = 0;
  }
}
cv.addEventListener('pointerup', endPointer); cv.addEventListener('pointercancel', endPointer);
window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && App.game && e.button === 0) App.game.input.fireHeld = false; });

function applyInput() {
  const g = App.game, I = g.input, L = stickLayout();
  let mx = 0, my = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1; if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (keys.has('w') || keys.has('arrowup')) my -= 1; if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (Touch.move) { const t = Touch.move, dx = t.x - t.ox, dy = t.y - t.oy, len = Math.hypot(dx, dy), R = L.move.r; if (len > 6) { const k = Math.min(1, len / R) / len; mx = dx * k; my = dy * k; } }
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  I.mx = mx; I.my = my;
  I.show = 0;
  for (const k of ['atk', 'sup']) {
    const t = Touch[k]; if (!t) continue; const dx = t.x - t.ox, dy = t.y - t.oy, len = Math.hypot(dx, dy);
    if (len > 18) { const p = g.player, def = k === 'atk' ? p.def.atk : p.def.sup; I.show = k === 'atk' ? 1 : 2; I.aim = Math.atan2(dy, dx); I.aimDist = clamp(len / (L[k].r * 1.3), 0.15, 1) * (def.range || 6) * T; I.tx = I.ty = null; }
  }
  if (App.last === 'mouse') mouseAim(); else I.mouse = false;
}

function drawTouch() {
  if (App.last !== 'touch') return;
  const g = App.game, p = g.player, L = stickLayout();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const pad = (x, y, r, col, a) => { circ(ctx, x, y, r); ctx.fillStyle = `rgba(20,16,50,${a})`; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke(); };
  const mv = Touch.move, mx = mv ? mv.ox : L.move.x, my = mv ? mv.oy : L.move.y;
  pad(mx, my, L.move.r, 'rgba(255,255,255,0.5)', 0.25);
  let kx = mx, ky = my; if (mv) { const dx = mv.x - mv.ox, dy = mv.y - mv.oy, len = Math.hypot(dx, dy), k = len > L.move.r ? L.move.r / len : 1; kx = mx + dx * k; ky = my + dy * k; }
  circ(ctx, kx, ky, L.move.r * 0.45); fs(ctx, 'rgba(255,255,255,0.75)', 3);
  // attack
  const at = Touch.atk, ax = at ? at.ox : L.atk.x, ay = at ? at.oy : L.atk.y;
  pad(ax, ay, L.atk.r, '#ffb347', 0.3);
  let akx = ax, aky = ay; if (at) { const dx = at.x - at.ox, dy = at.y - at.oy, len = Math.hypot(dx, dy), k = len > L.atk.r ? L.atk.r / len : 1; akx = ax + dx * k; aky = ay + dy * k; }
  circ(ctx, akx, aky, L.atk.r * 0.5); fs(ctx, '#ff9f1c', 3);
  ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); const cr = L.atk.r * 0.22; ctx.moveTo(akx - cr, aky); ctx.lineTo(akx + cr, aky); ctx.moveTo(akx, aky - cr); ctx.lineTo(akx, aky + cr); ctx.stroke();
  for (let i = 0; i < 3; i++) { const fill = clamp(p.ammo - i, 0, 1); ctx.beginPath(); ctx.arc(ax, ay, L.atk.r + 8, -Math.PI / 2 + i * TAU / 3 + 0.08, -Math.PI / 2 + i * TAU / 3 + 0.08 + (TAU / 3 - 0.16) * fill); ctx.lineWidth = 6; ctx.strokeStyle = '#ff9f1c'; ctx.stroke(); }
  // super
  const su = Touch.sup, sx = su ? su.ox : L.sup.x, sy = su ? su.oy : L.sup.y, ready = p.super >= 1;
  pad(sx, sy, L.sup.r, ready ? '#ffd23f' : 'rgba(255,255,255,0.35)', 0.3);
  ctx.beginPath(); ctx.arc(sx, sy, L.sup.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * p.super); ctx.lineWidth = 7; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
  let skx = sx, sky = sy; if (su) { const dx = su.x - su.ox, dy = su.y - su.oy, len = Math.hypot(dx, dy), k = len > L.sup.r ? L.sup.r / len : 1; skx = sx + dx * k; sky = sy + dy * k; }
  circ(ctx, skx, sky, L.sup.r * 0.55); fs(ctx, ready ? '#ffd23f' : '#77728f', 3);
  star(ctx, skx, sky, L.sup.r * 0.3, L.sup.r * 0.13); fs(ctx, ready ? '#fff' : '#aaa', 2);
}

// ---------- main loop ----------
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; App.t += dt;
  Music.tick();
  const g = App.game;
  if (App.scr === 'hud' && g) {
    applyInput();
    if (!App.pauseOn) g.update(dt);
    g.render(ctx, W, H, DPR);
    drawTouch(); updateHUD();
  } else if (App.scr === 'vs' && g) { drawMenu(dt); }
  else drawMenu(dt);
  if (Quiz.isOpen) Quiz.tick();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.fonts && document.fonts.ready.then(() => { if (App.scr === 'lobby') refreshLobby(); });
window.BB = { App, Quiz, Save };
