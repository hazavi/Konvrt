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

const VIDEO_EXTS = new Set(['.mp4','.mkv','.avi','.mov','.webm','.flv','.wmv']);
const AUDIO_EXTS = new Set(['.mp3','.wav','.ogg','.flac','.aac','.wma','.m4a']);
const IMAGE_EXTS = new Set(['.jpg','.jpeg','.png','.gif','.bmp','.tiff','.webp','.svg','.avif','.heic']);
const PDF_EXTS = new Set(['.pdf']);

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

    if (['mp4', 'mkv', 'webm', 'avi', 'mov'].includes(format)) {
      if (isCompress) {
        // Compress mode: quality 100→CRF 18, quality 50→CRF 28, quality 1→CRF 40
        const crf = Math.round(40 - (quality / 100) * 22);
        const preset = quality > 70 ? 'slow' : quality > 40 ? 'medium' : 'faster';
        if (format === 'webm') {
          command.videoCodec('libvpx-vp9').addOptions([`-crf`, `${crf}`, `-b:v`, `0`]);
        } else {
          command.videoCodec('libx264').addOptions([`-crf`, `${crf}`, `-preset`, `${preset}`]);
        }
        // Scale down if quality is low to further reduce size
        if (quality < 50) {
          command.addOptions(['-vf', 'scale=iw*3/4:ih*3/4']);
        }
      } else {
        // Convert mode: quality 100→CRF 0, quality 1→CRF 51
        const crf = Math.round(51 - (quality / 100) * 51);
        if (format === 'webm') {
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
      // Compress mode: quality 100→128kbps, quality 50→64kbps, quality 1→32kbps
      const bitrate = Math.round(32 + (quality / 100) * 96);
      command.audioBitrate(`${bitrate}k`);
      // Also reduce sample rate for lower quality
      if (quality < 50) command.audioFrequency(22050);
    } else {
      // Convert mode: quality 100→320kbps, quality 1→32kbps
      const bitrate = Math.round(32 + (quality / 100) * 288);
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

    // For compress mode, reduce quality further and optionally resize
    let effectiveQuality = Math.round(quality);
    if (isCompress) {
      // Map quality 100→70, 50→35, 1→5 for aggressive compression
      effectiveQuality = Math.max(5, Math.round(quality * 0.7));
      // Resize if quality is very low (< 40%) for extra savings
      if (quality < 40) {
        const meta = await sharp(input).metadata();
        if (meta.width && meta.width > 800) {
          pipeline = pipeline.resize({ width: Math.round(meta.width * 0.75), withoutEnlargement: true });
        }
      }
    }

    const opts = { quality: effectiveQuality };

    switch (fmt) {
      case 'jpg':
      case 'jpeg':
        pipeline = pipeline.jpeg(opts);
        break;
      case 'png':
        if (isCompress) {
          // Max compression level (9) with reduced colors
          pipeline = pipeline.png({ compressionLevel: 9, palette: quality < 60 });
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

  throw new Error(`Unsupported image output format: ${format}`);
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
    mp3: 'mp3',
    wav: 'wav',
    ogg: 'ogg',
    flac: 'flac',
    aac: 'adts',
    wma: 'asf',
    m4a: 'ipod',
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
