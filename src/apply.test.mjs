/**
 * The guard rails around a published brand document, and the three rules that put
 * one on the page. Everything here is untrusted input, so each case states which
 * rule decides it, and the derived expectations are computed by calling
 * `deriveBrand` on the same input — never written out as hex — so the runtime and
 * the build cannot drift apart without this failing.
 *
 * This package's vitest runs in node, so the write target is a stand-in for
 * `<html>` whose computed values the test declares and whose `setProperty`
 * records the write set. That is what the `root` parameter exists for.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBrandDocument, parseBrandDocument } from './apply.mjs';
import { deriveBrand } from './derive.mjs';

/** The page's own origin, and the filer a tenant logo is uploaded to. */
const origins = ['https://portal.example', 'https://files.example'];

/** The entries a document is reduced to, as a plain object. */
const tokensOf = (value) =>
  Object.fromEntries(parseBrandDocument(value, { origins })?.tokens ?? []);

/** A valid entry carried alongside a failing one, to prove the rest of the document survives. */
const survivor = { '--brand-primary': '#1a56db' };

describe('parseBrandDocument keys', () => {
  it('writes a seed, a primitive and a role verbatim, and drops every other name', () => {
    expect(
      tokensOf({
        tokens: {
          '--brand-primary': '#1a56db',
          '--gt-primitive-color-tertiary-600': '#524dc1',
          '--gt-color-accent-background': '#1a56db',
          '--primary': '#ff0000',
          '--tw-ring': '#ff0000',
          color: '#ff0000',
          '--gt-x(evil)': '#ff0000',
          '--GT-PRIMARY': '#ff0000',
          '--brand-x\n': '#ff0000',
          '--ui-brand-logo': '#ff0000',
        },
      }),
    ).toEqual({
      '--brand-primary': '#1a56db',
      '--gt-primitive-color-tertiary-600': '#524dc1',
      '--gt-color-accent-background': '#1a56db',
    });
  });
});

describe('parseBrandDocument values', () => {
  it.each([
    ['.5rem'],
    ['0.5REM'],
    ['2PX'],
    ['0'],
    ['100%'],
    ['9999px'],
    ['1.5em'],
    ['#abc'],
    ['#abcd'],
    ['#1a56db80'],
  ])('accepts %s', (value) => {
    expect(
      tokensOf({ tokens: { '--gt-value': value, ...survivor } })['--gt-value'],
    ).toBeDefined();
  });

  it.each([
    ['var(--x)'],
    ['url(https://e.test/a)'],
    ['calc(1px + 1px)'],
    ['red'],
    ['transparent'],
    ['1e3px'],
    ['#12345'],
    ['-99999px'],
    ['99999999999999px'],
    ['12345px'],
    ['#'.padEnd(65, 'a')],
  ])('drops %s and keeps the rest of the document', (value) => {
    expect(tokensOf({ tokens: { '--gt-value': value, ...survivor } })).toEqual(
      survivor,
    );
  });

  it('trims a value before matching it', () => {
    expect(
      tokensOf({ tokens: { '--gt-value': ' #abcdef\n' } })['--gt-value'],
    ).toBe('#abcdef');
  });

  it('caps the map at 256 entries', () => {
    const tokens = Object.fromEntries(
      Array.from({ length: 300 }, (_, index) => [
        `--gt-entry-${index}`,
        '#abcdef',
      ]),
    );
    expect(parseBrandDocument({ tokens }, { origins })?.tokens.size).toBe(256);
  });
});

describe('parseBrandDocument normalisation order', () => {
  it('expands a three-digit hex to six', () => {
    expect(
      tokensOf({ tokens: { '--brand-primary': '#abc' } })['--brand-primary'],
    ).toBe('#aabbcc');
  });

  it('expands a four-digit hex first, so the seed rule drops that entry alone', () => {
    const document = parseBrandDocument(
      {
        tokens: {
          '--brand-primary': '#abcd',
          '--brand-secondary': '#3ddc97',
          '--brand-tertiary': '#5b55d6',
          '--brand-surface-light': '#ffffff',
          '--brand-surface-dark': '#12161f',
        },
      },
      { origins },
    );
    expect(document?.tokens.has('--brand-primary')).toBe(false);
    expect(document?.tokens.size).toBe(4);
  });

  it('drops an alpha hex on a seed and keeps it on any other key', () => {
    expect(
      tokensOf({
        tokens: { '--brand-primary': '#1a56db80', '--gt-value': '#1a56db80' },
      }),
    ).toEqual({ '--gt-value': '#1a56db80' });
  });
});

