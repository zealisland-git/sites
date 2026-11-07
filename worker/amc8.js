// /api/amc8/* : online copy of the practice results of the AMC 8 Prep site
// (https://amc8.zeal-island.workers.dev, repo zealisland-git/amc8), stored in D1 (binding: DB).
//   - Every browser sends a random device key ("Authorization: Bearer <key>").
//     A new key gets its own private results list automatically.
//   - A results list has a sync code. Entering that code on another device's
//     My progress page moves that device onto the same list.
//   - POST /sync sends the browser's new tries and deletions and returns the whole
//     list, so the browser and the database end up with the same tries.
//   - The AMC 8 site is on another origin, so responses carry CORS headers for that
//     origin only (plus env.AMC8_TEST_ORIGIN when set, for local tests).
// Keys and codes are only stored as SHA-256 hashes. No names or personal details are stored.
// Tables: amc8_students, amc8_devices, amc8_tries, amc8_gone.

const ORIGINS = new Set(['https://amc8.zeal-island.workers.dev']);

const LIMITS = {
  bodyBytes: 120_000,     // one /sync request
  addPerRequest: 200,     // tries uploaded in one request (the browser sends more in several requests)
  delPerRequest: 200,     // deletions in one request
  triesPerStudent: 5000,  // 65 lessons, so about 75 tries per lesson
  gonePerStudent: 10000,  // deletion markers kept per list
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS amc8_students (
     id TEXT PRIMARY KEY,
     code_hash TEXT UNIQUE,
     created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS amc8_devices (
     key_hash TEXT PRIMARY KEY,
     student_id TEXT NOT NULL,
     created INTEGER NOT NULL)`,
  // one row per graded try; k = "<lesson slug>@<time in ms>", data = the try as JSON text
  `CREATE TABLE IF NOT EXISTS amc8_tries (
     student_id TEXT NOT NULL,
     k TEXT NOT NULL,
     data TEXT NOT NULL,
     added INTEGER NOT NULL,
     PRIMARY KEY (student_id, k))`,
  // deleted tries, so a device that still has one learns to delete it instead of uploading it again
  `CREATE TABLE IF NOT EXISTS amc8_gone (
     student_id TEXT NOT NULL,
     k TEXT NOT NULL,
     at INTEGER NOT NULL,
     PRIMARY KEY (student_id, k))`,
];

let schemaReady = null;
function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch(SCHEMA.map(s => db.prepare(s))).catch(err => { schemaReady = null; throw err; });
  }
  return schemaReady;
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  const ok = origin && (ORIGINS.has(origin) || (env.AMC8_TEST_ORIGIN && origin === env.AMC8_TEST_ORIGIN));
  return ok ? { 'access-control-allow-origin': origin, vary: 'Origin' } : { vary: 'Origin' };
}
const baseHeaders = cors => ({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
  ...cors,
});

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Crockford base32: no I, L, O, U, so codes are easy to read aloud and type.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10)); // 80 bits
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return out.match(/.{4}/g).join('-');
}
const normalizeCode = input => String(input || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
const codeHash = code => sha256('amc8-code:' + normalizeCode(code));
const randomId = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');

const DEVICE_KEY = /^[A-Za-z0-9_-]{32,128}$/;
const SLUG = /^[a-z0-9-]{1,60}$/;
const TRY_KEY = /^[a-z0-9-]{1,60}@\d{13}$/;

async function device(db, request) {
  const m = /^Bearer\s+(\S+)$/.exec(request.headers.get('authorization') || '');
  if (!m || !DEVICE_KEY.test(m[1])) return null;
  const keyHash = await sha256('amc8-device:' + m[1]);
  const row = await db.prepare('SELECT student_id FROM amc8_devices WHERE key_hash = ?').bind(keyHash).first();
  if (row) return { keyHash, studentId: row.student_id };
  // first visit from this device: give it its own results list
  const studentId = randomId(), now = Date.now();
  await db.batch([
    db.prepare('INSERT INTO amc8_students (id, code_hash, created) VALUES (?, NULL, ?)').bind(studentId, now),
    db.prepare('INSERT OR IGNORE INTO amc8_devices (key_hash, student_id, created) VALUES (?, ?, ?)').bind(keyHash, studentId, now),
  ]);
  const again = await db.prepare('SELECT student_id FROM amc8_devices WHERE key_hash = ?').bind(keyHash).first();
  return { keyHash, studentId: again.student_id };
}

// Same rules as validTry() in the site's assets/amc8.js. Returns the cleaned try, or null.
function cleanTry(a, now) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const { s, t } = a, ans = a.a, c = a.c, b = a.b;
  if (typeof s !== 'string' || !SLUG.test(s)) return null;
  if (!Number.isInteger(t) || t < 1_600_000_000_000 || t > now + 86_400_000) return null;
  if (typeof ans !== 'string' || typeof c !== 'string' || typeof b !== 'string') return null;
  if (!ans.length || ans.length > 40 || c.length !== ans.length || b.length !== ans.length) return null;
  if (!/^[A-E.]+$/.test(ans) || !/^[01]+$/.test(c) || !/^[WCH]+$/.test(b)) return null;
  return { s, t, a: ans, c, b, p: a.p ? 1 : 0 };
}

async function readState(db, studentId) {
  const [st, tries, gone] = await db.batch([
    db.prepare('SELECT code_hash IS NOT NULL AS has_code, substr(code_hash, 1, 12) AS code_id, (SELECT COUNT(*) FROM amc8_devices WHERE student_id = ?1) AS devices FROM amc8_students WHERE id = ?1').bind(studentId),
    db.prepare('SELECT data FROM amc8_tries WHERE student_id = ?').bind(studentId),
    db.prepare('SELECT k FROM amc8_gone WHERE student_id = ?').bind(studentId),
  ]);
  const info = st.results[0] || {};
  return {
    info: {
      hasCode: !!info.has_code,
      codeId: info.code_id || null, // first 12 hex of the code's hash, so a device can tell if its stored code is current
      devices: info.devices || 1,
      count: tries.results.length,
      max: LIMITS.triesPerStudent,
    },
    // tries are stored as JSON text: join them as text instead of parsing (keeps CPU time low)
    triesJson: '[' + tries.results.map(r => r.data).join(',') + ']',
    gone: gone.results.map(r => r.k),
  };
}

async function handle(request, env, path, json, fail) {
  const db = env.DB;
  const method = request.method;

  // GET /ping -> a quick check that this API is deployed (no device key needed)
  if (path === 'ping' && method === 'GET') return json({ ok: true, storage: !!db });

  if (!db) return fail(503, 'Online saving is not set up yet.');
  await ensureSchema(db);
  const me = await device(db, request);
  if (!me) return fail(401, 'Missing or malformed device key.');

  // POST /sync { add: [try], del: ["slug@time"] } -> the whole list: { tries, gone, hasCode, codeId, devices, count, max, full? }
  if (path === 'sync' && method === 'POST') {
    if (Number(request.headers.get('content-length') || 0) > LIMITS.bodyBytes) return fail(413, 'Too much data in one request.');
    const text = await request.text();
    if (text.length > LIMITS.bodyBytes) return fail(413, 'Too much data in one request.');
    let body;
    try { body = text ? JSON.parse(text) : {}; } catch { return fail(400, 'Bad request.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'Bad request.');
    const add = body.add == null ? [] : body.add, del = body.del == null ? [] : body.del;
    if (!Array.isArray(add) || !Array.isArray(del)) return fail(400, 'add and del must be lists.');
    if (add.length > LIMITS.addPerRequest || del.length > LIMITS.delPerRequest) return fail(413, 'Too many tries in one request.');
    const now = Date.now();
    const tries = [];
    for (const a of add) {
      const t = cleanTry(a, now);
      if (!t) return fail(400, 'A try in the request is not in the right format.');
      tries.push(t);
    }
    const dels = [...new Set(del)];
    if (!dels.every(k => typeof k === 'string' && TRY_KEY.test(k))) return fail(400, 'A deletion in the request is not in the right format.');

    let full = false;
    if (tries.length || dels.length) {
      const use = await db.prepare('SELECT (SELECT COUNT(*) FROM amc8_tries WHERE student_id = ?1) AS n, (SELECT COUNT(*) FROM amc8_gone WHERE student_id = ?1) AS g').bind(me.studentId).first();
      let room = LIMITS.triesPerStudent - use.n;
      if (tries.length > room) { full = true; tries.length = Math.max(0, room); }
      if (use.g + dels.length > LIMITS.gonePerStudent) return fail(413, 'Too many deleted tries on this list.');
      const stmts = [];
      // deletion markers first, so a try deleted here is not added back by the same request
      for (let i = 0; i < dels.length; i += 90) {
        const part = dels.slice(i, i + 90);
        stmts.push(db.prepare('INSERT OR IGNORE INTO amc8_gone (student_id, k, at) VALUES ' + part.map((_, j) => `(?1, ?${j + 3}, ?2)`).join(', '))
          .bind(me.studentId, now, ...part));
      }
      // new tries: 2 bound values per row plus 2 shared ones stays under D1's 100 per statement
      for (let i = 0; i < tries.length; i += 40) {
        const part = tries.slice(i, i + 40), vals = [];
        part.forEach(t => vals.push(t.s + '@' + t.t, JSON.stringify(t)));
        stmts.push(db.prepare('INSERT OR IGNORE INTO amc8_tries (student_id, k, data, added) VALUES ' + part.map((_, j) => `(?1, ?${2 * j + 3}, ?${2 * j + 4}, ?2)`).join(', '))
          .bind(me.studentId, now, ...vals));
      }
      stmts.push(db.prepare('DELETE FROM amc8_tries WHERE student_id = ?1 AND k IN (SELECT k FROM amc8_gone WHERE student_id = ?1)').bind(me.studentId));
      await db.batch(stmts);
    }
    const state = await readState(db, me.studentId);
    const extra = JSON.stringify({ ...state.info, gone: state.gone, full: full || undefined });
    return json(null, 200, '{"tries":' + state.triesJson + ',' + extra.slice(1));
  }

  // POST /code -> make (or replace) the sync code for this list
  if (path === 'code' && method === 'POST') {
    const code = randomCode(), hash = await codeHash(code);
    await db.prepare('UPDATE amc8_students SET code_hash = ? WHERE id = ?').bind(hash, me.studentId).run();
    return json({ code, codeId: hash.slice(0, 12) });
  }

  // POST /join { code } -> move this device onto the list with that code
  if (path === 'join' && method === 'POST') {
    let body;
    try { body = JSON.parse(await request.text()); } catch { return fail(400, 'Bad request.'); }
    const code = normalizeCode(body && body.code);
    if (code.length !== 16) return fail(400, 'A sync code has 16 letters and numbers.');
    const hash = await codeHash(code);
    const st = await db.prepare('SELECT id FROM amc8_students WHERE code_hash = ?').bind(hash).first();
    if (!st) return fail(404, 'No results are saved under that code. Check it and try again.');
    if (st.id !== me.studentId) await db.prepare('UPDATE amc8_devices SET student_id = ? WHERE key_hash = ?').bind(st.id, me.keyHash).run();
    return json({ ok: true, same: st.id === me.studentId, codeId: hash.slice(0, 12) });
  }

  return fail(404, 'Unknown request.');
}

export async function amc8(request, env, path) {
  const cors = corsHeaders(request, env);
  const json = (obj, status = 200, text) => new Response(text ?? JSON.stringify(obj), { status, headers: baseHeaders(cors) });
  const fail = (status, error) => json({ error }, status);
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-max-age': '86400',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }
  try {
    return await handle(request, env, path, json, fail);
  } catch (err) {
    console.error('amc8 api error', err && err.stack || err);
    return fail(500, 'Something went wrong on the server. Your results are still saved in this browser.');
  }
}
