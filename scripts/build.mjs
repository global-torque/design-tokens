import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateArtifacts } from './lib/generate.mjs';

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const sourcePath = path.join(packageDirectory, 'src', 'tokens.tokens.json');
const distPath = path.join(packageDirectory, 'dist');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const source = JSON.parse(sourceText);
const artifacts = generateArtifacts(source, sourceText);
const temporaryDirectory = fs.mkdtempSync(
  path.join(packageDirectory, `.dist-${process.pid}-${os.platform()}-`),
);
const previousDirectory = `${distPath}.previous-${process.pid}`;

try {
  for (const [fileName, contents] of artifacts) {
    fs.writeFileSync(path.join(temporaryDirectory, fileName), contents, {
      encoding: 'utf8',
      mode: 0o644,
    });
  }

  if (fs.existsSync(distPath)) fs.renameSync(distPath, previousDirectory);
  try {
    fs.renameSync(temporaryDirectory, distPath);
  } catch (error) {
    if (fs.existsSync(previousDirectory))
      fs.renameSync(previousDirectory, distPath);
    throw error;
  }
  fs.rmSync(previousDirectory, { force: true, recursive: true });
} finally {
  fs.rmSync(temporaryDirectory, { force: true, recursive: true });
}
