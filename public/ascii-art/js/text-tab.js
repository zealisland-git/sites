// "Words" tab: type text, pick a FIGlet font, get big ASCII letters.
import { FONTS, FONT_CATEGORIES } from './fonts.js';
import { parseFont, renderText } from './figlet.js';
import { createOutput, chipGroup, slider, $, $$, el } from './ui.js';
import { fitFontSize, COLOR_MODES, swatchCss } from './output.js';
import { decorate, initDecorations, findCustom, mergeCustomDecos } from './decorations.js';

const fontCache = new Map();
export function loadFont(file) {
  if (!fontCache.has(file)) {
    const p = fetch(`fonts/${file}.flf`)
      .then(r => { if (!r.ok) throw new Error('Font not found'); return r.text(); })
      .then(parseFont);
    p.catch(() => fontCache.delete(file));
    fontCache.set(file, p);
  }
  return fontCache.get(file);
}
const byName = new Map(FONTS.map(f => [f.n, f]));

// ---------------------------------------------------------------- tab
const DEFAULTS = { text: 'Hello!', font: 'Standard', layout: 'default', align: 'left', width: 80, frame: 'none', color: 'ink' };

export function initTextTab() {
  let state = { ...DEFAULTS };
  try { Object.assign(state, JSON.parse(localStorage.getItem('aas-text') || '{}')); } catch { /* ignore */ }
  if (!byName.has(state.font)) state.font = 'Standard';
  if (String(state.frame).startsWith('c:') && !findCustom(state.frame)) state.frame = 'none';
  let draftDeco = null; // decoration being edited (live preview)
  const persist = () => { try { localStorage.setItem('aas-text', JSON.stringify(state)); } catch { /* ignore */ } };

  const root = $('#tab-text');
  const ta = $('#tText', root);
  ta.value = state.text;

  const out = createOutput($('[data-output=text]', root), {
    kind: 'text',
    maxFont: 22,
    emptyHtml: '<pre class="ph-art"> /\\_/\\\n( o.o )  type something!\n > ^ <</pre>',
    getSave: () => ({ title: state.text.trim().split('\n')[0].slice(0, 40) || 'Words', settings: { ...state, deco: findCustom(state.frame) ? { ...findCustom(state.frame) } : undefined } }),
  });

  // ---- render
  let renderId = 0;
  async function render() {
    const id = ++renderId;
    const f = byName.get(state.font);
    $('#tFontName').textContent = state.font;
    if (!state.text.trim()) { out.set(null); return; }
    try {
      const font = await loadFont(f.f);
      if (id !== renderId) return;
      let rows = renderText(font, state.text, { layout: state.layout, width: state.width > 200 ? 0 : state.width, align: state.align });
      rows = decorate(rows, state.frame, draftDeco);
      const text = rows.map(r => r.replace(/\s+$/, '')).join('\n');
      out.set({ text, color: state.color === 'original' ? 'ink' : state.color });
    } catch {
      out.set({ text: '(font failed to load, try another one)', color: 'ink' });
    }
  }
  const update = (patch) => { Object.assign(state, patch); persist(); render(); markSelected(); };

  ta.addEventListener('input', () => { state.text = ta.value; persist(); render(); schedulePreviews(); });

  // ---- options
  const layout = chipGroup($('#tLayout'), [
    { id: 'full', label: 'Wide' }, { id: 'default', label: 'Normal' }, { id: 'fitted', label: 'Snug' }, { id: 'smush', label: 'Squish' },
  ], state.layout, v => { update({ layout: v }); schedulePreviews(); }, { cls: 'seg' });
  const align = chipGroup($('#tAlign'), [
    { id: 'left', html: '<span aria-hidden="true">⇤</span>', aria: 'Align left', title: 'Align left' },
    { id: 'center', html: '<span aria-hidden="true">↔</span>', aria: 'Center', title: 'Center' },
    { id: 'right', html: '<span aria-hidden="true">⇥</span>', aria: 'Align right', title: 'Align right' },
  ], state.align, v => update({ align: v }), { cls: 'seg' });
  const frame = initDecorations({
    chips: $('#tFrame'), actions: $('#tDecoActions'), editor: $('#tDecoEditor'),
    getFrame: () => state.frame,
    onSelect: v => update({ frame: v }),
    onDraft: d => { draftDeco = d; render(); },
  });
  const colorItems = COLOR_MODES.filter(c => c.id !== 'original').map(c => ({ id: c.id, title: c.label, aria: c.label, html: `<i class="dot" style="background:${swatchCss(c.id)}"></i><span>${c.label}</span>` }));
  const color = chipGroup($('#tColor'), colorItems, state.color, v => update({ color: v }), { cls: 'chip color-chip' });
  const width = slider($('#tWidth'), $('#tWidthOut'), v => (v > 200 ? 'No limit' : v + ' letters'), v => update({ width: v }));
  width.set(state.width);

  // ---- font picker
  const list = $('#fontList');
  const search = $('#fontSearch');
  let cat = 'popular';
  const cats = chipGroup($('#fontCats'), FONT_CATEGORIES.map(c => ({ id: c.id, html: `<span aria-hidden="true">${c.icon}</span> ${c.label}` })), cat, v => { cat = v; search.value = ''; buildList(); });

  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); paintCard(e.target); }
  }, { root: null, rootMargin: '300px' });

  function previewText() {
    const t = state.text.trim().split('\n')[0];
    return (t || 'Abc').slice(0, 14);
  }

  async function paintCard(card) {
    card.dataset.painted = '1';
    const f = byName.get(card.dataset.font);
    const pre = $('pre', card);
    try {
      const font = await loadFont(f.f);
      const rows = renderText(font, previewText(), { layout: state.layout });
      const text = rows.join('\n') || ' ';
      pre.textContent = text;
      const box = $('.fprev-box', card);
      pre.style.fontSize = fitFontSize(text, box.clientWidth - 8, box.clientHeight - 8, 11) + 'px';
      card.classList.remove('loading');
    } catch {
      pre.textContent = '(could not load)';
    }
  }

  let pv = 0;
  function schedulePreviews() {
    clearTimeout(pv);
    pv = setTimeout(() => {
      for (const card of $$('.font-card', list)) {
        if (card.dataset.painted) {
          const r = card.getBoundingClientRect();
          if (r.bottom > -400 && r.top < innerHeight + 400 && r.right > -400 && r.left < innerWidth + 400) paintCard(card);
          else { delete card.dataset.painted; io.observe(card); }
        }
      }
    }, 220);
  }

  function buildList() {
    io.disconnect();
    list.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    let names;
    if (q) names = FONTS.map(f => f.n).filter(n => n.toLowerCase().includes(q));
    else {
      const c = FONT_CATEGORIES.find(c => c.id === cat);
      names = c.fonts || FONTS.map(f => f.n);
    }
    $('#fontCount').textContent = `${names.length} font${names.length === 1 ? '' : 's'}`;
    if (!names.length) list.append(el('p', { class: 'muted pad' }, 'No fonts match that name.'));
    for (const n of names) {
      const card = el('button', { type: 'button', class: 'font-card loading', 'data-font': n, 'aria-label': 'Use font ' + n },
        el('span', { class: 'fprev-box' }, el('pre', { class: 'fprev' })),
        el('span', { class: 'fname' }, n));
      card.addEventListener('click', () => { update({ font: n }); });
      list.append(card);
      io.observe(card);
    }
    markSelected();
  }
  function markSelected() {
    for (const c of $$('.font-card', list)) {
      const on = c.dataset.font === state.font;
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', on);
    }
  }
  search.addEventListener('input', () => { cats.set(search.value.trim() ? '' : cat); buildList(); });

  // prev / next / random
  const visibleNames = () => $$('.font-card', list).map(c => c.dataset.font);
  const step = d => {
    const names = visibleNames().length ? visibleNames() : FONTS.map(f => f.n);
    let i = names.indexOf(state.font);
    i = i < 0 ? 0 : (i + d + names.length) % names.length;
    update({ font: names[i] });
    const card = $(`.font-card[data-font="${CSS.escape(names[i])}"]`, list);
    if (card) card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  };
  $('#fontPrev').addEventListener('click', () => step(-1));
  $('#fontNext').addEventListener('click', () => step(1));
  $('#fontRandom').addEventListener('click', () => {
    const pool = FONT_CATEGORIES.slice(0, -1).flatMap(c => c.fonts);
    let n;
    do n = pool[Math.floor(Math.random() * pool.length)]; while (n === state.font && pool.length > 1);
    update({ font: n });
    const card = $(`.font-card[data-font="${CSS.escape(n)}"]`, list);
    if (card) card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  });

  buildList();
  render();

  return {
    apply(settings) {
      const { deco, ...rest } = settings || {};
      if (deco) mergeCustomDecos([deco]);
      state = { ...DEFAULTS, ...rest };
      if (!byName.has(state.font)) state.font = 'Standard';
      if (String(state.frame).startsWith('c:') && !findCustom(state.frame)) state.frame = 'none';
      frame.refresh();
      ta.value = state.text;
      layout.set(state.layout); align.set(state.align); frame.set(state.frame); color.set(state.color); width.set(state.width);
      persist(); render(); buildList(); schedulePreviews();
    },
    focus() { ta.focus(); },
    refresh() { render(); schedulePreviews(); },
  };
}
