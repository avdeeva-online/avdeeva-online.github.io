// Local preview of public/: static files from disk, /api/* proxied to production (read-only GETs).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[2];
const PORT = Number(process.argv[3] || 8787);
const PROD = 'https://archive-exe.node-00.workers.dev';
const SNAP_DIR = process.argv[4] || path.join(process.cwd(), 'snaps');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/__snap' && req.method === 'POST') {
    const chunks = []; for await (const c of req) chunks.push(c);
    const name = (url.searchParams.get('name') || 'snap').replace(/[^a-z0-9_-]/gi, '_');
    fs.mkdirSync(SNAP_DIR, { recursive: true });
    fs.writeFileSync(path.join(SNAP_DIR, name + '.json'), Buffer.concat(chunks));
    res.writeHead(200); return res.end('saved ' + name);
  }
  if (url.pathname === '/__save' && req.method === 'POST') { // binary output of in-browser image work, into <snapDir>/out
    const chunks = []; for await (const c of req) chunks.push(c);
    const name = path.basename(url.searchParams.get('name') || 'out.bin');
    fs.mkdirSync(path.join(SNAP_DIR, 'out'), { recursive: true });
    fs.writeFileSync(path.join(SNAP_DIR, 'out', name), Buffer.concat(chunks));
    res.writeHead(200); return res.end('saved ' + name + ' ' + Buffer.concat(chunks).length);
  }
  if (url.pathname === '/__snap.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'snap.js'))); }
  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET') { res.writeHead(405); return res.end('read-only preview'); }
    const r = await fetch(PROD + url.pathname + url.search);
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/octet-stream' });
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(ROOT, p);
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`preview on http://localhost:${PORT}`));
