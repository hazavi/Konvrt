const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const sharp = require('sharp');
const { Jimp } = require('jimp');
const fs = require('fs');
const PDFDocument = require('pdfkit');

ffmpeg.setFfmpegPath(ffmpegPath);

// Lazy-load mupdf (ESM-only, loaded via dynamic import)
let _mupdf = null;
async function getMupdf() {
  if (!_mupdf) _mupdf = await import('mupdf');
  return _mupdf;
}

// ── Media type detection ──────────────────────────────────────

const VIDEO_EXTS = new Set(['.mp4','.mkv','.avi','.mov','.webm','.flv','.wmv','.ts','.m2ts','.mts','.3gp','.ogv','.vob','.mpg','.mpeg','.m4v','.divx','.asf','.rm','.rmvb','.f4v']);
const AUDIO_EXTS = new Set(['.mp3','.wav','.ogg','.flac','.aac','.wma','.m4a','.opus','.alac','.aiff','.ape','.ac3','.dts','.amr','.au','.ra','.wv']);
const IMAGE_EXTS = new Set(['.jpg','.jpeg','.png','.gif','.bmp','.tiff','.tif','.webp','.svg','.avif','.heic','.heif','.ico','.jxl','.jp2','.psd','.raw','.cr2','.nef','.dng']);
const PDF_EXTS = new Set(['.pdf']);

// Audio formats for video→audio extraction detection
const AUDIO_OUTPUT_FORMATS = new Set(['mp3','wav','ogg','flac','aac','m4a','wma','opus','aiff','ac3','alac']);

// Formats Sharp handles natively
const SHARP_OUTPUT = new Set(['jpg','jpeg','png','webp','avif','tiff','gif','heif']);
// Formats we fall back to Jimp for
const JIMP_OUTPUT = new Set(['bmp']);

function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (PDF_EXTS.has(ext)) return 'pdf';
  return null;
}

// ── Processing entry point ────────────────────────────────────

