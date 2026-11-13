# Konvrt v1.1.0

- Window size, position, and maximized state are saved and restored, including recovery when a monitor is disconnected.
- The yellow header and cream background are slightly darker.
- Windows now checks GitHub releases automatically and offers download progress plus **Restart & update**. The NSIS installer replaces the existing installation and preserves settings. Installation waits for active conversions and downloads to finish.
- Chromium web security and sandboxing are enabled. Popups, navigation, permissions, and privileged IPC are restricted. Local previews use a scoped media protocol, and drag and drop uses Electron's supported file-path API.
- Downloads verify TLS certificates. File transfers use streaming with backpressure, bounded redirects, partial-file cleanup, and bounded diagnostic output.
- Electron, Astro, Sharp, MuPDF, PDFKit, and build dependencies are updated. The BMP writer no longer needs Jimp. Heavy conversion modules load when needed, file-size reads are asynchronous, duplicate progress messages are skipped, and FFmpeg ships once outside the app archive.
- Release builds include the installer, blockmap, and latest.yml needed by the updater. Windows CI runs regression tests and builds the frontend.

## Installing

Download **Konvrt-Setup-1.1.0.exe** and run it. Existing 1.0.x users need this one-time manual install to gain automatic update detection. Future releases can be downloaded and installed from inside the app. Do not uninstall the old version first.

Window preferences and download-tool settings are kept during updates and uninstall/reinstall. Windows installers are currently unsigned. Update downloads use HTTPS and SHA-512 verification against the GitHub release metadata.
