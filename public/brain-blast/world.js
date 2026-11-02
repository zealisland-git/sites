/* Brain Blast Arena: the arena, fighters, bots, gems, cubes, and drawing */
'use strict';

const T = 64;
const TL = { FLOOR: 0, WALL: 1, BLOCK: 2, CRATE: 3, WATER: 4 };
const CRATE_HP = 1800;

const THEMES = {
  canyon: { floorA: '#f4dca8', floorB: '#eccf98', speck: 'rgba(170,115,55,0.22)', edge: '#c98c4c',
    border: '#d9a463', border2: '#c48a4a', deco: 'rock',
    wallTop: '#ee9152', wallSide: '#b05b2b', blockTop: '#93a7cf', blockSide: '#5d6d98',
    bush: '#46c858', bushDark: '#1f7a34', bushLight: '#97f283', water: '#3cb8ff', waterDark: '#1f7fd1' },
  jungle: { floorA: '#ace077', floorB: '#a0d66b', speck: 'rgba(40,110,30,0.22)', edge: '#5f9f3c',
    border: '#3e8f45', border2: '#2f7738', deco: 'tree',
    wallTop: '#b9c1d3', wallSide: '#7c849b', blockTop: '#d69a5c', blockSide: '#94602f',
    bush: '#2fb54d', bushDark: '#155c2a', bushLight: '#7ce681', water: '#3cb8ff', waterDark: '#1f7fd1' },
  ice: { floorA: '#e8f5ff', floorB: '#dbeefb', speck: 'rgba(90,150,210,0.18)', edge: '#8fbfe6',
    border: '#a9d4f5', border2: '#97c6ec', deco: 'rock', prop: '#cfe0f2',
    wallTop: '#d4e6f8', wallSide: '#8fb0d6', blockTop: '#9fd8f0', blockSide: '#5c9cc4',
    bush: '#5fd1c0', bushDark: '#22807c', bushLight: '#c4fff4', water: '#5ab8ff', waterDark: '#2a7fd1' },
  lava: { floorA: '#4d3c3c', floorB: '#463636', speck: 'rgba(255,120,60,0.16)', edge: '#2a1d1d',
    border: '#2b1a1a', border2: '#382020', deco: 'rock', prop: '#5c454e',
    wallTop: '#67546a', wallSide: '#3d2e3d', blockTop: '#ff8a3c', blockSide: '#b84a1c',
    bush: '#8a4fc8', bushDark: '#3a1a5a', bushLight: '#c79af2', water: '#ff6a1c', waterDark: '#b8380c' },
  night: { floorA: '#3d4475', floorB: '#373e6c', speck: 'rgba(180,200,255,0.13)', edge: '#262b50',
    border: '#1f2446', border2: '#272d58', deco: 'tree',
    wallTop: '#858cc0', wallSide: '#525890', blockTop: '#c28bff', blockSide: '#7b4dff',
    bush: '#3fae72', bushDark: '#163f30', bushLight: '#86ecb4', water: '#3c7fff', waterDark: '#1f4fd1' },
};

// Maps are drawn as one corner and mirrored, so both sides are fair.
// . floor  # wall  = block  B bush  C brain crate  ~ water
const MAPS = {
  grab: { theme: 'canyon', mirrorX: true, mirrorY: true, rows: [
    'BB.........',
    'B..........',
    '...=.......',
    '...=....BB.',
    '.......BB..',
    'C.##.......',
    '..##...==..',
    '......B....',
    'BB...BB..#.',
    'BB.C.....#.',
    '...~~......',
    '...~~..BB..',
    '##.....BB..',
    'B....=.....',
    'BB...=..C..',
    'BBB........',
  ] },
  royale: { theme: 'jungle', mirrorX: true, mirrorY: true, rows: [
    'BBB....BB...',
    'B..C......C.',
    '.....##.....',
    '.....##..BB.',
    '.C.......BBC',
    '.##..BB.....',
    '.##..BBC..~~',
    '..........~~',
    'BB...==.....',
    'BB.C......C.',
    '.....BB....B',
    '..##....B...',
  ] },
};
function expandRows(def) {
  let rows = def.rows.map(r => def.mirrorX ? r + r.slice(0, -1).split('').reverse().join('') : r);
  if (def.mirrorY) rows = rows.concat(rows.slice(0, -1).reverse());
  return rows;
}

const hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

class Fighter {
  constructor(g, heroId, team, o) {
    this.g = g; this.hero = heroId; this.def = HEROES[heroId]; this.team = team;
    this.isPlayer = !!o.player; this.name = o.name; this.r = 24 * (this.def.scale || 1); this.baseHp = this.def.hp; this.dmgScale = 1;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.power = 0; this.maxHp = this.def.hp; this.hp = this.maxHp;
    this.ammo = 3; this.super = 0; this.aim = team === 1 ? Math.PI / 2 : -Math.PI / 2; this.face = this.aim;
    this.alive = true; this.respawnT = 0; this.invuln = 0; this.flash = 0; this.recoil = 0; this.squash = 0;
    this.lastHurt = -99; this.lastShot = -99; this.walk = 0; this.moving = false;
    this.gems = 0; this.burstQ = []; this.dash = null; this.leap = null; this.z = 0;
    this.inBush = false; this.revealT = 0; this.superAnnounced = false; this.seed = Math.random() * 9;
    this.stats = { ko: 0, deaths: 0, dmg: 0, gems: 0, cubes: 0 };
    this.cubesHeld = 0; this.structure = !!this.def.structure; this.shield = false; this.shieldT = 0; this.vuln = 0; this.stun = 0;
    this.sprite = document.createElement('canvas'); this.spriteZoom = 0;
    this.spawn = { x: 0, y: 0 };
  }
  get mult() { return (1 + 0.1 * this.power) * this.dmgScale; }
}

