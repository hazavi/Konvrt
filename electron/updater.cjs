function createUpdater({ app, getWindow, isBusy, engine }) {
  let state = { status: 'idle', currentVersion: app.getVersion() };
  const supported = app.isPackaged && process.platform === 'win32';
  const autoUpdater = engine || (supported ? require('electron-updater').autoUpdater : null);
  let checking = false;
  let downloading = false;
  const update = patch => {
    state = { ...state, error: undefined, ...patch };
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('update-state', state);
    return state;
  };
  if (!autoUpdater) {
    state.status = 'disabled';
    return { getState: () => state, check: async () => state, download: async () => state,
      install: () => ({ success: false, error: 'Updates require the installed Windows app.' }), dispose() {} };
  }
  autoUpdater.autoDownload = false;
  // Only install after an explicit restart. Never run the uninstaller separately.
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.on('checking-for-update', () => update({ status: 'checking' }));
  autoUpdater.on('update-available', info => update({ status: 'available', version: info.version, percent: 0 }));
  autoUpdater.on('update-not-available', () => update({ status: 'current', version: undefined }));
  autoUpdater.on('download-progress', info => update({ status: 'downloading', percent: Math.round(info.percent) }));
  autoUpdater.on('update-downloaded', info => update({ status: 'ready', version: info.version, percent: 100 }));
  const fail = err => {
    console.error('[Konvrt] Update failed:', err.message);
    return update({ status: 'error', error: 'Update failed. Check your connection and try again.' });
  };
  autoUpdater.on('error', fail);

  async function check() {
    if (checking || downloading || ['ready', 'installing'].includes(state.status)) return state;
    checking = true;
    try { await autoUpdater.checkForUpdates(); }
    catch (err) { fail(err); }
    finally { checking = false; }
    return state;
  }
  async function download() {
    if (checking || downloading || state.status !== 'available') return state;
    downloading = true;
    update({ status: 'downloading', percent: 0 });
    try { await autoUpdater.downloadUpdate(); }
    catch (err) { fail(err); }
    finally { downloading = false; }
    return state;
  }
  function install() {
    if (state.status !== 'ready') return { success: false, error: 'Download the update first.' };
    if (isBusy()) return { success: false, error: 'Wait for the current conversion or download to finish.' };
    update({ status: 'installing' });
    setImmediate(() => { try { autoUpdater.quitAndInstall(false, true); } catch (err) { fail(err); } });
    return { success: true };
  }
  const initial = setTimeout(check, 15000);
  const interval = setInterval(check, 6 * 60 * 60 * 1000);
  initial.unref(); interval.unref();
  return { getState: () => state, check, download, install,
    dispose() { clearTimeout(initial); clearInterval(interval); } };
}
module.exports = { createUpdater };
