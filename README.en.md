[中文](README.zh-CN.md) | [English](README.en.md) | [中英双语 / Bilingual](README.md)

**中文摘要：** Claude Samepage 让多个 Claude Code 账号保留各自登录，并共享本机的对话记录与项目 memory。关闭当前会话后，使用 `csp continue work` 从另一个账号接着工作。Windows 使用 junction，工具零运行时依赖，不读取或复制凭证。

**English summary:** Claude Samepage keeps Claude Code account logins independent while sharing local conversations and project memory. Close the current session, then use `csp continue work` to pick up from another profile. Windows-friendly, zero runtime dependencies, and no credential reads or copies.

<p align="center">
  <img src="assets/hero.svg" alt="Claude Samepage — Switch accounts. Stay on the same page." width="100%" />
</p>

<p align="center">
  <a href="https://github.com/Yu-tao-Li/claude-samepage/actions/workflows/ci.yml"><img src="https://github.com/Yu-tao-Li/claude-samepage/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-71e8b2?style=flat-square" alt="MIT" /></a>
  <img src="https://img.shields.io/badge/runtime_dependencies-0-71e8b2?style=flat-square" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/Node.js-22%2B-71e8b2?style=flat-square" alt="Node 22+" />
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/中文-说明-82b7ff?style=flat-square" alt="中文说明" /></a>
</p>

<h3 align="center">Different account. Same conversation. Same project memory.</h3>

Claude Code profiles keep logins apart. They also keep your sessions apart.
**Samepage reconnects the work:** separate account directories, one shared `projects/` directory, and a short command to pick up where you left off.

```text
csp run personal          → work on your project
                         → close that Claude session
csp continue work        → continue the latest session in the same workspace
```

**For your own Claude Code accounts on one machine.** Manual switching, official Claude login, local files. Born from a working three-account Windows setup.

## See the handoff

<p align="center"><img src="assets/demo.gif" alt="Offline demo: two profiles read and append to the same synthetic transcript and memory, while keeping separate synthetic credentials." width="900" /></p>

*The demo uses synthetic data and an offline fixture. It shows Samepage's local file sharing; it is not a recording of authenticated Claude generation.*

## Why Samepage?

| You want… | Samepage does… |
| --- | --- |
| A different account, without explaining everything again | Launches that profile with the shared transcript store; passes Claude's `--continue` / `--resume` |
| Project memory that follows the conversation | Shares the same `projects/<project>/memory/` files |
| Independent sign-ins | Sets `CLAUDE_CONFIG_DIR` for the child process; never copies credential files |
| A Windows setup that needs no symlink privilege | Uses directory junctions on Windows, directory symlinks on macOS/Linux |
| Safe handoff | One shared writer lock across all Samepage launchers using the same store |
| Confidence before adopting existing profiles | Refuses conflicting directories; `csp doctor` checks links without reading secrets |

## Start in a minute

