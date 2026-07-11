import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
  path.resolve(import.meta.dirname, '..', '..', 'dist', 'index.css'),
  'utf8',
);

describe('explicit browser theme activation', () => {
  it('activates both root selectors and never infers system dark mode', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ colorScheme: 'dark' });
      const page = await context.newPage();
      await page.setContent(`<style>${css}</style><main>theme</main>`);
      const surface = () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue('--gt-color-background-surface')
            .trim(),
        );

      await expect(surface()).resolves.toBe('#ffffff');
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await expect(surface()).resolves.toBe('#111827');
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.dataset.theme = 'dark';
      });
      await expect(surface()).resolves.toBe('#111827');
    } finally {
      await browser.close();
    }
  }, 15_000);
});
