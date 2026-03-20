<div align="center">

<img src="public/konvrt_ico.ico" alt="Konvrt" width="72" />

# Konvrt

A multimedia converter, compressor, and downloader built with Electron, FFmpeg, Sharp, and MuPDF.
Convert, compress, and download videos, audio, images, documents, and PDFs -- entirely offline on your machine.

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Preview

<div align="center">
  <img src="public/konvrt_preview.gif" alt="Konvrt Preview" width="780" />
</div>

</div>

---

## Supported Formats

### Video (21 formats)

MP4, MKV, AVI, MOV, WEBM, FLV, WMV, TS, M2TS, MTS, 3GP, OGV, VOB, MPG, MPEG, M4V, DIVX, ASF, RM, RMVB, F4V

### Audio (17 formats)

MP3, WAV, OGG, FLAC, AAC, M4A, OPUS, WMA, AIFF, AC3, ALAC, DTS, AMR, AU, RA, WV, APE

### Image (20 formats)

JPG, PNG, GIF, BMP, TIFF, WEBP, SVG, AVIF, HEIC, HEIF, ICO, JXL, JP2, PSD, RAW, CR2, NEF, DNG

### Document (13 formats)

TXT, MD, HTML, CSV, JSON, XML, YAML, YML, TSV, LOG, RTF, HTM, Markdown

### PDF

PDF to Image (PNG, JPG, WEBP, AVIF, TIFF, BMP, GIF) and Image to PDF

---

## Features

### Convert and Compress

- **Video** -- MP4, MKV, AVI, MOV, WEBM, FLV, WMV, TS, 3GP, OGV, M4V, MPG
- **Audio** -- MP3, WAV, OGG, FLAC, AAC, M4A, WMA, OPUS, AIFF, AC3, ALAC
- **Image** -- JPG, PNG, WEBP, AVIF, GIF, BMP, TIFF, HEIF, ICO, JXL, SVG
- **Document** -- HTML, TXT, MD, CSV, JSON, PDF (between document formats)
- **PDF** -- PDF to image and image to PDF (multi-page support)
- **GIF Creation** -- Convert any video to animated GIF
- **Video to Audio** -- Extract audio from any video (MP3, M4A, WAV, FLAC, OGG, OPUS, etc.)
- **Animated GIF to Video** -- Convert GIF to MP4 or WEBM
- **Compression** -- Reduce file sizes for video, audio, image, and GIF with quality control
- **Batch Processing** -- Convert multiple files at once with per-file progress tracking
- **File Previews** -- Thumbnails for images/videos and full preview modal with navigation

### Document to HTML Parser

Convert documents to well-structured, styled HTML with full parser support:

- **Markdown to HTML** -- Headers, bold, italic, strikethrough, links, images, code blocks, blockquotes, lists (ordered and unordered), tables, and horizontal rules
- **CSV / TSV to HTML** -- Generates styled HTML tables with headers, proper escaping, and quoted field support
- **JSON to HTML** -- Syntax-highlighted JSON with color-coded keys, strings, numbers, booleans, and nulls
- **XML to HTML** -- Formatted and escaped XML code display
- **YAML to HTML** -- Formatted code display
- **Plain Text to HTML** -- Paragraph wrapping with line break preservation
- **Log to HTML** -- Monospace line-by-line display
- **RTF to HTML** -- Basic RTF control code stripping and text extraction

Additional document conversions:

- **HTML to Markdown** -- Reverse conversion (headings, bold, italic, links, images, lists)
- **HTML to Plain Text** -- Tag stripping with entity decoding
- **CSV to JSON** -- Structured array-of-objects output
- **JSON to CSV** -- Flat JSON arrays to comma-separated values
- **Any Document to PDF** -- Text extraction and PDF generation via PDFKit

### Download

- **YouTube** -- Download video and audio via yt-dlp
- **TikTok and Other Platforms** -- Generic yt-dlp support for 1000+ sites
- **Format Selection** -- MP4, WEBM video or MP3, M4A, WAV, FLAC, OGG audio
- **Quality Options** -- Best, 1080p, 720p, 480p
- **Proxy Support** -- Optional HTTP/SOCKS proxy configuration
- **Progress Tracking** -- Real-time progress with speed and ETA display

### General

- **100% Local** -- All processing happens on your machine. No uploads, no servers.
- **Cross-Platform** -- Windows (macOS and Linux support coming soon)

---

## Tech Stack

| Layer       | Technology                                  |
| :---------- | :------------------------------------------ |
| Frontend    | Astro (static output)                       |
| Desktop     | Electron 33                                 |
| Video/Audio | FFmpeg via fluent-ffmpeg                    |
| Images      | Sharp, Jimp (BMP fallback)                  |
| PDF         | MuPDF (PDF to image), PDFKit (image to PDF) |
| Documents   | Built-in parsers (Markdown, CSV, JSON, XML) |
| Downloads   | yt-dlp                                      |

