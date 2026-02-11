# Konvrt

A desktop media converter and compression tool built with Electron, FFmpeg, Sharp, and MuPDF. Convert and compress videos, audio, images, and PDFs entirely offline on your machine.

## Features

- **Video Conversion** -- MP4, MKV, AVI, MOV, WEBM, FLV, WMV
- **Audio Conversion** -- MP3, WAV, OGG, FLAC, AAC, M4A, WMA
- **Image Conversion** -- JPG, PNG, WEBP, AVIF, GIF, BMP, TIFF, HEIF, SVG
- **PDF Conversion** -- PDF to image (PNG, JPG, WEBP, AVIF, TIFF, BMP, GIF) and image to PDF
- **GIF Creation** -- Convert any video format to animated GIF
- **Compression** -- Reduce file sizes for video, audio, image, and GIF with adjustable quality
- **Batch Processing** -- Convert or compress multiple files at once with progress tracking
- **File Previews** -- Thumbnail previews for images and videos, with a full preview modal
- **100% Local** -- All processing happens on your machine. No uploads, no servers.

## Tech Stack

| Layer       | Technology                                  |
| :---------- | :------------------------------------------ |
| Frontend    | Astro (static output)                       |
| Desktop     | Electron                                    |
| Video/Audio | FFmpeg via fluent-ffmpeg                    |
| Images      | Sharp, Jimp (BMP fallback)                  |
| PDF         | MuPDF (PDF to image), PDFKit (image to PDF) |

## Project Structure

```
Konvrt/
  electron/
    main.cjs          # Electron main process, IPC handlers
    preload.cjs        # Context bridge (renderer API)
    converter.cjs      # Processing engine (FFmpeg, Sharp, MuPDF, PDFKit)
  src/
    layouts/
      Layout.astro     # Global shell, CSS design system
    components/
      Header.astro     # App header with navigation tabs
      DropZone.astro   # Drag-and-drop file input
      FileList.astro   # File list with thumbnails and preview modal
      ConvertBar.astro # Bottom bar: format, quality, mode, actions
      ToolsPanel.astro # Converter and compressor tool grids
    pages/
      index.astro      # Main page, all client-side logic
  public/              # Static assets
  dist/                # Astro build output (generated)
  release/             # Electron packaged builds (generated)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm

### Install

```sh
git clone https://github.com/your-username/Konvrt.git
cd Konvrt
npm install
```

### Development

Start the Astro dev server and Electron together:

```sh
npm run dev
```

Or run them separately:

```sh
npm run dev:astro      # Start Astro on localhost:4321
npm run dev:electron   # Launch Electron (requires Astro running)
```

### Build

Build the Astro frontend and package the Electron app:

```sh
npm run build
```

This runs `astro build` then `electron-builder` for Windows, macOS, and Linux. Packaged output is written to `release/`.

## Commands

| Command                | Action                                     |
| :--------------------- | :----------------------------------------- |
| `npm install`          | Install dependencies                       |
| `npm run dev`          | Start Astro + Electron concurrently        |
| `npm run dev:astro`    | Start Astro dev server on port 4321        |
| `npm run dev:electron` | Launch Electron (connect to running Astro) |
| `npm run build`        | Build frontend and package desktop app     |
| `npm run preview`      | Preview the Astro build locally            |

## License

MIT
