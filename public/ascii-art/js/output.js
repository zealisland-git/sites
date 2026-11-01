// Showing, exporting and sharing ASCII art.
import { ART_FONT, LH, charWidthFor, fontMetrics } from './engine.js';

export const THEMES = {
  paper: { name: 'Paper', bg: '#fffdf7', ink: '#2d2640', dark: false },
  night: { name: 'Night', bg: '#1c1930', ink: '#f3efff', dark: true },
  bubblegum: { name: 'Bubblegum', bg: '#ffeef6', ink: '#9c2a63', dark: false },
  terminal: { name: 'Terminal', bg: '#0c1a14', ink: '#6bf5a8', dark: true },
};

export const COLOR_MODES = [
  { id: 'ink', label: 'Plain' },
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'candy', label: 'Candy' },
  { id: 'mint', label: 'Mint' },
  { id: 'original', label: 'Real colors' },
];

const GRADIENTS = {
  rainbow: { light: ['#e8436b', '#f08a24', '#d9a400', '#2f9e44', '#1c7ed6', '#7048e8'], dark: ['#ff6b8b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'] },
  sunset: { light: ['#d6336c', '#f76707', '#e8a400'], dark: ['#ff8fab', '#ffa94d', '#ffe066'] },
  ocean: { light: ['#0b7285', '#1971c2', '#5f3dc4'], dark: ['#66d9e8', '#74c0fc', '#b197fc'] },
  candy: { light: ['#d6336c', '#ae3ec9', '#4263eb'], dark: ['#faa2c1', '#e599f7', '#91a7ff'] },
  mint: { light: ['#2b8a3e', '#0ca678', '#1098ad'], dark: ['#8ce99a', '#63e6be', '#66d9e8'] },
};
const GRAD_ANGLE = 100;

export function gradientStops(mode, theme) {
  const g = GRADIENTS[mode];
  return g ? g[theme.dark ? 'dark' : 'light'] : null;
}
export function swatchCss(mode) {
  if (mode === 'ink') return 'linear-gradient(135deg,#3a3350,#8a80a8)';
  if (mode === 'original') return 'conic-gradient(#ff6b6b,#feca57,#48dbfb,#ff9ff3,#ff6b6b)';
  return `linear-gradient(135deg,${GRADIENTS[mode].light.join(',')})`;
}

let themeId = 'paper';
try { themeId = localStorage.getItem('aas-theme') || 'paper'; } catch { /* storage blocked */ }
if (!THEMES[themeId]) themeId = 'paper';
const themeListeners = new Set();
export function getTheme() { return { id: themeId, ...THEMES[themeId] }; }
export function setTheme(id) {
  if (!THEMES[id] || id === themeId) return;
  themeId = id;
  try { localStorage.setItem('aas-theme', id); } catch { /* ignore */ }
  themeListeners.forEach(fn => fn(getTheme()));
}
export function onThemeChange(fn) { themeListeners.add(fn); }

