import { api } from "./api";
import { $, onClick, setActive, setDisplay } from "./dom";
import { icon } from "./icons";
import { formatDuration, truncatePath } from "./helpers";
import { showToast } from "./toast";
import {
  dlVideoInfo, dlPlatform, dlFormat, dlQuality, dlOutputDir, dlIsDownloading, dlHistory,
  setDlVideoInfo, setDlIsDownloading, setDlPlatform, setDlFormat, setDlQuality, setDlOutputDir,
} from "./state";

const AUDIO_FORMATS = ["mp3", "m4a", "wav", "flac", "ogg"];
const PLATFORM_NAMES = { youtube: "YouTube", tiktok: "TikTok" } as const;

const startBtnLabel = (iconName: "download" | "check" | "close", text: string) =>
  `${icon(iconName, { size: 16, stroke: 2.5 })} ${text}`;

// -- yt-dlp setup --
export async function checkYtDlpAndRender() {
  if (!api) return;
  const installed = await api.ytdlpCheck();
  setDisplay("dl-setup", installed ? "none" : "flex");
  setDisplay("dl-main", installed ? "flex" : "none");
}

export async function handleInstallYtDlp() {
  if (!api) return;
  const btn = $<HTMLButtonElement>("dl-install-btn");
  const status = $("dl-install-status");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Installing...';
  status.textContent = "Downloading download engines...";
  delete status.dataset.tone;

  const result = await api.ytdlpInstall();
  if (result.success) {
    status.textContent = "Installed successfully!";
    status.dataset.tone = "success";
    setTimeout(checkYtDlpAndRender, 500);
  } else {
    status.textContent = `Failed: ${result.error}`;
    status.dataset.tone = "destructive";
    btn.disabled = false;
    btn.innerHTML = `${icon("download", { size: 14 })} Retry Install`;
  }
}

// -- Video info --
function setFetching(fetching: boolean) {
  const input = $<HTMLInputElement>("dl-url-input");
  const btn = $<HTMLButtonElement>("dl-fetch-btn");
  btn.disabled = fetching;
  btn.classList.toggle("loading", fetching);
  input.disabled = fetching;
  input.style.opacity = fetching ? "0.5" : "1";
}

export async function handleFetchVideoInfo() {
  if (!api) return;
  const url = $<HTMLInputElement>("dl-url-input").value.trim();
  if (!url) return;

  setFetching(true);
  for (const id of ["dl-info-card", "dl-options", "dl-progress"]) setDisplay(id, "none");

  const result = await api.ytdlpInfo(url);
  setFetching(false);

  if (!result.success) {
    setDlVideoInfo(null);
    alert("Could not fetch video info: " + result.error);
    return;
  }

  const info = result.data;
  setDlVideoInfo(info);
  $<HTMLImageElement>("dl-thumb").src = info.thumbnail;
  $("dl-title").textContent = info.title;
  $("dl-uploader").textContent = info.uploader;
  $("dl-duration").textContent = formatDuration(info.duration);
  $("dl-platform-badge").textContent = info.platform;
  setDisplay("dl-info-card", "flex");
  setDisplay("dl-options", "flex");
  updateDlStartBtn();
}

export function updateDlStartBtn() {
  $<HTMLButtonElement>("dl-start-btn").disabled = !dlVideoInfo || !dlOutputDir || dlIsDownloading;
}

// -- Download --
function setProgress(pct: number) {
  $("dl-progress-fill").style.width = `${pct}%`;
  $("dl-progress-pct").textContent = `${pct}%`;
}

export async function handleStartDownload() {
  if (!api || !dlVideoInfo || !dlOutputDir) return;
  const info = dlVideoInfo;
  const fmt = dlFormat.toUpperCase();

  setDlIsDownloading(true);
  const startBtn = $<HTMLButtonElement>("dl-start-btn");
  startBtn.innerHTML = '<span class="spinner"></span> Downloading...';
  startBtn.classList.add("is-busy");
  startBtn.disabled = true;

  setDisplay("dl-progress", "flex");
  setProgress(0);
  $("dl-progress-label").textContent = "Downloading...";
  $("dl-progress-speed").textContent = "";
  $("dl-progress-eta").textContent = "";

  const result = await api.ytdlpDownload({
    url: info.url,
    outputDir: dlOutputDir,
    format: dlFormat,
    quality: dlQuality,
  });

  setDlIsDownloading(false);
  startBtn.classList.remove("is-busy");

  if (result.success) {
    startBtn.innerHTML = startBtnLabel("check", "Downloaded!");
    startBtn.classList.add("is-done");
    $("dl-progress-label").textContent = "Complete!";
    setProgress(100);
    dlHistory.unshift({ title: info.title, format: fmt, status: "success", outputPath: result.outputPath });
    showToast(info.title, `${fmt} — Downloaded`, "success", 5000);
  } else {
    startBtn.innerHTML = startBtnLabel("close", "Failed");
    $("dl-progress-label").textContent = "Failed: " + (result.error || "Unknown error");
    dlHistory.unshift({ title: info.title, format: fmt, status: "error", error: result.error });
    showToast(info.title, `${fmt} — ${result.error || "Failed"}`, "error", 6000);
  }

  setDisplay("dl-actions-row", "flex");

  setTimeout(() => {
    startBtn.classList.remove("is-done");
    startBtn.innerHTML = startBtnLabel("download", "Download");
    startBtn.disabled = false;
    setDisplay("dl-progress", "none");
    updateDlStartBtn();
  }, 3000);
}

