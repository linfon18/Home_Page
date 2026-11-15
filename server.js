'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
require('./build.js');
const root = path.join(__dirname, 'dist');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
http.createServer((req, res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (_) { res.writeHead(400); return res.end('Bad request'); }
  let file = path.resolve(root, '.' + name);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!name.endsWith('/')) { res.writeHead(301, { Location: name + '/' }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  const exists = fs.existsSync(file) && fs.statSync(file).isFile();
  if (!exists) file = path.join(root, '404.html');
  let contentType = mime[path.extname(file)] || 'application/octet-stream';
  if (path.basename(file) === 'avatar-source.jpg') { const bytes = fs.readFileSync(file); contentType = bytes[0] === 0x89 ? 'image/png' : 'image/jpeg'; }
  res.writeHead(exists ? 200 : 404, { 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT) || 4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:' + (process.env.PORT || 4173)));
