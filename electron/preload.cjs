const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('konvrt', {
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
