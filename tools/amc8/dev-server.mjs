// Runs the sites Worker's API locally on a D1 stand-in, for testing the AMC 8 site's online saving in a browser.
// Run: node tools/amc8/dev-server.mjs [port=8787] [site origin=http://localhost:8765] [sqlite file=:memory:]
// Then load the AMC 8 site from that origin with window.AMC_API = "http://localhost:<port>/api/amc8/".
import http from 'node:http';
import worker from '../../worker/index.js';
import { localD1 } from './local-d1.mjs';

const port = Number(process.argv[2] || 8787);
const origin = process.argv[3] || 'http://localhost:8765';
const env = {
  DB: localD1(process.argv[4] || ':memory:'),
  ASSETS: { fetch: () => new Response('static file') },
  AMC8_TEST_ORIGIN: origin,
};
http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = Object.fromEntries(Object.entries(req.headers).filter(([k]) => !['connection', 'host', 'content-length', 'keep-alive'].includes(k)));
  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && chunks.length;
  const r = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log(`amc8 API on http://localhost:${port}/api/amc8/ for pages from ${origin}`));
