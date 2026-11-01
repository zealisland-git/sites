// Decorations for the Words tab: built-in frames plus ones you make yourself.
import { $, el, toast, chipGroup, slider } from './ui.js';

// ---------------------------------------------------------------- built-ins
export const BUILTIN = [
  { id: 'none', label: 'None' },
  { id: 'box', label: '┌ Box ┐' },
  { id: 'round', label: '╭ Round ╮' },
  { id: 'double', label: '╔ Double ╗' },
  { id: 'ascii', label: '+ Plain +' },
  { id: 'stars', label: '* Stars *' },
  { id: 'sparkle', label: '. * Sparkle' },
  { id: 'kitty', label: '🐱 Kitty says' },
  { id: 'bunny', label: '🐰 Bunny' },
];

const BORDER_KEYS = ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'];
const BORDERS = {
  box: ['┌', '─', '┐', '│', '│', '└', '─', '┘'],
  round: ['╭', '─', '╮', '│', '│', '╰', '─', '╯'],
  double: ['╔', '═', '╗', '║', '║', '╚', '═', '╝'],
  ascii: ['+', '-', '+', '|', '|', '+', '-', '+'],
  stars: ['*', '*', '*', '*', '*', '*', '*', '*'],
};

const STAMPS = [
  { id: 'cat', label: '🐱 Cat', art: ' /\\_/\\\n( o.o )\n > ^ <' },
  { id: 'bunny', label: '🐰 Bunny', art: '(\\(\\\n( -.-)\no_(")(")' },
  { id: 'owl', label: '🦉 Owl', art: ' ,_,\n(o,o)\n{`"\'}\n-"-"-' },
  { id: 'dog', label: '🐶 Dog', art: '  / \\__\n (    @\\___\n /         O\n/   (_____/\n/_____/   U' },
  { id: 'fish', label: '🐟 Fish', art: "><(((('>" },
  { id: 'heart', label: '💗 Heart', art: " .:::.   .:::.\n:::::::.:::::::\n:::::::::::::::\n':::::::::::::'\n  ':::::::::'\n    ':::::'\n      ':'" },
  { id: 'coffee', label: '☕ Coffee', art: "   ( (\n    ) )\n ........\n |      |]\n \\      /\n  `----'" },
  { id: 'sparkles', label: '✨ Sparkles', art: '*  .  +  .  *  .  +  .  *' },
];

const PRESETS = [
  { id: 'round', label: '╭╮ Round', v: [...BORDERS.round, 2, 1] },
  { id: 'box', label: '┌┐ Box', v: [...BORDERS.box, 2, 1] },
  { id: 'double', label: '╔╗ Double', v: [...BORDERS.double, 2, 1] },
  { id: 'hearts', label: '<3 Hearts', v: ['<3', ' <3 ', '<3', '<3', '<3', '<3', ' <3 ', '<3', 2, 1] },
  { id: 'waves', label: '~ Waves', v: ['~', '~', '~', '{', '}', '~', '~', '~', 2, 0] },
  { id: 'dots', label: ': Dots', v: ['.', '.', '.', ':', ':', "'", "'", "'", 2, 0] },
  { id: 'zigzag', label: '/\\ Zigzag', v: ['', '/\\', '', '>', '<', '', '\\/', '', 2, 0] },
  { id: 'clear', label: '✕ No border', v: ['', '', '', '', '', '', '', '', 0, 0] },
];

// ---------------------------------------------------------------- helpers
const cps = s => Array.from(s || '');
const len = s => cps(s).length;
const padEnd = (s, n) => s + ' '.repeat(Math.max(0, n - len(s)));
function rep(pat, n) {
  const a = cps(pat);
  if (n <= 0) return '';
  if (!a.length) return ' '.repeat(n);
  const out = [];
  while (out.length < n) out.push(...a);
  return out.slice(0, n).join('');
}
const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u{1F000}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u;
export function hasWideChars(s) { return WIDE.test(s || ''); }

