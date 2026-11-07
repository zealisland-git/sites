// Tests for /api/amc8/* (worker/amc8.js) against the local D1 stand-in.
// Run: node tools/amc8/test-api.mjs   (Node 22.5 or later, for node:sqlite)
import worker from '../../worker/index.js';
import { localD1 } from './local-d1.mjs';
import assert from 'node:assert/strict';

const SITE = 'https://amc8.zeal-island.workers.dev';
const db = localD1();
const env = { DB: db, ASSETS: { fetch: () => new Response('static file') } };
const key = n => ('k' + n).padEnd(48, 'x');

async function call(path, { method = 'POST', dev, body, origin = SITE, raw } = {}) {
  const headers = { origin };
  if (dev) headers.authorization = 'Bearer ' + key(dev);
  if (body !== undefined || raw !== undefined) headers['content-type'] = 'application/json';
  const res = await worker.fetch(new Request('https://sites.zeal-island.workers.dev/api/amc8/' + path,
    { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) }), env);
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, data, text };
}
let T0 = Date.UTC(2026, 9, 20, 3, 0, 0);
const mk = (s, i, right = '111110000011111') => ({ s, t: T0 + i * 60000, a: 'ABCDEABCDEABCDE', c: right, b: 'WWWWWCCCCCCHHHH', p: 0 });
const keys = list => list.map(t => t.s + '@' + t.t).sort();
let n = 0; const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

// deployed and headers
let r = await call('ping', { method: 'GET' });
ok(r.status === 200 && r.data.ok && r.data.storage, 'ping');
ok(r.headers.get('access-control-allow-origin') === SITE && r.headers.get('x-robots-tag') === 'noindex, nofollow' && r.headers.get('cache-control') === 'no-store', 'ping headers');
r = await call('ping', { method: 'GET', origin: 'https://evil.example' });
ok(!r.headers.get('access-control-allow-origin'), 'no CORS for other sites');
r = await call('sync', { method: 'OPTIONS' });
ok(r.status === 204 && /authorization/.test(r.headers.get('access-control-allow-headers')) && r.headers.get('access-control-allow-origin') === SITE, 'preflight');
r = await call('sync', { body: {} });
ok(r.status === 401 && r.headers.get('access-control-allow-origin') === SITE, 'no device key -> 401 with CORS');

// device 1 uploads its existing tries (first visit after this feature ships)
const A = [mk('1-1-clever-calculation', 0), mk('1-1-clever-calculation', 1, '111111111111111'), mk('4-7-counting-divisors', 2)];
db.queries = 0;
r = await call('sync', { dev: 1, body: { add: A, del: [] } });
ok(r.status === 200 && r.data.tries.length === 3 && r.data.count === 3 && !r.data.hasCode && r.data.gone.length === 0, 'first upload');
ok(JSON.stringify(keys(r.data.tries)) === JSON.stringify(keys(A)), 'same tries back');
ok(db.queries < 50, 'query count ' + db.queries);
r = await call('sync', { dev: 1, body: { add: A } });
ok(r.data.tries.length === 3, 'uploading again adds nothing');
r = await call('sync', { dev: 1, body: { add: [{ ...A[0], c: '1' }] } });
ok(r.status === 400, 'bad try refused');
r = await call('sync', { dev: 1, body: { del: ['nope'] } });
ok(r.status === 400, 'bad deletion refused');
r = await call('sync', { dev: 1, raw: '{not json' });
ok(r.status === 400, 'bad JSON refused');
r = await call('sync', { dev: 1, body: { add: Array.from({ length: 201 }, (_, i) => mk('x', i + 100)) } });
ok(r.status === 413, 'too many in one request');
r = await call('sync', { dev: 1, raw: JSON.stringify({ add: [], pad: 'x'.repeat(130000) }) });
ok(r.status === 413, 'body too big');

