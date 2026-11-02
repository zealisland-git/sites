// Image -> ASCII art engine.
// Every style samples the picture on a sub-cell grid, turns it into "ink"
// (how much each spot should be drawn), then picks characters.
// The characters are measured from the real font so the tones are accurate.

export const ART_FONT = '"AAS Mono", ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';
export const LH = 1.1; // line-height used everywhere art is shown or exported

export const STYLES = [
  { id: 'smart', label: 'Smart', icon: '✨', sub: [3, 4], tip: 'Picks the character whose shape matches best. Sharp outlines.' },
  { id: 'classic', label: 'Classic', icon: '☕', sub: [2, 2], tip: 'The timeless  .:-=+*#%@  look.' },
  { id: 'detailed', label: 'Detailed', icon: '🔍', sub: [2, 2], tip: '70 characters for smooth shading.' },
  { id: 'braille', label: 'Dots', icon: '⣿', sub: [2, 4], tip: 'Tiny braille dots: the highest resolution.' },
  { id: 'blocks', label: 'Shades', icon: '▓', sub: [2, 2], tip: 'Soft shading blocks  ░▒▓█' },
  { id: 'pixels', label: 'Pixels', icon: '▚', sub: [2, 2], tip: 'Chunky pixel-art blocks.' },
  { id: 'lines', label: 'Sketch', icon: '✏️', sub: [2, 3], tip: 'Outlines drawn with  | / - \\ _' },
  { id: 'custom', label: 'My chars', icon: '💬', sub: [2, 2], tip: 'Draw with your own characters or a word.' },
];
const STYLE_MAP = Object.fromEntries(STYLES.map(s => [s.id, s]));

const ASCII95 = [];
for (let c = 32; c < 127; c++) ASCII95.push(String.fromCharCode(c));
const RAMPS = {
  classic: [...' .:-=+*#%@'],
  detailed: [...' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'],
  blocks: [...' ░▒▓█'],
};
const QUADS = [' ', '▘', '▝', '▀', '▖', '▌', '▞', '▛', '▗', '▚', '▐', '▜', '▄', '▙', '▟', '█'];

// ---------------------------------------------------------------- metrics
const mctx = document.createElement('canvas').getContext('2d');
const metricsCache = new Map();
const glyphCache = new Map();

export function fontMetrics(sample = 'M') {
  if (metricsCache.has(sample)) return metricsCache.get(sample);
  mctx.font = `100px ${ART_FONT}`;
  const m = mctx.measureText(sample);
  const asc = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || 80;
  const desc = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent || 20;
  const res = { cw: (m.width || 60) / 100, asc: asc / 100, desc: desc / 100 };
  metricsCache.set(sample, res);
  return res;
}

// Art made only of braille dots keeps its own (consistent) width; anything else uses the
// normal cell width, because off-grid characters are put into one-cell slots.
export function isAllBraille(text) {
  return /[⠀-⣿]/.test(text) && !/[^\s⠀-⣿]/.test(text);
}
export function charWidthFor(text) {
  return fontMetrics(isAllBraille(text) ? '⣿' : 'M').cw;
}

// True if this character is drawn narrower or wider than one cell (it came from a
// fallback font). Such characters are wrapped in a one-cell slot when shown.
const offGridCache = new Map();
export function isOffGrid(ch) {
  if (ch.charCodeAt(0) < 128) return false;
  let v = offGridCache.get(ch);
  if (v === undefined) {
    mctx.font = `100px ${ART_FONT}`;
    v = Math.abs(mctx.measureText(ch).width - fontMetrics('M').cw * 100) > 0.5;
    offGridCache.set(ch, v);
  }
  return v;
}

export function resetMetrics() {
  metricsCache.clear();
  offGridCache.clear();
  glyphCache.clear();
  sampleCache.clear();
}

