/* Brand color derivation shared by the build and the runtime. */

/** The five color seeds a brand is derived from, as six-digit hex strings. */
export interface BrandSeeds {
  readonly primary: string;
  readonly secondary: string;
  readonly tertiary: string;
  readonly surfaceLight: string;
  readonly surfaceDark: string;
}

/**
 * The colors derived from one set of brand seeds. Every accent carries its own
 * steps plus `foreground`, the brand surface color that reads better on the
 * seed.
 */
export interface BrandRamps {
  readonly primary: Readonly<
    Record<50 | 200 | 500 | 600 | 'foreground', string>
  >;
  readonly secondary: Readonly<
    Record<50 | 100 | 500 | 600 | 'foreground', string>
  >;
  readonly tertiary: Readonly<
    Record<50 | 100 | 200 | 300 | 500 | 600 | 800 | 'foreground', string>
  >;
}

/**
 * One derived step: the seed's share in the light surface (`tint`) or black's
 * share in the seed (`shade`), as a fraction.
 */
export type BrandMix = Readonly<{ tint: number } | { shade: number }>;

/**
 * The mix behind every derived step, per accent family. The generated CSS
 * emits the same fractions as `color-mix()` of the `--brand-*` seeds.
 */
export declare const BRAND_MIXES: Readonly<{
  primary: Readonly<Record<50 | 200 | 600, BrandMix>>;
  secondary: Readonly<Record<50 | 100 | 600, BrandMix>>;
  tertiary: Readonly<Record<50 | 100 | 200 | 300 | 600 | 800, BrandMix>>;
}>;

/**
 * Returns the primary, secondary and tertiary accents for a set of brand seeds.
 * Each seed is returned unchanged at step 500 and step 50 is a 6% sRGB mix of
 * the seed into the light surface seed. The primary accent also carries the
 * tint 200 (26.9%) and the shade 600 (16.7% black into the seed), the
 * secondary accent the tint 100 (16.3%) and the shade 600 (13% black), and the
 * tertiary accent the tints 100 to 300 (10%, 20% and 30%) and the shades 600
 * and 800 (10% and 45% black). Throws on a seed that is not a six-digit hex
 * color.
 */
export declare const deriveBrand: (seeds: BrandSeeds) => BrandRamps;
