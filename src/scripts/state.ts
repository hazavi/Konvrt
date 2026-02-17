import type { FileEntry, DlVideoInfo, DlHistoryEntry } from "./types";

// Converter state
export let files: FileEntry[] = [];
export let outputDir = "";
export let targetFormat = "";
export let quality = 80;
export let isConverting = false;
export let selectedType: "video" | "audio" | "image" | "pdf" | null = null;
export let currentTab: "convert" | "compress" | "tools" | "download" = "convert";
export let conversionMode: "convert" | "compress" = "convert";

// Convert bar sub-tab
export let formatSubTab: "video" | "audio" = "video";

// Tools panel state
export let toolsView: "convert" | "compress" = "convert";
export let toolsCatConvert = "all";
export let toolsCatCompress = "all";

// Download state
export let dlPlatform: "youtube" | "tiktok" = "youtube";
export let dlFormat = "mp4";
export let dlQuality = "best";
export let dlOutputDir = "";
export let dlIsDownloading = false;
export let dlVideoInfo: DlVideoInfo | null = null;
export let dlHistory: DlHistoryEntry[] = [];

// Preview state
export let previewIndex = -1;

// Setters (since ES modules export bindings, we need mutation functions)
export function setFiles(f: FileEntry[]) { files = f; }
export function setOutputDir(d: string) { outputDir = d; }
export function setTargetFormat(f: string) { targetFormat = f; }
export function setQuality(q: number) { quality = q; }
export function setIsConverting(v: boolean) { isConverting = v; }
export function setSelectedType(t: typeof selectedType) { selectedType = t; }
export function setCurrentTab(t: typeof currentTab) { currentTab = t; }
export function setConversionMode(m: typeof conversionMode) { conversionMode = m; }
export function setFormatSubTab(t: typeof formatSubTab) { formatSubTab = t; }
export function setToolsView(v: typeof toolsView) { toolsView = v; }
export function setToolsCatConvert(c: string) { toolsCatConvert = c; }
export function setToolsCatCompress(c: string) { toolsCatCompress = c; }
export function setDlPlatform(p: typeof dlPlatform) { dlPlatform = p; }
export function setDlFormat(f: string) { dlFormat = f; }
export function setDlQuality(q: string) { dlQuality = q; }
export function setDlOutputDir(d: string) { dlOutputDir = d; }
export function setDlIsDownloading(v: boolean) { dlIsDownloading = v; }
export function setDlVideoInfo(v: DlVideoInfo | null) { dlVideoInfo = v; }
export function setPreviewIndex(i: number) { previewIndex = i; }
