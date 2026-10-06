# Konvrt v1.0.3

### Added

- **Image resolution options.** Set width and height, then choose Max, Crop, or Scale. ICO output can use a selected frame size up to 256 × 256 pixels.
- **Browser image conversion.** The [browser version](https://hazavi.github.io/Konvrt/) now supports file picking, drag and drop, and local PNG, JPG, WebP, and ICO conversion.
- **GitHub link.** A GitHub icon beside the version badge opens the Konvrt repository.

### Fixed

- The Image options dialog opens correctly and is centered in the window.
- The conversion footer stays on one row at the app's minimum window width, with Convert at the far right.
- The app window, installer, browser tab, and header use the same `favicon.ico` icon.

### Changed

- The header logo is larger, and the app version is now **1.0.3**.
- Video, audio, PDF, document conversion, and media downloads remain available in the desktop app; browser conversion covers PNG, JPG, WebP, and ICO images.

### Developer

- GitHub Pages deploys the Astro browser frontend from `main`.
- The package and lockfile versions are synchronized for the Windows installer build.

**Full changelog:** see [CHANGELOG.md](CHANGELOG.md).
