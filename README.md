# @global-torque/design-tokens

Prepare-next design token package for Global Torque admin and site consumers.

This package is reserved for public design tokens. It provides plain CSS custom
properties, a Tailwind CSS v4 `@theme` entrypoint, a JSON token map, and a typed
TS token map. It does not depend on Vue, Pinia, router state, app routes,
investment packages, or private runtime config.

## Install

```sh
pnpm add @global-torque/design-tokens
```

## Plain CSS

```css
@import '@global-torque/design-tokens/css';

.status {
  color: var(--gt-color-success);
  border-radius: var(--gt-radius-md);
}
```

## Tailwind CSS v4

```css
@import '@global-torque/design-tokens/css';
@import '@global-torque/design-tokens/theme';
```

`../i-djadmin-web/assets/frontend/src/styles.css` should import both files when
the admin pilot validates Tailwind output.

## Exports

- `@global-torque/design-tokens`
- `@global-torque/design-tokens/css`
- `@global-torque/design-tokens/theme`
- `@global-torque/design-tokens/tokens.json`

## Release Status

Prepare-next. Do not publish to npm until package-specific contracts,
attribution, admin consumer validation, and visual verification gates pass.
