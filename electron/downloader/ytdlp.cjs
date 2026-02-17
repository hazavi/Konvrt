/**
 * yt-dlp binary management and generic (non-YouTube) downloads.
 */
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const YTDlpWrap = require('yt-dlp-wrap').default;
const _ffmpegPath = require('ffmpeg-static');

const { YTDLP_DIR, YTDLP_BIN, ensureDir, getProxySetting } = require('./settings.cjs');

// Resolve ffmpeg path — handle Electron asar packaging
const ffmpegPath = _ffmpegPath
  ? _ffmpegPath.replace(/\.asar([/\\])/, '.asar.unpacked$1')
  : null;

let ytDlpInstance = null;

/**
 * Check if yt-dlp binary exists.
 */
function isYtDlpInstalled() {
  return fs.existsSync(YTDLP_BIN);
}

/**
 * Download yt-dlp binary from GitHub releases.
 */
async function installYtDlp(onProgress) {
  ensureDir(YTDLP_DIR);
  if (onProgress) onProgress({ status: 'downloading', message: 'Downloading yt-dlp...' });

  try {
    await YTDlpWrap.downloadFromGithub(YTDLP_BIN);
    if (onProgress) onProgress({ status: 'done', message: 'yt-dlp installed successfully' });
    return true;
  } catch (err) {
    if (onProgress) onProgress({ status: 'error', message: `Failed to install yt-dlp: ${err.message}` });
    throw err;
  }
}

/**
 * Get or create yt-dlp instance.
 */
function getYtDlp() {
  if (!ytDlpInstance) {
    if (!isYtDlpInstalled()) {
      throw new Error('yt-dlp is not installed. Please install it first.');
    }
    ytDlpInstance = new YTDlpWrap(YTDLP_BIN);
  }
  return ytDlpInstance;
}

/**
 * Fetch video metadata for non-YouTube platforms using yt-dlp.
 */
function getGenericVideoInfo(url) {
  return new Promise((resolve) => {
    const args = [
      url,
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--skip-download',
      '--no-check-formats',
      '--socket-timeout', '15',
    ];

    execFile(YTDLP_BIN, args, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    }, (error, stdout) => {
      if (error) {
        return resolve({ success: false, error: error.message || 'Failed to fetch video info' });
      }
      try {
        const lines = stdout.trim().split('\n');
        let info = null;
        for (let i = lines.length - 1; i >= 0; i--) {
          try { info = JSON.parse(lines[i]); break; } catch {}
        }
        if (!info) {
          return resolve({ success: false, error: 'Could not parse video info' });
        }
        return resolve({
          success: true,
          data: {
            id: info.id || '',
            title: info.title || 'Unknown',
            thumbnail: info.thumbnail || info.thumbnails?.[info.thumbnails.length - 1]?.url || '',
            duration: info.duration || 0,
            uploader: info.uploader || info.channel || info.creator || 'Unknown',
            platform: info.extractor_key || info.extractor || 'Unknown',
            url: info.webpage_url || url,
            description: (info.description || '').substring(0, 200),
          },
        });
      } catch (err) {
        return resolve({ success: false, error: 'Parse error: ' + err.message });
      }
    });
  });
}

/**
 * Download non-YouTube media using yt-dlp spawn with progress tracking.
 */
