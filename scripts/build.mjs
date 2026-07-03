import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

fs.mkdirSync(dist, { recursive: true });

for (const file of ['index.css', 'theme.css', 'tokens.json']) {
  fs.copyFileSync(path.join(src, file), path.join(dist, file));
}
