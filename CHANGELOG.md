# Changelog

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
