import type { FileEntry, ImageOptions } from "./types";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function canvasBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== mime) reject(new Error(`This browser cannot create ${mime} files`));
      else resolve(blob);
    }, mime, quality / 100);
  });
}

function dimensions(sourceWidth: number, sourceHeight: number, options: ImageOptions) {
  const { width, height, fit } = options;
  if (!width && !height) return { width: sourceWidth, height: sourceHeight };
  if (width && height && fit !== "max") return { width, height };
  const factor = Math.min(
    width ? width / sourceWidth : Infinity,
    height ? height / sourceHeight : Infinity,
    fit === "max" ? 1 : Infinity,
  );
  return {
    width: Math.max(1, Math.round(sourceWidth * factor)),
    height: Math.max(1, Math.round(sourceHeight * factor)),
  };
}

function draw(source: ImageBitmap, width: number, height: number, fit: ImageOptions["fit"], icon = false) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  if (fit === "scale") {
    ctx.drawImage(source, 0, 0, width, height);
  } else {
    const factor = fit === "crop"
      ? Math.max(width / source.width, height / source.height)
      : Math.min(width / source.width, height / source.height, icon ? 1 : Infinity);
    const drawWidth = source.width * factor;
    const drawHeight = source.height * factor;
    ctx.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }
  return canvas;
}

async function iconBlob(source: ImageBitmap, options: ImageOptions): Promise<Blob> {
  let sizes = [256, 128, 64, 48, 32, 16].map((size) => ({ width: size, height: size }));
  if (options.width || options.height) {
    const width = options.width ?? Math.max(1, Math.round(options.height! * source.width / source.height));
    const height = options.height ?? Math.max(1, Math.round(options.width! * source.height / source.width));
    if (width > 256 || height > 256) throw new Error("ICO dimensions cannot exceed 256 px");
    sizes = [{ width, height }];
  }

  const frames = await Promise.all(sizes.map(async ({ width, height }) => {
    const canvas = draw(source, width, height, options.fit, Boolean(options.width || options.height));
    return new Uint8Array(await (await canvasBlob(canvas, "image/png", 100)).arrayBuffer());
  }));
  const header = new Uint8Array(6 + frames.length * 16);
  const view = new DataView(header.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, frames.length, true);
  let offset = header.length;
  frames.forEach((frame, index) => {
    const entry = 6 + index * 16;
    header[entry] = sizes[index].width === 256 ? 0 : sizes[index].width;
    header[entry + 1] = sizes[index].height === 256 ? 0 : sizes[index].height;
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, frame.length, true);
    view.setUint32(entry + 12, offset, true);
    offset += frame.length;
  });
  return new Blob([header, ...frames], { type: "image/x-icon" });
}

export async function convertBrowserImage(file: FileEntry, format: string, quality: number, options: ImageOptions) {
  if (!file.browserFile || file.type !== "image") throw new Error("Browser conversion supports images only. Use the desktop app for other files.");
  const mime = MIME[format];
  if (!mime && format !== "ico") throw new Error("Browser conversion supports PNG, JPG, WebP, and ICO. Use the desktop app for this format.");

  const source = await createImageBitmap(file.browserFile);
  try {
    const size = dimensions(source.width, source.height, options);
    const blob = format === "ico"
      ? await iconBlob(source, options)
      : await canvasBlob(draw(source, size.width, size.height, options.fit), mime, quality);
    const name = `${file.name.replace(/\.[^.]+$/, "")}_converted.${format === "jpeg" ? "jpg" : format}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return name;
  } finally {
    source.close();
  }
}
