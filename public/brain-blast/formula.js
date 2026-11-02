/* Brain Blast Arena: problem template engine.
   Templates (in content.js) are written in a small Python-like formula language with exact
   fractions. This file parses those formulas, picks random values for a template's variables,
   computes the answer and the "common mistake" wrong answers, and builds 5 answer choices.
   Works in the browser and in Node (for the content checker). */
(function (global) {
  'use strict';

  // ---------- exact rational numbers ----------
  const bgcd = (a, b) => { if (a < 0n) a = -a; if (b < 0n) b = -b; while (b) { const t = a % b; a = b; b = t; } return a; };
  class Fail extends Error {}
  function Q(n, d = 1n) {
    if (d === 0n) throw new Fail('division by zero');
    if (d < 0n) { n = -n; d = -d; }
    if (d !== 1n) { const g = bgcd(n, d); if (g > 1n) { n /= g; d /= g; } }
    return { n, d };
  }
  const ZERO = Q(0n), ONE = Q(1n);
  const qi = v => Q(BigInt(v));
  const bool = b => (b ? ONE : ZERO);
  const isInt = a => a.d === 1n;
  const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
  const sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
  const mul = (a, b) => Q(a.n * b.n, a.d * b.d);
  const div = (a, b) => { if (b.n === 0n) throw new Fail('division by zero'); return Q(a.n * b.d, a.d * b.n); };
  const cmp = (a, b) => { const x = a.n * b.d, y = b.n * a.d; return x < y ? -1 : x > y ? 1 : 0; };
  const floorQ = a => { let q = a.n / a.d; if (a.n % a.d !== 0n && (a.n < 0n) !== (a.d < 0n)) q -= 1n; return Q(q); };
  const ceilQ = a => { const f = floorQ(a); return isInt(a) ? f : Q(f.n + 1n); };
  const mod = (a, b) => { if (b.n === 0n) throw new Fail('modulo by zero'); return sub(a, mul(b, floorQ(div(a, b)))); };
  function pow(a, e) {
    if (!isInt(e)) throw new Fail('fractional power');
    let k = e.n; if (k > 4000n || k < -4000n) throw new Fail('power too big');
    let base = a; if (k < 0n) { base = div(ONE, a); k = -k; }
    let r = ONE; while (k > 0n) { if (k & 1n) r = mul(r, base); base = mul(base, base); k >>= 1n; }
    return r;
  }
  const truthy = a => a.n !== 0n;
  const bigInt = a => { if (!isInt(a)) throw new Fail('needs a whole number'); return a.n; };
  function isqrt(n) { if (n < 0n) throw new Fail('negative root'); if (n < 2n) return n; let x = BigInt(Math.floor(Math.sqrt(Number(n)))); while (x * x > n) x--; while ((x + 1n) * (x + 1n) <= n) x++; return x; }
  function factorize(n) {
    if (n < 1n) throw new Fail('factor of a number below 1');
    const out = []; let m = n;
    for (let p = 2n; p * p <= m; p += (p === 2n ? 1n : 2n)) { let e = 0; while (m % p === 0n) { m /= p; e++; } if (e) out.push([p, e]); }
    if (m > 1n) out.push([m, 1]);
    return out;
  }
  const factB = n => { if (n < 0n) throw new Fail('negative factorial'); if (n > 400n) throw new Fail('factorial too big'); let r = 1n; for (let i = 2n; i <= n; i++) r *= i; return r; };

  const FUNCS = {
    gcd: (...a) => Q(a.map(bigInt).reduce((x, y) => bgcd(x, y), 0n)),
    lcm: (...a) => Q(a.map(bigInt).reduce((x, y) => (x === 0n || y === 0n ? 0n : (x < 0n ? -x : x) / bgcd(x, y) * (y < 0n ? -y : y)), 1n)),
    C: (n, k) => { n = bigInt(n); k = bigInt(k); if (k < 0n || k > n || n < 0n) return ZERO; if (k > n - k) k = n - k; let r = 1n; for (let i = 1n; i <= k; i++) r = r * (n - k + i) / i; return Q(r); },
    P: (n, k) => { n = bigInt(n); k = bigInt(k); if (k < 0n || k > n || n < 0n) return ZERO; let r = 1n; for (let i = 0n; i < k; i++) r *= (n - i); return Q(r); },
    fact: n => Q(factB(bigInt(n))),
    floor: a => floorQ(a),
    ceil: a => ceilQ(a),
    abs: a => (a.n < 0n ? Q(-a.n, a.d) : a),
    min: (...a) => a.reduce((x, y) => (cmp(y, x) < 0 ? y : x)),
    max: (...a) => a.reduce((x, y) => (cmp(y, x) > 0 ? y : x)),
    sqrt: a => { const rn = isqrt(a.n), rd = isqrt(a.d); if (rn * rn !== a.n || rd * rd !== a.d) throw new Fail('not a perfect square'); return Q(rn, rd); },
    digitsum: a => { let n = bigInt(a); if (n < 0n) n = -n; let s = 0n; for (const ch of n.toString()) s += BigInt(ch); return Q(s); },
    numdiv: a => Q(factorize(bigInt(a)).reduce((r, [, e]) => r * BigInt(e + 1), 1n)),
    sumdiv: a => Q(factorize(bigInt(a)).reduce((r, [p, e]) => r * ((p ** BigInt(e + 1) - 1n) / (p - 1n)), 1n)),
    isprime: a => { const n = bigInt(a); if (n < 2n) return ZERO; const f = factorize(n); return bool(f.length === 1 && f[0][1] === 1); },
    vp: (a, p) => { let n = bigInt(a); const q = bigInt(p); if (n === 0n || q < 2n) throw new Fail('vp needs n > 0'); if (n < 0n) n = -n; let e = 0n; while (n % q === 0n) { n /= q; e++; } return Q(e); },
    vfact: (a, p) => { const n = bigInt(a), q = bigInt(p); if (q < 2n) throw new Fail('vfact needs p > 1'); let e = 0n, k = q; while (k <= n) { e += n / k; k *= q; } return Q(e); },
  };

  // ---------- parser (Python-like precedence) ----------
  const TOK = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|\/\/|==|!=|<=|>=|[-+*/%()<>,]))/y;
  function tokenize(src) {
    const out = []; TOK.lastIndex = 0; let m;
    while (TOK.lastIndex < src.length) {
      const at = TOK.lastIndex; m = TOK.exec(src);
      if (!m) { if (/^\s*$/.test(src.slice(at))) break; throw new Error(`Cannot read formula at "${src.slice(at, at + 12)}" in: ${src}`); }
      if (m[1] != null) out.push({ t: 'num', v: m[1] });
      else if (m[2] != null) out.push(['and', 'or', 'not'].includes(m[2]) ? { t: 'op', v: m[2] } : { t: 'name', v: m[2] });
      else out.push({ t: 'op', v: m[3] });
    }
    return out;
  }
  function parse(src) {
    const tk = tokenize(src); let i = 0;
    const peek = () => tk[i], isOp = v => tk[i] && tk[i].t === 'op' && tk[i].v === v;
    const eat = v => { if (!isOp(v)) throw new Error(`Expected "${v}" in: ${src}`); i++; };
    const orE = () => { let a = andE(); while (isOp('or')) { i++; a = ['or', a, andE()]; } return a; };
    const andE = () => { let a = notE(); while (isOp('and')) { i++; a = ['and', a, notE()]; } return a; };
    const notE = () => { if (isOp('not')) { i++; return ['not', notE()]; } return cmpE(); };
    const CMP = ['==', '!=', '<', '<=', '>', '>='];
    const cmpE = () => { const first = addE(), ops = [], xs = [first]; while (peek() && peek().t === 'op' && CMP.includes(peek().v)) { ops.push(tk[i++].v); xs.push(addE()); } return ops.length ? ['cmp', ops, xs] : first; };
    const addE = () => { let a = mulE(); while (isOp('+') || isOp('-')) { const o = tk[i++].v; a = ['bin', o, a, mulE()]; } return a; };
    const mulE = () => { let a = unE(); while (isOp('*') || isOp('/') || isOp('%') || isOp('//')) { const o = tk[i++].v; a = ['bin', o, a, unE()]; } return a; };
    const unE = () => { if (isOp('-')) { i++; return ['neg', unE()]; } if (isOp('+')) { i++; return unE(); } return powE(); };
    const powE = () => { const a = atom(); if (isOp('**')) { i++; return ['bin', '**', a, unE()]; } return a; };
    const atom = () => {
      const t = tk[i]; if (!t) throw new Error(`Formula ended early: ${src}`);
      if (t.t === 'num') { i++; const [w, f = ''] = t.v.split('.'); return ['n', Q(BigInt(w + f), 10n ** BigInt(f.length))]; }
      if (t.t === 'name') {
        i++;
        if (isOp('(')) { i++; const args = []; if (!isOp(')')) { args.push(orE()); while (isOp(',')) { i++; args.push(orE()); } } eat(')'); if (t.v !== 'cond' && !FUNCS[t.v]) throw new Error(`Unknown function ${t.v} in: ${src}`); return ['call', t.v, args]; }
        if (t.v === 'True') return ['n', ONE]; if (t.v === 'False') return ['n', ZERO];
        return ['v', t.v];
      }
      if (isOp('(')) { i++; const e = orE(); eat(')'); return e; }
      throw new Error(`Unexpected "${t.v}" in: ${src}`);
    };
    const e = orE(); if (i !== tk.length) throw new Error(`Extra text in formula: ${src}`);
    return e;
  }
  const cache = new Map();
  const compile = src => { let a = cache.get(src); if (!a) { a = parse(src); cache.set(src, a); } return a; };

  class Missing extends Error { constructor(n) { super('unknown ' + n); this.name_ = n; } }
  function ev(a, env) {
    switch (a[0]) {
      case 'n': return a[1];
      case 'v': { const v = env[a[1]]; if (v === undefined) throw new Missing(a[1]); return v; }
      case 'neg': { const x = ev(a[1], env); return Q(-x.n, x.d); }
      case 'not': return bool(!truthy(ev(a[1], env)));
      case 'and': return truthy(ev(a[1], env)) ? bool(truthy(ev(a[2], env))) : ZERO;
      case 'or': return truthy(ev(a[1], env)) ? ONE : bool(truthy(ev(a[2], env)));
      case 'cmp': {
        let left = ev(a[2][0], env);
        for (let k = 0; k < a[1].length; k++) {
          const right = ev(a[2][k + 1], env), c = cmp(left, right), op = a[1][k];
          const ok = op === '==' ? c === 0 : op === '!=' ? c !== 0 : op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0;
          if (!ok) return ZERO; left = right;
        }
        return ONE;
      }
      case 'bin': {
        const x = ev(a[2], env), y = ev(a[3], env);
        switch (a[1]) { case '+': return add(x, y); case '-': return sub(x, y); case '*': return mul(x, y); case '/': return div(x, y); case '%': return mod(x, y); case '//': return floorQ(div(x, y)); case '**': return pow(x, y); }
        break;
      }
      case 'call': {
        if (a[1] === 'cond') return truthy(ev(a[2][0], env)) ? ev(a[2][1], env) : ev(a[2][2], env);
        return FUNCS[a[1]](...a[2].map(x => ev(x, env)));
      }
    }
    throw new Error('bad formula node');
  }
  const evalStr = (src, env) => ev(compile(src), env);

  // ---------- showing numbers ----------
  const MINUS = '−';
  const absB = n => (n < 0n ? -n : n);
  function textOf(v) { // plain text, as written in the source examples
    if (isInt(v)) return (v.n < 0n ? '-' : '') + absB(v.n).toString();
    return (v.n < 0n ? '-' : '') + absB(v.n) + '/' + v.d;
  }
  function answerText(v, type) {
    const s = v.n < 0n ? '-' : '', n = absB(v.n);
    if (type === 'pi') { if (n === 0n) return '0'; const top = n === 1n ? 'π' : n + 'π'; return s + (v.d === 1n ? top : top + '/' + v.d); }
    return s + (v.d === 1n ? n.toString() : n + '/' + v.d);
  }
  function answerHtml(v, type) {
    const s = v.n < 0n ? MINUS : '', n = absB(v.n);
    const fr = (a, b) => `<span class="fr"><span>${a}</span><span>${b}</span></span>`;
    if (type === 'pi') { if (n === 0n) return '0'; const top = n === 1n ? 'π' : n + 'π'; return s + (v.d === 1n ? top : fr(top, v.d)); }
    return s + (v.d === 1n ? n.toLocaleString('en-US') : fr(n, v.d));
  }
  const toNum = v => Number(v.n) / Number(v.d);
  const fill = (text, env, ans, type) => (type === 'pi' ? text.replace(/\{answer\}π/g, () => answerText(ans, type)) : text).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k) => k === 'answer' ? answerText(ans, type) : env[k] !== undefined ? textOf(env[k]) : m);

  // ---------- picking values ----------
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function sampleVar(v) {
    if (v.list) return v.list[Math.floor(Math.random() * v.list.length)];
    const steps = Math.floor((v.hi - v.lo) / (v.step || 1));
    return v.lo + (v.step || 1) * rint(0, steps);
  }
  // Fill in the worked-out values; returns false if this choice of values does not work
  function runWork(t, env) {
    try { for (const [name, f] of t.work) env[name] = evalStr(f, env); return true; } catch (e) { if (e instanceof Fail || e instanceof Missing) return false; throw e; }
  }
  function rulesOk(t, env) {
    let worked = false;
    for (const r of t.rules) {
      let ok;
      try { ok = truthy(evalStr(r, env)); }
      catch (e) {
        if (e instanceof Missing && !worked) { worked = true; if (!runWork(t, env)) return false; try { ok = truthy(evalStr(r, env)); } catch (e2) { return false; } }
        else if (e instanceof Fail || e instanceof Missing) return false; else throw e;
      }
      if (!ok) return false;
    }
    return true;
  }
  // One concrete problem from a template. vals = fixed values (used by the content checker).
  function instance(t, vals, maxTries = 6000) {
    for (let k = 0; k < maxTries; k++) {
      const env = {};
      for (const v of t.vars) env[v.n] = qi(vals && vals[v.n] != null ? vals[v.n] : sampleVar(v));
      if (!rulesOk(t, env)) { if (vals) return null; continue; }
      if (!runWork(t, env)) { if (vals) return null; continue; }
      let ans;
      try { ans = evalStr(t.ans, env); } catch (e) { if (e instanceof Fail) { if (vals) return null; continue; } throw e; }
      if (t.type === 'integer' && !isInt(ans)) { if (vals) return null; continue; }
      const wrong = [];
      for (const w of t.wrong) { try { wrong.push({ v: evalStr(w.f, env), why: w.why }); } catch (e) { if (!(e instanceof Fail)) throw e; } }
      return { env, ans, wrong, tries: k + 1 };
    }
    return null;
  }

  // Five choices: the answer, the "common mistake" answers, and close neighbours if needed.
  function choices(t, inst) {
    const type = t.type, key = v => answerText(v, type), seen = new Set([key(inst.ans)]), wrong = [];
    for (const w of inst.wrong) { const k = key(w.v); if (seen.has(k)) continue; seen.add(k); wrong.push({ v: w.v, why: w.why }); }
    const a = inst.ans, cands = [];
    if (isInt(a) && type !== 'pi') { const s = absB(a.n) >= 40n ? BigInt(Math.max(1, Math.round(Number(absB(a.n)) / 12))) : 1n; for (const m of [1n, -1n, 2n, -2n, 3n, -3n, 5n, -5n]) cands.push(Q(a.n + m * s)); cands.push(mul(a, qi(2))); }
    else if (type === 'pi') { for (const m of [1n, -1n, 2n]) cands.push(Q(a.n + m * a.d, a.d)); cands.push(mul(a, qi(2)), div(a, qi(2))); }
    else { cands.push(Q(a.n + 1n, a.d), Q(a.n - 1n, a.d), Q(a.n, a.d + 1n), Q(a.n, a.d - 1n || 1n), Q(a.n + 1n, a.d + 1n), Q(a.d, a.n || 1n)); }
    const tryAdd = c => { if (wrong.length >= 4 || (c.n < 0n && a.n >= 0n)) return; const k = key(c); if (seen.has(k)) return; seen.add(k); wrong.push({ v: c, why: null }); };
    for (const c of cands.sort(() => Math.random() - 0.5)) tryAdd(c);
    for (let k = 2n; wrong.length < 4 && k < 60n; k++) { tryAdd(Q(a.n + k * a.d, a.d)); tryAdd(Q(a.n - k * a.d, a.d)); }
    const all = wrong.slice(0, 4).map(w => ({ v: w.v, why: w.why, ok: false })).concat([{ v: a, why: null, ok: true }]);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    return all.map(c => ({ html: answerHtml(c.v, type), text: answerText(c.v, type), ok: c.ok, why: c.why }));
  }

  function make(t) {
    const inst = instance(t); if (!inst) return null;
    const ch = choices(t, inst);
    return {
      id: t.id, diff: t.diff, secs: t.secs,
      q: fill(t.q, inst.env, inst.ans, t.type),
      choices: ch.map(c => c.html), correct: ch.findIndex(c => c.ok), whyWrong: ch.map(c => c.why),
      answer: answerHtml(inst.ans, t.type), why: fill(t.sol, inst.env, inst.ans, t.type),
    };
  }

  global.BBFormula = { parse, compile, evalStr, instance, choices, make, fill, answerText, textOf, Q, qi, toNum, Fail };
})(typeof window !== 'undefined' ? window : globalThis);
