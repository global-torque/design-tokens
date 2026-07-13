import designTokens, {
  designTokens as namedDesignTokens,
  type DesignTokenMode,
  type ResolvedDesignTokens,
} from '../dist/index.js';
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

// @ts-expect-error Generated tokens are deeply readonly.
tokens.modes.dark.semantic.color['background-surface'] = '#000000';
// @ts-expect-error Modes are an explicit closed contract.
const unsupportedMode: DesignTokenMode = 'system';
void unsupportedMode;
