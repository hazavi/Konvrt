import { api } from "./api";
import { $, onClick, setActive } from "./dom";
import {
  files, quality, currentTab, imageOptions, targetFormat, conversionMode,
  setFiles, setOutputDir, setTargetFormat, setQuality, applyMode,
  setCurrentTab, setFormatSubTab,
  setToolsView, setToolsCatConvert, setToolsCatCompress,
  setSelectedType, setImageOptions,
} from "./state";
import { render, renderFileList, renderConvertBar, renderToolsGrids, initRenderEvents } from "./render";
import { addFiles, addBrowserFiles, releaseBrowserFiles } from "./file-ops";
import { startConversion } from "./convert";
import { checkYtDlpAndRender, initDownload } from "./download";
import { isPreviewOpen, closePreview, navigatePreview } from "./preview";
import { showToast } from "./toast";

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
  const dropTarget = $("view-convert");
  const browserInput = $<HTMLInputElement>("browser-file-input");

  const browse = async () => {
    if (api) addFiles(await api.selectFiles());
    else browserInput.click();
  };

  $("browse-btn").addEventListener("click", browse);
  $("add-files-btn").addEventListener("click", browse);
  browserInput.addEventListener("change", () => {
    addBrowserFiles(Array.from(browserInput.files ?? []));
    browserInput.value = "";
  });

  dropTarget.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  dropTarget.addEventListener("dragleave", (e) => {
    if (!dropTarget.contains(e.relatedTarget as Node)) zone.classList.remove("drag-over");
  });
  dropTarget.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const dropped = Array.from(e.dataTransfer?.files ?? []) as (File & { path?: string })[];
    if (api) addFiles(dropped.map((f) => f.path).filter((p): p is string => Boolean(p)));
    else addBrowserFiles(dropped);
  });
}

function initConvertBar() {
  $("output-dir-btn").addEventListener("click", async () => {
    if (!api) return showToast("Browser downloads", "Converted files are saved to your browser's download folder.", "success");
    const dir = await api?.selectOutputDir();
    if (!dir) return;
    setOutputDir(dir);
    render();
  });

  $<HTMLSelectElement>("format-select").addEventListener("change", (e) => {
    setTargetFormat((e.target as HTMLSelectElement).value);
    renderConvertBar();
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
    releaseBrowserFiles(files);
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

function initImageOptions() {
  const dialog = $<HTMLDialogElement>("image-options-dialog");
  const width = $<HTMLInputElement>("image-width");
  const height = $<HTMLInputElement>("image-height");

  $("image-options-btn").addEventListener("click", () => {
    const ico = conversionMode === "convert"
      ? targetFormat === "ico"
      : files.every((file) => file.ext.toLowerCase() === "ico");
    width.max = height.max = ico ? "256" : "16384";
    width.placeholder = height.placeholder = ico ? "Auto" : "Original";
    $("image-size-hint").textContent = ico
      ? "ICO frames can be at most 256 × 256 px. Leave both blank for multiple sizes up to 256 px."
      : "Leave both blank to keep the original dimensions. Enter one dimension to keep the aspect ratio.";
    width.value = imageOptions.width?.toString() ?? "";
    height.value = imageOptions.height?.toString() ?? "";
    document.querySelector<HTMLInputElement>(`input[name="image-fit"][value="${imageOptions.fit}"]`)!.checked = true;
    dialog.showModal();
  });

  $("image-options-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  $("image-options-form").addEventListener("submit", (event) => {
    event.preventDefault();
    setImageOptions({
      width: width.value ? Number(width.value) : null,
      height: height.value ? Number(height.value) : null,
      fit: document.querySelector<HTMLInputElement>('input[name="image-fit"]:checked')!.value as "max" | "crop" | "scale",
    });
    dialog.close();
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
  if (!api) setOutputDir("Downloads");
  initWindowControls();
  initNavigation();
  initDropZone();
  initConvertBar();
  initImageOptions();
  initPreview();
  initTools();
  initDownload();
  initRenderEvents();
  render();
}