// Measure how much ink each character puts in each region of a gx x gy grid.
function analyze(chars, gx = 2, gy = 3) {
  const key = chars.join('') + '|' + gx + 'x' + gy;
  if (glyphCache.has(key)) return glyphCache.get(key);
  const S = 48;
  const m = fontMetrics('M');
  const w = Math.max(6, Math.round(m.cw * S)), h = Math.round(LH * S);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.font = `${S}px ${ART_FONT}`;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  const base = (h - (m.asc + m.desc) * S) / 2 + m.asc * S;
  const out = [];
  const R = gx * gy;
  for (const ch of chars) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillText(ch, 0, base);
    const d = ctx.getImageData(0, 0, w, h).data;
    const reg = new Array(R).fill(0), regN = new Array(R).fill(0);
    let total = 0;
    for (let y = 0; y < h; y++) {
      const ry = Math.min(gy - 1, (y * gy / h) | 0);
      for (let x = 0; x < w; x++) {
        const a = d[(y * w + x) * 4 + 3] / 255;
        const r = ry * gx + Math.min(gx - 1, (x * gx / w) | 0);
        reg[r] += a; regN[r]++; total += a;
      }
    }
    out.push({ ch, cov: total / (w * h), vec: reg.map((v, i) => v / regN[i]) });
  }
  glyphCache.set(key, out);
  return out;
}

function buildRamp(chars) {
  const key = 'ramp:' + chars.join('');
  if (glyphCache.has(key)) return glyphCache.get(key);
  const g = analyze(chars);
  let min = Infinity, max = -Infinity;
  for (const x of g) { min = Math.min(min, x.cov); max = Math.max(max, x.cov); }
  const items = g.map(x => ({ ch: x.ch, v: (x.cov - min) / (max - min || 1) })).sort((a, b) => a.v - b.v);
  const ramp = [];
  for (const it of items) if (!ramp.length || it.v - ramp[ramp.length - 1].v > 0.004) ramp.push(it);
  const res = { chars: ramp.map(r => r.ch), levels: Float32Array.from(ramp.map(r => r.v)) };
  glyphCache.set(key, res);
  return res;
}

function smartGlyphs(gx, gy) {
  const key = 'smart|' + gx + 'x' + gy;
  if (glyphCache.has(key)) return glyphCache.get(key);
  const g = analyze(ASCII95, gx, gy);
  let M = 0, C = 0;
  for (const x of g) { C = Math.max(C, x.cov); for (const v of x.vec) M = Math.max(M, v); }
  const res = { chars: g.map(x => x.ch), vecs: g.map(x => Float32Array.from(x.vec, v => v / M)), tone: g.map(x => x.cov / C), letter: g.map(x => /[A-Za-z0-9]/.test(x.ch) ? 1 : 0) };
  glyphCache.set(key, res);
  return res;
}

// ---------------------------------------------------------------- sampling
const work = document.createElement('canvas');
const wctx = work.getContext('2d', { willReadFrequently: true });
const sampleCache = new Map();

function sample(src, gw, gh, srcKey) {
  const key = `${srcKey}|${gw}x${gh}`;
  if (srcKey != null && sampleCache.has(key)) return sampleCache.get(key);
  const k = Math.max(1, Math.min(4, Math.floor(Math.min(src.width / gw, src.height / gh))));
  const W = gw * k, H = gh * k;
  work.width = W; work.height = H;
  wctx.imageSmoothingEnabled = true;
  wctx.imageSmoothingQuality = 'high';
  wctx.clearRect(0, 0, W, H);
  wctx.drawImage(src, 0, 0, W, H);
  const d = wctx.getImageData(0, 0, W, H).data;
  const n = gw * gh;
  const sa = new Float32Array(n), sr = new Float32Array(n), sg = new Float32Array(n), sb = new Float32Array(n);
  for (let y = 0; y < H; y++) {
    const row = ((y / k) | 0) * gw;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, a = d[i + 3];
      if (!a) continue;
      const gi = row + ((x / k) | 0);
      sa[gi] += a; sr[gi] += d[i] * a; sg[gi] += d[i + 1] * a; sb[gi] += d[i + 2] * a;
    }
  }
  const lum = new Float32Array(n), alpha = new Float32Array(n), rgb = new Uint8ClampedArray(n * 3);
  const full = k * k * 255;
  for (let i = 0; i < n; i++) {
    if (sa[i] > 0) {
      const r = sr[i] / sa[i], g = sg[i] / sa[i], b = sb[i] / sa[i];
      rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
      lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      alpha[i] = sa[i] / full;
    } else {
      lum[i] = 1; rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = 255;
    }
  }
  const res = { gw, gh, lum, alpha, rgb };
  if (srcKey != null) {
    if (sampleCache.size > 24) sampleCache.delete(sampleCache.keys().next().value);
    sampleCache.set(key, res);
  }
  return res;
}

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

