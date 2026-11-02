// Checks the math content before publishing:
//  1. Every template reproduces its worked example exactly (question text, answer,
//     the three wrong answers, and the solution sentence), using public/brain-blast/formula.js.
//  2. Every template makes good problems at random: no failures, valid answers, five
//     different answer choices, and the right answer spread over A to E.
//
//   node tools/brain-blast/check-content.mjs path/to/content.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContent } from './import-content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '../../public/brain-blast');
globalThis.window = undefined;
(0, eval)(fs.readFileSync(path.join(pub, 'formula.js'), 'utf8'));
const F = globalThis.BBFormula;
const { subs, examples } = parseContent(fs.readFileSync(process.argv[2], 'utf8'));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SAMPLES = +(process.argv[3] || 300);

let okEx = 0, badEx = 0, warn = 0;
const problems = [];
const positions = [0, 0, 0, 0, 0];
const t0 = Date.now();
for (const s of Object.values(subs)) for (const t of s.templates) {
  // ---- 1. reproduce the worked example ----
  const ex = examples[t.id];
  if (!ex) { problems.push(`${t.id}: no worked example`); badEx++; continue; }
  const names = [];
  const re = new RegExp('^' + esc(t.q).replace(/\\\{([A-Za-z_][A-Za-z0-9_]*)\\\}/g, (m, k) => { names.push(k); return '(.+?)'; }) + '$');
  const m = re.exec(ex.q);
  let found = null;
  if (m) {
    const fixed = {}; let okFix = true;
    names.forEach((k, i) => { if (t.vars.some(v => v.n === k)) { if (!/^-?\d+$/.test(m[i + 1]) || (fixed[k] != null && fixed[k] !== +m[i + 1])) okFix = false; fixed[k] = +m[i + 1]; } });
    const hidden = t.vars.filter(v => fixed[v.n] == null);
    const domain = v => { if (v.list) return v.list; const o = []; for (let x = v.lo; x <= v.hi; x += v.step) o.push(x); return o; };
    const doms = hidden.map(domain), total = doms.reduce((a, d) => a * d.length, 1);
    if (okFix && total <= 5e6) {
      const idx = doms.map(() => 0);
      for (let n = 0; n < total && !found; n++) {
        const vals = { ...fixed }; hidden.forEach((v, i) => { vals[v.n] = doms[i][idx[i]]; });
        for (let i = 0; i < idx.length; i++) { idx[i]++; if (idx[i] < doms[i].length) break; idx[i] = 0; }
        const inst = F.instance(t, vals);
        if (inst && F.fill(t.q, inst.env, inst.ans, t.type) === ex.q) found = inst;
      }
    }
  }
  if (!found) { problems.push(`${t.id}: could not reproduce the example question: ${ex.q}`); badEx++; }
  else {
    const ans = F.answerText(found.ans, t.type), wrong = found.wrong.map(w => F.answerText(w.v, t.type)), why = F.fill(t.sol, found.env, found.ans, t.type);
    const errs = [];
    if (ans !== ex.answer) errs.push(`answer ${ans} vs ${ex.answer}`);
    if (wrong.join('|') !== ex.wrong.join('|')) errs.push(`wrong ${wrong.join(', ')} vs ${ex.wrong.join(', ')}`);
    if (why !== ex.why) errs.push(`solution "${why}" vs "${ex.why}"`);
    if (errs.length) { problems.push(`${t.id}: ${errs.join('; ')}`); badEx++; } else okEx++;
  }
  // ---- 2. random problems ----
  let fails = 0, tries = 0, dupWrong = 0, nonInt = 0, slow = 0;
  for (let k = 0; k < SAMPLES; k++) {
    const a = Date.now(), inst = F.instance(t);
    if (Date.now() - a > 60) slow++;
    if (!inst) { fails++; continue; }
    tries += inst.tries;
    if (t.type === 'integer' && inst.ans.d !== 1n) nonInt++;
    const texts = new Set(inst.wrong.map(w => F.answerText(w.v, t.type))); texts.delete(F.answerText(inst.ans, t.type)); if (texts.size < 3) dupWrong++;
    const ch = F.choices(t, inst); if (new Set(ch.map(c => c.text)).size !== 5) { problems.push(`${t.id}: only ${new Set(ch.map(c => c.text)).size} different choices`); }
    positions[ch.findIndex(c => c.ok)]++;
  }
  if (fails) { problems.push(`${t.id}: ${fails}/${SAMPLES} random tries found no valid values`); warn++; }
  if (nonInt) { problems.push(`${t.id}: integer answer was a fraction ${nonInt} times`); warn++; }
  if (slow) { problems.push(`${t.id}: slow to generate (${slow} times over 60 ms, ${(tries / Math.max(1, SAMPLES - fails)).toFixed(0)} tries on average)`); warn++; }
  if (dupWrong > SAMPLES * 0.3) { problems.push(`note ${t.id}: a mistake answer equals the right answer or another mistake in ${Math.round(100 * dupWrong / SAMPLES)}% of problems (filled with a near number)`); }
}
console.log(`Worked examples reproduced exactly: ${okEx}/${okEx + badEx}`);
console.log(`Right answer position A-E over ${positions.reduce((a, b) => a + b, 0)} random problems: ${positions.map(p => (100 * p / positions.reduce((a, b) => a + b, 0)).toFixed(0) + '%').join(' ')}`);
console.log(`Problems / notes (${problems.length}):`); for (const p of problems) console.log('  ' + p);
console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(badEx || warn ? 1 : 0);
