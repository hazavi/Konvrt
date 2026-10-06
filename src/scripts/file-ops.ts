import { api } from "./api";
import { FORMAT_OPTIONS } from "./constants";
import { $ } from "./dom";
import { detectType, getExt } from "./helpers";
import {
  files, selectedType, targetFormat, conversionMode,
  setTargetFormat, updateSelectedType,
} from "./state";
import { render, renderFileList } from "./render";
import type { FileEntry } from "./types";

export function releaseBrowserFiles(entries: FileEntry[]) {
  for (const file of entries) if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
}

export function addBrowserFiles(selected: File[]) {
  for (const file of selected) {
    const type = detectType(file.name);
    if (!type) continue;
    const id = crypto.randomUUID();
    files.push({
      id,
      path: `browser:${id}`,
      name: file.name,
      ext: getExt(file.name),
      type,
      size: file.size,
      progress: 0,
      status: "pending",
      browserFile: file,
      previewUrl: type === "image" || type === "video" ? URL.createObjectURL(file) : undefined,
    });
  }
  updateSelectedType();
  if (!targetFormat && selectedType && conversionMode !== "compress") {
    setTargetFormat(FORMAT_OPTIONS[selectedType]?.[0] || "");
  }
  render();
}

export function addFiles(paths: string[]) {
  const newPaths: string[] = [];
  for (const p of paths) {
    if (files.some((f) => f.path === p)) continue;
    const name = p.split(/[\\/]/).pop() || p;
    const type = detectType(name);
    if (!type) continue;
    files.push({
      id: crypto.randomUUID(),
      path: p,
      name,
      ext: getExt(name),
      type,
      size: 0,
      progress: 0,
      status: "pending",
    });
    newPaths.push(p);
  }
  updateSelectedType();

  if (!targetFormat && selectedType) {
    if (conversionMode !== "compress") {
      setTargetFormat(FORMAT_OPTIONS[selectedType]?.[0] || "");
    }
    if (targetFormat) $<HTMLSelectElement>("format-select").value = targetFormat;
  }
  render();

  if (newPaths.length > 0) {
    api?.getFileSizes(newPaths).then((sizes) => {
      for (const [path, size] of Object.entries(sizes)) {
        const file = files.find((f) => f.path === path);
        if (file) file.size = size;
      }
      renderFileList();
    });
  }
}
