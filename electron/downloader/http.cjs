/**
 * HTTP utilities — GET, POST, file download with progress, redirect handling.
 */
const https = require('https');
const fs = require('fs');

/**
 * Quick HTTPS GET that returns a string. Follows redirects.
 */
function httpGet(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, timeout).then(resolve, reject);
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP timeout')); });
  });
}

/**
 * HTTPS POST that returns a string.
 */
function httpsPost(hostname, urlPath, body, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      hostname, path: urlPath, method: 'POST', timeout,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let result = '';
      res.on('data', (chunk) => result += chunk);
      res.on('end', () => resolve(result));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP timeout')); });
    req.write(data);
    req.end();
  });
}

/**
 * Download a URL to a file with progress callback. Follows redirects.
 * Includes stall detection and SSL workaround for corporate networks.
 */
function downloadToFile(url, destPath, onProgress, customHeaders) {
  return new Promise((resolve, reject) => {
    let settled = false;
    function fail(err) { if (!settled) { settled = true; reject(err); } }

    function doGet(targetUrl, redirectCount = 0) {
      if (redirectCount > 5) return fail(new Error('Too many redirects'));
      const parsedUrl = new URL(targetUrl);
      const reqOpts = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        timeout: 20000,
        rejectUnauthorized: false,
        headers: customHeaders || {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept-Encoding': 'identity',
          'Connection': 'keep-alive',
        },
      };

      const req = https.get(reqOpts, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doGet(res.headers.location, redirectCount + 1);
        }
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          return fail(new Error(`HTTP ${res.statusCode} downloading stream`));
        }

        const totalBytes = parseInt(
          res.headers['content-length'] || res.headers['content-range']?.split('/')?.pop() || '0', 10
        );
        let downloaded = 0;
        const file = fs.createWriteStream(destPath);
        const startTime = Date.now();

        // Stall detection: if no data for 15s during download, abort
        const stallTimer = setInterval(() => {
          if (downloaded === 0 && Date.now() - startTime > 15000) {
            clearInterval(stallTimer);
            req.destroy();
            file.destroy();
            fail(new Error('Download stalled — no data received'));
          }
        }, 5000);

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);
          if (onProgress && totalBytes > 0) {
            onProgress(downloaded, totalBytes);
          }
        });

        res.on('end', () => {
          clearInterval(stallTimer);
          file.end(() => { if (!settled) { settled = true; resolve(destPath); } });
        });

        res.on('error', (err) => {
          clearInterval(stallTimer);
          file.destroy();
          fail(err);
        });
      });

      req.on('error', fail);
      req.on('timeout', () => { req.destroy(); fail(new Error('Connection timeout')); });
    }

    doGet(url);
  });
}

/**
 * Format bytes into human-readable string.
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let b = bytes;
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
  return b.toFixed(1) + ' ' + units[i];
}

module.exports = {
  httpGet,
  httpsPost,
  downloadToFile,
  formatBytes,
};
