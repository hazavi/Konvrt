import { files, previewIndex, setPreviewIndex } from "./state";
import { isPreviewable, getPreviewUrl, escapeHtml, formatSize } from "./helpers";
import { $ } from "./dom";

const getPreviewableFiles = () => files.filter((f) => isPreviewable(f.type));

export function openPreview(filePath: string, type: string) {
  const file = files.find((f) => f.path === filePath);
  const url = file?.previewUrl ?? getPreviewUrl(filePath);
  const name = file?.name ?? filePath.split(/[\\/]/).pop() ?? "";
  const size = file?.size;
  const previewable = getPreviewableFiles();
  const idx = previewable.findIndex((f) => f.path === filePath);
  setPreviewIndex(idx);
  const counter = previewable.length > 1 ? `${idx + 1} / ${previewable.length}` : "";

  if (type === "image") {
    $("preview-body").innerHTML = `<img src="${url}" alt="${escapeHtml(name)}" />`;
  } else if (type === "video") {
    $("preview-body").innerHTML = `<video src="${url}" controls autoplay></video>`;
  }
  $("preview-info").innerHTML =
    `<span class="preview-counter">${counter}</span>` +
    `<span class="preview-name">${escapeHtml(name)}</span>` +
    (size ? `<span class="preview-size">${formatSize(size)}</span>` : "");
  $("preview-modal").style.display = "flex";
  updatePreviewNav(previewable.length);
}

function updatePreviewNav(count: number) {
  const prev = $<HTMLButtonElement>("preview-prev");
  const next = $<HTMLButtonElement>("preview-next");
  prev.disabled = previewIndex <= 0;
  next.disabled = previewIndex >= count - 1;
  prev.style.display = next.style.display = count <= 1 ? "none" : "flex";
}

export function navigatePreview(direction: -1 | 1) {
  const target = getPreviewableFiles()[previewIndex + direction];
  if (target) openPreview(target.path, target.type);
}

export function closePreview() {
  $("preview-modal").style.display = "none";
  $("preview-body").innerHTML = "";
}

export const isPreviewOpen = () => $("preview-modal").style.display === "flex";