class Game {
  constructor(o) {
    this.mode = o.mode; this.level = o.level; this.ui = o.ui; this.stage = o.stage || null;
    this.kind = this.stage ? this.stage.type : this.mode;
    const sm = this.stage && this.stage.map, def = sm ? (typeof sm === 'string' ? MAPS[sm] : sm) : MAPS[this.mode];
    this.theme = THEMES[(this.stage && this.stage.theme) || def.theme] || THEMES.canyon;
    this.marks = { P: [], E: [], M: [], K: [], F: [] };
    const rows = expandRows(def); this.h = rows.length; this.w = rows[0].length;
    const n = this.w * this.h;
    this.tile = new Uint8Array(n); this.bush = new Uint8Array(n); this.crateHp = new Float32Array(n); this.tshake = new Float32Array(n);
    this.crateHome = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = rows[y][x], i = y * this.w + x;
      if (c === '#') this.tile[i] = TL.WALL; else if (c === '=') this.tile[i] = TL.BLOCK; else if (c === '~') this.tile[i] = TL.WATER;
      else if (c === 'C') { this.tile[i] = TL.CRATE; this.crateHp[i] = CRATE_HP; this.crateHome.push(i); }
      else if (c === 'B') this.bush[i] = 1;
      else if (this.marks[c]) this.marks[c].push({ x: (x + 0.5) * T, y: (y + 0.5) * T });
    }
    this.tileVer = 0; this.flowCache = new Map(); this.crateRespawn = [];
    this.time = 0; this.phase = 'intro'; this.introT = 3.4; this.paused = false; this.over = false;
    this.fighters = []; this.bullets = []; this.lobs = []; this.gems = []; this.cubes = []; this.parts = []; this.texts = [];
    this.input = { mx: 0, my: 0, aim: null, aimDist: 0, fireHeld: false, fire: false, autoFire: false, sup: false, autoSup: false, show: 0, mouse: false };
    this.cam = { x: 0, y: 0, s: 1, shake: 0 }; this.vw = 800; this.vh = 600;
    this.brainCD = 0; this.secondUsed = false; this.quizCount = 0; this.gemId = 0;
    const S = this.stage || {};
    this.playTime = 0; this.traps = 0; this.solved = 0; this.kills = 0; this.shieldCD = 0; this.slow = 0; this.koTimes = []; this.gemCombo = []; this.tipT = 0;
    this.makeTeams(o.heroId);
    this.gemsOn = this.mode === 'grab' || this.kind === 'gems';
    if (this.gemsOn) {
      const m = this.marks.M[0]; this.mine = m ? { x: m.x, y: m.y } : { x: (this.w / 2) * T, y: (this.h / 2) * T }; this.mineT = 2;
      this.ruleLv = S.ruleLevel || this.level; this.ruleNames = S.rules || null;
      this.ruleLen = S.ruleTime || 35; this.ruleT = this.ruleLen; this.rule = BBMath.pickRule(this.ruleLv, null, this.ruleNames);
    }
    if (this.mode === 'grab') { this.clock = S.time || 150; this.lead = -1; this.cd = 15; }
    else if (this.mode === 'royale') { this.safe = { x0: 0, y0: 0, x1: this.w * T, y1: this.h * T }; this.poisonTick = 0; }
    else {
      this.clock = S.time || 0; this.lives = S.lives || 3; this.waveIdx = -1; this.waveT = 1.2; this.swarmT = 2;
      if (S.boss) { const k = this.marks.K[0] || { x: this.w * T / 2, y: 3 * T }; this.boss = this.spawnEnemy(Object.assign({ skill: 0.5 }, S.boss), k, true); }
      this.factories = []; this.factoriesDown = 0;
      if (S.factories) for (const m of this.marks.F) this.factories.push(this.spawnEnemy(Object.assign({ hero: 'factory' }, S.factories), m, true));
      this.supplyT = S.supply ? S.supply.every : 0; this.continueT = 0; this.continueUsed = false;
    }
    const p = this.player; this.cam.x = p.x; this.cam.y = p.y;
  }

  // ---------- setup ----------
  makeTeams(heroId) {
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const tro = Save.d.trophies, skill = this.stage && this.stage.skill != null ? this.stage.skill : clamp(0.42 + tro / 600, 0.42, 0.85);
    if (this.mode === 'solo') {
      const f = new Fighter(this, heroId, 0, { player: true, name: 'YOU' }), ps = this.marks.P[0] || { x: this.w * T / 2, y: (this.h - 1.5) * T };
      f.spawn = { x: ps.x, y: ps.y }; f.x = ps.x; f.y = ps.y; f.aim = f.face = -Math.PI / 2;
      this.player = f; this.fighters.push(f); this.aliveCount = 1; this.names = names;
      return;
    }
    const botHero = () => choice(HERO_ORDER);
    if (this.mode === 'grab') {
      const cx = Math.floor(this.w / 2), sp = [[cx - 2, this.h - 2], [cx, this.h - 2], [cx + 2, this.h - 2]];
      const ep = [[cx - 2, 1], [cx, 1], [cx + 2, 1]];
      for (let i = 0; i < 3; i++) {
        const f = new Fighter(this, i === 1 ? heroId : botHero(), 0, { player: i === 1, name: i === 1 ? 'YOU' : names.pop() });
        f.spawn = { x: (sp[i][0] + 0.5) * T, y: (sp[i][1] + 0.5) * T }; this.fighters.push(f); if (i === 1) this.player = f;
        else f.bot = new Bot(this, f, skill * 0.95, ['left', 'mid', 'right'][i]);
      }
      const S = this.stage || {};
      for (let i = 0; i < 3; i++) {
        const f = new Fighter(this, botHero(), 1, { name: names.pop() });
        if (S.enemyHp) { f.baseHp = f.maxHp = f.hp = Math.round(f.def.hp * S.enemyHp); } if (S.enemyDmg) f.dmgScale = S.enemyDmg;
        f.spawn = { x: (ep[i][0] + 0.5) * T, y: (ep[i][1] + 0.5) * T }; f.bot = new Bot(this, f, skill, ['right', 'mid', 'left'][i]); this.fighters.push(f);
      }
    } else {
      const c = Math.floor(this.w / 2), e = this.w - 1;
      const pts = [[c, e - 2], [3, e - 4], [e - 3, e - 4], [3, 4], [e - 3, 4], [c, 2]];
      pts.forEach(([x, y], i) => {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = (y + dy) * this.w + (x + dx); if (this.tile[k] !== TL.CRATE) this.tile[k] = TL.FLOOR; if (!dx && !dy) this.bush[k] = 0; }
        const f = new Fighter(this, i === 0 ? heroId : botHero(), i, { player: i === 0, name: i === 0 ? 'YOU' : names.pop() });
        f.spawn = { x: (x + 0.5) * T, y: (y + 0.5) * T }; if (i === 0) this.player = f; else f.bot = new Bot(this, f, skill, 'solo');
        this.fighters.push(f);
      });
    }
    for (const f of this.fighters) { f.x = f.spawn.x; f.y = f.spawn.y; if (this.mode === 'royale') f.aim = f.face = Math.atan2(this.h * T / 2 - f.y, this.w * T / 2 - f.x); }
    this.aliveCount = this.fighters.length;
  }
  // stage enemies: spec = { hero, n, hp (x health), dmg (x damage), skill, name }
  spawnEnemy(spec, at, quiet) {
    const heroId = spec.hero === 'random' || !HEROES[spec.hero] ? choice(HERO_ORDER) : spec.hero, H = HEROES[heroId];
    const nm = spec.name || (H.minion || H.boss ? H.name : (this.names && this.names.pop()) || H.name);
    const f = new Fighter(this, heroId, 1, { name: nm });
    const pts = at ? [at] : this.marks.E.length ? this.marks.E : [{ x: this.w * T / 2, y: 1.5 * T }];
    const p0 = choice(pts), j = H.structure ? 0 : 18, spot = H.structure ? { x: p0.x, y: p0.y } : this.nearestOpen(p0.x + rand(-j, j), p0.y + rand(-j, j));
    f.x = f.spawn.x = spot.x; f.y = f.spawn.y = spot.y;
    f.baseHp = Math.round(H.hp * (spec.hp || 1)); f.maxHp = f.hp = f.baseHp; f.dmgScale = spec.dmg || 1;
    f.aim = f.face = Math.atan2(this.player.y - f.y, this.player.x - f.x);
    const sk = spec.skill != null ? spec.skill : this.stage && this.stage.skill != null ? this.stage.skill : 0.45;
    f.bot = H.boss ? new BossAI(this, f, spec) : H.structure ? new FactoryAI(this, f, spec) : new Bot(this, f, sk, 'solo');
    f.spec = spec; if (spec.color) f.color = spec.color; if (spec.msgs) f.msgs = spec.msgs;
    if (spec.shield) { f.shield = true; f.shieldT = 0; f.vuln = 0; }
    f.invuln = quiet ? 0 : 1;
    if (!quiet) this.puff(f.x, f.y, 8, 'rgba(255,120,120,0.85)');
    this.fighters.push(f);
    return f;
  }
  enemiesLeft() { let n = 0; for (const f of this.fighters) if (f.alive && f.team !== this.player.team) n++; return n; }
  waveTotal() { const S = this.stage; return S && S.waves ? S.waves.reduce((a, w) => a + w.reduce((b, s) => b + (s.n || 1), 0), 0) : 0; }
  objective() {
    const S = this.stage; if (!S || this.mode !== 'solo') return null;
    if (S.type === 'defeat') return { ico: '🤖', txt: 'DEFEAT THE ROBOTS', cur: Math.min(this.kills, this.waveTotal()), goal: this.waveTotal() };
    if (S.type === 'gems') return { ico: '💎', txt: 'HOLD GEMS', cur: this.player.gems, goal: S.goal };
    if (S.type === 'cubes') return { ico: '🧊', txt: 'SOLVE BRAIN CUBES', cur: this.solved, goal: S.goal };
    if (S.type === 'survive') return { ico: '⏱️', txt: 'SURVIVE!', cur: Math.min(S.time, Math.floor(S.time - this.clock)), goal: S.time };
    if (S.type === 'boss') return { ico: '👑', txt: 'DEFEAT THE BOSS', cur: 0, goal: 0 };
    if (S.type === 'factories') return { ico: '🏭', txt: 'DESTROY THE FACTORIES', cur: this.factoriesDown, goal: this.factories.length };
    return null;
  }
  // ---------- the 🧠 math button ----------
  // A Math Shield blocks 80% of damage. Solving a problem smashes it: the enemy is VULNERABLE
  // (+25% damage) for a while, then the shield slowly regrows (normal damage) and comes back.
  shieldTarget() {
    const P = this.player; let best = null, bd = 1e9;
    for (const e of this.fighters) {
      if (!e.alive || !e.shield || e.team === P.team) continue;
      const d = dist(P.x, P.y, e.x, e.y); if (!e.def.boss && d > 9.5 * T) continue;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  mathOption() {
    const P = this.player; if (!P.alive) return { type: null };
    const sh = this.shieldTarget(); if (sh) return { type: 'shield', target: sh, cd: this.shieldCD };
    if (P.cubesHeld > 0) return { type: 'cube', n: P.cubesHeld, cd: 0 };
    return { type: 'charge', cd: this.brainCD, full: P.super >= 1 };
  }
  rewardCube(ok, fast, retry) {
    const f = this.player;
    if (!ok) { this.float(f, 'The cube fizzled…', '#ccc', 18); return; }
    this.solved++; this.powerUp(f, fast ? 'GENIUS! +POWER' : 'POWER UP!');
    if (!retry) f.super = Math.min(1, f.super + (fast ? 0.6 : 0.4));
  }
  tip(id) { if (this.ui.tip) this.ui.tip(id); }
  breakShield(b, how = 'ok') {
    b = b || this.shieldTarget(); if (!b || !b.alive) return;
    const spec = b.spec || (b.bot && b.bot.spec), base = (spec && spec.shieldTime) || 10;
    const win = Math.round(base * (how === 'retry' ? 0.7 : 1) + (how === 'fast' ? 3 : 0));
    b.shield = false; b.vuln = win; b.shieldT = spec && spec.regrow === false ? 0 : win + 6; b.stun = b.def.boss ? 1.6 : 0.8;
    this.cam.shake = 10; Sound.play('boom', 0.7);
    for (let k = 0; k < 26; k++) { const a = rand(0, TAU), s = rand(150, 420); this.parts.push({ type: 'spark', x: b.x, y: b.y - 50, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, max: 0.5, size: 4, color: '#9ffcff' }); }
    this.parts.push({ type: 'ring', x: b.x, y: b.y, life: 0.5, max: 0.5, size: 3 * T, color: '#9ffcff' });
    this.ui.banner('SHIELD SMASHED!', `+25% damage for ${win} seconds. Attack!`, '#9ffcff', 2);
  }
  setView(W, H) {
    this.vw = W; this.vh = H;
    const area = (17 * T) * (10.5 * T);
    this.cam.s = clamp(Math.min(Math.sqrt((W * H) / area), H / (10 * T)), 0.42, 1.7);
  }

  // ---------- tiles ----------
  ti(x, y) { return y * this.w + x; }
  tileAt(tx, ty) { if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return TL.WALL; return this.tile[ty * this.w + tx]; }
  walkSolid(tx, ty) { return this.tileAt(tx, ty) !== TL.FLOOR; }
  shotSolid(tx, ty) { const t = this.tileAt(tx, ty); return t === TL.WALL || t === TL.BLOCK || t === TL.CRATE; }
  bushAt(x, y) { const tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false; return this.bush[ty * this.w + tx] === 1; }
  setTile(tx, ty, v) { this.tile[ty * this.w + tx] = v; this.tileVer++; }
  hitCrate(tx, ty, dmg, src) {
    const i = this.ti(tx, ty); if (this.tile[i] !== TL.CRATE) return;
    this.crateHp[i] -= dmg; this.tshake[i] = 0.18;
    if (this.crateHp[i] <= 0) this.breakTile(tx, ty, src);
  }
  breakTile(tx, ty, src) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    const i = this.ti(tx, ty), t = this.tile[i]; if (t === TL.FLOOR || t === TL.WATER) return;
    this.setTile(tx, ty, TL.FLOOR);
    const cx = (tx + 0.5) * T, cy = (ty + 0.5) * T;
    const col = t === TL.CRATE ? '#c98b4b' : t === TL.BLOCK ? this.theme.blockTop : this.theme.wallTop;
    for (let k = 0; k < 12; k++) this.parts.push({ type: 'debris', x: cx + rand(-20, 20), y: cy + rand(-20, 20), vx: rand(-260, 260), vy: rand(-260, 260), z: rand(10, 30), vz: rand(200, 420), life: rand(0.6, 1), max: 1, size: rand(5, 11), color: col, rot: rand(0, 6), vr: rand(-12, 12) });
    this.puff(cx, cy, 6, 'rgba(255,255,255,0.8)');
    if (t === TL.CRATE) {
      Sound.play('crate');
      this.cubes.push({ x: cx, y: cy, z: 0, vz: 380, age: 0, alive: true });
      if (this.mode === 'grab') this.crateRespawn.push({ i, t: 40 });
    } else Sound.play('boom');
  }

  // ---------- update ----------
  update(dt) {
    if (this.paused || this.over) return;
    if (this.slow > 0) { this.slow -= dt; dt *= 0.3; }
    this.time += dt;
    if (this.phase === 'intro') {
      const before = Math.ceil(this.introT - 0.4); this.introT -= dt; const after = Math.ceil(this.introT - 0.4);
      if (after !== before && after > 0) { this.ui.banner(String(after), '', '#fff', 0.8, true); Sound.play('tick'); }
      if (this.introT <= 0.4 && before > 0) { this.ui.banner('GO!', this.stage && this.stage.goalText ? this.stage.goalText : this.mode === 'grab' ? 'Grab gems that match the rule!' : 'Break crates, solve, survive!', '#ffd23f', 1.3, true); Sound.play('go'); }
      if (this.introT <= 0) { this.phase = 'play'; this.onStart(); }
      this.updateCamera(dt); this.updateFx(dt);
      return;
    }
    if (this.brainCD > 0) this.brainCD -= dt;
    if (this.shieldCD > 0) this.shieldCD -= dt;
    if (!this.ending) this.playTime += dt;
    for (const f of this.fighters) {
      let it;
      if (!f.alive) { this.updateDead(f, dt); continue; }
      if (f.isPlayer) it = this.playerIntent(f); else it = f.bot.intent(dt);
      this.updateFighter(f, it, dt);
    }
    this.separate();
    this.updateBullets(dt); this.updateLobs(dt); this.updatePickups(dt);
    if (this.gemsOn) this.updateGems(dt);
    if (this.mode === 'grab') this.updateGrabWin(dt); else if (this.mode === 'royale') this.updateRoyale(dt); else this.updateSolo(dt);
    if (this.mode === 'solo') this.fighters = this.fighters.filter(f => f.alive || f.isPlayer);
    for (const c of this.crateRespawn) {
      c.t -= dt;
      if (c.t <= 0) { const tx = c.i % this.w, ty = (c.i / this.w) | 0, cx = (tx + 0.5) * T, cy = (ty + 0.5) * T;
        if (this.fighters.some(f => f.alive && Math.abs(f.x - cx) < T * 0.5 + f.r && Math.abs(f.y - cy) < T * 0.5 + f.r)) c.t = 1;
        else { this.setTile(tx, ty, TL.CRATE); this.crateHp[c.i] = CRATE_HP; this.puff(cx, cy, 5, 'rgba(200,140,255,0.8)'); c.done = true; } }
    }
    this.crateRespawn = this.crateRespawn.filter(c => !c.done);
    this.updateCamera(dt); this.updateFx(dt);
  }

  onStart() {
    const S = this.stage;
    if (!S || S.id === '1-1' || Save.d.games === 0) this.tip('move');
    if (this.gemsOn) this.tip('gems');
    if (this.boss) setTimeout(() => { if (!this.over) this.ui.banner(`${this.boss.name} APPEARS!`, 'Smash its Math Shield with 🧠 (Q), then attack!', '#ff6b6b', 2.4); }, 1500);
  }
  playerIntent(f) {
    const I = this.input, it = { mx: I.mx, my: I.my, aim: null, fire: false, sup: false, tx: null, ty: null };
    if (this.phase !== 'play') { it.mx = it.my = 0; return it; }
    if (I.aim != null) { it.aim = I.aim; if (I.tx != null) { it.tx = I.tx; it.ty = I.ty; } else { const d = I.aimDist || 0; it.tx = f.x + Math.cos(I.aim) * d; it.ty = f.y + Math.sin(I.aim) * d; } }
    if (I.fire || I.fireHeld) { it.fire = true; I.fire = false; }
    if (I.autoFire) { I.autoFire = false; const a = this.autoAim(f, f.def.atk.range * T); if (a) { it.aim = a.ang; it.tx = a.x; it.ty = a.y; } else { it.aim = f.face; it.tx = f.x + Math.cos(f.face) * f.def.atk.range * T * 0.8; it.ty = f.y + Math.sin(f.face) * f.def.atk.range * T * 0.8; } it.fire = true; }
    if (I.sup) { it.sup = true; I.sup = false; }
    if (I.autoSup) { I.autoSup = false; const rng = (f.def.sup.range || 6) * T, a = this.autoAim(f, rng); if (a) { it.aim = a.ang; it.tx = a.x; it.ty = a.y; } else { it.aim = f.face; it.tx = f.x + Math.cos(f.face) * rng * 0.7; it.ty = f.y + Math.sin(f.face) * rng * 0.7; } it.sup = true; }
    it.aiming = I.mouse || I.show > 0;
    return it;
  }
  autoAim(f, range) {
    let best = null, bd = 1e9;
    for (const e of this.fighters) {
      if (!e.alive || e.team === f.team || !this.canSee(f.team, e)) continue;
      const d = dist(f.x, f.y, e.x, e.y); if (d > range * 1.15) continue;
      const score = d - (this.clearShot(f.x, f.y, e.x, e.y) ? 200 : 0);
      if (score < bd) { bd = score; best = e; }
    }
    if (best) { const sp = f.def.atk.speed || 900, tt = dist(f.x, f.y, best.x, best.y) / sp, px = best.x + best.vx * tt * 0.6, py = best.y + best.vy * tt * 0.6; return { ang: Math.atan2(py - f.y, px - f.x), x: px, y: py }; }
    // nearest crate in range
    let bc = null; bd = 1e9; const r = Math.ceil(range / T);
    const ftx = Math.floor(f.x / T), fty = Math.floor(f.y / T);
    for (let y = fty - r; y <= fty + r; y++) for (let x = ftx - r; x <= ftx + r; x++) {
      if (this.tileAt(x, y) !== TL.CRATE) continue; const cx = (x + 0.5) * T, cy = (y + 0.5) * T, d = dist(f.x, f.y, cx, cy);
      if (d < range && d < bd) { bd = d; bc = { ang: Math.atan2(cy - f.y, cx - f.x), x: cx, y: cy }; }
    }
    return bc;
  }

  updateFighter(f, it, dt) {
    const d = f.def;
    f.flash = Math.max(0, f.flash - dt); f.recoil = Math.max(0, f.recoil - dt * 5); f.invuln = Math.max(0, f.invuln - dt); f.revealT -= dt; f.squash *= Math.pow(0.02, dt);
    if (f.ammo < 3) f.ammo = Math.min(3, f.ammo + dt / d.atk.reload);
    if (!d.boss && !d.minion && this.time - f.lastHurt > 3 && this.time - f.lastShot > 3 && f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.13 * dt);
    if (f.vuln > 0) f.vuln -= dt;
    if (!f.shield && f.shieldT > 0) { f.shieldT -= dt; if (f.shieldT <= 0) { f.shield = true; if (f === this.boss || dist(f.x, f.y, this.player.x, this.player.y) < 10 * T) { this.ui.banner('SHIELD IS BACK!', 'Smash it again with 🧠', '#9ffcff', 1.4); Sound.play('rule'); } } }
    if (f.super >= 1 && !f.superAnnounced) { f.superAnnounced = true; if (f.isPlayer) { Sound.play('ready'); this.ui.superReady(); this.tip('super'); } }
    // scheduled burst shots
    while (f.burstQ.length && f.burstQ[0].t <= this.time) { const s = f.burstQ.shift(); this.shoot(f, s.ang, d.atk, s.dmg); Sound.play('shoot', 1 + Math.random() * 0.1); }
    if (f.dash) { this.updateDash(f, dt); return; }
    if (f.leap) { this.updateLeap(f, dt); return; }
    let mx = it.mx || 0, my = it.my || 0; const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    const sp = d.speed;
    f.vx = mx * sp; f.vy = my * sp;
    const ox = f.x, oy = f.y;
    this.moveFighter(f, f.vx * dt, f.vy * dt);
    f.vx = (f.x - ox) / dt; f.vy = (f.y - oy) / dt;
    f.moving = len > 0.12; if (f.moving) f.walk += dt * 13;
    if (it.aim != null && (it.aiming || it.fire || it.sup)) f.aim = it.aim;
    if (it.aiming && it.aim != null) f.face = it.aim;
    else if (this.time - f.lastShot < 0.7) f.face = f.aim;
    else if (f.moving) f.face = Math.atan2(my, mx);
    f.inBush = this.bushAt(f.x, f.y);
    if (it.fire && f.ammo >= 1 && this.time - f.lastShot > 0.3) this.attack(f, it.aim != null ? it.aim : f.face, it.tx, it.ty);
    if (it.sup && f.super >= 1) this.doSuper(f, it.aim != null ? it.aim : f.face, it.tx, it.ty);
  }
  updateDead(f, dt) {
    if (this.mode === 'royale') return;
    if (this.mode === 'solo' && (!f.isPlayer || this.lives <= 0)) return;
    f.respawnT -= dt;
    if (f.respawnT <= 0) this.respawn(f);
  }
  respawn(f) {
    f.alive = true; f.hp = f.maxHp; f.x = f.spawn.x; f.y = f.spawn.y; f.ammo = 3; f.invuln = 2.2; f.dash = f.leap = null; f.burstQ = []; f.z = 0;
    this.puff(f.x, f.y, 8, 'rgba(255,255,255,0.9)');
    if (f.isPlayer) this.ui.playerUp();
  }
  moveFighter(f, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 10));
    for (let i = 0; i < steps; i++) { f.x += dx / steps; this.collide(f); f.y += dy / steps; this.collide(f); }
  }
  collide(f) {
    const r = f.r;
    for (let pass = 0; pass < 2; pass++) {
      const x0 = Math.floor((f.x - r) / T), x1 = Math.floor((f.x + r) / T), y0 = Math.floor((f.y - r) / T), y1 = Math.floor((f.y + r) / T);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!this.walkSolid(tx, ty)) continue;
        const rx = tx * T, ry = ty * T, cx = clamp(f.x, rx, rx + T), cy = clamp(f.y, ry, ry + T);
        let dx = f.x - cx, dy = f.y - cy; const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          if (d2 > 1e-6) { const dd = Math.sqrt(d2), push = r - dd; f.x += dx / dd * push; f.y += dy / dd * push; }
          else { const l = f.x - rx, rr = rx + T - f.x, u = f.y - ry, b = ry + T - f.y, m = Math.min(l, rr, u, b);
            if (m === l) f.x = rx - r; else if (m === rr) f.x = rx + T + r; else if (m === u) f.y = ry - r; else f.y = ry + T + r; }
        }
      }
    }
  }
  separate() {
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i], b = fs[j]; if (!a.alive || !b.alive || a.leap || b.leap) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, m = a.r + b.r - 6;
      if (d2 < m * m && d2 > 0.01 && !(a.structure && b.structure)) { const d = Math.sqrt(d2), p = m - d, ka = a.structure ? 0 : b.structure ? 1 : 0.5, kb = 1 - ka; a.x -= dx / d * p * ka; a.y -= dy / d * p * ka; b.x += dx / d * p * kb; b.y += dy / d * p * kb; this.collide(a); this.collide(b); }
    }
  }

  // ---------- attacks ----------
  attack(f, ang, tx, ty) {
    const a = f.def.atk, dmg = a.dmg * f.mult;
    f.ammo -= 1; f.lastShot = this.time; f.revealT = 1.1; f.recoil = 1; f.aim = ang; f.face = ang;
    switch (a.type) {
      case 'burst': for (let i = 0; i < a.count; i++) f.burstQ.push({ t: this.time + i * 0.09, ang: ang + rand(-0.035, 0.035), dmg }); break;
      case 'shotgun': for (let i = 0; i < a.count; i++) this.shoot(f, ang + (i / (a.count - 1) - 0.5) * a.spread + rand(-0.03, 0.03), a, dmg); Sound.play('shotgun'); break;
      case 'bounce': for (let i = 0; i < a.count; i++) this.shoot(f, ang + (i - (a.count - 1) / 2) * a.spread, a, dmg, { bounce: a.bounces, kind: 'star' }); Sound.play('star'); break;
      case 'laser': this.shoot(f, ang, a, dmg, { pierce: true, kind: 'laser' }); Sound.play('laser'); break;
      case 'lob': {
        const R = a.range * T; let x1 = tx, y1 = ty;
        if (x1 == null) { x1 = f.x + Math.cos(ang) * R * 0.8; y1 = f.y + Math.sin(ang) * R * 0.8; }
        const dd = dist(f.x, f.y, x1, y1); if (dd > R) { x1 = f.x + (x1 - f.x) / dd * R; y1 = f.y + (y1 - f.y) / dd * R; }
        this.lobs.push({ x0: f.x, y0: f.y - 20, x1, y1, t: 0, dur: a.flight * (0.7 + 0.3 * dd / R), dmg, radius: a.radius * T, owner: f, team: f.team, alive: true, spin: rand(0, 6) });
        Sound.play('lob'); break;
      }
    }
    if (a.type !== 'burst' && f.isPlayer) this.cam.shake = Math.max(this.cam.shake, 1.5);
  }
  shoot(f, ang, a, dmg, o = {}) {
    const sp = a.speed, sx = f.x + Math.cos(ang) * 18, sy = f.y + Math.sin(ang) * 18;
    this.bullets.push({ x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: o.r || a.r || 9, dmg, team: f.team, owner: f, travel: 0, max: (o.range || a.range) * T,
      pierce: !!o.pierce, bounce: o.bounce || 0, hit: new Set(), color: o.color || a.color, kind: o.kind || 'ball', alive: true, trail: [], isSuper: !!o.isSuper, rot: 0 });
    for (let k = 0; k < 3; k++) this.parts.push({ type: 'spark', x: sx, y: sy, vx: Math.cos(ang + rand(-0.6, 0.6)) * rand(120, 300), vy: Math.sin(ang + rand(-0.6, 0.6)) * rand(120, 300), life: 0.15, max: 0.15, size: 3, color: a.color, z: 22 });
  }
  doSuper(f, ang, tx, ty) {
    const s = f.def.sup, mult = f.mult; f.super = 0; f.superAnnounced = false; f.lastShot = this.time; f.revealT = 1.2; f.aim = f.face = ang;
    if (f.isPlayer) { this.cam.shake = Math.max(this.cam.shake, 4); this.ui.superUsed(); }
    Sound.play('super');
    switch (s.type) {
      case 'dash': f.dash = { vx: Math.cos(ang) * 1150, vy: Math.sin(ang) * 1150, left: s.range * T, hit: new Set(), dmg: s.dmg * mult }; f.invuln = Math.max(f.invuln, 0.4); Sound.play('dash'); break;
      case 'leap': {
        const R = s.range * T; let x1 = tx, y1 = ty; if (x1 == null) { x1 = f.x + Math.cos(ang) * R * 0.8; y1 = f.y + Math.sin(ang) * R * 0.8; }
        const dd = dist(f.x, f.y, x1, y1); if (dd > R) { x1 = f.x + (x1 - f.x) / dd * R; y1 = f.y + (y1 - f.y) / dd * R; }
        const spot = this.nearestOpen(x1, y1);
        f.leap = { x0: f.x, y0: f.y, x1: spot.x, y1: spot.y, t: 0, dur: 0.62, dmg: s.dmg * mult, radius: s.radius * T }; f.invuln = 0.7; break;
      }
      case 'storm': for (let i = 0; i < s.count; i++) this.shoot(f, ang + i / s.count * TAU, f.def.atk, s.dmg * mult, { bounce: 1, kind: 'star', range: s.range, isSuper: true }); break;
      case 'beam': this.shoot(f, ang, { speed: 1500, r: s.r, range: s.range, color: '#9ffcff' }, s.dmg * mult, { pierce: true, kind: 'beam', r: s.r, isSuper: true }); this.cam.shake = Math.max(this.cam.shake, f.isPlayer ? 8 : 0); break;
      case 'barrage': {
        const R = s.range * T; let x1 = tx, y1 = ty; if (x1 == null) { x1 = f.x + Math.cos(ang) * R * 0.75; y1 = f.y + Math.sin(ang) * R * 0.75; }
        const dd = dist(f.x, f.y, x1, y1); if (dd > R) { x1 = f.x + (x1 - f.x) / dd * R; y1 = f.y + (y1 - f.y) / dd * R; }
        for (let i = 0; i < s.count; i++) {
          const a2 = i / (s.count - 1) * TAU, rr = i === 0 ? 0 : 1.7 * T;
          this.lobs.push({ x0: f.x, y0: f.y - 20, x1: x1 + Math.cos(a2) * rr, y1: y1 + Math.sin(a2) * rr, t: -i * 0.06, dur: 0.75, dmg: s.dmg * mult, radius: s.radius * T, owner: f, team: f.team, alive: true, spin: rand(0, 6), isSuper: true });
        }
        break;
      }
    }
  }
  updateDash(f, dt) {
    const D = f.dash, step = Math.min(D.left, Math.hypot(D.vx, D.vy) * dt), ang = Math.atan2(D.vy, D.vx);
    const ox = f.x, oy = f.y; this.moveFighter(f, Math.cos(ang) * step, Math.sin(ang) * step);
    const moved = dist(ox, oy, f.x, f.y); D.left -= step;
    for (let k = 0; k < 3; k++) this.parts.push({ type: 'puff', x: f.x + rand(-10, 10), y: f.y - 20 + rand(-10, 10), vx: rand(-40, 40), vy: rand(-40, 40), life: 0.4, max: 0.4, size: rand(10, 18), color: choice(['#ffd23f', '#ff8a1f', '#ff4f2e']) });
    for (const e of this.fighters) {
      if (!e.alive || e.team === f.team || D.hit.has(e)) continue;
      if (dist(f.x, f.y, e.x, e.y) < f.r + e.r + 14) { D.hit.add(e); this.damage(e, D.dmg, f, { isSuper: true }); this.knock(e, ang, 70); this.burst(e.x, e.y - 30, '#ffd23f', 12); }
    }
    f.moving = true; f.walk += dt * 20; f.face = ang;
    if (D.left <= 1 || moved < step * 0.3) f.dash = null;
  }
  updateLeap(f, dt) {
    const L = f.leap; L.t += dt; const p = Math.min(1, L.t / L.dur);
    f.x = lerp(L.x0, L.x1, p); f.y = lerp(L.y0, L.y1, p); f.z = Math.sin(p * Math.PI) * 120; f.moving = false;
    if (p >= 1) {
      f.leap = null; f.z = 0; f.squash = 1.2; this.collide(f);
      this.explode(f.x, f.y, L.radius, L.dmg, f, { isSuper: true, color: '#d8c39a', big: true });
      for (const e of this.fighters) if (e.alive && e.team !== f.team && dist(f.x, f.y, e.x, e.y) < L.radius + e.r) this.knock(e, Math.atan2(e.y - f.y, e.x - f.x), 110);
      const tr = 1.25 * T, x0 = Math.floor((f.x - tr) / T), x1 = Math.floor((f.x + tr) / T), y0 = Math.floor((f.y - tr) / T), y1 = Math.floor((f.y + tr) / T);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const t = this.tileAt(tx, ty); if ((t === TL.WALL || t === TL.BLOCK || t === TL.CRATE) && tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && dist((tx + 0.5) * T, (ty + 0.5) * T, f.x, f.y) < tr + T * 0.3) this.breakTile(tx, ty, f); }
    }
  }
  knock(e, ang, d) { if (!e.alive || e.structure) return; this.moveFighter(e, Math.cos(ang) * d, Math.sin(ang) * d); }
  nearestOpen(x, y) {
    let tx = clamp(Math.floor(x / T), 0, this.w - 1), ty = clamp(Math.floor(y / T), 0, this.h - 1);
    if (!this.walkSolid(tx, ty)) return { x: clamp(x, tx * T + 26, tx * T + T - 26), y: clamp(y, ty * T + 26, ty * T + T - 26) };
    for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!this.walkSolid(tx + dx, ty + dy)) return { x: (tx + dx + 0.5) * T, y: (ty + dy + 0.5) * T };
    return { x, y };
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      const sp = Math.hypot(b.vx, b.vy), total = sp * dt, n = Math.max(1, Math.ceil(total / 10));
      b.rot += dt * 14;
      for (let i = 0; i < n && b.alive; i++) {
        const px = b.x, py = b.y; b.x += b.vx * dt / n; b.y += b.vy * dt / n; b.travel += total / n;
        if (b.travel >= b.max) {
          b.alive = false; this.burst(b.x, b.y - 22, b.color, 4, 80);
          if (b.split) { const a = Math.atan2(b.vy, b.vx); for (const s of [-0.55, 0.55]) this.shoot(b.owner, a + s, { speed: 520, r: 9, color: '#ffd1f4', range: 5 }, b.split.dmg, { r: 9 }), this.bullets[this.bullets.length - 1].x = b.x, this.bullets[this.bullets.length - 1].y = b.y; }
          break;
        }
        const tx = Math.floor(b.x / T), ty = Math.floor(b.y / T);
        if (this.shotSolid(tx, ty)) {
          if (b.kind === 'beam') { if (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h) this.breakTile(tx, ty, b.owner); else b.alive = false; continue; }
          if (this.tileAt(tx, ty) === TL.CRATE) { this.hitCrate(tx, ty, b.dmg, b.owner); if (b.owner.isPlayer) Sound.play('hit', 0.7); }
          if (b.bounce > 0 && this.tileAt(tx, ty) !== TL.CRATE) {
            const ptx = Math.floor(px / T), pty = Math.floor(py / T);
            if (ptx !== tx) b.vx = -b.vx; if (pty !== ty) b.vy = -b.vy; if (ptx === tx && pty === ty) { b.vx = -b.vx; b.vy = -b.vy; }
            b.x = px; b.y = py; b.bounce--; b.hit.clear(); this.burst(b.x, b.y - 22, b.color, 5, 120); continue;
          }
          b.alive = false; this.burst(px, py - 22, b.color, 7, 160); break;
        }
        for (const f of this.fighters) {
          if (!f.alive || f.team === b.team || b.hit.has(f) || f.leap) continue;
          const rr = f.r + b.r; if ((f.x - b.x) ** 2 + (f.y - b.y) ** 2 < rr * rr) {
            this.damage(f, b.dmg, b.owner, { isSuper: b.isSuper });
            this.burst(b.x, b.y - 26, b.color, 6, 200);
            if (b.pierce) b.hit.add(f); else { b.alive = false; break; }
          }
        }
      }
      b.trail.push(b.x, b.y); if (b.trail.length > (b.kind === 'laser' || b.kind === 'beam' ? 16 : 10)) b.trail.splice(0, 2);
    }
    this.bullets = this.bullets.filter(b => b.alive);
  }
  updateLobs(dt) {
    for (const l of this.lobs) {
      l.t += dt; if (l.t >= l.dur) { l.alive = false; this.explode(l.x1, l.y1, l.radius, l.dmg, l.owner, { isSuper: l.isSuper, color: '#ff9fb8' }); }
    }
    this.lobs = this.lobs.filter(l => l.alive);
  }
  explode(x, y, radius, dmg, src, o = {}) {
    Sound.play('boom', o.big ? 0.8 : 1.2);
    this.parts.push({ type: 'ring', x, y, life: 0.4, max: 0.4, size: radius, color: o.color || '#fff' });
    for (let k = 0; k < (o.big ? 22 : 12); k++) { const a = rand(0, TAU), s = rand(60, 260); this.parts.push({ type: 'puff', x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 10 - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, life: rand(0.35, 0.7), max: 0.7, size: rand(12, 24), color: choice([o.color || '#fff', '#fff', '#ffd23f']) }); }
    if (src && src.isPlayer || o.big) this.cam.shake = Math.max(this.cam.shake, o.big ? 10 : 3);
    for (const f of this.fighters) if (f.alive && f.team !== src.team && dist(x, y, f.x, f.y) < radius + f.r * 0.6) this.damage(f, dmg, src, o);
    const r = Math.ceil(radius / T);
    for (let ty = Math.floor(y / T) - r; ty <= Math.floor(y / T) + r; ty++) for (let tx = Math.floor(x / T) - r; tx <= Math.floor(x / T) + r; tx++) {
      if (this.tileAt(tx, ty) !== TL.CRATE) continue;
      const cx = clamp(x, tx * T, tx * T + T), cy = clamp(y, ty * T, ty * T + T); if (dist(x, y, cx, cy) < radius) this.hitCrate(tx, ty, dmg, src);
    }
  }
  damage(f, amt, src, o = {}) {
    if (!f.alive || f.invuln > 0 || f.leap || amt <= 0) return;
    let crit = false;
    if (f.shield) {
      amt *= 0.2;
      if (src && src.isPlayer && !this.shieldHint) { this.shieldHint = true; this.ui.banner('MATH SHIELD!', 'It blocks most damage. Press Q or 🧠 and solve a problem to smash it!', '#9ffcff', 3); }
    } else if (f.vuln > 0) { amt *= 1.25; crit = true; }
    amt = Math.round(amt); f.hp -= amt; f.flash = 0.1; f.lastHurt = this.time; f.revealT = Math.max(f.revealT, 0.8);
    if (src && src !== f) {
      if (!o.isSuper) src.super = Math.min(1, src.super + amt / src.def.superCharge);
      src.stats.dmg += amt;
    }
    const mine = src && src.isPlayer, me = f.isPlayer;
    this.texts.push({ x: f.x + rand(-12, 12), y: f.y - 70 * (f.def.scale || 1), text: (f.shield ? '🛡' : '') + amt + (crit ? '!' : ''), color: f.shield ? '#9ffcff' : crit ? '#ffd23f' : me ? '#ff5b5b' : mine ? '#ffffff' : '#ffe9b0', size: crit ? 27 : mine || me ? 22 : 16, life: 0.9, max: 0.9, vy: -70 });
    if (mine) Sound.play('hit');
    if (me) { Sound.play('hurt'); this.cam.shake = Math.max(this.cam.shake, 5); }
    if (f.hp <= 0) {
      if (me && this.mode === 'royale' && !this.secondUsed) {
        this.secondUsed = true; f.hp = 1; f.invuln = 0.5;
        this.ui.quiz('second', (ok, fast, retry) => { if (ok) { f.hp = Math.round(f.maxHp * (retry ? 0.35 : 0.5)); f.invuln = 2.5; this.float(f, 'BACK IN THE FIGHT!', '#7dff6a', 24); this.puff(f.x, f.y, 10, 'rgba(160,255,140,0.9)'); } else this.kill(f, src); });
        return;
      }
      this.kill(f, src);
    }
  }
  kill(f, src) {
    if (!f.alive) return;
    f.alive = false; f.hp = 0; f.stats.deaths++; f.dash = null; f.leap = null; f.z = 0; f.burstQ = [];
    if (src && src !== f) src.stats.ko++;
    Sound.play('ko');
    this.puff(f.x, f.y - 20, 14, 'rgba(255,255,255,0.95)');
    for (let k = 0; k < 10; k++) this.parts.push({ type: 'star', x: f.x, y: f.y - 30, vx: rand(-260, 260), vy: rand(-320, 60), life: rand(0.6, 1), max: 1, size: rand(6, 11), color: choice(['#ffd23f', '#fff', f.def.color]), rot: rand(0, 6), vr: rand(-10, 10), grav: 500 });
    this.ui.feed(src && src !== f ? src.name : this.mode === 'royale' ? 'The poison' : 'A trap gem', f.name, this.relColor(src), this.relColor(f));
    for (let i = 0; i < f.cubesHeld; i++) { const a = rand(0, TAU); this.cubes.push({ x: f.x + Math.cos(a) * 30, y: f.y + Math.sin(a) * 30, z: 0, vz: 360, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, age: 0, alive: true }); }
    f.cubesHeld = 0;
    if (src && src.isPlayer && f !== src) this.koStreak(src);
    if (this.mode === 'solo') {
      for (let i = 0; i < f.gems; i++) this.dropGem(f.x, f.y, null);
      f.gems = 0;
      if (f.isPlayer) {
        this.lives--;
        if (this.lives > 0) { f.respawnT = 3; this.ui.playerDown(true); }
        else if (!this.continueUsed) { this.continueUsed = true; this.continueT = 1.4; this.ui.playerDown(false); this.ui.banner('OUT OF LIVES!', 'Solve one problem to keep going!', '#ff9f1c', 1.6, true); }
        else { this.ui.playerDown(false); this.endSoon({ outcome: 'fail', why: 'You ran out of lives.' }, 1.8); }
      } else {
        this.kills++;
        if (f.def.boss) {
          this.cam.shake = 16; this.slow = 1.4; this.explode(f.x, f.y, 3 * T, 0, f, { big: true, color: '#ffd23f' });
          for (const e of this.fighters) if (e.alive && e !== f && e.team === f.team) this.kill(e, src);
          this.ui.banner('BOSS DEFEATED!', 'You did it!', '#ffd23f', 2.5, true); this.endSoon({ outcome: 'clear' }, 2.4);
        } else if (f.structure) {
          this.factoriesDown++; this.slow = Math.max(this.slow, 0.5); this.cam.shake = 12;
          this.explode(f.x, f.y, 2 * T, 0, f, { big: true, color: '#ff9f1c' });
          const left = this.factories.length - this.factoriesDown;
          if (left > 0) this.ui.banner('FACTORY DESTROYED!', `${left} to go`, '#ff9f1c', 1.6);
        } else if (this.stage.dropCube && Math.random() < this.stage.dropCube) this.cubes.push({ x: f.x, y: f.y, z: 0, vz: 360, age: 0, alive: true });
      }
    } else if (this.mode === 'grab') {
      for (let i = 0; i < f.gems; i++) this.dropGem(f.x, f.y, null);
      f.gems = 0; f.respawnT = 5;
      if (f.isPlayer) this.ui.playerDown(true);
    } else {
      const drops = Math.max(1, Math.floor(f.power / 2));
      for (let i = 0; i < drops; i++) { const a = rand(0, TAU); this.cubes.push({ x: f.x + Math.cos(a) * 30, y: f.y + Math.sin(a) * 30, z: 0, vz: 360, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, age: 0, alive: true }); }
      this.aliveCount = this.fighters.filter(x => x.alive).length; f.place = this.aliveCount + 1;
      if (f.isPlayer) { this.ui.playerDown(false); this.endSoon({ outcome: 'place', rank: f.place }, 1.8); }
      else if (this.aliveCount === 1 && this.player.alive) { this.player.place = 1; this.endSoon({ outcome: 'place', rank: 1 }, 1.4); this.ui.banner('VICTORY!', 'Last one standing!', '#ffd23f', 2, true); }
    }
    if (src && src.isPlayer) { this.cam.shake = Math.max(this.cam.shake, 6); }
  }
  koStreak(p) {
    this.koTimes = this.koTimes.filter(t => this.time - t < 2.6); this.koTimes.push(this.time);
    const n = this.koTimes.length; if (n < 2) return;
    this.texts.push({ x: p.x, y: p.y - 175, text: n === 2 ? 'DOUBLE KO!' : n === 3 ? 'TRIPLE KO!' : 'UNSTOPPABLE!', color: n >= 3 ? '#ff8be6' : '#ffd23f', size: 30 + 3 * Math.min(n, 4), life: 1.6, max: 1.6, vy: -30 });
    Sound.play('rule', 1 + n * 0.1); p.super = Math.min(1, p.super + 0.15);
  }
  relColor(f) { if (!f) return '#7dff6a'; if (f.isPlayer) return '#ffd23f'; return f.team === this.player.team ? '#5ec8ff' : '#ff6b6b'; }
  powerUp(f, txt) {
    f.power++; const old = f.maxHp; f.maxHp = Math.round(f.baseHp * (1 + 0.1 * f.power)); f.hp = Math.min(f.maxHp, f.hp + (f.maxHp - old) + 800);
    f.stats.cubes++; this.float(f, txt || 'POWER UP!', '#7dff6a', 20);
    for (let k = 0; k < 14; k++) this.parts.push({ type: 'star', x: f.x + rand(-20, 20), y: f.y - rand(10, 60), vx: rand(-60, 60), vy: rand(-200, -60), life: 0.9, max: 0.9, size: rand(5, 9), color: choice(['#7dff6a', '#d2ff8a', '#fff']), rot: 0, vr: rand(-8, 8), grav: 0 });
  }
  endSoon(res, delay) { if (this.ending) return; this.ending = true; setTimeout(() => this.finish(res), delay * 1000); }
  finish(res) {
    if (this.over) return; this.over = true;
    const p = this.player;
    Object.assign(res, { time: Math.round(this.playTime), deaths: p.stats.deaths, traps: this.traps, hp: p.alive ? p.hp / p.maxHp : 0, gems: p.stats.gems, kos: p.stats.ko, stage: this.stage ? this.stage.id : null });
    this.ui.end(res);
  }

  // ---------- pickups ----------
  dropGem(x, y, num) {
    const a = rand(0, TAU), s = rand(60, 150);
    this.gems.push({ id: ++this.gemId, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, z: 0, vz: rand(260, 380), num, age: 0, alive: true });
  }
  updatePickups(dt) {
    const phys = o => {
      o.age += dt; if (o.vz !== undefined) { o.vz -= 1100 * dt; o.z += o.vz * dt; if (o.z <= 0) { o.z = 0; o.vz = Math.abs(o.vz) > 120 ? -o.vz * 0.35 : 0; } }
      if (o.vx) { const nx = o.x + o.vx * dt, ny = o.y + o.vy * dt; if (!this.walkSolid(Math.floor(nx / T), Math.floor(ny / T))) { o.x = nx; o.y = ny; } else { o.vx = -o.vx * 0.5; o.vy = -o.vy * 0.5; } const fr = Math.pow(0.05, dt); o.vx *= fr; o.vy *= fr; if (Math.abs(o.vx) < 3) o.vx = 0; }
    };
    for (const gm of this.gems) {
      phys(gm);
      if (gm.num != null && gm.age > 22) { gm.alive = false; this.puff(gm.x, gm.y - 10, 3, 'rgba(210,170,255,0.8)'); continue; }
      if (gm.age < 0.5) continue;
      for (const f of this.fighters) {
        if (!f.alive || f.leap || f.structure || (this.mode === 'solo' && !f.isPlayer && !this.stage.botsTakeGems)) continue;
        const rr = f.r + (gm.num == null || this.rule.f(gm.num) ? 16 : 4);
        if ((f.x - gm.x) ** 2 + (f.y - gm.y) ** 2 < rr * rr) { this.takeGem(f, gm); break; }
      }
    }
    this.gems = this.gems.filter(g => g.alive);
    for (const c of this.cubes) {
      phys(c); if (c.age < 0.45 || c.z > 6) continue;
      for (const f of this.fighters) {
        if (!f.alive || f.leap || f.structure || (this.mode === 'solo' && !f.isPlayer)) continue;
        if ((f.x - c.x) ** 2 + (f.y - c.y) ** 2 < (f.r + 18) ** 2) { this.takeCube(f, c); break; }
      }
    }
    this.cubes = this.cubes.filter(c => c.alive);
  }
  takeGem(f, gm) {
    gm.alive = false;
    const good = gm.num == null || this.rule.f(gm.num);
    if (good) {
      f.gems++; f.stats.gems++;
      for (let k = 0; k < 8; k++) this.parts.push({ type: 'star', x: gm.x, y: gm.y - 20, vx: rand(-80, 80), vy: rand(-220, -80), life: 0.6, max: 0.6, size: rand(4, 7), color: gm.num == null ? '#ffe066' : '#d9a6ff', rot: 0, vr: 6, grav: 200 });
      if (f.isPlayer) {
        Sound.play('gem'); this.float(f, gm.num == null ? '+1 GEM' : `+1  ✓ ${gm.num}`, '#d9a6ff', 20);
        this.gemCombo = this.gemCombo.filter(t => this.time - t < 3.5); this.gemCombo.push(this.time);
        if (this.gemCombo.length >= 3) { this.gemCombo = []; f.super = Math.min(1, f.super + 0.3); this.texts.push({ x: f.x, y: f.y - 180, text: 'GEM COMBO! +SUPER', color: '#ff8be6', size: 28, life: 1.5, max: 1.5, vy: -30 }); Sound.play('cube'); }
      }
      else if (dist(f.x, f.y, this.player.x, this.player.y) < 9 * T) Sound.play('gem', 0.8);
    } else {
      const lost = f.gems > 0; if (lost) { f.gems--; }
      this.damage(f, 400, null, { isSuper: true });
      for (let k = 0; k < 10; k++) this.parts.push({ type: 'zap', x: f.x, y: f.y - 30, vx: rand(-200, 200), vy: rand(-200, 200), life: 0.35, max: 0.35, size: rand(10, 20), color: '#9ffcff' });
      this.float(f, 'TRAP GEM!', '#9ffcff', f.isPlayer ? 22 : 16);
      if (f.isPlayer) { this.traps++; Sound.play('trap'); this.ui.trap(gm.num, this.rule); }
    }
  }
  takeCube(f, c) {
    c.alive = false;
    if (f.isPlayer) {
      f.cubesHeld++; Sound.play('cube');
      this.float(f, '+1 BRAIN CUBE 🧊', '#ff8be6', 20); this.tip('cube');
    } else {
      if (Math.random() < f.bot.mathSkill) this.powerUp(f, 'SOLVED! +POWER');
      else this.float(f, 'Wrong answer!', '#ff9a9a', 15);
    }
  }
  float(f, text, color, size) { this.texts.push({ x: f.x, y: f.y - 150, text, color, size, life: 1.4, max: 1.4, vy: -40 }); }

  // ---------- modes ----------
  teamGems(team) { let s = 0; for (const f of this.fighters) if (f.team === team) s += f.gems; return s; }
  updateGems(dt) {
    this.mineT -= dt;
    if (this.mineT <= 0) {
      const burst = (this.stage && this.stage.gemBurst) || 1;
      this.mineT = ((this.stage && this.stage.gemEvery) || 4.2) * burst;
      for (let k = 0; k < burst && this.gems.length < 14; k++) {
        const good = Math.random() < 0.56, num = BBMath.gemNumber(this.rule, good);
        this.dropGem(this.mine.x, this.mine.y, num); this.mineFlash = 0.4;
      }
      if (burst > 1) Sound.play('gem', 0.7);
    }
    if (this.mineFlash > 0) this.mineFlash -= dt;
    this.ruleT -= dt;
    if (this.ruleT <= 0) {
      this.rule = BBMath.pickRule(this.ruleLv, this.rule, this.ruleNames); this.ruleT = this.ruleLen;
      for (const f of this.fighters) if (f.bot) f.bot.beliefs.clear();
      this.ui.newRule(this.rule); Sound.play('rule');
    } else if (this.ruleT < 5 && this.ruleT + dt >= 5) this.ui.banner('RULE CHANGES IN 5!', 'Gems on the floor may become traps', '#ffd23f', 1.6);
  }
  updateGrabWin(dt) {
    const g0 = this.teamGems(0), g1 = this.teamGems(1);
    const lead = g0 >= 10 && g0 > g1 ? 0 : g1 >= 10 && g1 > g0 ? 1 : -1;
    if (lead !== this.lead) { this.lead = lead; this.cd = 15; if (lead >= 0) { this.ui.banner(lead === 0 ? 'HOLD ON!' : 'STOP THEM!', lead === 0 ? 'Keep 10+ gems for 15 seconds' : 'The other team has 10+ gems!', lead === 0 ? '#5ec8ff' : '#ff6b6b', 1.8); Sound.play('rule'); } }
    else if (lead >= 0) {
      const before = Math.ceil(this.cd); this.cd -= dt;
      if (Math.ceil(this.cd) !== before && before <= 10) Sound.play('tick');
      if (this.cd <= 0) this.endSoon({ outcome: lead === 0 ? 'win' : 'lose' }, 0.3);
    }
    this.clock -= dt;
    if (this.clock <= 0 && !this.ending) { this.clock = 0; this.endSoon({ outcome: g0 > g1 ? 'win' : g1 > g0 ? 'lose' : 'draw' }, 0.3); }
  }
  updateRoyale(dt) {
    const W = this.w * T, H = this.h * T, p = clamp((this.time - 20) / 100, 0, 1), minHalf = 2.5 * T;
    const hx = lerp(W / 2, minHalf, p), hy = lerp(H / 2, minHalf, p);
    this.safe = { x0: W / 2 - hx, y0: H / 2 - hy, x1: W / 2 + hx, y1: H / 2 + hy, p };
    if (p > 0 && !this.poisonWarned) { this.poisonWarned = true; this.ui.banner('POISON IS CLOSING IN!', 'Move toward the center', '#7dff6a', 2); }
    this.poisonTick -= dt;
    if (this.poisonTick <= 0) {
      this.poisonTick = 0.5;
      for (const f of this.fighters) if (f.alive && !this.inSafe(f.x, f.y)) { this.damage(f, 450, null, { isSuper: true }); }
    }
  }
  updateSolo(dt) {
    const S = this.stage, P = this.player; if (this.ending) return;
    if (this.continueT > 0) {
      this.continueT -= dt;
      if (this.continueT <= 0) this.ui.quiz('continue', ok => {
        if (ok) { this.lives = 1; this.respawn(P); P.invuln = 3; this.ui.banner('KEEP GOING!', 'One more life. You got this!', '#7dff6a', 1.8); }
        else this.endSoon({ outcome: 'fail', why: 'You ran out of lives.' }, 0.6);
      });
      return;
    }
    this.tipT -= dt;
    if (this.tipT <= 0 && P.alive) {
      this.tipT = 0.5;
      const tx = Math.floor(P.x / T), ty = Math.floor(P.y / T);
      for (let y = ty - 4; y <= ty + 4; y++) for (let x = tx - 4; x <= tx + 4; x++) if (this.tileAt(x, y) === TL.CRATE && x >= 0 && y >= 0 && x < this.w && y < this.h) { this.tip('crate'); y = ty + 5; break; }
      if (this.shieldTarget()) this.tip('shield');
    }
    if (S.supply) {
      this.supplyT -= dt;
      if (this.supplyT <= 0 && P.alive) {
        this.supplyT = S.supply.every;
        const a = rand(0, TAU), r = rand(2, 3.5) * T, spot = this.nearestOpen(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r);
        this.cubes.push({ x: spot.x, y: spot.y, z: 480, vz: 0, age: 0, alive: true, drop: true });
        this.ui.banner('SUPPLY DROP!', 'A Brain Cube is falling nearby', '#ff8be6', 1.3); Sound.play('lob', 0.5);
      }
    }
    if (S.time) {
      this.clock -= dt;
      if (this.clock <= 0) {
        this.clock = 0;
        if (S.type === 'survive') { this.ui.banner('YOU SURVIVED!', '', '#ffd23f', 2.2, true); this.endSoon({ outcome: 'clear' }, 1.6); }
        else { this.ui.banner("TIME'S UP!", '', '#ff6b6b', 2, true); this.endSoon({ outcome: 'fail', why: "Time ran out." }, 1.6); }
        return;
      }
      if (S.type !== 'survive' && this.clock <= 10 && Math.ceil(this.clock) !== Math.ceil(this.clock + dt)) Sound.play('tick');
    }
    const left = this.enemiesLeft();
    if (S.waves && left === (this.boss && this.boss.alive ? 1 : 0) && this.waveIdx < S.waves.length - 1) {
      if (this.waveIdx >= 0 && !this.waveCleared) {
        this.waveCleared = true; this.waveT = 2.6;
        if (P.alive) { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.35); P.ammo = 3; this.float(P, '+HEALTH', '#7dff6a', 20); }
        this.ui.banner('WAVE CLEARED!', P.cubesHeld ? 'Quick! Open your Brain Cubes now (Q / 🧠)' : 'Get ready for the next one…', '#7dff6a', 1.6);
        Sound.play('ready');
      }
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.waveIdx++; this.waveT = 1.6; this.waveCleared = false;
        for (const spec of S.waves[this.waveIdx]) for (let i = 0; i < (spec.n || 1); i++) this.spawnEnemy(spec);
        if (S.waves.length > 1) this.ui.banner(this.waveIdx === S.waves.length - 1 ? 'FINAL WAVE!' : `WAVE ${this.waveIdx + 1}`, `${S.waves[this.waveIdx].reduce((a, s) => a + (s.n || 1), 0)} robots incoming`, '#ff9f1c', 1.4);
      }
    }
    if (S.swarm) {
      this.swarmT -= dt;
      const prog = S.time ? clamp(1 - this.clock / S.time, 0, 1) : 0.5;
      if (this.swarmT <= 0) { this.swarmT = S.swarm.every * (1 - 0.35 * prog); if (left < S.swarm.max) this.spawnEnemy(choice(S.swarm.pool)); }
    }
    let done = false;
    if (S.type === 'defeat') done = this.waveIdx === S.waves.length - 1 && this.enemiesLeft() === 0;
    else if (S.type === 'gems') done = this.player.alive && this.player.gems >= S.goal;
    else if (S.type === 'cubes') done = this.solved >= S.goal;
    else if (S.type === 'factories') done = this.factories.length > 0 && this.factoriesDown >= this.factories.length;
    if (done) {
      if (S.type === 'factories') for (const e of this.fighters) if (e.alive && e.team !== P.team) { e.alive = false; this.puff(e.x, e.y - 20, 8, 'rgba(255,255,255,0.9)'); }
      this.slow = Math.max(this.slow, 0.8);
      this.ui.banner('STAGE CLEAR!', S.type === 'factories' ? 'All robots shut down!' : '', '#ffd23f', 2.2, true); Sound.play('win'); this.endSoon({ outcome: 'clear' }, 1.6);
    }
  }
  inSafe(x, y) { const s = this.safe; return !s || (x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1); }

  // ---------- line of sight & visibility ----------
  canSee(team, e) {
    if (e.team === team || !e.inBush || e.revealT > 0) return true;
    for (const f of this.fighters) if (f.alive && f.team === team && dist(f.x, f.y, e.x, e.y) < 2.4 * T) return true;
    return false;
  }
  clearShot(x0, y0, x1, y1, ignore = -1) {
    const d = dist(x0, y0, x1, y1), n = Math.ceil(d / 14);
    for (let i = 1; i < n; i++) { const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n), tx = Math.floor(x / T), ty = Math.floor(y / T); if (ty * this.w + tx === ignore) continue; if (this.shotSolid(tx, ty)) return false; }
    return true;
  }
  clearWalk(x0, y0, x1, y1, r = 20) {
    const d = dist(x0, y0, x1, y1), n = Math.ceil(d / 16); if (n === 0) return true;
    const nx = -(y1 - y0) / d, ny = (x1 - x0) / d;
    for (let i = 1; i <= n; i++) { const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n);
      for (const o of [-r, 0, r]) if (this.walkSolid(Math.floor((x + nx * o) / T), Math.floor((y + ny * o) / T))) return false; }
    return true;
  }
  flowTo(tx, ty) {
    tx = clamp(tx, 0, this.w - 1); ty = clamp(ty, 0, this.h - 1);
    const key = ty * this.w + tx, c = this.flowCache.get(key);
    if (c && c.ver === this.tileVer) return c.d;
    if (this.flowCache.size > 80) this.flowCache.clear();
    const d = new Int16Array(this.w * this.h).fill(-1), q = new Int32Array(this.w * this.h); let qh = 0, qt = 0;
    d[key] = 0; q[qt++] = key;
    while (qh < qt) { const k = q[qh++], x = k % this.w, y = (k / this.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue; const nk = ny * this.w + nx; if (d[nk] >= 0 || this.tile[nk] !== TL.FLOOR) continue; d[nk] = d[k] + 1; q[qt++] = nk; } }
    this.flowCache.set(key, { ver: this.tileVer, d });
    return d;
  }

  // ---------- camera & effects ----------
  updateCamera(dt) {
    const p = this.player, c = this.cam;
    let tx = p.x, ty = p.y - 30;
    if (this.input.mouse && this.input.aim != null && p.alive) { tx += Math.cos(this.input.aim) * 50; ty += Math.sin(this.input.aim) * 40; }
    let b = this.boss && this.boss.alive ? this.boss : null;
    if (!b && this.factories) { let bd = 9 * T; for (const f of this.factories) if (f.alive) { const d = dist(f.x, f.y, p.x, p.y); if (d < bd) { bd = d; b = f; } } }
    if (b && p.alive) { tx += clamp((b.x - p.x) * 0.3, -170, 170); ty += clamp((b.y - p.y) * 0.35, -190, 190); }
    const k = Math.min(1, dt * 7); c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
    const hw = this.vw / 2 / c.s, hh = this.vh / 2 / c.s, W = this.w * T, H = this.h * T, m = 1.4 * T;
    if (2 * hw >= W + 2 * m) c.x = W / 2; else c.x = clamp(c.x, hw - m, W - hw + m);
    if (2 * hh >= H + 2 * m) c.y = H / 2; else c.y = clamp(c.y, hh - m, H - hh + m);
    c.shake = Math.max(0, c.shake - dt * 30);
  }
  updateFx(dt) {
    for (const q of this.parts) {
      q.life -= dt; if (q.vx !== undefined) { q.x += q.vx * dt; q.y += q.vy * dt; }
      if (q.type === 'debris') { q.vz -= 1200 * dt; q.z += q.vz * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.3; q.vx *= 0.6; q.vy *= 0.6; } q.rot += q.vr * dt; const f = Math.pow(0.3, dt); q.vx *= f; q.vy *= f; }
      else if (q.type === 'puff') { const f = Math.pow(0.05, dt); q.vx *= f; q.vy *= f; }
      else if (q.type === 'star') { q.vy += (q.grav || 0) * dt; q.rot += q.vr * dt; }
    }
    this.parts = this.parts.filter(q => q.life > 0);
    if (this.parts.length > 700) this.parts.splice(0, this.parts.length - 700);
    for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= Math.pow(0.2, dt); }
    this.texts = this.texts.filter(t => t.life > 0);
    for (let i = 0; i < this.tshake.length; i++) if (this.tshake[i] > 0) this.tshake[i] -= dt;
  }
  puff(x, y, n, color) { for (let k = 0; k < n; k++) { const a = rand(0, TAU), s = rand(40, 160); this.parts.push({ type: 'puff', x, y: y - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, life: rand(0.4, 0.7), max: 0.7, size: rand(12, 22), color }); } }
  burst(x, y, color, n = 6, sp = 180) { for (let k = 0; k < n; k++) { const a = rand(0, TAU), s = rand(sp * 0.3, sp); this.parts.push({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25, max: 0.25, size: rand(2, 4), color }); } }
}

