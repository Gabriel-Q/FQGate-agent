# 隐私政策

本插件把 AI 软件连接到用户电脑上运行的 FQGate，默认地址为 `http://127.0.0.1:17281/mcp`。项目维护者不运营接收用户行情查询、证券账号或 AI 对话内容的远程服务。

插件的分析说明和行情图表本身不保存密码、验证码、证券账号、持仓或会话凭据。图表只展示 FQGate 返回的数据，不把结果发送给项目维护者。

FQGate 桌面端的“AI 接入”会检查 AI 软件的安装和接入状态。根据软件不同，检查内容包括版本、插件列表或本机配置文件；上次检测结果会保存在本机，供页面再次打开时使用。

在 FQGate 的“AI 接入”中，为 ChatGPT（Codex 接入）或 Claude Code 安装、移除插件时，FQGate 会在修改前备份相关配置，并记录哪些插件和市场项目由 FQGate 创建。这项配置备份说明仅适用于这两种接入方式；直接在终端安装插件或连接其他 AI 软件时，不适用这项说明。

接入记录和相关文件保存在以下本机目录：

- macOS：`~/Library/Application Support/FQGate/agent-access/`
- Windows：`%LOCALAPPDATA%\FQGate\agent-access\`

接入记录用于显示状态和处理后续移除；相关配置备份用于在修改失败时恢复配置。这些文件只保存在本机，不会上传。移除前请确认所选 AI 软件和页面提示。删除 FQGate 用户数据前，应先在桌面端移除由 FQGate 安装的 AI 插件接入。

使用云端 AI 服务时，对话内容和工具结果可能由该服务处理，适用相应服务的隐私政策。不要在 Issue、聊天、截图或日志附件中提交账号、密码、验证码、完整持仓或其他敏感信息。安全问题请使用 [GitHub 私密安全报告](https://github.com/fqgate/FQGate-agent/security/advisories/new)。
