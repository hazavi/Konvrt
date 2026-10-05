import { api } from "./api";
import { FORMAT_OPTIONS } from "./constants";
import { $ } from "./dom";
import { detectType, getExt } from "./helpers";
import {
  files, selectedType, targetFormat, conversionMode,
  setTargetFormat, updateSelectedType,
} from "./state";
import { render, renderFileList } from "./render";

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
