// A small FIGlet driver: reads .flf font files and renders text as ASCII art.
// Follows the FIGfont 2 spec for horizontal layout (full width, fitting and
// smushing with all six controlled rules plus universal smushing).

const SM_EQUAL = 1, SM_LOWLINE = 2, SM_HIERARCHY = 4, SM_PAIR = 8, SM_BIGX = 16,
  SM_HARDBLANK = 32, SM_KERN = 64, SM_SMUSH = 128;

const GERMAN = [196, 214, 220, 228, 246, 252, 223];

function stripEnd(line) {
  let s = line.replace(/\s+$/, '');
  if (!s.length) return s;
  const end = s[s.length - 1];
  let k = s.length - 1;
  while (k >= 0 && s[k] === end) k--;
  return s.slice(0, k + 1);
}

function parseCode(tok) {
  let neg = false;
  if (tok[0] === '-') { neg = true; tok = tok.slice(1); }
  let n;
  if (/^0x/i.test(tok)) n = parseInt(tok.slice(2), 16);
  else if (tok.length > 1 && tok[0] === '0') n = parseInt(tok, 8);
  else n = parseInt(tok, 10);
  return neg ? -n : n;
}

export function parseFont(data) {
  const lines = data.split(/\r\n|\r|\n/);
  const header = lines[0].trim().split(/\s+/);
  if (!/^[ft]lf2/.test(header[0] || '')) throw new Error('Not a FIGlet font');
  const hardblank = header[0].charAt(5) || '$';
  const height = parseInt(header[1], 10);
  const oldLayout = parseInt(header[4], 10);
  const commentLines = parseInt(header[5], 10) || 0;
  const printDir = header.length > 6 ? parseInt(header[6], 10) || 0 : 0;
  const fullLayout = header.length > 7 ? parseInt(header[7], 10) : NaN;

  let smush;
  if (!isNaN(fullLayout)) smush = fullLayout & 255;
  else if (oldLayout < 0) smush = 0;
  else if (oldLayout === 0) smush = SM_KERN;
  else smush = (oldLayout & 63) | SM_SMUSH;

  const chars = new Map();
  let idx = 1 + commentLines;
  const readChar = () => {
    if (idx + height > lines.length) return null;
    const rows = [];
    for (let i = 0; i < height; i++) rows.push(stripEnd(lines[idx++]));
    const w = Math.max(...rows.map(r => r.length));
    return rows.map(r => r.padEnd(w, ' '));
  };
  const codes = [];
  for (let c = 32; c <= 126; c++) codes.push(c);
  codes.push(...GERMAN);
  for (const c of codes) {
    const rows = readChar();
    if (!rows) break;
    chars.set(c, rows);
  }
  while (idx < lines.length) {
    const tag = lines[idx++].trim();
    if (!tag) continue;
    const code = parseCode(tag.split(/\s+/)[0]);
    if (isNaN(code)) break;
    const rows = readChar();
    if (!rows) break;
    if (code >= 0 && !chars.has(code)) chars.set(code, rows);
  }
  return { hardblank, height, smush, printDir, chars };
}

function smushem(l, r, mode, hb, prevW, curW) {
  if (l === ' ') return r;
  if (r === ' ') return l;
  if (prevW < 2 || curW < 2) return null;
  if ((mode & SM_SMUSH) === 0) return null;
  if ((mode & 63) === 0) {
    if (l === hb) return r;
    if (r === hb) return l;
    return r;
  }
  if (mode & SM_HARDBLANK && l === hb && r === hb) return l;
  if (l === hb || r === hb) return null;
  if (mode & SM_EQUAL && l === r) return l;
  if (mode & SM_LOWLINE) {
    if (l === '_' && '|/\\[]{}()<>'.includes(r)) return r;
    if (r === '_' && '|/\\[]{}()<>'.includes(l)) return l;
  }
  if (mode & SM_HIERARCHY) {
    const classes = ['|', '/\\', '[]', '{}', '()', '<>'];
    const cl = classes.findIndex(c => c.includes(l));
    const cr = classes.findIndex(c => c.includes(r));
    if (cl >= 0 && cr >= 0 && cl !== cr) return cl > cr ? l : r;
  }
  if (mode & SM_PAIR) {
    const p = l + r;
    if (p === '[]' || p === '][' || p === '{}' || p === '}{' || p === '()' || p === ')(') return '|';
  }
  if (mode & SM_BIGX) {
    if (l === '/' && r === '\\') return '|';
    if (l === '\\' && r === '/') return 'Y';
    if (l === '>' && r === '<') return 'X';
  }
  return null;
}

