// @ts-check
import { defineConfig } from 'astro/config';

const githubPages = process.env.GITHUB_PAGES === 'true';

// https://astro.build/config
export default defineConfig({
  ...(githubPages ? { site: 'https://hazavi.github.io', base: '/Konvrt' } : {}),
  output: 'static',
  build: {
    assets: 'assets',
  },
  devToolbar: {
    enabled: false,
  },
});
