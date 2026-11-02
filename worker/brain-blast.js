// /api/brain-blast/* : saves Brain Blast Arena progress in D1 (binding: DB).
//   - Every browser sends a random device key ("Authorization: Bearer <key>").
//     A new key gets its own private save automatically.
//   - A save can have a save code. Entering that code on another device
//     moves that device onto the same save.
//   - Stage records only ever get better on the server (more stars, faster
//     time, more clears), so two devices playing offline never lose progress.
// Keys and codes are only stored as SHA-256 hashes.
// Tables: bb_players, bb_devices, bb_stages.

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
};

const LIMITS = {
  bodyBytes: 64_000,     // one PUT request
  profileBytes: 16_000,  // trophies, settings, totals
  stagesPerSave: 400,    // stage records per save
  stagesPerRequest: 100,
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS bb_players (
     id TEXT PRIMARY KEY,
     code_hash TEXT UNIQUE,
     created INTEGER NOT NULL,
     updated INTEGER NOT NULL DEFAULT 0,
     profile TEXT)`,
  `CREATE TABLE IF NOT EXISTS bb_devices (
     key_hash TEXT PRIMARY KEY,
     player_id TEXT NOT NULL,
     created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS bb_stages (
     player_id TEXT NOT NULL,
     stage TEXT NOT NULL,
     stars INTEGER NOT NULL DEFAULT 0,
     best_time INTEGER,
     clears INTEGER NOT NULL DEFAULT 0,
     updated INTEGER NOT NULL,
     PRIMARY KEY (player_id, stage))`,
];

let schemaReady = null;
function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch(SCHEMA.map(s => db.prepare(s))).catch(err => { schemaReady = null; throw err; });
  }
  return schemaReady;
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
const fail = (status, error) => json({ error }, status);

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
const randomId = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');

const DEVICE_KEY = /^[A-Za-z0-9_-]{32,128}$/;
const STAGE_ID = /^[a-z0-9][a-z0-9-]{0,23}$/;

async function device(db, request) {
  const m = /^Bearer\s+(\S+)$/.exec(request.headers.get('authorization') || '');
  if (!m || !DEVICE_KEY.test(m[1])) return null;
  const keyHash = await sha256('bb-device:' + m[1]);
  const row = await db.prepare('SELECT player_id FROM bb_devices WHERE key_hash = ?').bind(keyHash).first();
  if (row) return { keyHash, playerId: row.player_id };
  // first visit from this device: give it its own save
  const playerId = randomId(), now = Date.now();
  await db.batch([
    db.prepare('INSERT INTO bb_players (id, code_hash, created, updated, profile) VALUES (?, NULL, ?, 0, NULL)').bind(playerId, now),
    db.prepare('INSERT OR IGNORE INTO bb_devices (key_hash, player_id, created) VALUES (?, ?, ?)').bind(keyHash, playerId, now),
  ]);
  const again = await db.prepare('SELECT player_id FROM bb_devices WHERE key_hash = ?').bind(keyHash).first();
  return { keyHash, playerId: again.player_id };
}

const int = (v, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };

async function readState(db, playerId) {
  const [p, s] = await db.batch([
    db.prepare('SELECT profile, updated, code_hash IS NOT NULL AS has_code, substr(code_hash, 1, 12) AS code_id, (SELECT COUNT(*) FROM bb_devices WHERE player_id = ?1) AS devices FROM bb_players WHERE id = ?1').bind(playerId),
    db.prepare('SELECT stage, stars, best_time, clears FROM bb_stages WHERE player_id = ?').bind(playerId),
  ]);
  const row = p.results[0] || {};
  let profile = null;
  try { profile = row.profile ? JSON.parse(row.profile) : null; } catch { profile = null; }
  return {
    profile,
    updated: row.updated || 0,
    hasCode: !!row.has_code,
    codeId: row.code_id || null, // first 12 hex of the code's hash, so a device can tell if its code is current
    devices: row.devices || 1,
    stages: s.results.map(r => ({ id: r.stage, stars: r.stars, best: r.best_time, clears: r.clears })),
  };
}

export async function brainBlast(request, env, path) {
  const db = env.DB;
  if (!db) return fail(503, 'Storage is not set up yet.');
  await ensureSchema(db);
  const me = await device(db, request);
  if (!me) return fail(401, 'Missing or malformed device key.');
  const method = request.method;

  // GET /state -> this save's profile and stage records
  if (path === 'state' && method === 'GET') return json(await readState(db, me.playerId));

  // PUT /state { updated, profile?, stages?: [{ id, stars, best, clears }] }
  if (path === 'state' && method === 'PUT') {
    if (Number(request.headers.get('content-length') || 0) > LIMITS.bodyBytes) return fail(413, 'Too much data.');
    const text = await request.text();
    if (text.length > LIMITS.bodyBytes) return fail(413, 'Too much data.');
    let body;
    try { body = JSON.parse(text); } catch { return fail(400, 'Bad request.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'Bad request.');
    const now = Date.now();
    const stmts = [];

    if (body.profile != null) {
      const updated = int(body.updated, 1_500_000_000_000, now + 86_400_000);
      if (!updated) return fail(400, 'Bad or missing "updated" time.');
      if (typeof body.profile !== 'object' || Array.isArray(body.profile)) return fail(400, 'The profile must be an object.');
      const p = JSON.stringify(body.profile);
      if (p.length > LIMITS.profileBytes) return fail(413, 'The profile is too big.');
      // newest profile wins
      stmts.push(db.prepare('UPDATE bb_players SET profile = ?1, updated = ?2 WHERE id = ?3 AND updated < ?2').bind(p, updated, me.playerId));
    }

    if (body.stages != null) {
      if (!Array.isArray(body.stages)) return fail(400, 'Stages must be a list.');
      if (body.stages.length > LIMITS.stagesPerRequest) return fail(413, 'Too many stages in one request.');
      const have = await db.prepare('SELECT stage FROM bb_stages WHERE player_id = ?').bind(me.playerId).all();
      const known = new Set(have.results.map(r => r.stage));
      let count = known.size;
      for (const s of body.stages) {
        if (!s || typeof s !== 'object') return fail(400, 'Bad stage record.');
        const id = typeof s.id === 'string' && STAGE_ID.test(s.id) ? s.id : null;
        const stars = int(s.stars, 0, 3), clears = int(s.clears ?? 0, 0, 1_000_000);
        const best = s.best == null ? null : int(s.best, 0, 36_000);
        if (!id || stars == null || clears == null || (s.best != null && best == null)) return fail(400, 'Bad stage record.');
        if (!known.has(id)) {
          if (count >= LIMITS.stagesPerSave) return fail(413, `A save can hold up to ${LIMITS.stagesPerSave} stages.`);
          known.add(id); count++;
        }
        // records only get better: more stars, faster best time, more clears
        stmts.push(db.prepare(`INSERT INTO bb_stages (player_id, stage, stars, best_time, clears, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          ON CONFLICT (player_id, stage) DO UPDATE SET
            stars = MAX(bb_stages.stars, excluded.stars),
            best_time = CASE WHEN bb_stages.best_time IS NULL THEN excluded.best_time
                             WHEN excluded.best_time IS NULL THEN bb_stages.best_time
                             ELSE MIN(bb_stages.best_time, excluded.best_time) END,
            clears = MAX(bb_stages.clears, excluded.clears),
            updated = ?6`).bind(me.playerId, id, stars, best, clears, now));
      }
    }
    if (stmts.length) await db.batch(stmts);
    return json(await readState(db, me.playerId));
  }

  // POST /code -> make (or replace) the save code
  if (path === 'code' && method === 'POST') {
    const code = randomCode();
    await db.prepare('UPDATE bb_players SET code_hash = ? WHERE id = ?').bind(await sha256('bb-code:' + normalizeCode(code)), me.playerId).run();
    return json({ code });
  }
  // DELETE /code -> turn the save code off (devices already joined stay joined)
  if (path === 'code' && method === 'DELETE') {
    await db.prepare('UPDATE bb_players SET code_hash = NULL WHERE id = ?').bind(me.playerId).run();
    return json({ ok: true });
  }
  // POST /join { code } -> move this device onto the save with that code
  if (path === 'join' && method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return fail(400, 'Bad request.'); }
    const code = normalizeCode(body && body.code);
    if (code.length !== 16) return fail(400, 'A save code has 16 letters and numbers.');
    const p = await db.prepare('SELECT id FROM bb_players WHERE code_hash = ?').bind(await sha256('bb-code:' + code)).first();
    if (!p) return fail(404, 'No save has that code. Check it and try again.');
    await db.prepare('UPDATE bb_devices SET player_id = ? WHERE key_hash = ?').bind(p.id, me.keyHash).run();
    return json({ ok: true, same: p.id === me.playerId });
  }
  return fail(404, 'Unknown request.');
}
