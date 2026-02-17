import {
  dlVideoInfo, dlFormat, dlQuality, dlOutputDir, dlIsDownloading, dlHistory,
  setDlVideoInfo, setDlIsDownloading,
} from "./state";
import { escapeHtml, formatDuration } from "./helpers";

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
  status.textContent = "Downloading yt-dlp binary...";

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
  }

  renderDlHistory();

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

export function renderDlHistory() {
  const container = document.getElementById("dl-history")!;
  container.innerHTML = dlHistory
    .map(
      (item) => `
    <div class="dl-history-item">
      <div class="dl-history-icon ${item.status}">
        ${
          item.status === "success"
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
        }
      </div>
      <div class="dl-history-details">
        <div class="dl-history-name">${escapeHtml(item.title)}</div>
        <div class="dl-history-meta">${item.format} - ${item.status === "success" ? "Downloaded" : item.error || "Failed"}</div>
      </div>
    </div>
  `,
    )
    .join("");
}
