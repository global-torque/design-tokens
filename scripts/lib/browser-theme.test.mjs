import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
  path.resolve(import.meta.dirname, '..', '..', 'dist', 'index.css'),
  'utf8',
);

/* A tenant brand.css: the seeds alone, on :root, after the package. */
const tahoeSeeds = `:root {
  --brand-primary: #008055;
  --brand-secondary: #2563eb;
  --brand-tertiary: #008055;
  --brand-surface-light: #f9f6f1;
  --brand-surface-dark: #18181b;
  --brand-primary-foreground: #ffffff;
  --brand-secondary-foreground: #ffffff;
  --brand-tertiary-foreground: #ffffff;
}`;

describe('shadcn variables in the browser', () => {
  it('paint the brand seeds a host sets on :root', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(
        `<style>${css}</style>${['primary', 'background', 'border']
          .map(
            (name) =>
              `<div id="${name}" style="background-color: var(--${name})"></div>`,
          )
          .join('')}`,
      );
      /* The painted color as rgb() bytes: getPropertyValue() returns a
         variable's formula, and a neutral step paints as color(srgb ...). */
      const painted = (id) =>
        page.evaluate((element) => {
          const painter = document.createElement('canvas').getContext('2d');
          painter.fillStyle = getComputedStyle(
            document.getElementById(element),
          ).backgroundColor;
          painter.fillRect(0, 0, 1, 1);
          return `rgb(${[...painter.getImageData(0, 0, 1, 1).data.subarray(0, 3)].join(', ')})`;
        }, id);

      /* The default grey the Tahoe border must move away from. */
      await expect(painted('border')).resolves.toBe('rgb(233, 236, 239)');
      await page.addStyleTag({ content: tahoeSeeds });
      await expect(painted('primary')).resolves.toBe('rgb(0, 128, 85)');
      await expect(painted('background')).resolves.toBe('rgb(249, 246, 241)');
      await expect(painted('border')).resolves.not.toBe('rgb(233, 236, 239)');
    } finally {
      await browser.close();
    }
  }, 60_000);
});
