// Builds dist/index.css, the only file the package ships, from the DTCG source.
import fs from 'node:fs';

const SOURCE = 'src/tokens.tokens.json';

// The sRGB mix behind each derived accent step: a tint is the seed's share in
// the light surface, a shade is black's share in the seed.
const BRAND_MIXES = {
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

// Generic font families are CSS keywords, so they stay unquoted.
const GENERIC_FAMILY =
  /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|math|emoji|fangsong)$/;

const NEUTRAL_STEP =
  /^primitive\.color\.(charcoal|grey|navy|neutral|slate|steel)-\d+$/;

// CIE L* 40 as relative luminance: neutral steps at or above it follow the
// light surface seed, darker ones the dark seed.
const L_STAR_40 = ((40 + 16) / 116) ** 3;

const tokens = new Map(); // token path, such as 'primitive.color.white' -> { type, value }

// A token without its own $type takes its group's.
function collect(group, path, groupType) {
  const type = group.$type ?? groupType;
  for (const [key, node] of Object.entries(group)) {
    if (key.startsWith('$')) continue;
    const nodePath = path ? `${path}.${key}` : key;
    if ('$value' in node) {
      tokens.set(nodePath, { type: node.$type ?? type, value: node.$value });
    } else {
      collect(node, nodePath, type);
    }
  }
}

// primitive.brand.* -> --brand-*, other primitive.* -> --gt-primitive-*, semantic.* -> --*
function cssName(path) {
  const [layer, ...rest] = path.split('.');
  const name = rest.join('-');
  return layer === 'primitive' && rest[0] !== 'brand'
    ? `--gt-primitive-${name}`
    : `--${name}`;
}

const bytes = (value) =>
  value.components.map((component) => Math.round(component * 255));
const hex = (byte) => byte.toString(16).padStart(2, '0');
const percent = (fraction) => `${Number((fraction * 100).toFixed(1))}%`;
const dimension = ({ value, unit }) => `${value}${unit}`;
const quote = (family) =>
  GENERIC_FAMILY.test(family) ? family : JSON.stringify(family);

function color(value) {
  const [r, g, b] = bytes(value);
  if ((value.alpha ?? 1) < 1) return `rgb(${r} ${g} ${b} / ${value.alpha})`;
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const shadowLayer = (layer) =>
  `${[layer.offsetX, layer.offsetY, layer.blur, layer.spread].map(dimension).join(' ')} ${color(layer.color)}`;

const FORMAT = {
  color,
  dimension,
  duration: dimension,
  fontFamily: (families) => families.map(quote).join(', '),
  fontWeight: String,
  cubicBezier: (points) => `cubic-bezier(${points.join(', ')})`,
  // A shadow token holds one shadow or a list of them.
  shadow: (value) => [value].flat().map(shadowLayer).join(', '),
};

// A derived accent step stays a color-mix() of its brand seed, so overriding
// --brand-* moves it too.
function brandMix(path) {
  const [, family, step] =
    path.match(/^primitive\.color\.([a-z]+)-(\d+)$/) ?? [];
  const mix = BRAND_MIXES[family]?.[step];
  if (!mix) return undefined;
  return mix.shade === undefined
    ? `color-mix(in srgb, var(--brand-${family}) ${percent(mix.tint)}, var(--brand-surface-light))`
    : `color-mix(in srgb, #000000 ${percent(mix.shade)}, var(--brand-${family}))`;
}

function cssValue(path) {
  const { type, value } = tokens.get(path);
  const target =
    typeof value === 'string' ? value.match(/^\{(.+)\}$/)?.[1] : undefined;
  if (target === undefined) return brandMix(path) ?? FORMAT[type](value);
  if (!tokens.has(target)) {
    throw new Error(
      `${path} references {${target}}, which is not a token in ${SOURCE}.`,
    );
  }
  return `var(${cssName(target)})`;
}

// WCAG relative luminance.
function luminance(value) {
  const [r, g, b] = bytes(value).map((byte) => {
    const channel = byte / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const shift = (channel, offset) =>
  `calc(${channel} ${offset < 0 ? '-' : '+'} ${Math.abs(offset)})`;

// A neutral step as its surface seed shifted by the step's fixed per-channel
// offset from the seed's default, so overriding --brand-surface-* moves it too.
function neutralValue(path) {
  const step = tokens.get(path).value;
  const seed = luminance(step) >= L_STAR_40 ? 'surface-light' : 'surface-dark';
  const seedBytes = bytes(tokens.get(`primitive.brand.${seed}`).value);
  const [r, g, b] = bytes(step).map((byte, index) => byte - seedBytes[index]);
  return `rgb(from var(--brand-${seed}) ${shift('r', r)} ${shift('g', g)} ${shift('b', b)})`;
}

function declarations(paths, value, indent) {
  return paths
    .map((path) => `${indent}${cssName(path)}: ${value(path)};`)
    .join('\n');
}

collect(JSON.parse(fs.readFileSync(SOURCE, 'utf8')), '', undefined);

// Sorted paths put every primitive.* token before the semantic.* ones.
const paths = [...tokens.keys()].sort();
// Literal steps only: aliases such as neutral-25 already name a seed.
const neutralPaths = paths.filter(
  (path) =>
    NEUTRAL_STEP.test(path) && typeof tokens.get(path).value === 'object',
);

// Browsers without relative color syntax or round() keep the :root hex values.
const css = `/* Generated from ${SOURCE}. Do not edit. */

:root {
${declarations(paths, cssValue, '  ')}
}

@supports (color: rgb(from red calc(r - 1) g b)) and (width: round(1px, 1px)) {
  :root {
${declarations(neutralPaths, neutralValue, '    ')}
  }
}

`;

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.css', css);
