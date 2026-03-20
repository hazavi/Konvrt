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
const DOCUMENT_EXTS = new Set(['.txt','.md','.markdown','.html','.htm','.csv','.json','.xml','.yaml','.yml','.tsv','.log','.rtf']);
const DOCUMENT_OUTPUT_FORMATS = new Set(['html','txt','md','csv','json','pdf']);
const VIDEO_OUTPUT_FORMATS = new Set(['mp4','mkv','avi','mov','webm','flv','wmv','ts','3gp','ogv','m4v','mpg','mpeg']);

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
  if (DOCUMENT_EXTS.has(ext)) return 'document';
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

  // Document conversion
  if (mediaType === 'document') {
    return convertDocument(filePath, safePath, outputFormat, quality, onProgress);
  }

  // Video → Audio extraction (e.g., mp4 → mp3, mkv → m4a)
  if (mediaType === 'video' && AUDIO_OUTPUT_FORMATS.has(outputFormat)) {
    return extractAudioFromVideo(filePath, safePath, outputFormat, quality, onProgress);
  }

  // Image → Video (e.g., animated GIF → MP4)
  if (mediaType === 'image' && VIDEO_OUTPUT_FORMATS.has(outputFormat)) {
    return convertVideo(filePath, safePath, outputFormat, quality, onProgress, isCompress);
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

// ── FFmpeg helper ─────────────────────────────────────────────

function runFfmpeg(input, output, format, onProgress, configureFn) {
  return new Promise((resolve, reject) => {
    let totalDuration = 0;
    const command = ffmpeg(input)
      .toFormat(ffmpegFormatAlias(format))
      .on('codecData', (data) => { totalDuration = parseDuration(data.duration); })
      .on('progress', (progress) => {
        if (totalDuration > 0) {
          const current = parseDuration(progress.timemark);
          onProgress(Math.min(100, Math.round((current / totalDuration) * 100)));
        }
      })
      .on('end', () => { onProgress(100); resolve(output); })
      .on('error', (err) => reject(err));

    configureFn(command);
    command.save(output);
  });
}

// ── Video conversion ──────────────────────────────────────────

function convertVideo(input, output, format, quality, onProgress, isCompress) {
  return runFfmpeg(input, output, format, onProgress, (command) => {
    if (['mp4', 'mkv', 'webm', 'avi', 'mov', 'ts', '3gp', 'ogv', 'm4v', 'flv', 'wmv'].includes(format)) {
      if (isCompress) {
        const crf = Math.round(28 - (quality / 100) * 10);
        const preset = quality > 85 ? 'medium' : 'fast';
        if (format === 'webm' || format === 'ogv') {
          command.videoCodec('libvpx-vp9').addOptions(['-crf', `${crf}`, '-b:v', '0', '-cpu-used', '4']);
        } else {
          command.videoCodec('libx264').addOptions(['-crf', `${crf}`, '-preset', preset]);
        }
        command.audioCodec('aac').audioBitrate('192k');
      } else {
        const crf = Math.round(40 - (quality / 100) * 40);
        if (format === 'webm' || format === 'ogv') {
          command.videoCodec('libvpx-vp9').addOptions(['-crf', `${crf}`, '-b:v', '0']);
        } else {
          command.videoCodec('libx264').addOptions(['-crf', `${crf}`, '-preset', 'medium']);
        }
      }
    }
  });
}

// ── Audio conversion ──────────────────────────────────────────

function convertAudio(input, output, format, quality, onProgress, isCompress) {
  return runFfmpeg(input, output, format, onProgress, (command) => {
    if (isCompress) {
      const bitrate = Math.round(128 + (quality / 100) * 128);
      command.audioBitrate(`${bitrate}k`);
    } else {
      const bitrate = Math.round(64 + (quality / 100) * 256);
      command.audioBitrate(`${bitrate}k`);
    }
  });
}

// ── Video → Audio extraction ──────────────────────────────────

function extractAudioFromVideo(input, output, format, quality, onProgress) {
  return runFfmpeg(input, output, format, onProgress, (command) => {
    command.noVideo();
    if (['wav', 'flac', 'alac', 'aiff'].includes(format)) {
      if (format === 'flac') command.audioCodec('flac');
      if (format === 'alac') command.audioCodec('alac');
    } else {
      const bitrate = Math.round(64 + (quality / 100) * 256);
      command.audioBitrate(`${bitrate}k`);
    }
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

// ── Document conversion ───────────────────────────────────────

async function convertDocument(input, output, format, quality, onProgress) {
  onProgress(10);
  const inputExt = path.extname(input).toLowerCase().slice(1);
  const outputFmt = format.toLowerCase();
  const content = fs.readFileSync(input, 'utf8');
  onProgress(30);

  if (outputFmt === 'pdf') {
    const html = toHtmlBody(content, inputExt);
    onProgress(50);
    return documentToPdf(html, output, onProgress);
  }

  let result;
  if (outputFmt === 'html') {
    result = toFullHtml(content, inputExt, path.basename(input));
  } else if (outputFmt === 'txt') {
    result = toPlainText(content, inputExt);
  } else if (outputFmt === 'md') {
    result = toMarkdown(content, inputExt);
  } else if (outputFmt === 'json') {
    result = toJson(content, inputExt);
  } else if (outputFmt === 'csv') {
    result = toCsv(content, inputExt);
  } else {
    throw new Error(`Unsupported document output format: ${format}`);
  }

  onProgress(80);
  fs.writeFileSync(output, result, 'utf8');
  onProgress(100);
  return output;
}

function toHtmlBody(content, ext) {
  switch (ext) {
    case 'md': case 'markdown': return markdownToHtml(content);
    case 'csv': return csvToHtmlTable(content, ',');
    case 'tsv': return csvToHtmlTable(content, '\t');
    case 'json': return jsonToHtml(content);
    case 'xml': return xmlToHtml(content);
    case 'yaml': case 'yml': return codeToHtml(content, 'yaml');
    case 'html': case 'htm': return content;
    case 'rtf': return textToHtml(rtfToText(content));
    case 'log': return logToHtml(content);
    default: return textToHtml(content);
  }
}

function toFullHtml(content, ext, filename) {
  if (ext === 'html' || ext === 'htm') return content;
  const body = toHtmlBody(content, ext);
  return wrapHtmlDoc(body, filename);
}

function wrapHtmlDoc(body, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title || 'Document')}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.6;color:#1a1a2e;max-width:900px;margin:0 auto;padding:2rem;background:#fafafa}
h1,h2,h3,h4,h5,h6{margin:1.5em 0 .5em;color:#16213e}
h1{font-size:2em;border-bottom:2px solid #e2e8f0;padding-bottom:.3em}
h2{font-size:1.5em;border-bottom:1px solid #e2e8f0;padding-bottom:.2em}
p{margin:.8em 0}a{color:#3b82f6;text-decoration:none}a:hover{text-decoration:underline}
code{background:#f1f5f9;padding:.2em .4em;border-radius:3px;font-size:.9em}
pre{background:#1e293b;color:#e2e8f0;padding:1em;border-radius:6px;overflow-x:auto}
pre code{background:none;color:inherit;padding:0}
blockquote{border-left:4px solid #7c3aed;margin:1em 0;padding:.5em 1em;background:#f5f3ff;color:#4c1d95}
table{border-collapse:collapse;width:100%;margin:1em 0}
th,td{border:1px solid #e2e8f0;padding:.6em .8em;text-align:left}
th{background:#f1f5f9;font-weight:600}tr:nth-child(even){background:#f8fafc}
ul,ol{margin:.8em 0;padding-left:2em}li{margin:.3em 0}
hr{border:none;border-top:2px solid #e2e8f0;margin:2em 0}
img{max-width:100%;height:auto;border-radius:4px}
del{color:#94a3b8}
.log-line{font-family:monospace;white-space:pre;padding:2px 0;border-bottom:1px solid #f1f5f9;font-size:.9em}
.json-key{color:#7c3aed;font-weight:600}.json-str{color:#059669}.json-num{color:#2563eb}.json-bool{color:#dc2626}.json-null{color:#94a3b8}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

// -- Markdown to HTML parser --

function markdownToHtml(md) {
  const codeBlocks = [];
  let html = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${esc(code.trimEnd())}</code></pre>`);
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  html = html.replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`);

  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr>');

  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_([^\s_].*?[^\s_])_/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  html = html.replace(/^>\s+(.+)$/gm, '<blockquote><p>$1</p></blockquote>');

  html = mdTables(html);

  const lines = html.split('\n');
  const out = [];
  let inList = false, listTag = '';

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (inList) { out.push(`</${listTag}>`); inList = false; }
      out.push('');
      continue;
    }
    const ulMatch = t.match(/^[-*+]\s+(.+)$/);
    const olMatch = t.match(/^\d+\.\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listTag !== 'ul') {
        if (inList) out.push(`</${listTag}>`);
        out.push('<ul>'); inList = true; listTag = 'ul';
      }
      out.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (!inList || listTag !== 'ol') {
        if (inList) out.push(`</${listTag}>`);
        out.push('<ol>'); inList = true; listTag = 'ol';
      }
      out.push(`<li>${olMatch[1]}</li>`);
    } else {
      if (inList) { out.push(`</${listTag}>`); inList = false; }
      if (/^<[a-z/]/.test(t) || /^\x00CB\d+\x00$/.test(t)) {
        out.push(t);
      } else {
        out.push(`<p>${t}</p>`);
      }
    }
  }
  if (inList) out.push(`</${listTag}>`);
  html = out.join('\n');

  codeBlocks.forEach((block, i) => {
    html = html.replace(`<p>\x00CB${i}\x00</p>`, block);
    html = html.replace(`\x00CB${i}\x00`, block);
  });

  return html;
}

function mdTables(md) {
  return md.replace(/((?:\|.+\|\n)+)/g, (block) => {
    const rows = block.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return block;
    const sepIdx = rows.findIndex(r => /^\|[\s:-]+\|$/.test(r.trim()));
    if (sepIdx < 1) return block;
    const parseRow = (row) => row.split('|').slice(1, -1).map(c => c.trim());
    const headers = parseRow(rows[0]);
    const dataRows = rows.slice(sepIdx + 1);
    let h = '<table>\n<thead><tr>';
    headers.forEach(x => { h += `<th>${x}</th>`; });
    h += '</tr></thead>\n<tbody>\n';
    dataRows.forEach(row => {
      const cells = parseRow(row);
      h += '<tr>';
      cells.forEach(c => { h += `<td>${c}</td>`; });
      h += '</tr>\n';
    });
    h += '</tbody></table>';
    return h;
  });
}

// -- CSV/TSV to HTML table --

function csvToHtmlTable(content, delimiter) {
  const rows = parseCsv(content, delimiter);
  if (rows.length === 0) return '<p>Empty document</p>';
  let html = '<table>\n<thead><tr>';
  rows[0].forEach(cell => { html += `<th>${esc(cell)}</th>`; });
  html += '</tr></thead>\n<tbody>\n';
  for (let i = 1; i < rows.length; i++) {
    html += '<tr>';
    rows[i].forEach(cell => { html += `<td>${esc(cell)}</td>`; });
    html += '</tr>\n';
  }
  html += '</tbody></table>';
  return html;
}

function parseCsv(text, delimiter) {
  const rows = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cells = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inQuotes) {
        if (ch === '"' && trimmed[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === delimiter) { cells.push(current); current = ''; }
        else { current += ch; }
      }
    }
    cells.push(current);
    rows.push(cells);
  }
  return rows;
}

// -- JSON to HTML --

function jsonToHtml(content) {
  try {
    const parsed = JSON.parse(content);
    return `<pre><code>${syntaxHighlightJson(JSON.stringify(parsed, null, 2))}</code></pre>`;
  } catch {
    return `<pre><code>${esc(content)}</code></pre>`;
  }
}

function syntaxHighlightJson(json) {
  return esc(json)
    .replace(/"([^"]+)"(\s*:)/g, '<span class="json-key">"$1"</span>$2')
    .replace(/:\s*"([^"]*?)"/g, ': <span class="json-str">"$1"</span>')
    .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-num">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="json-bool">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
}

// -- XML / YAML / Code to HTML --

function xmlToHtml(content) {
  return `<pre><code>${esc(content.replace(/></g, '>\n<'))}</code></pre>`;
}

function codeToHtml(content, lang) {
  return `<pre><code class="language-${lang}">${esc(content)}</code></pre>`;
}

// -- Plain text / Log to HTML --

function textToHtml(content) {
  return content.split(/\n{2,}/)
    .map(p => p.trim()).filter(p => p)
    .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function logToHtml(content) {
  return content.split('\n')
    .map(line => `<div class="log-line">${esc(line)}</div>`)
    .join('\n');
}

// -- RTF to plain text (basic) --

function rtfToText(rtf) {
  return rtf
    .replace(/\\par\b/g, '\n')
    .replace(/\\tab\b/g, '\t')
    .replace(/\\line\b/g, '\n')
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\[a-z]+\d*\s?/gi, '')
    .replace(/[{}]/g, '')
    .trim();
}

// -- Document to plain text --

function toPlainText(content, ext) {
  switch (ext) {
    case 'html': case 'htm':
      return content
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n').trim();
    case 'rtf': return rtfToText(content);
    case 'json':
      try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; }
    default: return content;
  }
}

// -- Document to Markdown --

function toMarkdown(content, ext) {
  switch (ext) {
    case 'html': case 'htm': return htmlToMarkdown(content);
    case 'csv': case 'tsv': return csvToMarkdownTable(content, ext === 'tsv' ? '\t' : ',');
    case 'json': return '```json\n' + ((() => { try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; } })()) + '\n```';
    case 'xml': return '```xml\n' + content + '\n```';
    case 'yaml': case 'yml': return '```yaml\n' + content + '\n```';
    case 'rtf': return rtfToText(content);
    default: return content;
  }
}

function htmlToMarkdown(html) {
  let md = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n');
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n');
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n');
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?(ul|ol|div|p|span|section|article|header|footer|nav|table|thead|tbody|tr|td|th)[^>]*>/gi, '\n');
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

function csvToMarkdownTable(content, delimiter) {
  const rows = parseCsv(content, delimiter);
  if (rows.length === 0) return '';
  const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] || '').length), 3));
  let md = '| ' + rows[0].map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |\n';
  md += '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |\n';
  for (let i = 1; i < rows.length; i++) {
    md += '| ' + rows[i].map((c, j) => (c || '').padEnd(widths[j] || 0)).join(' | ') + ' |\n';
  }
  return md;
}

// -- Document to JSON --

function toJson(content, ext) {
  switch (ext) {
    case 'csv': case 'tsv': {
      const rows = parseCsv(content, ext === 'tsv' ? '\t' : ',');
      if (rows.length < 2) return JSON.stringify(rows, null, 2);
      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i] || ''; });
        return obj;
      });
      return JSON.stringify(data, null, 2);
    }
    case 'json':
      try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; }
    default:
      return JSON.stringify({ content }, null, 2);
  }
}

// -- Document to CSV --

function toCsv(content, ext) {
  if (ext === 'json') {
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        const headers = Object.keys(data[0]);
        const lines = [headers.map(csvEscape).join(',')];
        for (const row of data) {
          lines.push(headers.map(h => csvEscape(String(row[h] ?? ''))).join(','));
        }
        return lines.join('\n');
      }
    } catch { /* fall through */ }
  }
  if (ext === 'tsv') return content.replace(/\t/g, ',');
  return content;
}

function csvEscape(val) {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

// -- Document to PDF --

async function documentToPdf(htmlBody, output, onProgress) {
  onProgress(60);
  const text = htmlBody
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const writeStream = fs.createWriteStream(output);
    doc.pipe(writeStream);
    doc.font('Helvetica').fontSize(11).text(text, { align: 'left', lineGap: 4 });
    doc.end();
    writeStream.on('finish', () => { onProgress(100); resolve(output); });
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

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { processFile };
