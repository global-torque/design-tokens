# Changelog

## Unreleased

- Derived the grey, neutral, steel, slate, navy, and charcoal steps from the
  surface seeds: the generated CSS re-declares each step, inside an `@supports`
  block for relative color syntax and `round()`, as the nearer surface seed
  shifted by the step's fixed per-channel offset from the default seed. The
  default seeds give back every value exactly; browsers without that support
  keep the dictionary values.
- Behavior change for hosts that override `--brand-surface-light` or
  `--brand-surface-dark`: the neutral fills, borders, text, and dark surfaces,
  and the light `background-surface` and `background-elevated`, now move with
  the override instead of staying fixed.
- Pointed the light `background-surface` and `background-elevated` at
  `neutral-25`, the light surface seed, instead of `white`; the default seed
  keeps them white.
- Added the fixed `mint-100`, `mint-500`, and `mint-600` success colors, holding
  the default secondary values; a rebrand does not move them.
- Changed what `getPropertyValue()` returns for a derived neutral step: its
  formula rather than a hex value. Read a painted property such as `color` to
  get the color.

## 0.3.0 - 2026-09-19

- Added ten brand seeds under `primitive.brand`, emitted as `--brand-*`, as
  the build-time inputs a rebrand edits.
- Derived the primary, secondary, and tertiary accent steps from those seeds
  and added `tokens:derive` to rewrite them in the canonical source.
- Added the `./derive` entry point exporting `deriveBrand`, the same derivation
  the build runs, so a host can recolor at runtime.
- Emitted the derived accent steps as `color-mix()` of the brand seeds, so a
  host recolors by writing `--brand-*` alone, without a rebuild or JavaScript.
- Added fixed system colors and elevations alongside the derived steps; a
  handful of steps are held as fixed values and carry a `$description` saying a
  rebrand does not move them.
- Removed the contrast gate. Structure, reference, mode, and typed-value
  validation is unchanged; contrast acceptance now belongs to the host.
- Changed generated token values, including the dark surface.
- Removed the `line-height`, `letter-spacing`, `opacity`, `breakpoint`, and
  `animation` primitive families with their Tailwind namespaces, and reduced
  the `font-size` and `font-weight` scales to the steps in use.
- Added `accent-secondary`, `accent-subtle`, `background-sidebar`, the negative
  solid pair, and `chart-1` to `chart-5`; removed the `info` pair,
  `foreground-inverse`, `border-strong`, and `neutral-border`.
- Rewrote the source `$description` text so each one names what the value is
  and the kind of surface it serves.
- Update the development and SHA-pinned GitHub Actions toolchains, including
  Playwright 1.63.0 and matching Vitest/coverage 5.0.1.
- Keep TypeScript at 6.0.3 for the generator tests' compiler API, align Node
  declarations with Node 24 CI, and remove unused TypeScript ESLint packages.
- Separate major Dependabot updates from routine minor/patch updates and keep
  Vitest major upgrades paired with their coverage provider.
- Preserve generated token values, package exports, and runtime requirements.

## 0.2.1 - 2026-09-09

- Update build/documentation dependencies to patched `fast-uri` 3.1.6 and
  `js-yaml` 4.3.2, resolving five high-severity dependency advisories.
- Preserve generated token values, CSS, declarations and public API. These
  dependencies are development tools and are not shipped to consumers.

## 0.2.0 - 2026-08-31

- Promoted the verified `0.1.0-beta.5` contract to the first stable `0.2`
  release.
- Kept generated design-token values, supported imports, and runtime behavior
  unchanged from `0.1.0-beta.5`.
- Retained the security-remediated development toolchain and portable offline
  attestation workflow validated by the beta candidate.

## 0.1.0-beta.5 - 2026-08-31

- Fixed development-tooling advisories for PostCSS source-map disclosure,
  js-yaml and brace-expansion denial of service, fast-uri host confusion, and
  nanoid non-terminating custom generator inputs.
- Updated the supported lint, type, test, browser, Tailwind, API documentation,
  package-validation, package-manager, and GitHub Actions toolchain.
- Normalized the offline GitHub attestation bundle filename before artifact
  retention so the immutable candidate is portable across filesystems.
- Kept the generated design-token values and public package API unchanged.

## 0.1.0-beta.4 - Failed immutable candidate (2026-08-31)

- Passed package gates and attestation verification, then failed artifact
  retention because the downloaded attestation bundle contained a colon in its
  filename. This candidate must not be published or retagged.

## 0.1.0-beta.3 - 2026-07-13

- Restored the independently reviewed public source after the temporary
  default-branch quarantine and repinned CI to the current governance workflow.
- Minted a new prerelease identity so the superseded beta.2 candidate bytes are
  never reused for npm publication.

## 0.1.0-beta.2 - Superseded local candidate

- Prepared the independently reviewed DTCG source and deterministic generator for
  protected public `main` with SHA-pinned CI, public API governance,
  clean-source artifact manifests, and provenance workflow.
- Supersedes the dirty-tree beta.1 implementation artifact; beta.1 remains
  historical local evidence and must not be uploaded or retagged.
- Kept protected-tag CI reproducible on locked Tailwind 4.2.1 and moved the
  mutable latest-4.x compatibility probe to a scheduled informational job.

## 0.1.0-beta.1 - 2026-07-10

- Froze publication after the 0.2 audit invalidated earlier readiness claims.
- Replaced four handwritten representations with one DTCG 2025.10 source and a
  deterministic, atomic generator.
- Added primitive, semantic, and component/state layers with explicit light and
  dark modes, tabular-number typography, focus, disabled, overlay, and neutral,
  positive, negative, warning, and information states.
- Added deeply frozen typed JavaScript, exact declarations, resolved JSON, plain
  CSS, `@theme inline` Tailwind CSS, source maps, and the canonical source export.
- Renamed the generated object type from `DesignTokens` to
  `ResolvedDesignTokens`; the runtime export remains `designTokens`.
- Added enforced contrast pairs, strict DTCG/reference validation, Tailwind
  4.2.1/current-4.x compilation, API reports/docs, clean-room metadata, and
  deterministic parity tests.
- Removed the unverified security email address in favor of GitHub private
  vulnerability reporting.

## 0.0.0

- Added the superseded prepare-next handwritten token maps.
