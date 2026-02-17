/**
 * YouTube-specific download logic — InnerTube API, direct download, stream selection.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const { ensureDir, getProxySetting, YTDLP_BIN } = require('./settings.cjs');
const { httpsPost, downloadToFile, formatBytes } = require('./http.cjs');
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

// ── InnerTube API ────────────────────────────────────────────

const INNERTUBE_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
const INNERTUBE_HOSTS = ['www.youtube.com', 'youtubei.googleapis.com', 'm.youtube.com'];

// Client configs for InnerTube — different clients may return different CDN servers
const INNERTUBE_CLIENTS = [
  { clientName: 'ANDROID', clientVersion: '19.09.36', androidSdkVersion: 34, label: 'android' },
  { clientName: 'WEB', clientVersion: '2.20240304.00.00', label: 'web' },
  { clientName: 'IOS', clientVersion: '19.09.3', label: 'ios' },
];

/**
 * Fetch YouTube InnerTube player data.
 * Tries multiple hostnames with a race — uses whichever responds first.
 * @param {string} videoId
 * @param {number} clientIdx - Index into INNERTUBE_CLIENTS (0 = ANDROID, 1 = WEB, 2 = IOS)
 */
async function fetchInnerTubePlayer(videoId, clientIdx = 0) {
  const clientConfig = INNERTUBE_CLIENTS[clientIdx] || INNERTUBE_CLIENTS[0];
  const ctx = { clientName: clientConfig.clientName, clientVersion: clientConfig.clientVersion };
  if (clientConfig.androidSdkVersion) ctx.androidSdkVersion = clientConfig.androidSdkVersion;

  const body = JSON.stringify({
    videoId,
    context: { client: ctx },
  });
  const apiPath = `/youtubei/v1/player?key=${INNERTUBE_KEY}`;

  const result = await Promise.any(
    INNERTUBE_HOSTS.map((host) =>
      httpsPost(host, apiPath, body, 20000).then((raw) => {
        const parsed = JSON.parse(raw);
        if (!parsed.playabilityStatus) throw new Error('Invalid response from ' + host);
        return parsed;
      })
    )
  ).catch(() => {
    throw new Error('All YouTube API endpoints timed out. Check your internet connection.');
  });

  return result;
}

// ── YouTube info fetch ───────────────────────────────────────

/**
 * Fast YouTube info fetch via InnerTube API (instant, includes duration).
 */
async function getYouTubeInfo(url) {
  const videoId = extractYouTubeId(url);
  if (!videoId) return { success: false, error: 'Invalid YouTube URL' };

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const player = await fetchInnerTubePlayer(videoId);

    if (player.playabilityStatus?.status !== 'OK') {
      return {
        success: false,
        error: player.playabilityStatus?.reason || 'Video is not available',
      };
    }

    const details = player.videoDetails || {};
    return {
      success: true,
      data: {
        id: videoId,
        title: details.title || 'Unknown',
        thumbnail: details.thumbnail?.thumbnails?.pop()?.url
          || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: parseInt(details.lengthSeconds || '0', 10),
        uploader: details.author || 'Unknown',
        platform: 'YouTube',
        url: canonicalUrl,
        description: (details.shortDescription || '').substring(0, 200),
      },
    };
  } catch (err) {
    return { success: false, error: 'Could not fetch YouTube info: ' + err.message };
  }
}

// ── YouTube download orchestrator ────────────────────────────

/**
 * Download a YouTube video/audio.
 * Strategy: Try direct download FIRST, fall back to yt-dlp.
 */
