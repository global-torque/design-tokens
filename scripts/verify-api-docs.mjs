import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const packageDirectory = path.resolve(import.meta.dirname, '..');
const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'design-tokens-api-docs-'),
);

const run = (args) => {
  const result = spawnSync('pnpm', args, {
    cwd: packageDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(
      `pnpm ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
};

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });

const canonicalDocument = (contents) =>
  `${contents
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd()}\n`;

const snapshot = (directory) =>
  Object.fromEntries(
    walk(directory)
      .map((filePath) => [
        path.relative(directory, filePath).split(path.sep).join('/'),
        canonicalDocument(fs.readFileSync(filePath, 'utf8')),
      ])
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
  );

try {
  for (const [model, expected] of [
    ['root', 'api'],
    ['css', 'api-css'],
    ['theme', 'api-theme'],
  ]) {
    const output = path.join(temporaryDirectory, model);
    run([
      'exec',
      'api-documenter',
      'markdown',
      '--input',
      path.join('temp', model),
      '--output',
      output,
    ]);
    const committed = path.join(packageDirectory, 'docs', expected);
    if (!fs.existsSync(committed)) {
      throw new Error(`Missing generated API documentation ${committed}.`);
    }
    if (
      JSON.stringify(snapshot(output)) !== JSON.stringify(snapshot(committed))
    ) {
      throw new Error(
        `${path.relative(packageDirectory, committed)} is stale; run pnpm run docs:api.`,
      );
    }
  }
  console.info('Generated design-token API documentation is current.');
} finally {
  fs.rmSync(temporaryDirectory, { force: true, recursive: true });
}
