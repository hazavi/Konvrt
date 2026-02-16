# Konvrt

A multi media converter, compressor, and downloader built with Electron, FFmpeg, Sharp, and MuPDF. Convert, compress, and download videos, audio, images, and PDFs — entirely offline on your machine.

![License](https://img.shields.io/badge/license-MIT-blue)

## Features

### Convert & Compress

- **Video** — MP4, MKV, AVI, MOV, WEBM, FLV, WMV
- **Audio** — MP3, WAV, OGG, FLAC, AAC, M4A, WMA
- **Image** — JPG, PNG, WEBP, AVIF, GIF, BMP, TIFF, HEIF, SVG
- **PDF** — PDF ↔ image (PNG, JPG, WEBP, AVIF, TIFF, BMP, GIF)
- **GIF Creation** — Convert any video to animated GIF
- **Compression** — Reduce file sizes for video, audio, image, and GIF
- **Batch Processing** — Multiple files at once with progress tracking
- **File Previews** — Thumbnails and full preview modal

### Download

- **YouTube** — Download video/audio via InnerTube API with yt-dlp fallback
- **TikTok & Other Platforms** — Generic yt-dlp support for 1000+ sites
- **Format Selection** — Choose MP4 video or MP3/M4A audio
- **Quality Options** — 1080p, 720p, 480p, best available
- **Proxy Support** — Optional HTTP/SOCKS proxy configuration

### General

- **100% Local** — All processing on your machine. No uploads, no servers.
- **Cross-Platform** — Windows, macOS, Linux

## Tech Stack

| Layer       | Technology                                |
| :---------- | :---------------------------------------- |
| Frontend    | Astro (static output)                     |
| Desktop     | Electron                                  |
| Video/Audio | FFmpeg via fluent-ffmpeg                  |
| Images      | Sharp, Jimp (BMP fallback)                |
| PDF         | MuPDF (PDF → image), PDFKit (image → PDF) |
| Downloads   | InnerTube API, yt-dlp                     |

## Project Structure

```
Konvrt/
├── electron/
│   ├── main.cjs              # Electron main process & IPC handlers
│   ├── preload.cjs           # Context bridge (renderer ↔ main)
│   ├── converter.cjs         # FFmpeg, Sharp, MuPDF, PDFKit engine
│   ├── dev.cjs               # Dev helper (waits for Astro server)
│   └── downloader/
│       ├── index.cjs         # Unified download API (routes YouTube vs generic)
│       ├── settings.cjs      # Paths, proxy config, yt-dlp binary location
│       ├── http.cjs          # HTTP/HTTPS utilities, file download with progress
│       ├── youtube.cjs       # InnerTube API, direct YouTube download
│       └── ytdlp.cjs         # yt-dlp binary management, generic downloads
├── src/
│   ├── layouts/
│   │   └── Layout.astro      # Global shell & CSS design system
│   ├── components/
│   │   ├── Header.astro      # Navigation tabs (Convert / Download)
│   │   ├── DropZone.astro    # Drag-and-drop file input
│   │   ├── FileList.astro    # File list with thumbnails & preview modal
│   │   ├── ConvertBar.astro  # Bottom bar: format, quality, mode, actions
│   │   ├── ToolsPanel.astro  # Converter & compressor tool grids
│   │   └── DownloadView.astro# Download UI: URL input, info, options, progress
│   └── pages/
│       └── index.astro       # Main page & client-side logic
├── .github/
│   └── workflows/
│       └── release.yml       # GitHub Actions: build & release
├── Dockerfile                # Docker build (multi-stage)
├── .dockerignore
├── package.json
├── astro.config.mjs
└── tsconfig.json
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
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

This runs `astro build` then `electron-builder` for Windows, macOS, and Linux. Output goes to `release/`.

### Docker

Build and run the Astro static preview in a container:

```sh
docker build -t konvrt .
docker run -p 4321:4321 konvrt
```

> **Note:** The Docker image serves the Astro static frontend only. Electron desktop features (file conversion, downloads) require the native desktop build.

## CI / CD

The repository includes a GitHub Actions workflow (`.github/workflows/release.yml`) that automatically builds installers for **Windows** (`.exe`), **macOS** (`.dmg`), and **Linux** (`.AppImage`) when a GitHub Release is created. Artifacts are uploaded to the release.

To trigger a build manually, use the **Run workflow** button on the Actions tab.

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
