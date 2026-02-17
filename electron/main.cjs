const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { processFile } = require('./converter.cjs');
const { isDownloadReady, installDownloadTools, getVideoInfo, downloadMedia, getProxySetting, setProxySetting } = require('./downloader/index.cjs');

let mainWindow;
let prodServer;
const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:4321';

// ── Static file server for production builds ───────────────────
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function startStaticServer(distPath) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let filePath = path.join(distPath, urlPath === '/' ? 'index.html' : urlPath);

      // Security: prevent path traversal
      if (!filePath.startsWith(distPath)) {
        res.writeHead(403); res.end(); return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // Fallback to index.html for SPA-like routes
          if (err.code === 'ENOENT') {
            res.writeHead(404); res.end();
          } else {
            res.writeHead(500); res.end();
          }
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`[Konvrt] Static server running on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

function waitForServer(url, maxRetries = 50, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      http.get(url, (res) => {
        resolve();
      }).on('error', () => {
        if (attempts >= maxRetries) {
          reject(new Error(`Dev server not available after ${maxRetries} attempts`));
        } else {
          setTimeout(check, interval);
        }
      });
    };
    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: 'Konvrt',
    icon: path.join(__dirname, '..', 'public', 'konvrt_ico.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow loading local file:// previews
    },
    autoHideMenuBar: true,
    backgroundColor: '#06060b',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0e0e16',
      symbolColor: '#a2a2c0',
      height: 36,
    },
  });

  if (isDev) {
    console.log('[Konvrt] Waiting for Astro dev server...');
    waitForServer(DEV_URL)
      .then(() => {
        console.log('[Konvrt] Dev server ready, loading app.');
        mainWindow.loadURL(DEV_URL);
      })
      .catch((err) => {
        console.error('[Konvrt]', err.message);
        console.error('[Konvrt] Make sure to run: npm run dev:astro');
        app.quit();
      });
  } else {
    const distPath = path.join(__dirname, '..', 'dist');
    startStaticServer(distPath).then((server) => {
      prodServer = server;
      const port = server.address().port;
      console.log('[Konvrt] Loading production build...');
      mainWindow.loadURL(`http://127.0.0.1:${port}`);
    });
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (prodServer) prodServer.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media Files', extensions: [
        'mp4','mkv','avi','mov','webm','flv','wmv','ts','m2ts','mts','3gp','ogv','vob','mpg','mpeg','m4v','divx','asf','rm','rmvb','f4v',
        'mp3','wav','ogg','flac','aac','wma','m4a','opus','alac','aiff','ape','ac3','dts','amr','au','ra','wv',
        'jpg','jpeg','png','gif','bmp','tiff','tif','webp','svg','avif','heic','heif','ico','jxl','jp2','psd','raw','cr2','nef','dng',
        'pdf'
      ]},
    ],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('select-output-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('convert', async (event, job) => {
  // job: { filePath, outputDir, format, quality, mode }
  try {
    const result = await processFile(job, (progress) => {
      mainWindow.webContents.send('conversion-progress', {
        filePath: job.filePath,
        progress,
      });
    });
    return { success: true, outputPath: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Download IPC Handlers ──────────────────────────────────────

ipcMain.handle('ytdlp-check', async () => {
  return isDownloadReady();
});

ipcMain.handle('ytdlp-install', async () => {
  try {
    await installDownloadTools((progress) => {
      mainWindow.webContents.send('ytdlp-install-progress', progress);
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('ytdlp-info', async (event, url) => {
  return getVideoInfo(url);
});

ipcMain.handle('ytdlp-download', async (event, job) => {
  // job: { url, outputDir, format, quality }
  try {
    const result = await downloadMedia(job, (progress) => {
      mainWindow.webContents.send('download-progress', {
        url: job.url,
        ...progress,
      });
    });
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-proxy', async () => {
  return getProxySetting();
});

ipcMain.handle('set-proxy', async (event, proxy) => {
  setProxySetting(proxy);
  return { success: true };
});

ipcMain.handle('get-file-sizes', async (event, filePaths) => {
  const sizes = {};
  for (const fp of filePaths) {
    try {
      const stat = fs.statSync(fp);
      sizes[fp] = stat.size;
    } catch {
      sizes[fp] = 0;
    }
  }
  return sizes;
});
