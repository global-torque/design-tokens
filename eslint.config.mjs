import js from '@eslint/js';

export default [
  {
    ignores: ['coverage/**'],
  },
  {
    files: ['src/**/*.mjs', 'vitest.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off',
    },
  },
];
