import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  assertCompiledTailwindTheme,
  compileTailwindFixture,
} from './lib/tailwindFixture.mjs';

const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'design-tokens-tailwind-current-'),
);

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: temporaryDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout.trim();
};

try {
  const latestVersion = run('npm', ['view', 'tailwindcss', 'dist-tags.latest']);
  if (!latestVersion.startsWith('4.')) {
    throw new Error(
      `Tailwind latest moved outside the supported 4.x line: ${latestVersion}.`,
    );
  }
  fs.writeFileSync(
    path.join(temporaryDirectory, 'package.json'),
    `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
  );
  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
    `tailwindcss@${latestVersion}`,
  ]);

  const packageDirectory = path.resolve(import.meta.dirname, '..');
  const themeCss = fs.readFileSync(
    path.join(packageDirectory, 'dist', 'theme.css'),
    'utf8',
  );
  const tailwindUrl = pathToFileURL(
    path.join(
      temporaryDirectory,
      'node_modules',
      'tailwindcss',
      'dist',
      'lib.mjs',
    ),
  ).href;
  const { compile } = await import(tailwindUrl);
  const css = await compileTailwindFixture(compile, themeCss);
  assertCompiledTailwindTheme(css, latestVersion);
  console.info(`Tailwind ${latestVersion} compatibility passed.`);
} finally {
  fs.rmSync(temporaryDirectory, { force: true, recursive: true });
}
