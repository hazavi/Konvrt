const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdater } = require('../electron/updater.cjs');

test('update flow prevents duplicate downloads and waits for work before installer handoff', async () => {
  const engine = new EventEmitter();
  let checks = 0, downloads = 0, installs = 0, busy = true, finish;
  engine.checkForUpdates = async () => { checks++; engine.emit('update-available', { version: '1.2.0' }); };
  engine.downloadUpdate = async () => { downloads++; await new Promise(resolve => finish = resolve); engine.emit('update-downloaded', { version: '1.2.0' }); };
  engine.quitAndInstall = (silent, restart) => { assert.equal(silent, false); assert.equal(restart, true); installs++; };
  const updater = createUpdater({ app: { isPackaged: true, getVersion: () => '1.1.0' }, getWindow: () => null, isBusy: () => busy, engine });
  try {
    assert.equal(updater.install().success, false);
    await updater.check();
    assert.equal(checks, 1);
    const first = updater.download();
    await updater.download();
    assert.equal(downloads, 1);
    finish(); await first;
    assert.equal(updater.getState().status, 'ready');
    assert.equal(updater.install().success, false);
    busy = false;
    assert.equal(updater.install().success, true);
    assert.equal(updater.install().success, false);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(installs, 1);
    assert.equal(engine.autoInstallOnAppQuit, false);
    assert.equal(engine.allowDowngrade, false);
  } finally { updater.dispose(); }
});

test('failed downloads leave an error and can be checked again', async () => {
  const engine = new EventEmitter();
  engine.checkForUpdates = async () => engine.emit('update-available', { version: '1.2.0' });
  engine.downloadUpdate = async () => { throw new Error('checksum mismatch'); };
  const updater = createUpdater({ app: { isPackaged: true, getVersion: () => '1.1.0' }, getWindow: () => null, isBusy: () => false, engine });
  try {
    await updater.check(); await updater.download();
    assert.equal(updater.getState().status, 'error');
    assert.equal(updater.install().success, false);
    await updater.check();
    assert.equal(updater.getState().status, 'available');
  } finally { updater.dispose(); }
});
