const path = require('node:path');

function localPath(value) {
  if (typeof value !== 'string' || value.length > 32767 || value.includes('\0') || !path.isAbsolute(value) || value.startsWith('\\\\')) {
    throw new Error('An absolute local file path is required.');
  }
  return path.resolve(value);
}

function validateJob(job) {
  if (!job || typeof job !== 'object') throw new Error('Invalid conversion job.');
  localPath(job.filePath);
  localPath(job.outputDir);
  if (typeof job.format !== 'string' || !/^[a-z0-9]{1,10}$/.test(job.format) || !['convert', 'compress'].includes(job.mode) ||
    !Number.isFinite(job.quality) || job.quality < 1 || job.quality > 100) throw new Error('Invalid conversion options.');
}

function mediaUrl(value) {
  if (typeof value !== 'string' || value.length > 8192) throw new Error('Invalid media URL.');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP or HTTPS media URL.');
  return url.href;
}

module.exports = { localPath, validateJob, mediaUrl };
