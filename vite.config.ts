import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Phaser alone is ~1.5 MB; it is lazy-loaded only for the arena.
  build: { chunkSizeWarningLimit: 1600 },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/review/**/*.test.ts'],
    environment: 'node',
  },
});
