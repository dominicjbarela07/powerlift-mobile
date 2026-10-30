// Presentation-only host. Product auth and APIs are never mounted here.
// All React Native component code is bundled by canonical `npm start` on 8081.
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (root !== '/Users/dominic/powerlifting_app_dev/powerlift_mobile') throw Error('Canonical DEV only');
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
if (branch !== 'dev/canonical-mobile') throw Error('Canonical DEV branch required');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>The Ledger — Design Study</title><style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}#root{display:flex;flex-direction:column}body{background:rgb(11,12,19)}*{box-sizing:border-box}button,input{font:inherit}*:focus-visible{outline:2px solid rgb(213,182,255);outline-offset:3px}</style></head><body><div id="root"></div><script src="http://127.0.0.1:8081/dev-mocks/ledger-study/entry.bundle?platform=web&dev=true&hot=false&lazy=false"></script></body></html>`;
http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  if (req.url?.startsWith('/assets/') || req.url?.startsWith('/node_modules/')) {
    const upstream = http.request({ hostname: '127.0.0.1', port: 8081, path: req.url, method: req.method, headers: { ...(req.headers.range ? { Range: req.headers.range } : {}) } }, response => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502); res.end(); });
    upstream.end();
    return;
  }
  if (req.url !== '/' && !req.url?.startsWith('/?')) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(req.method === 'HEAD' ? '' : html);
}).listen(8095, '127.0.0.1', () => console.log('Ledger DEV study: http://127.0.0.1:8095 — canonical Metro, fictional data only'));
