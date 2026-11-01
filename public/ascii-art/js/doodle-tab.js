// "Doodle" tab: a drawing pad that turns into ASCII art while you draw.
import { convert, STYLES } from './engine.js';
import { createOutput, chipGroup, slider, toast, $, $$, el } from './ui.js';
import { COLOR_MODES, swatchCss } from './output.js';

const W = 800, H = 600;
const PALETTE = ['#2d2640', '#6c6683', '#b9b3c9', '#ff5c8a', '#ff9f43', '#ffd23f', '#3ccf91', '#3fa7ff', '#9b6bff', '#8b5a3c'];
const DEFAULTS = { style: 'smart', cols: 80, color: 'original', customChars: '★', customPattern: false, tool: 'pen', size: 8, ink: PALETTE[0], mirror: false };

export function initDoodleTab() {
  const root = $('#tab-doodle');
  let state = { ...DEFAULTS };
  try { Object.assign(state, JSON.parse(localStorage.getItem('aas-doodle') || '{}')); } catch { /* ignore */ }
  const persist = () => { try { localStorage.setItem('aas-doodle', JSON.stringify(state)); } catch { /* ignore */ } };

  const canvas = $('#dCanvas'), overlay = $('#dOverlay'), wrap = $('#dWrap'), cursor = $('#dCursor');
  canvas.width = overlay.width = W; canvas.height = overlay.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const octx = overlay.getContext('2d');
  let srcKey = 0, doodleCount = 1, dirty = false;
  try { doodleCount = +(localStorage.getItem('aas-doodle-n') || 1); } catch { /* ignore */ }

  const out = createOutput($('[data-output=doodle]', root), {
    kind: 'doodle',
    emptyHtml: '<pre class="ph-art">   _\n  / )  draw on the pad,\n / /   your ASCII art\n(_/    appears here</pre>',
    getSave: () => ({ title: 'Doodle ' + doodleCount, settings: { style: state.style, cols: state.cols, color: state.color, customChars: state.customChars, customPattern: state.customPattern }, source: canvas.toDataURL('image/png') }),
  });
  setSaveCounter();
  function setSaveCounter() {
    const btn = $('[data-act=save]', root);
    btn.addEventListener('click', () => setTimeout(() => {
      if (!out.art) return;
      doodleCount++;
      try { localStorage.setItem('aas-doodle-n', doodleCount); } catch { /* ignore */ }
    }, 50));
  }

  // ---- ascii rendering
  let raf = 0;
  function render() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      srcKey++;
      const r = convert(canvas, {
        style: state.style, cols: state.cols, subject: 'dark', invert: false, autoLevels: false,
        brightness: 0, contrast: 0, detail: state.style === 'lines' ? 0.6 : 0, crisp: 0.6, dither: 'auto',
        customChars: state.customChars, customPattern: state.customPattern, lineSource: 'ink',
        wantColors: state.color === 'original', srcKey,
      });
      const blank = !r || !r.text.replace(/[\s⠀]/g, '');
      out.set(blank ? null : { ...r, color: state.color });
    });
  }

  // ---- history (compressed snapshots)
  let hist = [], hi = -1;
  function snapshot() {
    hist.splice(hi + 1);
    hist.push(new Promise(res => canvas.toBlob(res, 'image/png')));
    hi = hist.length - 1;
    if (hist.length > 50) { hist.shift(); hi--; }
    syncUndo();
    saveLater();
  }
  async function restore(i) {
    const blob = await hist[i];
    if (!blob) return;
    const bmp = await createImageBitmap(blob);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bmp, 0, 0);
    render(); syncUndo(); saveLater();
  }
  function syncUndo() {
    $('#dUndo').disabled = hi <= 0;
    $('#dRedo').disabled = hi >= hist.length - 1;
  }
  const undo = () => { if (hi > 0) restore(--hi); };
  const redo = () => { if (hi < hist.length - 1) restore(++hi); };
  let saveT = 0;
  function saveLater() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem('aas-doodle-img', canvas.toDataURL('image/png')); } catch { /* full or blocked */ } }, 800);
  }
  function blank() { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }

  // ---- drawing
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  };
  const mir = p => ({ x: W - p.x, y: p.y });
  let drawing = false, start = null, last = null, pid = null;

  function strokeSeg(c, a, b, size, color) {
    c.strokeStyle = color; c.lineWidth = size; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  }
  function shape(c, tool, a, b, size, color) {
    c.strokeStyle = color; c.lineWidth = size; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    if (tool === 'line') { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
    else if (tool === 'rect') c.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    else if (tool === 'ellipse') c.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2 || 0.5, Math.abs(b.y - a.y) / 2 || 0.5, 0, 0, Math.PI * 2);
    c.stroke();
  }
  const colorNow = () => (state.tool === 'eraser' ? '#ffffff' : state.ink);
  const sizeFor = e => {
    const s = state.tool === 'eraser' ? state.size * 2 : state.size;
    return e.pointerType === 'pen' && e.pressure > 0 ? s * (0.35 + e.pressure * 1.1) : s;
  };

  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pid = e.pointerId;
    const p = pos(e);
    if (state.tool === 'fill') {
      flood(p);
      if (state.mirror) flood(mir(p));
      snapshot(); render();
      return;
    }
    drawing = true; start = last = p;
    if (state.tool === 'pen' || state.tool === 'eraser') {
      strokeSeg(ctx, p, p, sizeFor(e), colorNow());
      if (state.mirror) strokeSeg(ctx, mir(p), mir(p), sizeFor(e), colorNow());
      render();
    }
  });
  canvas.addEventListener('pointermove', e => {
    moveCursor(e);
    if (!drawing || e.pointerId !== pid) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (state.tool === 'pen' || state.tool === 'eraser') {
      for (const ev of (evs.length ? evs : [e])) {
        const p = pos(ev);
        strokeSeg(ctx, last, p, sizeFor(ev), colorNow());
        if (state.mirror) strokeSeg(ctx, mir(last), mir(p), sizeFor(ev), colorNow());
        last = p;
      }
    } else {
      last = pos(e);
      octx.clearRect(0, 0, W, H);
      shape(octx, state.tool, start, last, state.size, state.ink);
      if (state.mirror) shape(octx, state.tool, mir(start), mir(last), state.size, state.ink);
    }
    render();
  });
  const end = e => {
    if (!drawing || (e && e.pointerId !== pid)) return;
    drawing = false;
    if (state.tool !== 'pen' && state.tool !== 'eraser') {
      octx.clearRect(0, 0, W, H);
      shape(ctx, state.tool, start, last, state.size, state.ink);
      if (state.mirror) shape(ctx, state.tool, mir(start), mir(last), state.size, state.ink);
    }
    snapshot(); render();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { cursor.style.opacity = 0; });
  canvas.addEventListener('pointerenter', () => { cursor.style.opacity = 1; });

  function moveCursor(e) {
    if (e.pointerType !== 'mouse') { cursor.style.opacity = 0; return; }
    const r = canvas.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    const scale = r.width / W;
    const s = Math.max(6, (state.tool === 'eraser' ? state.size * 2 : state.size) * scale);
    const isShape = state.tool === 'fill';
    cursor.style.width = cursor.style.height = (isShape ? 18 : s) + 'px';
    cursor.style.transform = `translate(${e.clientX - wr.left}px, ${e.clientY - wr.top}px) translate(-50%, -50%)`;
    cursor.style.opacity = 1;
    cursor.classList.toggle('fill', isShape);
  }

  // scanline flood fill
  function flood(p) {
    const x0 = Math.floor(p.x), y0 = Math.floor(p.y);
    if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    const i0 = (y0 * W + x0) * 4;
    const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    const hex = state.ink.replace('#', '');
    const fr = parseInt(hex.slice(0, 2), 16), fg = parseInt(hex.slice(2, 4), 16), fb = parseInt(hex.slice(4, 6), 16);
    if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 8) return;
    const tol = 90;
    const match = i => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) <= tol;
    const seen = new Uint8Array(W * H);
    const stack = [[x0, y0]];
    while (stack.length) {
      let [x, y] = stack.pop();
      while (x > 0 && !seen[y * W + x - 1] && match((y * W + x - 1) * 4)) x--;
      let up = false, down = false;
      for (; x < W; x++) {
        const k = y * W + x;
        if (seen[k] || !match(k * 4)) break;
        seen[k] = 1;
        d[k * 4] = fr; d[k * 4 + 1] = fg; d[k * 4 + 2] = fb; d[k * 4 + 3] = 255;
        if (y > 0) { const u = k - W; const ok = !seen[u] && match(u * 4); if (ok && !up) { stack.push([x, y - 1]); up = true; } else if (!ok) up = false; }
        if (y < H - 1) { const dn = k + W; const ok = !seen[dn] && match(dn * 4); if (ok && !down) { stack.push([x, y + 1]); down = true; } else if (!ok) down = false; }
      }
    }
    // grow the fill by one pixel so it tucks under anti-aliased edges
    const grown = Uint8Array.from(seen);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const k = y * W + x;
      if (seen[k]) continue;
      if (seen[k - 1] || seen[k + 1] || seen[k - W] || seen[k + W]) grown[k] = 1;
    }
    for (let k = 0; k < W * H; k++) if (grown[k] && !seen[k]) {
      const i = k * 4, a = 0.55;
      d[i] = d[i] * (1 - a) + fr * a; d[i + 1] = d[i + 1] * (1 - a) + fg * a; d[i + 2] = d[i + 2] * (1 - a) + fb * a;
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---- toolbar
  const TOOLS = [
    { id: 'pen', icon: '✏️', label: 'Pen' },
    { id: 'eraser', icon: '🧽', label: 'Eraser' },
    { id: 'line', icon: '📏', label: 'Line' },
    { id: 'rect', icon: '⬜', label: 'Box' },
    { id: 'ellipse', icon: '⚪', label: 'Circle' },
    { id: 'fill', icon: '🪣', label: 'Fill' },
  ];
  const tools = chipGroup($('#dTools'), TOOLS.map(t => ({ id: t.id, title: t.label, aria: t.label, html: `<span class="ticon" aria-hidden="true">${t.icon}</span><span class="tlabel">${t.label}</span>` })),
    state.tool, v => { state.tool = v; persist(); }, { cls: 'tool' });
  const sizeDot = $('#dSizeDot');
  const size = slider($('#dSize'), null, v => v, v => { state.size = v; persist(); paintSizeDot(); });
  const paintSizeDot = () => { const s = Math.max(4, Math.min(30, state.size * 0.6)); sizeDot.style.width = sizeDot.style.height = s + 'px'; sizeDot.style.background = state.ink; };
  size.set(state.size);
  const colors = chipGroup($('#dColors'), PALETTE.map(c => ({ id: c, aria: 'Color ' + c, title: c, html: `<i style="background:${c}"></i>` })),
    state.ink, v => { state.ink = v; if (state.tool === 'eraser') state.tool = 'pen'; tools.set(state.tool); persist(); paintSizeDot(); }, { cls: 'paint' });
  paintSizeDot();
  const mirrorBtn = $('#dMirror');
  const syncMirror = () => { mirrorBtn.classList.toggle('on', state.mirror); mirrorBtn.setAttribute('aria-pressed', state.mirror); $('#dMirrorLine').hidden = !state.mirror; };
  mirrorBtn.addEventListener('click', () => { state.mirror = !state.mirror; persist(); syncMirror(); toast(state.mirror ? 'Mirror on: both sides draw together 🦋' : 'Mirror off'); });
  syncMirror();
  $('#dUndo').addEventListener('click', undo);
  $('#dRedo').addEventListener('click', redo);
  $('#dClear').addEventListener('click', () => {
    blank(); snapshot(); render();
    toast('Fresh page!', { action: 'Undo', onAction: undo });
  });
  document.addEventListener('keydown', e => {
    if (!root.classList.contains('active') || e.target.closest('input, textarea')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); }
  });

  // ---- ascii options
  const style = chipGroup($('#dStyle'), STYLES.map(s => ({ id: s.id, title: s.tip, html: `<span aria-hidden="true">${s.icon}</span> ${s.label}` })),
    state.style, v => { state.style = v; persist(); syncCustom(); render(); });
  const width = slider($('#dWidth'), $('#dWidthOut'), v => v + ' letters wide', v => { state.cols = v; persist(); render(); });
  width.set(state.cols);
  const colorItems = COLOR_MODES.map(c => ({ id: c.id, title: c.label, aria: c.label, html: `<i class="dot" style="background:${swatchCss(c.id)}"></i><span>${c.id === 'original' ? 'My colors' : c.label}</span>` }));
  const color = chipGroup($('#dColor'), colorItems, state.color, v => { state.color = v; persist(); render(); });
  const chars = $('#dChars'), pattern = $('#dPattern');
  chars.value = state.customChars; pattern.checked = state.customPattern;
  chars.addEventListener('input', () => { state.customChars = chars.value; persist(); render(); });
  pattern.addEventListener('change', () => { state.customPattern = pattern.checked; persist(); render(); });
  const syncCustom = () => { $('#dCustomRow').hidden = state.style !== 'custom'; };
  syncCustom();

  // ---- start: restore the last doodle or show a friendly starter
  function starter() {
    blank();
    ctx.strokeStyle = PALETTE[0]; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // a little cat face to show how it works
    ctx.beginPath(); ctx.arc(400, 330, 150, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(285, 235); ctx.lineTo(300, 110); ctx.lineTo(370, 185); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(515, 235); ctx.lineTo(500, 110); ctx.lineTo(430, 185); ctx.stroke();
    ctx.fillStyle = PALETTE[0];
    ctx.beginPath(); ctx.arc(345, 310, 16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(455, 310, 16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(385, 355); ctx.lineTo(415, 355); ctx.lineTo(400, 372); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(400, 372); ctx.quadraticCurveTo(385, 405, 360, 395); ctx.moveTo(400, 372); ctx.quadraticCurveTo(415, 405, 440, 395); ctx.stroke();
    ctx.lineWidth = 6;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(400 + s * 70, 360); ctx.lineTo(400 + s * 190, 340);
      ctx.moveTo(400 + s * 70, 380); ctx.lineTo(400 + s * 190, 390); ctx.stroke();
    }
  }
  function loadImageTo(url) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => { blank(); ctx.drawImage(img, 0, 0, W, H); res(true); };
      img.onerror = () => res(false);
      img.src = url;
    });
  }
  (async () => {
    let saved = null;
    try { saved = localStorage.getItem('aas-doodle-img'); } catch { /* ignore */ }
    if (!(saved && await loadImageTo(saved))) starter();
    snapshot(); render();
  })();

  return {
    async apply(settings, source) {
      Object.assign(state, settings || {});
      persist();
      style.set(state.style); width.set(state.cols); color.set(state.color);
      chars.value = state.customChars; pattern.checked = state.customPattern; syncCustom();
      if (source) await loadImageTo(source);
      snapshot(); render();
    },
    refresh() { render(); },
  };
}
