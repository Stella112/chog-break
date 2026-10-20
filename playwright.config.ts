import { defineConfig } from '@playwright/test';

// BASE_URL=https://chog-break.vercel.app npx playwright test …  runs against a deployed site (no local server).
const live = process.env.BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  // Arena tests are timing-sensitive; run specs one at a time.
  workers: 1,
  use: {
    baseURL: live ?? 'http://localhost:4173',
    // Use the real GPU where available so arena timing reflects a laptop, not software WebGL.
    launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] },
  },
  webServer: live ? undefined : { command: 'npm run build && npm run preview', port: 4173, reuseExistingServer: true, timeout: 240_000 },
});
