// "My art" gallery: saved pieces live in this browser (IndexedDB).
import { $, el, toast, pop } from './ui.js';
import { ArtView, paintPre, fitFontSize, THEMES, getTheme, copyText, downloadPng, downloadTxt, makeShareLink, artSize } from './output.js';

// ---------------------------------------------------------------- storage
const DB = 'ascii-art-studio', STORE = 'arts', LS_KEY = 'aas-gallery-fallback';
let dbp = null;
function openDb() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no indexedDB'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
function lsAll() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function lsWrite(list) { localStorage.setItem(LS_KEY, JSON.stringify(list)); }

const store = {
  async all() {
    try {
      const db = await openDb();
      return await new Promise((res, rej) => {
        const r = db.transaction(STORE).objectStore(STORE).getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    } catch { return lsAll(); }
  },
  async put(item) {
    try {
      const db = await openDb();
      await new Promise((res, rej) => {
        const t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).put(item);
        t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    } catch {
      const list = lsAll().filter(x => x.id !== item.id);
      list.push({ ...item, source: null });
      lsWrite(list);
    }
  },
  async del(id) {
    try {
      const db = await openDb();
      await new Promise((res, rej) => {
        const t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).delete(id);
        t.oncomplete = res; t.onerror = () => rej(t.error);
      });
    } catch { lsWrite(lsAll().filter(x => x.id !== id)); }
  },
};

// ---------------------------------------------------------------- gallery UI
const KIND = { text: { icon: 'Aa', label: 'Words' }, picture: { icon: '🖼️', label: 'Picture' }, doodle: { icon: '✏️', label: 'Doodle' }, shared: { icon: '🔗', label: 'Shared' } };

export function initGallery({ onRemix, onCount }) {
  let items = [];
  const grid = $('#gGrid'), search = $('#gSearch');
  const count = () => { onCount(items.length); $('#gTotal').textContent = items.length ? `${items.length} saved` : ''; };

  async function load() {
    items = (await store.all()).sort((a, b) => b.created - a.created);
    count();
    draw();
  }

  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); paintThumb(e.target); }
  }, { rootMargin: '200px' });

  function paintThumb(card) {
    const it = items.find(x => x.id === card.dataset.id);
    if (!it) return;
    const box = $('.gthumb', card), pre = $('pre', card);
    const theme = THEMES[it.theme] ? { id: it.theme, ...THEMES[it.theme] } : getTheme();
    box.style.background = theme.bg;
    paintPre(pre, it, theme);
    pre.style.fontSize = fitFontSize(it.text, box.clientWidth - 16, box.clientHeight - 16, 14) + 'px';
  }

  function draw() {
    io.disconnect();
    grid.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    const list = q ? items.filter(it => (it.title || '').toLowerCase().includes(q)) : items;
    $('#gEmpty').hidden = items.length > 0;
    $('#gTools').hidden = items.length === 0;
    if (items.length && !list.length) grid.append(el('p', { class: 'muted pad' }, 'Nothing saved with that name.'));
    for (const it of list) {
      const k = KIND[it.kind] || KIND.shared;
      const card = el('article', { class: 'gcard', 'data-id': it.id },
        el('button', { type: 'button', class: 'gthumb', 'aria-label': 'Open ' + (it.title || 'art') }, el('pre', { class: 'art' })),
        el('div', { class: 'gmeta' },
          el('span', { class: 'gkind', title: k.label }, k.icon),
          el('span', { class: 'gtitle' }, it.title || 'Untitled'),
          el('button', { type: 'button', class: 'icon-btn sm', title: 'Copy', 'aria-label': 'Copy ' + (it.title || 'art'), 'data-copy': '' }, '📋')),
        el('div', { class: 'gdate' }, new Date(it.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })));
      $('.gthumb', card).addEventListener('click', () => openViewer(it.id));
      $('[data-copy]', card).addEventListener('click', async e => { if (await copyText(it.text)) { toast('Copied! ✨'); pop(e.currentTarget); } });
      grid.append(card);
      io.observe(card);
    }
  }
  search.addEventListener('input', draw);

  // ---- viewer dialog
  const dlg = $('#viewer');
  const vview = new ArtView($('#vViewport'), { maxFont: 24 });
  let current = null;
  function openViewer(id) {
    current = items.find(x => x.id === id);
    if (!current) return;
    $('#vTitle').value = current.title || '';
    $('#vMeta').textContent = `${(KIND[current.kind] || KIND.shared).label} · ${artSize(current.text).cols} × ${artSize(current.text).rows} · ${new Date(current.created).toLocaleString()}`;
    $('#vRemix').hidden = !current.settings || current.kind === 'shared';
    $('#vSaveShared').hidden = true;
    $('#vDelete').hidden = false;
    $('#vTitle').readOnly = false;
    if (!dlg.open) dlg.showModal();
    vview.zoom = 1;
    requestAnimationFrame(() => vview.set(current));
  }
  function openShared(art) {
    current = { ...art, kind: 'shared', id: null };
    $('#vTitle').value = art.title || 'Shared art';
    $('#vTitle').readOnly = true;
    $('#vMeta').textContent = `Someone shared this with you · ${art.cols} × ${art.rows}`;
    $('#vRemix').hidden = true;
    $('#vDelete').hidden = true;
    $('#vSaveShared').hidden = false;
    if (!dlg.open) dlg.showModal();
    requestAnimationFrame(() => vview.set(current));
  }
  $('#vClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { if (location.hash.startsWith('#art=')) history.replaceState(null, '', location.pathname + location.search + '#gallery'); });
  $('#vTitle').addEventListener('change', async () => {
    if (!current || !current.id) return;
    current.title = $('#vTitle').value.trim().slice(0, 60) || 'Untitled';
    await store.put(current);
    draw();
    toast('Renamed ✏️');
  });
  $('#vCopy').addEventListener('click', async e => { if (await copyText(current.text)) { toast('Copied! ✨'); pop(e.currentTarget); } });
  $('#vPng').addEventListener('click', () => downloadPng(current, current.title).then(() => toast('Picture downloaded 🖼️')));
  $('#vTxt').addEventListener('click', () => { downloadTxt(current, current.title); toast('Text file downloaded 📄'); });
  $('#vLink').addEventListener('click', async () => {
    const url = await makeShareLink(current, current.title);
    if (url.length > 60000) { toast('Too big for a link. Share the picture instead.'); return; }
    if (await copyText(url)) toast('Share link copied 🔗');
  });
  $('#vRemix').addEventListener('click', () => { dlg.close(); onRemix(current); });
  $('#vDelete').addEventListener('click', async () => {
    const gone = current;
    await store.del(gone.id);
    items = items.filter(x => x.id !== gone.id);
    dlg.close(); count(); draw();
    toast('Deleted', { action: 'Undo', onAction: async () => { await store.put(gone); await load(); }, ms: 5000 });
  });
  $('#vSaveShared').addEventListener('click', async () => {
    const { id, ...rest } = current;
    await save({ ...rest, kind: 'shared', theme: getTheme().id });
    dlg.close();
  });

  // ---- backup
  $('#gExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'ascii-art-studio', version: 1, exported: new Date().toISOString(), items }, null, 0)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `my-ascii-art-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); setTimeout(() => a.remove(), 1000);
    toast('Backup file downloaded 💾');
  });
  $('#gImport').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.items;
      let n = 0;
      for (const it of list || []) {
        if (!it || typeof it.text !== 'string') continue;
        await store.put({ ...it, id: it.id || newId(), created: it.created || Date.now() });
        n++;
      }
      await load();
      toast(`Imported ${n} piece${n === 1 ? '' : 's'} 🎉`);
    } catch { toast('That file is not an ASCII Art Studio backup.'); }
  });

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  async function save(art) {
    const item = {
      id: newId(),
      created: Date.now(),
      kind: art.kind,
      title: (art.title || 'Untitled').slice(0, 60),
      text: art.text,
      cols: art.cols || artSize(art.text).cols,
      rows: art.rows || artSize(art.text).rows,
      color: art.color || 'ink',
      colors: art.colors || null,
      theme: art.theme || getTheme().id,
      settings: art.settings || null,
      source: art.source || null,
    };
    try {
      await store.put(item);
    } catch {
      toast('Could not save: this browser\'s storage is full or blocked.');
      return;
    }
    items.unshift(item);
    count(); draw();
    const badge = $('#galleryCount'); pop(badge);
    toast('Saved to My art ⭐', { action: 'View', onAction: () => { location.hash = 'gallery'; } });
  }

  load();
  return { save, openShared, refresh: draw };
}
