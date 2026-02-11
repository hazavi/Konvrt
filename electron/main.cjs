const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { processFile } = require('./converter.cjs');

let mainWindow;
const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:4321';

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
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow loading local file:// previews
    },
    autoHideMenuBar: true,
    backgroundColor: '#08080d',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#111118',
      symbolColor: '#a0a0b8',
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
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
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
        'mp4','mkv','avi','mov','webm','flv','wmv',
        'mp3','wav','ogg','flac','aac','wma','m4a',
        'jpg','jpeg','png','gif','bmp','tiff','webp','svg','avif','heic',
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
