import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { designTokens } from './tokens';
import tokensJson from './tokens.json' with { type: 'json' };

const srcDir = path.dirname(fileURLToPath(import.meta.url));

function readSourceFile(fileName: string) {
  return fs.readFileSync(path.join(srcDir, fileName), 'utf8');
}

const cssVariableNames: Record<string, Record<string, string>> = {
  color: {
    surface: '--gt-color-surface',
    surfaceMuted: '--gt-color-surface-muted',
    surfaceInverse: '--gt-color-surface-inverse',
    border: '--gt-color-border',
    text: '--gt-color-text',
    textMuted: '--gt-color-text-muted',
    accent: '--gt-color-accent',
    accentStrong: '--gt-color-accent-strong',
    info: '--gt-color-info',
    success: '--gt-color-success',
    warning: '--gt-color-warning',
    danger: '--gt-color-danger',
  },
  radius: {
    xs: '--gt-radius-xs',
    sm: '--gt-radius-sm',
    md: '--gt-radius-md',
    lg: '--gt-radius-lg',
  },
  shadow: {
    sm: '--gt-shadow-sm',
    md: '--gt-shadow-md',
  },
  spacing: {
    xs: '--gt-space-xs',
    sm: '--gt-space-sm',
    md: '--gt-space-md',
    lg: '--gt-space-lg',
    xl: '--gt-space-xl',
    '2xl': '--gt-space-2xl',
  },
  typography: {
    fontSans: '--gt-font-sans',
    textXs: '--gt-text-xs',
    textSm: '--gt-text-sm',
    textBase: '--gt-text-base',
    textLg: '--gt-text-lg',
    weightMedium: '--gt-weight-medium',
    weightSemibold: '--gt-weight-semibold',
  },
};

describe('design tokens', () => {
  it('keeps the TypeScript token map in parity with tokens.json', () => {
    expect(designTokens).toEqual(tokensJson);
  });

  it('defines CSS custom properties for every token value', () => {
    const css = readSourceFile('index.css');

    for (const [groupName, group] of Object.entries(tokensJson)) {
      for (const [tokenName, tokenValue] of Object.entries(group)) {
        const variableName = cssVariableNames[groupName]?.[tokenName];

        expect(variableName, `${groupName}.${tokenName}`).toBeDefined();
        expect(css, `${groupName}.${tokenName}`).toContain(`${variableName}: ${tokenValue};`);
      }
    }
  });

  it('maps Tailwind theme tokens to public CSS custom properties', () => {
    const themeCss = readSourceFile('theme.css');

    expect(themeCss).toContain('--color-gt-surface: var(--gt-color-surface);');
    expect(themeCss).toContain('--radius-gt-md: var(--gt-radius-md);');
    expect(themeCss).toContain('--spacing-gt-lg: var(--gt-space-lg);');
    expect(themeCss).toContain('--font-gt-sans: var(--gt-font-sans);');
  });

  it('includes dark-mode overrides for semantic color tokens only', () => {
    const css = readSourceFile('index.css');
    const darkBlock = css.match(/\.dark\s*\{(?<body>[\s\S]*?)\n\}/)?.groups?.body ?? '';

    expect(darkBlock).toContain('--gt-color-surface:');
    expect(darkBlock).toContain('--gt-color-text:');
    expect(darkBlock).not.toContain('--gt-radius-md:');
    expect(darkBlock).not.toContain('--gt-space-md:');
  });
});
