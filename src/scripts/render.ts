import {
  files, outputDir, targetFormat, quality, isConverting, selectedType,
  currentTab, conversionMode, formatSubTab, toolsView,
  toolsCatConvert, toolsCatCompress,
  setTargetFormat, applyMode, setCurrentTab, updateSelectedType,
} from "./state";
import { FORMAT_OPTIONS } from "./constants";
import { CONVERT_TOOLS, COMPRESS_TOOLS } from "./tools-data";
import { escapeHtml, formatSize, getPreviewUrl, normalizeExt, truncatePath } from "./helpers";
import { $ } from "./dom";
import { icon } from "./icons";
import { openPreview } from "./preview";
import type { FileEntry, ToolEntry } from "./types";

// -- Orchestrator --
export function render() {
  renderTabs();
  renderViews();
  renderFileList();
  renderConvertBar();
  renderDropZone();
  renderToolsGrids();
}

// -- Tabs & views --
export function renderTabs() {
  document.querySelectorAll<HTMLElement>("#nav-tabs .tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === currentTab);
  });
}

const VIEW_BY_TAB = {
  convert: "view-convert",
  compress: "view-convert",
  tools: "tools-panel",
  download: "view-download",
} as const;

export function renderViews() {
  const active = VIEW_BY_TAB[currentTab];
  for (const id of new Set(Object.values(VIEW_BY_TAB))) {
    $(id).style.display = id === active ? "flex" : "none";
  }
}

export function renderDropZone() {
  const hasFiles = files.length > 0;
  $("dropzone").classList.toggle("has-files", hasFiles);
  $("empty-state").style.display = hasFiles ? "none" : "flex";
}

// -- File list --
const fileMeta = (f: FileEntry) =>
  `${f.ext.toUpperCase()}${f.size ? " - " + formatSize(f.size) : ""}${f.status === "done" ? " - Completed" : ""}`;

const outputFormat = (f: FileEntry) =>
  f.status === "done" && f.outputPath ? f.outputPath.split(".").pop()!.toUpperCase() : "";

function statusHtml(f: FileEntry): string {
  switch (f.status) {
    case "converting":
      return `<div class="progress file-progress"><div class="progress-fill" style="width:${f.progress}%"></div></div>
        <span class="progress-pct">${f.progress}%</span>`;
    case "done":
      return `<span class="status-icon" data-tone="success">${icon("check", { size: 12, stroke: 3 })}</span>`;
    case "error":
      return `<span class="status-icon" data-tone="destructive" title="${escapeHtml(f.error || "")}">${icon("close", { size: 10, stroke: 3 })}</span>`;
    default:
      return "";
  }
}

const fileRightHtml = (f: FileEntry) =>
  `${statusHtml(f)}<button class="btn btn-ghost btn-danger btn-icon btn-round remove-btn" data-id="${f.id}" ${isConverting ? "disabled" : ""} title="Remove">${icon("close", { size: 12 })}</button>`;

const doneFormatHtml = (fmt: string) =>
  `<span class="badge done-format" data-tone="success">${fmt}</span>`;

function thumbHtml(f: FileEntry): string {
  if (f.type === "image" || f.type === "video") {
    const url = getPreviewUrl(f.path);
    const media = f.type === "image"
      ? `<img src="${url}" alt="" loading="lazy" />`
      : `<video src="${url}" muted preload="metadata"></video>`;
    return `<div class="file-thumb" data-preview="${escapeHtml(f.path)}" data-type="${f.type}">${media}<div class="play-overlay">${icon("play", { size: 16, filled: true })}</div></div>`;
  }
  const label = f.type === "audio" ? icon("music", { size: 18 }) : f.type === "pdf" ? "PDF" : "DOC";
  return `<div class="file-thumb" data-kind="${f.type}"><span class="thumb-label">${label}</span></div>`;
}

