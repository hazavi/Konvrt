/**
 * Downloader module — re-exports all download functionality.
 *
 * Modules:
 *   settings.cjs  — proxy config, paths, yt-dlp binary location
 *   http.cjs      — HTTP GET/POST, file download with progress
 *   youtube.cjs   — InnerTube API, direct download, YouTube-specific logic
 *   ytdlp.cjs     — yt-dlp binary management, generic platform downloads
 */
const { YTDLP_BIN, getProxySetting, setProxySetting } = require('./settings.cjs');
const { isYtDlpInstalled, installYtDlp } = require('./ytdlp.cjs');
const { getYouTubeInfo, downloadYouTube } = require('./youtube.cjs');
const { getGenericVideoInfo, downloadGenericMedia } = require('./ytdlp.cjs');

/**
 * Fetch video metadata. YouTube uses instant InnerTube API. Others use yt-dlp.
 */
async function getVideoInfo(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return getYouTubeInfo(url);
  }
  return getGenericVideoInfo(url);
}

/**
 * Download video or audio. YouTube uses InnerTube-based download. Others use yt-dlp.
 */
function downloadMedia(job, onProgress) {
  const { url } = job;
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return downloadYouTube(job, onProgress);
  }
  return downloadGenericMedia(job, onProgress);
}

module.exports = {
  isYtDlpInstalled,
  installYtDlp,
  getVideoInfo,
  downloadMedia,
  getProxySetting,
  setProxySetting,
  YTDLP_BIN,
};