async function processFile(job, onProgress) {
  const { filePath, outputDir, format, quality, mode } = job;
  const mediaType = getMediaType(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const isCompress = mode === 'compress';

  // For compress mode, use the same format as input
  let outputFormat = isCompress ? path.extname(filePath).slice(1).toLowerCase() : format;
  // Normalize jpeg → jpg
  if (outputFormat === 'jpeg') outputFormat = 'jpg';

  const suffix = isCompress ? '_compressed' : '';
  const outputPath = path.join(outputDir, `${baseName}${suffix}.${outputFormat}`);
  const safePath = getUniquePath(outputPath);

  // PDF-specific routing
  if (mediaType === 'pdf') {
    return convertPdfToImage(filePath, safePath, outputFormat, quality, onProgress);
  }
  if (outputFormat === 'pdf' && mediaType === 'image') {
    return convertImageToPdf(filePath, safePath, quality, onProgress);
  }

  // Video → Audio extraction (e.g., mp4 → mp3, mkv → m4a)
  if (mediaType === 'video' && AUDIO_OUTPUT_FORMATS.has(outputFormat)) {
    return extractAudioFromVideo(filePath, safePath, outputFormat, quality, onProgress);
  }

  switch (mediaType) {
    case 'video':
      return convertVideo(filePath, safePath, outputFormat, quality, onProgress, isCompress);
    case 'audio':
      return convertAudio(filePath, safePath, outputFormat, quality, onProgress, isCompress);
    case 'image':
      return convertImage(filePath, safePath, outputFormat, quality, onProgress, isCompress);
    default:
      throw new Error(`Unsupported file type: ${path.extname(filePath)}`);
  }
}

function getUniquePath(filePath) {
  if (!fs.existsSync(filePath)) return filePath;
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  let counter = 1;
  let candidate;
  do {
    candidate = path.join(dir, `${base} (${counter})${ext}`);
    counter++;
  } while (fs.existsSync(candidate));
  return candidate;
}

// ── Video conversion ──────────────────────────────────────────

function convertVideo(input, output, format, quality, onProgress, isCompress) {
  return new Promise((resolve, reject) => {
    let totalDuration = 0;

    const command = ffmpeg(input)
      .toFormat(ffmpegFormatAlias(format))
      .on('codecData', (data) => {
        totalDuration = parseDuration(data.duration);
      })
      .on('progress', (progress) => {
        if (totalDuration > 0) {
          const current = parseDuration(progress.timemark);
          const pct = Math.min(100, Math.round((current / totalDuration) * 100));
          onProgress(pct);
        }
      })
      .on('end', () => {
        onProgress(100);
        resolve(output);
      })
      .on('error', (err) => reject(err));

    if (['mp4', 'mkv', 'webm', 'avi', 'mov', 'ts', '3gp', 'ogv', 'm4v', 'flv', 'wmv'].includes(format)) {
      if (isCompress) {
        // Compress mode: CRF 18-28 range (lower = better quality), fast presets for speed
        const crf = Math.round(28 - (quality / 100) * 10);
        const preset = quality > 85 ? 'medium' : 'fast';
        if (format === 'webm' || format === 'ogv') {
          command.videoCodec('libvpx-vp9').addOptions([`-crf`, `${crf}`, `-b:v`, `0`, `-cpu-used`, `4`]);
        } else {
          command.videoCodec('libx264').addOptions([`-crf`, `${crf}`, `-preset`, `${preset}`]);
        }
        // Copy audio at good quality instead of re-encoding
        command.audioCodec('aac').audioBitrate('192k');
      } else {
        // Convert mode: quality 100→CRF 0, quality 1→CRF 40
        const crf = Math.round(40 - (quality / 100) * 40);
        if (format === 'webm' || format === 'ogv') {
          command.videoCodec('libvpx-vp9').addOptions([`-crf`, `${crf}`, `-b:v`, `0`]);
        } else {
          command.videoCodec('libx264').addOptions([`-crf`, `${crf}`, `-preset`, `medium`]);
        }
      }
    }

    command.save(output);
  });
}

// ── Audio conversion ──────────────────────────────────────────

function convertAudio(input, output, format, quality, onProgress, isCompress) {
  return new Promise((resolve, reject) => {
    let totalDuration = 0;

    const command = ffmpeg(input)
      .toFormat(ffmpegFormatAlias(format))
      .on('codecData', (data) => {
        totalDuration = parseDuration(data.duration);
      })
      .on('progress', (progress) => {
        if (totalDuration > 0) {
          const current = parseDuration(progress.timemark);
          const pct = Math.min(100, Math.round((current / totalDuration) * 100));
          onProgress(pct);
        }
      })
      .on('end', () => {
        onProgress(100);
        resolve(output);
      })
      .on('error', (err) => reject(err));

    if (isCompress) {
      // Compress mode: preserve quality — 128-256kbps range, no sample rate reduction
      const bitrate = Math.round(128 + (quality / 100) * 128);
      command.audioBitrate(`${bitrate}k`);
    } else {
      // Convert mode: quality 100→320kbps, quality 1→64kbps
      const bitrate = Math.round(64 + (quality / 100) * 256);
      command.audioBitrate(`${bitrate}k`);
    }

    command.save(output);
  });
}

// ── Video → Audio extraction ──────────────────────────────────

function extractAudioFromVideo(input, output, format, quality, onProgress) {
  return new Promise((resolve, reject) => {
    let totalDuration = 0;

    const command = ffmpeg(input)
      .noVideo()
      .toFormat(ffmpegFormatAlias(format))
      .on('codecData', (data) => {
        totalDuration = parseDuration(data.duration);
      })
      .on('progress', (progress) => {
        if (totalDuration > 0) {
          const current = parseDuration(progress.timemark);
          const pct = Math.min(100, Math.round((current / totalDuration) * 100));
          onProgress(pct);
        }
      })
      .on('end', () => {
        onProgress(100);
        resolve(output);
      })
      .on('error', (err) => reject(err));

    // Set quality based on format
    if (['wav', 'flac', 'alac', 'aiff'].includes(format)) {
      // Lossless — no bitrate needed
      if (format === 'flac') command.audioCodec('flac');
      if (format === 'alac') command.audioCodec('alac');
    } else {
      // Lossy — quality maps to bitrate: 100→320k, 50→192k, 1→64k
      const bitrate = Math.round(64 + (quality / 100) * 256);
      command.audioBitrate(`${bitrate}k`);
    }

    command.save(output);
  });
}

// ── Image conversion ──────────────────────────────────────────

async function convertImage(input, output, format, quality, onProgress, isCompress) {
  onProgress(10);

  const fmt = format.toLowerCase();

  if (SHARP_OUTPUT.has(fmt)) {
    let pipeline = sharp(input);

    // For compress mode, use smart compression without destroying quality
    let effectiveQuality = Math.round(quality);
    if (isCompress) {
      // Gentle quality reduction: quality 100→92, 80→74, 50→50
      effectiveQuality = Math.max(30, Math.round(quality * 0.92));
      // Strip metadata for smaller file size
      pipeline = pipeline.withMetadata(false);
    }

    const opts = { quality: effectiveQuality };

    switch (fmt) {
      case 'jpg':
      case 'jpeg':
        pipeline = pipeline.jpeg(opts);
        break;
      case 'png':
        if (isCompress) {
          // High compression level with adaptive filtering, no palette reduction to preserve quality
          pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 });
        } else {
          pipeline = pipeline.png({ compressionLevel: Math.round(9 - (quality / 100) * 9) });
        }
        break;
      case 'webp':
        pipeline = pipeline.webp(opts);
        break;
      case 'avif':
        pipeline = pipeline.avif(opts);
        break;
      case 'tiff':
        pipeline = pipeline.tiff({ quality: opts.quality });
        break;
      case 'gif':
        pipeline = pipeline.gif();
        break;
      case 'heif':
        pipeline = pipeline.heif(opts);
        break;
    }

    onProgress(50);
    await pipeline.toFile(output);
    onProgress(100);
    return output;
  }

  if (JIMP_OUTPUT.has(fmt)) {
    // Fallback to Jimp for BMP and other formats Sharp doesn't write
    onProgress(20);
    const image = await Jimp.read(input);
    onProgress(60);
    await image.write(output);
    onProgress(100);
    return output;
  }

  if (fmt === 'ico') {
    return convertImageToIco(input, output, onProgress);
  }

  if (fmt === 'svg') {
    return convertImageToSvg(input, output, onProgress);
  }

  throw new Error(`Unsupported image output format: ${format}`);
}

