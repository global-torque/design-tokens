# @global-torque/design-tokens

> **Public 0.1 beta candidate:** the source is under review. Do not install a
> mutable branch or reuse the earlier dirty-tree beta.1 artifact. Promotion
> requires the protected-tag beta.2 asset and the exact i-djadmin gate.

Neutral institutional design tokens for administrative and content interfaces.
One DTCG 2025.10 source generates the typed JavaScript API, declarations,
resolved JSON, plain CSS, and Tailwind CSS v4 mappings. The generator rejects
invalid references, cycles, mode drift, invalid typed values, and supported
foreground/background pairs below 4.5:1.

The package contains no Vue code, runtime mode detection, media-query theme
activation, product palette, routes, environment reads, or private URLs.

## Install

```sh
pnpm add @global-torque/design-tokens
```

Node 22.x and 24.x are supported release targets; Node 26.x is informational.
The generated Tailwind entrypoint is tested with Tailwind 4.2.1 and the pinned
current 4.x compatibility target (4.3.2).
The plain CSS contract targets browsers with CSS custom properties and `:is()`;
the Tailwind entrypoint requires Tailwind CSS 4.2.1 or a verified later 4.x.

## Plain CSS

Import the variable definitions once:

```css
@import '@global-torque/design-tokens/css';

.panel {
  color: var(--gt-color-foreground-default);
  background: var(--gt-color-background-surface);
  border: 1px solid var(--gt-color-border-default);
  border-radius: var(--gt-primitive-radius-md);
  box-shadow: var(--gt-primitive-shadow-sm);
}

.amount {
  font-family: var(--gt-typography-tabular-number-font-family);
  font-variant-numeric: var(
    --gt-typography-tabular-number-font-variant-numeric
  );
}
```

Light values live on `:root`. A host activates dark values explicitly with
either `.dark` or `[data-theme="dark"]` on an ancestor. The package intentionally
does not infer a mode from `prefers-color-scheme`.

## Tailwind CSS v4

```css
@import 'tailwindcss';
@import '@global-torque/design-tokens/css';
@import '@global-torque/design-tokens/theme';
```

The generated `@theme inline` block maps these documented namespaces:

| Token family    | Tailwind namespace   | Example utility            |
| --------------- | -------------------- | -------------------------- |
| semantic colors | `--color-gt-*`       | `bg-gt-background-surface` |
| spacing         | `--spacing-gt-*`     | `p-gt-4`                   |
| radii           | `--radius-gt-*`      | `rounded-gt-md`            |
| font families   | `--font-gt-*`        | `font-gt-sans`             |
| font sizes      | `--text-gt-*`        | `text-gt-base`             |
| font weights    | `--font-weight-gt-*` | `font-gt-medium`           |
| line heights    | `--leading-gt-*`     | `leading-gt-normal`        |
| letter spacing  | `--tracking-gt-*`    | `tracking-gt-wide`         |
| shadows         | `--shadow-gt-*`      | `shadow-gt-md`             |
| opacity         | `--opacity-gt-*`     | `opacity-gt-disabled`      |
| breakpoints     | `--breakpoint-gt-*`  | `gt-md:grid-cols-2`        |
| easing          | `--ease-gt-*`        | `ease-gt-standard`         |
| animation       | `--animate-gt-*`     | `animate-gt-fade-in`       |

No Tailwind configuration file or plugin is required.

## Typed and JSON APIs

```ts
import designTokens, {
  type DesignTokenMode,
} from '@global-torque/design-tokens';

const mode: DesignTokenMode = 'dark';
const surface = designTokens.modes[mode].semantic.color['background-surface'];
```

`@global-torque/design-tokens/tokens` is an explicit alias of the root typed
API. `designTokens` and every nested value are frozen at runtime and readonly in
the generated declaration.

Node 22+, bundlers, and other import-attribute-aware tooling can consume both
JSON surfaces directly:

```js
import sourceTokens from '@global-torque/design-tokens/source' with { type: 'json' };
import resolvedTokens from '@global-torque/design-tokens/tokens.json' with { type: 'json' };

console.log(sourceTokens.$description);
console.log(resolvedTokens.modes.dark.semantic.color['background-surface']);
```

`./source` is canonical DTCG data; `./tokens.json` is the resolved, CSS-ready
representation. Serve the former as `application/design-tokens+json` when a
tool needs a media type.

The CSS subpaths also have JavaScript URL facades for libraries that load
stylesheets programmatically:

```js
import cssUrl, {
  stylesheet as namedCssUrl,
} from '@global-torque/design-tokens/css';
import themeUrl from '@global-torque/design-tokens/theme';

console.assert(cssUrl === namedCssUrl);
console.assert(cssUrl.endsWith('/index.css'));
console.assert(themeUrl.endsWith('/theme.css'));
```

Generated API references cover the [typed root](./docs/api/index.md),
[plain-CSS URL facade](./docs/api-css/index.md), and
[Tailwind-theme URL facade](./docs/api-theme/index.md).

## Token architecture

- `primitive` contains raw color, spacing, radius, typography, shadow,
  breakpoint, opacity, duration, easing, and animation values.
- `semantic.light` and `semantic.dark` assign accessible interface meaning,
  including canvas/surface/overlay, foregrounds, borders/focus, accent, and
  positive/negative/neutral/warning/info pairs.
