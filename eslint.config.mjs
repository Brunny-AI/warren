// Flat config for ESLint 9. Minimal — Astro plugin + TypeScript parser.
// File patterns: ESLint 9 picks up .ts/.tsx/.astro via plugin processors.
import eslintPluginAstro from 'eslint-plugin-astro';
import tsParser from '@typescript-eslint/parser';

export default [
  ...eslintPluginAstro.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**', '.wrangler/**'],
  },
];
