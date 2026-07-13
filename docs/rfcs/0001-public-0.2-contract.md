# RFC 0001: Public 0.2 contract

- Status: Proposed
- Target: `0.1.0-beta.3`
- Last updated: 2026-07-13

## External problem

Framework-neutral consumers need one validated DTCG source with deterministic JavaScript, declarations, JSON, plain CSS, and Tailwind CSS v4 outputs.

## Public surface

The supported imports are `.`, `./tokens`, `./css`, `./theme`, `./tokens.json`, and `./source`. Exports are ESM-only ES2022 with
declarations and Node.js 22 or newer. Undeclared deep imports are private.

## Non-goals

Runtime theme detection, product palettes, Vue components, routes, app assets, and Tailwind content scanning policy remain outside this package.

## Compatibility and release evidence

Plain CSS and Tailwind fixtures plus i-djadmin must consume the exact candidate; light/dark semantic pairs and visual states must pass before promotion.

The candidate is built and packed once from a clean protected source commit.
The npm-format tarball, SHA-512 digest, per-file manifest, source commit, and
GitHub attestation remain immutable. A failed candidate receives a new beta
version; no tag or asset is replaced.

## Decision

Accept this contract only after the source pull request, API report, package
tests, clean rooms, and named-consumer evidence have no unresolved actionable
findings.
