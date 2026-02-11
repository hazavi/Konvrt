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
});