describe('parseBrandDocument logoUrl', () => {
  const documentWith = (logoUrl) =>
    parseBrandDocument({ tokens: survivor, logoUrl }, { origins });

  it.each([
    ['/images/logo.svg', 'https://portal.example/images/logo.svg'],
    [
      'https://files.example/filer-api/v1.0/files/9',
      'https://files.example/filer-api/v1.0/files/9',
    ],
  ])('keeps %s as the normalised href %s', (input, expected) => {
    expect(documentWith(input)?.logoUrl).toBe(expected);
  });

  it.each([
    // Step 1, the banned characters, before any parsing.
    ['a"), url("https://attacker.example/beacon'],
    ['data:image/svg+xml,<svg/>'],
    ['https://portal.example@files.example/x'],
    ['https://portal.example/logo .svg'],
    // Step 2, the protocol test.
    ['http://x/a'],
    ['javascript:alert(1)'],
    ['blob:https://portal.example/abc'],
    // Step 2, the origin allowlist.
    ['https://cdn.example/logo.svg'],
    ['//attacker.example/x'],
  ])('drops %s and still applies the rest of the document', (input) => {
    const document = documentWith(input);
    expect(document?.logoUrl).toBeNull();
    expect(Object.fromEntries(document.tokens)).toEqual(survivor);
  });

  it('keeps null as null', () => {
    expect(documentWith(null)?.logoUrl).toBeNull();
  });
});

describe('parseBrandDocument outer failures', () => {
  it.each([
    [null],
    [undefined],
    ['<!doctype html><html></html>'],
    [42],
    [[]],
    [{ tokens: 'x' }],
  ])('discards %s', (value) => {
    expect(parseBrandDocument(value, { origins })).toBeNull();
  });

  it('keeps an empty document with nothing to write', () => {
    expect(parseBrandDocument({}, { origins })).toEqual({
      tokens: new Map(),
      logoUrl: null,
    });
  });
});

/** The page's own seeds. Deliberately not our palette: the mechanism is what is under test. */
const base = {
  primary: '#102030',
  secondary: '#204030',
  tertiary: '#302040',
  surfaceLight: '#fafafa',
  surfaceDark: '#111111',
};

/** A tenant's five seeds, far enough from the base that no expectation can pass by accident. */
const tenant = {
  primary: '#e07a1f',
  secondary: '#1f9ee0',
  tertiary: '#9e1fe0',
  surfaceLight: '#fffdf7',
  surfaceDark: '#1a1410',
};

const seedDocument = (seeds) => ({
  '--brand-primary': seeds.primary,
  '--brand-secondary': seeds.secondary,
  '--brand-tertiary': seeds.tertiary,
  '--brand-surface-light': seeds.surfaceLight,
  '--brand-surface-dark': seeds.surfaceDark,
});

/** Every property `deriveBrand` returns for one set of seeds, as the applier names them. */
const derived = (seeds) =>
  Object.fromEntries(
    Object.entries(deriveBrand(seeds)).flatMap(([family, ramp]) =>
      Object.entries(ramp).map(([step, value]) => [
        `--gt-primitive-color-${family}-${step}`,
        value,
      ]),
    ),
  );

/**
 * A stand-in for `<html>`: the declared properties are what the page's own
 * stylesheet would compute to, and `style.setProperty` records the write set.
 */
const createRoot = (declared) => ({
  declared,
  style: {
    written: new Map(),
    setProperty(property, value) {
      this.written.set(property, value);
    },
  },
});

/** Applies a raw document and returns exactly what landed on the root. */
function applied(value, root = createRoot(seedDocument(base))) {
  applyBrandDocument(parseBrandDocument(value, { origins }), root);
  return Object.fromEntries(root.style.written);
}

beforeEach(() => {
  vi.stubGlobal('getComputedStyle', (element) => ({
    getPropertyValue: (property) => element.declared[property] ?? '',
  }));
});

