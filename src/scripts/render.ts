import {
  files, outputDir, targetFormat, quality, isConverting, selectedType,
  currentTab, conversionMode, formatSubTab, toolsView,
  toolsCatConvert, toolsCatCompress,
  setTargetFormat, setConversionMode, setCurrentTab, setQuality,
} from "./state";
import { FORMAT_OPTIONS } from "./constants";
import { CONVERT_TOOLS, COMPRESS_TOOLS } from "./tools-data";
import { escapeHtml, formatSize, isPreviewable, getPreviewUrl, truncatePath } from "./helpers";
import type { ToolEntry } from "./types";

// -- Main render orchestrator --
export function render() {
  renderTabs();
  renderViews();
  renderFileList();
  renderConvertBar();
  renderDropZone();
  renderToolsGrids();
}

// -- Tabs --
export function renderTabs() {
  document.querySelectorAll("#nav-tabs .tab").forEach((btn) => {
    const tab = (btn as HTMLElement).dataset.tab;
    btn.classList.toggle("active", tab === currentTab);
  });
}

// -- Views --
export function renderViews() {
  const convertView = document.getElementById("view-convert")!;
  const toolsPanel = document.getElementById("tools-panel")!;
  const downloadView = document.getElementById("view-download")!;

  convertView.style.display = "none";
  toolsPanel.style.display = "none";
  downloadView.style.display = "none";

  if (currentTab === "tools") {
    toolsPanel.style.display = "block";
  } else if (currentTab === "download") {
    downloadView.style.display = "flex";
  } else {
    convertView.style.display = "flex";
  }
}

// -- Drop zone --
export function renderDropZone() {
  const zone = document.getElementById("dropzone")!;
  const empty = document.getElementById("empty-state")!;
  if (files.length > 0) {
    zone.classList.add("has-files");
    empty.style.display = "none";
  } else {
    zone.classList.remove("has-files");
    empty.style.display = "flex";
  }
}

// -- File list --
let openPreviewFn: ((path: string, type: string) => void) | null = null;
let onRemoveFile: (() => void) | null = null;

export function setOpenPreviewFn(fn: (path: string, type: string) => void) {
  openPreviewFn = fn;
}

export function setOnRemoveFile(fn: () => void) {
  onRemoveFile = fn;
}

export function renderFileList() {
  const container = document.getElementById("file-list")!;
  if (files.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = files
    .map((f) => {
      const previewUrl = getPreviewUrl(f.path);
      const playIcon = `<div class="play-overlay"><svg viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>`;

      let thumbHtml = "";
      if (f.type === "image") {
        thumbHtml = `<div class="file-thumb" data-preview="${escapeHtml(f.path)}" data-type="${f.type}"><img src="${previewUrl}" alt="" loading="lazy" />${playIcon}</div>`;
      } else if (f.type === "video") {
        thumbHtml = `<div class="file-thumb" data-preview="${escapeHtml(f.path)}" data-type="${f.type}"><video src="${previewUrl}" muted preload="metadata"></video>${playIcon}</div>`;
      } else if (f.type === "pdf") {
        thumbHtml = `<div class="file-thumb"><span class="thumb-icon" style="font-size:13px;font-weight:800;color:var(--file-color);">FILE</span></div>`;
      }

      let statusHtml = "";
      if (f.status === "converting") {
        statusHtml = `
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${f.progress}%"></div></div>
        <span class="progress-pct">${f.progress}%</span>`;
      } else if (f.status === "done") {
        statusHtml = `<span class="status-icon done"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`;
      } else if (f.status === "error") {
        statusHtml = `<span class="status-icon error" title="${escapeHtml(f.error || "")}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`;
      }

      const doneFormatHtml =
        f.status === "done" && f.outputPath
          ? `<span class="done-format">${f.outputPath.split(".").pop()?.toUpperCase() || ""}</span>`
          : "";

      return `
      <div class="file-card ${f.status}" data-id="${f.id}">
        ${thumbHtml}
        <div class="file-details">
          <div class="file-name-row">
            <span class="file-name">${escapeHtml(f.name)}</span>
            <span class="file-type-badge ${f.type}">${f.type}</span>
            ${doneFormatHtml}
          </div>
          <span class="file-meta">${f.ext.toUpperCase()}${f.size ? " - " + formatSize(f.size) : ""}${f.status === "done" ? " - Completed" : ""}</span>
        </div>
        <div class="file-right">
          ${statusHtml}
          <button class="remove-btn" data-id="${f.id}" ${isConverting ? "disabled" : ""} title="Remove">X</button>
        </div>
      </div>`;
    })
    .join("");

  // Remove button events
  container.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = files.findIndex((f) => f.id === (btn as HTMLElement).dataset.id);
      if (idx !== -1) files.splice(idx, 1);
      if (onRemoveFile) onRemoveFile();
      render();
    });
  });

  // Preview on thumb click
  container.querySelectorAll(".file-thumb[data-preview]").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const path = (thumb as HTMLElement).dataset.preview!;
      const type = (thumb as HTMLElement).dataset.type!;
      if (openPreviewFn) openPreviewFn(path, type);
    });
  });
}