function computeInk(S, o) {
  const n = S.lum.length;
  const ink = new Float32Array(n);
  let lo = 0, hi = 1;
  if (o.autoLevels) {
    const hist = new Uint32Array(256);
    let cnt = 0;
    for (let i = 0; i < n; i++) if (S.alpha[i] > 0.5) { hist[Math.min(255, (S.lum[i] * 255) | 0)]++; cnt++; }
    if (cnt > 16) {
      const pct = p => { let acc = 0; const t = cnt * p; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= t) return i / 255; } return 1; };
      // gentle: only stretch a squashed range, never push mid tones to pure white/black
      const a = Math.min(pct(0.01), 0.14), b = Math.max(pct(0.99), 0.86);
      if (b - a > 0.1) { lo = a; hi = b; }
    }
  }
  const c = o.contrast || 0;
  const cf = c >= 0 ? 1 + c * 2 : 1 + c;
  const br = (o.brightness || 0) * 0.6;
  const darkSubject = (o.subject !== 'light') !== !!o.invert;
  const span = hi - lo || 1;
  for (let i = 0; i < n; i++) {
    let l = (S.lum[i] - lo) / span;
    l = clamp01((l - 0.5) * cf + 0.5 + br);
    ink[i] = (darkSubject ? 1 - l : l) * S.alpha[i];
  }
  return ink;
}

function sharpen(src, w, h, amt) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    const y0 = y > 0 ? y - 1 : y, y1 = y < h - 1 ? y + 1 : y;
    for (let x = 0; x < w; x++) {
      const x0 = x > 0 ? x - 1 : x, x1 = x < w - 1 ? x + 1 : x;
      const blur = (src[y0 * w + x0] + src[y0 * w + x] + src[y0 * w + x1] +
        src[y * w + x0] + src[y * w + x] + src[y * w + x1] +
        src[y1 * w + x0] + src[y1 * w + x] + src[y1 * w + x1]) / 9;
      const v = src[y * w + x];
      out[y * w + x] = clamp01(v + amt * (v - blur));
    }
  }
  return out;
}

// Colour-aware edge strength (Sobel on R, G and B), so outlines show even
// between colours of similar brightness. Transparent areas count as background.
function addOutlines(ink, S, w, h, amt, bg) {
  const n = w * h;
  const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    const a = S.alpha[i];
    for (let k = 0; k < 3; k++) ch[k][i] = (S.rgb[i * 3 + k] * a + bg * (1 - a)) / 255;
  }
  const out = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const y0 = (y > 0 ? y - 1 : y) * w, y1 = (y < h - 1 ? y + 1 : y) * w, yc = y * w;
    for (let x = 0; x < w; x++) {
      const x0 = x > 0 ? x - 1 : x, x1 = x < w - 1 ? x + 1 : x;
      let m = 0;
      for (let k = 0; k < 3; k++) {
        const c = ch[k];
        const gx = c[y0 + x1] + 2 * c[yc + x1] + c[y1 + x1] - c[y0 + x0] - 2 * c[yc + x0] - c[y1 + x0];
        const gy = c[y1 + x0] + 2 * c[y1 + x] + c[y1 + x1] - c[y0 + x0] - 2 * c[y0 + x] - c[y0 + x1];
        m += gx * gx + gy * gy;
      }
      const e = Math.min(1, Math.sqrt(m) / 2.6);
      out[yc + x] = clamp01(ink[yc + x] + amt * e);
    }
  }
  return out;
}

