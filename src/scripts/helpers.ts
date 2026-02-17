import { VIDEO_EXTS, AUDIO_EXTS, IMAGE_EXTS, PDF_EXTS } from "./constants";
import type { FileEntry } from "./types";

export function detectType(name: string): FileEntry["type"] | null {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (VIDEO_EXTS.includes(ext)) return "video";
  if (AUDIO_EXTS.includes(ext)) return "audio";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (PDF_EXTS.includes(ext)) return "pdf";
  return null;
}

export function getExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function truncatePath(p: string): string {
  if (p.length <= 30) return p;
  return "..." + p.slice(-28);
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(2) + " GB";
}

export function isPreviewable(type: string, _ext: string): boolean {
  if (type === "image") return true;
  if (type === "video") return true;
  return false;
}

export function getPreviewUrl(filePath: string): string {
  return "file:///" + filePath.replace(/\\/g, "/");
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