// ---------- bots ----------
class Bot {
  constructor(g, f, skill, lane) {
    this.g = g; this.f = f; this.skill = skill; this.lane = lane;
    this.thinkT = Math.random() * 0.3; this.target = null; this.react = 0.6; this.fireCD = 0.5; this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = 1;
    this.goal = null; this.mode = 'lane'; this.beliefs = new Map(); this.wander = null; this.wanderT = 0; this.crate = -1; this.stuckT = 0; this.lastPos = { x: f.x, y: f.y };
    this.mathSkill = clamp(0.9 - 0.04 * (g.level - 1) + 0.06 * skill, 0.62, 0.95);
  }
  believes(gm) {
    if (gm.num == null) return true;
    if (!this.beliefs.has(gm.id)) { const truth = this.g.rule.f(gm.num); this.beliefs.set(gm.id, Math.random() < this.mathSkill ? truth : !truth); }
    return this.beliefs.get(gm.id);
  }
  decide() {
    const g = this.g, f = this.f, range = f.def.atk.range * T;
    let best = null, bd = 1e9;
    for (const e of g.fighters) {
      if (!e.alive || e.team === f.team || !g.canSee(f.team, e)) continue;
      const d = dist(f.x, f.y, e.x, e.y); if (d > 11 * T) continue;
      const s = d * (0.6 + 0.4 * e.hp / e.maxHp) + (e.isPlayer ? -10 : 0);
      if (s < bd) { bd = s; best = e; }
    }
    if (best !== this.target) { this.target = best; this.react = 0.22 + (1 - this.skill) * 0.5; }
    const hpR = f.hp / f.maxHp, tgtD = this.target ? dist(f.x, f.y, this.target.x, this.target.y) : 1e9;
    this.goal = null; this.mode = 'idle'; this.crate = -1;
    const nearest = (list, ok, maxD) => { let b = null, bd2 = maxD; for (const o of list) { if (!o.alive || !ok(o)) continue; const d = dist(f.x, f.y, o.x, o.y); if (d < bd2) { bd2 = d; b = o; } } return b; };
    if (g.mode === 'solo') {
      const P = g.player;
      if (hpR < 0.25 && this.target && tgtD < 4 * T && Math.random() < 0.4) { this.mode = 'retreat'; const a = Math.atan2(f.y - this.target.y, f.x - this.target.x); this.goal = g.nearestOpen(f.x + Math.cos(a) * 4 * T, f.y + Math.sin(a) * 4 * T); return; }
      if (g.gemsOn && g.stage.botsTakeGems) { const gem = nearest(g.gems, gm => gm.age > 0.3 && this.believes(gm), 8 * T); if (gem && !(this.target && tgtD < 3.5 * T)) { this.mode = 'gem'; this.goal = { x: gem.x, y: gem.y }; return; } }
      if (this.target && tgtD < 10 * T) { this.mode = 'fight'; return; }
      if (P.alive) { this.mode = 'hunt'; const hid = !g.canSee(f.team, P); this.goal = { x: P.x + (hid ? rand(-2, 2) * T : 0), y: P.y + (hid ? rand(-2, 2) * T : 0) }; return; }
      this.mode = 'idle'; this.goal = { x: f.spawn.x, y: f.spawn.y }; return;
    }
    if (g.mode === 'grab') {
      const mySide = f.team === 0 ? 1 : -1;
      if (hpR < 0.33 && this.target && tgtD < 7 * T) { this.mode = 'retreat'; this.goal = { x: f.spawn.x, y: f.spawn.y }; return; }
      if (f.gems >= 4 && g.lead === f.team) { this.mode = 'protect'; this.goal = { x: g.mine.x + ({ left: -3, mid: 0, right: 3 }[this.lane] || 0) * T, y: g.mine.y + mySide * 7 * T }; return; }
      const gem = nearest(g.gems, gm => gm.age > 0.3 && this.believes(gm), 10 * T);
      if (gem && !(this.target && tgtD < 3.5 * T)) { this.mode = 'gem'; this.goal = { x: gem.x, y: gem.y }; return; }
      const cube = nearest(g.cubes, () => true, 8 * T);
      if (cube) { this.mode = 'cube'; this.goal = { x: cube.x, y: cube.y }; return; }
      if (this.target && tgtD < 9.5 * T) { this.mode = 'fight'; return; }
      const cr = this.findCrate(7);
      if (cr >= 0 && this.lane !== 'mid') { this.mode = 'crate'; this.crate = cr; return; }
      this.mode = 'lane';
      this.goal = { x: g.mine.x + ({ left: -3.5, mid: 0, right: 3.5 }[this.lane] || 0) * T, y: g.mine.y + mySide * 2.2 * T };
    } else {
      const s = g.safe, cx = g.w * T / 2, cy = g.h * T / 2, margin = 1.2 * T;
      if (s.p > 0 && (f.x < s.x0 + margin || f.x > s.x1 - margin || f.y < s.y0 + margin || f.y > s.y1 - margin)) { this.mode = 'zone'; this.goal = { x: cx + rand(-T, T), y: cy + rand(-T, T) }; if (this.target && tgtD < range) this.mode = 'zonefight'; return; }
      if (hpR < 0.3 && this.target && tgtD < 6 * T) { this.mode = 'flee'; const a = Math.atan2(f.y - this.target.y, f.x - this.target.x); this.goal = { x: clamp(f.x + Math.cos(a) * 5 * T, s.x0 + T, s.x1 - T), y: clamp(f.y + Math.sin(a) * 5 * T, s.y0 + T, s.y1 - T) }; return; }
      const cube = nearest(g.cubes, c => g.inSafe(c.x, c.y), 9 * T);
      if (cube && !(this.target && tgtD < 3 * T)) { this.mode = 'cube'; this.goal = { x: cube.x, y: cube.y }; return; }
      const hurt = g.time - f.lastHurt < 2.5, eager = g.time > 30 || f.power >= 2 || hurt;
      if (this.target && tgtD < (eager ? 8 : 4.5) * T && (hpR > 0.45 || this.target.hp < f.hp || hurt)) { this.mode = 'fight'; return; }
      const cr = this.findCrate(13);
      if (cr >= 0) { this.mode = 'crate'; this.crate = cr; return; }
      this.wanderT -= 0.3;
      if (!this.wander || this.wanderT <= 0 || dist(f.x, f.y, this.wander.x, this.wander.y) < T) { this.wanderT = 4; this.wander = g.nearestOpen(rand(s.x0 + T, s.x1 - T), rand(s.y0 + T, s.y1 - T)); }
      this.mode = 'wander'; this.goal = this.wander;
    }
  }
  findCrate(maxTiles) {
    const g = this.g, f = this.f, ftx = Math.floor(f.x / T), fty = Math.floor(f.y / T); let best = -1, bd = 1e9;
    for (let y = fty - maxTiles; y <= fty + maxTiles; y++) for (let x = ftx - maxTiles; x <= ftx + maxTiles; x++) {
      if (g.tileAt(x, y) !== TL.CRATE) continue; const cx = (x + 0.5) * T, cy = (y + 0.5) * T; if (!g.inSafe(cx, cy)) continue;
      const d = Math.abs(x - ftx) + Math.abs(y - fty); if (d < bd) { bd = d; best = y * g.w + x; }
    }
    return best;
  }
  steer(gx, gy) {
    const g = this.g, f = this.f;
    if (dist(f.x, f.y, gx, gy) < 8) return { x: 0, y: 0 };
    if (g.clearWalk(f.x, f.y, gx, gy, f.r - 4)) { const d = dist(f.x, f.y, gx, gy); return { x: (gx - f.x) / d, y: (gy - f.y) / d }; }
    const gtx = Math.floor(gx / T), gty = Math.floor(gy / T), field = g.flowTo(gtx, gty);
    const ftx = Math.floor(f.x / T), fty = Math.floor(f.y / T), cur = field[fty * g.w + ftx];
    let bx = null, by = null, bv = cur < 0 ? 1e9 : cur;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = ftx + dx, ny = fty + dy; if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
      const v = field[ny * g.w + nx]; if (v < 0) continue;
      if (dx && dy && (g.walkSolid(ftx + dx, fty) || g.walkSolid(ftx, fty + dy))) continue;
      const vv = v + (dx && dy ? 0.4 : 0);
      if (vv < bv) { bv = vv; bx = (nx + 0.5) * T; by = (ny + 0.5) * T; }
    }
    if (bx == null) { const d = dist(f.x, f.y, gx, gy) || 1; return { x: (gx - f.x) / d, y: (gy - f.y) / d }; }
    const d = dist(f.x, f.y, bx, by) || 1; return { x: (bx - f.x) / d, y: (by - f.y) / d };
  }
  intent(dt) {
    const g = this.g, f = this.f, it = { mx: 0, my: 0, aim: null, fire: false, sup: false, tx: null, ty: null, aiming: false };
    if (g.phase !== 'play') return it;
    if (f.stun > 0) { f.stun -= dt; return it; }
    this.thinkT -= dt; this.react -= dt; this.fireCD -= dt; this.strafeT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.25 + Math.random() * 0.15; this.decide(); }
    if (this.strafeT <= 0) { this.strafeT = rand(0.6, 1.5); this.strafe = -this.strafe; }
    const t = this.target && this.target.alive ? this.target : null;
    const range = f.def.atk.range * T, lob = f.def.atk.type === 'lob';
    let mv = { x: 0, y: 0 };
    if ((this.mode === 'fight' || this.mode === 'zonefight') && t) {
      const d = dist(f.x, f.y, t.x, t.y), los = lob || g.clearShot(f.x, f.y, t.x, t.y);
      const want = range * (f.def.atk.type === 'shotgun' ? 0.55 : 0.72);
      if (this.mode === 'zonefight') mv = this.steer(this.goal.x, this.goal.y);
      else if (!los || d > want + 40) mv = this.steer(t.x, t.y);
      else { const a = Math.atan2(t.y - f.y, t.x - f.x); const back = d < want - 60 ? -0.8 : 0; mv = { x: Math.cos(a) * back + Math.cos(a + Math.PI / 2) * this.strafe * 0.85, y: Math.sin(a) * back + Math.sin(a + Math.PI / 2) * this.strafe * 0.85 }; }
    } else if (this.mode === 'crate' && this.crate >= 0) {
      const cx = (this.crate % g.w + 0.5) * T, cy = (Math.floor(this.crate / g.w) + 0.5) * T, d = dist(f.x, f.y, cx, cy);
      if (g.tile[this.crate] !== TL.CRATE) this.thinkT = 0;
      const los = lob || g.clearShot(f.x, f.y, cx, cy, this.crate);
      if (d > range * 0.75 || !los) mv = this.steer(cx, cy);
      if (d < range * 0.9 && los && !t && f.ammo >= 1 && this.fireCD <= 0) { it.aim = Math.atan2(cy - f.y, cx - f.x) + rand(-0.05, 0.05); it.tx = cx; it.ty = cy; it.fire = true; this.fireCD = rand(0.35, 0.8); }
    } else if (this.goal) {
      mv = this.steer(this.goal.x, this.goal.y);
      if (this.mode === 'protect' && dist(f.x, f.y, this.goal.x, this.goal.y) < T) mv = { x: this.strafe * 0.4, y: 0 };
      if (this.mode === 'lane' && dist(f.x, f.y, this.goal.x, this.goal.y) < 1.2 * T) mv = { x: this.strafe * 0.5, y: Math.sin(g.time * 1.3 + f.seed) * 0.4 };
    }
    // keep away from gems the bot thinks are traps
    if (g.gemsOn && (g.mode !== 'solo' || f.isPlayer || g.stage.botsTakeGems)) for (const gm of g.gems) {
      if (gm.age < 0.3 || this.believes(gm)) continue; const dx = f.x - gm.x, dy = f.y - gm.y, d = Math.hypot(dx, dy);
      if (d < 80 && d > 0.1) { mv.x += dx / d * (80 - d) / 30; mv.y += dy / d * (80 - d) / 30; }
    }
    // unstick
    if (dist(f.x, f.y, this.lastPos.x, this.lastPos.y) < 2 && Math.hypot(mv.x, mv.y) > 0.3) { this.stuckT += dt; if (this.stuckT > 0.6) { this.strafe = -this.strafe; this.stuckT = 0; mv = { x: -mv.y * this.strafe, y: mv.x * this.strafe }; } } else this.stuckT = 0;
    this.lastPos = { x: f.x, y: f.y };
    it.mx = mv.x; it.my = mv.y;
    // shooting at the target
    if (t && this.react <= 0) {
      const d = dist(f.x, f.y, t.x, t.y), los = lob || g.clearShot(f.x, f.y, t.x, t.y);
      const sp = f.def.atk.speed || 900, tt = lob ? f.def.atk.flight : d / sp, lead = 0.35 + 0.6 * this.skill;
      const px = t.x + t.vx * tt * lead, py = t.y + t.vy * tt * lead, err = (1 - this.skill) * 0.34;
      const ang = Math.atan2(py - f.y, px - f.x) + rand(-err, err);
      if (d < range * 0.95 && los && f.ammo >= 1 && this.fireCD <= 0) {
        it.aim = ang; it.tx = px + rand(-30, 30) * (1 - this.skill); it.ty = py + rand(-30, 30) * (1 - this.skill); it.fire = true;
        this.fireCD = rand(0.3, 0.75) + (1 - this.skill) * 0.5 + (f.ammo < 2 ? 0.35 : 0);
      }
      if (f.super >= 1) {
        const st = f.def.sup.type, sr = (f.def.sup.range || 5) * T;
        const ok = st === 'storm' ? d < 3.5 * T : st === 'leap' || st === 'barrage' ? d < sr : st === 'dash' ? d < sr * 0.9 && los : d < sr * 0.8;
        if (ok && Math.random() < dt * 3) { it.sup = true; it.aim = ang; it.tx = px; it.ty = py; }
      }
    }
    return it;
  }
}

