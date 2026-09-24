import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
  path.resolve(import.meta.dirname, '..', '..', 'dist', 'index.css'),
  'utf8',
);
const tokens = JSON.parse(
  fs.readFileSync(
    path.resolve(import.meta.dirname, '..', '..', 'dist', 'tokens.json'),
    'utf8',
  ),
);
const expected = (mode) =>
  tokens.modes[mode].semantic.color['background-surface'];

describe('explicit browser theme activation', () => {
  it('activates both root selectors and never infers system dark mode', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ colorScheme: 'dark' });
      const page = await context.newPage();
      await page.setContent(
        `<style>${css}</style><main style="background: var(--gt-color-background-surface)">theme</main>`,
      );
      /* The painted surface as hex: the dark surface is a relative color, so
         the custom property holds its formula rather than a color value. */
      const surface = () =>
        page.evaluate(() => {
          const painter = document.createElement('canvas').getContext('2d');
          painter.fillStyle = getComputedStyle(
            document.querySelector('main'),
          ).backgroundColor;
          painter.fillRect(0, 0, 1, 1);
          return `#${[...painter.getImageData(0, 0, 1, 1).data.subarray(0, 3)]
            .map((channel) => channel.toString(16).padStart(2, '0'))
            .join('')}`;
        });

      await expect(surface()).resolves.toBe(expected('light'));
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await expect(surface()).resolves.toBe(expected('dark'));
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.dataset.theme = 'dark';
      });
      await expect(surface()).resolves.toBe(expected('dark'));
    } finally {
      await browser.close();
    }
  }, 60_000);
});
