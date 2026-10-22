import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', '.cache', 'contracts', 'public', 'node_modules', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  // The sponsor service runs in Node on the VPS.
  { files: ['sponsor/**/*.mjs'], languageOptions: { globals: { ...globals.node } } },
  // Demo-video tooling: Node scripts that drive pages, and the graphics page itself.
  { files: ['video/**/*.{mjs,js}'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  // e2e tests reach into the ?test=1 runtime hooks on window.
  { files: ['tests/e2e/**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
  // §B: src/core must stay pure.
  {
    files: ['src/core/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-dom', 'react/*', 'phaser', 'phaser/*', '../ui/*', '../arena/*', '../chain/*'] },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use core/rng.ts' },
        { object: 'Date', property: 'now', message: 'Core must not depend on time' },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'fetch', 'localStorage', 'navigator'],
    },
  },
);
