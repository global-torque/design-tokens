export const tailwindCandidates = Object.freeze([
  'animate-gt-fade-in',
  'bg-gt-background-surface',
  'border-gt-border-focus',
  'ease-gt-standard',
  'font-gt-sans',
  'font-gt-medium',
  'gt-md:grid-cols-2',
  'leading-gt-normal',
  'opacity-gt-disabled',
  'p-gt-4',
  'rounded-gt-md',
  'shadow-gt-md',
  'text-gt-base',
  'text-gt-foreground-default',
  'tracking-gt-wide',
]);

export const assertCompiledTailwindTheme = (css, version) => {
  for (const expected of [
    '.animate-gt-fade-in',
    '.bg-gt-background-surface',
    '.border-gt-border-focus',
    '.ease-gt-standard',
    '.font-gt-sans',
    '.font-gt-medium',
    '.gt-md\\:grid-cols-2',
    '.leading-gt-normal',
    '.opacity-gt-disabled',
    '.p-gt-4',
    '.rounded-gt-md',
    '.shadow-gt-md',
    '.text-gt-base',
    '.text-gt-foreground-default',
    '.tracking-gt-wide',
    '@media (width >= 48rem)',
    '@keyframes gt-fade-in',
    'animation: gt-fade-in var(--gt-primitive-animation-fade-in) var(--gt-primitive-easing-standard) both;',
    'background-color: var(--gt-color-background-surface);',
    'border-color: var(--gt-color-border-focus);',
    'transition-timing-function: var(--gt-primitive-easing-standard);',
    'font-family: var(--gt-primitive-font-family-sans);',
    'font-weight: var(--gt-primitive-font-weight-medium);',
    'line-height: var(--gt-primitive-line-height-normal);',
    'opacity: var(--gt-primitive-opacity-disabled);',
    'padding: var(--gt-primitive-spacing-4);',
    'border-radius: var(--gt-primitive-radius-md);',
    '--tw-shadow: var(--gt-primitive-shadow-md);',
    'font-size: var(--gt-primitive-font-size-base);',
    'color: var(--gt-color-foreground-default);',
    'letter-spacing: var(--gt-primitive-letter-spacing-wide);',
  ]) {
    if (!css.includes(expected)) {
      throw new Error(`Tailwind ${version} output is missing ${expected}.`);
    }
  }
  if (css.includes('@media (width >= var(')) {
    throw new Error(
      `Tailwind ${version} emitted an unusable variable breakpoint.`,
    );
  }
};

export const compileTailwindFixture = async (compile, themeCss) => {
  const compiler = await compile(`${themeCss}\n@tailwind utilities;`);
  return compiler.build(tailwindCandidates);
};
