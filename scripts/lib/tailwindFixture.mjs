export const tailwindCandidates = Object.freeze([
  'bg-gt-background-surface',
  'border-gt-border-focus',
  'ease-gt-standard',
  'font-gt-sans',
  'font-gt-medium',
  'p-gt-4',
  'rounded-gt-md',
  'shadow-gt-md',
  'text-gt-sm',
  'text-gt-foreground-default',
]);

export const assertCompiledTailwindTheme = (css, version) => {
  for (const expected of [
    '.bg-gt-background-surface',
    '.border-gt-border-focus',
    '.ease-gt-standard',
    '.font-gt-sans',
    '.font-gt-medium',
    '.p-gt-4',
    '.rounded-gt-md',
    '.shadow-gt-md',
    '.text-gt-sm',
    '.text-gt-foreground-default',
    'background-color: var(--gt-color-background-surface);',
    'border-color: var(--gt-color-border-focus);',
    'transition-timing-function: var(--gt-primitive-easing-standard);',
    'font-family: var(--gt-primitive-font-family-sans);',
    'font-weight: var(--gt-primitive-font-weight-medium);',
    'padding: var(--gt-primitive-spacing-4);',
    'border-radius: var(--gt-primitive-radius-md);',
    '--tw-shadow: var(--gt-primitive-shadow-md);',
    'font-size: var(--gt-primitive-font-size-sm);',
    'color: var(--gt-color-foreground-default);',
  ]) {
    if (!css.includes(expected)) {
      throw new Error(`Tailwind ${version} output is missing ${expected}.`);
    }
  }
};

export const compileTailwindFixture = async (compile, themeCss) => {
  const compiler = await compile(`${themeCss}\n@tailwind utilities;`);
  return compiler.build(tailwindCandidates);
};
