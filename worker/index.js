// Cloudflare Worker for the sites project.
// Static files in public/ are served directly by Cloudflare. Only requests
// under /api/ reach this code (see run_worker_first in wrangler.jsonc).
//
// /api/ascii-art/* stores ASCII Art Studio galleries in D1 (binding: DB).
//   - Every browser sends a random device key ("Authorization: Bearer <key>").
//     A new key gets its own private collection automatically.
//   - A collection can have a sync code. Entering that code on another device
//     moves that device into the same collection.
// Keys and codes are only stored as SHA-256 hashes.

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
};

const LIMITS = {
  itemBytes: 1_000_000, // one saved piece (JSON text)
  itemsPerLibrary: 1000,
  bytesPerLibrary: 60_000_000,
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS aa_libraries (
     id TEXT PRIMARY KEY,
     code_hash TEXT UNIQUE,
     created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS aa_devices (
     key_hash TEXT PRIMARY KEY,
     library_id TEXT NOT NULL,
     created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS aa_items (
     library_id TEXT NOT NULL,
     id TEXT NOT NULL,
     updated INTEGER NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0,
     size INTEGER NOT NULL DEFAULT 0,
     data TEXT,
     PRIMARY KEY (library_id, id))`,
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
export function normalizeCode(input) {
  return String(input || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
}
const randomId = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');

const DEVICE_KEY = /^[A-Za-z0-9_-]{32,128}$/;
const ITEM_ID = /^[a-z0-9]{6,32}$/;

async function device(db, request) {
  const m = /^Bearer\s+(\S+)$/.exec(request.headers.get('authorization') || '');
  if (!m || !DEVICE_KEY.test(m[1])) return null;
  const keyHash = await sha256('device:' + m[1]);
  const row = await db.prepare('SELECT library_id FROM aa_devices WHERE key_hash = ?').bind(keyHash).first();
  if (row) return { keyHash, libraryId: row.library_id };
  // first visit from this device: give it its own collection
  const libraryId = randomId(), now = Date.now();
  await db.batch([
    db.prepare('INSERT INTO aa_libraries (id, code_hash, created) VALUES (?, NULL, ?)').bind(libraryId, now),
    db.prepare('INSERT OR IGNORE INTO aa_devices (key_hash, library_id, created) VALUES (?, ?, ?)').bind(keyHash, libraryId, now),
  ]);
  const again = await db.prepare('SELECT library_id FROM aa_devices WHERE key_hash = ?').bind(keyHash).first();
  return { keyHash, libraryId: again.library_id };
}

function validUpdated(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 1_500_000_000_000 && n < Date.now() + 86_400_000 ? n : null;
}

async function asciiArt(request, env, path) {
  const db = env.DB;
  if (!db) return fail(503, 'Storage is not set up yet.');
  await ensureSchema(db);
  const me = await device(db, request);
  if (!me) return fail(401, 'Missing or malformed device key.');
  const method = request.method;
  const url = new URL(request.url);

  // GET /library -> collection info + list of items (no content)
  if (path === 'library' && method === 'GET') {
    const [lib, items] = await db.batch([
      db.prepare('SELECT code_hash IS NOT NULL AS has_code, substr(code_hash, 1, 12) AS code_id, (SELECT COUNT(*) FROM aa_devices WHERE library_id = ?1) AS devices FROM aa_libraries WHERE id = ?1').bind(me.libraryId),
      db.prepare('SELECT id, updated, deleted FROM aa_items WHERE library_id = ?').bind(me.libraryId),
    ]);
    const info = lib.results[0] || { has_code: 0, devices: 1 };
    return json({
      hasCode: !!info.has_code,
      codeId: info.code_id || null, // first 12 hex of the code's hash, so a device can tell if its code is current
      devices: info.devices,
      items: items.results.map(r => ({ id: r.id, updated: r.updated, deleted: !!r.deleted })),
    });
  }

  // POST /code -> make (or replace) the sync code for this collection
  if (path === 'code' && method === 'POST') {
    const code = randomCode();
    await db.prepare('UPDATE aa_libraries SET code_hash = ? WHERE id = ?').bind(await sha256('code:' + normalizeCode(code)), me.libraryId).run();
    return json({ code });
  }
  // DELETE /code -> turn the sync code off (devices already joined stay joined)
  if (path === 'code' && method === 'DELETE') {
    await db.prepare('UPDATE aa_libraries SET code_hash = NULL WHERE id = ?').bind(me.libraryId).run();
    return json({ ok: true });
  }

  // POST /join {code} -> move this device into the collection with that code
  if (path === 'join' && method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return fail(400, 'Bad request.'); }
    const code = normalizeCode(body && body.code);
    if (code.length !== 16) return fail(400, 'A sync code has 16 letters and numbers.');
    const lib = await db.prepare('SELECT id FROM aa_libraries WHERE code_hash = ?').bind(await sha256('code:' + code)).first();
    if (!lib) return fail(404, 'No collection has that sync code. Check it and try again.');
    await db.prepare('UPDATE aa_devices SET library_id = ? WHERE key_hash = ?').bind(lib.id, me.keyHash).run();
    return json({ ok: true, same: lib.id === me.libraryId });
  }

  // POST /leave -> give this device a fresh collection of its own
  if (path === 'leave' && method === 'POST') {
    const libraryId = randomId();
    await db.batch([
      db.prepare('INSERT INTO aa_libraries (id, code_hash, created) VALUES (?, NULL, ?)').bind(libraryId, Date.now()),
      db.prepare('UPDATE aa_devices SET library_id = ? WHERE key_hash = ?').bind(libraryId, me.keyHash),
    ]);
    return json({ ok: true });
  }

  // /items/<id>
  const im = /^items\/([a-z0-9]+)$/.exec(path);
  if (im) {
    const id = im[1];
    if (!ITEM_ID.test(id)) return fail(400, 'Bad item id.');
    if (method === 'GET') {
      const row = await db.prepare('SELECT updated, deleted, data FROM aa_items WHERE library_id = ? AND id = ?').bind(me.libraryId, id).first();
      if (!row || row.deleted || row.data == null) return fail(404, 'Not found.');
      return new Response(row.data, { headers: { ...JSON_HEADERS, 'x-updated': String(row.updated) } });
    }
    const updated = validUpdated(url.searchParams.get('updated'));
    if (!updated) return fail(400, 'Bad or missing "updated" time.');
    if (method === 'PUT') {
      const declared = Number(request.headers.get('content-length') || 0);
      if (declared > LIMITS.itemBytes * 4) return fail(413, 'This piece is too big to sync.');
      const data = await request.text();
      if (data.length > LIMITS.itemBytes) return fail(413, 'This piece is too big to sync.');
      if (data[0] !== '{') return fail(400, 'Expected a JSON object.');
      const existing = await db.prepare('SELECT updated, deleted FROM aa_items WHERE library_id = ? AND id = ?').bind(me.libraryId, id).first();
      if (existing && existing.updated >= updated) return json({ ok: true, kept: 'newer', updated: existing.updated });
      if (!existing || existing.deleted) {
        const use = await db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM aa_items WHERE library_id = ? AND deleted = 0').bind(me.libraryId).first();
        if (use.n >= LIMITS.itemsPerLibrary) return fail(413, `A collection can hold up to ${LIMITS.itemsPerLibrary} pieces.`);
        if (use.bytes + data.length > LIMITS.bytesPerLibrary) return fail(413, 'This collection is full.');
      }
      try {
        await db.prepare(`INSERT INTO aa_items (library_id, id, updated, deleted, size, data) VALUES (?1, ?2, ?3, 0, ?4, ?5)
          ON CONFLICT (library_id, id) DO UPDATE SET updated = excluded.updated, deleted = 0, size = excluded.size, data = excluded.data
          WHERE excluded.updated > aa_items.updated`).bind(me.libraryId, id, updated, data.length, data).run();
      } catch (err) {
        // a database size limit: skip just this piece instead of failing the whole sync
        if (data.length > 90_000) return fail(413, 'This piece is too big to sync.');
        throw err;
      }
      return json({ ok: true, updated });
    }
    if (method === 'DELETE') {
      // keep a small "deleted" marker so other devices learn about it
      await db.prepare(`INSERT INTO aa_items (library_id, id, updated, deleted, size, data) VALUES (?1, ?2, ?3, 1, 0, NULL)
        ON CONFLICT (library_id, id) DO UPDATE SET updated = excluded.updated, deleted = 1, size = 0, data = NULL
        WHERE excluded.updated > aa_items.updated`).bind(me.libraryId, id, updated).run();
      return json({ ok: true, updated });
    }
  }
  return fail(404, 'Unknown request.');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = /^\/api\/ascii-art\/(.+)$/.exec(url.pathname);
    if (m) {
      try {
        return await asciiArt(request, env, m[1].replace(/\/+$/, ''));
      } catch (err) {
        console.error('ascii-art api error', err && err.stack || err);
        return fail(500, 'Something went wrong on the server. Your art is still saved on this device.');
      }
    }
    if (url.pathname.startsWith('/api/')) return fail(404, 'Unknown API.');
    // Anything else: serve the static site as usual.
    return env.ASSETS.fetch(request);
  },
};
