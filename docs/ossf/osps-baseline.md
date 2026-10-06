# OpenSSF baseline review

Review date: 2026-07-11

This source repository applies the OSPS baseline proportionately to a small
design-token library.

Implemented controls:

- protected `master` with pull-request, CODEOWNERS, conversation-resolution,
  linear-history, no-force-push, and no-deletion rules;
- protected immutable `v*` tags;
- least-privilege, SHA-pinned GitHub Actions;
- Node 24 required CI;
- dependency review, Dependabot, secret scanning, push protection, and
  private vulnerability reporting;
- source-only formatting, linting, TypeScript checks, and tests.

GitHub Releases retain published archives. Generated build output and API
reports are intentionally not committed to this repository.
