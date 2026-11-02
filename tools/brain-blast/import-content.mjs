// Turns the math content file (Markdown: topic tree, problem templates, learning path)
// into public/brain-blast/content.js, which the game loads.
//
//   node tools/brain-blast/import-content.mjs path/to/content.md
//
// Then run the checker before publishing:
//   node tools/brain-blast/check-content.mjs path/to/content.md
//
// The game must not name any contest, so contest names are removed from what we keep,
// and the script stops if one is still left in the output.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BANNED = /\b(amc|ajhsme)\b/i;
const clean = s => s.replace(/\b(the\s+)?amc\s*(8|eight)?\s+/gi, (m, the) => (the ? 'The ' : '')).replace(/\s+/g, ' ').trim();

// split "a; b; c" at top level (not inside backticks or brackets)
function splitTop(s) {
  const out = []; let cur = '', tick = false, depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '`') tick = !tick;
    if (!tick && (c === '(' || c === '[')) depth++;
    if (!tick && (c === ')' || c === ']')) depth--;
    if (!tick && depth === 0 && c === ';' && s[i + 1] === ' ') { out.push(cur.trim()); cur = ''; i++; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const unTick = s => { const m = /^`([^`]*)`$/.exec(s.trim()); if (!m) throw new Error('Expected `formula`, got: ' + s); return m[1]; };

function parseVars(line) {
  const vars = [], rules = [];
  const at = line.indexOf('rules:');
  const declPart = at >= 0 ? line.slice(0, at).replace(/;\s*$/, '') : line;
  for (const d of splitTop(declPart)) {
    if (!d) continue;
    let m = /^(\w+) from (-?\d+) to (-?\d+)(?: in steps of (\d+))?$/.exec(d);
    if (m) { vars.push({ n: m[1], lo: +m[2], hi: +m[3], step: m[4] ? +m[4] : 1 }); continue; }
    m = /^(\w+) one of (.+)$/.exec(d);
    if (m) { vars.push({ n: m[1], list: m[2].split(/,\s*/).map(x => { if (!/^-?\d+$/.test(x)) throw new Error('Non-integer choice: ' + x); return +x; }) }); continue; }
    throw new Error('Cannot read variable: ' + d);
  }
  if (at >= 0) for (const r of splitTop(line.slice(at + 6).trim())) rules.push(unTick(r));
  return { vars, rules };
}
function parseWrong(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const a = s.indexOf('`', i); if (a < 0) break;
    const b = s.indexOf('`', a + 1); const f = s.slice(a + 1, b);
    let j = b + 1; while (s[j] === ' ') j++;
    let why = '';
    if (s[j] === '(') { let depth = 0, k = j; for (; k < s.length; k++) { if (s[k] === '(') depth++; else if (s[k] === ')') { depth--; if (depth === 0) break; } } why = s.slice(j + 1, k); j = k + 1; }
    out.push({ f, why: clean(why) }); i = j;
  }
  return out;
}

