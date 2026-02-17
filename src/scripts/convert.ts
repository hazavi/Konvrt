import {
  files, outputDir, targetFormat, quality, conversionMode,
  setIsConverting,
} from "./state";
import { render, renderFileList, renderConvertBar } from "./render";

export async function startConversion() {
  const api = (window as any).konvrt;
  if (!api) return;
  // Avoid re-entry from state module (isConverting is checked inline)
  setIsConverting(true);
  render();

  const pending = files.filter((f) => f.status === "pending" || f.status === "error");

  for (const file of pending) {
    file.status = "converting";
    file.progress = 0;
    file.error = undefined;
    renderFileList();
    renderConvertBar();

    const format = conversionMode === "compress" ? file.ext : targetFormat;

    const result = await api.convert({
      filePath: file.path,
      outputDir,
      format,
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
