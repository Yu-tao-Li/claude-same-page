[中文](#中文-readme) | [English](#english-readme) | [中文独立版](README.zh-CN.md) | [English-only](README.en.md)

**中文摘要：** Claude Same Page 让多个 Claude Code 账号独立登录，共享本机对话记录与项目 memory。关闭当前会话后，用 `csp continue work` 从另一个账号接着工作；用 `csp usage` 离线查看各账号独立的额度缓存。Windows 使用 junction，零运行时依赖，不读取或复制凭证。

**English summary:** Claude Same Page keeps Claude Code sign-ins separate while sharing local conversations and project memory. Close the current session, then continue from another account with `csp continue work`. Check each account’s independent usage cache offline with `csp usage`. Windows-friendly, zero runtime dependencies, and no credential reads or copies.

# 中文 README

<p align="center"><img src="assets/hero.svg" alt="Claude Same Page：切换账号，继续同一段工作" width="100%" /></p>

<p align="center"><a href="README.en.md">English</a> · <a href="https://github.com/Yu-tao-Li/claude-same-page/actions/workflows/ci.yml">CI</a> · MIT · 零运行时依赖 · Node.js 22+</p>

<h3 align="center">账号换了，对话和项目记忆接着用。</h3>

Claude Code 的独立配置目录可以保留多个登录，但也会把会话分开。**Same Page 把工作接回来**：账号各自登录，共享本地 `projects/`，用一条命令继续原来的工作。

```text
csp run personal          → 开始工作
                          → 关闭当前 Claude 会话
csp continue work         → 在同一工作目录继续最近的会话
```

适合在同一台电脑使用你自己的多个 Claude Code 账号。项目源自实际使用的 Windows 三账号配置，以手动切换、官方登录和本地文件为基础。

## 看一下切换过程

<p align="center"><img src="assets/demo.gif" alt="离线演示：两个账号配置读取和写入同一套虚构对话和 memory，同时保留独立的虚构凭证" width="900" /></p>

演示使用虚构数据和离线测试程序，展示的是本地文件共享，不是已登录 Claude 的生成录像。

## 能解决什么

| 需求 | 做法 |
| --- | --- |
| 换账号后继续之前的工作 | 共享本地会话文件，转发 Claude 的 `--continue` / `--resume` |
| 项目 memory 随账号切换保留 | 共用 `projects/<project>/memory/` |
| 登录各自独立 | 为子进程设置各自的 `CLAUDE_CONFIG_DIR`，不复制凭证 |
| Windows 不用管理员权限创建 symlink | 使用目录 junction；macOS/Linux 使用目录 symlink |
| 避免两个入口同时写共享数据 | 同一个共享目录使用同一把写入锁 |
| 离线比较各账号已用额度 | 仅读取各账号自己的 `statusline-usage.json`，显示更新时间 |
| 安全接入现有配置 | 遇到冲突目录直接停止；`doctor` 不读取凭证内容 |

## 快速开始

先安装 **Node.js 22+** 和 [Claude Code](https://code.claude.com/docs/en/setup)，确认 `claude` 在 PATH 中可用。下面的命令适用于 PowerShell、Bash 和 Zsh。以下命令安装已打包的 GitHub Release，尚未发布到 npm registry。

从 0.1.x 升级时，先运行 `npm uninstall -g claude-samepage` 移除旧包，再安装新包，以免 `csp` 入口冲突。已有配置目录与共享数据无需迁移，默认管理目录仍为 `~/.claude-samepage`。

```sh
npm install -g https://github.com/Yu-tao-Li/claude-same-page/releases/download/v0.2.0/claude-same-page-0.2.0.tgz
csp init
csp add personal
csp add work
csp login personal
csp login work
```

登录交给 Claude 官方 CLI。浏览器打开时分别选择正确的账号。然后进入你的项目目录：

```sh
csp run personal
# 关闭第一个会话，再切换。
csp continue work
```

新账号首次运行可能需要完成初始设置或确认工作目录信任，完成一次即可。`continue` 选择当前工作目录最近的会话；想准确指定某段对话，可以使用 Claude 的 session ID：

```sh
csp resume work
csp resume work YOUR_SESSION_ID
csp run work -- --model sonnet
csp continue work -- --model opus
```

### 固定一个工作目录

```powershell
csp init --workspace "D:\Work\MyProject"
```

设置后从任何目录启动都会进入这个工作目录；没有设置时使用当前目录。子进程退出后，父终端的目录和环境变量保持原样。

### 接入已有账号和历史对话

先关闭使用这些配置的所有 Claude 进程。选定要保留的 `projects/` 作为共享源，再登记账号：

```powershell
csp init --shared-projects "D:\Profiles\personal\projects" --workspace "D:\Work\MyProject"
csp add personal --config "D:\Profiles\personal"
csp add work --config "D:\Profiles\work"
csp doctor
```

第二个配置目录必须没有 `projects/`，或者已经链接到同一个共享源。如果它有独立历史，工具会停止并保留原文件。请先备份并确定迁移策略；工具不会自动合并、删除历史或导入凭证。另一套独立配置可以使用不同的 `CSP_HOME`。再次运行 `init` 不会覆盖已存在的配置。

## 离线查看各账号额度缓存

**对话和 memory 共用，额度缓存按账号独立。** 每个配置目录中的 `statusline-usage.json` 保存该账号上次观察到的 5 小时、7 天已用百分比与重置时间。先生成缓存，再查询：

```sh
csp usage                  # 查看所有已登记账号
csp usage personal         # 只查看 personal
csp usage personal --json  # 供本地脚本读取
```

查询只读取这个缓存文件，不启动 Claude、不读取凭证、不请求服务器，也不修改缓存。输出包括原始已用百分比、UTC 重置时间、文件更新时间和缓存年龄。缓存原值可以超过 100%，工具不会截断；`reset time passed` 表示记录的重置时间已经过去，并不代表工具知道重置后的额度。实际可用额度由服务器决定。

### 前置条件

- 使用 Same Page 0.2.0+、Node.js 22+，完成 `csp init` / `csp add` 账号登记。
- 生成缓存时，需要支持状态栏 `rate_limits` 输入字段的 Claude Code，账号已登录且完成一次正常请求。官方文档说明，claude.ai Pro / Max 的额度字段在会话首次 API 响应后出现；不同窗口可能单独缺失。仅执行 `csp login` 或打开空会话不会生成额度数据。
- 每个账号分别配置状态栏或兼容的缓存生产工具，写入自己的配置目录，而不是共享的 `projects/`。该目录需可写。
- 缓存存在以后，查询只需要 Node、Same Page 登记信息和可读缓存，可以断网运行，也无需再登录。

### 没有缓存时，具体怎么生成？

安装包提供一个[独立状态栏示例](examples/statusline-usage.mjs)。它从 Claude 官方传入的 stdin JSON 中提取 `rate_limits`，不自行联网，也不读取凭证。如果已有工具生成兼容缓存，可以直接查询；已有状态栏不必更换。

**1. 查出账号目录，把示例复制到该目录。** 运行 `csp list`，将下方示例路径替换为输出中的真实配置目录。新建账号的默认位置是 `~/.claude-samepage/profiles/<name>`。

Windows PowerShell：

```powershell
csp list
$profileDir = 'D:\Profiles\personal' # 替换为 personal 的实际配置目录
$packageDir = Join-Path (npm root -g) 'claude-same-page'
$target = Join-Path $profileDir 'statusline-usage.mjs'
if (Test-Path -LiteralPath $target) { throw '目标脚本已存在，请先检查内容。' }
Copy-Item -LiteralPath (Join-Path $packageDir 'examples\statusline-usage.mjs') -Destination $target
```

macOS / Linux：

```sh
csp list
PROFILE_DIR="$HOME/.claude-samepage/profiles/personal" # 替换为实际配置目录
cp -i "$(npm root -g)/claude-same-page/examples/statusline-usage.mjs" "$PROFILE_DIR/statusline-usage.mjs"
```

**2. 编辑该账号的 `settings.json`，保留其他配置，加入 `statusLine`。** 以下是 Windows 示例；macOS / Linux 改为脚本的绝对路径。路径中有空格也需保留引号，`node` 必须能从 Claude 的运行环境找到。

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"D:/Profiles/personal/statusline-usage.mjs\""
  }
}
```

如果原文件已经有 `statusLine`，先保存原配置，再决定使用示例还是把缓存写入逻辑接入原脚本。上面展示的是需要加入的字段，不能用它覆盖整个已有文件。如果已有状态栏依赖工作目录中的相对路径，改为绝对路径。

**3. 启动这个账号，正常工作并收到一次 Claude 响应。**

```sh
csp run personal
# 在 Claude 会话中发送正常工作消息，等待响应，再退出。
csp usage personal
```

首次收到额度字段后，脚本在自己的目录生成 `statusline-usage.json`。下一次启动尚未收到新响应时，状态栏用 `~` 标出缓存数据。没有新额度字段时不会伪造零值，也不会刷新缓存时间。数据变化时采用临时文件加重命名保存；文件时间代表最后写入时间，不能证明服务器数据仍然新鲜。

**4. 对 work 和其他账号分别重复。** 脚本路径必须指向各账号目录中的副本；不要让多个账号调用同一个共享副本，否则缓存会混在一起。关闭旧会话后再切换账号。

### 已有状态栏或其他工具

已有 `statusline.js` 只要在所属账号配置目录生成同名文件，就能直接供 `csp usage` 使用。其他工具也可以写入以下格式；数值仅为虚构格式示例：

```json
{
  "five_hour": { "used_percentage": 23.5, "resets_at": 2000000000 },
  "seven_day": { "used_percentage": 41.2, "resets_at": 2000500000 }
}
```

`used_percentage` 是非负有限数值；`resets_at` 是 Unix 秒数，不是毫秒或时间字符串。两个窗口可以单独存在。不要把 token、邮箱或账号身份写入缓存。查询只输出允许的额度字段和文件时间，忽略额外字段，并拒绝链接文件及超过 64 KiB 的缓存。缺失、损坏或部分无效数据会明确显示，文件保持原样；任何账号状态不是 `ok` 时退出码为 1，便于脚本检测。

[Claude 官方状态栏说明](https://code.claude.com/docs/en/statusline#rate-limit-usage) · [缓存问题排查](docs/troubleshooting.md#usage-cache-is-missing-or-stale)

## 哪些共享，哪些独立

| 共享 | 各自独立 |
| --- | --- |
| `projects/` 中的本地会话文件 | 凭证、账号身份和账号配置 |
| 默认位置的项目 auto memory | 用户 settings、plugins、全局 skills、全局 `CLAUDE.md` |
| 同一工作目录中的项目文件、项目 `CLAUDE.md` 和项目 skills | `history.jsonl` 命令历史与独立的 `statusline-usage.json` 额度缓存 |

Same Page 只链接 `projects/`，只为子进程设置配置目录，直接传递命令参数。登录与模型请求由 Claude 官方 CLI 执行。[实现与数据边界](docs/architecture.md)

若你显式设置了 `autoMemoryDirectory`，Claude 可以使用其他记忆目录，Same Page 不会改写该设置。共享文件不代表所有内容都会进入模型上下文；会话恢复、压缩和 memory 加载仍由 Claude 决定。

**范围是本机 Claude Code 终端会话。** claude.ai 网页对话、云端账号记忆、远程会话和 Claude Desktop 登录不在此工具范围内。它也不构成操作系统权限隔离：启动的 Claude 具有当前用户的文件权限，需要隔离的工作请使用不同的共享目录。

## 命令

| 命令 | 用途 |
| --- | --- |
| `csp init [--workspace DIR] [--shared-projects DIR]` | 初始化，可接入已有共享源 |
| `csp add NAME [--config DIR]` | 创建或登记账号配置 |
| `csp login NAME` | 执行官方 `auth login` |
| `csp use NAME` | 设置默认账号 |
| `csp list` | 列出账号名称和配置目录 |
| `csp usage [NAME] [--json]` | 离线查询各账号额度缓存 |
| `csp run [NAME] -- [ARGS]` | 启动并原样转发参数 |
| `csp continue [NAME] -- [ARGS]` | 继续当前工作目录最近的对话 |
| `csp resume [NAME] [SESSION] -- [ARGS]` | 打开历史选择器或按 ID 恢复 |
| `csp doctor [--json]` | 检查链接、可执行文件和锁 |
| `csp unlock --stale` | 确认记录的进程已经退出后移除残留锁 |

`csp` 和 `claude-same-page` 是同一个入口，旧的 `claude-samepage` 命令也保留。`CSP_CLAUDE_BIN` 可以指定原生 Claude 可执行文件。Windows 下会把官方 npm shim 解析为实际 `claude.exe`，不会执行任意 `.cmd` 或 `.ps1` 包装脚本。

## 验证范围

| 层面 | 状态 |
| --- | --- |
| 原始 Windows 方法 | 在来源机器检查了三个独立配置目录及共享链接 |
| v0.2.0 本地验证 | 19 项 Windows 虚构数据测试，含缓存生成、离线查询和敏感字段过滤；检查了 Claude 2.1.296 可执行文件解析 |
| CI | Windows/Linux/macOS × Node 22/24，测试文件共享、启动、文件保护和锁 |
| 真实登录后的生成 | 不属于自动测试范围，测试不需要消耗模型请求 |

[官方多账号文档](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts)支持 claude.ai 账号使用不同的 `CLAUDE_CONFIG_DIR`。不使用 API key 的 Claude Console 登录有官方注明的隔离例外，本工具的工作流使用 claude.ai 账号。存在可能覆盖所选账号的 API key、OAuth token 或第三方路由环境变量时，启动会停止，只显示变量名。

**关闭旧会话再切换。** 锁只覆盖 Same Page 启动的进程；直接运行 `claude`、旧 alias、编辑器会话和其他工具可以绕过它。异常退出后，`unlock --stale` 会拒绝仍存活的进程、其他主机的锁和没有完整记录子进程 PID 的中断启动。[故障排查](docs/troubleshooting.md)

## 保持轻量

- 零运行时依赖，源码使用可读的 ESM。
- 工具自身不复制凭证，不联网，不收集遥测。
- 手动切换账号，不承诺订阅额度变化。
- 不修改 shell profile、Claude settings 或会话内容。

## 参与项目

```sh
git clone https://github.com/Yu-tao-Li/claude-same-page.git
cd claude-same-page
npm test
npm run audit:public
```

反馈时提供操作系统、Node/Claude 版本和去除私人路径的 `csp doctor` 输出。请不要附上凭证或真实对话文件。[参与贡献](CONTRIBUTING.md) · [安全说明](SECURITY.md) · [版本记录](CHANGELOG.md)

如果帮你保住了工作节奏，欢迎点一个 **Star**。不同系统的兼容性反馈也很有价值。

MIT 协议。独立社区项目，与 Anthropic 无隶属关系；Claude 和 Claude Code 为 Anthropic 的商标。

# English README

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
