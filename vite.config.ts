import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Phaser alone is ~1.5 MB; it is lazy-loaded only for the arena.
  build: {
    chunkSizeWarningLimit: 1600,
    // two pages: the light landing page (/) and the game (/play/)
    rollupOptions: { input: { main: 'index.html', play: 'play/index.html' } },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/review/**/*.test.ts'],
    environment: 'node',
  },
});