export function clearDownloadView() {
  const input = $<HTMLInputElement>("dl-url-input");
  input.value = "";
  input.disabled = false;
  input.style.opacity = "1";

  for (const id of ["dl-info-card", "dl-options", "dl-progress", "dl-actions-row"]) {
    setDisplay(id, "none");
  }

  const startBtn = $<HTMLButtonElement>("dl-start-btn");
  startBtn.classList.remove("is-done", "is-busy");
  startBtn.innerHTML = startBtnLabel("download", "Download");

  setDlVideoInfo(null);
  setDlIsDownloading(false);
  updateDlStartBtn();
}

// -- Event wiring --
function syncPlatformUi() {
  const tab = document.querySelector(`.dl-platform-tab[data-platform="${dlPlatform}"]`)!;
  setActive("#dl-platform-tabs .dl-platform-tab", tab);
  $<HTMLInputElement>("dl-url-input").placeholder = `Paste ${PLATFORM_NAMES[dlPlatform]} URL here...`;
}

function initProxy() {
  const toggle = $("dl-proxy-toggle");
  const panel = $("dl-proxy-panel");
  const input = $<HTMLInputElement>("dl-proxy-input");
  const save = $("dl-proxy-save");

  toggle.addEventListener("click", () => {
    const open = panel.style.display === "none";
    panel.style.display = open ? "flex" : "none";
    toggle.classList.toggle("active", open);
  });

  save.addEventListener("click", async () => {
    if (!api) return;
    await api.setProxy(input.value.trim());
    save.textContent = "Saved!";
    setTimeout(() => (save.textContent = "Save"), 1200);
  });

  api?.getProxy().then((proxy) => {
    if (!proxy) return;
    input.value = proxy;
    toggle.classList.add("active");
  });
}

export function initDownload() {
  $("dl-install-btn").addEventListener("click", handleInstallYtDlp);
  $("dl-fetch-btn").addEventListener("click", handleFetchVideoInfo);
  $("dl-start-btn").addEventListener("click", handleStartDownload);
  $("dl-clear-btn").addEventListener("click", clearDownloadView);

  const urlInput = $<HTMLInputElement>("dl-url-input");
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleFetchVideoInfo();
  });
  urlInput.addEventListener("input", () => {
    const url = urlInput.value.toLowerCase();
    if (url.includes("youtube.com") || url.includes("youtu.be")) setDlPlatform("youtube");
    else if (url.includes("tiktok.com")) setDlPlatform("tiktok");
    syncPlatformUi();
  });

  onClick("#dl-platform-tabs .dl-platform-tab", (btn) => {
    setDlPlatform(btn.dataset.platform as typeof dlPlatform);
    syncPlatformUi();
  });

  onClick("#dl-format-btns .dl-fmt-btn", (btn) => {
    setDlFormat(btn.dataset.dlFormat || "mp4");
    setActive("#dl-format-btns .dl-fmt-btn", btn);
    document.querySelector<HTMLElement>(".dl-quality-section")!.style.display =
      AUDIO_FORMATS.includes(dlFormat) ? "none" : "flex";
  });

  onClick("#dl-quality-btns .dl-qual-btn", (btn) => {
    setDlQuality(btn.dataset.dlQuality || "best");
    setActive("#dl-quality-btns .dl-qual-btn", btn);
  });

  $("dl-output-btn").addEventListener("click", async () => {
    const dir = await api?.selectOutputDir();
    if (!dir) return;
    setDlOutputDir(dir);
    $("dl-output-label").textContent = truncatePath(dir, 32);
    updateDlStartBtn();
  });

  initProxy();

  api?.onDownloadProgress((data) => {
    setProgress(Math.round(data.percent || 0));
    if (data.currentSpeed) $("dl-progress-speed").textContent = data.currentSpeed;
    if (data.eta) $("dl-progress-eta").textContent = "ETA: " + data.eta;
  });
}