// ---------- bosses ----------
// A boss has a Math Shield (blocks 88% of damage) that the player breaks by solving a problem.
// spec.patterns lists its attacks in order: ring, aim, slam, charge, split.
class BossAI {
  constructor(g, f, spec) {
    this.g = g; this.f = f; this.spec = spec; this.t = 2.2; this.i = 0; this.summoned = 0; this.strafe = 1; this.strafeT = 1.5; this.queue = [];
    this.beliefs = new Map(); this.mathSkill = 0;
    f.shield = true; f.shieldT = 0; f.stun = 0; f.vuln = 0;
  }
  believes() { return false; }
  intent(dt) {
    const g = this.g, f = this.f, P = g.player, it = { mx: 0, my: 0, aim: null, fire: false, sup: false, tx: null, ty: null, aiming: true };
    if (g.phase !== 'play') return it;
    for (const q of this.queue) { q.t -= dt; if (q.t <= 0) { q.fn(); q.done = true; } } this.queue = this.queue.filter(q => !q.done);
    if (f.stun > 0) { f.stun -= dt; it.aim = f.face; return it; }
    const hpR = f.hp / f.maxHp, thr = this.spec.summonAt || [0.7, 0.4];
    if (this.summoned < thr.length && hpR < thr[this.summoned]) {
      this.summoned++;
      for (let i = 0; i < (this.spec.minionCount || 2); i++) g.spawnEnemy({ hero: this.spec.minion || 'robo', hp: 0.8, skill: 0.4 }, { x: f.x + rand(-90, 90), y: f.y + rand(-90, 90) });
      g.ui.banner('MINIONS!', `${f.name} called for help`, '#ff6b6b', 1.4);
    }
    if (!P.alive) { it.mx = Math.sin(g.time) * 0.3; return it; }
    const d = dist(f.x, f.y, P.x, P.y), ang = Math.atan2(P.y - f.y, P.x - f.x);
    this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = rand(1.2, 2.4); this.strafe = -this.strafe; }
    const want = 4.5 * T, fwd = d > want + 40 ? 1 : d < want - 80 ? -0.7 : 0;
    it.mx = Math.cos(ang) * fwd + Math.cos(ang + Math.PI / 2) * this.strafe * 0.6; it.my = Math.sin(ang) * fwd + Math.sin(ang + Math.PI / 2) * this.strafe * 0.6;
    it.aim = ang;
    this.t -= dt;
    if (this.t <= 0 && !f.dash) {
      const angry = hpR < 0.4, pats = this.spec.patterns || ['ring', 'aim', 'slam', 'charge'];
      this.attack(pats[this.i++ % pats.length], ang, angry);
      const every = this.spec.every || 2.2; this.t = (angry ? every * 0.75 : every) + rand(0, 0.6);
    }
    return it;
  }
  attack(p, ang, angry) {
    const g = this.g, f = this.f, P = g.player, k = this.spec.dmg || 1, o = (speed, r, color, range) => ({ speed, r, color, range });
    f.recoil = 1; f.lastShot = g.time;
    if (p === 'ring') {
      const n = angry ? 20 : 14, off = rand(0, TAU), volley = () => { for (let i = 0; i < n; i++) g.shoot(f, off + i / n * TAU, o(430, 13, f.def.atk.color, 11), 420 * k); Sound.play('star', 0.6); };
      volley(); if (angry) this.queue.push({ t: 0.45, fn: () => { const off2 = off + Math.PI / n; for (let i = 0; i < n; i++) g.shoot(f, off2 + i / n * TAU, o(430, 13, f.def.atk.color, 11), 420 * k); } });
    } else if (p === 'aim') {
      const shots = () => { const a = Math.atan2(P.y - f.y, P.x - f.x); for (let j = -2; j <= 2; j++) g.shoot(f, a + j * 0.13, o(640, 11, '#ff6b6b', 10), 380 * k); Sound.play('shotgun'); };
      shots(); this.queue.push({ t: 0.5, fn: shots }); if (angry) this.queue.push({ t: 1, fn: shots });
    } else if (p === 'slam') {
      const n = angry ? 5 : 3;
      for (let i = 0; i < n; i++) { const a = rand(0, TAU), r = i === 0 ? 0 : rand(1, 2.4) * T, tx = P.x + P.vx * 0.5 + Math.cos(a) * r, ty = P.y + P.vy * 0.5 + Math.sin(a) * r;
        g.lobs.push({ x0: f.x, y0: f.y - 80, x1: tx, y1: ty, t: -i * 0.12, dur: 1.05, dmg: 700 * k, radius: 1.3 * T, owner: f, team: f.team, alive: true, spin: rand(0, 6) }); }
      Sound.play('lob', 0.6);
    } else if (p === 'charge') {
      f.dash = { vx: Math.cos(ang) * 880, vy: Math.sin(ang) * 880, left: 6.5 * T, hit: new Set(), dmg: 900 * k }; Sound.play('dash', 0.7);
    } else if (p === 'split') {
      const n = angry ? 7 : 5;
      for (let i = 0; i < n; i++) { const a = ang + (i - (n - 1) / 2) * 0.26; g.shoot(f, a, o(460, 15, '#ff8be6', 4.5), 380 * k); g.bullets[g.bullets.length - 1].split = { n: 2, dmg: 200 * k }; }
      Sound.play('star', 0.5);
    }
  }
}