describe('applyBrandDocument', () => {
  it('writes every entry of the map, whatever it names (rule 1)', () => {
    expect(
      applied({
        tokens: {
          '--brand-radius': '0.25rem',
          '--gt-primitive-color-grape-700': '#5014d0',
          '--gt-color-chart-4': '#6f3dfd',
        },
      }),
    ).toEqual({
      '--brand-radius': '0.25rem',
      '--gt-primitive-color-grape-700': '#5014d0',
      '--gt-color-chart-4': '#6f3dfd',
    });
  });

  it('writes the seeds plus every step deriveBrand returns (rule 2)', () => {
    const writes = applied({ tokens: seedDocument(tenant) });
    expect(writes).toEqual({ ...derived(tenant), ...seedDocument(tenant) });
    // Eighteen derived steps today; the applier holds no step list, so this number
    // follows the function rather than the other way round.
    expect(Object.keys(derived(tenant))).toHaveLength(18);
  });

  it('derives the foregrounds from the seed rather than the dictionary alias', () => {
    // A light primary needs the dark surface on top of it; the CSS alias would give white.
    const light = { ...tenant, primary: '#ffd700' };
    expect(
      applied({ tokens: seedDocument(light) })[
        '--gt-primitive-color-primary-foreground'
      ],
    ).toBe(light.surfaceDark);
  });

  it('derives from the page seeds for whatever the map leaves out', () => {
    const merged = { ...base, primary: tenant.primary };
    expect(applied({ tokens: { '--brand-primary': tenant.primary } })).toEqual({
      ...derived(merged),
      '--brand-primary': tenant.primary,
    });
  });

  it('writes only its own entries when the map carries no seed', () => {
    expect(
      applied({ tokens: { '--gt-primitive-color-primary-50': '#abcdef' } }),
    ).toEqual({ '--gt-primitive-color-primary-50': '#abcdef' });
  });

  it('lets an explicit entry beat the derived step it names (rule 3)', () => {
    const writes = applied({
      tokens: {
        ...seedDocument(tenant),
        '--gt-primitive-color-tertiary-600': '#0b0b0b',
      },
    });
    expect(writes['--gt-primitive-color-tertiary-600']).toBe('#0b0b0b');
    expect(writes['--gt-primitive-color-tertiary-600']).not.toBe(
      derived(tenant)['--gt-primitive-color-tertiary-600'],
    );
  });

  it('derives from the four surviving seeds when one entry is dropped', () => {
    const merged = { ...tenant, primary: base.primary };
    // The seed rule drops the map's own `--brand-primary`, so the other four are
    // what reaches the page.
    const kept = seedDocument(tenant);
    delete kept['--brand-primary'];
    const writes = applied({
      tokens: { ...seedDocument(tenant), '--brand-primary': '#abcd' },
    });
    expect(writes).toEqual({ ...derived(merged), ...kept });
  });

  it('expands a short-form page seed before judging it', () => {
    // The app's CSS is minified, so the built stylesheet carries `--brand-surface-light:#fff`
    // rather than the dictionary's `#ffffff`. Read verbatim, that fails the six-digit rule
    // and costs every derived step on the one document shape a tenant publishes today.
    const root = createRoot({
      ...seedDocument(base),
      '--brand-surface-light': '#fff',
      '--brand-tertiary': '#abc',
    });
    const merged = {
      ...base,
      primary: tenant.primary,
      surfaceLight: '#ffffff',
      tertiary: '#aabbcc',
    };
    expect(
      applied({ tokens: { '--brand-primary': tenant.primary } }, root),
    ).toEqual({ ...derived(merged), '--brand-primary': tenant.primary });
  });

  it('skips derivation when the page has no seeds to fall back on', () => {
    expect(
      applied(
        { tokens: { '--brand-primary': tenant.primary } },
        createRoot({}),
      ),
    ).toEqual({ '--brand-primary': tenant.primary });
  });

  it('writes no logo property for a valid logoUrl', () => {
    const writes = applied({
      tokens: seedDocument(tenant),
      logoUrl: 'https://files.example/filer-api/v1.0/files/9',
    });
    expect(
      Object.keys(writes).filter((property) =>
        property.startsWith('--ui-brand'),
      ),
    ).toEqual([]);
  });

  it('writes nothing when there is no document', () => {
    expect(applyBrandDocument(null)).toBe(false);
    expect(applied(null)).toEqual({});
    expect(applied({})).toEqual({});
    expect(applied('<!doctype html><html></html>')).toEqual({});
    expect(applied({ tokens: 'x' })).toEqual({});
  });
});
