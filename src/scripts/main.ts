import {
  files, outputDir, quality, currentTab, conversionMode,
  formatSubTab, toolsView, dlPlatform, dlFormat, dlQuality, dlOutputDir,
  toolsCatConvert, toolsCatCompress,
  setFiles, setOutputDir, setTargetFormat, setQuality,
  setCurrentTab, setConversionMode, setFormatSubTab,
  setToolsView, setToolsCatConvert, setToolsCatCompress,
  setDlPlatform, setDlFormat, setDlQuality, setDlOutputDir,
  setSelectedType,
} from "./state";
import {
  render, renderTabs, renderViews, renderFileList, renderConvertBar,
  renderToolsGrids, setOpenPreviewFn, setOnRemoveFile,
} from "./render";
import { addFiles, updateSelectedType } from "./file-ops";
import { startConversion } from "./convert";
import {
  checkYtDlpAndRender, handleInstallYtDlp, handleFetchVideoInfo,
  handleStartDownload, updateDlStartBtn,
} from "./download";
import { openPreview, closePreview, navigatePreview } from "./preview";

export function init() {
  const api = (window as any).konvrt;

  // Wire up render callbacks
  setOpenPreviewFn(openPreview);
  setOnRemoveFile(() => updateSelectedType());

  // Tab navigation
  document.querySelectorAll("#nav-tabs .tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      setCurrentTab((btn as HTMLElement).dataset.tab as typeof currentTab);
      if (currentTab === "compress") {
        setConversionMode("compress");
        setQuality(85);
      }
      if (currentTab === "convert") {
        setConversionMode("convert");
        setQuality(80);
      }
      if (currentTab === "download") {
        checkYtDlpAndRender();
      }
      render();
    });
  });

  // Browse button
  document
    .getElementById("browse-btn")!
    .addEventListener("click", async () => {
      if (!api) return alert("Running outside Electron - file picker unavailable.");
      const paths: string[] = await api.selectFiles();
      addFiles(paths);
    });

  // Drop zone
  const zone = document.getElementById("dropzone")!;
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const dropped = Array.from(e.dataTransfer?.files || []);
    addFiles(dropped.map((f: any) => f.path).filter(Boolean));
  });

  // Output dir
  document
    .getElementById("output-dir-btn")!
    .addEventListener("click", async () => {
      if (!api) return;
      const dir = await api.selectOutputDir();
      if (dir) {
        setOutputDir(dir);
        render();
      }
    });

  // Format change
  document
    .getElementById("format-select")!
    .addEventListener("change", (e) => {
      setTargetFormat((e.target as HTMLSelectElement).value);
    });

  // Quality slider
  document
    .getElementById("quality-slider")!
    .addEventListener("input", (e) => {
      setQuality(Number((e.target as HTMLInputElement).value));
      document.getElementById("quality-value")!.textContent = `${quality}%`;
      document.getElementById("slider-fill")!.style.width = `${quality}%`;
    });

  // Quality help tooltip
  const helpBtn = document.getElementById("quality-help")!;
  const tooltip = document.getElementById("quality-tooltip")!;
  helpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tooltip.classList.toggle("visible");
  });
  document.addEventListener("click", () => tooltip.classList.remove("visible"));
  tooltip.addEventListener("click", (e) => e.stopPropagation());

  // Format sub-tabs (Video / Audio)
  document.querySelectorAll("#format-tabs .format-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      setFormatSubTab((btn as HTMLElement).dataset.formatTab as "video" | "audio");
      render();
    });
  });

  // Mode toggle
  document.querySelectorAll("#mode-toggle .mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setConversionMode((btn as HTMLElement).dataset.mode as "convert" | "compress");
      if (conversionMode === "compress") {
        setQuality(85);
      } else {
        setQuality(80);
      }
      render();
    });
  });

  // Convert button
  document
    .getElementById("convert-btn")!
    .addEventListener("click", () => startConversion());

  // Clear button
  document.getElementById("clear-btn")!.addEventListener("click", () => {
    setFiles([]);
    setSelectedType(null);
    render();
  });

  // Preview close
  document
    .getElementById("preview-close")!
    .addEventListener("click", closePreview);
  document
    .getElementById("preview-modal")!
    .querySelector(".modal-backdrop")!
    .addEventListener("click", closePreview);

  // Preview navigation
  document
    .getElementById("preview-prev")!
    .addEventListener("click", () => navigatePreview(-1));
  document
    .getElementById("preview-next")!
    .addEventListener("click", () => navigatePreview(1));

  // Keyboard close + navigation
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePreview();
    const modal = document.getElementById("preview-modal")!;
    if (modal.style.display === "flex") {
      if (e.key === "ArrowLeft") navigatePreview(-1);
      if (e.key === "ArrowRight") navigatePreview(1);
    }
  });

  // Tools category tabs (per-section)
  document.querySelectorAll(".tools-categories .cat-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parent = (btn as HTMLElement).closest(".tools-categories")!;
      const section = (parent as HTMLElement).dataset.section;
      parent
        .querySelectorAll(".cat-tab")
        .forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      const cat = (btn as HTMLElement).dataset.cat || "all";
      if (section === "compress") {
        setToolsCatCompress(cat);
      } else {
        setToolsCatConvert(cat);
      }
      renderToolsGrids();
    });
  });

  // Tools sub-tabs
  document.querySelectorAll(".tools-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      setToolsView((btn as HTMLElement).dataset.toolsView as "convert" | "compress");
      renderToolsGrids();
    });
  });

  // Progress listener
  if (api) {
    api.onProgress((data: { filePath: string; progress: number }) => {
      const file = files.find((f) => f.path === data.filePath);
      if (file) {
        file.progress = data.progress;
        renderFileList();
        renderConvertBar();
      }
    });
  }

  // === Download event listeners ===
  document
    .getElementById("dl-install-btn")
    ?.addEventListener("click", handleInstallYtDlp);
  document
    .getElementById("dl-fetch-btn")
    ?.addEventListener("click", handleFetchVideoInfo);
  document
    .getElementById("dl-start-btn")
    ?.addEventListener("click", handleStartDownload);

  // URL input: Enter to fetch
  document
    .getElementById("dl-url-input")
    ?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleFetchVideoInfo();
    });

  // URL input: auto-detect platform from paste
  document.getElementById("dl-url-input")?.addEventListener("input", () => {
    const val = (
      document.getElementById("dl-url-input") as HTMLInputElement
    ).value.toLowerCase();
    if (val.includes("youtube.com") || val.includes("youtu.be")) {
      setDlPlatform("youtube");
    } else if (val.includes("tiktok.com")) {
      setDlPlatform("tiktok");
    }
    document
      .querySelectorAll("#dl-platform-tabs .dl-platform-tab")
      .forEach((t) => {
        t.classList.toggle(
          "active",
          (t as HTMLElement).dataset.platform === dlPlatform,
        );
      });
  });

  // Platform tabs
  document
    .querySelectorAll("#dl-platform-tabs .dl-platform-tab")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        setDlPlatform((btn as HTMLElement).dataset.platform as "youtube" | "tiktok");
        document
          .querySelectorAll("#dl-platform-tabs .dl-platform-tab")
          .forEach((t) => t.classList.remove("active"));
        btn.classList.add("active");
        const input = document.getElementById("dl-url-input") as HTMLInputElement;
        if (dlPlatform === "youtube") {
          input.placeholder = "Paste YouTube URL here...";
        } else {
          input.placeholder = "Paste TikTok URL here...";
        }
      });
    });

  // Format buttons
  document.querySelectorAll("#dl-format-btns .dl-fmt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setDlFormat((btn as HTMLElement).dataset.dlFormat || "mp4");
      document
        .querySelectorAll("#dl-format-btns .dl-fmt-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const qualSection = document.querySelector(".dl-quality-section") as HTMLElement;
      const isAudio = ["mp3", "m4a", "wav", "flac", "ogg"].includes(dlFormat);
      if (qualSection) qualSection.style.display = isAudio ? "none" : "flex";
    });
  });

  // Quality buttons
  document.querySelectorAll("#dl-quality-btns .dl-qual-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setDlQuality((btn as HTMLElement).dataset.dlQuality || "best");
      document
        .querySelectorAll("#dl-quality-btns .dl-qual-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Output dir for downloads
  document
    .getElementById("dl-output-btn")
    ?.addEventListener("click", async () => {
      if (!api) return;
      const dir = await api.selectOutputDir();
      if (dir) {
        setDlOutputDir(dir);
        document.getElementById("dl-output-label")!.textContent =
          dir.length > 35 ? "..." + dir.slice(-32) : dir;
        updateDlStartBtn();
      }
    });

  // Proxy settings
  const proxyToggle = document.getElementById("dl-proxy-toggle");
  const proxyPanel = document.getElementById("dl-proxy-panel");
  const proxyInput = document.getElementById("dl-proxy-input") as HTMLInputElement;
  const proxySave = document.getElementById("dl-proxy-save");

  proxyToggle?.addEventListener("click", () => {
    const visible = proxyPanel!.style.display !== "none";
    proxyPanel!.style.display = visible ? "none" : "flex";
    proxyToggle!.classList.toggle("active", !visible);
  });

  proxySave?.addEventListener("click", async () => {
    if (!api) return;
    const val = proxyInput?.value?.trim() || "";
    await api.setProxy(val);
    proxySave!.textContent = "Saved!";
    setTimeout(() => {
      proxySave!.textContent = "Save";
    }, 1200);
  });

  // Load saved proxy on init
  if (api) {
    api.getProxy().then((p: string) => {
      if (p && proxyInput) {
        proxyInput.value = p;
        proxyToggle?.classList.add("active");
      }
    });
  }

  // Download progress listener
  if (api) {
    api.onDownloadProgress(
      (data: {
        url: string;
        percent: number;
        totalSize: string;
        currentSpeed: string;
        eta: string;
      }) => {
        const pct = Math.round(data.percent || 0);
        document.getElementById("dl-progress-fill")!.style.width = pct + "%";
        document.getElementById("dl-progress-pct")!.textContent = pct + "%";
        if (data.currentSpeed)
          document.getElementById("dl-progress-speed")!.textContent =
            data.currentSpeed;
        if (data.eta)
          document.getElementById("dl-progress-eta")!.textContent =
            "ETA: " + data.eta;
      },
    );
  }

  render();
}