// keep per-char colours readable on the chosen background
function readable(hex3, dark) {
  let r = parseInt(hex3[0], 16) * 17, g = parseInt(hex3[1], 16) * 17, b = parseInt(hex3[2], 16) * 17;
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (dark && l < 0.42) { const t = (0.42 - l) / 0.42 * 0.75 + 0.15; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
  if (!dark && l > 0.62) { const t = (l - 0.62) / 0.38 * 0.6 + 0.12; r *= 1 - t; g *= 1 - t; b *= 1 - t; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function artSize(text) {
  const lines = text.split('\n');
  let cols = 0;
  for (const l of lines) cols = Math.max(cols, l.length);
  return { cols, rows: lines.length, lines };
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}

function coloredHtml(art, theme) {
  const { lines } = artSize(art.text);
  const cols = art.cols;
  let html = '';
  const cache = new Map();
  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    let cur = null, buf = '';
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      if (ch === ' ' || ch === '⠀') { buf += ch; continue; }
      const hex = art.colors.substr((y * cols + x) * 3, 3);
      if (hex !== cur) {
        if (buf) html += cur ? `<span style="color:${cache.get(cur)}">${escapeHtml(buf)}</span>` : escapeHtml(buf);
        buf = '';
        cur = hex;
        if (!cache.has(hex)) cache.set(hex, readable(hex, theme.dark));
      }
      buf += ch;
    }
    if (buf) html += cur ? `<span style="color:${cache.get(cur)}">${escapeHtml(buf)}</span>` : escapeHtml(buf);
    if (y < lines.length - 1) html += '\n';
  }
  return html;
}

/** Fill a <pre> with art in the current theme. */
export function paintPre(pre, art, theme = getTheme()) {
  pre.style.color = theme.ink;
  pre.style.backgroundImage = '';
  pre.classList.remove('grad');
  if (art.color === 'original' && art.colors) {
    pre.innerHTML = coloredHtml(art, theme);
  } else {
    pre.textContent = art.text;
    const stops = gradientStops(art.color, theme);
    if (stops) {
      pre.classList.add('grad');
      pre.style.backgroundImage = `linear-gradient(${GRAD_ANGLE}deg, ${stops.join(', ')})`;
    }
  }
}

/** Font size (px) that fits `art` inside a w x h box. */
export function fitFontSize(text, w, h, max = 26) {
  const { cols, rows } = artSize(text);
  const cw = charWidthFor(text);
  const f = Math.min(w / Math.max(1, cols * cw), h / Math.max(1, rows * LH), max);
  return Math.max(1, Math.floor(f * 100) / 100);
}

export class ArtView {
  constructor(viewport, { maxFont = 26, onZoom } = {}) {
    this.vp = viewport;
    this.pre = document.createElement('pre');
    this.pre.className = 'art';
    this.pre.setAttribute('aria-label', 'ASCII art preview');
    this.vp.appendChild(this.pre);
    this.zoom = 1; // multiplier on the fitted size
    this.maxFont = maxFont;
    this.onZoom = onZoom;
    this.art = null;
    new ResizeObserver(() => this.fit()).observe(this.vp);
    onThemeChange(() => this.paint());
  }
  set(art) {
    this.art = art && art.text ? art : null;
    this.vp.classList.toggle('has-art', !!this.art);
    this.paint();
  }
  paint() {
    const theme = getTheme();
    this.vp.style.background = theme.bg;
    this.vp.style.color = theme.ink;
    this.vp.classList.toggle('dark-bg', theme.dark);
    if (!this.art) { this.pre.textContent = ''; return; }
    paintPre(this.pre, this.art, theme);
    this.fit();
  }
  setZoom(z) {
    this.zoom = Math.min(8, Math.max(0.25, z));
    this.fit();
    this.onZoom && this.onZoom(this.zoom);
  }
  fit() {
    if (!this.art) return;
    const cs = getComputedStyle(this.vp);
    const w = this.vp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
    const maxH = parseFloat(cs.maxHeight) || window.innerHeight * 0.7;
    const h = maxH - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
    if (w <= 0) return;
    const f = fitFontSize(this.art.text, w, h, this.maxFont) * this.zoom;
    this.pre.style.fontSize = f + 'px';
    this.vp.classList.toggle('zoomed', this.zoom > 1.001);
  }
}

// ---------------------------------------------------------------- export
export function renderCanvas(art, theme = getTheme(), { fontPx = 20, pad = 28, maxDim = 6000 } = {}) {
  const { cols, rows, lines } = artSize(art.text);
  const cw = charWidthFor(art.text);
  let f = fontPx;
  const need = Math.max(cols * cw * f + pad * 2, rows * LH * f + pad * 2);
  if (need > maxDim) f = f * maxDim / need;
  const W = Math.ceil(cols * cw * f + pad * 2), H = Math.ceil(rows * LH * f + pad * 2);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.font = `${f}px ${ART_FONT}`;
  ctx.textBaseline = 'alphabetic';
  const m = fontMetrics('M');
  const base = (LH * f - (m.asc + m.desc) * f) / 2 + m.asc * f;
  const stops = gradientStops(art.color, theme);
  if (stops) {
    const aw = cols * cw * f, ah = rows * LH * f;
    const a = GRAD_ANGLE * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
    const len = Math.abs(aw * dx) + Math.abs(ah * dy);
    const cx = pad + aw / 2, cy = pad + ah / 2;
    const g = ctx.createLinearGradient(cx - dx * len / 2, cy - dy * len / 2, cx + dx * len / 2, cy + dy * len / 2);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    ctx.fillStyle = g;
  } else ctx.fillStyle = theme.ink;
  const colored = art.color === 'original' && art.colors;
  const cache = new Map();
  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      if (ch === ' ' || ch === '⠀') continue;
      if (colored) {
        const hex = art.colors.substr((y * art.cols + x) * 3, 3);
        if (!cache.has(hex)) cache.set(hex, readable(hex, theme.dark));
        ctx.fillStyle = cache.get(hex);
      }
      ctx.fillText(ch, pad + x * cw * f, pad + y * LH * f + base);
    }
  }
  return c;
}

export function slug(s) {
  return (s || 'ascii-art').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'ascii-art';
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export function downloadPng(art, title) {
  return new Promise(res => renderCanvas(art).toBlob(b => { download(b, slug(title) + '.png'); res(); }, 'image/png'));
}
export function downloadTxt(art, title) {
  download(new Blob([art.text + '\n'], { type: 'text/plain;charset=utf-8' }), slug(title) + '.txt');
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

export async function copyImage(art) {
  if (!window.ClipboardItem || !navigator.clipboard?.write) return false;
  try {
    const blob = new Promise(res => renderCanvas(art).toBlob(res, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch { return false; }
}

// ---------------------------------------------------------------- share links
function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function pipe(bytes, stream) {
  const res = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(res);
}

export async function makeShareLink(art, title) {
  const payload = { v: 1, t: art.text, c: art.color === 'original' ? 'ink' : art.color, n: (title || '').slice(0, 60) };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  let code;
  if (window.CompressionStream) code = 'z' + b64url(await pipe(json, new CompressionStream('deflate-raw')));
  else code = 'j' + b64url(json);
  const url = new URL(location.href);
  url.hash = 'art=' + code;
  return url.toString();
}

export async function readShareLink(hash) {
  const m = /art=([zj])([A-Za-z0-9_-]+)/.exec(hash || '');
  if (!m) return null;
  try {
    let bytes = unb64url(m[2]);
    if (m[1] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof p.t !== 'string') return null;
    const { cols, rows } = artSize(p.t);
    return { text: p.t, color: COLOR_MODES.some(c => c.id === p.c) ? p.c : 'ink', cols, rows, title: String(p.n || 'Shared art') };
  } catch { return null; }
}
