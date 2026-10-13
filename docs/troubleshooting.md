# Troubleshooting

Start with `csp doctor`. `--json` is convenient for local inspection, but redact paths before sharing its output.

## Claude is not found on Windows

Native Claude installs are launched directly. For the official npm install, Samepage finds the package's `bin/claude.exe` beside its npm shim. If your setup uses a custom wrapper, set `CSP_CLAUDE_BIN` to the actual `.exe`, not to a `.cmd`, `.bat`, or `.ps1` file. Samepage intentionally does not interpolate your prompts into shell commands.

## The wrong account appears

Use `csp run NAME -- auth status` locally, or `/status` within Claude. The result can contain your email and organization; do not paste it into a public issue. Confirm that each profile was logged into the intended account in the browser. Samepage itself does not inspect credentials.

API key, OAuth token, or third-party routing environment overrides are rejected by variable name before launch. Remove those variables in your shell before using claude.ai profiles. Account-routing configuration inside Claude settings can also affect behavior; inspect it locally. Claude Console sign-ins without an API key are not isolated by configuration directories according to the official docs.

## My old session is missing

Use the same working directory as before, or pin it with `init --workspace`. Then try `csp resume NAME` and select the exact session. If `continue` picked another recent session, use `csp resume NAME SESSION_ID`. Confirm every profile's `projects/` target with `doctor`. Per-profile command history is intentionally not shared.

If you adopted an existing setup, choose the original canonical `projects/` folder as the shared source. Samepage does not copy unrelated account histories into it. Restoring transcripts cannot restore files that Claude no longer saved or that were previously deleted.

## An existing projects directory blocks adoption

That is a preservation check. Samepage has not deleted or replaced it. Close all clients, back up the directories, and determine which history to keep. Either use the original `projects/` as `--shared-projects` with fresh secondary profiles, or do a reviewed migration outside this tool. Never blindly delete a directory to make the command pass.

## A lock remains after a crash

Close the previous wrapper and Claude session, then run `csp unlock --stale`. It preserves the lock if a recorded process still exists, belongs to another host, or the child PID was not captured. PID reuse can conservatively block removal. For an incomplete or damaged record, inspect the exact lock and running processes locally. Do not remove it while a Claude process is writing to the shared store.

## Memory or skills differ between accounts

Only default project auto memory under `projects/` is linked. Global `CLAUDE.md`, user-level skills, plugins, settings and explicit external memory directories remain per profile. Prefer project-level instructions and project-level skills in the common workspace where sharing is intended. Samepage does not turn off memory settings or rewrite permission settings.

## Switch back or stop using Samepage

Stop its running sessions. You can keep your profile directories and call Claude directly with the corresponding `CLAUDE_CONFIG_DIR`. The projects links remain valid while their shared target stays in place. Removing the launcher does not remove your accounts or conversations. `npm uninstall -g claude-samepage` removes only the installed package; back up local state before manually reorganizing any profile directories.
