const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { validateJob, mediaUrl, localPath } = require('../electron/security.cjs');
const { startStaticServer } = require('../electron/static-server.cjs');

test('rejects traversal in conversion format, non-local paths and executable URL schemes', () => {
  const job = { filePath: path.resolve('source.png'), outputDir: path.resolve('output'), quality: 80, mode: 'convert', format: 'png' };
  validateJob(job);
  for (const format of ['../../outside', undefined, 'png/evil']) assert.throws(() => validateJob({ ...job, format }));
  assert.throws(() => validateJob({ ...job, quality: Infinity }));
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', '--exec=bad', 'https://user:secret@example.com']) assert.throws(() => mediaUrl(url));
  assert.equal(mediaUrl('https://example.com/video'), 'https://example.com/video');
  assert.throws(() => localPath('relative.png'));
  assert.throws(() => localPath('\\\\server\\share\\file.png'));
});

test('static server streams assets with CSP and rejects malformed paths and traversal', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'konvrt-server-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<html>Konvrt</html>');
  const server = await startStaticServer(dir);
  const get = requestPath => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: requestPath }, res => {
      let body = ''; res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
  try {
    const result = await get('/');
    assert.equal(result.status, 200);
    assert.equal(result.body, '<html>Konvrt</html>');
    assert.match(result.headers['content-security-policy'], /script-src 'self'/);
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
    assert.equal((await get('/%E0%A4%A')).status, 400);
    assert.equal((await get('/%2e%2e/outside')).status, 403);
    assert.equal((await get('/missing')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); }
});
