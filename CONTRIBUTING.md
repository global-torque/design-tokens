# Contributing

Use an issue or RFC before making a public API change. Keep pull requests
focused, update user-facing documentation, and record compatibility or security
impact explicitly.

## Developer Certificate of Origin

Every commit must include a `Signed-off-by` trailer certifying the Developer
Certificate of Origin 1.1. Sign commits with:

```sh
git commit -s
```

By signing off, you certify that you wrote the contribution or otherwise have
the right to submit it under the repository license. The full certificate is
available at <https://developercertificate.org/>.

## Pull requests

1. Branch from the protected default branch.
2. Install the package manager version declared by `packageManager`.
3. Run the repository's `pnpm run ci` command.
4. Explain public API, compatibility, privacy, and supply-chain impact.
5. Keep source token changes focused and run `pnpm run ci` before opening a pull request.

Security reports must use GitHub private vulnerability reporting, not a public
issue.
