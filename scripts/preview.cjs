'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handler } = require('../netlify/functions/company-search.cjs');
const root = path.resolve(__dirname, '../dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/.netlify/functions/company-search') {
    const result = await handler({ httpMethod: request.method, queryStringParameters: Object.fromEntries(url.searchParams) });
    response.writeHead(result.statusCode, result.headers); response.end(result.body); return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(503); response.end('Forms are not sent from local preview.'); return; }
  let name;
  try { name = decodeURIComponent(url.pathname); } catch { response.writeHead(400); response.end(); return; }
  let file = path.resolve(root, `.${name}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) { response.writeHead(403); response.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  try {
    const data = fs.readFileSync(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173/payment-check/'));