function boxed(rows, [tl, t, tr, l, r, bl, b, br], padX = 2, padY = 0) {
  return renderCustom(rows, { tl, t, tr, l, r, bl, b, br, padX, padY, art: '' });
}

function trimArt(art) {
  let rows = String(art || '').replace(/\t/g, '    ').split(/\r?\n/).map(r => r.replace(/\s+$/, ''));
  while (rows.length && !rows[0].trim()) rows.shift();
  while (rows.length && !rows[rows.length - 1].trim()) rows.pop();
  let ind = Infinity;
  for (const r of rows) if (r.trim()) ind = Math.min(ind, r.length - r.trimStart().length);
  if (isFinite(ind) && ind > 0) rows = rows.map(r => r.slice(ind));
  return rows;
}

/** Apply a decoration object { tl,t,tr,l,r,bl,b,br, padX, padY, art, artPos, artAlign } to rows. */
export function renderCustom(rows, d) {
  let block = rows.slice();
  const W = Math.max(0, ...block.map(len));
  if (BORDER_KEYS.some(k => d[k])) {
    const padX = d.padX || 0, padY = d.padY || 0;
    const lw = Math.max(len(d.tl), len(d.l), len(d.bl));
    const inner = W + padX * 2;
    const edge = (c1, mid, c2) => padEnd(c1 || '', lw) + (mid ? rep(mid, inner) : ' '.repeat(inner)) + (c2 || '');
    const side = s => padEnd(d.l || '', lw) + s + (d.r || '');
    const out = [];
    if (d.t || d.tl || d.tr) out.push(edge(d.tl, d.t, d.tr));
    for (let i = 0; i < padY; i++) out.push(side(' '.repeat(inner)));
    for (const row of block) out.push(side(' '.repeat(padX) + padEnd(row, W) + ' '.repeat(padX)));
    for (let i = 0; i < padY; i++) out.push(side(' '.repeat(inner)));
    if (d.b || d.bl || d.br) out.push(edge(d.bl, d.b, d.br));
    block = out;
  }
  const art = trimArt(d.art);
  if (art.length) {
    const aw = Math.max(...art.map(len)), bw = Math.max(0, ...block.map(len));
    const pos = d.artPos || 'below', al = d.artAlign || 'center';
    if (pos === 'above' || pos === 'below') {
      const total = Math.max(aw, bw);
      const off = w => (al === 'start' ? 0 : al === 'end' ? total - w : Math.floor((total - w) / 2));
      const a = art.map(r => ' '.repeat(off(aw)) + r);
      const b = block.map(r => ' '.repeat(off(bw)) + r);
      block = pos === 'above' ? [...a, ...b] : [...b, ...a];
    } else {
      const H = Math.max(art.length, block.length);
      const top = (h) => (al === 'start' ? 0 : al === 'end' ? H - h : Math.floor((H - h) / 2));
      const at = top(art.length), bt = top(block.length);
      const out = [];
      for (let i = 0; i < H; i++) {
        const ar = padEnd(art[i - at] || '', aw), br = padEnd(block[i - bt] || '', bw);
        out.push(pos === 'left' ? ar + '  ' + br : br + '  ' + ar);
      }
      block = out;
    }
  }
  return block.map(r => r.replace(/\s+$/, ''));
}

// ---------------------------------------------------------------- your decorations (saved in this browser)
const KEY = 'aas-decos';
const BLANK = { name: 'My decoration', tl: '', t: '', tr: '', l: '', r: '', bl: '', b: '', br: '', padX: 2, padY: 1, art: '', artPos: 'below', artAlign: 'center' };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clampInt = (v, lo, hi, dflt) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };

function clean(d) {
  const o = { ...BLANK, ...(d || {}) };
  for (const k of BORDER_KEYS) o[k] = cps(String(o[k] ?? '').replace(/[\r\n\t]/g, '')).slice(0, 12).join('');
  o.padX = clampInt(o.padX, 0, 8, 2);
  o.padY = clampInt(o.padY, 0, 4, 0);
  o.art = String(o.art || '').slice(0, 3000);
  o.artPos = ['above', 'below', 'left', 'right'].includes(o.artPos) ? o.artPos : 'below';
  o.artAlign = ['start', 'center', 'end'].includes(o.artAlign) ? o.artAlign : 'center';
  o.name = String(o.name || 'My decoration').trim().slice(0, 24) || 'My decoration';
  o.id = typeof o.id === 'string' && /^[a-z0-9]{4,20}$/.test(o.id) ? o.id : newId();
  return o;
}

let customs = [];
try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(v)) customs = v.map(clean); } catch { /* ignore */ }
function store() {
  try { localStorage.setItem(KEY, JSON.stringify(customs)); } catch { toast('Could not save: this browser\'s storage is full or blocked.'); }
  window.dispatchEvent(new Event('aas-decos'));
}

export function getCustomDecos() { return customs.map(d => ({ ...d })); }
export function findCustom(frameId) {
  return typeof frameId === 'string' && frameId.startsWith('c:') ? customs.find(c => 'c:' + c.id === frameId) || null : null;
}
/** Add decorations that are not here yet (from a backup or a saved piece). Returns how many were added. */
export function mergeCustomDecos(list) {
  let n = 0;
  for (const d of Array.isArray(list) ? list : []) {
    if (!d || typeof d !== 'object') continue;
    const c = clean(d);
    if (customs.some(x => x.id === c.id)) continue;
    customs.push(c); n++;
  }
  if (n) store();
  return n;
}

/** Turn rows into decorated rows for a frame id ('box', 'c:<id>', ...), or a draft being edited. */
export function decorate(rows, frame, draft) {
  if (draft) return renderCustom(rows, draft);
  const mine = findCustom(frame);
  if (mine) return renderCustom(rows, mine);
  const W = Math.max(0, ...rows.map(x => x.length));
  if (BORDERS[frame]) return boxed(rows, BORDERS[frame], frame === 'stars' ? 3 : 2, 1);
  switch (frame) {
    case 'sparkle': {
      const pat = '  .  *  .  +  ';
      const line = off => (pat.repeat(Math.ceil((W + 8) / pat.length) + 1)).slice(off, off + W + 4);
      return [line(0), '', ...rows.map(r => '  ' + r), '', line(7)];
    }
    case 'kitty': {
      const body = rows.length === 1 ? ['< ' + rows[0].padEnd(W) + ' >'] : rows.map((r, i) => {
        const [l, rr] = i === 0 ? ['/', '\\'] : i === rows.length - 1 ? ['\\', '/'] : ['|', '|'];
        return l + ' ' + r.padEnd(W) + ' ' + rr;
      });
      return [' ' + '_'.repeat(W + 2), ...body, ' ' + '-'.repeat(W + 2), '    \\', '     \\  /\\_/\\', '       ( o.o )', '        > ^ <'];
    }
    case 'bunny': {
      const sign = boxed(rows, ['.', '-', '.', '|', '|', "'", '-', "'"], 2, 0);
      const sp = ' '.repeat(Math.max(0, Math.floor((W + 6) / 2) - 8));
      return [...sign, sp + '       ||', sp + ' (\\_/) ||', sp + ' (o.o) ||', sp + ' / >  \\/'];
    }
    default: return rows;
  }
}

