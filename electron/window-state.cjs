const fs = require('node:fs');

function restoreBounds(state, displays) {
  const fallback = { width: 1150, height: 800 };
  if (!state || !['x', 'y', 'width', 'height'].every(k => Number.isSafeInteger(state[k]))) return fallback;
  const display = displays.find(({ workArea: a }) =>
    state.x < a.x + a.width && state.x + state.width > a.x &&
    state.y < a.y + a.height && state.y + state.height > a.y)?.workArea;
  if (!display) return fallback;
  const width = Math.min(Math.max(900, state.width), display.width);
  const height = Math.min(Math.max(600, state.height), display.height);
  return { width, height,
    x: Math.max(display.x, Math.min(state.x, display.x + display.width - width)),
    y: Math.max(display.y, Math.min(state.y, display.y + display.height - height)) };
}

function loadWindowState(file, displays) {
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ...restoreBounds(state, displays), maximized: state.maximized === true };
  } catch { return restoreBounds(null, displays); }
}

function trackWindowState(window, file) {
  let timer;
  // Client bounds avoid accumulating invisible Windows frame padding. Keep
  // the restored content bounds before the window is maximized.
  let normalBounds = window.getContentBounds();
  const rememberBounds = () => {
    if (!window.isMaximized() && !window.isMinimized() && !window.isFullScreen()) normalBounds = window.getContentBounds();
  };
  const save = () => {
    clearTimeout(timer);
    if (window.isDestroyed() || window.isMinimized()) return;
    rememberBounds();
    try {
      fs.writeFileSync(file + '.tmp', JSON.stringify({ ...normalBounds, maximized: window.isMaximized() }));
      fs.renameSync(file + '.tmp', file);
    } catch (err) { console.warn('[Konvrt] Cannot save window state:', err.message); }
  };
  const schedule = () => { rememberBounds(); clearTimeout(timer); timer = setTimeout(save, 300); };
  for (const event of ['resize', 'move', 'maximize', 'unmaximize']) window.on(event, schedule);
  window.on('close', save);
  window.on('closed', () => clearTimeout(timer));
}

module.exports = { restoreBounds, loadWindowState, trackWindowState };
