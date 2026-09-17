import designTokens, {
  designTokens as namedDesignTokens,
  type DesignTokenMode,
  type ResolvedDesignTokens,
} from '../dist/index.js';
import { deriveBrand, type BrandRamps } from '../dist/derive.js';
import {
  applyBrandDocument,
  parseBrandDocument,
  type BrandDocument,
  type ParseOptions,
} from '../dist/apply.js';
import sourceTokens from '../dist/tokens.tokens.json' with { type: 'json' };
import resolvedJson from '../dist/tokens.json' with { type: 'json' };

const tokens: ResolvedDesignTokens = designTokens;
const mode: DesignTokenMode = 'dark';
const surface: string = tokens.modes[mode].semantic.color['background-surface'];
const weight: '500' = namedDesignTokens.primitive['font-weight'].medium;
const sourceDescription: string | undefined = sourceTokens.$description;
const jsonSurface: string =
  resolvedJson.modes.dark.semantic.color['background-surface'];

void surface;
void weight;
void sourceDescription;
void jsonSurface;

const ramps: BrandRamps = deriveBrand({
  primary: '#004fff',
  secondary: '#3ddc97',
  tertiary: '#5b55d6',
  surfaceLight: '#ffffff',
  surfaceDark: '#12161f',
});
const primary50: string = ramps.primary[50];
const onPrimary: string = ramps.primary.foreground;
const tertiary300: string = ramps.tertiary[300];
void primary50;
void onPrimary;
void tertiary300;

// @ts-expect-error The primary accent derives no step 300.
void ramps.primary[300];
// @ts-expect-error The tertiary accent derives no step 700.
void ramps.tertiary[700];
// @ts-expect-error Derived colors are readonly.
ramps.primary[500] = '#000000';

const parseOptions: ParseOptions = { origins: ['https://invest.example'] };
const brand: BrandDocument | null = parseBrandDocument(
  { tokens: { '--brand-primary': '#004fff' }, logoUrl: null },
  parseOptions,
);
const logoUrl: string | null | undefined = brand?.logoUrl;
const seed: string | undefined = brand?.tokens.get('--brand-primary');
const wrote: boolean = applyBrandDocument(brand);
const wroteOnRoot: boolean = applyBrandDocument(
  brand,
  document.documentElement,
);
void logoUrl;
void seed;
void wrote;
void wroteOnRoot;

// @ts-expect-error The allowed origins are required.
void parseBrandDocument({ tokens: {} });
// @ts-expect-error A parsed document is readonly.
brand!.logoUrl = null;
// @ts-expect-error The entries of a parsed document are read-only.
void brand?.tokens.set('--brand-primary', '#000000');

// @ts-expect-error Generated tokens are deeply readonly.
tokens.modes.dark.semantic.color['background-surface'] = '#000000';
// @ts-expect-error Modes are an explicit closed contract.
const unsupportedMode: DesignTokenMode = 'system';
void unsupportedMode;
