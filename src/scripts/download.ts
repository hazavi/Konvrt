import {
  dlVideoInfo, dlFormat, dlQuality, dlOutputDir, dlIsDownloading, dlHistory,
  setDlVideoInfo, setDlIsDownloading,
} from "./state";
import { escapeHtml, formatDuration } from "./helpers";

// ── Toast system ──
function showToast(title: string, meta: string, status: "success" | "error", duration = 5000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${status}`;
  toast.style.position = "relative";
  toast.style.overflow = "hidden";

  const iconSvg = status === "success"
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  toast.innerHTML = `
    <div class="toast-icon ${status}">${iconSvg}</div>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-meta">${escapeHtml(meta)}</div>
    </div>
    <button class="toast-close" title="Dismiss">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div class="toast-progress" style="width: 100%;"></div>
  `;

  container.appendChild(toast);

  // Close button
  const closeBtn = toast.querySelector(".toast-close")!;
  const dismissToast = () => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 250);
  };
  closeBtn.addEventListener("click", dismissToast);

  // Animate progress bar
  const progressBar = toast.querySelector(".toast-progress") as HTMLElement;
  requestAnimationFrame(() => {
    progressBar.style.transitionDuration = duration + "ms";
    progressBar.style.width = "0%";
  });

  // Auto-dismiss
  setTimeout(dismissToast, duration);
}

export async function checkYtDlpAndRender() {
  const api = (window as any).konvrt;
  if (!api) return;
  const installed = await api.ytdlpCheck();
  const setup = document.getElementById("dl-setup")!;
  const main = document.getElementById("dl-main")!;
  if (installed) {
    setup.style.display = "none";
    main.style.display = "flex";
    main.style.flexDirection = "column";
    main.style.gap = "16px";
  } else {
    setup.style.display = "flex";
    main.style.display = "none";
  }
}

export async function handleInstallYtDlp() {
  const api = (window as any).konvrt;
  if (!api) return;
  const btn = document.getElementById("dl-install-btn") as HTMLButtonElement;
  const status = document.getElementById("dl-install-status")!;
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span> Installing...';
  status.textContent = "Downloading download engines...";

  const result = await api.ytdlpInstall();
  if (result.success) {
    status.textContent = "Installed successfully!";
    status.style.color = "var(--success)";
    setTimeout(() => checkYtDlpAndRender(), 500);
  } else {
    status.textContent = `Failed: ${result.error}`;
    status.style.color = "var(--error)";
    btn.disabled = false;
    btn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Retry Install';
  }
}

export async function handleFetchVideoInfo() {
  const api = (window as any).konvrt;
  if (!api) return;
  const input = document.getElementById("dl-url-input") as HTMLInputElement;
  const fetchBtn = document.getElementById("dl-fetch-btn") as HTMLButtonElement;
  const url = input.value.trim();
  if (!url) return;

  fetchBtn.disabled = true;
  fetchBtn.classList.add("loading");
  input.disabled = true;
  input.style.opacity = "0.5";

  // Hide previous info
  document.getElementById("dl-info-card")!.style.display = "none";
  document.getElementById("dl-options")!.style.display = "none";
  document.getElementById("dl-progress")!.style.display = "none";

  const result = await api.ytdlpInfo(url);
  fetchBtn.disabled = false;
  fetchBtn.classList.remove("loading");
  input.disabled = false;
  input.style.opacity = "1";

  if (result.success) {
    setDlVideoInfo(result.data);
    (document.getElementById("dl-thumb") as HTMLImageElement).src = result.data.thumbnail;
    document.getElementById("dl-title")!.textContent = result.data.title;
    document.getElementById("dl-uploader")!.textContent = result.data.uploader;
    document.getElementById("dl-duration")!.textContent = formatDuration(result.data.duration);
    document.getElementById("dl-platform-badge")!.textContent = result.data.platform;
    document.getElementById("dl-info-card")!.style.display = "flex";
    document.getElementById("dl-options")!.style.display = "flex";
    updateDlStartBtn();
  } else {
    setDlVideoInfo(null);
    alert("Could not fetch video info: " + result.error);
  }
}

export function updateDlStartBtn() {
  const btn = document.getElementById("dl-start-btn") as HTMLButtonElement;
  btn.disabled = !dlVideoInfo || !dlOutputDir || dlIsDownloading;
}

export async function handleStartDownload() {
  const api = (window as any).konvrt;
  if (!api || !dlVideoInfo || !dlOutputDir) return;

  setDlIsDownloading(true);
  const startBtn = document.getElementById("dl-start-btn") as HTMLButtonElement;
  const progressDiv = document.getElementById("dl-progress")!;
  startBtn.innerHTML = '<span class="btn-spinner"></span> Downloading...';
  startBtn.classList.add("downloading");
  startBtn.disabled = true;

  progressDiv.style.display = "flex";
  document.getElementById("dl-progress-fill")!.style.width = "0%";
  document.getElementById("dl-progress-pct")!.textContent = "0%";
  document.getElementById("dl-progress-label")!.textContent = "Downloading...";
  document.getElementById("dl-progress-speed")!.textContent = "";
  document.getElementById("dl-progress-eta")!.textContent = "";

  const result = await api.ytdlpDownload({
    url: dlVideoInfo.url,
    outputDir: dlOutputDir,
    format: dlFormat,
    quality: dlQuality,
  });

  setDlIsDownloading(false);

  if (result.success) {
    startBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Downloaded!';
    startBtn.classList.remove("downloading");
    startBtn.classList.add("done");
    document.getElementById("dl-progress-label")!.textContent = "Complete!";
    document.getElementById("dl-progress-fill")!.style.width = "100%";
    document.getElementById("dl-progress-pct")!.textContent = "100%";

    dlHistory.unshift({
      title: dlVideoInfo.title,
      format: dlFormat.toUpperCase(),
      status: "success",
      outputPath: result.outputPath,
    });

    showToast(dlVideoInfo.title, `${dlFormat.toUpperCase()} — Downloaded`, "success", 5000);
  } else {
    startBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Failed';
    startBtn.classList.remove("downloading");
    document.getElementById("dl-progress-label")!.textContent =
      "Failed: " + (result.error || "Unknown error");

    dlHistory.unshift({
      title: dlVideoInfo?.title || "Unknown",
      format: dlFormat.toUpperCase(),
      status: "error",
      error: result.error,
    });

    showToast(dlVideoInfo?.title || "Unknown", `${dlFormat.toUpperCase()} — ${result.error || "Failed"}`, "error", 6000);
  }

  // Show the clear/new download button
  const actionsRow = document.getElementById("dl-actions-row");
  if (actionsRow) actionsRow.style.display = "flex";

  // Reset after delay
  setTimeout(() => {
    startBtn.classList.remove("done");
    startBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download';
    startBtn.disabled = false;
    progressDiv.style.display = "none";
    updateDlStartBtn();
  }, 3000);
}

export function clearDownloadView() {
  // Reset URL input
  const input = document.getElementById("dl-url-input") as HTMLInputElement;
  if (input) {
    input.value = "";
    input.disabled = false;
    input.style.opacity = "1";
  }

  // Hide info card, options, progress
  const infoCard = document.getElementById("dl-info-card");
  const options = document.getElementById("dl-options");
  const progress = document.getElementById("dl-progress");
  const actionsRow = document.getElementById("dl-actions-row");
  if (infoCard) infoCard.style.display = "none";
  if (options) options.style.display = "none";
  if (progress) progress.style.display = "none";
  if (actionsRow) actionsRow.style.display = "none";

  // Reset start button
  const startBtn = document.getElementById("dl-start-btn") as HTMLButtonElement;
  if (startBtn) {
    startBtn.classList.remove("done", "downloading");
    startBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download';
    startBtn.disabled = true;
  }

  // Reset video info
  setDlVideoInfo(null);
  setDlIsDownloading(false);
  updateDlStartBtn();
}
