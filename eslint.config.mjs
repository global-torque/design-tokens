import js from '@eslint/js';

export default [
  {
    ignores: ['dist/**'],
  },
  {
    files: ['scripts/**/*.mjs', 'src/**/*.mjs', 'vitest.config.mjs'],
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