// starting point when you press "Make your own" while a built-in is selected
function startFrom(frame) {
  const b = BORDERS[frame];
  if (b) return { ...BLANK, ...Object.fromEntries(BORDER_KEYS.map((k, i) => [k, b[i]])), padX: frame === 'stars' ? 3 : 2, padY: 1 };
  if (frame === 'kitty') return { ...BLANK, padY: 0, ...Object.fromEntries(BORDER_KEYS.map((k, i) => [k, BORDERS.round[i]])), art: STAMPS[0].art, artPos: 'below', artAlign: 'start' };
  if (frame === 'bunny') return { ...BLANK, padY: 0, ...Object.fromEntries(BORDER_KEYS.map((k, i) => [k, ['.', '-', '.', '|', '|', "'", '-', "'"][i]])), art: STAMPS[1].art, artPos: 'below', artAlign: 'center' };
  if (frame === 'sparkle') return { ...BLANK, padY: 0, art: STAMPS[7].art, artPos: 'above', artAlign: 'center' };
  return { ...BLANK, ...Object.fromEntries(BORDER_KEYS.map((k, i) => [k, PRESETS[3].v[i]])), padX: 2, padY: 1 };
}

// ---------------------------------------------------------------- picker + editor UI
/**
 * chips: container for the decoration chips; actions: row for "Make your own" / "Edit";
 * editor: the editor panel. getFrame(): current frame id. onSelect(id): user picked a frame.
 * onDraft(deco|null): live preview while editing.
 */
