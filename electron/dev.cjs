const { execSync, spawn } = require('child_process');
const waitOn = require('wait-on');

// Start Astro dev server
const astro = spawn('npx', ['astro', 'dev', '--port', '3000'], {
  stdio: 'inherit',
  shell: true,
});

console.log('[Konvrt] Waiting for Astro dev server on http://localhost:3000 ...');

waitOn({ resources: ['http-get://localhost:3000'], timeout: 30000 })
  .then(() => {
    console.log('[Konvrt] Astro ready — launching Electron...');
    const electron = spawn('npx', ['electron', '.'], {
      stdio: 'inherit',
      shell: true,
    });

    electron.on('close', () => {
      astro.kill();
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error('[Konvrt] Timed out waiting for Astro:', err.message);
    astro.kill();
    process.exit(1);
  });

process.on('SIGINT', () => {
  astro.kill();
  process.exit(0);
});
