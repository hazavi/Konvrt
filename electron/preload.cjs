const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('konvrt', {
  getDroppedPaths: (files) => ipcRenderer.invoke('register-dropped-files', files.map(file => webUtils.getPathForFile(file)).filter(Boolean)),
  updateStatus: () => ipcRenderer.invoke('update-status'),
  updateCheck: () => ipcRenderer.invoke('update-check'),
  updateDownload: () => ipcRenderer.invoke('update-download'),
  updateInstall: () => ipcRenderer.invoke('update-install'),
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('update-state', listener);
    return () => ipcRenderer.removeListener('update-state', listener);
  },
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window-toggle-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  onWindowMaximized: (callback) => {
    ipcRenderer.on('window-maximized', (_event, maximized) => callback(maximized));
  },
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  convert: (job) => ipcRenderer.invoke('convert', job),
  getFileSizes: (filePaths) => ipcRenderer.invoke('get-file-sizes', filePaths),
  onProgress: (callback) => {
    ipcRenderer.on('conversion-progress', (_event, data) => callback(data));
  },
  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('conversion-progress');
  },
  // Download API
  ytdlpCheck: () => ipcRenderer.invoke('ytdlp-check'),
  ytdlpInstall: () => ipcRenderer.invoke('ytdlp-install'),
  ytdlpInfo: (url) => ipcRenderer.invoke('ytdlp-info', url),
  ytdlpDownload: (job) => ipcRenderer.invoke('ytdlp-download', job),
  getProxy: () => ipcRenderer.invoke('get-proxy'),
  setProxy: (proxy) => ipcRenderer.invoke('set-proxy', proxy),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_event, data) => callback(data));
  },
  onYtdlpInstallProgress: (callback) => {
    ipcRenderer.on('ytdlp-install-progress', (_event, data) => callback(data));
  },
});
