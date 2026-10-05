import { api } from "./api";
import {
  files, outputDir, targetFormat, quality, conversionMode,
  setIsConverting,
} from "./state";
import { render, renderFileList, renderConvertBar } from "./render";

export async function startConversion() {
  if (!api) return;
  setIsConverting(true);
  render();

  const pending = files.filter((f) => f.status === "pending" || f.status === "error");

  for (const file of pending) {
    file.status = "converting";
    file.progress = 0;
    file.error = undefined;
    renderFileList();
    renderConvertBar();

    const result = await api.convert({
      filePath: file.path,
      outputDir,
      format: conversionMode === "compress" ? file.ext : targetFormat,
      quality,
      mode: conversionMode,
    });

    if (result.success) {
      file.status = "done";
      file.progress = 100;
      file.outputPath = result.outputPath;
    } else {
      file.status = "error";
      file.error = result.error;
    }
    renderFileList();
    renderConvertBar();
  }

  setIsConverting(false);
  render();
}
