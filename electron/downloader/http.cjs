const https = require('node:https');
const fs = require('node:fs');
const { pipeline } = require('node:stream/promises');

function response(url, headers = {}, redirects = 0, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    if (target.protocol !== 'https:') return reject(new Error('Downloads require HTTPS.'));
    if (redirects > 5) return reject(new Error('Too many redirects.'));
    const req = https.get(target, { headers: { 'User-Agent': 'Konvrt', ...headers }, timeout }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, target);
        return response(next, next.origin === target.origin ? headers : {}, redirects + 1, timeout).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume(); return reject(new Error(`HTTP ${res.statusCode}`));
      }
      resolve(res);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Connection timed out.')));
  });
}

async function httpGet(url, timeout = 10000) {
  const res = await response(url, {}, 0, timeout);
  let size = 0;
  const chunks = [];
  for await (const chunk of res) {
    size += chunk.length;
    if (size > 10 * 1024 * 1024) { res.destroy(); throw new Error('Response is too large.'); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function httpsPost(hostname, urlPath, body, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({ hostname, path: urlPath, method: 'POST', timeout,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, async res => {
      try {
        if (res.statusCode < 200 || res.statusCode >= 300) { res.resume(); throw new Error(`HTTP ${res.statusCode}`); }
        let size = 0;
        const chunks = [];
        for await (const chunk of res) {
          size += chunk.length;
          if (size > 10 * 1024 * 1024) { res.destroy(); throw new Error('Response is too large.'); }
          chunks.push(chunk);
        }
        resolve(Buffer.concat(chunks).toString('utf8'));
      } catch (err) { reject(err); }
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Connection timed out.')));
    req.end(data);
  });
}

async function downloadToFile(url, destPath, onProgress, customHeaders) {
  const res = await response(url, customHeaders);
  const partial = destPath + '.part';
  const total = Number(res.headers['content-length']) || 0;
  let received = 0;
  let lastProgress = 0;
  res.on('data', chunk => {
    received += chunk.length;
    if (onProgress && total && Date.now() - lastProgress >= 100) {
      lastProgress = Date.now(); onProgress(received, total);
    }
  });
  try {
    // pipeline applies backpressure and rejects on truncated responses or disk errors.
    await pipeline(res, fs.createWriteStream(partial, { flags: 'wx' }));
    await fs.promises.rename(partial, destPath);
    if (onProgress && total) onProgress(received, total);
    return destPath;
  } catch (err) {
    await fs.promises.rm(partial, { force: true }).catch(() => {});
    throw err;
  }
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return bytes.toFixed(1) + ' ' + units[i];
}
module.exports = { httpGet, httpsPost, downloadToFile, formatBytes };
