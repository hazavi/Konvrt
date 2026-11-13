const { test } = require('node:test');
const assert = require('node:assert/strict');
const { restoreBounds, loadWindowState, trackWindowState } = require('../electron/window-state.cjs');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const displays = [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];

test('restores resized bounds and clamps partially hidden windows', () => {
  assert.deepEqual(restoreBounds({ x: 100, y: 120, width: 1000, height: 650 }, displays), { x: 100, y: 120, width: 1000, height: 650 });
  assert.deepEqual(restoreBounds({ x: 1800, y: 900, width: 1000, height: 650 }, displays), { x: 920, y: 430, width: 1000, height: 650 });
  assert.deepEqual(restoreBounds({ x: 4000, y: 0, width: 1000, height: 650 }, displays), { width: 1150, height: 800 });
  assert.deepEqual(restoreBounds({ x: 0, y: 0, width: 'bad', height: 650 }, displays), { width: 1150, height: 800 });
});

test('saves normal bounds while maximized and tolerates corrupt state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'konvrt-window-'));
  const file = path.join(dir, 'state.json');
  try {
    const window = new EventEmitter();
    window.isDestroyed = window.isMinimized = () => false;
    window.isFullScreen = () => false;
    window.isMaximized = () => true;
    window.getNormalBounds = () => ({ x: 30, y: 40, width: 1100, height: 700 });
    window.getContentBounds = () => ({ x: 30, y: 40, width: 1100, height: 700 });
    trackWindowState(window, file);
    window.emit('resize');
    window.emit('close');
    window.emit('closed');
    assert.deepEqual(loadWindowState(file, displays), { x: 30, y: 40, width: 1100, height: 700, maximized: true });
    fs.writeFileSync(file, '{broken');
    assert.deepEqual(loadWindowState(file, displays), { width: 1150, height: 800 });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
