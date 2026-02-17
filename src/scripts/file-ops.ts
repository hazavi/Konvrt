import type { FileEntry } from "./types";
import { FORMAT_OPTIONS } from "./constants";
import { detectType, getExt } from "./helpers";
import {
  files, selectedType, targetFormat, conversionMode,
  setSelectedType, setTargetFormat,
} from "./state";
import { render, renderFileList } from "./render";

export function updateSelectedType() {
  if (files.length === 0) {
    setSelectedType(null);
    return;
  }
  const types = new Set(files.map((f) => f.type));
  setSelectedType(types.size === 1 ? files[0].type : "video");
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
    const sel = document.getElementById("format-select") as HTMLSelectElement;
    if (sel && targetFormat) sel.value = targetFormat;
  }
  render();

  // Fetch file sizes asynchronously
  if (newPaths.length > 0) {
    const api = (window as any).konvrt;
    if (api && api.getFileSizes) {
      api.getFileSizes(newPaths).then((sizes: Record<string, number>) => {
        for (const [fp, size] of Object.entries(sizes)) {
          const file = files.find((f) => f.path === fp);
          if (file) file.size = size as number;
        }
        renderFileList();
      });
    }
  }
}
