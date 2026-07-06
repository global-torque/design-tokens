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

A host admin stylesheet should import both files when the admin pilot validates
Tailwind output.

## Exports

- `@global-torque/design-tokens`
- `@global-torque/design-tokens/css`
- `@global-torque/design-tokens/theme`
- `@global-torque/design-tokens/tokens.json`

## Release Status

Prepare-next. Do not publish to npm until package-specific contracts,
attribution, admin consumer validation, and visual verification gates pass.

## Support

Use GitHub issues on `global-torque/design-tokens` for token naming, export
format, and compatibility requests. Product-specific theme decisions should stay
in the consuming application unless they expose a reusable token gap.

## Security

Report suspected vulnerabilities through the repository security policy in
`SECURITY.md`. This package should not contain secrets, private URLs, customer
data, or environment-specific values.

## Changelog And Versioning

Release notes live in `CHANGELOG.md`. The package stays in `0.x` while token
names, CSS variables, JSON output, and Tailwind theme exports are stabilized.
Breaking token rename/removal work may ship as minor `0.x` releases before a
stable `1.0` contract.

## Ownership And Feedback

Global Torque owns the public token contract and generated artifacts. Host apps
own theme composition, product palettes, and final accessibility validation.
Feedback should include the target consumer, export path, and whether the change
is a new semantic token or an app-local theme decision.
