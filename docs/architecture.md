# Architecture

Samepage is a filesystem layout plus a process launcher. It contains no HTTP client, credential parser, proxy, model API, or automatic rotation logic.

## State and launch

The management directory is `~/.claude-samepage`, or `CSP_HOME`. Its `config.json` records profile names, absolute configuration paths, the shared projects directory, an optional workspace, and the default profile. Treat this registry as private: its paths describe your local machine.

New profiles live in `profiles/<name>`. Their `projects/` entries point to `shared/projects/`. On Windows these are junctions, which do not require symlink creation privilege. On POSIX they are directory symlinks. Existing profiles can be adopted only if their project directory is already the canonical shared store, already links to it, or does not exist.

For each launch:

1. Resolve the profile root and verify its `projects/` target.
2. Resolve the pinned workspace or the current directory.
3. Reject environment variables that can override the selected claude.ai login.
4. Resolve the real Claude executable.
5. Exclusively create `.samepage-run.lock` inside the canonical shared projects directory.
6. Spawn Claude with separate arguments, inherited terminal I/O, and a child-only `CLAUDE_CONFIG_DIR`.
7. Wait for Claude to exit, forward its exit status, and release the lock created by this wrapper.

The parent shell's environment and directory never need to change. `login` uses exactly the same launcher with `auth login` arguments. Samepage does not collect, import, or export authentication tokens.

## What sharing means

The link makes files under `projects/` identical across profiles. This includes session JSONL files and default project auto memory. Claude decides how to find a workspace's sessions, reconstruct context, compact a long conversation, and load memory. An identical transcript store does not guarantee identical account entitlements, model behavior, or a byte-for-byte model context.

Workspace files are shared because profiles run in the same directory. This includes project instructions and project skills. User-level instructions, skills, plugins, settings, MCP account configuration, and `history.jsonl` remain separate. A customized `autoMemoryDirectory` may live outside `projects/` and is not changed.

The official documentation describes [configuration directories and login isolation](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts), [project memory location](https://code.claude.com/docs/en/memory), and [resume/continue flags](https://code.claude.com/docs/en/cli-reference). The shared directory link is Samepage's local layout convention; it is not a promise of upstream support for every future storage layout.

## Locks and limits

The writer lock lives at the resolved shared store, so two independent Samepage registries cannot launch simultaneous writers into it. Configuration mutations also acquire that lock. Registry updates use a second exclusive lock and an atomic rename of a uniquely named temporary file.

The run lock records its owner PID, child PID, host, time and a random ownership nonce. Ctrl+C is left to the interactive child; the wrapper keeps its lock until the child exits. SIGTERM is forwarded to the child. Crash locks are never automatically discarded. `unlock --stale` checks that recorded processes are gone on the same host and that the record has not changed. If the wrapper was killed in the tiny launch window before recording the child PID, recovery requires manual process inspection.

This lock does not cover direct `claude` launches, legacy aliases, extensions, or background agent processes that outlive the foreground Claude process. Use foreground sessions for handoff, close every writer, and do not use Claude's detached/background agent workflows against this shared store. Network filesystems and cross-machine concurrency are outside the supported setup.

Independent credentials are an account-layout property, not access control: both processes have your OS user's filesystem permissions. Do not combine stores whose contents must be kept separate, including organizations whose policies prohibit cross-account access to their data.

## Development verification

Tests create only synthetic transcripts, memory and credential placeholders in OS temporary directories. They exercise data preservation, canonical target identity, launch argument boundaries, child environment, exit codes, competing writers, and recovery refusal for live processes. They do not authenticate or call a model.

On the origin Windows machine, the pre-existing three-profile layout was inspected and the installed Claude native executable was resolved. Fixture checks establish launcher behavior. Actual resumed model generation remains a manual integration check. CI tests Windows, macOS and Linux with Node 22/24; check the CI badge for current results rather than inferring real-account validation from a green fixture suite.
