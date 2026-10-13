# Contributing

Keep Same Page small, predictable, and careful with local data. A report from a new operating system is as useful as a new feature.

## Run locally

Use Node.js 22+. There are no runtime or development dependencies to install.

```sh
node bin/claude-samepage.mjs help
npm test
npm run audit:public
```

Use a temporary `CSP_HOME` when experimenting. Never test destructive migrations on your real profiles. Tests generate synthetic data in temporary directories and leave those fixtures available for inspection.

## Pull requests

- Explain the user-visible trigger and resulting behavior.
- Keep credentials independent and argument passing shell-free.
- Preserve existing directories; a refusal is better than guessing a merge.
- Add meaningful coverage for data preservation or process lifecycle changes.
- Update both READMEs when commands, sharing boundaries, or setup behavior change.
- Run the public-file audit against the actual staged/tracked file list before publishing.

The repository intentionally does not include login tokens, real transcripts, account IDs, real memory, or machine-specific absolute paths. Screenshots and demo assets must use synthetic content. Never post `auth status` output without removing account identity.

Useful next contributions: real-account platform verification, accessibility and wording improvements, and reproducible bug reports. Automatic quota rotation, credential extraction, or proxy infrastructure are outside the current project scope.
