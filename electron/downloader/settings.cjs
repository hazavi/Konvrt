/**
 * Settings management — proxy config, paths, yt-dlp binary location.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const YTDLP_DIR = path.join(os.homedir(), '.konvrt');
const YTDLP_BIN = path.join(YTDLP_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const SETTINGS_PATH = path.join(YTDLP_DIR, 'settings.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
  } catch {}
  return {};
}

function saveSettings(settings) {
  ensureDir(YTDLP_DIR);
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function getProxySetting() {
  return loadSettings().proxy || '';
}

function setProxySetting(proxy) {
  const settings = loadSettings();
  settings.proxy = (proxy || '').trim();
  saveSettings(settings);
}

module.exports = {
  YTDLP_DIR,
  YTDLP_BIN,
  SETTINGS_PATH,
  ensureDir,
  loadSettings,
  saveSettings,
  getProxySetting,
  setProxySetting,
};
