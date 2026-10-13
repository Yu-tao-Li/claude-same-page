[中文](README.zh-CN.md) | [English](README.en.md) | [中英双语 / Bilingual](README.md)

**中文摘要：** Claude Same Page 让多个 Claude Code 账号独立登录，共享本机对话记录与项目 memory。关闭当前会话后，用 `csp continue work` 从另一个账号接着工作；用 `csp usage` 离线查看各账号独立的额度缓存。Windows 使用 junction，零运行时依赖，不读取或复制凭证。

**English summary:** Claude Same Page keeps Claude Code sign-ins separate while sharing local conversations and project memory. Close the current session, then continue from another account with `csp continue work`. Check each account’s independent usage cache offline with `csp usage`. Windows-friendly, zero runtime dependencies, and no credential reads or copies.

<p align="center">
  <img src="assets/hero.svg" alt="Claude Same Page — Switch accounts. Stay on the same page." width="100%" />
</p>

<p align="center">
  <a href="https://github.com/Yu-tao-Li/claude-same-page/actions/workflows/ci.yml"><img src="https://github.com/Yu-tao-Li/claude-same-page/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-71e8b2?style=flat-square" alt="MIT" /></a>
  <img src="https://img.shields.io/badge/runtime_dependencies-0-71e8b2?style=flat-square" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/Node.js-22%2B-71e8b2?style=flat-square" alt="Node 22+" />
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/中文-说明-82b7ff?style=flat-square" alt="中文说明" /></a>
</p>

<h3 align="center">Different account. Same conversation. Same project memory.</h3>

Claude Code profiles keep logins apart. They also keep your sessions apart.
**Same Page reconnects the work:** separate account directories, one shared `projects/` directory, and a short command to pick up where you left off.

```text
csp run personal          → work on your project
                         → close that Claude session
csp continue work        → continue the latest session in the same workspace
```

**For your own Claude Code accounts on one machine.** Manual switching, official Claude login, local files. Born from a working three-account Windows setup.

## See the handoff

<p align="center"><img src="assets/demo.gif" alt="Offline demo: two profiles read and append to the same synthetic transcript and memory, while keeping separate synthetic credentials." width="900" /></p>

*The demo uses synthetic data and an offline fixture. It shows Same Page's local file sharing; it is not a recording of authenticated Claude generation.*

## Why Same Page?

| You want… | Same Page does… |
| --- | --- |
| A different account, without explaining everything again | Launches that profile with the shared transcript store; passes Claude's `--continue` / `--resume` |
| Project memory that follows the conversation | Shares the same `projects/<project>/memory/` files |
| Independent sign-ins | Sets `CLAUDE_CONFIG_DIR` for the child process; never copies credential files |
| A Windows setup that needs no symlink privilege | Uses directory junctions on Windows, directory symlinks on macOS/Linux |
| Safe handoff | One shared writer lock across all Same Page launchers using the same store |
| Compare cached account usage offline | Reads independent `statusline-usage.json` files and shows their update times |
| Confidence before adopting existing profiles | Refuses conflicting directories; `csp doctor` checks links without reading secrets |

## Start in a minute

