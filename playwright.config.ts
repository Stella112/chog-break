import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Arena tests are timing-sensitive; run specs one at a time.
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173',
    // Use the real GPU where available so arena timing reflects a laptop, not software WebGL.
    launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] },
  },
  webServer: { command: 'npm run build && npm run preview', port: 4173, reuseExistingServer: true, timeout: 240_000 },
});