// ── Image → SVG conversion (raster embed) ─────────────────────

async function convertImageToSvg(input, output, onProgress) {
  try {
    onProgress(10);

    // First flatten alpha (screenshots may have transparency) and ensure 8-bit sRGB
    const pipeline = sharp(input).flatten({ background: { r: 255, g: 255, b: 255 } }).toColorspace('srgb');
    const metadata = await sharp(input).metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 600;
    onProgress(30);

    // Convert to PNG buffer for embedding
    const pngBuffer = await pipeline.png({ compressionLevel: 6 }).toBuffer();
    onProgress(60);

    const base64 = pngBuffer.toString('base64');
    const svg = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `  <image width="${width}" height="${height}" href="data:image/png;base64,${base64}"/>`,
      '</svg>',
    ].join('\n');

    onProgress(80);
    fs.writeFileSync(output, svg, 'utf8');
    onProgress(100);
    return output;
  } catch (err) {
    throw new Error('SVG conversion failed: ' + (err.message || err));
  }
}

// ── Image → ICO conversion ────────────────────────────────────

async function convertImageToIco(input, output, onProgress) {
  // Standard ICO sizes (largest first for best quality)
  const sizes = [256, 128, 64, 48, 32, 16];
  onProgress(10);

  // Generate PNG buffers at each size
  const pngBuffers = [];
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const buf = await sharp(input)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers.push(buf);
    onProgress(10 + Math.round((i + 1) / sizes.length * 60));
  }

  // Build ICO file structure
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;
  let dataOffset = headerSize + dirSize;

  // ICONDIR header: reserved(2) + type(2, 1=ICO) + count(2)
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);          // reserved
  header.writeUInt16LE(1, 2);          // type = ICO
  header.writeUInt16LE(numImages, 4);  // image count

  // ICONDIRENTRY array
  const dirEntries = Buffer.alloc(dirSize);
  for (let i = 0; i < numImages; i++) {
    const size = sizes[i];
    const offset = i * dirEntrySize;
    dirEntries.writeUInt8(size >= 256 ? 0 : size, offset);      // width (0 = 256)
    dirEntries.writeUInt8(size >= 256 ? 0 : size, offset + 1);  // height (0 = 256)
    dirEntries.writeUInt8(0, offset + 2);                        // color palette
    dirEntries.writeUInt8(0, offset + 3);                        // reserved
    dirEntries.writeUInt16LE(1, offset + 4);                     // color planes
    dirEntries.writeUInt16LE(32, offset + 6);                    // bits per pixel
    dirEntries.writeUInt32LE(pngBuffers[i].length, offset + 8);  // image data size
    dirEntries.writeUInt32LE(dataOffset, offset + 12);            // image data offset
    dataOffset += pngBuffers[i].length;
  }

  onProgress(80);

  // Write the ICO file
  const icoBuffer = Buffer.concat([header, dirEntries, ...pngBuffers]);
  fs.writeFileSync(output, icoBuffer);

  onProgress(100);
  return output;
}

