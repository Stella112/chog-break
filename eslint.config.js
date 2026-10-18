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