function fileCardHtml(f: FileEntry): string {
  const fmt = outputFormat(f);
  return `
    <div class="file-card ${f.status}" data-id="${f.id}">
      ${thumbHtml(f)}
      <div class="file-details">
        <div class="file-name-row">
          <span class="file-name truncate">${escapeHtml(f.name)}</span>
          <span class="badge" data-kind="${f.type}">${f.type}</span>
          ${fmt ? doneFormatHtml(fmt) : ""}
        </div>
        <span class="file-meta">${fileMeta(f)}</span>
      </div>
      <div class="file-right">${fileRightHtml(f)}</div>
    </div>`;
}

// Update status/progress in place so thumbnails (and playing videos) aren't recreated.
function patchFileCard(card: HTMLElement, f: FileEntry) {
  card.className = `file-card ${f.status}`;
  card.querySelector(".file-right")!.innerHTML = fileRightHtml(f);
  card.querySelector(".file-meta")!.textContent = fileMeta(f);

  const nameRow = card.querySelector(".file-name-row")!;
  const badge = nameRow.querySelector(".done-format");
  const fmt = outputFormat(f);
  if (!fmt) badge?.remove();
  else if (badge) badge.textContent = fmt;
  else nameRow.insertAdjacentHTML("beforeend", doneFormatHtml(fmt));
}

export function renderFileList() {
  const container = $("file-list");
  if (files.length === 0) {
    container.innerHTML = "";
    return;
  }

  const cards = new Map<string, HTMLElement>();
  container.querySelectorAll<HTMLElement>(".file-card[data-id]").forEach((c) => cards.set(c.dataset.id!, c));

  if (cards.size === files.length && files.every((f) => cards.has(f.id))) {
    files.forEach((f) => patchFileCard(cards.get(f.id)!, f));
  } else {
    container.innerHTML = files.map(fileCardHtml).join("");
  }
}

function initFileList() {
  $("file-list").addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    const removeBtn = target.closest<HTMLElement>(".remove-btn");
    if (removeBtn) {
      const idx = files.findIndex((f) => f.id === removeBtn.dataset.id);
      if (idx !== -1) files.splice(idx, 1);
      updateSelectedType();
      render();
      return;
    }

    const thumb = target.closest<HTMLElement>(".file-thumb[data-preview]");
    if (thumb) openPreview(thumb.dataset.preview!, thumb.dataset.type!);
  });
}

// -- Convert bar --
function fillFormatSelect(select: HTMLSelectElement, formats: string[]) {
  const current = select.value;
  select.innerHTML = formats
    .map((f) => `<option value="${f}"${f === current ? " selected" : ""}>${f.toUpperCase()}</option>`)
    .join("");
  if (!formats.includes(current)) {
    select.value = formats[0] || "";
    setTargetFormat(formats[0] || "");
  }
}

function renderFormatField() {
  const formatField = $("format-field");
  const formatTabs = $("format-tabs");

  if (conversionMode !== "convert" || !selectedType || !FORMAT_OPTIONS[selectedType]) {
    if (conversionMode === "compress") {
      formatField.style.display = "none";
      formatTabs.classList.remove("visible");
    }
    return;
  }

  const exts = new Set(files.map((f) => f.ext.toLowerCase()));
  const sourceExt = exts.size === 1 ? normalizeExt([...exts][0]) : null;

  const isVideo = selectedType === "video";
  const list = isVideo && formatSubTab === "audio" ? FORMAT_OPTIONS.videoAudio : FORMAT_OPTIONS[selectedType];

  formatTabs.classList.toggle("visible", isVideo);
  if (isVideo) {
    formatTabs.querySelectorAll<HTMLElement>(".format-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.formatTab === formatSubTab);
    });
  }

  fillFormatSelect(
    $<HTMLSelectElement>("format-select"),
    sourceExt ? list.filter((f) => normalizeExt(f) !== sourceExt) : list,
  );
  formatField.style.display = "flex";
}

