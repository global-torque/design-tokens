# @global-torque/design-tokens

> **Stable release:** `0.4.0` emits the standard shadcn variables and the
> success, warning, and info pairs in place of the `--gt-color-*` roles and the
> `--gt-component-*` tokens, and removes the dark set and the `./theme` entry
> point, so it does not drop in over `0.3.0`. The
> [changelog](./CHANGELOG.md) maps every removed name.

Neutral institutional design tokens for administrative and content interfaces.
One DTCG 2025.10 source generates the typed JavaScript API, declarations,
resolved JSON, and plain CSS. The generator rejects invalid references, cycles,
and invalid typed values.

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
pnpm add @global-torque/design-tokens@0.4.0
```

Required and release-candidate CI run on Node 24.x.
The stylesheet targets browsers with CSS custom properties and `color-mix()`.

## Plain CSS

Import the variable definitions once:

```css
@import '@global-torque/design-tokens/css';

.panel {
  color: var(--card-foreground);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--gt-primitive-shadow-sm);
}
```

`:root` declares the 34 standard shadcn variables: `--background` and
`--foreground`; `--card`, `--popover`, `--primary`, `--secondary`, `--muted`,
`--accent`, and `--destructive`, each with its `-foreground`; `--border`,
`--input`, `--ring`, and `--chart-1` to `--chart-5`; `--sidebar` and its seven
`--sidebar-*` variables; `--radius` and `--font-sans`. It also declares the
`--success`, `--warning`, and `--info` pairs, the `--brand-*` seeds, and the
`--gt-primitive-*` palette. There is one set of values and no dark mode.

Both this stylesheet and `@global-torque/ui-primitives/styles/theme` declare
the shadcn variables on `:root` outside any cascade layer, so the later import
wins. Import the ui-primitives theme first and this package second; a tenant
stylesheet that sets only the `--brand-*` seeds goes last:

```css
@import '@global-torque/ui-primitives/styles/theme';
@import '@global-torque/design-tokens/css';
```

## Tailwind CSS v4

The package ships no Tailwind entry point. A shadcn host maps the shadcn
variables in its own `@theme inline` block, for example
`--color-primary: var(--primary)`, and `@global-torque/ui-primitives/styles/theme`
maps the standard set. Map the status pairs the same way when the theme does
not:

```css
@theme inline {
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
}
```

`bg-success text-success-foreground` and the other status utilities then paint
these variables. No Tailwind configuration file or plugin is required.

## Typed and JSON APIs

```ts
import designTokens from '@global-torque/design-tokens';

const background = designTokens.semantic.background;
const firstChart = designTokens.semantic['chart-1'];
```

`designTokens` is `{ primitive, semantic }`. `semantic` is flat and keyed by
each variable's name without its leading dashes; `primitive` holds the seeds
under `brand` and the palette and scales by category.
`@global-torque/design-tokens/tokens` is an explicit alias of the root typed
API. `designTokens` and every nested value are frozen at runtime and readonly in
the generated declaration, typed as `ResolvedDesignTokens`.

Node 22+, bundlers, and other import-attribute-aware tooling can consume both
JSON surfaces directly:

```js
import sourceTokens from '@global-torque/design-tokens/source' with { type: 'json' };
import resolvedTokens from '@global-torque/design-tokens/tokens.json' with { type: 'json' };

console.log(sourceTokens.$description);
console.log(resolvedTokens.semantic.background);
```

`./source` is canonical DTCG data; `./tokens.json` is the resolved, CSS-ready
representation. Serve the former as `application/design-tokens+json` when a
tool needs a media type.

The CSS subpath also has a JavaScript URL facade for libraries that load
stylesheets programmatically:

```js
import cssUrl, {
  stylesheet as namedCssUrl,
} from '@global-torque/design-tokens/css';

