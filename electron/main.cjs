const { app, BrowserWindow, ipcMain, dialog, shell, screen, protocol, net } = require('electron');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { startStaticServer } = require('./static-server.cjs');
const { loadWindowState, trackWindowState } = require('./window-state.cjs');
const { localPath, validateJob, mediaUrl } = require('./security.cjs');
const { createUpdater } = require('./updater.cjs');

let mainWindow, prodServer, trustedOrigin, updater;
let activeJobs = 0;
const approvedFiles = new Set();
const approvedDirs = new Set();
const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:4321';
const downloader = () => require('./downloader/index.cjs');
protocol.registerSchemesAsPrivileged([{ scheme: 'konvrt-media', privileges: {
  standard: true, secure: true, supportFetchAPI: true, stream: true,
} }]);

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
}

function waitForServer(url, attempts = 50) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, res => { res.resume(); resolve(); });
      req.setTimeout(2000, () => req.destroy(new Error('Dev server timeout')));
      req.on('error', err => {
        if (--attempts <= 0) reject(err);
        else setTimeout(check, 500);
      });
    };
    check();
  });
}

async function createWindow() {
  const stateFile = path.join(app.getPath('userData'), 'window-state.json');
  const state = loadWindowState(stateFile, screen.getAllDisplays());
  mainWindow = new BrowserWindow({
    ...state, show: false, minWidth: 900, minHeight: 600,
    title: 'Konvrt', frame: false, autoHideMenuBar: true, backgroundColor: '#ffefbd',
    icon: path.join(__dirname, '..', isDev ? 'public' : 'dist', 'favicon.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, webSecurity: true, sandbox: true, webviewTag: false },
  });
  // Constructor bounds can gain invisible frame pixels at fractional DPI on
  // Windows. Restore the saved client size explicitly before tracking changes.
  mainWindow.setContentSize(state.width, state.height);
  trackWindowState(mainWindow, stateFile);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'https://github.com/hazavi/Konvrt') shell.openExternal(url).catch(console.error);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== trustedOrigin) event.preventDefault();
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.once('ready-to-show', () => {
    if (state.maximized) mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.on('maximize', () => send('window-maximized', true));
  mainWindow.on('unmaximize', () => send('window-maximized', false));
  mainWindow.webContents.on('did-finish-load', () => send('window-maximized', mainWindow.isMaximized()));
  try {
    if (isDev) {
      trustedOrigin = new URL(DEV_URL).origin;
      await waitForServer(DEV_URL);
    } else {
      if (!prodServer) prodServer = await startStaticServer(path.join(__dirname, '..', 'dist'));
      trustedOrigin = `http://127.0.0.1:${prodServer.address().port}`;
    }
    await mainWindow.loadURL(isDev ? DEV_URL : trustedOrigin);
  } catch (err) { console.error('[Konvrt]', err); app.quit(); }
}

if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(() => {
  approvedDirs.add(path.resolve(app.getPath('downloads')));
  protocol.handle('konvrt-media', request => {
    try {
      const file = localPath(decodeURIComponent(new URL(request.url).pathname.slice(1)));
      if (!approvedFiles.has(file) || !/\.(png|jpe?g|webp|gif|bmp|svg|avif|ico|mp4|webm|mov|m4v|ogg)$/i.test(file)) return new Response('', { status: 403 });
      return net.fetch(pathToFileURL(file).href, { headers: request.headers });
    } catch { return new Response('', { status: 400 }); }
  });
  createWindow();
  updater = createUpdater({ app, getWindow: () => mainWindow, isBusy: () => activeJobs > 0 });
});
app.on('second-instance', () => {
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.focus();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { updater?.dispose(); prodServer?.close(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

function handle(channel, callback) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame ||
      new URL(event.senderFrame.url).origin !== trustedOrigin) throw new Error('Untrusted IPC sender.');
    return callback(event, ...args);
  });
}

function outputDirectory(value) {
  const dir = localPath(value);
  if (!approvedDirs.has(dir)) throw new Error('Choose an output folder first.');
  return dir;
}

async function runJob(work) {
  if (activeJobs) return { success: false, error: 'Another operation is already running.' };
  activeJobs++;
  try { return await work(); }
  catch (err) { return { success: false, error: err.message }; }
  finally { activeJobs--; }
}

handle('window-minimize', () => mainWindow.minimize());
handle('window-toggle-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
handle('window-close', () => mainWindow.close());
handle('update-status', () => updater.getState());
handle('update-check', () => updater.check());
handle('update-download', () => updater.download());
handle('update-install', () => updater.install());
handle('register-dropped-files', (_event, paths) => {
  if (!Array.isArray(paths) || paths.length > 1000) throw new Error('Too many files.');
  return paths.map(localPath).filter(file => { approvedFiles.add(file); return true; });
});
handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'] });
  const paths = result.canceled ? [] : result.filePaths;
  paths.forEach(file => approvedFiles.add(path.resolve(file)));
  return paths;
});
handle('select-output-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  const dir = result.canceled ? null : result.filePaths[0];
  if (dir) approvedDirs.add(path.resolve(dir));
  return dir;
});
handle('convert', (_event, job) => runJob(async () => {
  validateJob(job);
  if (!approvedFiles.has(localPath(job.filePath))) throw new Error('Select the input file first.');
  outputDirectory(job.outputDir);
  const { processFile } = require('./converter.cjs');
  let lastProgress = -1;
  const result = await processFile(job, progress => {
    const rounded = Math.round(progress);
    if (rounded === lastProgress) return;
    lastProgress = rounded;
    send('conversion-progress', { filePath: job.filePath, progress: rounded });
  });
  return { success: true, outputPath: result };
}));
handle('ytdlp-check', () => downloader().isDownloadReady());
handle('ytdlp-install', () => runJob(async () => {
  await downloader().installDownloadTools(progress => send('ytdlp-install-progress', progress));
  return { success: true };
}));
handle('ytdlp-info', async (_event, url) => {
  try { return await downloader().getVideoInfo(mediaUrl(url)); }
  catch (err) { return { success: false, error: err.message }; }
});
handle('ytdlp-download', (_event, job) => runJob(async () => {
  mediaUrl(job.url);
  outputDirectory(job.outputDir);
  if (!['mp4','webm','mp3','m4a','wav','flac','ogg','opus','aac'].includes(job.format) ||
    !['best','1080','720','480'].includes(job.quality)) throw new Error('Invalid download options.');
  return downloader().downloadMedia(job, progress => send('download-progress', { url: job.url, ...progress }));
}));
handle('get-proxy', () => downloader().getProxySetting());
handle('set-proxy', (_event, proxy) => {
  if (typeof proxy !== 'string' || proxy.length > 2048) throw new Error('Invalid proxy.');
  if (proxy.trim() && !['http:', 'https:', 'socks4:', 'socks5:', 'socks5h:'].includes(new URL(proxy.trim()).protocol)) throw new Error('Invalid proxy protocol.');
  downloader().setProxySetting(proxy);
  return { success: true };
});
handle('get-file-sizes', async (_event, paths) => {
  if (!Array.isArray(paths) || paths.length > 1000) throw new Error('Invalid file list.');
  return Object.fromEntries(await Promise.all(paths.map(async fp => {
    const file = localPath(fp);
    if (!approvedFiles.has(file)) throw new Error('Select the file first.');
    try { return [fp, (await fs.promises.stat(file)).size]; } catch { return [fp, 0]; }
  })));
});