async function downloadYouTube(job, onProgress) {
  const { url, outputDir, format, quality } = job;
  ensureDir(outputDir);

  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error('Invalid YouTube URL');

  // 1. Get stream data from InnerTube
  if (onProgress) onProgress({ percent: 0, totalSize: '', currentSpeed: '', eta: 'Fetching streams...' });
  const player = await fetchInnerTubePlayer(videoId);

  if (player.playabilityStatus?.status !== 'OK') {
    throw new Error(player.playabilityStatus?.reason || 'Video not available');
  }

  const title = (player.videoDetails?.title || 'video')
    .replace(/[<>:"/\\|?*]/g, '_').substring(0, 200);
  const adaptiveFormats = player.streamingData?.adaptiveFormats || [];
  const combinedFormats = player.streamingData?.formats || [];
  const allFormats = [...adaptiveFormats, ...combinedFormats];

  // 2. Build yt-dlp compatible info JSON
  const androidHeaders = {
    'User-Agent': 'com.google.android.youtube/19.09.36 (Linux; U; Android 14; en_US) gzip',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
  };

  const ytdlpFormats = allFormats.filter(f => f.url).map(f => {
    const mime = f.mimeType || '';
    const isVideo = mime.startsWith('video/');
    const isAudioOnly = mime.startsWith('audio/');
    const container = mime.includes('mp4') ? 'mp4' : mime.includes('webm') ? 'webm' : 'mp4';
    const codecMatch = mime.match(/codecs="([^"]+)"/);
    const codec = codecMatch ? codecMatch[1] : '';
    const isCombined = isVideo && f.audioChannels;

    return {
      format_id: String(f.itag),
      url: f.url,
      ext: container,
      vcodec: isVideo ? (codec.split(',')[0].trim() || 'avc1') : 'none',
      acodec: isAudioOnly ? (codec || 'mp4a.40.2') :
        isCombined ? (codec.split(',')[1]?.trim() || 'mp4a.40.2') : 'none',
      width: f.width || 0,
      height: f.height || 0,
      filesize: parseInt(f.contentLength || '0', 10) || undefined,
      tbr: f.bitrate ? Math.round(f.bitrate / 1000) : undefined,
      fps: f.fps || undefined,
      asr: f.audioSampleRate ? parseInt(f.audioSampleRate) : undefined,
      audio_channels: f.audioChannels || (isAudioOnly ? 2 : undefined),
      protocol: 'https',
      http_headers: {
        'User-Agent': 'com.google.android.youtube/19.09.36 (Linux; U; Android 14; en_US) gzip',
      },
    };
  });

  if (ytdlpFormats.length === 0) throw new Error('No available streams');

  const infoJson = {
    id: videoId,
    title: title,
    formats: ytdlpFormats,
    webpage_url: `https://www.youtube.com/watch?v=${videoId}`,
    extractor: 'youtube',
    extractor_key: 'Youtube',
    duration: parseInt(player.videoDetails?.lengthSeconds || '0', 10),
    http_headers: androidHeaders,
  };

  const infoJsonPath = path.join(outputDir, `_tmp_${videoId}_info.json`);
  fs.writeFileSync(infoJsonPath, JSON.stringify(infoJson));

  const isAudio = ['mp3', 'aac', 'm4a', 'wav', 'flac', 'ogg', 'opus'].includes(format);

  // ── Try direct download FIRST (fastest, proper headers) ──────
  // Skip direct download if proxy is configured (direct https doesn't support proxies)
  const proxy = getProxySetting();
  if (!proxy) {
    if (onProgress) onProgress({ percent: 2, totalSize: '', currentSpeed: '', eta: 'Starting download...' });

    try {
      const result = await downloadYouTubeDirect(
        { videoId, title, format, quality, outputDir, isAudio, allFormats, adaptiveFormats, combinedFormats },
        onProgress
      );
      try { fs.unlinkSync(infoJsonPath); } catch {}
      return result;
    } catch (directErr) {
      console.log('[Konvrt] Direct download failed:', directErr.message, '- trying yt-dlp...');
    }
  } else {
    console.log('[Konvrt] Proxy configured, skipping direct download, using yt-dlp...');
  }

  // ── Fallback 1: yt-dlp with --load-info-json (Android CDN URLs) ──
  if (isYtDlpInstalled()) {
    if (onProgress) onProgress({ percent: 2, totalSize: '', currentSpeed: '', eta: proxy ? 'Downloading via proxy...' : 'Retrying with yt-dlp...' });
    try {
      const result = await downloadYouTubeViaYtDlp(
        { videoId, title, format, quality, outputDir, isAudio, infoJsonPath },
        onProgress
      );
      return result;
    } catch (err) {
      console.log('[Konvrt] yt-dlp with info-json failed:', err.message, '- trying alt CDN...');
    }
  }

  // ── Fallback 2: Try alternate InnerTube clients for different CDN servers ──
  if (!proxy) {
    for (let ci = 1; ci < INNERTUBE_CLIENTS.length; ci++) {
      try {
        const clientLabel = INNERTUBE_CLIENTS[ci].label;
        console.log(`[Konvrt] Trying InnerTube ${clientLabel} client...`);
        if (onProgress) onProgress({ percent: 2, totalSize: '', currentSpeed: '', eta: `Trying ${clientLabel} CDN...` });
        const altPlayer = await fetchInnerTubePlayer(videoId, ci);
        if (altPlayer.playabilityStatus?.status !== 'OK') continue;

        const altAdaptive = altPlayer.streamingData?.adaptiveFormats || [];
        const altCombined = altPlayer.streamingData?.formats || [];
        const altAll = [...altAdaptive, ...altCombined];
        if (altAll.filter(f => f.url).length === 0) continue;

        const result = await downloadYouTubeDirect(
          { videoId, title, format, quality, outputDir, isAudio, allFormats: altAll, adaptiveFormats: altAdaptive, combinedFormats: altCombined },
          onProgress
        );
        try { fs.unlinkSync(infoJsonPath); } catch {}
        return result;
      } catch (err) {
        console.log(`[Konvrt] Alt client ${INNERTUBE_CLIENTS[ci].label} failed:`, err.message);
      }
    }
  }

  // ── Fallback 3: Let yt-dlp handle everything natively (own extraction) ──
  if (isYtDlpInstalled()) {
    console.log('[Konvrt] Trying native yt-dlp extraction (no info-json)...');
    if (onProgress) onProgress({ percent: 2, totalSize: '', currentSpeed: '', eta: 'Trying native yt-dlp...' });
    try {
      const result = await downloadYouTubeNative(
        { url: `https://www.youtube.com/watch?v=${videoId}`, title, format, quality, outputDir, isAudio },
        onProgress
      );
      try { fs.unlinkSync(infoJsonPath); } catch {}
      return result;
    } catch (err) {
      try { fs.unlinkSync(infoJsonPath); } catch {}
      const hint = proxy
        ? 'Download failed. Your proxy may not be working -- try a different proxy address.'
        : 'Your network may be blocking YouTube CDN servers.\nSet a proxy (globe icon) or use a different network.';
      throw new Error(hint);
    }
  }

  try { fs.unlinkSync(infoJsonPath); } catch {}
  throw new Error('Download failed. Your network may be blocking YouTube CDN servers. Try setting a proxy in download settings.');
}

// ── yt-dlp based YouTube download ────────────────────────────

function downloadYouTubeViaYtDlp(opts, onProgress) {
  const { videoId, title, format, quality, outputDir, isAudio, infoJsonPath } = opts;
  const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');

  const args = ['--load-info-json', infoJsonPath];

  if (isAudio) {
    const aq = quality === 'best' || quality === '1080' ? '0' : quality === '720' ? '3' : '5';
    args.push('-x', '--audio-format', format, '--audio-quality', aq);
  } else {
    let formatSpec;
    if (quality === 'best') {
      formatSpec = 'bestvideo+bestaudio/best';
    } else if (quality === '1080') {
      formatSpec = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best';
    } else if (quality === '720') {
      formatSpec = 'bestvideo[height<=720]+bestaudio/best[height<=720]/best';
    } else {
      formatSpec = 'bestvideo[height<=480]+bestaudio/best[height<=480]/best';
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
    '--retries', '5',
    '--fragment-retries', '5',
    '--add-header', 'User-Agent:com.google.android.youtube/19.09.36 (Linux; U; Android 14; en_US) gzip',
  );

  const proxy = getProxySetting();
  if (proxy) args.push('--proxy', proxy);
  if (ffmpegPath) args.push('--ffmpeg-location', path.dirname(ffmpegPath));

  if (onProgress) onProgress({ percent: 2, totalSize: '', currentSpeed: '', eta: 'Starting download...' });

  return new Promise((resolve, reject) => {
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
          try { fs.unlinkSync(infoJsonPath); } catch {}
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
      try { fs.unlinkSync(infoJsonPath); } catch {}
      if (!hasResolved) { hasResolved = true; reject(err); }
    });

    proc.on('close', (code) => {
      if (idleTimer) clearTimeout(idleTimer);
      if (stdoutBuf) parseLine(stdoutBuf);
      if (stderrBuf) parseLine(stderrBuf);
      try { fs.unlinkSync(infoJsonPath); } catch {}

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

// ── Direct YouTube download ──────────────────────────────────

/**
 * Direct YouTube download — downloads streams via Node.js https
 * with proper Android headers, then merges with ffmpeg.
 */
async function downloadYouTubeDirect(opts, onProgress) {
  const { videoId, title, format, quality, outputDir, isAudio,
    allFormats, adaptiveFormats, combinedFormats } = opts;

  const safeTitle = (title || 'video').replace(/[<>:"/\\|?*]/g, '_').substring(0, 200);

  const ytHeaders = {
    'User-Agent': 'com.google.android.youtube/19.09.36 (Linux; U; Android 14; en_US) gzip',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive',
  };

  const videoFormats = adaptiveFormats
    .filter(f => f.url && (f.mimeType || '').startsWith('video/'))
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const audioFormats = adaptiveFormats
    .filter(f => f.url && (f.mimeType || '').startsWith('audio/'))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  if (isAudio) {
    const audioStream = audioFormats[0];
    if (!audioStream?.url) throw new Error('No audio stream available');

    const tmpAudio = path.join(outputDir, `_tmp_${videoId}_audio`);
    const outputPath = path.join(outputDir, `${safeTitle}.${format}`);

    try {
      await downloadToFile(audioStream.url, tmpAudio, (dl, total) => {
        if (onProgress) onProgress({
          percent: Math.round((dl / total) * 90) + 5,
          totalSize: formatBytes(total),
          currentSpeed: '',
          eta: '',
        });
      }, ytHeaders);

      if (onProgress) onProgress({ percent: 95, totalSize: '', currentSpeed: '', eta: 'Converting...' });
      await new Promise((resolve, reject) => {
        const proc = spawn(ffmpegPath, [
          '-y', '-i', tmpAudio,
          '-vn', '-acodec', format === 'mp3' ? 'libmp3lame' : format === 'ogg' ? 'libvorbis' : 'copy',
          ...(format === 'mp3' ? ['-q:a', '2'] : []),
          outputPath,
        ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        proc.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg convert failed')));
        proc.on('error', reject);
      });

      try { fs.unlinkSync(tmpAudio); } catch {}
      if (onProgress) onProgress({ percent: 100, totalSize: '', currentSpeed: '', eta: '' });
      return { success: true, outputPath };
    } catch (err) {
      try { fs.unlinkSync(tmpAudio); } catch {}
      throw err;
    }
  }

  // Video download
  const maxH = quality === 'best' ? 99999 : quality === '1080' ? 1080 : quality === '720' ? 720 : 480;

  const combined = combinedFormats
    .filter(f => f.url && (f.height || 0) <= maxH)
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

  const vidStream = videoFormats.filter(f => (f.height || 0) <= maxH)[0] || videoFormats[0];
  const audStream = audioFormats[0];

  const useAdaptive = vidStream?.url && audStream?.url && ffmpegPath;
  const useCombined = combined?.url;

  if (!useAdaptive && !useCombined) throw new Error('No suitable streams available');

  if (useAdaptive) {
    const tmpVideo = path.join(outputDir, `_tmp_${videoId}_video`);
    const tmpAudio = path.join(outputDir, `_tmp_${videoId}_audio`);
    const outputPath = path.join(outputDir, `${safeTitle}.${format || 'mp4'}`);

    try {
      if (onProgress) onProgress({ percent: 5, totalSize: '', currentSpeed: '', eta: 'Downloading video...' });
      const vidSize = parseInt(vidStream.contentLength || '0', 10);
      const audSize = parseInt(audStream.contentLength || '0', 10);
      const totalSize = vidSize + audSize;

      let videoDownloaded = 0;
      await downloadToFile(vidStream.url, tmpVideo, (dl) => {
        videoDownloaded = dl;
        if (onProgress && totalSize > 0) {
          onProgress({
            percent: Math.round((dl / totalSize) * 70) + 5,
            totalSize: formatBytes(totalSize),
            currentSpeed: '',
            eta: 'Downloading video...',
          });
        }
      }, ytHeaders);

      if (onProgress) onProgress({ percent: 75, totalSize: '', currentSpeed: '', eta: 'Downloading audio...' });
      await downloadToFile(audStream.url, tmpAudio, (dl) => {
        if (onProgress && totalSize > 0) {
          onProgress({
            percent: Math.round(((videoDownloaded + dl) / totalSize) * 70) + 5,
            totalSize: formatBytes(totalSize),
            currentSpeed: '',
            eta: 'Downloading audio...',
          });
        }
      }, ytHeaders);

      if (onProgress) onProgress({ percent: 90, totalSize: '', currentSpeed: '', eta: 'Merging...' });
      await new Promise((resolve, reject) => {
        const proc = spawn(ffmpegPath, [
          '-y', '-i', tmpVideo, '-i', tmpAudio,
          '-c', 'copy', '-movflags', '+faststart', outputPath,
        ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        proc.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg merge failed')));
        proc.on('error', reject);
      });

      try { fs.unlinkSync(tmpVideo); } catch {}
      try { fs.unlinkSync(tmpAudio); } catch {}
      if (onProgress) onProgress({ percent: 100, totalSize: '', currentSpeed: '', eta: '' });
      return { success: true, outputPath };
    } catch (err) {
      try { fs.unlinkSync(tmpVideo); } catch {}
      try { fs.unlinkSync(tmpAudio); } catch {}
      throw err;
    }
  }

  // Combined stream (lower quality but simpler)
  const outputPath = path.join(outputDir, `${safeTitle}.${format || 'mp4'}`);
  await downloadToFile(combined.url, outputPath, (dl, total) => {
    if (onProgress) onProgress({
      percent: Math.round((dl / total) * 95) + 3,
      totalSize: formatBytes(total),
      currentSpeed: '',
      eta: '',
    });
  }, ytHeaders);
  if (onProgress) onProgress({ percent: 100, totalSize: '', currentSpeed: '', eta: '' });
  return { success: true, outputPath };
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

/**
 * Native yt-dlp download — lets yt-dlp extract streams itself (different CDN strategy).
 * Used as final fallback when pre-fetched InnerTube URLs fail.
 */
function downloadYouTubeNative(opts, onProgress) {
  const { url, title, format, quality, outputDir, isAudio } = opts;
  const safeTitle = (title || 'video').replace(/[<>:"/\\|?*]/g, '_').substring(0, 200);
  const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');

  const args = [url];

  if (isAudio) {
    const aq = quality === 'best' || quality === '1080' ? '0' : quality === '720' ? '3' : '5';
    args.push('-x', '--audio-format', format, '--audio-quality', aq);
  } else {
    let formatSpec;
    if (quality === 'best') {
      formatSpec = 'bestvideo+bestaudio/best';
    } else if (quality === '1080') {
      formatSpec = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best';
    } else if (quality === '720') {
      formatSpec = 'bestvideo[height<=720]+bestaudio/best[height<=720]/best';
    } else {
      formatSpec = 'bestvideo[height<=480]+bestaudio/best[height<=480]/best';
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

  const proxy = getProxySetting();
  if (proxy) args.push('--proxy', proxy);
  if (ffmpegPath) args.push('--ffmpeg-location', path.dirname(ffmpegPath));

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
          reject(new Error('Native yt-dlp download timed out'));
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

module.exports = {
  extractYouTubeId,
  fetchInnerTubePlayer,
  getYouTubeInfo,
  downloadYouTube,
};