Requirements: **Node.js 22+** and [Claude Code](https://code.claude.com/docs/en/setup) installed and available on PATH. Commands work in PowerShell, Bash, and Zsh. Install the packaged GitHub Release below; there is no npm-registry release yet.

Upgrading from 0.1.x? Run `npm uninstall -g claude-samepage` before installing the renamed package to avoid a `csp` executable conflict. Existing profiles and shared data need no migration; the management directory remains `~/.claude-samepage`.

```sh
npm install -g https://github.com/Yu-tao-Li/claude-same-page/releases/download/v0.2.0/claude-same-page-0.2.0.tgz

csp init
csp add personal
csp add work
csp login personal
csp login work
```

Claude handles both logins. In the browser, select the intended account each time. Then, from your project's directory:

```sh
csp run personal
# Close the first session before switching.
csp continue work
```

If the new profile asks for first-launch setup or workspace trust, complete that once. `continue` selects the latest session in that workspace. For a specific conversation, use its Claude session ID:

```sh
csp resume work
csp resume work YOUR_SESSION_ID
csp run work -- --model sonnet
csp continue work -- --model opus
```

### Always open the same workspace

For a dedicated chat or coding folder, pin it during initialization:

```powershell
csp init --workspace "D:\Work\MyProject"
```

Without `--workspace`, Same Page uses your current directory. With it, every profile starts in the pinned folder. Your parent shell's directory and environment remain unchanged.

### Already have accounts and conversations?

Close all Claude processes that use those profiles. Point Same Page at **the existing `projects/` folder you want to keep**, then register the profiles:

```powershell
csp init --shared-projects "D:\Profiles\personal\projects" --workspace "D:\Work\MyProject"
csp add personal --config "D:\Profiles\personal"
csp add work --config "D:\Profiles\work"
csp doctor
```

The second profile must have **no `projects/` directory**, or already link to that same shared store. If it has independent history, Same Page stops and preserves it. Back it up and choose a migration strategy first. There is no automatic merge, deletion, or credential import.

Use `CSP_HOME` for a second, completely separate Same Page setup. Existing configuration is never overwritten by another `init`.

## Check each account's cached usage offline

**Conversations and memory are shared; usage caches stay separate.** Each profile's `statusline-usage.json` stores its last observed 5-hour and 7-day used percentages and reset times. Generate a cache first, then query it:

```sh
csp usage                  # All registered profiles
csp usage personal         # Only personal
csp usage personal --json  # Structured output for local scripts
```

The query reads only that cache. It does not start Claude, read credentials, contact a server, or modify the file. Output includes raw used percentages, UTC reset times, the file update time, and cache age. Values above 100% are preserved. `reset time passed` flags an old observation; it does not estimate usage after the reset. The server determines actual availability.

### Prerequisites

- Same Page 0.2.0+, Node.js 22+, and profiles registered with `csp init` / `csp add`.
- To produce the cache, a Claude Code version that supplies status-line `rate_limits`, a signed-in account, and one normal completed request. Official documentation describes subscription usage fields for claude.ai Pro / Max after the session's first API response; either window can be absent. Logging in or opening an empty session alone supplies no usage data.
- A status line or compatible producer configured separately for each account, with write permission to that account's config directory. Cache files belong outside the shared `projects/` store.
- Once cached, querying needs only Node, the Same Page registry, and readable cache files. It works offline without signing in again.

### How to generate the cache

The installed package includes a [standalone status-line example](examples/statusline-usage.mjs). It extracts `rate_limits` from Claude's stdin JSON; it has no network or credential-reading code. If your existing tool already writes a compatible cache, use it directly.

**1. Find the profile directory and copy the example there.** Run `csp list` and replace the example path with the actual config directory. Newly created profiles default to `~/.claude-samepage/profiles/<name>`.

Windows PowerShell:

```powershell
csp list
$profileDir = 'D:\Profiles\personal' # Replace with personal's actual config directory
$packageDir = Join-Path (npm root -g) 'claude-same-page'
$target = Join-Path $profileDir 'statusline-usage.mjs'
if (Test-Path -LiteralPath $target) { throw 'Target script exists; inspect it first.' }
Copy-Item -LiteralPath (Join-Path $packageDir 'examples\statusline-usage.mjs') -Destination $target
```

macOS / Linux:

```sh
csp list
PROFILE_DIR="$HOME/.claude-samepage/profiles/personal" # Replace with the actual directory
cp -i "$(npm root -g)/claude-same-page/examples/statusline-usage.mjs" "$PROFILE_DIR/statusline-usage.mjs"
```

**2. Add `statusLine` to that profile's `settings.json`, preserving its other settings.** This Windows example uses forward slashes; on macOS / Linux use the absolute script path. Keep the quotes around paths with spaces. `node` must be available in Claude's environment.

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"D:/Profiles/personal/statusline-usage.mjs\""
  }
}
```

If you already have a `statusLine`, save its original configuration before choosing the example or integrating its cache-writing logic into your script. The JSON above shows the fields to add, not a replacement for your entire settings file. Use absolute paths for any existing script that depends on the working directory.

**3. Start that account and complete a normal work request.**

```sh
csp run personal
# In Claude, send a normal work message, wait for its response, then exit.
csp usage personal
```

When usage fields arrive, the script creates `statusline-usage.json` beside itself. Before a new response arrives on a later launch, `~` marks cached values in the status line. Missing fields do not become zero usage or refresh the cache timestamp. Changes are saved through a temporary file and rename. The file timestamp means last write, not verified server freshness.

**4. Repeat separately for work and every other profile.** Each `command` must point at the copy in its own account directory. A single shared script copy would mix caches. Close the previous Claude session before switching accounts.

### Existing status lines and other producers

An existing `statusline.js` can be used as-is if it produces this filename inside its own profile directory. Other producers can write the same format. These numbers are synthetic examples:

```json
{
  "five_hour": { "used_percentage": 23.5, "resets_at": 2000000000 },
  "seven_day": { "used_percentage": 41.2, "resets_at": 2000500000 }
}
```

Use a finite nonnegative number for `used_percentage`, and Unix seconds for `resets_at`, not milliseconds or a date string. Either window may exist independently. Do not put tokens, email addresses, or account identity in the cache. Queries output only allowed usage fields and file times, ignore unrelated fields, and reject linked files or caches over 64 KiB. Missing, malformed, or partially invalid data is reported and preserved. Any profile status other than `ok` returns exit code 1 for scripting.

[Official status-line documentation](https://code.claude.com/docs/en/statusline#rate-limit-usage) · [Cache troubleshooting](docs/troubleshooting.md#usage-cache-is-missing-or-stale)

## How it works

```text
personal/                         work/
├── credentials & account state   ├── credentials & account state
├── settings & plugins            ├── settings & plugins
├── statusline-usage.json          ├── statusline-usage.json
└── projects/ ────────┐   ┌─────── projects/
                     ▼   ▼
                shared/projects/
                └── <project>/
                    ├── <session>.jsonl
                    └── memory/
                        └── MEMORY.md
