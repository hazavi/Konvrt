import { files, previewIndex, setPreviewIndex } from "./state";
import { isPreviewable, getPreviewUrl, escapeHtml, formatSize } from "./helpers";

function getPreviewableFiles() {
  return files.filter((f) => isPreviewable(f.type, f.ext));
}

export function openPreview(filePath: string, type: string) {
  const modal = document.getElementById("preview-modal")!;
  const body = document.getElementById("preview-body")!;
  const info = document.getElementById("preview-info")!;
  const url = getPreviewUrl(filePath);
  const name = filePath.split(/[\\/]/).pop() || "";
  const file = files.find((f) => f.path === filePath);
  const sizeStr = file && file.size ? formatSize(file.size) : "";
  const previewable = getPreviewableFiles();
  const idx = previewable.findIndex((f) => f.path === filePath);
  setPreviewIndex(idx);
  const counterStr = previewable.length > 1 ? `${idx + 1} / ${previewable.length}` : "";

  if (type === "image") {
    body.innerHTML = `<img src="${url}" alt="${escapeHtml(name)}" />`;
  } else if (type === "video") {
    body.innerHTML = `<video src="${url}" controls autoplay style="outline:none;"></video>`;
  }
  info.innerHTML = `<span class="preview-counter">${counterStr}</span><span class="preview-name">${escapeHtml(name)}</span>${sizeStr ? `<span class="preview-size">${sizeStr}</span>` : ""}`;
  modal.style.display = "flex";
  updatePreviewNav();
}

function updatePreviewNav() {
  const previewable = getPreviewableFiles();
  const prevBtn = document.getElementById("preview-prev") as HTMLButtonElement;
  const nextBtn = document.getElementById("preview-next") as HTMLButtonElement;
  if (prevBtn) prevBtn.disabled = previewIndex <= 0;
  if (nextBtn) nextBtn.disabled = previewIndex >= previewable.length - 1;
  if (prevBtn) prevBtn.style.display = previewable.length <= 1 ? "none" : "flex";
  if (nextBtn) nextBtn.style.display = previewable.length <= 1 ? "none" : "flex";
}

export function navigatePreview(direction: -1 | 1) {
  const previewable = getPreviewableFiles();
  const newIndex = previewIndex + direction;
  if (newIndex < 0 || newIndex >= previewable.length) return;
  const f = previewable[newIndex];
  openPreview(f.path, f.type);
}

export function closePreview() {
  const modal = document.getElementById("preview-modal")!;
  const body = document.getElementById("preview-body")!;
  modal.style.display = "none";
  body.innerHTML = "";
}