// average sub-cells into one value per cell
function cellAverage(ink, cols, rows, sx, sy) {
  const out = new Float32Array(cols * rows), gw = cols * sx, n = sx * sy;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let s = 0;
    for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) s += ink[(cy * sy + j) * gw + cx * sx + i];
    out[cy * cols + cx] = s / n;
  }
  return out;
}

// ---------------------------------------------------------------- dithering
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

function nearestLevel(levels, v) {
  let lo = 0, hi = levels.length - 1;
  if (v <= levels[0]) return 0;
  if (v >= levels[hi]) return hi;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (levels[mid] <= v) lo = mid; else hi = mid; }
  return v - levels[lo] < levels[hi] - v ? lo : hi;
}

function quantize(vals, w, h, levels, mode) {
  const out = new Int16Array(w * h);
  if (mode === 'none' || levels.length < 2) {
    for (let i = 0; i < vals.length; i++) out[i] = nearestLevel(levels, vals[i]);
    return out;
  }
  if (mode === 'ordered') {
    const step = 1 / (levels.length - 1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      out[i] = nearestLevel(levels, vals[i] + (BAYER[(y & 3) * 4 + (x & 3)] - 0.5) * step);
    }
    return out;
  }
  const buf = Float32Array.from(vals);
  const put = (x, y, e) => { if (x >= 0 && x < w && y < h) buf[y * w + x] += e; };
  for (let y = 0; y < h; y++) {
    const rev = mode === 'fs' && (y & 1);
    for (let k = 0; k < w; k++) {
      const x = rev ? w - 1 - k : k, i = y * w + x;
      const q = nearestLevel(levels, buf[i]);
      out[i] = q;
      const err = buf[i] - levels[q];
      if (mode === 'fs') {
        const d = rev ? -1 : 1;
        put(x + d, y, err * 7 / 16); put(x - d, y + 1, err * 3 / 16);
        put(x, y + 1, err * 5 / 16); put(x + d, y + 1, err / 16);
      } else { // atkinson
        const e = err / 8;
        put(x + 1, y, e); put(x + 2, y, e); put(x - 1, y + 1, e);
        put(x, y + 1, e); put(x + 1, y + 1, e); put(x, y + 2, e);
      }
    }
  }
  return out;
}

const BINARY = Float32Array.from([0, 1]);
const TONE_W = 0.6, LETTER_PENALTY = 0.01;

// ---------------------------------------------------------------- styles
function styleRamp(ink, cols, rows, o, ramp) {
  const cells = cellAverage(ink, cols, rows, 2, 2);
  for (let i = 0; i < cells.length; i++) if (cells[i] < 0.03) cells[i] = 0;
  const q = quantize(cells, cols, rows, ramp.levels, o.dither);
  const lines = [];
  for (let y = 0; y < rows; y++) {
    let s = '';
    for (let x = 0; x < cols; x++) s += ramp.chars[q[y * cols + x]];
    lines.push(s);
  }
  return lines;
}

function styleSmart(ink, cols, rows, o, gx, gy) {
  const G = smartGlyphs(gx, gy);
  const R = gx * gy, gw = cols * gx;
  const e = 1 + (o.crisp ?? 0.5) * 2.5;
  const cache = new Map();
  const q = new Float32Array(R);
  const toneW = o.toneW ?? TONE_W, pen = o.letterPenalty ?? LETTER_PENALTY;
  const lines = [];
  for (let cy = 0; cy < rows; cy++) {
    let s = '';
    for (let cx = 0; cx < cols; cx++) {
      let mx = 0, mean = 0;
      for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
        const v = ink[(cy * gy + j) * gw + cx * gx + i];
        q[j * gx + i] = v; mean += v; if (v > mx) mx = v;
      }
      mean /= R;
      if (mx < 0.03) { s += ' '; continue; }
      let key = 0;
      for (let r = 0; r < R; r++) {
        if (e !== 1) q[r] = mx * Math.pow(q[r] / mx, e);
        key = key * 8 + Math.min(7, (q[r] * 8) | 0);
      }
      key = key * 8 + Math.min(7, (mean * 8) | 0);
      let ch = cache.get(key);
      if (ch === undefined) {
        let best = 0, bd = Infinity;
        for (let g = 0; g < G.vecs.length; g++) {
          const v = G.vecs[g];
          let d = 0;
          for (let r = 0; r < R; r++) { const t = q[r] - v[r]; d += t * t; }
          const t = (mean - G.tone[g]) * toneW;
          d = d / R + t * t + pen * G.letter[g];
          if (d < bd) { bd = d; best = g; }
        }
        ch = G.chars[best];
        cache.set(key, ch);
      }
      s += ch;
    }
    lines.push(s);
  }
  return lines;
}

