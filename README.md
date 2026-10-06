<div align="center">

<img src="public/favicon.ico" alt="Konvrt" width="72" />

# Konvrt

Convert, compress, and download video, audio, images, and PDFs.
Everything runs on your computer.

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![License](https://img.shields.io/badge/license-MIT-green)

<img width="1100" height="750" alt="Skærmbillede 2026-10-05 143626" src="https://github.com/user-attachments/assets/8b569b8f-5393-43ef-b86c-8745d122c6c8" />


</div>

---

## Install

1. Open the [latest release](https://github.com/hazavi/Konvrt/releases/latest).
2. Download `Konvrt-Setup-<version>.exe`.
3. Run the installer.

## What it does

| Tab          | Use it to                                                                    |
| :----------- | :--------------------------------------------------------------------------- |
| **Convert**  | Change a file to another format. Works in batches with per-file progress.    |
| **Compress** | Make video, audio, images, and GIFs smaller with a quality slider.           |
| **Download** | Save YouTube and TikTok videos (and 1000+ other sites) as video or audio.    |
| **Tools**    | Jump straight to a specific conversion, like "MOV to MP4" or "Video to MP3". |

Extras: GIF creation from video, audio extraction from video, PDF to image and back, document to HTML, and a preview window for images and videos.

The interface uses a Neobrutalism design: thick black borders, hard offset shadows, flat bright colors, and a custom frameless title bar with its own minimize, maximize, and close buttons.

## Supported formats

| Type      | Formats                                                                    |
| :-------- | :------------------------------------------------------------------------- |
| Video     | MP4, MKV, AVI, MOV, WEBM, FLV, WMV, TS, 3GP, OGV, M4V, MPG and more       |
| Audio     | MP3, WAV, OGG, FLAC, AAC, M4A, WMA, OPUS, AIFF, AC3, ALAC and more         |
| Image     | JPG, PNG, WEBP, AVIF, GIF, BMP, TIFF, HEIC, ICO, JXL, SVG and more        |
| PDF       | PDF to PNG, JPG, WEBP, AVIF, TIFF, BMP, GIF, and images to PDF             |
| Documents | TXT, MD, HTML, CSV, JSON, XML, YAML, TSV, LOG, RTF, and PDF                |

## Downloads

- Pick MP4 or WEBM for video, or MP3, M4A, WAV, FLAC, OGG for audio.
- Choose Best, 1080p, 720p, or 480p.
- Optional HTTP or SOCKS proxy.
- The first time, Konvrt asks to install yt-dlp, the tool that does the downloading.

---

## Development

You need [Node.js](https://nodejs.org/) 18 or newer.

```sh
git clone https://github.com/hazavi/Konvrt.git
cd Konvrt
npm install
npm start
```

`npm start` runs the Astro dev server and opens Electron.

| Command                | What it does                                  |
| :--------------------- | :-------------------------------------------- |
| `npm start`            | Astro dev server and Electron together        |
| `npm run dev:astro`    | Frontend only, at `http://localhost:4321`     |
| `npm run dev:electron` | Electron only (needs the Astro server)        |
| `npm run build`        | Build the frontend and package the app        |

On Windows you can also double-click `start-electron.bat` or `start-browser.bat`.
The browser version can show the interface, but file picking, conversion, and downloads need Electron.

## Publishing a release

1. Update `version` in `package.json` and add an entry to `CHANGELOG.md`.
2. Create a release on GitHub.
3. The **Build & Release** workflow builds the Windows installer and attaches `Konvrt-Setup-<version>.exe` to the release.

To build locally, run `npm run build:astro` then `npx electron-builder --win`. The installer ends up in `release/`.

## Tech stack

| Layer       | Technology                              |
| :---------- | :-------------------------------------- |
| Interface   | Astro, Lucide icons (as used by 21st.dev), Neobrutalism CSS, Space Grotesk |
| Desktop     | Electron 33                             |
| Video/Audio | FFmpeg (fluent-ffmpeg)                  |
| Images      | Sharp, Jimp                             |
| PDF         | MuPDF, PDFKit                           |
| Downloads   | yt-dlp                                  |

## Project layout

```
electron/        Main process, preload bridge, converter, downloader/
src/
  components/    Astro components
  styles/        Design tokens (Neobrutalism theme), shared UI styles, one file per component
  scripts/       Frontend logic (state, render, convert, download)
start-*.bat      Windows dev launchers
```
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


## License

MIT
