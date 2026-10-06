/**
 * Derives the brand-dependent colors from a brand's seed colors.
 *
 * Pure: six-digit hex strings in, six-digit hex strings out. The build and the
 * admin's save-time foreground choice share the function, and the generator
 * writes the same mixes into the stylesheet as `color-mix()` of the seeds, so
 * every consumer produces identical colors by construction.
 */

/* Every derived step is one sRGB mix: `tint` is the seed's share in the light
   surface, `shade` is black's share in the seed. */
export const BRAND_MIXES = {
  primary: { 50: { tint: 0.06 }, 200: { tint: 0.269 }, 600: { shade: 0.167 } },
  secondary: { 50: { tint: 0.06 }, 100: { tint: 0.163 }, 600: { shade: 0.13 } },
  tertiary: {
    50: { tint: 0.06 },
    100: { tint: 0.1 },
    200: { tint: 0.2 },
    300: { tint: 0.3 },
    600: { shade: 0.1 },
    800: { shade: 0.45 },
  },
};

/* At a WCAG relative luminance of 0.18 a light and a dark surface both reach
   4.5:1 against the seed, so the seed's side of it reads better. */
const FOREGROUND_SPLIT = 0.18;

/* Shades mix black into the seed: black is a constant, so a shade depends on
   one seed only. */
const BLACK = '#000000';

const HEX = /^#[0-9a-f]{6}$/iu;

const assertHex = (value, name) => {
  if (typeof value !== 'string' || !HEX.test(value)) {
    throw new Error(
      `${name} must be a six-digit hex color, received ${value}.`,
    );
  }
  return value.toLowerCase();
};

const bytes = (hex) =>
  [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));

const toLinear = (channel) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const luminance = (hex) => {
  const [red, green, blue] = bytes(hex).map((byte) => toLinear(byte / 255));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

/* Per channel: into - (into - color) * fraction, in sRGB bytes: the color's share of the mix. */
const mix = (color, into, fraction) => {
  const colorBytes = bytes(color);
  const channels = bytes(into).map((channel, index) =>
    Math.round(channel - (channel - colorBytes[index]) * fraction),
  );
  return `#${channels.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
};

/* The family's mixes from the table, the seed at 500, and the surface that
   reads better on the seed. */
const accent = (seed, light, dark, mixes) => ({
  ...Object.fromEntries(
    Object.entries(mixes).map(([step, { tint, shade }]) => [
      step,
      tint === undefined ? mix(BLACK, seed, shade) : mix(seed, light, tint),
    ]),
  ),
  500: seed,
  foreground: luminance(seed) > FOREGROUND_SPLIT ? dark : light,
});

/**
 * Returns the primary, secondary and tertiary colors for a set of brand seeds:
 * the seed itself at step 500, the tints and shades `BRAND_MIXES` lists for
 * the family, and `foreground`, the brand surface that reads better on the
 * seed.
 */
export const deriveBrand = ({
  primary,
  secondary,
  tertiary,
  surfaceLight,
  surfaceDark,
}) => {
  const light = assertHex(surfaceLight, 'surfaceLight');
  const dark = assertHex(surfaceDark, 'surfaceDark');
  return {
    primary: accent(
      assertHex(primary, 'primary'),
      light,
      dark,
      BRAND_MIXES.primary,
    ),
    secondary: accent(
      assertHex(secondary, 'secondary'),
      light,
      dark,
      BRAND_MIXES.secondary,
    ),
    tertiary: accent(
      assertHex(tertiary, 'tertiary'),
      light,
      dark,
      BRAND_MIXES.tertiary,
    ),
  };
};