function styleBraille(ink, cols, rows, o) {
  const gw = cols * 2, gh = rows * 4;
  const b = quantize(ink, gw, gh, BINARY, o.dither);
  const BIT = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]];
  const lines = [];
  for (let cy = 0; cy < rows; cy++) {
    let s = '';
    for (let cx = 0; cx < cols; cx++) {
      let code = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++)
        if (b[(cy * 4 + j) * gw + cx * 2 + i]) code |= BIT[j][i];
      s += String.fromCharCode(0x2800 + code);
    }
    lines.push(s);
  }
  return lines;
}

function stylePixels(ink, cols, rows, o) {
  const gw = cols * 2, gh = rows * 2;
  const b = quantize(ink, gw, gh, BINARY, o.dither);
  const lines = [];
  for (let cy = 0; cy < rows; cy++) {
    let s = '';
    for (let cx = 0; cx < cols; cx++) {
      const i0 = (cy * 2) * gw + cx * 2, i1 = i0 + gw;
      s += QUADS[b[i0] | (b[i0 + 1] << 1) | (b[i1] << 2) | (b[i1 + 1] << 3)];
    }
    lines.push(s);
  }
  return lines;
}

function styleLines(ink, cols, rows, o) {
  const gw = cols * 2, gh = rows * 3;
  const at = (x, y) => ink[Math.min(gh - 1, Math.max(0, y)) * gw + Math.min(gw - 1, Math.max(0, x))];
  if (o.lineSource === 'ink') return inkLines(ink, cols, rows, at);
  const n = cols * rows;
  const E = new Float32Array(n), A = new Float32Array(n), Low = new Uint8Array(n);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let sxx = 0, syy = 0, sxy = 0, top = 0, bot = 0;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) {
      const x = cx * 2 + i, y = cy * 3 + j;
      const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      sxx += gx * gx; syy += gy * gy; sxy += gx * gy;
      const m = gx * gx + gy * gy;
      if (j === 2) bot += m; else if (j === 0) top += m;
    }
    const i = cy * cols + cx;
    E[i] = Math.sqrt(sxx + syy);
    let ang = 0.5 * Math.atan2(2 * sxy, sxx - syy) * 180 / Math.PI; // gradient direction
    if (ang < 0) ang += 180;
    A[i] = ang;
    Low[i] = bot > top * 1.6 ? 1 : 0;
  }
  // reference level = 97th percentile of edge strength
  const sorted = Float32Array.from(E).sort();
  const ref = sorted[Math.floor(sorted.length * 0.97)] || 1;
  const thr = ref * (0.62 - 0.55 * (o.detail ?? 0.5));
  const lines = [];
  for (let cy = 0; cy < rows; cy++) {
    let s = '';
    for (let cx = 0; cx < cols; cx++) {
      const i = cy * cols + cx, e = E[i];
      if (e < thr || e < 0.05) { s += ' '; continue; }
      const a = A[i];
      // non-maximum suppression along the gradient
      let dx, dy;
      if (a < 22.5 || a >= 157.5) { dx = 1; dy = 0; } else if (a < 67.5) { dx = 1; dy = 1; } else if (a < 112.5) { dx = 0; dy = 1; } else { dx = -1; dy = 1; }
      const n1 = (cx + dx >= 0 && cx + dx < cols && cy + dy >= 0 && cy + dy < rows) ? E[(cy + dy) * cols + cx + dx] : 0;
      const n2 = (cx - dx >= 0 && cx - dx < cols && cy - dy >= 0 && cy - dy < rows) ? E[(cy - dy) * cols + cx - dx] : 0;
      if (e < n1 * 0.92 || e < n2 * 0.92) { s += ' '; continue; }
      s += lineChar(a, Low[i], false);
    }
    lines.push(s);
  }
  return lines;
}

