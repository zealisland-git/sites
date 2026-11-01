// Cloud sync for "My art".
// - Automatic: this browser gets a random device key and its art is backed up
//   to the site's database under that key. Nothing to set up.
// - Sync code: a collection can get a code. Entering the code on another
//   device (or sharing it) puts that device in the same collection.
// The local copy (IndexedDB) stays the source of truth while offline; sync
// merges both ways and the newest change to each piece wins.

const API = new URL('../api/ascii-art/', location.href).toString();
const KEY_DEVICE = 'aas-device-key', KEY_CODE = 'aas-sync-code';
const KINDS = ['text', 'picture', 'doodle', 'shared'];
export const ITEM_ID = /^[a-z0-9]{6,32}$/;

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch { return false; } }

function deviceKey() {
  let k = lsGet(KEY_DEVICE);
  if (!k || !/^[A-Za-z0-9_-]{32,128}$/.test(k)) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    k = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (!lsSet(KEY_DEVICE, k)) return null; // no storage: cannot remember this device
  }
  return k;
}

export function normalizeCode(input) {
  return String(input || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
}
export function formatCode(input) {
  const n = normalizeCode(input);
  return n.length === 16 ? n.match(/.{4}/g).join('-') : String(input || '').trim();
}

class ApiError extends Error {
  constructor(msg, status, off = false) { super(msg); this.status = status; this.off = off; }
}

async function api(path, { method = 'GET', body, raw = false } = {}) {
  const key = deviceKey();
  if (!key) throw new ApiError('This browser blocks storage, so cloud sync is off.', 0, true);
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: { authorization: 'Bearer ' + key, ...(body != null ? { 'content-type': 'application/json' } : {}) },
      body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(navigator.onLine === false ? 'You are offline.' : 'Could not reach the cloud.', 0);
  }
  const type = res.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new ApiError('Cloud sync is not switched on for this site yet.', res.status, true);
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'The cloud said no (' + res.status + ').', res.status, res.status === 503);
  return data;
}

