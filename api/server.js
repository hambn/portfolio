// Self-host adapter — runs the unmodified Worker (index.js) on plain Node.
// `node api/server.js`  (Cloudflare deploy still uses index.js directly).
//
// index.js depends on three Cloudflare globals; we shim them here so it needs
// zero changes: caches.default (Cache API), env.SPOTIFY_KV (KV), and env (vars
// + secrets). Secrets come from process.env.
import http from 'node:http';
import worker from './index.js';

// caches.default — Map keyed by URL, honoring each response's Cache-Control max-age.
const store = new Map();
globalThis.caches = {
  default: {
    async match(req) {
      const e = store.get(req.url);
      if (!e) return undefined;
      if (e.exp && Date.now() >= e.exp) { store.delete(req.url); return undefined; }
      return e.res.clone();
    },
    async put(req, res) {
      const m = /max-age=(\d+)/.exec(res.headers.get('Cache-Control') || '');
      store.set(req.url, { res: res.clone(), exp: m ? Date.now() + +m[1] * 1000 : 0 });
    },
  },
};

// KV shim — in-memory, honors expirationTtl.
// ponytail: lost on restart, so the Spotify access_token is re-exchanged from
// the refresh-token fallback. No data loss; swap for Redis if you scale out.
function kvShim() {
  const m = new Map();
  return {
    async get(k) {
      const e = m.get(k);
      if (!e) return null;
      if (e.exp && Date.now() > e.exp) { m.delete(k); return null; }
      return e.v;
    },
    async put(k, v, opt = {}) {
      m.set(k, { v, exp: opt.expirationTtl ? Date.now() + opt.expirationTtl * 1000 : 0 });
    },
  };
}

const env = {
  ...process.env, // SPOTIFY_CLIENT_ID, STEAM_API_KEY, …
  SPOTIFY_KV: kvShim(),
  CACHE_VERSION: process.env.CACHE_VERSION || String(Date.now()),
};

// --check: self-test the shims' TTL logic, then exit. No server, no network.
if (process.argv.includes('--check')) {
  const c = globalThis.caches.default;
  const req = new Request('http://x/');
  await c.put(req, new Response('a', { headers: { 'Cache-Control': 'max-age=0' } }));
  console.assert(await c.match(req) === undefined, 'cache: max-age=0 must expire immediately');
  await c.put(req, new Response('b', { headers: { 'Cache-Control': 'max-age=60' } }));
  console.assert((await (await c.match(req)).text()) === 'b', 'cache: live entry must return');
  const kv = kvShim();
  await kv.put('k', '1', { expirationTtl: 0 });
  console.assert(await kv.get('k') === '1', 'kv: ttl 0 means no expiry');
  await kv.put('k', '1', { expirationTtl: -1 });
  console.assert(await kv.get('k') === null, 'kv: past ttl must be gone');
  console.log('shims ok');
  process.exit(0);
}

const PORT = process.env.PORT || 8787;
http.createServer(async (req, res) => {
  try {
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers,
    });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'server_error', message: String(err) }));
  }
}).listen(PORT, () => console.log(`api on http://localhost:${PORT}`));
