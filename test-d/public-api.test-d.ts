import designTokens, {
  designTokens as namedDesignTokens,
  type ResolvedDesignTokens,
} from '../dist/index.js';
import {
  BRAND_MIXES,
  deriveBrand,
  type BrandMix,
  type BrandRamps,
} from '../dist/derive.js';
import sourceTokens from '../dist/tokens.tokens.json' with { type: 'json' };
import resolvedJson from '../dist/tokens.json' with { type: 'json' };

const tokens: ResolvedDesignTokens = designTokens;
const background: string = tokens.semantic.background;
const weight: '500' = namedDesignTokens.primitive['font-weight'].medium;
const sourceDescription: string | undefined = sourceTokens.$description;
const jsonBackground: string = resolvedJson.semantic.background;

void background;
void weight;
void sourceDescription;
void jsonBackground;

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
const primary200: BrandMix = BRAND_MIXES.primary[200];
void primary50;
void onPrimary;
void tertiary300;
void primary200;

// @ts-expect-error The primary accent derives no step 300.
void ramps.primary[300];
// @ts-expect-error The tertiary accent derives no step 700.
void ramps.tertiary[700];
// @ts-expect-error Derived colors are readonly.
ramps.primary[500] = '#000000';

// @ts-expect-error Generated tokens are deeply readonly.
tokens.semantic.background = '#000000';
// @ts-expect-error The semantic names are a closed set.
void tokens.semantic['background-surface'];