export function renderConvertBar() {
  const bar = $("convert-bar");
  if (files.length === 0 || currentTab === "tools" || currentTab === "download") {
    bar.classList.add("hidden");
    return;
  }
  bar.classList.remove("hidden");

  const doneCount = files.filter((f) => f.status === "done").length;
  const errCount = files.filter((f) => f.status === "error").length;
  $("stats-label").textContent =
    `${files.length} file${files.length > 1 ? "s" : ""}${doneCount ? ` - ${doneCount} done` : ""}${errCount ? ` - ${errCount} err` : ""}`;

  renderFormatField();

  $("slider-fill").style.width = `${quality}%`;
  $<HTMLInputElement>("quality-slider").value = String(quality);
  $("quality-value").textContent = `${quality}%`;
  $("output-dir-label").textContent = outputDir ? truncatePath(outputDir) : "Choose folder";

  const allDone = files.every((f) => f.status === "done" || f.status === "error");
  const convertBtn = $<HTMLButtonElement>("convert-btn");
  convertBtn.disabled = isConverting || !outputDir || (conversionMode === "convert" && !targetFormat);
  convertBtn.classList.toggle("is-busy", isConverting);
  convertBtn.classList.toggle("is-done", !isConverting && allDone);

  if (isConverting) {
    convertBtn.innerHTML = `<span class="spinner"></span> ${conversionMode === "compress" ? "Compressing" : "Converting"}`;
  } else if (allDone) {
    convertBtn.innerHTML = `${icon("check", { size: 16, stroke: 2.5 })} ${doneCount} Done${errCount ? ` - ${errCount} Failed` : ""}`;
  } else {
    const compress = conversionMode === "compress";
    convertBtn.innerHTML = `${icon(compress ? "compress" : "convert", { size: 14, stroke: 2.5 })} ${compress ? "Compress All" : "Convert All"}`;
  }

  $("clear-btn").style.display = allDone ? "inline-flex" : "none";

  $("overall-progress").style.display = isConverting ? "flex" : "none";
  if (isConverting) {
    const finished = files.filter((f) => f.status === "done" || f.status === "error").length;
    const current = files.find((f) => f.status === "converting");
    const pct = Math.round(((finished + (current ? current.progress / 100 : 0)) / files.length) * 100);
    $("overall-fill").style.width = `${pct}%`;
    $("overall-text").textContent = `${pct}%`;
  }

  document.querySelectorAll<HTMLElement>("#mode-toggle .mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === conversionMode);
  });
}

// -- Tools grids --
const TOOL_KIND: Record<string, string> = { video: "video", audio: "audio", pdf: "pdf", document: "doc" };

export function renderToolsGrids() {
  $("tools-convert").style.display = toolsView === "convert" ? "flex" : "none";
  $("tools-compress").style.display = toolsView === "compress" ? "flex" : "none";

  document.querySelectorAll<HTMLElement>(".tools-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.toolsView === toolsView);
  });

  renderToolGrid("tools-convert-grid", CONVERT_TOOLS, toolsCatConvert, "convert");
  renderToolGrid("tools-compress-grid", COMPRESS_TOOLS, toolsCatCompress, "compress");
}

function renderToolGrid(
  containerId: string,
  tools: ToolEntry[],
  cat: string,
  mode: "convert" | "compress",
) {
  const visible = cat === "all" ? tools : tools.filter((t) => t.cat === cat);

  $(containerId).innerHTML = visible
    .map((tool) => {
      const kind = TOOL_KIND[tool.type] ?? (tool.cat === "gif" ? "gif" : "image");
      return `
      <div class="tool-card" data-kind="${kind}" data-tool-format="${tool.format || ""}" data-tool-mode="${mode}">
        <div class="tool-icon">${tool.icon}</div>
        <div class="tool-text">
          <div class="tool-label truncate">${tool.label}</div>
          <div class="tool-desc">${tool.desc}</div>
        </div>
      </div>`;
    })
    .join("");
}

function initToolGrids() {
  for (const id of ["tools-convert-grid", "tools-compress-grid"]) {
    $(id).addEventListener("click", (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>(".tool-card");
      if (!card) return;
      const mode = card.dataset.toolMode as "convert" | "compress";
      applyMode(mode);
      if (card.dataset.toolFormat) setTargetFormat(card.dataset.toolFormat);
      setCurrentTab(mode);
      render();
    });
  }
}

export function initRenderEvents() {
  initFileList();
  initToolGrids();
}
