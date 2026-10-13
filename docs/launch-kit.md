# Launch kit

Drafts for maintainers to copy and adapt. These have not been posted anywhere.

## Short English post

Switch Claude Code accounts without starting your project conversation over.

Claude Same Page gives each account its own login and links the local session + project memory store. Close one session, then `csp continue work`.

Offline per-account usage caches, with a ready-to-use status-line example. Windows-friendly. Zero runtime dependencies. MIT.

https://github.com/Yu-tao-Li/claude-same-page

## 中文发布文案

我把本地一直在用的 Claude Code 多账号配置整理成了开源工具：Claude Same Page。

每个账号独立登录，共享本地会话和项目 memory。关闭当前会话后，一句 `csp continue work` 就能从另一个账号继续同一工作目录最近的对话。

Windows 用 junction，不需要管理员权限创建 symlink；接入已有配置时遇到历史目录冲突会停止并保留文件。工具本身零运行时依赖、不联网、不读取凭证。

还能用 `csp usage` 离线查看各账号独立的额度缓存，附可直接配置的状态栏示例。附中英文说明、离线演示和三平台测试。欢迎实际使用反馈。

https://github.com/Yu-tao-Li/claude-same-page

## Useful assets

- `assets/hero.svg`: editable README banner.
- `assets/social.png`: 1280 × 640 social preview card.
- `assets/demo.gif`: offline fixture demonstration, labeled as synthetic.

## Positioning

Lead with the user outcome: changing accounts while keeping the local conversation and project memory. Demonstrate two independent profiles reading/writing the same synthetic store. Show the one-command continuation before explaining the filesystem layout.

Do not claim automatic failover, unlimited usage, zero context loss, security isolation, shared web chats, or real-account platform validation that has not happened. Share the project in relevant communities only when invited or permitted; quality reports and a reliable first install matter more than artificial engagement.
