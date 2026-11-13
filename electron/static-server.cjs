const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https: konvrt-media:; media-src 'self' blob: konvrt-media:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function startStaticServer(root) {
  root = path.resolve(root);
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
        const name = decodeURIComponent(req.url.split('?')[0]);
        const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
        const relative = path.relative(root, file);
        if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); return res.end(); }
        const real = await fs.promises.realpath(file);
        const realRelative = path.relative(await fs.promises.realpath(root), real);
        if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) { res.writeHead(403); return res.end(); }
        const stat = await fs.promises.stat(real);
        if (!stat.isFile()) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
          'Content-Length': stat.size, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': CSP,
          'Cache-Control': relative.startsWith('assets' + path.sep) ? 'public, max-age=31536000, immutable' : 'no-cache' });
        if (req.method === 'HEAD') return res.end();
        pipeline(fs.createReadStream(real), res, () => {});
      } catch (err) {
        res.writeHead(err instanceof URIError ? 400 : err.code === 'ENOENT' ? 404 : 500); res.end();
      }
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
module.exports = { startStaticServer };
