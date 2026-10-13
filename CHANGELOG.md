# Changelog

## 0.2.0 — 2026-10-14

- Renamed the project to **Claude Same Page**, with repository/package name `claude-same-page`. `csp`, the legacy command alias, existing registry paths, and writer-lock names remain compatible.
- Added `csp usage [NAME] [--json]` for offline, read-only queries of independent per-profile usage caches. Shows raw percentages, reset times, cache age, and passed reset times without reading credentials or starting Claude.
- Added a packaged standalone status-line example that receives Claude's usage fields through stdin and writes only the profile's usage cache. No network requests or credential reads.
- Added Chinese and English cache prerequisites, installation/configuration steps, first-response instructions, schema, troubleshooting, and upgrade instructions.
- Added six synthetic tests for cache privacy, independent profiles, preservation, data validation, and the documented producer workflow. Real account caches are excluded from publication.

## 0.1.1 — 2026-10-14

- Language selection and Chinese/English summaries now appear first.
- The main README contains full Chinese documentation followed by full English documentation; standalone guides are available in both languages.
- The primary install command uses the tested release tarball instead of a Git install that failed in the origin machine's npm environment.
- CI now checks that the packed package installs and its executable runs.

## 0.1.0 — 2026-10-14

First public release, based on a working Windows three-account Claude Code layout.

- Independent named profiles, official login, and a common project transcript/memory store.
- Windows junctions and POSIX symlinks without runtime dependencies.
- `run`, `continue`, `resume`, default profile selection, and optional pinned workspace.
- Existing-directory preservation and target verification before launch.
- A shared writer lock, child-process exit forwarding, and conservative stale-lock recovery.
- Windows native executable resolution and shell-free argument forwarding.
- English/Chinese guides, synthetic demo, public-file audit, and platform fixture CI.

Verification: local Windows fixture suite and Claude executable resolution. Authenticated model generation is not an automated test. Platform CI checks synthetic launcher behavior.
