const { spawn, execSync } = require('child_process');
const waitOn = require('wait-on');

const PORT = 4321; // must match DEV_URL in main.cjs

const astro = spawn('npx', ['astro', 'dev', '--port', String(PORT)], {
  stdio: 'inherit',
  shell: true,
});

function stopAstro() {
  try {
    // shell:true on Windows wraps the server in cmd.exe, so kill the whole tree.
    if (process.platform === 'win32') execSync(`taskkill /pid ${astro.pid} /T /F`, { stdio: 'ignore' });
    else astro.kill();
  } catch {}
}

console.log(`[Konvrt] Waiting for Astro dev server on http://localhost:${PORT} ...`);

waitOn({ resources: [`http-get://localhost:${PORT}`], timeout: 30000 })
  .then(() => {
    console.log('[Konvrt] Astro ready — launching Electron...');
    const electron = spawn('npx', ['electron', '.'], { stdio: 'inherit', shell: true });

    electron.on('close', () => {
      stopAstro();
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error('[Konvrt] Timed out waiting for Astro:', err.message);
    stopAstro();
    process.exit(1);
  });

process.on('SIGINT', () => {
  stopAstro();
  process.exit(0);
});
