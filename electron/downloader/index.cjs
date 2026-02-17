/**
 * Downloader module — re-exports all download functionality.
 *
 * Modules:
 *   settings.cjs  — proxy config, paths, yt-dlp binary location
 *   http.cjs      — HTTP GET/POST, file download with progress
 *   youtube.cjs   — YouTube-specific yt-dlp logic
 *   ytdlp.cjs     — yt-dlp binary management, generic platform downloads
 */
const { YTDLP_BIN, getProxySetting, setProxySetting } = require('./settings.cjs');
const { isYtDlpInstalled, installYtDlp } = require('./ytdlp.cjs');
const { getYouTubeInfo, downloadYouTube } = require('./youtube.cjs');
const { getGenericVideoInfo, downloadGenericMedia } = require('./ytdlp.cjs');

/**
 * Fetch video metadata via yt-dlp.
 */
async function getVideoInfo(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return getYouTubeInfo(url);
  }
  return getGenericVideoInfo(url);
}

/**
 * Download video or audio. YouTube uses yt-dlp. Others use yt-dlp.
 */
function downloadMedia(job, onProgress) {
  const { url } = job;
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return downloadYouTube(job, onProgress);
  }
  return downloadGenericMedia(job, onProgress);
}

/**
 * Check if yt-dlp is installed and ready.
 */
function isDownloadReady() {
  return isYtDlpInstalled();
}

/**
 * Install yt-dlp download engine.
 */
async function installDownloadTools(onProgress) {
  try {
    if (onProgress) onProgress({ status: 'downloading', message: 'Installing yt-dlp...' });
    await installYtDlp(onProgress);
  } catch (err) {
    throw new Error('Failed to install yt-dlp: ' + err.message);
  }
  return true;
}

module.exports = {
  isYtDlpInstalled,
  isDownloadReady,
  installYtDlp,
  installDownloadTools,
  getVideoInfo,
  downloadMedia,
  getProxySetting,
  setProxySetting,
  YTDLP_BIN,
};
