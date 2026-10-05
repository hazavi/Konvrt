/**
 * yt-dlp format selection and ffmpeg location, shared by all download paths.
 */
const path = require('path');
const fs = require('fs');
const _ffmpegPath = require('ffmpeg-static');

// ffmpeg-static lives outside the asar archive in packaged builds.
const resolvedFfmpeg = _ffmpegPath
  ? _ffmpegPath.replace(/\.asar([/\\])/, '.asar.unpacked$1')
  : null;
const ffmpegPath = resolvedFfmpeg && fs.existsSync(resolvedFfmpeg) ? resolvedFfmpeg : null;

const AUDIO_FORMATS = ['mp3', 'aac', 'm4a', 'wav', 'flac', 'ogg', 'opus'];

// Container-native streams avoid transcoding (and the no-sound bug).
const STREAM_EXT = {
  mp4: { video: '[ext=mp4]', audio: '[ext=m4a]' },
  webm: { video: '[ext=webm]', audio: '[ext=webm]' },
};

function buildAudioArgs(format, quality) {
  const q = quality === 'best' || quality === '1080' ? '0' : quality === '720' ? '3' : '5';
  return ['-x', '--audio-format', format, '--audio-quality', q];
}

function buildVideoArgs(format, quality) {
  const maxHeight = { 1080: 1080, 720: 720, 480: 480 }[quality];
  const cap = quality === 'best' ? '' : `[height<=${maxHeight || 480}]`;
  const ext = STREAM_EXT[format] || { video: '', audio: '' };

  // Without ffmpeg separate video/audio streams can't be merged, so only pick single-file formats.
  if (!ffmpegPath) {
    return ['-f', [`best${ext.video}${cap}`, `best${cap}`, 'best'].join('/')];
  }

  const spec = [
    ext.video && `bestvideo${ext.video}${cap}+bestaudio${ext.audio}`,
    `bestvideo${cap}+bestaudio`,
    `best${cap}`,
    'best',
  ].filter(Boolean);
  return ['-f', [...new Set(spec)].join('/'), '--merge-output-format', format];
}

/**
 * Format/ffmpeg arguments for a yt-dlp download job.
 */
function buildFormatArgs(format, quality) {
  const isAudio = AUDIO_FORMATS.includes(format);
  if (isAudio && !ffmpegPath) {
    throw new Error('ffmpeg is missing, so audio extraction is unavailable. Reinstall dependencies (npm install).');
  }

  const args = isAudio ? buildAudioArgs(format, quality) : buildVideoArgs(format, quality);
  if (ffmpegPath) args.push('--ffmpeg-location', path.dirname(ffmpegPath));
  return args;
}

module.exports = { buildFormatArgs };