// Character for a line, from the gradient angle (0-180, y down). Bins are
// tuned for tall monospace cells, where "/" is drawn at roughly 60 degrees.
function lineChar(a, low, high) {
  if (a < 20 || a >= 160) return '|';
  if (a < 65) return '/';
  if (a < 115) return low ? '_' : high ? '"' : '-';
  return '\\';
}
function normalStep(a) {
  if (a < 22.5 || a >= 157.5) return [1, 0];
  if (a < 67.5) return [1, 1];
  if (a < 112.5) return [0, 1];
  return [-1, 1];
}

// For drawings: follow the strokes themselves (not their two edges).
function inkLines(ink, cols, rows, at) {
  const n = cols * rows;
  const A = new Float32Array(n), MX = new Float32Array(n), ANG = new Float32Array(n), KIND = new Uint8Array(n), POS = new Int8Array(n);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const i = cy * cols + cx;
    let mx = 0, sum = 0, top = 0, bot = 0;
    for (let j = 0; j < 3; j++) for (let k = 0; k < 2; k++) {
      const v = at(cx * 2 + k, cy * 3 + j);
      sum += v; if (v > mx) mx = v;
      if (j === 0) top += v; else if (j === 2) bot += v;
    }
    A[i] = sum / 6; MX[i] = mx;
    POS[i] = bot > top * 1.5 ? 1 : top > bot * 1.5 ? -1 : 0;
    if (mx < 0.3 || A[i] < 0.1) continue;
    let sxx = 0, syy = 0, sxy = 0;
    for (let y = cy * 3 - 1; y <= cy * 3 + 3; y++) for (let x = cx * 2 - 1; x <= cx * 2 + 2; x++) {
      const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      sxx += gx * gx; syy += gy * gy; sxy += gx * gy;
    }
    const tr = sxx + syy;
    const coh = tr > 1e-6 ? Math.sqrt((sxx - syy) * (sxx - syy) + 4 * sxy * sxy) / tr : 0;
    if (A[i] > 0.8 || tr < 0.05) KIND[i] = 3; // solid
    else if (coh < 0.3) KIND[i] = 2; // corner / blob
    else {
      KIND[i] = 1;
      let a = 0.5 * Math.atan2(2 * sxy, sxx - syy) * 180 / Math.PI;
      ANG[i] = a < 0 ? a + 180 : a;
    }
  }
  const get = (x, y) => (x >= 0 && x < cols && y >= 0 && y < rows ? A[y * cols + x] : 0);
  const lines = [];
  for (let cy = 0; cy < rows; cy++) {
    let s = '';
    for (let cx = 0; cx < cols; cx++) {
      const i = cy * cols + cx, k = KIND[i];
      if (!k) { s += ' '; continue; }
      if (k === 3) { s += A[i] > 0.55 ? '#' : '*'; continue; }
      if (k === 2) { s += A[i] > 0.5 ? '@' : '+'; continue; }
      // keep only the middle of the stroke (thin it to one character)
      const [dx, dy] = normalStep(ANG[i]);
      const a1 = get(cx + dx, cy + dy), a2 = get(cx - dx, cy - dy);
      if (A[i] < a1 * 0.9 || A[i] < a2 * 0.9 || (A[i] < a1 * 1.02 && a1 >= a2 && KIND[(cy + dy) * cols + cx + dx] === 1 && (dx > 0 || dy > 0))) { s += ' '; continue; }
      s += lineChar(ANG[i], POS[i] > 0, POS[i] < 0);
    }
    lines.push(s);
  }
  return lines;
}

