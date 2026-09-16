/* Brand color derivation shared by the build and the runtime. */

/** The five color seeds a brand is derived from, as six-digit hex strings. */
export interface BrandSeeds {
  readonly primary: string;
  readonly secondary: string;
  readonly tertiary: string;
  readonly surfaceLight: string;
  readonly surfaceDark: string;
}

/** The steps derived for an accent color. */
export type RampStep = 50 | 500;

/** The steps derived for the tertiary accent: the accent steps plus its tints and shades. */
export type TertiaryStep = RampStep | 100 | 200 | 300 | 600 | 800;

/**
 * A primary or secondary accent: the steps plus `foreground`, the brand surface
 * color that reads better on the seed.
 */
export type AccentRamp = Readonly<Record<RampStep | 'foreground', string>>;

/**
 * The tertiary accent: the accent steps, its tints and shades, plus
 * `foreground`, the brand surface color that reads better on the seed.
 */
export type TertiaryRamp = Readonly<
  Record<TertiaryStep | 'foreground', string>
>;

/** The colors derived from one set of brand seeds. */
export interface BrandRamps {
  readonly primary: AccentRamp;
  readonly secondary: AccentRamp;
  readonly tertiary: TertiaryRamp;
}

/**
 * Returns the primary, secondary and tertiary accents for a set of brand seeds.
 * Each seed is returned unchanged at step 500, and step 50 is a 6% sRGB mix of
 * the seed into the light surface seed. The tertiary accent also carries the
 * tints 100 to 300 (10%, 20% and 30% of the seed into the light surface) and
 * the shades 600 and 800 (10% and 45% black into the seed). Throws on a seed
 * that is not a six-digit hex color.
 */
export declare const deriveBrand: (seeds: BrandSeeds) => BrandRamps;