---

## Project Structure

```
Konvrt/
├── electron/
│   ├── main.cjs              # Electron main process, IPC handlers, static server
│   ├── preload.cjs           # Context bridge (renderer to main)
│   ├── converter.cjs         # FFmpeg, Sharp, MuPDF, PDFKit, document parser engine
│   ├── dev.cjs               # Dev helper (waits for Astro server)
│   └── downloader/
│       ├── index.cjs         # Unified download API (routes YouTube vs generic)
│       ├── settings.cjs      # Paths, proxy config, yt-dlp binary location
│       ├── http.cjs          # HTTP/HTTPS utilities, file download with progress
│       ├── youtube.cjs       # YouTube-specific yt-dlp download
│       └── ytdlp.cjs         # yt-dlp binary management, generic downloads
├── src/
│   ├── layouts/
│   │   └── Layout.astro      # Global shell, CSS design system, color variables
│   ├── components/
│   │   ├── Header.astro      # Navigation tabs (Convert, Compress, Download, Tools)
│   │   ├── DropZone.astro    # Drag-and-drop file input with format tags
│   │   ├── FileList.astro    # File list with thumbnails, progress, preview modal
│   │   ├── ConvertBar.astro  # Bottom bar: format, quality, mode, actions
│   │   ├── ToolsPanel.astro  # Converter and compressor tool grids (6 categories)
│   │   └── DownloadView.astro# Download UI: URL input, info, options, progress
│   ├── pages/
│   │   └── index.astro       # App entry, script bootstrap
│   └── scripts/
│       ├── main.ts           # Init, event wiring, IPC listeners
│       ├── state.ts          # Reactive application state
│       ├── render.ts         # DOM rendering with smart patching
│       ├── convert.ts        # Conversion loop, progress tracking
│       ├── download.ts       # Download handlers, toast notifications
│       ├── file-ops.ts       # File array management, type detection
│       ├── preview.ts        # Image/video preview modal
│       ├── helpers.ts        # Utilities (format, duration, preview)
│       ├── constants.ts      # Format lists (video, audio, image, document, PDF)
│       ├── tools-data.ts     # 120+ tool cards for tools grid
│       └── types.ts          # TypeScript interfaces
├── package.json
├── astro.config.mjs
├── tsconfig.json
└── Dockerfile
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm

### Install

```sh
git clone https://github.com/hazavi/Konvrt.git
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

---

## Commands

| Command                | Action                                     |
| :--------------------- | :----------------------------------------- |
| `npm install`          | Install dependencies                       |
| `npm run dev`          | Start Astro + Electron concurrently        |
| `npm run dev:astro`    | Start Astro dev server on port 4321        |
| `npm run dev:electron` | Launch Electron (connect to running Astro) |
| `npm run build`        | Build frontend and package desktop app     |
| `npm run preview`      | Preview the Astro build locally            |

---

## Conversion Matrix

### Media Conversions

| From / To | Video | Audio | Image | GIF | PDF |
| :-------- | :---: | :---: | :---: | :-: | :-: |
| **Video** |  Yes  |  Yes  |  --   | Yes | --  |
| **Audio** |  --   |  Yes  |  --   | --  | --  |
| **Image** |  Yes  |  --   |  Yes  | Yes | Yes |
| **GIF**   |  Yes  |  --   |  Yes  | --  | --  |
| **PDF**   |  --   |  --   |  Yes  | --  | --  |

### Document Conversions

| From / To      | HTML | TXT | MD  | CSV | JSON | PDF |
| :------------- | :--: | :-: | :-: | :-: | :--: | :-: |
| **Markdown**   | Yes  | --  | --  | --  |  --  | Yes |
| **HTML**       |  --  | Yes | Yes | --  |  --  | Yes |
| **CSV / TSV**  | Yes  | --  | Yes | --  | Yes  | Yes |
| **JSON**       | Yes  | --  | --  | Yes |  --  | --  |
| **XML**        | Yes  | --  | --  | --  |  --  | --  |
| **YAML**       | Yes  | --  | --  | --  |  --  | --  |
| **Plain Text** | Yes  | --  | --  | --  |  --  | Yes |
| **RTF**        | Yes  | Yes | --  | --  |  --  | --  |
| **Log**        | Yes  | --  | --  | --  |  --  | --  |

---

## Roadmap

Planned features and improvements for future releases:

- [ ] **Download Manager** -- Queue, pause/resume, show in folder and manage multiple downloads at once
- [ ] **Linux and macOS Builds** -- Tested and signed native packages (.AppImage, .deb, .dmg)
- [ ] **More Tools** -- Trim video, extract audio, crop/resize images, merge PDFs, watermark
- [ ] **Drag and Drop Reorder** -- Reorder files in the conversion queue
- [ ] **Auto-Update** -- In-app update notifications and one-click install

---

## License

MIT
