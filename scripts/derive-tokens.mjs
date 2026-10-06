import fs from 'node:fs';
import path from 'node:path';
import { applyBrandRamps } from './lib/deriveTokens.mjs';

const sourcePath = path.join(
  import.meta.dirname,
  '..',
  'src',
  'tokens.tokens.json',
);
fs.writeFileSync(
  sourcePath,
  applyBrandRamps(fs.readFileSync(sourcePath, 'utf8')),
);
console.info('Brand ramps written to src/tokens.tokens.json.');