function downloadGenericMedia(job, onProgress) {
  return new Promise((resolve, reject) => {
    const { url, outputDir, format, quality } = job;
    ensureDir(outputDir);

    if (!isYtDlpInstalled()) {
      return reject(new Error('yt-dlp is not installed'));
    }

    const isAudio = ['mp3', 'aac', 'm4a', 'wav', 'flac', 'ogg', 'opus'].includes(format);
    const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');

    const args = [url];

    if (isAudio) {
      const aq = quality === 'best' || quality === '1080' ? '0' : quality === '720' ? '3' : '5';
      args.push('-x', '--audio-format', format, '--audio-quality', aq);
    } else {
      // Prefer container-native streams to avoid transcoding issues (no-sound bug).
      const isMp4 = format === 'mp4';
      const isWebm = format === 'webm';
      let formatSpec;
      if (quality === 'best') {
        if (isMp4) {
          formatSpec = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
        } else if (isWebm) {
          formatSpec = 'bestvideo[ext=webm]+bestaudio[ext=webm]/bestvideo+bestaudio/best';
        } else {
          formatSpec = 'bestvideo+bestaudio/best';
        }
      } else {
        const h = quality === '1080' ? '1080' : quality === '720' ? '720' : '480';
        if (isMp4) {
          formatSpec = `bestvideo[ext=mp4][height<=${h}]+bestaudio[ext=m4a]/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`;
        } else if (isWebm) {
          formatSpec = `bestvideo[ext=webm][height<=${h}]+bestaudio[ext=webm]/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`;
        } else {
          formatSpec = `bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`;
        }
      }
      args.push('-f', formatSpec, '--merge-output-format', format);
    }

    args.push(
      '-o', outputTemplate,
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--no-check-formats',
      '--newline',
      '--progress',
      '--geo-bypass',
      '--socket-timeout', '30',
    );

    const proxy = getProxySetting();
    if (proxy) args.push('--proxy', proxy);
    if (ffmpegPath) args.push('--ffmpeg-location', path.dirname(ffmpegPath));

    let lastOutputPath = '';
    let hasResolved = false;
    let allOutput = '';
    const IDLE_TIMEOUT_MS = 60000;
    let idleTimer = null;

    function resetIdleTimer() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          try { proc.kill('SIGTERM'); } catch {}
          reject(new Error('Download stalled - no output for 30 seconds. Check your network connection.'));
        }
      }, IDLE_TIMEOUT_MS);
    }

    const proc = spawn(YTDLP_BIN, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    resetIdleTimer();

    function parseLine(line) {
      if (!line) return;
      resetIdleTimer();

      const destMatch = line.match(/Destination:\s*(.+)/);
      if (destMatch) lastOutputPath = destMatch[1].trim();

      const mergeMatch = line.match(/Merging formats into "(.+?)"/);
      if (mergeMatch) lastOutputPath = mergeMatch[1].trim();

      const progressMatch = line.match(
        /\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\S+)\s+at\s+([\d.]+\S+)\s+ETA\s+(\S+)/
      );
      if (progressMatch && onProgress) {
        onProgress({
          percent: parseFloat(progressMatch[1]) || 0,
          totalSize: progressMatch[2] || '',
          currentSpeed: progressMatch[3] || '',
          eta: progressMatch[4] || '',
        });
        return;
      }

      const simpleProgress = line.match(/\[download\]\s+([\d.]+)%/);
      if (simpleProgress && onProgress) {
        onProgress({ percent: parseFloat(simpleProgress[1]) || 0, totalSize: '', currentSpeed: '', eta: '' });
      }
    }

    let stdoutBuf = '';
    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      allOutput += text;
      stdoutBuf += text;
      const lines = stdoutBuf.split(/\r?\n/);
      stdoutBuf = lines.pop();
      lines.forEach(parseLine);
    });

    let stderrBuf = '';
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      allOutput += text;
      stderrBuf += text;
      const lines = stderrBuf.split(/\r?\n/);
      stderrBuf = lines.pop();
      lines.forEach(parseLine);
    });

    proc.on('error', (err) => {
      if (idleTimer) clearTimeout(idleTimer);
      if (!hasResolved) { hasResolved = true; reject(err); }
    });

    proc.on('close', (code) => {
      if (idleTimer) clearTimeout(idleTimer);
      if (stdoutBuf) parseLine(stdoutBuf);
      if (stderrBuf) parseLine(stderrBuf);

      if (hasResolved) return;
      hasResolved = true;

      if (code !== 0 && code !== null) {
        const errLine = allOutput.split('\n').find(l => /ERROR/i.test(l));
        return reject(new Error(errLine || `yt-dlp exited with code ${code}`));
      }

      if (onProgress) onProgress({ percent: 100, totalSize: '', currentSpeed: '', eta: '' });

      if (lastOutputPath && fs.existsSync(lastOutputPath)) {
        resolve({ success: true, outputPath: lastOutputPath });
      } else {
        const recent = findRecentFile(outputDir);
        resolve({ success: true, outputPath: recent || outputDir });
      }
    });
  });
}

function findRecentFile(dir) {
  try {
    const files = fs.readdirSync(dir)
      .map(f => {
        const fp = path.join(dir, f);
        try {
          const stat = fs.statSync(fp);
          return { path: fp, mtime: stat.mtimeMs };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0 && (Date.now() - files[0].mtime) < 60000) {
      return files[0].path;
    }
    return null;
  } catch { return null; }
}

module.exports = {
  isYtDlpInstalled,
  installYtDlp,
  getYtDlp,
  getGenericVideoInfo,
  downloadGenericMedia,
};