function smushAmount(out, ch, mode, hb, prevW, curW) {
  if ((mode & (SM_SMUSH | SM_KERN)) === 0) return 0;
  let max = curW;
  for (let row = 0; row < out.length; row++) {
    const line = out[row], cr = ch[row];
    let lb = line.length, c1;
    for (;; lb--) {
      c1 = line[lb];
      if (!(lb > 0 && (c1 === undefined || c1 === ' '))) break;
    }
    let cb = 0;
    while (cr[cb] === ' ') cb++;
    const c2 = cr[cb];
    let amt = cb + line.length - 1 - lb;
    if (c1 === undefined || c1 === ' ') amt++;
    else if (c2 !== undefined && smushem(c1, c2, mode, hb, prevW, curW) !== null) amt++;
    if (amt < max) max = amt;
  }
  return Math.max(0, max);
}

function renderLine(font, text, mode) {
  const out = new Array(font.height).fill('');
  let prevW = 0;
  const glyphs = [];
  for (const chr of text) {
    let g = font.chars.get(chr.codePointAt(0));
    if (!g) g = font.chars.get(63); // '?'
    if (g) glyphs.push(g);
  }
  if (font.printDir === 1) glyphs.reverse();
  for (const g of glyphs) {
    const curW = g[0].length;
    const amt = smushAmount(out, g, mode, font.hardblank, prevW, curW);
    for (let row = 0; row < font.height; row++) {
      const line = out[row], cr = g[row], L = line.length;
      let mid = '';
      for (let k = 0; k < amt; k++) {
        const pos = L - amt + k;
        if (pos < 0) continue;
        const s = smushem(line[pos], cr[k], mode, font.hardblank, prevW, curW);
        mid += s === null ? (cr[k] === ' ' ? line[pos] : cr[k]) : s;
      }
      out[row] = line.slice(0, Math.max(0, L - amt)) + mid + cr.slice(amt);
    }
    prevW = curW;
  }
  return out;
}

const LAYOUTS = {
  full: 0,
  fitted: SM_KERN,
  smush: SM_SMUSH | SM_KERN,
};

function blockWidth(rows) {
  let w = 0;
  for (const r of rows) if (r.length > w) w = r.length;
  return w;
}

/**
 * Render text with a parsed font.
 * opts.layout: 'default' | 'full' | 'fitted' | 'smush'
 * opts.width: wrap width in columns (0 = no wrapping)
 * opts.align: 'left' | 'center' | 'right'
 * Returns an array of strings (rows).
 */
export function renderText(font, text, opts = {}) {
  const mode = opts.layout in LAYOUTS ? LAYOUTS[opts.layout] : font.smush;
  const width = opts.width || 0;
  const hb = font.hardblank;
  const clean = rows => rows.map(r => r.split(hb).join(' '));
  const lineW = s => blockWidth(renderLine(font, s, mode));
  const blocks = [];

  for (const para of String(text).replace(/\t/g, '    ').split('\n')) {
    if (!para.trim()) { blocks.push(new Array(font.height).fill('')); continue; }
    const pieces = [];
    if (width > 0) {
      let cur = '';
      for (const word of para.split(' ')) {
        const cand = cur ? cur + ' ' + word : word;
        if (!cur || lineW(cand) <= width) { cur = cand; continue; }
        pieces.push(cur);
        cur = word;
      }
      if (cur) pieces.push(cur);
      // break words that are still too wide on their own
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if ([...p].length > 1 && lineW(p) > width) {
          const chars = [...p];
          let a = '', parts = [];
          for (const c of chars) {
            if (a && lineW(a + c) > width) { parts.push(a); a = c; } else a += c;
          }
          if (a) parts.push(a);
          pieces.splice(i, 1, ...parts);
          i += parts.length - 1;
        }
      }
    } else pieces.push(para);
    for (const p of pieces) blocks.push(clean(renderLine(font, p.trim() || p, mode)));
  }

  // align blocks
  const align = opts.align || 'left';
  const trimmed = blocks.map(b => b.map(r => r.replace(/\s+$/, '')));
  // strip common left indentation of each block
  const stripped = trimmed.map(b => {
    let ind = Infinity;
    for (const r of b) if (r.trim()) ind = Math.min(ind, r.length - r.trimStart().length);
    if (!isFinite(ind) || ind === 0) return b;
    return b.map(r => r.slice(ind));
  });
  const W = Math.max(0, ...stripped.map(blockWidth));
  let rows = [];
  for (const b of stripped) {
    const bw = blockWidth(b);
    const pad = align === 'center' ? Math.floor((W - bw) / 2) : align === 'right' ? W - bw : 0;
    for (const r of b) rows.push(r ? ' '.repeat(pad) + r : '');
  }
  // remove blank rows at the top and bottom
  while (rows.length && !rows[0].trim()) rows.shift();
  while (rows.length && !rows[rows.length - 1].trim()) rows.pop();
  return rows;
}