// -- Convert Bar --
export function renderConvertBar() {
  const bar = document.getElementById("convert-bar")!;
  const formatSelect = document.getElementById("format-select") as HTMLSelectElement;
  const qualitySlider = document.getElementById("quality-slider") as HTMLInputElement;
  const qualityLabel = document.getElementById("quality-value")!;
  const convertBtn = document.getElementById("convert-btn") as HTMLButtonElement;
  const outputLabel = document.getElementById("output-dir-label")!;
  const statsLabel = document.getElementById("stats-label")!;
  const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;
  const overallProgress = document.getElementById("overall-progress")!;
  const formatTabs = document.getElementById("format-tabs")!;
  const sliderFill = document.getElementById("slider-fill")!;

  if (files.length === 0 || currentTab === "tools" || currentTab === "download") {
    bar.classList.add("hidden");
    return;
  }
  bar.classList.remove("hidden");

  // Stats
  const doneCount = files.filter((f) => f.status === "done").length;
  const errCount = files.filter((f) => f.status === "error").length;
  statsLabel.textContent = `${files.length} file${files.length > 1 ? "s" : ""}${doneCount ? ` - ${doneCount} done` : ""}${errCount ? ` - ${errCount} err` : ""}`;

  sliderFill.style.width = `${quality}%`;

  // Format options
  if (conversionMode === "convert" && selectedType && FORMAT_OPTIONS[selectedType]) {
    const fileExts = new Set(files.map((f) => f.ext.toLowerCase()));
    const hasSingleExt = fileExts.size === 1;
    const sourceExt = hasSingleExt ? [...fileExts][0] : null;

    if (selectedType === "video") {
      formatTabs.classList.add("visible");
      formatTabs.querySelectorAll(".format-tab").forEach((tab) => {
        tab.classList.toggle("active", (tab as HTMLElement).dataset.formatTab === formatSubTab);
      });

      const current = formatSelect.value;
      let optionsHtml = "";
      if (formatSubTab === "video") {
        let opts = FORMAT_OPTIONS.video.filter((f) => {
          if (sourceExt) {
            const normalized = f === "jpg" ? "jpeg" : f;
            const normSource = sourceExt === "jpg" ? "jpeg" : sourceExt;
            if (normalized === normSource || f === sourceExt) return false;
          }
          return true;
        });
        optionsHtml = opts.map((f) => `<option value="${f}" ${f === current ? "selected" : ""}>${f.toUpperCase()}</option>`).join("");
        formatSelect.innerHTML = optionsHtml;
        if (!opts.includes(current)) {
          formatSelect.value = opts[0] || "";
          setTargetFormat(opts[0] || "");
        }
      } else {
        const audioOpts = FORMAT_OPTIONS.videoAudio.filter((f) => !sourceExt || f !== sourceExt);
        optionsHtml = audioOpts.map((f) => `<option value="${f}" ${f === current ? "selected" : ""}>${f.toUpperCase()}</option>`).join("");
        formatSelect.innerHTML = optionsHtml;
        if (!audioOpts.includes(current)) {
          formatSelect.value = audioOpts[0] || "";
          setTargetFormat(audioOpts[0] || "");
        }
      }
    } else {
      formatTabs.classList.remove("visible");
      let opts = FORMAT_OPTIONS[selectedType].filter((f) => {
        if (sourceExt) {
          const normalized = f === "jpg" ? "jpeg" : f;
          const normSource = sourceExt === "jpg" ? "jpeg" : sourceExt;
          if (normalized === normSource || f === sourceExt) return false;
        }
        return true;
      });
      const current = formatSelect.value;
      formatSelect.innerHTML = opts.map((f) => `<option value="${f}" ${f === current ? "selected" : ""}>${f.toUpperCase()}</option>`).join("");
      if (!opts.includes(current)) {
        formatSelect.value = opts[0] || "";
        setTargetFormat(opts[0] || "");
      }
    }
    document.getElementById("format-field")!.style.display = "flex";
  } else if (conversionMode === "compress") {
    document.getElementById("format-field")!.style.display = "none";
    formatTabs.classList.remove("visible");
  }

  qualitySlider.value = String(quality);
  qualityLabel.textContent = `${quality}%`;
  outputLabel.textContent = outputDir ? truncatePath(outputDir) : "Choose folder";

  const allDone = files.every((f) => f.status === "done" || f.status === "error");
  convertBtn.disabled = isConverting || !outputDir || (conversionMode === "convert" && !targetFormat);

  const btnIcon = conversionMode === "compress"
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4m0 14v-4M3 12h4m14 0h-4"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/></svg>';

  if (isConverting) {
    const actionLabel = conversionMode === "compress" ? "Compressing" : "Converting";
    convertBtn.innerHTML = `<span class="btn-spinner"></span> ${actionLabel}`;
    convertBtn.classList.add("converting");
    convertBtn.classList.remove("done");
  } else if (allDone && files.length > 0) {
    const successCount = files.filter((f) => f.status === "done").length;
    const errCount2 = files.filter((f) => f.status === "error").length;
    convertBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${successCount} Done${errCount2 ? ` - ${errCount2} Failed` : ""}`;
    convertBtn.classList.remove("converting");
    convertBtn.classList.add("done");
  } else {
    convertBtn.innerHTML = `${btnIcon} ${conversionMode === "compress" ? "Compress All" : "Convert All"}`;
    convertBtn.classList.remove("converting", "done");
  }

  clearBtn.style.display = allDone && files.length > 0 ? "inline-flex" : "none";

  // Overall progress bar
  if (isConverting) {
    overallProgress.style.display = "flex";
    const total = files.length;
    const done = files.filter((f) => f.status === "done" || f.status === "error").length;
    const currentFile = files.find((f) => f.status === "converting");
    const pct = Math.round(((done + (currentFile ? currentFile.progress / 100 : 0)) / total) * 100);
    document.getElementById("overall-fill")!.style.width = pct + "%";
    document.getElementById("overall-text")!.textContent = pct + "%";
  } else {
    overallProgress.style.display = "none";
  }

  // Mode toggle state
  document.querySelectorAll("#mode-toggle .mode-btn").forEach((btn) => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.mode === conversionMode);
  });
}

// -- Tools grids --
export function renderToolsGrids() {
  const convertSection = document.getElementById("tools-convert")!;
  const compressSection = document.getElementById("tools-compress")!;

  if (toolsView === "convert") {
    convertSection.style.display = "flex";
    compressSection.style.display = "none";
  } else {
    convertSection.style.display = "none";
    compressSection.style.display = "flex";
  }

  document.querySelectorAll(".tools-tab").forEach((tab) => {
    tab.classList.toggle("active", (tab as HTMLElement).dataset.toolsView === toolsView);
  });

  renderToolGrid("tools-convert-grid", CONVERT_TOOLS, toolsCatConvert);
  renderToolGrid("tools-compress-grid", COMPRESS_TOOLS, toolsCatCompress);
}

function renderToolGrid(containerId: string, tools: ToolEntry[], cat: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const filtered = cat === "all" ? tools : tools.filter((t) => t.cat === cat);

  container.innerHTML = filtered
    .map((tool) => {
      const iconClass =
        tool.type === "video" ? "video" :
        tool.type === "audio" ? "audio" :
        tool.type === "pdf" ? "pdf" :
        tool.cat === "gif" ? "gif" : "image";

      return `
      <div class="tool-card" data-tool-type="${tool.type}" data-tool-format="${tool.format || ""}" data-tool-mode="${containerId.includes("compress") ? "compress" : "convert"}">
        <div class="tool-icon ${iconClass}">${tool.icon}</div>
        <div class="tool-text">
          <div class="tool-label">${tool.label}</div>
          <div class="tool-desc">${tool.desc}</div>
        </div>
      </div>`;
    })
    .join("");

  // Click handler
  container.querySelectorAll(".tool-card").forEach((card) => {
    card.addEventListener("click", () => {
      const format = (card as HTMLElement).dataset.toolFormat || "";
      const mode = (card as HTMLElement).dataset.toolMode as "convert" | "compress";
      setConversionMode(mode);
      if (format) setTargetFormat(format);
      setQuality(mode === "compress" ? 85 : 80);
      setCurrentTab(mode);
      render();
    });
  });
}
