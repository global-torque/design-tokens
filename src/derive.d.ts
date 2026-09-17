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
 * Returns the primary, secondary and tertiary accents for a set of brand seeds.
 * Each seed is returned unchanged at step 500, step 50 is a 6% sRGB mix of the
 * seed into the light surface seed, and step 600 is 10% black into the seed.
 * The primary accent also carries the tint 200, the secondary accent the tint
 * 100, and the tertiary accent the tints 100 to 300 (10%, 20% and 30% of the
 * seed into the light surface) and the deep shade 800 (45% black into the
 * seed). Throws on a seed that is not a six-digit hex color.
 */
export declare const deriveBrand: (seeds: BrandSeeds) => BrandRamps;
