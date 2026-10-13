# @global-torque/design-tokens

> **Next release:** `0.5.0` is not released yet. It adds purpose names, such as
> `--body-foreground` and `--flow-accent`, for product uses that the shadcn
> variables do not cover. It removes 40 unused `--gt-primitive-*` values, so it
> does not drop in for a host that reads one of them directly. The
> [changelog](./CHANGELOG.md) lists every removed value.

Neutral institutional design tokens for administrative and content interfaces.
One DTCG 2025.10 source, `src/tokens.tokens.json`, builds one plain CSS
stylesheet. The build fails on a reference to a missing token.

Brand values enter as seven seeds under `primitive.brand`, emitted as
`--brand-*`. The primary, secondary, and tertiary accent steps are derived from
them; the dictionary also holds fixed system colors and elevations that a
rebrand does not move. The seeds are build-time inputs: edit `primitive.brand`
and rebuild. A host can also recolor at runtime by setting the seeds in CSS
(see [Runtime rebrand](#runtime-rebrand)).

The package contains no Vue code, runtime mode detection, media-query theme
activation, routes, environment reads, or private URLs.

## Install

Install the tarball attached to the GitHub release:

```sh
pnpm add https://github.com/global-torque/design-tokens/releases/download/v0.5.0/global-torque-design-tokens-0.5.0.tgz
```

The package ships only the stylesheet, at `@global-torque/design-tokens/css`.
The repository does not commit `dist/`, so install a release tarball. Pushing a
`vX.Y.Z` tag that equals the `package.json` version runs `pnpm run ci`, which
builds and packs the package, and attaches the tarball to a GitHub release.

CI and the release workflow run on Node 24.
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
}
```

`:root` declares the 34 standard shadcn variables: `--background` and
`--foreground`; `--card`, `--popover`, `--primary`, `--secondary`, `--muted`,
`--accent`, and `--destructive`, each with its `-foreground`; `--border`,
`--input`, `--ring`, and `--chart-1` to `--chart-5`; `--sidebar` and its seven
`--sidebar-*` variables; `--radius` and `--font-sans`. It also declares the
`--success`, `--warning`, and `--info` pairs, the purpose names listed under
[Variables](#variables), the `--brand-*` seeds, and the `--gt-primitive-*`
palette. There is one set of values and no dark mode.

## Tailwind CSS v4

`@global-torque/design-tokens/css` is the only source of these values.
`@global-torque/ui-primitives/styles/theme` maps them for Tailwind and declares
none, so the two can be imported in either order. A tenant stylesheet that sets
only the `--brand-*` seeds goes last.

```css
@import 'tailwindcss';
@import '@global-torque/ui-primitives/styles/theme';
@import '@global-torque/design-tokens/css';
```

The package ships no Tailwind entry point. A shadcn host maps the shadcn
variables in its own `@theme inline` block, for example
`--color-primary: var(--primary)`. `@global-torque/ui-primitives/styles/theme`
maps the standard set and the status pairs; a host without it maps the status
pairs the same way:

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

## Runtime rebrand

The five color seeds drive the `primary-*`, `secondary-*` and `tertiary-*`
steps: the seed at 500, the readable `foreground`, and a shade at 600.
`primary-*` and `tertiary-*` also have the subtle tint at 50, and `tertiary-*`
the tints 100 to 300 (10%, 20%, 30% of the seed into the light surface) and the
shade 800. The tertiary shades 600 and 800 mix 10% and 45% black into the seed.
A rebrand at runtime writes the seeds as `--brand-*` on the root element and
stops there: the generated CSS derives every accent step from them with
`color-mix()`, and the alias chain carries the new values down to the shadcn
variables. A stylesheet that declares the seeds is enough; no
rebuild and no derivation in JavaScript are required. The three
`--brand-*-foreground` seeds default to the surface seeds; set them only to
override that pairing.

The neutral steps follow the two surface seeds as well. Each `grey-*`,
`neutral-*`, `steel-*`, `navy-*`, and `charcoal-*` step keeps a
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
and `round()`; other browsers keep the dictionary values. `getPropertyValue()`
returns the formula, not a color, for a derived step and for any variable that
aliases one, such as `--border`; read a painted property such as `color`
instead, which can serialize as `color(srgb ...)`.

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

## Token architecture

- `primitive` contains the `brand` seeds, the accent steps derived from them
  (`primary-50/-500/-600/-foreground`, `secondary-100/-500/-600/-foreground` and
  `tertiary-50/-100/-200/-300/-500/-600/-800/-foreground`), the neutral steps
  that follow the surface seeds, the fixed system palette, the fixed status
  colors, the fixed elevations of the surfaces, and the radius and font values.
- `semantic` is one flat group: the standard shadcn variables, the `success`,
  `warning`, and `info` pairs, and the purpose names. Each token aliases a
  primitive and is emitted as `--<name>`. `radius` and `radius-control` are
  dimensions, `font-sans` is a font family, the three `*-shadow` names are
  shadows, and the rest are colors. The accent and neutral variables follow the
  seeds through their primitives. The status fills, `destructive`, `chart-3` to
  `chart-7`, and the purpose names marked Fixed under [Variables](#variables)
  are fixed values that a rebrand does not move.

This package owns the shadcn variable names and the purpose names: they are its
semantic layer, so a host does not bind them to the package in its own
stylesheet. Other product aliases belong in the host stylesheet.

A handful of derived steps are held as fixed values and carry a `$description`
saying so; a rebrand does not move them.

Edit `src/tokens.tokens.json` directly; this repository does not commit
generated build output.

## Variables

The `--brand-*` seeds are the inputs a tenant sets. Every other variable aliases
a palette value in `src/tokens.tokens.json`, so it either follows a seed or
stays fixed when the brand changes. The grey, neutral, and steel steps follow a
surface seed through the offsets that [Runtime rebrand](#runtime-rebrand)
describes.

| Seed                           | What it sets                                                                                                                                                                                                                                                                                                                                                               | Default                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `--brand-primary`              | `--primary`, `--accent`, `--accent-foreground`, `--ring`, `--chart-1`, `--chart-8`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-accent-foreground`, and `--sidebar-ring`                                                                                                                                                                                           | `#004fff`                 |
| `--brand-primary-foreground`   | `--primary-foreground` and `--sidebar-primary-foreground`                                                                                                                                                                                                                                                                                                                  | `--brand-surface-light`   |
| `--brand-secondary`            | `--secondary`, `--chart-2`, and `--chart-9`                                                                                                                                                                                                                                                                                                                                | `#3ddc97`                 |
| `--brand-secondary-foreground` | `--secondary-foreground`                                                                                                                                                                                                                                                                                                                                                   | `--brand-surface-dark`    |
| `--brand-tertiary`             | `--flow-accent`, `--flow-accent-strong`, `--flow-accent-subtle`, `--flow-ring`, `--flow-info`, `--flow-illustration`, and `--flow-illustration-dark`                                                                                                                                                                                                                       | `#5b55d6`                 |
| `--brand-tertiary-foreground`  | `--flow-accent-foreground`                                                                                                                                                                                                                                                                                                                                                 | `--brand-surface-light`   |
| `--brand-surface-light`        | `--background`, `--card`, `--popover`, and the light neutral steps behind `--muted`, `--muted-foreground`, `--border`, `--input`, `--sidebar`, `--sidebar-border`, `--disabled-foreground`, `--border-strong`, `--upload-foreground`, `--upload-border`, `--flow-description`, `--flow-muted-foreground`, `--flow-label`, `--flow-pending-foreground`, and `--flow-border` | `#ffffff`                 |
| `--brand-surface-dark`         | `--foreground`, `--card-foreground`, `--popover-foreground`, `--sidebar-foreground`, `--success-foreground`, `--warning-foreground`, and the dark neutral steps behind `--body-foreground`, `--meta-foreground`, and `--flow-foreground`                                                                                                                                   | `#12161f`                 |
| `--brand-radius`               | `--radius`                                                                                                                                                                                                                                                                                                                                                                 | `0.5rem`                  |
| `--brand-font-sans`            | `--font-sans`                                                                                                                                                                                                                                                                                                                                                              | Avenir, then system fonts |

| Variable                                                                                                                                     | What it is for                                                      | Follows                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `--background` / `--foreground`                                                                                                              | Page background and default text                                    | The surface seeds                                                                         |
| `--card` / `--card-foreground`                                                                                                               | Card surface and its text                                           | The surface seeds                                                                         |
| `--popover` / `--popover-foreground`                                                                                                         | Menus, dropdowns, popovers, and dialogs, and their text             | The surface seeds                                                                         |
| `--primary` / `--primary-foreground`                                                                                                         | Main fill, such as a primary button, and its text                   | `--brand-primary` / `--brand-primary-foreground`                                          |
| `--secondary` / `--secondary-foreground`                                                                                                     | Second fill, such as a secondary button, and its text               | `--brand-secondary` / `--brand-secondary-foreground`                                      |
| `--muted` / `--muted-foreground`                                                                                                             | Quiet surface, and secondary text such as captions and placeholders | `--brand-surface-light`                                                                   |
| `--accent` / `--accent-foreground`                                                                                                           | Hover and selected backgrounds, such as menu items, and their text  | `--brand-primary`                                                                         |
| `--destructive` / `--destructive-foreground`                                                                                                 | Errors and destructive actions, and text on that fill               | Fixed: `scarlet-400` and white                                                            |
| `--border`                                                                                                                                   | Borders and dividers                                                | `--brand-surface-light`                                                                   |
| `--input`                                                                                                                                    | Form field borders                                                  | `--brand-surface-light`                                                                   |
| `--ring`                                                                                                                                     | Focus ring                                                          | `--brand-primary`                                                                         |
| `--chart-1` to `--chart-5`                                                                                                                   | Chart series colors                                                 | `--brand-primary`, `--brand-secondary`, then fixed `gold-500`, `grape-500`, `scarlet-500` |
| `--sidebar` / `--sidebar-foreground`                                                                                                         | Sidebar surface and its text                                        | The surface seeds                                                                         |
| `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` | The sidebar's own `--primary`, `--accent`, `--border`, and `--ring` | The same seeds as those variables                                                         |
| `--radius`                                                                                                                                   | Base corner radius. A host scales its radius steps from it.         | `--brand-radius`                                                                          |
| `--font-sans`                                                                                                                                | Base font family                                                    | `--brand-font-sans`                                                                       |
| `--success` / `--success-foreground`                                                                                                         | Success fill, such as a badge or an alert, and its text             | Fixed `mint-500` / `--brand-surface-dark`                                                 |
| `--warning` / `--warning-foreground`                                                                                                         | Warning fill and its text                                           | Fixed `gold-500` / `--brand-surface-dark`                                                 |
| `--info` / `--info-foreground`                                                                                                               | Info fill and its text                                              | Fixed: `grape-500` and white                                                              |

The purpose names below cover product uses that the shadcn variables do not,
such as multi-step flows and file uploads. A host reads them instead of a
`--gt-primitive-*` value. Each table is one group of names.

| Neutral text and borders                  | What it is for                                        | Follows                 |
| ----------------------------------------- | ----------------------------------------------------- | ----------------------- |
| `--body-foreground`                       | Strong body text                                      | `--brand-surface-dark`  |
| `--meta-foreground`                       | Metadata and secondary detail text                    | `--brand-surface-dark`  |
| `--disabled-foreground`                   | Disabled text                                         | `--brand-surface-light` |
| `--border-strong`                         | Stronger borders, such as a dashed field or a divider | `--brand-surface-light` |
| `--upload-foreground` / `--upload-border` | File upload field text and its border                 | `--brand-surface-light` |

| Flow                                                                              | What it is for                                                                      | Follows                                              |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `--flow-foreground`                                                               | Text of a multi-step flow, such as a crypto investment or a wallet upgrade          | `--brand-surface-dark`                               |
| `--flow-description`                                                              | Flow description text                                                               | `--brand-surface-light`                              |
| `--flow-muted-foreground`                                                         | Muted flow text, such as help text, captions, and subtitles                         | `--brand-surface-light`                              |
| `--flow-label`                                                                    | Flow detail labels                                                                  | `--brand-surface-light`                              |
| `--flow-pending-foreground`                                                       | Text of a pending flow step                                                         | `--brand-surface-light`                              |
| `--flow-border`                                                                   | Flow borders, step connectors, and code field borders                               | `--brand-surface-light`                              |
| `--flow-accent` / `--flow-accent-foreground`                                      | Flow accent, such as the active step marker, and text on that fill                  | `--brand-tertiary` / `--brand-tertiary-foreground`   |
| `--flow-accent-strong`                                                            | Stronger flow accent for link text, action fills, and spinners                      | `--brand-tertiary`                                   |
| `--flow-accent-subtle`                                                            | Light flow accent for spinner tracks, info borders, and captions on the accent fill | `--brand-tertiary`                                   |
| `--flow-ring`                                                                     | Ring around the active flow step                                                    | `--brand-tertiary`                                   |
| `--flow-info`                                                                     | Flow info panel background                                                          | `--brand-tertiary`                                   |
| `--flow-illustration` / `--flow-illustration-dark`                                | Flow illustration accent, and the dark start of its gradient                        | `--brand-tertiary`                                   |
| `--flow-success` / `--flow-success-foreground`                                    | Flow success accent, such as a completed step, and the completed step text          | Fixed `jade-600` / `jade-700`                        |
| `--flow-success-tint`                                                             | Completed flow step background                                                      | Fixed `jade-100`                                     |
| `--flow-success-background` / `--flow-success-border`                             | Flow success panel background and border                                            | Fixed `jade-50` / `jade-300`                         |
| `--flow-error-foreground` / `--flow-error-border`                                 | Flow error text and error panel border                                              | Fixed `scarlet-900` / `scarlet-300`                  |
| `--flow-otp-error-foreground`                                                     | Error text of a flow one-time code field                                            | Fixed `scarlet-800`                                  |
| `--flow-warning-background`, `--flow-warning-border`, `--flow-warning-foreground` | Flow warning panel background, border, and text                                     | Fixed `citrine-50`, `citrine-300`, and `citrine-800` |
| `--flow-card-shadow`                                                              | Flow card elevation                                                                 | Fixed `shadow-card`                                  |

| Status outside flows                                         | What it is for                                                       | Follows                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------- |
| `--error-foreground`, `--error-background`, `--error-border` | Error text, error panel or notice background, and error panel border | Fixed `scarlet-700`, `scarlet-50`, and `scarlet-600` |
| `--positive-foreground`                                      | Text of a positive value, such as a gain                             | Fixed `green-800`                                    |
| `--positive-background`                                      | Tint behind a positive status                                        | Fixed `mint-100`                                     |
| `--warning-background`                                       | Tint behind a warning status                                         | Fixed `gold-50`                                      |

| Risk                                                          | What it is for                                                            | Follows                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `--risk-low`, `--risk-moderate`, `--risk-high`, `--risk-info` | Levels of a four-step risk rating: low, moderate, high, and informational | Fixed `emerald-500`, `yellow-500`, `red-500`, and `blue-500` |

| Effects           | What it is for                                 | Follows                     |
| ----------------- | ---------------------------------------------- | --------------------------- |
| `--scrim`         | Translucent layer over an image while it loads | Fixed `scrim`, black at 30% |
| `--row-shadow`    | Table row elevation                            | Fixed `shadow-row`          |
| `--notice-shadow` | Inline notice elevation                        | Fixed `shadow-notice`       |

| Charts                     | What it is for                             | Follows                                                                                      |
| -------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `--chart-6` to `--chart-9` | More chart series colors after `--chart-5` | Fixed `scarlet-400` and `gold-400`, then shades of `--brand-primary` and `--brand-secondary` |

| Radius             | What it is for                  | Follows     |
| ------------------ | ------------------------------- | ----------- |
| `--radius-control` | Small corner radius of controls | Fixed `2px` |

Put text on a fill in that fill's `-foreground` variable. Do not use a fill
color, such as `--success`, as a text color, because it fails contrast.

## Contrast

The build does not gate contrast. It checks only that every reference names an
existing token, and it carries the fixed system colors as written.
A host owns contrast acceptance for the pairs it actually paints.

## Development

```sh
pnpm run ci
pnpm run prepack
```

`pnpm run ci` checks source formatting and lints the build script, then builds
and packs the package into `release/`. `pnpm run prepack` builds `dist/` alone.

## Migration and rollback

`0.4.0` replaces the `--gt-color-*` roles and the `--gt-component-*` tokens
with the shadcn variables. A replacement gives the value its role had in the
light set; the [changelog](./CHANGELOG.md) lists every removed name, including
those with no replacement. Common moves:

| Before                               | `0.4.0`                                    |
| ------------------------------------ | ------------------------------------------ |
| `--gt-color-background-canvas`       | `--background`                             |
| `--gt-color-background-surface`      | `--card`                                   |
| `--gt-color-foreground-default`      | `--foreground`                             |
| `--gt-color-border-default`          | `--border`                                 |
| `--gt-color-accent-background`       | `--primary`                                |
| `--gt-component-input-border`        | `--input`                                  |
| Tailwind `bg-gt-background-surface`  | `bg-card`, from the host's `@theme inline` |
| `@global-torque/design-tokens/theme` | removed                                    |
| The JavaScript and JSON entry points | removed: read the CSS variables            |

There is no dark set: `.dark` or `[data-theme="dark"]` no longer changes any
value. This package now owns the shadcn variable names; other product aliases
belong in the host stylesheet, not this package.

To roll back, install the last known-good release tarball and revert only the
consumer token import. Ship any correction as a new version; never replace or
retag a released tarball. The CSS variables are public API and receive
breaking-change treatment.

## Ownership and contributing

Global Torque Design Systems maintain the source tokens. Propose changes in
GitHub issues or pull requests and run `pnpm run ci` before review.

## Security and support

Use GitHub issues for ordinary compatibility requests and GitHub private
vulnerability reporting for security concerns. Do not put customer data,
credentials, unpublished vulnerabilities, private URLs, or product-specific
theme decisions in public issues or token values. See `SECURITY.md` for the
supported-version and response policy.
