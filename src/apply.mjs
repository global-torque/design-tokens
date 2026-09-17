/* Bounds an untrusted brand document and writes it on the page: every map entry,
   plus the steps `deriveBrand` returns when the map carries a seed, with an explicit
   entry beating the derived one it names. The three rules, the guard rails and the
   rationale for each live in the accepted design and its review. */
import { deriveBrand } from './derive.mjs';

/** Only our namespaces: a document must not reach `--primary` or any host variable. */
const TOKEN_NAME = /^--(?:brand|gt)-[a-z0-9-]+$/;

/** A hex colour in any of the four legal lengths. */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Bounded so a geometry token cannot become a layout weapon; `.5rem` and `0.5REM` are legal CSS. */
const LENGTH = /^(?:0|(?:\d{1,4}|\d{0,4}\.\d{1,3})(?:px|rem|em|%))$/i;

/** `deriveBrand` takes six-digit hex, so an alpha colour cannot seed a derivation. */
const SIX_DIGIT_HEX = /^#[0-9a-f]{6}$/i;

/** The five colour seeds a brand derives from, by the property that carries each. */
const SEED_PROPERTIES = [
  ['--brand-primary', 'primary'],
  ['--brand-secondary', 'secondary'],
  ['--brand-tertiary', 'tertiary'],
  ['--brand-surface-light', 'surfaceLight'],
  ['--brand-surface-dark', 'surfaceDark'],
];

const SEED_NAMES = new Set(SEED_PROPERTIES.map(([property]) => property));

/** Capped before matching, so a hostile document cannot make the page do work. */
const MAX_VALUE_LENGTH = 64;
const MAX_ENTRIES = 256;

/** These break out of a later CSS or URL context, or make a URL read as a host it is not. */
const LOGO_URL_BANNED = /["'`<>\\@\s\p{Cc}]/u;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expandHex(value) {
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{4})$/i.test(value)) return value;
  return `#${value.slice(1).replace(/./g, (digit) => digit + digit)}`;
}

/** The accepted value of one entry, or `null` when the entry is dropped. */
function acceptToken(name, raw) {
  if (!TOKEN_NAME.test(name)) return null;
  if (typeof raw !== 'string' || raw.length > MAX_VALUE_LENGTH) return null;
  // Expand before judging, so `#abcd` drops on the seed rule instead of making `deriveBrand` throw.
  const value = expandHex(raw.trim());
  if (!HEX_COLOR.test(value) && !LENGTH.test(value)) return null;
  if (SEED_NAMES.has(name) && !SIX_DIGIT_HEX.test(value)) return null;
  return value;
}

/** A tenant logo comes from a host we serve: allowlist origins, keep the normalised `href`. */
function parseLogoUrl(value, origins) {
  if (typeof value !== 'string' || LOGO_URL_BANNED.test(value)) return null;
  let url;
  try {
    // `origins[0]` is the base a relative value resolves against; a value `URL` throws on is dropped.
    url = new URL(value, origins[0]);
  } catch {
    return null;
  }
  // The protocol test is not redundant: `blob:https://our-origin/x` reports our own origin.
  const allowed = url.protocol === 'https:' && origins.includes(url.origin);
  return allowed ? url.href : null;
}

/** The entries to write and the validated logo, or `null` when the value is not a document. Never throws. */
export function parseBrandDocument(value, options) {
  if (!isPlainObject(value)) return null;
  const rawTokens = value.tokens;
  if (rawTokens !== undefined && !isPlainObject(rawTokens)) return null;
  // Total even without options: a caller that supplies no origins allows no logo.
  const origins = Array.isArray(options?.origins) ? options.origins : [];

  const tokens = new Map();
  const dropped = [];
  const entries = rawTokens
    ? Object.entries(rawTokens).slice(0, MAX_ENTRIES)
    : [];
  for (const [name, raw] of entries) {
    const accepted = acceptToken(name, raw);
    if (accepted === null) dropped.push(name);
    else tokens.set(name, accepted);
  }

  const logoUrl = parseLogoUrl(value.logoUrl, origins);
  if (
    logoUrl === null &&
    value.logoUrl !== undefined &&
    value.logoUrl !== null
  ) {
    dropped.push('logoUrl');
  }
  // The names only, never the values.
  if (dropped.length > 0)
    console.warn('[brand] dropped document entries:', dropped.join(', '));

  return { tokens, logoUrl };
}

/**
 * Writes one set of custom properties on `root` and returns whether it wrote any;
 * never throws. On the root element, because a `var()` inside a custom property is
 * substituted where it is declared and the same writes on `<body>` half-apply.
 */
export function applyBrandDocument(
  brand,
  root = typeof document === 'undefined' ? null : document.documentElement,
) {
  if (brand === null || root === null) return false;
  try {
    const computed = getComputedStyle(root);
    // Root reads are normalised like map entries: minified CSS reads `#ffffff` back as `#fff`.
    const seeds = Object.fromEntries(
      SEED_PROPERTIES.map(([property, field]) => [
        field,
        brand.tokens.get(property) ??
          expandHex(computed.getPropertyValue(property).trim()),
      ]),
    );
    const suppliedSeed = SEED_PROPERTIES.some(([property]) =>
      brand.tokens.has(property),
    );

    const writes = new Map();
    // Rule 2, foregrounds included: the dictionary's aliases are right only for our own seeds.
    if (
      suppliedSeed &&
      Object.values(seeds).every((seed) => SIX_DIGIT_HEX.test(seed))
    ) {
      // Its own `try`, so a throw costs the derived steps only and the map still writes.
      try {
        const ramps = Object.entries(deriveBrand(seeds));
        for (const [family, ramp] of ramps) {
          for (const [step, value] of Object.entries(ramp)) {
            writes.set(`--gt-primitive-color-${family}-${step}`, value);
          }
        }
      } catch {
        writes.clear();
      }
    }
    // Rules 1 and 3: every entry is written, and it replaces the derived step it names.
    for (const [property, value] of brand.tokens) writes.set(property, value);

    for (const [property, value] of writes)
      root.style.setProperty(property, value);
    return writes.size > 0;
  } catch {
    return false;
  }
}