async function codeId(code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('code:' + normalizeCode(code)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

// Only keep fields we know, with the right types (data from the cloud is untrusted).
export function sanitize(d, id, updated) {
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const text = str(d.text, 2_000_000);
  return {
    id,
    updated,
    created: num(d.created) || updated,
    kind: KINDS.includes(d.kind) ? d.kind : 'shared',
    title: str(d.title, 60) || 'Untitled',
    text,
    cols: num(d.cols), rows: num(d.rows),
    color: str(d.color, 24) || 'ink',
    colors: typeof d.colors === 'string' && /^[0-9a-f]*$/.test(d.colors) ? d.colors : null,
    theme: str(d.theme, 24) || 'paper',
    settings: d.settings && typeof d.settings === 'object' && !Array.isArray(d.settings) ? d.settings : null,
    source: typeof d.source === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d.source) ? d.source : null,
  };
}

// What goes to the cloud: photos stay on the device (privacy); drawings travel.
function forUpload(item) {
  const { source, deleted, ...rest } = item;
  return { ...rest, source: item.kind === 'doodle' ? source || null : null };
}

async function pool(list, n, fn) {
  let i = 0;
  const errors = [];
  const worker = async () => {
    while (i < list.length) {
      const it = list[i++];
      try { await fn(it); } catch (e) { errors.push(e); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, worker));
  return errors;
}

/**
 * local: { all(): Promise<item[] incl. {id, deleted:true, updated}>, put(item): Promise }
 * onPulled(): called when cloud changes were written locally.
 */
export function createCloud(local, onPulled) {
  const listeners = new Set();
  const state = {
    status: 'idle', // idle | syncing | ok | offline | off | error
    message: '',
    lastSync: 0,
    hasCode: false,
    codeKnown: !!lsGet(KEY_CODE),
    code: lsGet(KEY_CODE),
    devices: 1,
    skipped: 0,
  };
  const emit = () => listeners.forEach(fn => fn({ ...state }));
  const set = patch => { Object.assign(state, patch); emit(); };

  let running = null, again = false, timer = 0;

  async function syncNow() {
    if (running) { again = true; return running; }
    running = (async () => {
      set({ status: 'syncing' });
      try {
        const lib = await api('library');
        const remote = new Map(lib.items.map(r => [r.id, r]));
        const mine = await local.all();
        const byId = new Map(mine.map(l => [l.id, l]));
        const stamp = l => l.updated || l.created || 0;
        let pulled = 0;

        // pull newer pieces (and deletions) from the cloud
        const toFetch = [];
        for (const r of lib.items) {
          const l = byId.get(r.id);
          if (l && stamp(l) >= r.updated) continue;
          if (r.deleted) {
            if (l && !l.deleted) { await local.put({ id: r.id, deleted: true, updated: r.updated }); pulled++; }
          } else toFetch.push(r);
        }
        const pullErrors = await pool(toFetch, 4, async r => {
          const res = await api('items/' + r.id, { raw: true });
          const data = await res.json();
          const item = sanitize(data, r.id, r.updated);
          const l = byId.get(r.id);
          if (!item.source && l && l.source) item.source = l.source; // keep this device's photo for "Edit again"
          await local.put(item);
          pulled++;
        });
        if (pulled) onPulled();
        const pullFail = pullErrors.find(e => e.status !== 404);
        if (pullFail) throw pullFail;

        // push pieces that are newer here (or only here)
        let skipped = 0;
        const toPush = mine.filter(l => {
          if (!ITEM_ID.test(l.id)) return false;
          const r = remote.get(l.id);
          return r ? stamp(l) > r.updated : !l.deleted;
        });
        const errors = await pool(toPush, 3, async l => {
          if (l.deleted) await api(`items/${l.id}?updated=${stamp(l)}`, { method: 'DELETE' });
          else await api(`items/${l.id}?updated=${stamp(l)}`, { method: 'PUT', body: JSON.stringify(forUpload(l)) });
        });
        for (const e of errors) { if (e.status === 413) skipped++; else throw e; }

        // sync code status
        let codeKnown = state.codeKnown, code = state.code;
        if (!lib.hasCode && code) { lsSet(KEY_CODE, null); code = null; codeKnown = false; }
        else if (lib.hasCode && code && lib.codeId && lib.codeId !== await codeId(code)) { lsSet(KEY_CODE, null); code = null; codeKnown = false; }
        set({ status: 'ok', message: '', lastSync: Date.now(), hasCode: !!lib.hasCode, devices: lib.devices || 1, code, codeKnown, skipped });
      } catch (e) {
        set({ status: e.off ? 'off' : e.status === 0 ? 'offline' : 'error', message: e.message });
      }
    })();
    try { await running; } finally {
      running = null;
      if (again) { again = false; schedule(300); }
    }
  }
  function schedule(ms = 1500) {
    clearTimeout(timer);
    timer = setTimeout(syncNow, ms);
  }

  // keep in step: when the page comes back, when we go online, and gently while open
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - state.lastSync > 20_000) schedule(200);
  });
  window.addEventListener('online', () => schedule(200));
  setInterval(() => { if (document.visibilityState === 'visible' && state.status !== 'off') syncNow(); }, 90_000);

  return {
    get state() { return { ...state }; },
    onChange(fn) { listeners.add(fn); fn({ ...state }); },
    sync: syncNow,
    schedule,
    async createCode() {
      const { code } = await api('code', { method: 'POST' });
      lsSet(KEY_CODE, code);
      set({ hasCode: true, code, codeKnown: true });
      return code;
    },
    async removeCode() {
      await api('code', { method: 'DELETE' });
      lsSet(KEY_CODE, null);
      set({ hasCode: false, code: null, codeKnown: false });
    },
    async join(code) {
      const res = await api('join', { method: 'POST', body: { code } });
      const nice = formatCode(code);
      lsSet(KEY_CODE, nice);
      set({ hasCode: true, code: nice, codeKnown: true });
      await syncNow();
      return res;
    },
    async leave() {
      await api('leave', { method: 'POST' });
      lsSet(KEY_CODE, null);
      set({ hasCode: false, code: null, codeKnown: false, devices: 1 });
      await syncNow();
    },
  };
}
