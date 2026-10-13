<p align="center"><img src="assets/hero.svg" alt="Claude Samepage：切换账号，继续同一段工作" width="100%" /></p>

<p align="center"><a href="README.md">English</a> · <a href="https://github.com/Yu-tao-Li/claude-samepage/actions/workflows/ci.yml">CI</a> · MIT · 零运行时依赖 · Node.js 22+</p>

<h3 align="center">账号换了，对话和项目记忆接着用。</h3>

Claude Code 的独立配置目录可以保留多个登录，但也会把会话分开。**Samepage 把工作接回来**：账号各自登录，共享本地 `projects/`，用一条命令继续原来的工作。

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
| 安全接入现有配置 | 遇到冲突目录直接停止；`doctor` 不读取凭证内容 |

## 快速开始

先安装 **Node.js 22+**、Git 和 [Claude Code](https://code.claude.com/docs/en/setup)，确认 `claude` 在 PATH 中可用。下面的命令适用于 PowerShell、Bash 和 Zsh。当前从 GitHub 安装，尚未发布到 npm registry。

```sh
npm install -g git+https://github.com/Yu-tao-Li/claude-samepage.git#v0.1.0
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

## 哪些共享，哪些独立

| 共享 | 各自独立 |
| --- | --- |
| `projects/` 中的本地会话文件 | 凭证、账号身份和账号配置 |
| 默认位置的项目 auto memory | 用户 settings、plugins、全局 skills、全局 `CLAUDE.md` |
| 同一工作目录中的项目文件、项目 `CLAUDE.md` 和项目 skills | `history.jsonl` 命令历史与各自缓存 |

Samepage 只链接 `projects/`，只为子进程设置配置目录，直接传递命令参数。登录与模型请求由 Claude 官方 CLI 执行。[实现与数据边界](docs/architecture.md)

若你显式设置了 `autoMemoryDirectory`，Claude 可以使用其他记忆目录，Samepage 不会改写该设置。共享文件不代表所有内容都会进入模型上下文；会话恢复、压缩和 memory 加载仍由 Claude 决定。

**范围是本机 Claude Code 终端会话。** claude.ai 网页对话、云端账号记忆、远程会话和 Claude Desktop 登录不在此工具范围内。它也不构成操作系统权限隔离：启动的 Claude 具有当前用户的文件权限，需要隔离的工作请使用不同的共享目录。

## 命令

| 命令 | 用途 |
| --- | --- |
| `csp init [--workspace DIR] [--shared-projects DIR]` | 初始化，可接入已有共享源 |
| `csp add NAME [--config DIR]` | 创建或登记账号配置 |
| `csp login NAME` | 执行官方 `auth login` |
| `csp use NAME` | 设置默认账号 |
| `csp list` | 列出账号名称和配置目录 |
| `csp run [NAME] -- [ARGS]` | 启动并原样转发参数 |
| `csp continue [NAME] -- [ARGS]` | 继续当前工作目录最近的对话 |
| `csp resume [NAME] [SESSION] -- [ARGS]` | 打开历史选择器或按 ID 恢复 |
| `csp doctor [--json]` | 检查链接、可执行文件和锁 |
| `csp unlock --stale` | 确认记录的进程已经退出后移除残留锁 |

`csp` 和 `claude-samepage` 是同一个入口。`CSP_CLAUDE_BIN` 可以指定原生 Claude 可执行文件。Windows 下会把官方 npm shim 解析为实际 `claude.exe`，不会执行任意 `.cmd` 或 `.ps1` 包装脚本。

## 验证范围

| 层面 | 状态 |
| --- | --- |
| 原始 Windows 方法 | 在来源机器检查了三个独立配置目录及共享链接 |
| v0.1.0 本地验证 | Windows 虚构数据测试；检查了 Claude 2.1.296 实际可执行文件解析 |
| CI | Windows/Linux/macOS × Node 22/24，测试文件共享、启动、文件保护和锁 |
| 真实登录后的生成 | 不属于自动测试范围，测试不需要消耗模型请求 |

[官方多账号文档](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts)支持 claude.ai 账号使用不同的 `CLAUDE_CONFIG_DIR`。不使用 API key 的 Claude Console 登录有官方注明的隔离例外，本工具的工作流使用 claude.ai 账号。存在可能覆盖所选账号的 API key、OAuth token 或第三方路由环境变量时，启动会停止，只显示变量名。

**关闭旧会话再切换。** 锁只覆盖 Samepage 启动的进程；直接运行 `claude`、旧 alias、编辑器会话和其他工具可以绕过它。异常退出后，`unlock --stale` 会拒绝仍存活的进程、其他主机的锁和没有完整记录子进程 PID 的中断启动。[故障排查](docs/troubleshooting.md)

## 保持轻量

- 零运行时依赖，源码使用可读的 ESM。
- 工具自身不复制凭证，不联网，不收集遥测。
- 手动切换账号，不承诺订阅额度变化。
- 不修改 shell profile、Claude settings 或会话内容。

## 参与项目

```sh
git clone https://github.com/Yu-tao-Li/claude-samepage.git
cd claude-samepage
npm test
npm run audit:public
```

反馈时提供操作系统、Node/Claude 版本和去除私人路径的 `csp doctor` 输出。请不要附上凭证或真实对话文件。[参与贡献](CONTRIBUTING.md) · [安全说明](SECURITY.md) · [版本记录](CHANGELOG.md)

如果帮你保住了工作节奏，欢迎点一个 **Star**。不同系统的兼容性反馈也很有价值。

MIT 协议。独立社区项目，与 Anthropic 无隶属关系；Claude 和 Claude Code 为 Anthropic 的商标。