// ---------- robot factories ----------
// A factory never moves. It has a Math Shield and builds robots while the player is nearby.
// spec: { hp, shieldTime, every (seconds per robot), max (robots alive per factory), spawn: [hero ids] }
class FactoryAI {
  constructor(g, f, spec) {
    this.g = g; this.f = f; this.spec = spec; this.t = rand(1.5, 3); this.kids = []; this.beliefs = new Map(); this.mathSkill = 0;
    f.shield = spec.shield !== false; f.shieldT = 0; f.vuln = 0; f.stun = 0; f.aim = f.face = Math.PI / 2;
  }
  believes() { return false; }
  intent(dt) {
    const g = this.g, f = this.f, it = { mx: 0, my: 0, aim: null, fire: false, sup: false, tx: null, ty: null, aiming: false };
    if (g.phase !== 'play') return it;
    if (f.stun > 0) f.stun -= dt;
    this.kids = this.kids.filter(k => k.alive);
    this.t -= dt;
    if (this.t <= 0) {
      this.t = this.spec.every || 7;
      const P = g.player;
      const out = g.fighters.reduce((n, e) => n + (e.alive && e.team === f.team && !e.structure ? 1 : 0), 0);
      if (P.alive && dist(f.x, f.y, P.x, P.y) < 10 * T && this.kids.length < (this.spec.max || 2) && out < (this.spec.cap || 4)) {
        this.kids.push(g.spawnEnemy({ hero: choice(this.spec.spawn || ['robo']), hp: this.spec.kidHp || 0.8, dmg: this.spec.kidDmg || 0.8 }, { x: f.x, y: f.y + f.r + 34 }));
        f.recoil = 1; Sound.play('lob', 0.8);
      }
    }
    return it;
  }
}