```

Same Page changes only the child process's `CLAUDE_CONFIG_DIR`, links only `projects/`, and forwards arguments without a shell. The official CLI performs authentication and talks to Anthropic. [Architecture and data boundaries →](docs/architecture.md)

| Shared | Separate |
| --- | --- |
| Local session transcripts under `projects/` | Credentials, account identity and account configuration |
| Default project auto memory under `projects/` | User settings, plugins, global skills, global `CLAUDE.md` |
| Workspace files, including project `CLAUDE.md` and project skills | `history.jsonl` command history and independent `statusline-usage.json` usage caches |

An explicit `autoMemoryDirectory` setting can override Claude's default memory location. Same Page does not rewrite it. Sharing files also does not make every byte enter the model's context: Claude still applies its own resume, compaction, and memory-loading behavior.

**Scope:** local Claude Code terminal sessions. claude.ai chats, account-side memory, remote sessions, and Claude Desktop sign-ins are outside this tool. This is not an OS security boundary between accounts: each launched Claude has your user's filesystem permissions. Use separate stores for work that must remain separate.

## Commands

| Command | Purpose |
| --- | --- |
| `csp init [--workspace DIR] [--shared-projects DIR]` | Create a setup; optionally adopt an existing store |
| `csp add NAME [--config DIR]` | Create or register an isolated profile |
| `csp login NAME` | Run Claude's own `auth login` |
| `csp use NAME` | Set the default profile |
| `csp list` | List profile names and directories |
| `csp usage [NAME] [--json]` | Read per-profile usage caches offline |
| `csp run [NAME] -- [ARGS]` | Launch Claude with exact arguments |
| `csp continue [NAME] -- [ARGS]` | Pass `--continue` to Claude |
| `csp resume [NAME] [SESSION] -- [ARGS]` | Open the session picker or resume by ID |
| `csp doctor [--json]` | Check links, executable, and lock presence |
| `csp unlock --stale` | Remove a lock only after its recorded processes are dead |

`csp` and `claude-same-page` are the same executable; the legacy `claude-samepage` command remains available. `CSP_CLAUDE_BIN` can select an absolute native Claude executable. Windows npm shims are resolved to the official package's native binary; arbitrary `.cmd` / `.ps1` shims are not executed.

## Compatibility and verification

| Layer | Status |
| --- | --- |
| Windows local method | Three independent account directories with shared project links inspected on the origin machine |
| v0.2.0 local verification | 19 Windows fixture tests, including cache production, offline queries, and private-field filtering; Claude 2.1.296 executable resolution checked |
| CI | Windows, Linux, macOS × Node 22/24: synthetic sharing, launch, data preservation, and locking tests |
| Real authenticated generation | Not part of the automated suite; no paid model request is required for tests |

The [official multi-account documentation](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts) supports separate `CLAUDE_CONFIG_DIR` values for claude.ai accounts. Claude Console sign-ins without an API key have a documented isolation exception. Use claude.ai profiles for this workflow. Account-routing environment variables are rejected before launch so they cannot silently override your selected sign-in.

**Close before switching.** The lock covers Same Page launches only. Direct `claude` commands, old shell aliases, editor sessions, and other tools can bypass it. After a crash, `csp unlock --stale` refuses live processes, foreign-host locks, and interrupted launches whose child PID was not recorded. [Troubleshooting →](docs/troubleshooting.md)

## Small by design

- Zero runtime dependencies. Readable ESM source.
- No credentials copied, no network code, no telemetry in Same Page.
- No automatic account rotation or promises about subscription limits.
- No rewrites of your shell profile, Claude settings, or transcripts.

## Contribute

```sh
git clone https://github.com/Yu-tao-Li/claude-same-page.git
cd claude-same-page
npm test
npm run audit:public
```

Please report your OS, Node and Claude versions, and redacted `csp doctor` output. Never attach credentials or real transcript files. [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Release notes](CHANGELOG.md)

If this helps you keep your flow, a **Star** helps others find it. Windows/macOS/Linux compatibility reports are especially useful.

MIT licensed. Independent community project; not affiliated with Anthropic. Claude and Claude Code are Anthropic trademarks.
