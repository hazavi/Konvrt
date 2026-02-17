// Supported file extension lists
export const VIDEO_EXTS = [
  "mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "ts",
  "m2ts", "mts", "3gp", "ogv", "vob", "mpg", "mpeg", "m4v",
  "divx", "asf", "rm", "rmvb", "f4v",
];

export const AUDIO_EXTS = [
  "mp3", "wav", "ogg", "flac", "aac", "wma", "m4a", "opus",
  "alac", "aiff", "ape", "ac3", "dts", "amr", "au", "ra", "wv",
];

export const IMAGE_EXTS = [
  "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp",
  "svg", "avif", "heic", "heif", "ico", "jxl", "jp2", "psd",
  "raw", "cr2", "nef", "dng",
];

export const PDF_EXTS = ["pdf"];

// Audio formats available for video-to-audio extraction
export const AUDIO_EXTRACT_FMTS = [
  "mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "wma", "aiff", "ac3",
];

// Format options per media type (for convert bar dropdowns)
export const FORMAT_OPTIONS: Record<string, string[]> = {
  video: [
    "mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "ts",
    "3gp", "ogv", "m4v", "mpg",
  ],
  videoAudio: AUDIO_EXTRACT_FMTS,
  audio: [
    "mp3", "wav", "ogg", "flac", "aac", "m4a", "wma", "opus",
    "aiff", "ac3", "alac",
  ],
  image: [
    "jpg", "png", "webp", "avif", "gif", "bmp", "tiff", "heif",
    "ico", "jxl", "svg",
  ],
  pdf: ["png", "jpg", "webp", "avif", "tiff", "gif", "bmp"],
};
