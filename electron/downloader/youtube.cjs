/**
 * YouTube-specific download logic — pure yt-dlp.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const _ffmpegPath = require('ffmpeg-static');

const { ensureDir, getProxySetting, YTDLP_BIN } = require('./settings.cjs');

// Resolve ffmpeg path — handle Electron asar packaging
const ffmpegPath = _ffmpegPath
  ? _ffmpegPath.replace(/\.asar([/\\])/, '.asar.unpacked$1')
  : null;
const { isYtDlpInstalled } = require('./ytdlp.cjs');

// ── YouTube URL parsing ──────────────────────────────────────

/**
 * Extract YouTube video ID from various URL formats.
 */
function extractYouTubeId(url) {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ── YouTube info fetch via yt-dlp ────────────────────────────

/**
 * Fetch YouTube video info using yt-dlp --dump-json.
 */
async function getYouTubeInfo(url) {
  const videoId = extractYouTubeId(url);
  if (!videoId) return { success: false, error: 'Invalid YouTube URL' };

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

  if (!isYtDlpInstalled()) {
    return {
      success: true,
      data: {
        id: videoId,
        title: `YouTube Video (${videoId})`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 0,
        uploader: 'Unknown',
        platform: 'YouTube',
        url: canonicalUrl,
        description: '',
      },
    };
  }

  try {
    const args = [
      canonicalUrl,
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--socket-timeout', '20',
    ];

    const proxy = getProxySetting();
    if (proxy) args.push('--proxy', proxy);

    const info = await new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn(YTDLP_BIN, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch {}
        reject(new Error('Info fetch timed out'));
      }, 30000);

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error('Failed to parse yt-dlp output'));
        }
      });
    });

    return {
      success: true,
      data: {
        id: videoId,
        title: info.title || 'Unknown',
        thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: info.duration || 0,
        uploader: info.uploader || info.channel || 'Unknown',
        platform: 'YouTube',
        url: canonicalUrl,
        description: (info.description || '').substring(0, 200),
      },
    };
  } catch {
    return {
      success: true,
      data: {
        id: videoId,
        title: `YouTube Video (${videoId})`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 0,
        uploader: 'Unknown',
        platform: 'YouTube',
        url: canonicalUrl,
        description: '',
      },
    };
  }
}

// ── YouTube download ─────────────────────────────────────────

/**
 * Download a YouTube video/audio using yt-dlp directly.
 */
async function downloadYouTube(job, onProgress) {
  const { url, outputDir, format, quality } = job;
  ensureDir(outputDir);

  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error('Invalid YouTube URL');
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const proxy = getProxySetting();

  if (!isYtDlpInstalled()) {
    throw new Error('yt-dlp is not installed. Click "Install yt-dlp" first.');
  }

  const isAudio = ['mp3', 'aac', 'm4a', 'wav', 'flac', 'ogg', 'opus'].includes(format);
  const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');

  const args = [ytUrl];

  if (isAudio) {
    const aq = quality === 'best' || quality === '1080' ? '0' : quality === '720' ? '3' : '5';
    args.push('-x', '--audio-format', format, '--audio-quality', aq);
  } else {
    // Prefer container-native streams to avoid transcoding issues (no-sound bug).
    // MP4 → prefer h264 video (ext=mp4) + AAC audio (ext=m4a)
    // WEBM → prefer VP9 video (ext=webm) + Opus audio (ext=webm)
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
    '--newline',
    '--progress',
    '--geo-bypass',
    '--socket-timeout', '30',
    '--retries', '5',
    '--fragment-retries', '5',
  );

  if (proxy) args.push('--proxy', proxy);
  if (ffmpegPath) args.push('--ffmpeg-location', path.dirname(ffmpegPath));

  if (onProgress) onProgress({ percent: 1, totalSize: '', currentSpeed: '', eta: 'Starting yt-dlp...' });

  return new Promise((resolve, reject) => {
    let lastOutputPath = '';
    let hasResolved = false;
    let allOutput = '';
    const IDLE_TIMEOUT_MS = 90000;
    let idleTimer = null;

    function resetIdleTimer() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          try { proc.kill('SIGTERM'); } catch {}
          const hint = proxy
            ? 'Download timed out. Your proxy may not be working -- check the proxy address.'
            : 'Download timed out -- your network may be blocking YouTube.\nSet a proxy (e.g. socks5://127.0.0.1:1080) in the download settings.';
          reject(new Error(hint));
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
        let errorMsg = errLine || `yt-dlp exited with code ${code}`;
        if (/timed?\s*out|ETIMEDOUT|connect.*fail/i.test(allOutput) && !proxy) {
          errorMsg += '\n\nYour network may be blocking YouTube. Set a proxy in download settings.';
        }
        return reject(new Error(errorMsg));
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

// ── Helpers ──────────────────────────────────────────────────

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
  extractYouTubeId,
  getYouTubeInfo,
  downloadYouTube,
};