// ---------- drawing the arena ----------
Game.prototype.render = function (ctx, W, H, dpr) {
  this.dpr = dpr;
  const c = this.cam, s = c.s, th = this.theme;
  const shx = c.shake ? rand(-c.shake, c.shake) : 0, shy = c.shake ? rand(-c.shake, c.shake) : 0;
  const ox = W / 2 - c.x * s + shx, oy = H / 2 - c.y * s + shy;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = th.border; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
  const vx0 = (0 - ox) / s, vy0 = (0 - oy) / s, vx1 = (W - ox) / s, vy1 = (H - oy) / s;
  const tx0 = Math.floor(vx0 / T) - 1, ty0 = Math.floor(vy0 / T) - 1, tx1 = Math.ceil(vx1 / T) + 1, ty1 = Math.ceil(vy1 / T) + 2;
  const t = this.time;
  // border decoration and floor
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const inside = x >= 0 && y >= 0 && x < this.w && y < this.h;
    if (!inside) {
      if ((x + y) & 1) { ctx.fillStyle = th.border2; ctx.fillRect(x * T, y * T, T, T); }
      continue;
    }
    ctx.fillStyle = (x + y) & 1 ? th.floorA : th.floorB; ctx.fillRect(x * T, y * T, T, T);
    const h = hash2(x, y);
    if (h < 0.35) { ctx.fillStyle = th.speck; circ(ctx, x * T + 12 + h * 100 % 40, y * T + 14 + (h * 1000) % 36, 3 + h * 6); ctx.fill(); }
    if (this.tile[y * this.w + x] === TL.WATER) this.drawWater(ctx, x, y, t);
  }
  ctx.lineWidth = 6; ctx.strokeStyle = th.edge; ctx.strokeRect(-3, -3, this.w * T + 6, this.h * T + 6);
  ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.strokeRect(-6, -6, this.w * T + 12, this.h * T + 12);
  // border props
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    if (x >= -1 && y >= -1 && x <= this.w && y <= this.h) continue;
    const h = hash2(x + 99, y + 7); if (h > 0.42) continue;
    this.drawProp(ctx, x * T + T / 2 + (h - 0.2) * 30, y * T + T / 2, h);
  }
  // ground layer: spawn pads, mine, shadows
  if (this.mode === 'grab') {
    for (const f of this.fighters) if (!f.isPlayer || true) { const col = f.team === this.player.team ? 'rgba(60,160,255,0.16)' : 'rgba(255,70,70,0.16)'; ell(ctx, f.spawn.x, f.spawn.y, 44, 30); ctx.fillStyle = col; ctx.fill(); }
    this.drawMine(ctx, t);
  }
  for (let y = Math.max(0, ty0); y <= Math.min(this.h - 1, ty1); y++) for (let x = Math.max(0, tx0); x <= Math.min(this.w - 1, tx1); x++) {
    const tt = this.tile[y * this.w + x]; if (tt === TL.WALL || tt === TL.BLOCK || tt === TL.CRATE) { ctx.fillStyle = 'rgba(40,20,10,0.16)'; rrect(ctx, x * T + 8, y * T + 10, T, T - 4, 10); ctx.fill(); }
  }
  // team rings & aim indicator under fighters
  const P = this.player;
  for (const f of this.fighters) {
    if (!f.alive || !this.canSee(P.team, f)) continue;
    const mine = f.team === P.team, col = f.isPlayer ? '#4fd3ff' : mine ? '#3a8dff' : '#ff3d3d';
    ell(ctx, f.x, f.y, 27, 11); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
    if (f.isPlayer && f.super >= 1) { ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1, 0.42); ctx.rotate(t * 3); ctx.setLineDash([14, 10]); circ(ctx, 0, 0, 38); ctx.lineWidth = 6; ctx.strokeStyle = '#ffd23f'; ctx.stroke(); ctx.restore(); }
  }
  if (P.alive && this.phase === 'play') this.drawAim(ctx, P);
  // lob shadows + pickups shadows
  for (const l of this.lobs) { if (l.t < 0) continue; const p = clamp(l.t / l.dur, 0, 1); ell(ctx, l.x1, l.y1, l.radius * (0.5 + 0.5 * p), l.radius * 0.45 * (0.5 + 0.5 * p)); ctx.fillStyle = `rgba(255,60,90,${0.12 + 0.18 * p})`; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,60,90,0.6)'; ctx.stroke(); }
  // sorted drawables
  const list = [];
  for (let y = Math.max(0, ty0); y <= Math.min(this.h - 1, ty1); y++) for (let x = Math.max(0, tx0); x <= Math.min(this.w - 1, tx1); x++) {
    const i = y * this.w + x, tt = this.tile[i];
    if (tt === TL.WALL || tt === TL.BLOCK || tt === TL.CRATE) list.push({ y: y * T + T, k: 1, x, ty: y, tt });
    if (this.bush[i]) list.push({ y: y * T + T + 1, k: 2, x, ty: y });
  }
  for (const f of this.fighters) if (f.alive) list.push({ y: f.y, k: 3, f });
  for (const gm of this.gems) list.push({ y: gm.y, k: 4, o: gm });
  for (const cb of this.cubes) list.push({ y: cb.y, k: 5, o: cb });
  list.sort((a, b) => a.y - b.y);
  const pInBush = P.alive && P.inBush;
  for (const d of list) {
    if (d.k === 1) this.drawBlock(ctx, d.x, d.ty, d.tt);
    else if (d.k === 2) { const near = pInBush && Math.abs((d.x + 0.5) * T - P.x) < 1.8 * T && Math.abs((d.ty + 0.5) * T - P.y) < 1.8 * T; this.drawBush(ctx, d.x, d.ty, near ? 0.45 : 1, t); }
    else if (d.k === 3) this.drawFighter(ctx, d.f, dpr);
    else if (d.k === 4) this.drawGem(ctx, d.o, t);
    else if (d.k === 5) this.drawCube(ctx, d.o, t);
  }
  // projectiles
  for (const b of this.bullets) this.drawBullet(ctx, b);
  for (const l of this.lobs) {
    if (l.t < 0) continue; const p = clamp(l.t / l.dur, 0, 1), x = lerp(l.x0, l.x1, p), y = lerp(l.y0, l.y1 - 20, p) - Math.sin(p * Math.PI) * 150;
    ctx.save(); ctx.translate(x, y); ctx.rotate(l.spin + p * 8);
    ell(ctx, 0, 0, 14, 9); fs(ctx, '#e8b46b', 3); ell(ctx, 0, -2, 10, 5); fs(ctx, '#ff6b8b', 0); circ(ctx, 0, -4, 3); fs(ctx, '#fff', 0);
    ctx.restore();
  }
  this.drawParts(ctx);
  if (this.mode === 'royale') this.drawPoison(ctx, vx0, vy0, vx1, vy1, t);
  // overhead info
  for (const f of this.fighters) if (f.alive && this.canSee(P.team, f)) this.drawOverhead(ctx, f);
  for (const tx of this.texts) {
    const a = clamp(tx.life / tx.max * 2, 0, 1), pop = 1 + Math.max(0, (tx.life - tx.max + 0.15)) * 3;
    ctx.globalAlpha = a; txt(ctx, tx.text, tx.x, tx.y, tx.size * pop, tx.color); ctx.globalAlpha = 1;
  }
  // screen-space: low health warning
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // arrows at the screen edge pointing to goals that are off-screen (factories, the boss)
  const goals = [];
  if (this.boss && this.boss.alive) goals.push(this.boss);
  if (this.factories) for (const f of this.factories) if (f.alive) goals.push(f);
  for (const gl of goals) {
    const sx = (gl.x - c.x) * s + W / 2, sy = (gl.y - 40 - c.y) * s + H / 2, top = 120, m = 44;
    if (sx > m && sx < W - m && sy > top && sy < H - m) continue;
    const ex = clamp(sx, m, W - m), ey = clamp(sy, top, H - m), ang = Math.atan2(sy - ey, sx - ex) || Math.atan2(sy - H / 2, sx - W / 2), pulse = 1 + Math.sin(t * 6) * 0.08;
    ctx.save(); ctx.translate(ex, ey); ctx.scale(pulse, pulse);
    ctx.save(); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(18, -11); ctx.lineTo(18, 11); ctx.closePath(); fs(ctx, '#ffd23f', 3); ctx.restore();
    circ(ctx, 0, 0, 22); fs(ctx, 'rgba(15,12,40,0.85)', 3); circ(ctx, 0, 0, 22); ctx.lineWidth = 3; ctx.strokeStyle = gl.shield ? '#9ffcff' : '#ffd23f'; ctx.stroke();
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(gl.def.boss ? '👑' : '🏭', 0, 1);
    ctx.restore();
  }
  if (P.alive && P.hp / P.maxHp < 0.3) {
    const a = 0.25 + Math.sin(t * 6) * 0.1, gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, `rgba(255,0,30,${a})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
};

Game.prototype.drawWater = function (ctx, x, y, t) {
  const th = this.theme, px = x * T, py = y * T;
  ctx.fillStyle = th.waterDark; ctx.fillRect(px, py, T, T);
  ctx.fillStyle = th.water; ctx.fillRect(px, py + 6, T, T - 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
  for (let k = 0; k < 2; k++) { const yy = py + 20 + k * 24 + Math.sin(t * 2 + x + k) * 3; ctx.beginPath(); ctx.moveTo(px + 10 + k * 14, yy); ctx.quadraticCurveTo(px + 20 + k * 14, yy - 5, px + 30 + k * 14, yy); ctx.stroke(); }
  const W = this.tileAt(x, y - 1) !== TL.WATER; if (W) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(px, py + 4, T, 4); }
};
Game.prototype.drawProp = function (ctx, x, y, h) {
  const th = this.theme;
  if (th.deco === 'tree') {
    ell(ctx, x + 6, y + 18, 30, 10); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();
    rrect(ctx, x - 6, y - 4, 12, 24, 4); fs(ctx, '#7a4a25', 3);
    for (const [dx, dy, r] of [[-14, -14, 20], [14, -14, 20], [0, -30, 24]]) { circ(ctx, x + dx, y + dy, r + 3); ctx.fillStyle = OUT; ctx.fill(); }
    for (const [dx, dy, r] of [[-14, -14, 20], [14, -14, 20], [0, -30, 24]]) { circ(ctx, x + dx, y + dy, r); ctx.fillStyle = h < 0.2 ? '#2f9a46' : '#38a94f'; ctx.fill(); }
    circ(ctx, x - 6, y - 38, 8); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
  } else {
    ell(ctx, x + 6, y + 14, 26, 9); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
    if (h < 0.18 && !th.prop) { // cactus
      rrect(ctx, x - 8, y - 40, 16, 54, 8); fs(ctx, '#4fb05a', 3); rrect(ctx, x - 24, y - 24, 12, 22, 6); fs(ctx, '#4fb05a', 3); rrect(ctx, x + 12, y - 30, 12, 18, 6); fs(ctx, '#4fb05a', 3);
    } else { rrect(ctx, x - 22, y - 18, 44, 32, 14); fs(ctx, th.prop || '#b98a5a', 3); rrect(ctx, x - 14, y - 14, 18, 8, 4); fs(ctx, 'rgba(255,255,255,0.25)', 0); }
  }
};
Game.prototype.drawMine = function (ctx, t) {
  const m = this.mine, glow = 0.5 + 0.5 * Math.sin(t * 3) + (this.mineFlash > 0 ? 1 : 0);
  ell(ctx, m.x, m.y, 56, 34); fs(ctx, '#5a3d8a', 4);
  ell(ctx, m.x, m.y + 4, 42, 24); fs(ctx, '#2a1748', 0);
  ell(ctx, m.x, m.y, 60 + glow * 4, 38 + glow * 3); ctx.strokeStyle = `rgba(200,120,255,${0.25 + glow * 0.2})`; ctx.lineWidth = 4; ctx.stroke();
  for (const [dx, dy, s] of [[-30, -6, 1], [28, -10, 0.8], [-8, -18, 1.1], [14, 10, 0.7], [-22, 12, 0.7]]) this.gemShape(ctx, m.x + dx, m.y + dy, 9 * s, '#b45cff', '#e8c2ff');
};
Game.prototype.gemShape = function (ctx, x, y, s, c1, c2) {
  ctx.beginPath(); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s, y - s * 0.4); ctx.lineTo(x + s * 0.6, y + s); ctx.lineTo(x - s * 0.6, y + s); ctx.lineTo(x - s, y - s * 0.4); ctx.closePath(); fs(ctx, c1, Math.max(2, s * 0.22));
  ctx.beginPath(); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s * 0.4, y - s * 0.4); ctx.lineTo(x, y + s * 0.9); ctx.lineTo(x - s * 0.4, y - s * 0.4); ctx.closePath(); ctx.fillStyle = c2; ctx.fill();
};
Game.prototype.drawBlock = function (ctx, x, y, tt) {
  const th = this.theme, i = y * this.w + x, sh = this.tshake[i] > 0 ? Math.sin(this.time * 80) * 3 : 0;
  const px = x * T + sh, py = y * T, H = tt === TL.CRATE ? 30 : tt === TL.BLOCK ? 30 : 26;
  const top = tt === TL.CRATE ? '#d4934f' : tt === TL.BLOCK ? th.blockTop : th.wallTop, side = tt === TL.CRATE ? '#93592a' : tt === TL.BLOCK ? th.blockSide : th.wallSide;
  rrect(ctx, px + 2, py + T - H - 10, T - 4, H + 10, 9); fs(ctx, side, 3);
  rrect(ctx, px + 2, py - H + 4, T - 4, T - 6, 11); fs(ctx, top, 3);
  if (tt === TL.CRATE) {
    ctx.strokeStyle = 'rgba(90,45,15,0.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px + 10, py - H + 16); ctx.lineTo(px + T - 10, py - H + 16); ctx.moveTo(px + 10, py - H + T - 18); ctx.lineTo(px + T - 10, py - H + T - 18); ctx.stroke();
    const cx = px + T / 2, cy = py - H + T / 2 + 1, pulse = 1 + Math.sin(this.time * 4 + x) * 0.06;
    circ(ctx, cx, cy, 14 * pulse); fs(ctx, '#b45cff', 3);
    txt(ctx, '?', cx, cy + 1, 20, '#fff', 'center', 3);
    const hp = this.crateHp[i] / CRATE_HP;
    if (hp < 1) { ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px + 12, py - H + 8); ctx.lineTo(px + 22, py - H + 22); ctx.lineTo(px + 16, py - H + 30); if (hp < 0.5) { ctx.moveTo(px + T - 12, py - H + T - 14); ctx.lineTo(px + T - 22, py - H + T - 24); ctx.lineTo(px + T - 14, py - H + T - 32); } ctx.stroke(); }
  } else {
    rrect(ctx, px + 10, py - H + 9, T - 20, 9, 4.5); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
    if (tt === TL.WALL) { circ(ctx, px + 18 + hash2(x, y) * 20, py - H + 34, 4); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px + 6, py - H + T / 2 + 2); ctx.lineTo(px + T - 6, py - H + T / 2 + 2); ctx.moveTo(px + T / 2, py - H + 8); ctx.lineTo(px + T / 2, py - H + T / 2); ctx.stroke(); }
  }
};
Game.prototype.drawBush = function (ctx, x, y, alpha, t) {
  const zoom = this.cam.s * (this.dpr || 1);
  if (!this.bushImg || this.bushZoom !== zoom) {
    const th = this.theme, c = document.createElement('canvas'), S = 100; c.width = Math.ceil(S * zoom); c.height = Math.ceil(S * zoom);
    const b = c.getContext('2d'); b.scale(zoom, zoom); const cx = S / 2, cy = S / 2 + 8;
    const blobs = [[-17, -4, 19], [17, -4, 19], [0, -20, 22], [-10, 10, 17], [11, 10, 17]];
    for (const [dx, dy, r] of blobs) { circ(b, cx + dx, cy + dy, r + 3.5); b.fillStyle = th.bushDark; b.fill(); }
    for (const [dx, dy, r] of blobs) { circ(b, cx + dx, cy + dy, r); b.fillStyle = th.bush; b.fill(); }
    for (const [dx, dy, r] of blobs) { circ(b, cx + dx - r * 0.3, cy + dy - r * 0.35, r * 0.38); b.fillStyle = th.bushLight; b.fill(); }
    this.bushImg = c; this.bushZoom = zoom;
  }
  const sw = Math.sin(t * 2 + x * 1.3 + y * 0.7) * 1.4;
  ctx.globalAlpha = alpha; ctx.drawImage(this.bushImg, x * T + T / 2 - 50 + sw, y * T + T / 2 - 50, 100, 100); ctx.globalAlpha = 1;
};
Game.prototype.drawFighter = function (ctx, f, dpr) {
  const P = this.player, visible = this.canSee(P.team, f); if (!visible) return;
  const k = f.def.scale || 1, zoom = this.cam.s * dpr, SW = 150 * k, SH = 170 * k, FX = 75 * k, FY = 135 * k;
  if (f.spriteZoom !== zoom) { f.sprite.width = Math.ceil(SW * zoom); f.sprite.height = Math.ceil(SH * zoom); f.spriteZoom = zoom; }
  const sc = f.sprite.getContext('2d'); sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, f.sprite.width, f.sprite.height); sc.setTransform(zoom, 0, 0, zoom, 0, 0);
  drawHero(sc, f.hero, { x: FX, y: FY, s: 1.14 * k, t: this.time, aim: f.face, moving: f.moving, walk: f.walk, recoil: f.recoil, seed: f.seed, noShadow: true, squash: f.squash, color: f.color, msgs: f.msgs });
  if (f.flash > 0) { sc.globalCompositeOperation = 'source-atop'; sc.fillStyle = 'rgba(255,255,255,0.8)'; sc.fillRect(0, 0, SW, SH); sc.globalCompositeOperation = 'source-over'; }
  ell(ctx, f.x, f.y, 25 * k * (f.leap ? 0.7 : 1), 9 * k * (f.leap ? 0.7 : 1)); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  let a = f.inBush ? 0.55 : 1; if (f.invuln > 0 && !f.dash && !f.leap) a *= 0.6 + 0.4 * Math.sin(this.time * 30);
  ctx.globalAlpha = a; ctx.drawImage(f.sprite, f.x - FX, f.y - FY - f.z, SW, SH); ctx.globalAlpha = 1;
  if (f.vuln > 0) { const cy = f.y - 46 * k, R = 60 * k; circ(ctx, f.x, cy, R + Math.sin(this.time * 12) * 4); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,210,63,0.8)'; ctx.stroke(); if (Math.sin(this.time * 6) > 0) txt(ctx, 'VULNERABLE!', f.x, f.y - 120 * k, 18, '#ffd23f'); }
  else if (!f.shield && f.shieldT > 0) { const cy = f.y - 46 * k, R = 64 * k * (1 - f.shieldT / 6); if (R > 0) { circ(ctx, f.x, cy, R); ctx.fillStyle = 'rgba(120,230,255,0.10)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(160,240,255,0.5)'; ctx.stroke(); } }
  if (f.shield) {
    const cy = f.y - 46 * k, R = 64 * k, t = this.time;
    circ(ctx, f.x, cy, R); ctx.fillStyle = 'rgba(120,230,255,0.16)'; ctx.fill();
    ctx.save(); ctx.translate(f.x, cy); ctx.rotate(t * 0.8); ctx.setLineDash([18, 10]); circ(ctx, 0, 0, R); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(160,240,255,0.85)'; ctx.stroke(); ctx.restore();
    for (let i = 0; i < 6; i++) { const a = t * 1.2 + i * TAU / 6; txt(ctx, '+−×÷=?'[i], f.x + Math.cos(a) * R, cy + Math.sin(a) * R * 0.9, 18, '#e8fdff', 'center', 3); }
  }
  if (f.stun > 0) for (let i = 0; i < 3; i++) { const a = this.time * 5 + i * TAU / 3; star(ctx, f.x + Math.cos(a) * 30 * k, f.y - 100 * k + Math.sin(a) * 8, 8, 3.5); fs(ctx, '#ffd23f', 2); }
  if (f.invuln > 0.3 && !f.dash && !f.leap) { circ(ctx, f.x, f.y - 40, 46); ctx.fillStyle = 'rgba(140,220,255,0.15)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(160,230,255,0.7)'; ctx.stroke(); }
};
Game.prototype.drawOverhead = function (ctx, f) {
  if (f.def.boss) return;
  const P = this.player, mine = f.team === P.team, x = f.x, y = f.y - 124 * (f.def.scale || 1) - f.z, w = 70;
  if (!f.isPlayer) txt(ctx, f.name, x, y - 13, 14, mine ? '#9fdcff' : '#ffb0b0');
  rrect(ctx, x - w / 2, y - 7, w, 15, 6); fs(ctx, '#2a2340', 3);
  const r = clamp(f.hp / f.maxHp, 0, 1);
  if (r > 0) { rrect(ctx, x - w / 2 + 2, y - 5, (w - 4) * r, 11, 4); ctx.fillStyle = f.isPlayer ? '#3ee046' : mine ? '#3aa8ff' : '#ff4848'; ctx.fill(); rrect(ctx, x - w / 2 + 4, y - 4, Math.max(0, (w - 8) * r), 4, 2); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill(); }
  txt(ctx, String(Math.ceil(f.hp)), x, y + 1, 13, '#fff', 'center', 3);
  if (f.isPlayer) {
    for (let i = 0; i < 3; i++) { const fill = clamp(f.ammo - i, 0, 1); rrect(ctx, x - w / 2 + i * (w / 3) + 1, y + 11, w / 3 - 3, 7, 3); fs(ctx, '#2a2340', 2); if (fill > 0) { rrect(ctx, x - w / 2 + i * (w / 3) + 2.5, y + 12.5, (w / 3 - 6) * fill, 4, 2); ctx.fillStyle = fill >= 1 ? '#ff9f1c' : '#b87418'; ctx.fill(); } }
  }
  if (f.gems > 0) { this.gemShape(ctx, x - w / 2 - 14, y, 9, '#b45cff', '#e8c2ff'); txt(ctx, String(f.gems), x - w / 2 - 14, y + 16, 15, '#fff'); }
  if (f.power > 0) { rrect(ctx, x + w / 2 + 4, y - 9, 22, 19, 5); fs(ctx, '#3fbf4f', 2.5); txt(ctx, String(f.power), x + w / 2 + 15, y + 1, 14, '#fff', 'center', 3); }
};
Game.prototype.drawGem = function (ctx, gm, t) {
  const bob = gm.z > 0 ? 0 : Math.sin(t * 3 + gm.id) * 3, y = gm.y - 18 - gm.z + bob;
  if (gm.num != null && gm.age > 18 && Math.sin(gm.age * 18) < 0) return;
  ell(ctx, gm.x, gm.y, 14, 6); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
  if (gm.num == null) this.gemShape(ctx, gm.x, y, 12, '#ffd23f', '#fff3a0');
  else { this.gemShape(ctx, gm.x, y, 12, '#b45cff', '#e8c2ff'); }
  if (gm.num != null) { rrect(ctx, gm.x - 20, y - 44, 40, 26, 9); fs(ctx, 'rgba(27,21,48,0.72)', 0); txt(ctx, String(gm.num), gm.x, y - 31, 22, '#fff', 'center', 4); }
};
Game.prototype.drawCube = function (ctx, cb, t) {
  const bob = cb.z > 0 ? 0 : Math.sin(t * 3 + cb.x) * 4, x = cb.x, y = cb.y - 22 - cb.z + bob, s = 15;
  ell(ctx, x, cb.y, 16, 7); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  circ(ctx, x, y, 28 + Math.sin(t * 5) * 2); ctx.fillStyle = 'rgba(255,90,220,0.18)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y - s / 2); ctx.lineTo(x, y); ctx.lineTo(x - s, y - s / 2); ctx.closePath(); fs(ctx, '#ff8be6', 2.5);
  ctx.beginPath(); ctx.moveTo(x - s, y - s / 2); ctx.lineTo(x, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y + s / 2); ctx.closePath(); fs(ctx, '#e040c4', 2.5);
  ctx.beginPath(); ctx.moveTo(x + s, y - s / 2); ctx.lineTo(x, y); ctx.lineTo(x, y + s); ctx.lineTo(x + s, y + s / 2); ctx.closePath(); fs(ctx, '#b0209a', 2.5);
  txt(ctx, '?', x, y - s / 2, 13, '#fff', 'center', 3);
};
Game.prototype.drawBullet = function (ctx, b) {
  const y = b.y - 22, tr = b.trail;
  if (tr.length >= 4) {
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tr[0], tr[1] - 22); for (let i = 2; i < tr.length; i += 2) ctx.lineTo(tr[i], tr[i + 1] - 22); ctx.lineTo(b.x, y);
    ctx.lineWidth = b.r * (b.kind === 'beam' ? 1.6 : 1.1); ctx.strokeStyle = b.color; ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (b.kind === 'star') { ctx.save(); ctx.translate(b.x, y); ctx.rotate(b.rot); star(ctx, 0, 0, b.r + 3, (b.r + 3) * 0.45); fs(ctx, b.color, 2.5); ctx.restore(); }
  else if (b.kind === 'laser' || b.kind === 'beam') {
    const a = Math.atan2(b.vy, b.vx), L = b.kind === 'beam' ? 60 : 34;
    ctx.save(); ctx.translate(b.x, y); ctx.rotate(a); rrect(ctx, -L, -b.r * 0.6, L + b.r, b.r * 1.2, b.r * 0.6); fs(ctx, b.color, 2.5);
    rrect(ctx, -L + 6, -b.r * 0.25, L, b.r * 0.5, b.r * 0.25); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  } else { circ(ctx, b.x, y, b.r); fs(ctx, b.color, 2.5); circ(ctx, b.x - b.r * 0.3, y - b.r * 0.3, b.r * 0.35); ctx.fillStyle = '#fff'; ctx.fill(); }
};
Game.prototype.drawParts = function (ctx) {
  for (const q of this.parts) {
    const a = clamp(q.life / q.max, 0, 1);
    ctx.globalAlpha = a;
    if (q.type === 'spark') { ctx.strokeStyle = q.color; ctx.lineWidth = q.size; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.x, q.y - (q.z || 0)); ctx.lineTo(q.x - q.vx * 0.03, q.y - (q.z || 0) - q.vy * 0.03); ctx.stroke(); }
    else if (q.type === 'puff') { circ(ctx, q.x, q.y, q.size * (1.4 - a * 0.6)); ctx.fillStyle = q.color; ctx.fill(); }
    else if (q.type === 'ring') { ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1, 0.55); circ(ctx, 0, 0, q.size * (1.15 - a * 0.6)); ctx.lineWidth = 10 * a; ctx.strokeStyle = q.color; ctx.stroke(); ctx.restore(); }
    else if (q.type === 'star') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); star(ctx, 0, 0, q.size, q.size * 0.45); fs(ctx, q.color, 1.5); ctx.restore(); }
    else if (q.type === 'debris') { ctx.save(); ctx.translate(q.x, q.y - q.z); ctx.rotate(q.rot); ctx.fillStyle = q.color; ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.strokeRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66); ctx.restore(); }
    else if (q.type === 'zap') { ctx.strokeStyle = q.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + rand(-q.size, q.size), q.y + rand(-q.size, q.size)); ctx.lineTo(q.x + rand(-q.size, q.size) * 1.5, q.y + rand(-q.size, q.size) * 1.5); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
};
Game.prototype.drawPoison = function (ctx, x0, y0, x1, y1, t) {
  const s = this.safe; if (!s || s.p <= 0) return;
  ctx.fillStyle = 'rgba(70,200,60,0.38)';
  ctx.beginPath(); ctx.rect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20); ctx.rect(s.x1, s.y0, s.x0 - s.x1, s.y1 - s.y0); ctx.fill('evenodd');
  ctx.fillStyle = 'rgba(120,230,90,0.55)';
  const puffs = (ax, ay, bx, by) => { const L = dist(ax, ay, bx, by), n = Math.ceil(L / 46); for (let i = 0; i <= n; i++) { const x = lerp(ax, bx, i / n), y = lerp(ay, by, i / n); if (x < x0 - 60 || x > x1 + 60 || y < y0 - 60 || y > y1 + 60) continue; circ(ctx, x, y, 26 + Math.sin(t * 2 + i) * 6); ctx.fill(); } };
  puffs(s.x0, s.y0, s.x1, s.y0); puffs(s.x0, s.y1, s.x1, s.y1); puffs(s.x0, s.y0, s.x0, s.y1); puffs(s.x1, s.y0, s.x1, s.y1);
};
Game.prototype.drawAim = function (ctx, f) {
  const I = this.input; if (!(I.mouse || I.show > 0) || I.aim == null) return;
  const sup = I.show === 2, def = sup ? f.def.sup : f.def.atk, ang = I.aim;
  if (sup && f.super < 1) return;
  const col = sup ? 'rgba(255,210,63,0.33)' : 'rgba(255,255,255,0.22)', edge = sup ? 'rgba(255,210,63,0.9)' : 'rgba(255,255,255,0.55)';
  const type = sup ? def.type : def.type;
  ctx.save(); ctx.translate(f.x, f.y);
  const tgt = () => {
    const R = (def.range || 6) * T;
    if (I.tx != null) { let x = I.tx - f.x, y = I.ty - f.y; const d = Math.hypot(x, y); if (d > R) { x *= R / d; y *= R / d; } return { x, y }; }
    const d = Math.min(R, I.aimDist || R * 0.8); return { x: Math.cos(ang) * d, y: Math.sin(ang) * d };
  };
  if (type === 'lob' || type === 'leap' || type === 'barrage') {
    const p = tgt(), rad = (def.radius || 1.5) * T * (type === 'barrage' ? 1.9 : 1);
    ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(p.x / 2, p.y / 2 - 80, p.x, p.y); ctx.lineWidth = 4; ctx.strokeStyle = edge; ctx.stroke(); ctx.setLineDash([]);
    ell(ctx, p.x, p.y, rad, rad * 0.55); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = edge; ctx.stroke();
  } else if (type === 'storm') {
    ell(ctx, 0, 0, def.range * T * 0.6, def.range * T * 0.6 * 0.55); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = edge; ctx.stroke();
  } else if (type === 'shotgun') {
    const R = def.range * T; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, ang - def.spread / 2 - 0.05, ang + def.spread / 2 + 0.05); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = edge; ctx.stroke();
  } else {
    const R = (def.range || 6) * T, wdt = type === 'beam' ? 56 : type === 'dash' ? 48 : 22;
    ctx.rotate(ang); rrect(ctx, 0, -wdt / 2, R, wdt, wdt / 2); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = edge; ctx.stroke();
  }
  ctx.restore();
};