console.assert(cssUrl === namedCssUrl);
console.assert(cssUrl.endsWith('/index.css'));
```

Generated API references cover the [typed root](./docs/api/index.md) and the
[plain-CSS URL facade](./docs/api-css/index.md).

## Runtime rebrand

`@global-torque/design-tokens/derive` exports `deriveBrand`, the function the
build uses to turn the five color seeds into the `primary-*`, `secondary-*` and
`tertiary-*` steps: the subtle tint at 50, the seed at 500, the readable
`foreground`, and for `tertiary-*` the tints 100 to 300 (10%, 20%, 30% of the
seed into the light surface) and the shades 600 and 800 (10% and 45% black into
the seed).
A rebrand at runtime writes the seeds as `--brand-*` on the root element and
stops there: the generated CSS derives every accent step from them with
`color-mix()`, and the alias chain carries the new values down to the shadcn
variables. A stylesheet that declares the seeds is enough; no
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
a tinted seed tints every neutral role. `--background`, `--card`, and
`--popover` resolve to `--brand-surface-light` itself. The
re-declaration sits in an `@supports` block that requires relative color syntax
and `round()`; other browsers keep the dictionary values, as do the JavaScript
and JSON exports. `getPropertyValue()` returns the formula, not a color, for a
derived step and for any variable that aliases one, such as `--border`; read a
painted property such as `color` instead, which can serialize as
`color(srgb ...)`.

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
- `semantic` is one flat group: the standard shadcn variables and the
  `success`, `warning`, and `info` pairs. Each token aliases a primitive and is
  emitted as `--<name>`; `radius` is a dimension, `font-sans` a font family, and
  the rest are colors. The accent and neutral variables follow the seeds
  through their primitives. The status fills, `destructive`, and `chart-3` to
  `chart-5` are fixed system colors that a rebrand does not move.

This package owns the shadcn variable names: they are its semantic layer, so a
host does not bind them to the package in its own stylesheet. Other product
aliases belong in the host stylesheet.

A handful of derived steps are held as fixed values and carry a `$description`
saying so; a rebrand does not move them.

Generated files live only in `dist`; edit `src/tokens.tokens.json`, never a
generated representation.

## Contrast

The build does not gate contrast. The generator checks structure, references,
and typed values only, and carries the fixed system colors as written.
A host owns contrast acceptance for the pairs it actually paints.

## Development and release checks

```sh
pnpm run browser:install
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test:coverage
pnpm run docs:api
pnpm run api:check
pnpm run docs:check
pnpm run package:lint
```

`browser:install` installs the Chromium binary pinned to Playwright 1.63.0 and
its Linux system dependencies. It is required on a clean CI/cache image before
`test:run` or `test:coverage`.
The test matrix validates DTCG structure and aliases, deterministic generation,
deep runtime freezing, CSS/JSON/JS/declaration/source-map parity, the exact set
of variables on `:root`, brand seeds painted in a browser, and brand
derivation. Release automation must build once and use the same immutable
tarball bytes for npm and pnpm clean rooms, admin consumer validation, and
publication.

The packed clean-room smoke test is intentionally executable:

```js clean-room
import assert from 'node:assert/strict';
import cssUrl from '@global-torque/design-tokens/css';
import designTokens, {
  designTokens as namedTokens,
} from '@global-torque/design-tokens';
import sourceTokens from '@global-torque/design-tokens/source' with { type: 'json' };
import resolvedTokens from '@global-torque/design-tokens/tokens.json' with { type: 'json' };

assert.equal(designTokens, namedTokens);
assert.equal(Object.isFrozen(designTokens), true);
assert.equal(Object.isFrozen(designTokens.semantic), true);
assert.equal(designTokens.semantic.background, '#ffffff');
assert.equal(resolvedTokens.semantic.background, '#ffffff');
assert.match(sourceTokens.$description, /Neutral institutional/u);
assert.match(cssUrl, /\/index\.css$/u);
```

## Migration and rollback

`0.4.0` replaces the `--gt-color-*` roles and the `--gt-component-*` tokens
with the shadcn variables. A replacement gives the value its role had in the
light set; the [changelog](./CHANGELOG.md) lists every removed name, including
those with no replacement. Common moves:

| Before                                                          | `0.4.0`                                    |
| --------------------------------------------------------------- | ------------------------------------------ |
| `--gt-color-background-canvas`                                  | `--background`                             |
| `--gt-color-background-surface`                                 | `--card`                                   |
| `--gt-color-foreground-default`                                 | `--foreground`                             |
| `--gt-color-border-default`                                     | `--border`                                 |
| `--gt-color-accent-background`                                  | `--primary`                                |
| `--gt-component-input-border`                                   | `--input`                                  |
| `designTokens.modes.light.semantic.color['background-surface']` | `designTokens.semantic.card`               |
| Type `DesignTokenMode`                                          | removed                                    |
| Tailwind `bg-gt-background-surface`                             | `bg-card`, from the host's `@theme inline` |
| `@global-torque/design-tokens/theme`                            | removed                                    |

There is no dark set: `designTokens.modes` is gone, and `.dark` or
`[data-theme="dark"]` no longer changes any value. This package now owns the
shadcn variable names; other product aliases belong in the host stylesheet, not
this package.

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
