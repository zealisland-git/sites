// ASCII Art Studio: wires the tabs together.
import { resetMetrics } from './engine.js';
import { readShareLink } from './output.js';
import { $, $$, toast, setSaveHandler } from './ui.js';
import { initTextTab } from './text-tab.js';
import { initPictureTab } from './picture-tab.js';
import { initDoodleTab } from './doodle-tab.js';
import { initGallery } from './gallery.js';

// ---- UI light / dark
const html = document.documentElement;
const uiBtn = $('#uiThemeBtn');
function setUi(mode) {
  html.dataset.theme = mode;
  uiBtn.textContent = mode === 'dark' ? '☀️' : '🌙';
  uiBtn.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}
let uiMode = null;
try { uiMode = localStorage.getItem('aas-ui'); } catch { /* ignore */ }
setUi(uiMode || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
uiBtn.addEventListener('click', () => {
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
  setUi(next);
  try { localStorage.setItem('aas-ui', next); } catch { /* ignore */ }
});

// ---- mascot blinks now and then
const mascot = $('#mascot');
const FACE = [' /\\_/\\ ', '( o.o )', ' > ^ < '];
const paintMascot = eyes => { mascot.textContent = [FACE[0], `( ${eyes} )`, FACE[2]].join('\n'); };
paintMascot('o.o');
setInterval(() => { paintMascot('-.-'); setTimeout(() => paintMascot('o.o'), 160); }, 4200);
export function happyMascot() { paintMascot('^.^'); setTimeout(() => paintMascot('o.o'), 1400); }

// ---- tabs
const text = initTextTab();
const picture = initPictureTab();
const doodle = initDoodleTab();
const gallery = initGallery({
  onCount: n => { const b = $('#galleryCount'); b.textContent = n; b.hidden = n === 0; },
  onRemix: item => {
    if (item.kind === 'text') { text.apply(item.settings); go('text'); }
    else if (item.kind === 'picture') { go('picture'); picture.apply(item.settings, item.source, item.title); }
    else if (item.kind === 'doodle') { go('doodle'); doodle.apply(item.settings, item.source); }
    toast('Loaded it back so you can change it ✏️');
  },
});
setSaveHandler(async art => { await gallery.save(art); happyMascot(); });

const TABS = ['text', 'picture', 'doodle', 'gallery'];
const tabApi = { text, picture, doodle, gallery };
let currentTab = null;
function showTab(id) {
  if (!TABS.includes(id)) id = 'text';
  if (currentTab === id) return;
  if (currentTab === 'picture') picture.leave();
  currentTab = id;
  for (const b of $$('.tabs [role=tab]')) {
    const on = b.dataset.tab === id;
    b.setAttribute('aria-selected', on);
    b.tabIndex = on ? 0 : -1;
  }
  for (const p of $$('main > .panel')) {
    const on = p.id === 'tab-' + id;
    p.hidden = !on;
    p.classList.toggle('active', on);
  }
  try { localStorage.setItem('aas-tab', id); } catch { /* ignore */ }
  requestAnimationFrame(() => tabApi[id].refresh && tabApi[id].refresh());
}
function go(id) {
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  showTab(id);
}
$$('.tabs [role=tab]').forEach(b => {
  b.addEventListener('click', () => go(b.dataset.tab));
  b.addEventListener('keydown', e => {
    const i = TABS.indexOf(b.dataset.tab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      go(n);
      $(`.tabs [data-tab=${n}]`).focus();
    }
  });
});
$$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (TABS.includes(h)) showTab(h);
  else checkShare();
});

let startTab = location.hash.slice(1);
if (!TABS.includes(startTab)) { try { startTab = localStorage.getItem('aas-tab') || 'text'; } catch { startTab = 'text'; } }
showTab(startTab);

// ---- shared links (#art=... for one piece, #sync=CODE to join a collection)
async function checkShare() {
  const sync = /^#sync=([0-9A-Za-z-]{16,24})$/.exec(location.hash);
  if (sync) {
    go('gallery');
    gallery.offerJoin(sync[1]);
    toast('Someone shared a sync code with you. Press Join to see their art here.', { ms: 5000 });
    return;
  }
  if (!location.hash.startsWith('#art=')) return;
  const art = await readShareLink(location.hash);
  if (art) gallery.openShared(art);
  else toast('That share link looks broken. Sorry!');
}
checkShare();

// ---- drop a picture anywhere / paste a picture
const dropOverlay = $('#dropOverlay');
let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; dragDepth++; dropOverlay.hidden = false; });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dropOverlay.hidden = true; });
window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0; dropOverlay.hidden = true;
  const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/')) || e.dataTransfer.files[0];
  if (file) { go('picture'); picture.loadFile(file); }
});
window.addEventListener('paste', e => {
  const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
  if (!file) return;
  e.preventDefault();
  go('picture');
  picture.loadFile(file);
  toast('Pasted picture 📋');
});

// ---- once the art font has loaded, re-measure glyphs for the best match
if (document.fonts && document.fonts.load) {
  Promise.all([
    document.fonts.load('16px "JetBrains Mono"'),
    document.fonts.load('16px "JetBrains Mono"', '░▒▓█▀▄▌▐─│┌┐└┘╔╗╚╝═║'),
  ]).then(() => {
    resetMetrics();
    text.refresh(); picture.refresh(); doodle.refresh();
  }).catch(() => {});
}
