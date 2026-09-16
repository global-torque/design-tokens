/**
 * Derives the brand-dependent colors from a brand's seed colors.
 *
 * Pure: six-digit hex strings in, six-digit hex strings out. The same function
 * serves the build (default seeds) and the runtime (a tenant's seeds), so both
 * produce identical colors by construction.
 */

/* Fraction of the seed mixed into the light surface for the subtle step 50. */
const SUBTLE_MIX = 0.06;

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

const accent = (seed, light, dark) => ({
  50: mix(seed, light, SUBTLE_MIX),
  500: seed,
  foreground: luminance(seed) > FOREGROUND_SPLIT ? dark : light,
});

/* The tertiary accent also carries the tints (seed into the light surface) and
   shades (black into the seed) that backgrounds, borders and accents need. */
const tertiaryAccent = (seed, light, dark) => ({
  ...accent(seed, light, dark),
  100: mix(seed, light, 0.1),
  200: mix(seed, light, 0.2),
  300: mix(seed, light, 0.3),
  600: mix(BLACK, seed, 0.1),
  800: mix(BLACK, seed, 0.45),
});

/**
 * Returns the primary, secondary and tertiary colors for a set of brand seeds:
 * the subtle tint at step 50, the seed itself at step 500, `foreground`, the
 * brand surface that reads better on the seed, and for the tertiary accent its
 * tints 100 to 300 and shades 600 and 800.
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
    primary: accent(assertHex(primary, 'primary'), light, dark),
    secondary: accent(assertHex(secondary, 'secondary'), light, dark),
    tertiary: tertiaryAccent(assertHex(tertiary, 'tertiary'), light, dark),
  };
};
