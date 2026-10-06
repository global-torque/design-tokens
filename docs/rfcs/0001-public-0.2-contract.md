# RFC 0001: Public 0.2 contract

- Status: Accepted
- Target: `0.2.0`
- Last updated: 2026-08-31

## External problem

Consumers need one validated DTCG source for the design tokens.

## Public surface

The source of truth is the `src/` directory. Versioned GitHub Release archives
provide historical packaged artifacts where needed.

## Non-goals

Runtime theme detection, product palettes, Vue components, routes, app assets, and Tailwind content scanning policy remain outside this package.

## Compatibility and release evidence

Pull requests must pass the source-only CI checks.

## Decision

This document records the move to a source-only repository. Generated output,
API reports, and custom release verification are no longer maintained here.
