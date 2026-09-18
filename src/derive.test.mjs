import { describe, expect, it } from 'vitest';
import { BRAND_MIXES, deriveBrand } from './derive.mjs';

const seeds = {
  primary: '#004fff',
  secondary: '#3ddc97',
  tertiary: '#5b55d6',
  surfaceLight: '#ffffff',
  surfaceDark: '#12161f',
};

describe('deriveBrand', () => {
  const ramps = deriveBrand(seeds);

  it('emits each accent its own steps, the seed at 500, and a foreground', () => {
    expect(Object.keys(ramps)).toEqual(['primary', 'secondary', 'tertiary']);
    expect(Object.keys(ramps.primary)).toEqual([
      '50',
      '200',
      '500',
      '600',
      'foreground',
    ]);
    expect(Object.keys(ramps.secondary)).toEqual([
      '50',
      '100',
      '500',
      '600',
      'foreground',
    ]);
    expect(Object.keys(ramps.tertiary)).toEqual([
      '50',
      '100',
      '200',
      '300',
      '500',
      '600',
      '800',
      'foreground',
    ]);
    expect(ramps.primary[500]).toBe(seeds.primary);
    expect(ramps.secondary[500]).toBe(seeds.secondary);
    expect(ramps.tertiary[500]).toBe(seeds.tertiary);
  });

  it('mixes 6% of the seed into the light surface at step 50', () => {
    expect(ramps.primary[50]).toBe('#f0f4ff');
    expect(ramps.secondary[50]).toBe('#f3fdf9');
    expect(ramps.tertiary[50]).toBe('#f5f5fd');
  });

  it('tints and shades every accent seed', () => {
    expect(ramps.primary[200]).toBe('#bad0ff');
    expect(ramps.primary[600]).toBe('#0042d4');
    expect(ramps.secondary[100]).toBe('#dff9ee');
    expect(ramps.secondary[600]).toBe('#35bf83');
    expect(ramps.tertiary[100]).toBe('#efeefb');
    expect(ramps.tertiary[200]).toBe('#deddf7');
    expect(ramps.tertiary[300]).toBe('#ceccf3');
    expect(ramps.tertiary[600]).toBe('#524dc1');
    expect(ramps.tertiary[800]).toBe('#322f76');
  });

  it('picks the brand surface that reads better on every seed', () => {
    expect(ramps.primary.foreground).toBe('#ffffff');
    expect(ramps.secondary.foreground).toBe('#12161f');
    expect(ramps.tertiary.foreground).toBe('#ffffff');
    for (const [primary, expected] of [
      ['#008055', seeds.surfaceLight],
      ['#0b1f4b', seeds.surfaceLight],
      ['#7dd3fc', seeds.surfaceDark],
      ['#d4a017', seeds.surfaceDark],
    ]) {
      expect(deriveBrand({ ...seeds, primary }).primary.foreground).toBe(
        expected,
      );
    }
  });

  it('is deterministic', () => {
    expect(deriveBrand(seeds)).toEqual(ramps);
  });

  it('declares every mix as one tint or one shade inside (0, 1)', () => {
    for (const mixes of Object.values(BRAND_MIXES)) {
      for (const entry of Object.values(mixes)) {
        const [[kind, fraction], ...rest] = Object.entries(entry);
        expect(rest).toEqual([]);
        expect(['tint', 'shade']).toContain(kind);
        expect(fraction).toBeGreaterThan(0);
        expect(fraction).toBeLessThan(1);
      }
    }
  });

  it('rejects anything but six-digit hex', () => {
    expect(() => deriveBrand({ ...seeds, primary: 'blue' })).toThrow(
      /primary must be a six-digit hex color/u,
    );
    expect(() => deriveBrand({ ...seeds, tertiary: 'purple' })).toThrow(
      /tertiary must be a six-digit hex color/u,
    );
    expect(() => deriveBrand({ ...seeds, surfaceDark: '#fff' })).toThrow(
      /surfaceDark must be a six-digit hex color/u,
    );
  });
});
