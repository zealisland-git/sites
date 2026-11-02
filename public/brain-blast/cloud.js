/* Brain Blast Arena: cloud save.
   - Automatic: this browser gets a random device key, and its progress is backed up
     to the site's database under that key. Nothing to sign up for.
   - Save code: a save can get a code. Typing the code on another device puts that
     device on the same save (stage stars, trophies, heroes).
   The copy in this browser keeps working offline; syncing merges both ways.
   Stage records keep the best result; the rest of the profile uses the newest copy. */
'use strict';

const PROFILE_KEYS = ['trophies', 'hero', 'level', 'mode', 'asked', 'correct', 'wins', 'games', 'bestStreak', 'lv', 'seenHow', 'subStats', 'mrating'];

const Cloud = {
  API: new URL('../api/brain-blast/', location.href).toString(),
  KEY: 'bb-device-key', CODE: 'bb-save-code',
  status: 'idle', msg: '', last: 0, busy: false, again: false, info: null, timer: null, onchange: null, onstatus: null,

  lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  deviceKey() {
    let k = this.lsGet(this.KEY);
    if (!k || !/^[A-Za-z0-9_-]{32,128}$/.test(k)) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      k = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      if (!this.lsSet(this.KEY, k)) return null;
    }
    return k;
  },
  normalize(c) { return String(c || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, ''); },
  format(c) { const n = this.normalize(c); return n.length === 16 ? n.match(/.{4}/g).join('-') : String(c || '').trim(); },
  async codeId(c) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bb-code:' + this.normalize(c)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
  },
  async api(path, { method = 'GET', body } = {}) {
    const key = this.deviceKey();
    if (!key) { const e = new Error('This browser blocks storage, so cloud save is off.'); e.off = true; throw e; }
    let res;
    try {
      res = await fetch(this.API + path, { method, cache: 'no-store', headers: { authorization: 'Bearer ' + key, ...(body != null ? { 'content-type': 'application/json' } : {}) }, body: body == null ? undefined : JSON.stringify(body) });
    } catch (e) { const er = new Error(navigator.onLine === false ? 'You are offline.' : 'Could not reach the cloud.'); throw er; }
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) { const e = new Error('Cloud save is not switched on here.'); e.off = true; throw e; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || 'The cloud said no (' + res.status + ').'); e.status = res.status; e.off = res.status === 503; throw e; }
    return data;
  },
  set(status, msg) { this.status = status; this.msg = msg || ''; if (this.onstatus) this.onstatus(); },
  later(ms = 1500) { clearTimeout(this.timer); this.timer = setTimeout(() => this.sync(), ms); },

  // copy the server's data into this browser (only things that are better or newer)
  merge(s, adopt) {
    const d = Save.d; let changed = false;
    const num = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
    for (const r of Array.isArray(s.stages) ? s.stages : []) {
      if (!r || typeof r.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,23}$/.test(r.id)) continue;
      const l = d.stages[r.id] || { stars: 0, best: null, clears: 0 };
      const rb = r.best == null ? null : num(r.best, 0, 36000);
      const m = { stars: Math.max(l.stars | 0, num(r.stars, 0, 3)), best: l.best == null ? rb : rb == null ? l.best : Math.min(l.best, rb), clears: Math.max(l.clears | 0, num(r.clears, 0, 1e6)) };
      if (m.stars !== l.stars || m.best !== l.best || m.clears !== l.clears) changed = true;
      d.stages[r.id] = m;
    }
    const P = s.profile;
    if (P && typeof P === 'object' && (adopt || (s.updated || 0) > (d.updated || 0))) {
      if (P.trophies != null) d.trophies = num(P.trophies, 0, 1e6);
      if (typeof P.hero === 'string' && HERO_ORDER.includes(P.hero)) d.hero = P.hero;
      if (P.level != null) d.level = num(P.level, 1, 5);
      if (P.mode === 'grab' || P.mode === 'royale' || P.mode === 'adventure') d.mode = P.mode;
      for (const k of ['asked', 'correct', 'wins', 'games', 'bestStreak']) if (P[k] != null) d[k] = num(P[k], 0, 1e9);
      if (P.lv && typeof P.lv === 'object') { const lv = {}; for (const k of ['1', '2', '3', '4', '5']) { const x = P.lv[k]; if (x && typeof x === 'object') lv[k] = { a: num(x.a, 0, 1e9), c: num(x.c, 0, 1e9) }; } d.lv = lv; }
      if (typeof P.seenHow === 'boolean') d.seenHow = P.seenHow;
      if (P.subStats && typeof P.subStats === 'object') { const ss = {}; for (const [k, x] of Object.entries(P.subStats)) if (/^\d{1,2}\.\d{1,2}$/.test(k) && x && typeof x === 'object') ss[k] = { a: num(x.a, 0, 1e9), c: num(x.c, 0, 1e9) }; d.subStats = ss; }
      if (P.mrating != null) d.mrating = Math.min(5, Math.max(0, Number(P.mrating) || 0));
      d.updated = s.updated || d.updated; changed = true;
    }
    if (changed) Save.save(false);
    return changed;
  },
  // what this browser has that the server does not
  pending(s) {
    const srv = new Map((Array.isArray(s.stages) ? s.stages : []).map(r => [r.id, r])), list = [];
    for (const [id, l] of Object.entries(Save.d.stages)) {
      const r = srv.get(id);
      if (!r || l.stars > r.stars || l.clears > r.clears || (l.best != null && (r.best == null || l.best < r.best))) list.push({ id, stars: l.stars | 0, best: l.best == null ? null : Math.round(l.best), clears: l.clears | 0 });
    }
    const needProfile = (Save.d.updated || 0) > (s.updated || 0);
    if (!list.length && !needProfile) return null;
    const body = { stages: list.slice(0, 100) };
    if (needProfile) { body.updated = Save.d.updated; body.profile = {}; for (const k of PROFILE_KEYS) body.profile[k] = Save.d[k]; }
    return body;
  },
  async sync(opts = {}) {
    if (this.busy) { this.again = true; return; }
    this.busy = true; this.set('syncing');
    try {
      let s = await this.api('state');
      let changed = this.merge(s, opts.adopt);
      for (let i = 0; i < 5; i++) {
        const body = this.pending(s); if (!body) break;
        s = await this.api('state', { method: 'PUT', body });
        changed = this.merge(s) || changed;
      }
      this.info = s; this.last = Date.now();
      this.set('ok');
      if (changed && this.onchange) this.onchange();
    } catch (e) {
      this.set(e.off ? 'off' : 'offline', e.message);
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; this.later(400); }
    }
  },
  async myCode() {
    const c = this.lsGet(this.CODE);
    if (!c || !this.info || !this.info.hasCode) return null;
    return (await this.codeId(c)) === this.info.codeId ? c : null;
  },
  async makeCode() { const r = await this.api('code', { method: 'POST' }); this.lsSet(this.CODE, r.code); await this.sync(); return r.code; },
  async stopCode() { await this.api('code', { method: 'DELETE' }); this.lsSet(this.CODE, null); await this.sync(); },
  async join(code) {
    await this.api('join', { method: 'POST', body: { code } });
    this.lsSet(this.CODE, this.format(code));
    await this.sync({ adopt: true });
    if (this.status !== 'ok') throw new Error(this.msg || 'Could not load that save.');
  },
};