Requirements: **Node.js 22+** and [Claude Code](https://code.claude.com/docs/en/setup) installed and available on PATH. Commands work in PowerShell, Bash, and Zsh. Install the packaged GitHub Release below; there is no npm-registry release yet.

```sh
npm install -g https://github.com/Yu-tao-Li/claude-samepage/releases/download/v0.1.1/claude-samepage-0.1.1.tgz

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

Without `--workspace`, Samepage uses your current directory. With it, every profile starts in the pinned folder. Your parent shell's directory and environment remain unchanged.

### Already have accounts and conversations?

Close all Claude processes that use those profiles. Point Samepage at **the existing `projects/` folder you want to keep**, then register the profiles:

```powershell
csp init --shared-projects "D:\Profiles\personal\projects" --workspace "D:\Work\MyProject"
csp add personal --config "D:\Profiles\personal"
csp add work --config "D:\Profiles\work"
csp doctor
```

The second profile must have **no `projects/` directory**, or already link to that same shared store. If it has independent history, Samepage stops and preserves it. Back it up and choose a migration strategy first. There is no automatic merge, deletion, or credential import.

Use `CSP_HOME` for a second, completely separate Samepage setup. Existing configuration is never overwritten by another `init`.

## How it works

```text
personal/                         work/
├── credentials & account state   ├── credentials & account state
├── settings & plugins            ├── settings & plugins
└── projects/ ────────┐   ┌─────── projects/
                     ▼   ▼
                shared/projects/
                └── <project>/
                    ├── <session>.jsonl
                    └── memory/
                        └── MEMORY.md
```

Samepage changes only the child process's `CLAUDE_CONFIG_DIR`, links only `projects/`, and forwards arguments without a shell. The official CLI performs authentication and talks to Anthropic. [Architecture and data boundaries →](docs/architecture.md)

| Shared | Separate |
| --- | --- |
| Local session transcripts under `projects/` | Credentials, account identity and account configuration |
| Default project auto memory under `projects/` | User settings, plugins, global skills, global `CLAUDE.md` |
| Workspace files, including project `CLAUDE.md` and project skills | `history.jsonl` command history and per-profile caches |

An explicit `autoMemoryDirectory` setting can override Claude's default memory location. Samepage does not rewrite it. Sharing files also does not make every byte enter the model's context: Claude still applies its own resume, compaction, and memory-loading behavior.

**Scope:** local Claude Code terminal sessions. claude.ai chats, account-side memory, remote sessions, and Claude Desktop sign-ins are outside this tool. This is not an OS security boundary between accounts: each launched Claude has your user's filesystem permissions. Use separate stores for work that must remain separate.

## Commands

| Command | Purpose |
| --- | --- |
| `csp init [--workspace DIR] [--shared-projects DIR]` | Create a setup; optionally adopt an existing store |
| `csp add NAME [--config DIR]` | Create or register an isolated profile |
| `csp login NAME` | Run Claude's own `auth login` |
| `csp use NAME` | Set the default profile |
| `csp list` | List profile names and directories |
| `csp run [NAME] -- [ARGS]` | Launch Claude with exact arguments |
| `csp continue [NAME] -- [ARGS]` | Pass `--continue` to Claude |
| `csp resume [NAME] [SESSION] -- [ARGS]` | Open the session picker or resume by ID |
| `csp doctor [--json]` | Check links, executable, and lock presence |
| `csp unlock --stale` | Remove a lock only after its recorded processes are dead |

`csp` and `claude-samepage` are the same executable. `CSP_CLAUDE_BIN` can select an absolute native Claude executable. Windows npm shims are resolved to the official package's native binary; arbitrary `.cmd` / `.ps1` shims are not executed.

## Compatibility and verification

| Layer | Status |
| --- | --- |
| Windows local method | Three independent account directories with shared project links inspected on the origin machine |
| v0.1.0 local verification | Windows fixture tests; installed Claude 2.1.296 executable resolution checked |
| CI | Windows, Linux, macOS × Node 22/24: synthetic sharing, launch, data preservation, and locking tests |
| Real authenticated generation | Not part of the automated suite; no paid model request is required for tests |

The [official multi-account documentation](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts) supports separate `CLAUDE_CONFIG_DIR` values for claude.ai accounts. Claude Console sign-ins without an API key have a documented isolation exception. Use claude.ai profiles for this workflow. Account-routing environment variables are rejected before launch so they cannot silently override your selected sign-in.

**Close before switching.** The lock covers Samepage launches only. Direct `claude` commands, old shell aliases, editor sessions, and other tools can bypass it. After a crash, `csp unlock --stale` refuses live processes, foreign-host locks, and interrupted launches whose child PID was not recorded. [Troubleshooting →](docs/troubleshooting.md)

## Small by design

- Zero runtime dependencies. Readable ESM source.
- No credentials copied, no network code, no telemetry in Samepage.
- No automatic account rotation or promises about subscription limits.
- No rewrites of your shell profile, Claude settings, or transcripts.

## Contribute

```sh
git clone https://github.com/Yu-tao-Li/claude-samepage.git
cd claude-samepage
npm test
npm run audit:public
```

Please report your OS, Node and Claude versions, and redacted `csp doctor` output. Never attach credentials or real transcript files. [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Release notes](CHANGELOG.md)

If this helps you keep your flow, a **Star** helps others find it. Windows/macOS/Linux compatibility reports are especially useful.

MIT licensed. Independent community project; not affiliated with Anthropic. Claude and Claude Code are Anthropic trademarks.