export function parseContent(md) {
  const lines = md.split(/\r?\n/);
  const topics = [], subs = {}, path = [], examples = {};
  let topic = null, sub = null, t = null, inMistakes = false;
  for (let li = 0; li < lines.length; li++) {
    const L = lines[li];
    let m;
    if ((m = /^\*\*Chapter (\d+): (.+?)\*\*: (.+)$/.exec(L))) {
      const stages = [...m[3].matchAll(/stage \d+: (\d+\.\d+)/g)].map(x => x[1]);
      const boss = /\*\*Boss: (.+?)\*\*(?: \(review of the chapter, (\d+) questions\))?/.exec(m[3]);
      path.push({ n: +m[1], name: clean(m[2]), subs: stages, boss: boss ? clean(boss[1]) : null, review: boss && boss[2] ? +boss[2] : 10 });
      continue;
    }
    if ((m = /^## Topic (\d+): (.+)$/.exec(L))) { topic = { id: m[1], name: clean(m[2]), subs: [] }; topics.push(topic); sub = null; continue; }
    if ((m = /^### (\d+\.\d+) (.+)$/.exec(L))) { sub = { id: m[1], name: clean(m[2]), topic: topic.id, key: '', mistakes: [], templates: [] }; subs[sub.id] = sub; topic.subs.push(sub.id); inMistakes = false; continue; }
    if (!sub) continue;
    if ((m = /^- \*\*Key idea:\*\* (.+)$/.exec(L))) { sub.key = clean(m[1]); inMistakes = false; continue; }
    if (/^- \*\*Common mistakes:\*\*/.test(L)) { inMistakes = true; continue; }
    if (inMistakes && (m = /^\s+- (.+)$/.exec(L))) { sub.mistakes.push(clean(m[1])); continue; }
    if (/^- \*\*Where it appears/.test(L)) { inMistakes = false; continue; }
    if ((m = /^\*\*Template (\d+\.\d+-\d+)\*\* \(difficulty (\d), about (\d+) s\)/.exec(L))) {
      inMistakes = false; t = { id: m[1], diff: +m[2], secs: +m[3], q: '', vars: [], rules: [], work: [], ans: '', type: '', wrong: [], sol: '' };
      sub.templates.push(t); continue;
    }
    if (!t) continue;
    if ((m = /^> (.+)$/.exec(L))) { t.q = clean(m[1]); continue; }
    if ((m = /^- Variables: (.+)$/.exec(L))) { Object.assign(t, parseVars(m[1])); continue; }
    if ((m = /^- Worked out: (.+)$/.exec(L))) { t.work = splitTop(m[1]).map(unTick).map(w => { const k = w.indexOf('='); return [w.slice(0, k).trim(), w.slice(k + 1).trim()]; }); continue; }
    if ((m = /^- Answer: `(.+)` \((integer|fraction|pi)\)$/.exec(L))) { t.ans = m[1]; t.type = m[2]; continue; }
    if ((m = /^- Wrong answers: (.+)$/.exec(L))) { t.wrong = parseWrong(m[1]); continue; }
    if ((m = /^- Solution: (.+)$/.exec(L))) { t.sol = clean(m[1]); continue; }
    if ((m = /^- Example: \*(.+)\* Answer \*\*(.+?)\*\*; wrong choices (.+?)\. (.+)$/.exec(L))) { examples[t.id] = { q: clean(m[1]), answer: m[2], wrong: m[3].split(/,\s+/), why: clean(m[4]) }; continue; }
  }
  // sanity checks
  for (const s of Object.values(subs)) for (const x of s.templates) {
    for (const k of ['q', 'ans', 'type', 'sol']) if (!x[k]) throw new Error(`Template ${x.id} is missing "${k}"`);
    if (x.wrong.length < 3) throw new Error(`Template ${x.id} has ${x.wrong.length} wrong answers`);
  }
  for (const c of path) for (const id of c.subs) if (!subs[id]) throw new Error(`Learning path uses unknown sub-topic ${id}`);
  return { topics, subs, path, examples };
}

function main() {
  const src = process.argv[2];
  if (!src) { console.error('Usage: node tools/brain-blast/import-content.mjs content.md'); process.exit(1); }
  const { topics, subs, path: learningPath } = parseContent(fs.readFileSync(src, 'utf8'));
  const data = { topics, subs, path: learningPath };
  const json = JSON.stringify(data);
  if (BANNED.test(json)) { const at = json.search(BANNED); throw new Error('A contest name is still in the output: ...' + json.slice(Math.max(0, at - 60), at + 40)); }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const out = path.join(here, '../../public/brain-blast/content.js');
  const nT = Object.values(subs).reduce((a, s) => a + s.templates.length, 0);
  fs.writeFileSync(out, `/* Brain Blast Arena: math content (topics, problem templates, learning path).
   Made by tools/brain-blast/import-content.mjs from the content file. Do not edit by hand:
   fix the content file and run the script again. ${topics.length} topics, ${Object.keys(subs).length} sub-topics, ${nT} templates. */
const BB_CONTENT = ${JSON.stringify(data)};
`);
  console.log(`Wrote ${out}: ${topics.length} topics, ${Object.keys(subs).length} sub-topics, ${nT} templates, ${learningPath.length} chapters, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
