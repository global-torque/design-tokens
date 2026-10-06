import fs from 'node:fs';
import path from 'node:path';
import { applyEdits, modify } from 'jsonc-parser';
import { describe, expect, it } from 'vitest';
import { applyBrandRamps } from './deriveTokens.mjs';

const sourceText = fs.readFileSync(
  path.join(import.meta.dirname, '..', '..', 'src', 'tokens.tokens.json'),
  'utf8',
);

describe('applyBrandRamps', () => {
  const once = applyBrandRamps(sourceText);
  const colors = JSON.parse(once).primitive.color;

  it('writes every generated step under primitive.color', () => {
    for (const [family, steps] of [
      ['primary', [50, 200, 500, 600, 'foreground']],
      ['secondary', [50, 100, 500, 600, 'foreground']],
      ['tertiary', [50, 100, 200, 300, 500, 600, 800, 'foreground']],
    ]) {
      for (const step of steps) {
        expect(colors[`${family}-${step}`]).toBeDefined();
      }
    }
  });

  it('aliases the anchor steps to their seeds', () => {
    expect(colors['primary-500'].$value).toBe('{primitive.brand.primary}');
    expect(colors['secondary-500'].$value).toBe('{primitive.brand.secondary}');
    expect(colors['tertiary-500'].$value).toBe('{primitive.brand.tertiary}');
  });

  it('leaves the primitives it does not generate alone', () => {
    expect(colors['neutral-25'].$value).toBe('{primitive.brand.surface-light}');
    expect(colors['neutral-950'].$value).toBe('{primitive.brand.surface-dark}');
    expect(colors['grey-100']).toEqual(
      JSON.parse(sourceText).primitive.color['grey-100'],
    );
  });

  it('inserts a missing step before the next higher step', () => {
    const options = {
      formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' },
    };
    let reduced = sourceText;
    for (const name of ['secondary-50', 'primary-foreground']) {
      reduced = applyEdits(
        reduced,
        modify(reduced, ['primitive', 'color', name], undefined, options),
      );
    }
    expect(JSON.parse(reduced).primitive.color['secondary-50']).toBeUndefined();
    const names = Object.keys(
      JSON.parse(applyBrandRamps(reduced)).primitive.color,
    );
    expect(names.indexOf('secondary-50')).toBe(
      names.indexOf('secondary-100') - 1,
    );
    expect(names.indexOf('primary-foreground')).toBe(
      names.indexOf('primary-600') + 1,
    );
  });

  it('is idempotent', () => {
    expect(JSON.parse(applyBrandRamps(once))).toEqual(JSON.parse(once));
  });

  it('refuses a source without brand seeds', () => {
    expect(() => applyBrandRamps('{"primitive":{}}')).toThrow(
      /primitive\.brand/u,
    );
  });
});
