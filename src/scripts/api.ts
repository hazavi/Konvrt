import type { DlVideoInfo, ImageOptions } from "./types";

interface Outcome {
  success: boolean;
  error?: string;
}

/** Bridge exposed by electron/preload.cjs. */
export interface KonvrtApi {
  windowMinimize(): Promise<void>;
  windowToggleMaximize(): Promise<void>;
  windowClose(): Promise<void>;
  onWindowMaximized(cb: (maximized: boolean) => void): void;
  selectFiles(): Promise<string[]>;
  selectOutputDir(): Promise<string | null>;
  convert(job: {
    filePath: string;
    outputDir: string;
    format: string;
    quality: number;
    mode: "convert" | "compress";
    imageOptions?: ImageOptions;
  }): Promise<Outcome & { outputPath?: string }>;
  getFileSizes(paths: string[]): Promise<Record<string, number>>;
  onProgress(cb: (data: { filePath: string; progress: number }) => void): void;

  ytdlpCheck(): Promise<boolean>;
  ytdlpInstall(): Promise<Outcome>;
  ytdlpInfo(url: string): Promise<Outcome & { data: DlVideoInfo }>;
  ytdlpDownload(job: {
    url: string;
    outputDir: string;
    format: string;
    quality: string;
  }): Promise<Outcome & { outputPath?: string }>;
  getProxy(): Promise<string>;
  setProxy(proxy: string): Promise<void>;
  onDownloadProgress(
    cb: (data: { percent: number; currentSpeed: string; eta: string }) => void,
  ): void;
}

// Undefined when running in a plain browser (e.g. `astro dev` without Electron).
export const api: KonvrtApi | undefined = (window as unknown as { konvrt?: KonvrtApi }).konvrt;
