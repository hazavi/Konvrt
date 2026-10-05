import { api } from "./api";
import { $, onClick, setActive } from "./dom";
import {
  files, quality, currentTab,
  setFiles, setOutputDir, setTargetFormat, setQuality, applyMode,
  setCurrentTab, setFormatSubTab,
  setToolsView, setToolsCatConvert, setToolsCatCompress,
  setSelectedType,
} from "./state";
import { render, renderFileList, renderConvertBar, renderToolsGrids, initRenderEvents } from "./render";
import { addFiles } from "./file-ops";
import { startConversion } from "./convert";
import { checkYtDlpAndRender, initDownload } from "./download";
import { isPreviewOpen, closePreview, navigatePreview } from "./preview";

function initNavigation() {
  onClick("#nav-tabs .tab", (btn) => {
    const tab = btn.dataset.tab as typeof currentTab;
    setCurrentTab(tab);
    if (tab === "convert" || tab === "compress") applyMode(tab);
    if (tab === "download") checkYtDlpAndRender();
    render();
  });
}

function initDropZone() {
  const zone = $("dropzone");

  $("browse-btn").addEventListener("click", async () => {
    if (!api) return alert("Running outside Electron - file picker unavailable.");
    addFiles(await api.selectFiles());
  });

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const dropped = Array.from(e.dataTransfer?.files ?? []) as (File & { path?: string })[];
    addFiles(dropped.map((f) => f.path).filter((p): p is string => Boolean(p)));
  });
}

function initConvertBar() {
  $("output-dir-btn").addEventListener("click", async () => {
    const dir = await api?.selectOutputDir();
    if (!dir) return;
    setOutputDir(dir);
    render();
  });

  $<HTMLSelectElement>("format-select").addEventListener("change", (e) => {
    setTargetFormat((e.target as HTMLSelectElement).value);
  });

  $<HTMLInputElement>("quality-slider").addEventListener("input", (e) => {
    setQuality(Number((e.target as HTMLInputElement).value));
    $("quality-value").textContent = `${quality}%`;
    $("slider-fill").style.width = `${quality}%`;
  });

  const tooltip = $("quality-tooltip");
  $("quality-help").addEventListener("click", (e) => {
    e.stopPropagation();
    tooltip.classList.toggle("visible");
  });
  document.addEventListener("click", () => tooltip.classList.remove("visible"));
  tooltip.addEventListener("click", (e) => e.stopPropagation());

  onClick("#format-tabs .format-tab", (btn) => {
    setFormatSubTab(btn.dataset.formatTab as "video" | "audio");
    render();
  });

  onClick("#mode-toggle .mode-btn", (btn) => {
    applyMode(btn.dataset.mode as "convert" | "compress");
    render();
  });

  $("convert-btn").addEventListener("click", startConversion);
  $("clear-btn").addEventListener("click", () => {
    setFiles([]);
    setSelectedType(null);
    render();
  });

  api?.onProgress((data) => {
    const file = files.find((f) => f.path === data.filePath);
    if (!file) return;
    file.progress = data.progress;
    renderFileList();
    renderConvertBar();
  });
}

function initPreview() {
  $("preview-close").addEventListener("click", closePreview);
  $("preview-modal").querySelector(".modal-backdrop")!.addEventListener("click", closePreview);
  $("preview-prev").addEventListener("click", () => navigatePreview(-1));
  $("preview-next").addEventListener("click", () => navigatePreview(1));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePreview();
    if (!isPreviewOpen()) return;
    if (e.key === "ArrowLeft") navigatePreview(-1);
    if (e.key === "ArrowRight") navigatePreview(1);
  });
}

function initTools() {
  onClick(".tools-categories .cat-tab", (btn) => {
    const section = btn.closest<HTMLElement>(".tools-categories")!.dataset.section;
    setActive(`.tools-categories[data-section="${section}"] .cat-tab`, btn);
    const cat = btn.dataset.cat || "all";
    if (section === "compress") setToolsCatCompress(cat);
    else setToolsCatConvert(cat);
    renderToolsGrids();
  });

  onClick(".tools-tab", (btn) => {
    setToolsView(btn.dataset.toolsView as "convert" | "compress");
    renderToolsGrids();
  });
}

function initWindowControls() {
  if (!api) return;
  $("window-controls").hidden = false;
  $("win-min").addEventListener("click", () => api!.windowMinimize());
  $("win-max").addEventListener("click", () => api!.windowToggleMaximize());
  $("win-close").addEventListener("click", () => api!.windowClose());
  api.onWindowMaximized((maximized) => $("win-max").classList.toggle("is-maximized", maximized));
}

export function init() {
  initWindowControls();
  initNavigation();
  initDropZone();
  initConvertBar();
  initPreview();
  initTools();
  initDownload();
  initRenderEvents();
  render();
}