export function initDecorations({ chips, actions, editor, getFrame, onSelect, onDraft }) {
  let group = null;
  let editing = null; // { id|null (new), before: frame id to go back to on cancel }

  const addBtn = el('button', { type: 'button', class: 'chip chip-add' }, '＋ Make your own');
  const editBtn = el('button', { type: 'button', class: 'chip chip-edit', hidden: true }, '✎ Edit');
  actions.append(addBtn, editBtn);

  function buildChips() {
    const items = [...BUILTIN, ...customs.map(d => ({ id: 'c:' + d.id, label: '✦ ' + d.name, title: 'Your decoration: ' + d.name }))];
    group = chipGroup(chips, items, getFrame(), id => { closeEditor(); onSelect(id); syncActions(); });
    syncActions();
  }
  function syncActions() {
    const mine = findCustom(getFrame());
    editBtn.hidden = !mine || !!editing;
    if (mine) editBtn.textContent = `✎ Edit “${mine.name}”`;
    addBtn.hidden = !!editing;
  }

  // ---- editor fields
  const name = $('#dcName', editor);
  const cells = Object.fromEntries(BORDER_KEYS.map(k => [k, $(`[data-k="${k}"]`, editor)]));
  const art = $('#dcArt', editor);
  const hint = $('#dcHint', editor);
  const delBtn = $('[data-deco=delete]', editor);
  const title = $('#dcTitle', editor);
  let draft = { ...BLANK };

  const padX = slider($('#dcPadX', editor), $('#dcPadXOut', editor), v => v, v => { draft.padX = v; changed(); });
  const padY = slider($('#dcPadY', editor), $('#dcPadYOut', editor), v => v, v => { draft.padY = v; changed(); });
  const pos = chipGroup($('#dcPos', editor), [
    { id: 'above', label: 'Above' }, { id: 'below', label: 'Below' }, { id: 'left', label: 'Left' }, { id: 'right', label: 'Right' },
  ], 'below', v => { draft.artPos = v; syncAlignLabels(); changed(); }, { cls: 'seg' });
  const align = chipGroup($('#dcAlign', editor), [
    { id: 'start', label: '⇤' }, { id: 'center', label: '↔' }, { id: 'end', label: '⇥' },
  ], 'center', v => { draft.artAlign = v; changed(); }, { cls: 'seg' });
  function syncAlignLabels() {
    const side = draft.artPos === 'left' || draft.artPos === 'right';
    const labels = side ? [['⤒', 'Top'], ['↕', 'Middle'], ['⤓', 'Bottom']] : [['⇤', 'Left'], ['↔', 'Center'], ['⇥', 'Right']];
    align.buttons.forEach((b, i) => { b.textContent = labels[i][0]; b.title = labels[i][1]; b.setAttribute('aria-label', labels[i][1]); });
  }

  const actionChips = (box, items, fn) => {
    for (const it of items) box.append(el('button', { type: 'button', class: 'chip sm', onclick: () => fn(it) }, it.label));
  };
  actionChips($('#dcPresets', editor), PRESETS, p => {
    BORDER_KEYS.forEach((k, i) => { draft[k] = p.v[i]; });
    draft.padX = p.v[8]; draft.padY = p.v[9];
    fill(); changed();
  });
  actionChips($('#dcStamps', editor), [...STAMPS, { id: 'none', label: '✕ No picture', art: '' }], st => {
    draft.art = st.art;
    art.value = draft.art;
    changed();
  });

  for (const k of BORDER_KEYS) cells[k].addEventListener('input', () => { draft[k] = cells[k].value; changed(); });
  art.addEventListener('input', () => { draft.art = art.value; changed(); });
  name.addEventListener('input', () => { draft.name = name.value; });

  function fill() {
    name.value = draft.name;
    for (const k of BORDER_KEYS) cells[k].value = draft[k];
    padX.set(draft.padX); padY.set(draft.padY);
    art.value = draft.art;
    pos.set(draft.artPos); align.set(draft.artAlign); syncAlignLabels();
  }
  function changed() {
    const all = BORDER_KEYS.map(k => draft[k]).join('') + draft.art;
    hint.hidden = !hasWideChars(all);
    onDraft(clean(draft));
  }

  function openEditor(existing) {
    const before = getFrame();
    if (existing) { draft = { ...existing }; title.textContent = `✎ Edit “${existing.name}”`; }
    else {
      draft = { ...startFrom(before), name: `My decoration ${customs.length + 1}` };
      const mine = findCustom(before);
      if (mine) draft = { ...mine, id: undefined, name: (`${mine.name} copy`).slice(0, 24) };
      title.textContent = '✨ Make your own';
    }
    editing = { id: existing ? existing.id : null, before };
    delBtn.hidden = !existing;
    fill();
    editor.hidden = false;
    syncActions();
    changed();
    requestAnimationFrame(() => { editor.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); cells.t.focus({ preventScroll: true }); });
  }
  function closeEditor(notify = true) {
    if (!editing) return;
    editing = null;
    editor.hidden = true;
    syncActions();
    if (notify) onDraft(null);
  }

  addBtn.addEventListener('click', () => openEditor(null));
  editBtn.addEventListener('click', () => { const mine = findCustom(getFrame()); if (mine) openEditor(mine); });
  editor.addEventListener('click', e => {
    const act = e.target.closest('[data-deco]')?.dataset.deco;
    if (!act) return;
    if (act === 'cancel' || act === 'close') { closeEditor(); return; }
    if (act === 'save') {
      const d = clean({ ...draft, id: editing.id || undefined });
      if (!BORDER_KEYS.some(k => d[k]) && !d.art.trim()) { toast('Type a border or add a little picture first.'); return; }
      const i = customs.findIndex(c => c.id === d.id);
      if (i >= 0) customs[i] = d; else customs.push(d);
      store();
      closeEditor(false);
      onDraft(null);
      onSelect('c:' + d.id);
      buildChips();
      toast(i >= 0 ? 'Decoration updated ✦' : `Saved “${d.name}” to your decorations ✦`);
    }
    if (act === 'delete' && editing.id) {
      const gone = customs.find(c => c.id === editing.id);
      customs = customs.filter(c => c.id !== editing.id);
      store();
      closeEditor(false);
      onDraft(null);
      onSelect('none');
      buildChips();
      toast('Decoration deleted', { action: 'Undo', onAction: () => { customs.push(gone); store(); onSelect('c:' + gone.id); buildChips(); }, ms: 5000 });
    }
  });
  editor.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeEditor(); } });

  window.addEventListener('aas-decos', () => { if (!editing) buildChips(); });
  buildChips();

  return {
    set(id) { closeEditor(false); onDraft(null); group.set(id); syncActions(); },
    refresh: buildChips,
  };
}
