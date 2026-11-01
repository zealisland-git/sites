// Small UI helpers shared by every tab.
import { ArtView, THEMES, getTheme, setTheme, onThemeChange, copyText, copyImage, downloadPng, downloadTxt, makeShareLink, artSize } from './output.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids) if (kid != null) e.append(kid);
  return e;
}

// ---------------------------------------------------------------- toasts
const FACES = ['(=^･ω･^=)', '(=^‥^=)', '(=ↀωↀ=)', '(=^-ω-^=)'];
export function toast(msg, { face = true, action, onAction, ms = 2600 } = {}) {
  const box = $('#toasts');
  const t = el('div', { class: 'toast', role: 'status' },
    face ? el('span', { class: 'toast-face' }, FACES[Math.floor(Math.random() * FACES.length)]) : null,
    el('span', {}, msg));
  if (action) t.append(el('button', { class: 'toast-act', onclick: () => { onAction(); t.remove(); } }, action));
  box.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
}

export function pop(elm) {
  elm.classList.remove('pop');
  void elm.offsetWidth;
  elm.classList.add('pop');
}

// ---------------------------------------------------------------- chips / segmented
/** Build a single-choice chip group. items: [{id, label, title?, html?}] */
export function chipGroup(container, items, value, onChange, { cls = 'chip' } = {}) {
  container.innerHTML = '';
  container.setAttribute('role', 'radiogroup');
  const btns = items.map(it => {
    const b = el('button', { type: 'button', class: cls, role: 'radio', 'data-id': it.id, title: it.title || null, 'aria-label': it.aria || null });
    if (it.html) b.innerHTML = it.html; else b.textContent = it.label;
    b.addEventListener('click', () => { set(it.id); onChange(it.id); });
    container.append(b);
    return b;
  });
  const set = id => btns.forEach(b => {
    const on = b.dataset.id === id;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  });
  set(value);
  return { set, buttons: btns };
}

/** Wire a range input to a label and a callback. */
export function slider(input, out, fmt, onInput) {
  const show = () => { if (out) out.textContent = fmt(+input.value); input.style.setProperty('--p', ((input.value - input.min) / (input.max - input.min)) * 100 + '%'); };
  input.addEventListener('input', () => { show(); onInput(+input.value); });
  show();
  return { set(v) { input.value = v; show(); } };
}

// ---------------------------------------------------------------- output card
let saveHandler = null;
export function setSaveHandler(fn) { saveHandler = fn; }

const outputs = [];
export function createOutput(container, { kind, getSave, emptyHtml = '', maxFont = 26 }) {
  const swatches = Object.entries(THEMES).map(([id, t]) =>
    `<button type="button" class="sw" data-theme="${id}" role="radio" title="${t.name} background" aria-label="${t.name} background"><i style="background:${t.bg};color:${t.ink}">Aa</i></button>`).join('');
  container.innerHTML = `
    <div class="card out-card">
      <div class="out-head">
        <div class="out-title"><span class="spark" aria-hidden="true">✨</span> Preview <span class="dims"></span></div>
        <div class="out-tools">
          <div class="swatches" role="radiogroup" aria-label="Preview background">${swatches}</div>
          <div class="zoom" role="group" aria-label="Zoom">
            <button type="button" data-z="-" aria-label="Zoom out">−</button>
            <button type="button" data-z="fit" class="zfit">Fit</button>
            <button type="button" data-z="+" aria-label="Zoom in">+</button>
          </div>
        </div>
      </div>
      <div class="viewport"><div class="placeholder">${emptyHtml}</div></div>
      <div class="out-actions">
        <button type="button" class="btn btn-primary" data-act="copy"><span aria-hidden="true">📋</span> Copy</button>
        <button type="button" class="btn btn-sun" data-act="save"><span aria-hidden="true">⭐</span> Save</button>
        <button type="button" class="btn" data-act="png"><span aria-hidden="true">🖼️</span> Image</button>
        <div class="menu-wrap">
          <button type="button" class="btn" data-act="more" aria-haspopup="menu" aria-expanded="false">More <span aria-hidden="true">▾</span></button>
          <div class="menu" role="menu" hidden>
            <button type="button" role="menuitem" data-act="chat">💬 Copy for chat apps <small>keeps it lined up</small></button>
            <button type="button" role="menuitem" data-act="copyimg">🖼️ Copy as picture</button>
            <button type="button" role="menuitem" data-act="txt">📄 Download .txt file</button>
            <button type="button" role="menuitem" data-act="link">🔗 Copy share link</button>
          </div>
        </div>
      </div>
    </div>`;
  const vp = $('.viewport', container);
  const zfit = $('.zfit', container);
  const view = new ArtView(vp, { maxFont, onZoom: z => { zfit.textContent = Math.abs(z - 1) < 0.01 ? 'Fit' : Math.round(z * 100) + '%'; } });
  const dims = $('.dims', container);
  const menu = $('.menu', container), moreBtn = $('[data-act=more]', container);

  const paintSwatches = () => $$('.sw', container).forEach(b => {
    const on = b.dataset.theme === getTheme().id;
    b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
  });
  paintSwatches();
  onThemeChange(paintSwatches);
  $$('.sw', container).forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme)));
  $$('.zoom button', container).forEach(b => b.addEventListener('click', () => {
    const z = b.dataset.z;
    view.setZoom(z === 'fit' ? 1 : z === '+' ? view.zoom * 1.25 : view.zoom / 1.25);
  }));

  const closeMenu = () => { menu.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); };
  document.addEventListener('click', e => { if (!e.target.closest('.menu-wrap') || !container.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  const api = {
    view,
    art: null,
    set(art) {
      api.art = art && art.text && art.text.trim() ? art : null;
      view.set(api.art);
      if (api.art) {
        const { cols, rows } = artSize(api.art.text);
        dims.textContent = `${cols} × ${rows}`;
      } else dims.textContent = '';
      container.classList.toggle('empty', !api.art);
    },
  };

  container.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b || !container.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'more') {
      const open = menu.hidden;
      menu.hidden = !open;
      moreBtn.setAttribute('aria-expanded', open);
      return;
    }
    closeMenu();
    const art = api.art;
    if (!art) { toast('Make some art first!'); return; }
    const meta = getSave ? await getSave() : {};
    const title = meta.title || 'ascii-art';
    if (act === 'copy') {
      if (await copyText(art.text)) { toast('Copied! Paste it anywhere ✨'); pop(b); }
      else toast('Could not copy. Try selecting the art.');
    } else if (act === 'chat') {
      if (await copyText('```\n' + art.text + '\n```')) toast('Copied in a code block for Discord, Slack & co.');
    } else if (act === 'save') {
      if (saveHandler) { await saveHandler({ ...art, ...meta, kind, theme: getTheme().id }); pop(b); }
    } else if (act === 'png') {
      await downloadPng(art, title); toast('Picture downloaded 🖼️');
    } else if (act === 'copyimg') {
      if (await copyImage(art)) toast('Picture copied to clipboard 🖼️');
      else { await downloadPng(art, title); toast('Your browser can\'t copy pictures, so it was downloaded instead.'); }
    } else if (act === 'txt') {
      downloadTxt(art, title); toast('Text file downloaded 📄');
    } else if (act === 'link') {
      const url = await makeShareLink(art, title);
      if (url.length > 60000) { toast('This art is too big for a link. Try a smaller width, or share the picture.'); return; }
      if (await copyText(url)) toast('Share link copied 🔗 The art lives inside the link.');
    }
  });
  outputs.push(api);
  return api;
}