- `component.light` and `component.dark` alias semantic values for button,
  input, dialog, toast, disabled, hover, and focus states.

Light and dark semantic/component token paths must have exact type parity. The
generator rejects any missing counterpart. Generated files live only in
`dist`; edit `src/tokens.tokens.json`, never a generated representation.

## Supported contrast pairs

The build enforces WCAG contrast of at least 4.5:1 for default, muted, and
disabled foregrounds on surfaces; accent foreground/background; and the five
status foreground/background pairs. Component disabled pairs are enforced too.
Current enforced text ratios range from 5.47:1 to 17.74:1 in light mode and
5.71:1 to 16.96:1 in dark mode. The active input boundary is independently
enforced at 3:1 and currently measures 4.76:1 light and 6.92:1 dark. Decorative
borders, overlays, and focus rings are not misrepresented as text pairs.

## Development and release checks

```sh
pnpm run browser:install
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test:coverage
pnpm run test:tailwind:current
pnpm run docs:api
pnpm run api:check
pnpm run docs:check
pnpm run package:lint
```

`browser:install` installs the Chromium binary pinned to Playwright 1.61.1 and
its Linux system dependencies. It is required on a clean CI/cache image before
`test:run` or `test:coverage`.
The test matrix validates DTCG structure and aliases, deterministic generation,
deep runtime freezing, CSS/JSON/JS/declaration/source-map parity, both explicit
modes, browser theme activation, text and input-boundary contrast, and real
Tailwind compilation against both supported targets. Release automation must
build once and use the same immutable tarball bytes for npm and pnpm clean
rooms, admin consumer validation, and publication.

The packed clean-room smoke test is intentionally executable:

```js clean-room
import assert from 'node:assert/strict';
import cssUrl from '@global-torque/design-tokens/css';
import designTokens, {
  designTokens as namedTokens,
} from '@global-torque/design-tokens';
import sourceTokens from '@global-torque/design-tokens/source' with { type: 'json' };
import resolvedTokens from '@global-torque/design-tokens/tokens.json' with { type: 'json' };
import themeUrl from '@global-torque/design-tokens/theme';

assert.equal(designTokens, namedTokens);
assert.equal(Object.isFrozen(designTokens), true);
assert.equal(Object.isFrozen(designTokens.modes.dark.semantic.color), true);
assert.equal(
  designTokens.modes.dark.semantic.color['background-surface'],
  '#111827',
);
assert.equal(
  resolvedTokens.modes.dark.semantic.color['background-surface'],
  '#111827',
);
assert.match(sourceTokens.$description, /Neutral institutional/u);
assert.match(cssUrl, /\/index\.css$/u);
assert.match(themeUrl, /\/theme\.css$/u);
```

## Migration and rollback

The 0.1 beta intentionally replaces the earlier handwritten maps and variable
catalog. Concrete common mappings are:

| Before                            | 0.1 beta replacement                                            |
| --------------------------------- | --------------------------------------------------------------- |
| `colorTokens.surface`             | `designTokens.modes.light.semantic.color['background-surface']` |
| `colorTokens.text`                | `designTokens.modes.light.semantic.color['foreground-default']` |
| `spacingTokens.lg`                | `designTokens.primitive.spacing['4']`                           |
| `radiusTokens.md`                 | `designTokens.primitive.radius.md`                              |
| `typographyTokens.weightSemibold` | `designTokens.primitive['font-weight'].semibold`                |
| Type `DesignTokens`               | Type `ResolvedDesignTokens`                                     |
| `--gt-color-surface`              | `--gt-color-background-surface`                                 |
| `--gt-color-text`                 | `--gt-color-foreground-default`                                 |
| `--gt-space-lg`                   | `--gt-primitive-spacing-4`                                      |
| Tailwind `bg-gt-surface`          | `bg-gt-background-surface`                                      |
| Tailwind `text-gt-text`           | `text-gt-foreground-default`                                    |
| Tailwind `@theme` import          | `@global-torque/design-tokens/theme` (`@theme inline`)          |

For dark mode, select `designTokens.modes.dark` and activate either `.dark` or
`[data-theme="dark"]` in CSS. Product aliases belong in the host stylesheet,
not this package.

During beta, pin the exact artifact digest. To roll back, restore the last
known-good tarball or exact npm version, revert only the consumer token import,
and publish a new beta for any correction; never replace or retag failed bytes.
CSS variables and JSON paths are public API and receive the same breaking-change
treatment as TypeScript names.

## Ownership and contributing

The Global Torque Design Systems maintainers own the schema, generator, public
API, compatibility matrix, and release decision. Host applications own product
aliases and visual acceptance. Propose changes through the package repository's
GitHub issues before opening a pull request. A contribution must update the
canonical DTCG file (never `dist`), include generator/contrast/parity regression
tests, regenerate API docs and reports, add a changelog and migration note for
public-name changes, and pass every development/release command above. A
maintainer must review generated diffs and the exact packed artifact before a
beta is accepted.

## Security and support

Use GitHub issues for ordinary compatibility requests and GitHub private
vulnerability reporting for security concerns. Do not put customer data,
credentials, unpublished vulnerabilities, private URLs, or product-specific
theme decisions in public issues or token values. See `SECURITY.md` for the
supported-version and response policy.