// sync code and a second device
r = await call('code', { dev: 1 });
ok(r.status === 200 && /^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/.test(r.data.code) && r.data.codeId.length === 12, 'code made');
const code = r.data.code, codeId = r.data.codeId;
r = await call('sync', { dev: 1, body: {} });
ok(r.data.hasCode && r.data.codeId === codeId, 'code shows in state');
r = await call('join', { dev: 2, body: { code: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ' } });
ok(r.status === 404, 'unknown code refused');
r = await call('join', { dev: 2, body: { code: 'abc' } });
ok(r.status === 400, 'short code refused');
const typed = ' ' + code.toLowerCase().replace(/0/g, 'o').replace(/-/g, ' ') + ' ';
r = await call('join', { dev: 2, body: { code: typed } });
ok(r.status === 200 && r.data.ok && !r.data.same && r.data.codeId === codeId, 'join with a loosely typed code');
const B = [mk('5-8-arc-length', 10)];
r = await call('sync', { dev: 2, body: { add: B } });
ok(r.data.tries.length === 4 && r.data.devices === 2, 'second device sees everything and adds its own');
r = await call('sync', { dev: 1, body: {} });
ok(r.data.tries.length === 4, 'first device gets the new try');

// deletions spread to other devices and are never added back
const gone = A[1].s + '@' + A[1].t;
r = await call('sync', { dev: 2, body: { del: [gone] } });
ok(r.data.tries.length === 3 && r.data.gone.includes(gone), 'deleted');
r = await call('sync', { dev: 1, body: { add: [A[1]] } });
ok(r.data.tries.length === 3 && r.data.gone.includes(gone), 'a stale device cannot add a deleted try back');

// other visitors see nothing of this list
r = await call('sync', { dev: 3, body: {} });
ok(r.data.tries.length === 0 && r.data.gone.length === 0, 'a new device starts empty');
r = await call('sync', { dev: 3, body: { add: [mk('9-2-averages', 50)] } });
r = await call('sync', { dev: 1, body: {} });
ok(r.data.tries.length === 3 && !r.data.tries.some(t => t.s === '9-2-averages'), 'lists stay separate');

// replacing the code: the old code stops working, joined devices stay joined
r = await call('code', { dev: 2 });
ok(r.data.codeId !== codeId, 'new code');
r = await call('join', { dev: 4, body: { code } });
ok(r.status === 404, 'old code no longer joins');
r = await call('sync', { dev: 1, body: {} });
ok(r.data.tries.length === 3 && r.data.codeId !== codeId, 'device 1 still on the list, sees the code changed');

// a big catch-up: 200 tries and 200 deletions in one request stays under the query limit
const many = Array.from({ length: 200 }, (_, i) => mk('3-1-arithmetic-sequences', 1000 + i));
db.queries = 0;
r = await call('sync', { dev: 5, body: { add: many, del: many.slice(0, 200).map(t => t.s + '@' + (t.t + 7)) } });
ok(r.status === 200 && r.data.tries.length === 200 && db.queries < 50, 'big request: ' + db.queries + ' queries');

// routing
r = await call('nothing-here', { dev: 1, body: {} });
ok(r.status === 404 && r.headers.get('access-control-allow-origin') === SITE, 'unknown path');
const st = await worker.fetch(new Request('https://sites.zeal-island.workers.dev/ascii-art/'), env);
ok((await st.text()) === 'static file', 'static files untouched');

// storage is only hashes and results
const devs = db.raw.prepare('SELECT key_hash FROM amc8_devices').all();
ok(devs.every(d => /^[0-9a-f]{64}$/.test(d.key_hash) && !d.key_hash.includes('xxxx')), 'device keys stored as hashes');
const studs = db.raw.prepare('SELECT code_hash FROM amc8_students WHERE code_hash IS NOT NULL').all();
ok(studs.every(s => /^[0-9a-f]{64}$/.test(s.code_hash)), 'codes stored as hashes');

console.log(`amc8 API: all ${n} checks passed`);