function styleCustom(ink, cols, rows, o) {
  let chars = Array.from(o.customChars || '').filter(c => c.trim());
  if (!chars.length) chars = ['#'];
  const cells = cellAverage(ink, cols, rows, 2, 2);
  const lines = [];
  if (o.customPattern || chars.length === 1) {
    const b = quantize(cells, cols, rows, BINARY, o.dither);
    let k = 0;
    for (let y = 0; y < rows; y++) {
      let s = '';
      for (let x = 0; x < cols; x++) s += b[y * cols + x] ? chars[k++ % chars.length] : ' ';
      lines.push(s);
    }
    return lines;
  }
  const all = [' ', ...chars];
  const levels = Float32Array.from(all.map((_, i) => i / (all.length - 1)));
  const q = quantize(cells, cols, rows, levels, o.dither);
  for (let y = 0; y < rows; y++) {
    let s = '';
    for (let x = 0; x < cols; x++) s += all[q[y * cols + x]];
    lines.push(s);
  }
  return lines;
}

const HEX = '0123456789abcdef';
function cellColors(S, ink, cols, rows, sx, sy) {
  const gw = cols * sx;
  const parts = new Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let r = 0, g = 0, b = 0, wsum = 0;
    for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) {
      const gi = (cy * sy + j) * gw + cx * sx + i;
      const w = ink[gi] + 0.02;
      r += S.rgb[gi * 3] * w; g += S.rgb[gi * 3 + 1] * w; b += S.rgb[gi * 3 + 2] * w; wsum += w;
    }
    parts[cy * cols + cx] = HEX[(r / wsum) >> 4] + HEX[(g / wsum) >> 4] + HEX[(b / wsum) >> 4];
  }
  return parts.join('');
}

export function defaultDither(style) {
  return style === 'braille' || style === 'pixels' ? 'atkinson' : 'none';
}

/**
 * Convert a canvas/image to ASCII art.
 * o: { style, cols, subject:'dark'|'light', invert, autoLevels, brightness, contrast,
 *      detail, crisp, dither:'auto'|'none'|'fs'|'atkinson'|'ordered', customChars, customPattern,
 *      wantColors, srcKey }
 */
export function convert(src, o) {
  if (!src || !src.width || !src.height) return null;
  const st = STYLE_MAP[o.style] || STYLE_MAP.smart;
  const cw = fontMetrics(st.id === 'braille' ? '⣿' : 'M').cw;
  const aspect = cw / LH;
  const cols = Math.max(4, Math.round(o.cols || 80));
  const rows = Math.max(1, Math.round(cols * (src.height / src.width) * aspect));
  const [sx, sy] = o.sub || st.sub;
  const S = sample(src, cols * sx, rows * sy, o.srcKey);
  let ink = computeInk(S, o);
  const opts = { ...o, dither: !o.dither || o.dither === 'auto' ? defaultDither(st.id) : o.dither };
  if (o.detail > 0 && st.id !== 'lines') ink = sharpen(ink, cols * sx, rows * sy, o.detail * 1.6);
  if (o.outline > 0 && st.id !== 'lines') {
    const darkSubject = (o.subject !== 'light') !== !!o.invert;
    ink = addOutlines(ink, S, cols * sx, rows * sy, o.outline, darkSubject ? 255 : 0);
  }
  let lines;
  switch (st.id) {
    case 'smart': lines = styleSmart(ink, cols, rows, opts, sx, sy); break;
    case 'classic': case 'detailed': case 'blocks': lines = styleRamp(ink, cols, rows, opts, buildRamp(RAMPS[st.id])); break;
    case 'braille': lines = styleBraille(ink, cols, rows, opts); break;
    case 'pixels': lines = stylePixels(ink, cols, rows, opts); break;
    case 'lines': lines = styleLines(ink, cols, rows, opts); break;
    case 'custom': lines = styleCustom(ink, cols, rows, opts); break;
  }
  return {
    text: lines.join('\n'),
    cols, rows,
    colors: o.wantColors ? cellColors(S, ink, cols, rows, sx, sy) : null,
  };
}
