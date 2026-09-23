# @global-torque/design-tokens

> **Stable release:** `0.3.0` adds the brand seeds, the accent steps derived
> from them, and the `./derive` entry point. It removes token families and
> moves token values, so it does not drop in over `0.2.1`.

Neutral institutional design tokens for administrative and content interfaces.
One DTCG 2025.10 source generates the typed JavaScript API, declarations,
resolved JSON, plain CSS, and Tailwind CSS v4 mappings. The generator rejects
invalid references, cycles, mode drift, and invalid typed values.

Brand values enter as seven seeds under `primitive.brand`, emitted as
`--brand-*`. The primary, secondary, and tertiary accent steps are derived from
them; the dictionary also holds fixed system colors and elevations that a
rebrand does not move. The seeds are build-time inputs: edit `primitive.brand`,
run `pnpm run tokens:derive` to rewrite the derived steps in
`src/tokens.tokens.json`, and rebuild. `./derive` exports the same derivation
for a host that recolors at runtime (see [Runtime rebrand](#runtime-rebrand)).

The package contains no Vue code, runtime mode detection, media-query theme
activation, routes, environment reads, or private URLs.

## Install

```sh
pnpm add @global-torque/design-tokens@0.3.0
```

Required and release-candidate CI run on Node 24.x.
Required and release-candidate CI test the generated Tailwind entrypoint with
the exact lockfile version, Tailwind 4.3.3. A scheduled informational workflow
tests npm's current 4.x release without making a protected tag depend on a
mutable registry tag.
The plain CSS contract targets browsers with CSS custom properties and `:is()`;
the Tailwind entrypoint requires Tailwind CSS 4.3.3 or a verified later 4.x.

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

Host applications should import both files only after validating the approved
immutable artifact in their own Tailwind build.
The generated `@theme inline` block maps these documented namespaces:

| Token family    | Tailwind namespace   | Example utility            |
| --------------- | -------------------- | -------------------------- |
| semantic colors | `--color-gt-*`       | `bg-gt-background-surface` |
| spacing         | `--spacing-gt-*`     | `p-gt-4`                   |
| radii           | `--radius-gt-*`      | `rounded-gt-md`            |
| font families   | `--font-gt-*`        | `font-gt-sans`             |
| font sizes      | `--text-gt-*`        | `text-gt-sm`               |
| font weights    | `--font-weight-gt-*` | `font-gt-medium`           |
| shadows         | `--shadow-gt-*`      | `shadow-gt-md`             |
| easing          | `--ease-gt-*`        | `ease-gt-standard`         |

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

## Runtime rebrand

`@global-torque/design-tokens/derive` exports `deriveBrand`, the function the
build uses to turn the five color seeds into the `primary-*`, `secondary-*` and
`tertiary-*` steps: the subtle tint at 50, the seed at 500, the readable
`foreground`, and for `tertiary-*` the tints 100 to 300 (10%, 20%, 30% of the
seed into the light surface) and the shades 600 and 800 (10% and 45% black into
the seed).
A rebrand at runtime writes the seeds as `--brand-*` on the root element and
stops there: the generated CSS derives every accent step from them with
`color-mix()`, and the alias chain carries the new values down to the semantic
and component variables. A stylesheet that declares the seeds is enough; no
rebuild and no derivation in JavaScript are required. The three
`--brand-*-foreground` seeds default to the surface seeds; set them only to
override that pairing.

The neutral steps follow the two surface seeds as well. Each `grey-*`,
`neutral-*`, `steel-*`, `slate-*`, `navy-*`, and `charcoal-*` step keeps a
fixed per-channel offset from one of the two default seeds: steps with a
CIE lightness of 40 or more (fills, borders, secondary text) from
`--brand-surface-light`, darker ones (strong text, dark surfaces) from
`--brand-surface-dark`. The generated CSS re-declares each step as that seed
shifted by its offset, for example
`rgb(from var(--brand-surface-light) calc(r - 22) calc(g - 19) calc(b - 16))`
for `grey-200`, so the default seeds give back the dictionary values exactly and
a tinted seed tints every neutral role. In light mode `background-surface` and
`background-elevated` resolve to `--brand-surface-light` itself. The
re-declaration sits in an `@supports` block that requires relative color syntax
and `round()`; other browsers keep the dictionary values, as do the JavaScript
and JSON exports. `getPropertyValue()` returns the formula, not a color, for a
derived step and for any variable that aliases one, such as
`--gt-color-border-default`; read a painted property such as `color` instead,
which can serialize as `color(srgb ...)`.

Where that block applies, gradients and running color transitions that use a
derived step, directly or through an alias, blend in Oklab rather than sRGB,
even at the default seeds. To keep sRGB in a gradient, repeat it after the
original declaration with `in srgb`, inside
`@supports (background: linear-gradient(in srgb, transparent, transparent))`;
unguarded, an engine without `in srgb` still accepts a `var()` value and then
paints no gradient.

```js
const { style } = document.documentElement;
style.setProperty('--brand-primary', '#004fff');
style.setProperty('--brand-secondary', '#3ddc97');
style.setProperty('--brand-tertiary', '#5b55d6');
style.setProperty('--brand-surface-light', '#ffffff');
style.setProperty('--brand-surface-dark', '#12161f');
style.setProperty('--brand-radius', '0.5rem');
style.setProperty('--brand-font-sans', 'Avenir, sans-serif');
```

`deriveBrand` computes the same steps as hex, for a host that needs the values
in JavaScript rather than in CSS.

```js
import { deriveBrand } from '@global-torque/design-tokens/derive';

const steps = deriveBrand({
  primary: '#004fff',
  secondary: '#3ddc97',
  tertiary: '#5b55d6',
  surfaceLight: '#ffffff',
  surfaceDark: '#12161f',
});
```

The function is pure and throws on a seed that is not a six-digit hex color.

## Token architecture

- `primitive` contains the `brand` seeds, the accent steps derived from them
  (`primary-50/-500/-foreground`, `secondary-50/-500/-foreground` and
  `tertiary-50/-100/-200/-300/-500/-600/-800/-foreground`), the neutral steps
  that follow the surface seeds, the fixed system palette, the fixed status
  colors, the fixed elevations of the surfaces, and the spacing, radius, font,
  shadow, duration, and easing values.
- `semantic.light` and `semantic.dark` assign accessible interface meaning,
  including canvas/surface/overlay, foregrounds, borders/focus, accent,
  accent-secondary, accent-subtle, the positive/negative/neutral/warning tint
  pairs, the negative solid pair, and chart-1 to chart-5.
- `component.light` and `component.dark` alias semantic values for button,
  input, dialog, toast, disabled, hover, and focus states.

A handful of derived steps are held as fixed values and carry a `$description`
saying so; a rebrand does not move them.

Light and dark semantic/component token paths must have exact type parity. The
generator rejects any missing counterpart. Generated files live only in
`dist`; edit `src/tokens.tokens.json`, never a generated representation.

## Contrast

The build does not gate contrast. The generator checks structure, references,
modes, and typed values only, and carries the fixed system colors as written.
A host owns contrast acceptance for the pairs it actually paints.

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

`browser:install` installs the Chromium binary pinned to Playwright 1.63.0 and
its Linux system dependencies. It is required on a clean CI/cache image before
`test:run` or `test:coverage`.
`test:tailwind:current` performs a mutable npm lookup and is intentionally
limited to the scheduled informational compatibility workflow; release gates
use only the exact lockfile dependency.
The test matrix validates DTCG structure and aliases, deterministic generation,
deep runtime freezing, CSS/JSON/JS/declaration/source-map parity, both explicit
modes, browser theme activation, brand derivation, and real Tailwind
compilation against both supported targets. Release automation must
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
  '#1a202d',
);
assert.equal(
  resolvedTokens.modes.dark.semantic.color['background-surface'],
  '#1a202d',
);
assert.match(sourceTokens.$description, /Neutral institutional/u);
assert.match(cssUrl, /\/index\.css$/u);
assert.match(themeUrl, /\/theme\.css$/u);
```

## Migration and rollback

The 0.1 beta intentionally replaces the earlier handwritten maps and variable
catalog. Concrete common mappings are:

| Before                          | 0.1 beta replacement                                            |
| ------------------------------- | --------------------------------------------------------------- |
| `colorTokens.surface`           | `designTokens.modes.light.semantic.color['background-surface']` |
| `colorTokens.text`              | `designTokens.modes.light.semantic.color['foreground-default']` |
| `spacingTokens.lg`              | `designTokens.primitive.spacing['4']`                           |
| `radiusTokens.md`               | `designTokens.primitive.radius.md`                              |
| `typographyTokens.weightMedium` | `designTokens.primitive['font-weight'].medium`                  |
| Type `DesignTokens`             | Type `ResolvedDesignTokens`                                     |
| `--gt-color-surface`            | `--gt-color-background-surface`                                 |
| `--gt-color-text`               | `--gt-color-foreground-default`                                 |
| `--gt-space-lg`                 | `--gt-primitive-spacing-4`                                      |
| Tailwind `bg-gt-surface`        | `bg-gt-background-surface`                                      |
| Tailwind `text-gt-text`         | `text-gt-foreground-default`                                    |
| Tailwind `@theme` import        | `@global-torque/design-tokens/theme` (`@theme inline`)          |

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
canonical DTCG file (never `dist`), include generator/parity regression tests,
regenerate API docs and reports, add a changelog and migration note for
public-name changes, and pass every development/release command above. A
maintainer must review generated diffs and the exact packed artifact before a
beta is accepted.

## Security and support

Use GitHub issues for ordinary compatibility requests and GitHub private
vulnerability reporting for security concerns. Do not put customer data,
credentials, unpublished vulnerabilities, private URLs, or product-specific
theme decisions in public issues or token values. See `SECURITY.md` for the
supported-version and response policy.
