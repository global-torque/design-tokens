# @global-torque/design-tokens

> [!CAUTION]
> This default-branch source is a quarantined pre-0.2 bridge, not an approved
> release candidate. Do not install it from GitHub, a branch, or npm. Use only
> a future immutable prerelease asset after its checksum, consumer evidence,
> and public release review are complete.

Prepare-next design token package for Global Torque admin and site consumers.

This package is reserved for public design tokens. It provides plain CSS custom
properties, a Tailwind CSS v4 `@theme` entrypoint, a JSON token map, and a typed
TS token map. It does not depend on Vue, Pinia, router state, app routes,
investment packages, or private runtime config.

## Installation Status

There is no supported installation command for this source revision. Mutable
GitHub dependencies and default-branch installs are prohibited. Wait for an
approved immutable prerelease asset and its published integrity evidence.

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

Host applications should import both files only after validating the approved
immutable artifact in their own Tailwind build.

## Exports

- `@global-torque/design-tokens`
- `@global-torque/design-tokens/css`
- `@global-torque/design-tokens/theme`
- `@global-torque/design-tokens/tokens.json`

## Release Status

Prepare-next. Do not publish to npm until package-specific contracts,
attribution, admin consumer validation, and visual verification gates pass.
