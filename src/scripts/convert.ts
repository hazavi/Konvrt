import { api } from "./api";
import {
  files, outputDir, targetFormat, quality, conversionMode, imageOptions,
  setIsConverting,
} from "./state";
import { render, renderFileList, renderConvertBar } from "./render";
import { convertBrowserImage } from "./browser-convert";

export async function startConversion() {
  setIsConverting(true);
  render();

  const pending = files.filter((f) => f.status === "pending" || f.status === "error");

  for (const file of pending) {
    file.status = "converting";
    file.progress = 0;
    file.error = undefined;
    renderFileList();
    renderConvertBar();

    let result: { success: boolean; outputPath?: string; error?: string };
    try {
      if (api) {
        result = await api.convert({
          filePath: file.path,
          outputDir,
          format: conversionMode === "compress" ? file.ext : targetFormat,
          quality,
          mode: conversionMode,
          imageOptions: file.type === "image" ? imageOptions : undefined,
        });
      } else {
        const outputPath = await convertBrowserImage(
          file,
          conversionMode === "compress" ? file.ext : targetFormat,
          quality,
          imageOptions,
        );
        result = { success: true, outputPath };
      }
    } catch (error) {
      result = { success: false, error: error instanceof Error ? error.message : String(error) };
    }

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
