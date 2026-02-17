// File entry used throughout the app
export interface FileEntry {
  id: string;
  path: string;
  name: string;
  ext: string;
  type: "video" | "audio" | "image" | "pdf";
  size: number;
  progress: number;
  status: "pending" | "converting" | "done" | "error";
  error?: string;
  outputPath?: string;
  previewUrl?: string;
}

export interface DlHistoryEntry {
  title: string;
  format: string;
  status: "success" | "error";
  error?: string;
  outputPath?: string;
}

export interface DlVideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  platform: string;
  url: string;
}

export interface ToolEntry {
  label: string;
  desc: string;
  cat: string;
  icon: string;
  type: string;
  format?: string;
}
