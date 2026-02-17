# Changelog

All notable changes to Konvrt are documented here.  

---

## [1.0.0] — 2026-02-17

### Added

#### Convert
- Video conversion: MP4, MKV, AVI, MOV, WEBM, FLV, WMV, TS
- Audio conversion: MP3, WAV, OGG, FLAC, AAC, M4A, OPUS, WMA
- Image conversion: JPG, PNG, WEBP, AVIF, GIF, BMP, TIFF, HEIF, SVG
- PDF ↔ image conversion (PNG, JPG, WEBP, AVIF, TIFF, BMP, GIF)
- Animated GIF creation from any video file
- Batch conversion with per-file progress tracking
- Thumbnail previews and full-screen preview modal

#### Compress
- Video compression with adjustable quality slider (H.264 / VP9)
- Audio compression with bitrate control (MP3 / AAC / OGG)
- Image compression with lossless/lossy modes via Sharp
- GIF compression with frame and color optimization
- Fast compression presets (`fast` / `medium` based on quality level)
- Button label dynamically switches between "Converting" and "Compressing"

#### Download
- YouTube downloads (video MP4 / audio MP3, M4A) via yt-dlp
- TikTok and 1000+ platform support via generic yt-dlp integration
- Format selection: MP4, WEBM, MP3, M4A
- Quality selection: 1080p, 720p, 480p, best available
- Proxy support: HTTP and SOCKS proxies
- Container-native codec selection (H.264+M4A for MP4, VP9+Opus for WEBM)
- Toast notifications on download complete or failed
- "New Download" button to reset and start fresh

#### UI / UX
- Dark-themed desktop UI with Astro + Electron
- Drag-and-drop file input with animated drop zone
- Native file picker (Browse Files)
- Tab navigation: Convert · Compress · Download · Tools
- Format and quality controls in a persistent bottom bar
- DOM-patching file list renderer (no thumbnail flicker on progress updates)
- Toast notification system with auto-dismiss and progress bar
- Per-view scrolling (no double scrollbar)

#### Infrastructure
- Electron 33 + Astro 5 architecture
- ffmpeg-static path fix for Electron `.asar` packaging
- yt-dlp binary auto-download on first run (`~/.konvrt/yt-dlp.exe`)
- GitHub Actions workflow for Windows build (`.exe` NSIS installer)
- Dockerfile for Astro static preview

---

## [Unreleased]

### Planned
- Download Manager — queue, pause/resume, show in folder
- Linux & macOS builds (`.AppImage`, `.deb`, `.dmg`)
- More Tools — trim video, extract audio, crop/resize images, merge PDFs, watermark
- Drag & Drop file reordering in conversion queue
- Auto-Update — in-app update notifications and one-click install