// ── PDF → Image conversion (mupdf) ───────────────────────────

async function convertPdfToImage(input, output, format, quality, onProgress) {
  onProgress(5);
  const mupdf = await getMupdf();
  const fileData = fs.readFileSync(input);
  const doc = mupdf.Document.openDocument(fileData, 'application/pdf');
  const pageCount = doc.countPages();

  if (pageCount === 0) throw new Error('PDF has no pages');

  onProgress(15);

  // For single-page PDF, output one image
  // For multi-page, output page-numbered images and return first
  const dir = path.dirname(output);
  const ext = path.extname(output);
  const base = path.basename(output, ext);
  const outputPaths = [];

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    // Scale: 2x for good quality (150 DPI equivalent)
    const scaleFactor = Math.max(1, Math.min(4, quality / 25));
    const matrix = mupdf.Matrix.scale(scaleFactor, scaleFactor);
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);

    let imgBuffer;
    const fmt = format.toLowerCase();
    if (fmt === 'png') {
      imgBuffer = pixmap.asPNG();
    } else if (fmt === 'jpg' || fmt === 'jpeg') {
      imgBuffer = pixmap.asJPEG(Math.round(quality), false);
    } else {
      // For other formats (webp, avif, etc), get PNG then convert via Sharp
      imgBuffer = pixmap.asPNG();
    }

    const pageSuffix = pageCount > 1 ? `_page${i + 1}` : '';
    let pageOutput = path.join(dir, `${base}${pageSuffix}${ext}`);
    pageOutput = getUniquePath(pageOutput);

    if ((fmt === 'png' || fmt === 'jpg' || fmt === 'jpeg')) {
      fs.writeFileSync(pageOutput, imgBuffer);
    } else {
      // Convert via Sharp for webp, avif, tiff, etc
      const sharpPipeline = sharp(Buffer.from(imgBuffer));
      const opts = { quality: Math.round(quality) };
      switch (fmt) {
        case 'webp': sharpPipeline.webp(opts); break;
        case 'avif': sharpPipeline.avif(opts); break;
        case 'tiff': sharpPipeline.tiff({ quality: opts.quality }); break;
        case 'gif': sharpPipeline.gif(); break;
        case 'bmp':
          const jimpImg = await Jimp.read(Buffer.from(imgBuffer));
          await jimpImg.write(pageOutput);
          outputPaths.push(pageOutput);
          onProgress(Math.round(15 + ((i + 1) / pageCount) * 85));
          continue;
        default: sharpPipeline.png(); break;
      }
      await sharpPipeline.toFile(pageOutput);
    }

    outputPaths.push(pageOutput);
    onProgress(Math.round(15 + ((i + 1) / pageCount) * 85));
  }

  onProgress(100);
  return outputPaths[0];
}

// ── Image → PDF conversion (pdfkit) ──────────────────────────

async function convertImageToPdf(input, output, quality, onProgress) {
  onProgress(10);

  // Get image dimensions to set PDF page size
  const metadata = await sharp(input).metadata();
  const width = metadata.width || 595;
  const height = metadata.height || 842;

  onProgress(30);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [width, height],
      margin: 0,
      autoFirstPage: true,
    });

    const writeStream = fs.createWriteStream(output);
    doc.pipe(writeStream);

    doc.image(input, 0, 0, { width, height });
    doc.end();

    writeStream.on('finish', () => {
      onProgress(100);
      resolve(output);
    });
    writeStream.on('error', reject);
  });
}

// ── Helpers ───────────────────────────────────────────────────

function ffmpegFormatAlias(format) {
  const map = {
    mp4: 'mp4',
    mkv: 'matroska',
    avi: 'avi',
    mov: 'mov',
    webm: 'webm',
    flv: 'flv',
    wmv: 'asf',
    ts: 'mpegts',
    m2ts: 'mpegts',
    mts: 'mpegts',
    '3gp': '3gp',
    ogv: 'ogg',
    m4v: 'mp4',
    mpg: 'mpeg',
    mpeg: 'mpeg',
    mp3: 'mp3',
    wav: 'wav',
    ogg: 'ogg',
    flac: 'flac',
    aac: 'adts',
    wma: 'asf',
    m4a: 'ipod',
    opus: 'opus',
    aiff: 'aiff',
    ac3: 'ac3',
    alac: 'ipod',
  };
  return map[format] || format;
}

function parseDuration(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 3) return 0;
  const [h, m, s] = parts.map(Number);
  return h * 3600 + m * 60 + s;
}

module.exports = { processFile };
