import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: [
        'scripts/build.mjs',
        'scripts/lib/generate.mjs',
        'scripts/lib/tailwindFixture.mjs',
        'scripts/lib/deriveTokens.mjs',
        'src/derive.mjs',
      ],
      thresholds: {
        statements: 90,
        lines: 90,
        branches: 85,
      },
    },
  },
});
