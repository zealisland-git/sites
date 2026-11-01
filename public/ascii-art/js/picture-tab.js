// "Picture" tab: photo / camera / sample -> ASCII art.
import { convert, STYLES } from './engine.js';
import { createOutput, chipGroup, slider, toast, $, $$, el } from './ui.js';
import { paintPre, fitFontSize, getTheme, onThemeChange, COLOR_MODES, swatchCss } from './output.js';

const DEFAULTS = {
  style: 'smart', cols: 100, color: 'ink', brightness: 0, contrast: 0.1, detail: 0.25, outline: 0.5, crisp: 0.45,
  dither: 'auto', autoLevels: true, invert: false, customChars: '♥', customPattern: false,
};
const SAMPLES = [
  { id: 'cat', emoji: '🐱', name: 'Kitty' },
  { id: 'fox', emoji: '🦊', name: 'Fox' },
  { id: 'panda', emoji: '🐼', name: 'Panda' },
  { id: 'unicorn', emoji: '🦄', name: 'Unicorn' },
  { id: 'flower', emoji: '🌸', name: 'Blossom' },
  { id: 'berry', emoji: '🍓', name: 'Strawberry' },
  { id: 'ball', emoji: null, name: 'Shiny ball' },
];

export function initPictureTab() {
  const root = $('#tab-picture');
  let state = { ...DEFAULTS };
  try { Object.assign(state, JSON.parse(localStorage.getItem('aas-picture') || '{}')); } catch { /* ignore */ }
  const persist = () => { try { localStorage.setItem('aas-picture', JSON.stringify(state)); } catch { /* ignore */ } };

  const src = document.createElement('canvas');
  let srcKey = 0, hasSource = false, hasAlpha = false, sourceName = 'Picture';

  const out = createOutput($('[data-output=picture]', root), {
    kind: 'picture',
    emptyHtml: '<pre class="ph-art">  _____\n |  o  |   add a picture\n | /_\\ |   to see the magic\n |_____|</pre>',
    getSave: () => ({ title: sourceName, settings: { ...state }, source: sourceData() }),
  });

  function sourceData() {
    if (!hasSource) return null;
    const s = Math.min(1, 720 / Math.max(src.width, src.height));
    const c = document.createElement('canvas');
    c.width = Math.round(src.width * s); c.height = Math.round(src.height * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return hasAlpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86);
  }

  const opts = (extra = {}) => ({
    ...state,
    subject: getTheme().dark ? 'light' : 'dark',
    wantColors: state.color === 'original',
    srcKey,
    ...extra,
  });

  // ---- rendering
  let raf = 0;
  function render() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!hasSource) { out.set(null); return; }
      const r = convert(src, opts());
      out.set(r && { ...r, color: state.color });
    });
  }
  let pvTimer = 0;
  function renderPreviews(delay = 180) {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(() => {
      for (const card of $$('.style-card', root)) {
        const pre = $('pre', card), box = $('.sprev', card);
        if (!hasSource) { pre.textContent = ''; continue; }
        const r = convert(src, opts({ style: card.dataset.id, cols: 34, wantColors: state.color === 'original' }));
        if (!r) continue;
        paintPre(pre, { ...r, color: state.color }, getTheme());
        pre.style.fontSize = fitFontSize(r.text, box.clientWidth - 6, box.clientHeight - 6, 9) + 'px';
        box.style.background = getTheme().bg;
      }
    }, delay);
  }
  const changed = (patch, previews = true) => {
    Object.assign(state, patch);
    persist();
    render();
    if (previews) renderPreviews();
    syncVisibility();
  };

  // ---- source handling
  const drop = $('#pDrop'), loaded = $('#pSource'), live = $('#pLive');
  const thumb = $('#pThumb');
  function showSourceUI(mode) { // 'empty' | 'loaded' | 'live'
    drop.hidden = mode !== 'empty';
    loaded.hidden = mode !== 'loaded';
    live.hidden = mode !== 'live';
    root.classList.toggle('no-source', mode === 'empty');
  }
  function drawThumb() {
    const ctx = thumb.getContext('2d');
    const s = Math.min(thumb.width / src.width, thumb.height / src.height);
    ctx.clearRect(0, 0, thumb.width, thumb.height);
    const w = src.width * s, h = src.height * s;
    ctx.drawImage(src, (thumb.width - w) / 2, (thumb.height - h) / 2, w, h);
  }
  function detectAlpha() {
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0, 48, 48);
    const d = ctx.getImageData(0, 0, 48, 48).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
    return false;
  }
  function setSource(img, name) {
    const MAX = 1600;
    const w = img.naturalWidth || img.videoWidth || img.width, h = img.naturalHeight || img.videoHeight || img.height;
    if (!w || !h) { toast('Hmm, that picture could not be read.'); return; }
    const s = Math.min(1, MAX / Math.max(w, h));
    src.width = Math.max(1, Math.round(w * s)); src.height = Math.max(1, Math.round(h * s));
    const ctx = src.getContext('2d');
    ctx.clearRect(0, 0, src.width, src.height);
    ctx.drawImage(img, 0, 0, src.width, src.height);
    srcKey++;
    hasSource = true;
    hasAlpha = detectAlpha();
    sourceName = name || 'Picture';
    $('#pName').textContent = sourceName;
    $('#pDims').textContent = `${w} × ${h}`;
    drawThumb();
    showSourceUI('loaded');
    render();
    renderPreviews(0);
  }
  function loadUrl(url, name) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => { setSource(img, name); res(true); };
      img.onerror = () => { toast('That file doesn\'t look like a picture.'); res(false); };
      img.src = url;
    });
  }
  async function loadFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)$/i.test(file.name || '')) {
      toast('Please choose a picture file (JPG, PNG, GIF…)');
      return;
    }
    stopCamera(false);
    const url = URL.createObjectURL(file);
    await loadUrl(url, (file.name || 'Picture').replace(/\.[^.]+$/, '').slice(0, 40) || 'Picture');
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function loadSample(s) {
    stopCamera(false);
    const c = document.createElement('canvas');
    c.width = c.height = 640;
    const ctx = c.getContext('2d');
    if (s.emoji) {
      ctx.font = '520px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.emoji, 320, 345);
    } else {
      const g = ctx.createRadialGradient(240, 220, 20, 320, 320, 300);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, '#ffb3d9'); g.addColorStop(0.7, '#9b5de5'); g.addColorStop(1, '#2b1055');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(320, 320, 290, 0, Math.PI * 2); ctx.fill();
    }
    setSource(c, s.name);
  }

  $('#pFile').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
  $$('[data-pick]', root).forEach(b => b.addEventListener('click', () => $('#pFile').click()));
  $('#pClear').addEventListener('click', () => { hasSource = false; showSourceUI('empty'); render(); renderPreviews(0); });
  const sampleBox = $('#pSamples');
  for (const s of SAMPLES) {
    sampleBox.append(el('button', { type: 'button', class: 'sample', title: s.name, 'aria-label': 'Try sample: ' + s.name, onclick: () => loadSample(s) },
      s.emoji || el('i', { class: 'ball', 'aria-hidden': 'true' })));
  }
  // drag & drop on the drop zone (the whole page also accepts drops, see app.js)
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); });

  // ---- camera
  const video = document.createElement('video');
  video.playsInline = true; video.muted = true;
  let stream = null, camLoop = 0, lastFrame = 0, lastPv = 0;
  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { toast('This browser has no camera access.'); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch {
      toast('Camera is blocked. Allow camera access in your browser to use it.');
      return;
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    showSourceUI('live');
    sourceName = 'Camera snap';
    const tick = t => {
      if (!stream) return;
      camLoop = requestAnimationFrame(tick);
      if (t - lastFrame < 70 || !video.videoWidth) return;
      lastFrame = t;
      const w = video.videoWidth, h = video.videoHeight;
      if (src.width !== w || src.height !== h) { src.width = w; src.height = h; }
      const ctx = src.getContext('2d');
      ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, w, h); ctx.restore();
      srcKey++;
      hasSource = true; hasAlpha = false;
      const r = convert(src, opts());
      out.set(r && { ...r, color: state.color });
      if (t - lastPv > 600) { lastPv = t; renderPreviews(0); }
    };
    camLoop = requestAnimationFrame(tick);
  }
  function stopCamera(keep) {
    if (!stream) return;
    cancelAnimationFrame(camLoop);
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    if (keep && hasSource) {
      $('#pName').textContent = sourceName;
      $('#pDims').textContent = `${src.width} × ${src.height}`;
      drawThumb();
      showSourceUI('loaded');
      srcKey++;
      render(); renderPreviews(0);
    } else if (!keep) {
      showSourceUI(hasSource ? 'loaded' : 'empty');
    }
  }
  $$('[data-camera]', root).forEach(b => b.addEventListener('click', startCamera));
  $('#pSnap').addEventListener('click', () => { stopCamera(true); toast('Snap! 📸 Now press ⭐ Save to keep it.'); });
  $('#pStop').addEventListener('click', () => { hasSource = false; stopCamera(false); showSourceUI('empty'); render(); });

  // ---- style cards
  const styleBox = $('#pStyles');
  for (const s of STYLES) {
    const card = el('button', { type: 'button', class: 'style-card', 'data-id': s.id, title: s.tip, 'aria-label': `${s.label} style: ${s.tip}` },
      el('span', { class: 'sprev' }, el('pre', {}), el('span', { class: 'sicon', 'aria-hidden': 'true' }, s.icon)),
      el('span', { class: 'slabel' }, s.label));
    card.addEventListener('click', () => { changed({ style: s.id }, false); markStyle(); });
    styleBox.append(card);
  }
  function markStyle() {
    $$('.style-card', styleBox).forEach(c => { const on = c.dataset.id === state.style; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
    $('#pStyleTip').textContent = STYLES.find(s => s.id === state.style).tip;
  }

  // ---- controls
  const width = slider($('#pWidth'), $('#pWidthOut'), v => v + ' letters wide', v => changed({ cols: v }, false));
  const colorItems = COLOR_MODES.map(c => ({ id: c.id, title: c.label, aria: c.label, html: `<i class="dot" style="background:${swatchCss(c.id)}"></i><span>${c.label}</span>` }));
  const color = chipGroup($('#pColor'), colorItems, state.color, v => changed({ color: v }));
  const pct = v => (v > 0 ? '+' : '') + v;
  const bright = slider($('#pBright'), $('#pBrightOut'), pct, v => changed({ brightness: v / 100 }));
  const contrast = slider($('#pContrast'), $('#pContrastOut'), pct, v => changed({ contrast: v / 100 }));
  const detail = slider($('#pDetail'), $('#pDetailOut'), v => v + '%', v => changed({ detail: v / 100 }));
  const outline = slider($('#pOutline'), $('#pOutlineOut'), v => v + '%', v => changed({ outline: v / 100 }));
  const crisp = slider($('#pCrisp'), $('#pCrispOut'), v => v + '%', v => changed({ crisp: v / 100 }));
  const dither = chipGroup($('#pDither'), [
    { id: 'auto', label: 'Auto' }, { id: 'none', label: 'Off' }, { id: 'fs', label: 'Smooth' }, { id: 'atkinson', label: 'Crisp' }, { id: 'ordered', label: 'Pattern' },
  ], state.dither, v => changed({ dither: v }), { cls: 'seg' });
  const auto = $('#pAuto'), inv = $('#pInvert'), chars = $('#pChars'), pattern = $('#pPattern');
  auto.addEventListener('change', () => changed({ autoLevels: auto.checked }));
  inv.addEventListener('change', () => changed({ invert: inv.checked }));
  chars.addEventListener('input', () => changed({ customChars: chars.value }));
  pattern.addEventListener('change', () => changed({ customPattern: pattern.checked }));
  $('#pReset').addEventListener('click', () => { apply({ ...DEFAULTS, style: state.style, cols: state.cols, color: state.color }); toast('Fine-tuning reset'); });

  function syncControls() {
    width.set(state.cols); color.set(state.color); dither.set(state.dither);
    bright.set(Math.round(state.brightness * 100)); contrast.set(Math.round(state.contrast * 100));
    detail.set(Math.round(state.detail * 100)); outline.set(Math.round(state.outline * 100)); crisp.set(Math.round(state.crisp * 100));
    auto.checked = state.autoLevels; inv.checked = state.invert; chars.value = state.customChars; pattern.checked = state.customPattern;
    markStyle(); syncVisibility();
  }
  function syncVisibility() {
    $('#pCustomRow').hidden = state.style !== 'custom';
    $('#pCrispRow').hidden = state.style !== 'smart';
    $('#pDetailLbl').textContent = state.style === 'lines' ? 'Lines' : 'Detail';
    $('#pOutlineRow').hidden = state.style === 'lines';
  }
  function apply(s) { state = { ...DEFAULTS, ...s }; persist(); syncControls(); render(); renderPreviews(0); }

  onThemeChange(() => { render(); renderPreviews(0); });
  syncControls();
  showSourceUI('empty');

  return {
    loadFile,
    async apply(settings, source, name) {
      apply(settings || {});
      if (source) { await loadUrl(source, name || 'Picture'); }
    },
    leave() { if (stream) stopCamera(true); },
    refresh() { render(); renderPreviews(0); },
  };
}
