import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compile } from 'tailwindcss';
import { describe, it } from 'vitest';

import {
  assertCompiledTailwindTheme,
  compileTailwindFixture,
} from './tailwindFixture.mjs';

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const themeCss = fs.readFileSync(
  path.join(packageDirectory, 'dist', 'theme.css'),
  'utf8',
);

describe('Tailwind 4.2.1 generated theme', () => {
  it('compiles every documented namespace from real utility candidates', async () => {
    const css = await compileTailwindFixture(compile, themeCss);
    assertCompiledTailwindTheme(css, '4.2.1');
  });
});
