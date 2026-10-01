# 隐私政策

本插件把 AI 工具连接到用户电脑上运行的 FQGate，默认地址为 `http://127.0.0.1:17281/mcp`。项目维护者不运营接收用户行情查询、证券账号或 AI 对话内容的远程服务。

插件清单和 Skill 本身不保存密码、验证码、证券账号、持仓或会话凭据。MCP Apps 只展示 FQGate 工具返回的数据，不把结果发送给项目维护者。

FQGate 桌面端的“AI 接入”会读取 Codex 或 Claude Code 官方 CLI 返回的版本、Marketplace 和插件状态。执行安装前会在 FQGate 用户数据目录保存相关配置文件的本机备份和资源所有权记录：

- macOS：`~/Library/Application Support/FQGate/agent-access/`
- Windows：`%LOCALAPPDATA%\FQGate\agent-access\`

这些文件只用于计划校验、失败撤销和受控卸载，不会上传。删除 FQGate 用户数据前，应先在桌面端移除由 FQGate 安装的 AI 插件接入。

使用云端 AI 服务时，对话内容和工具结果可能由该服务处理，适用相应服务的隐私政策。不要在 Issue、聊天、截图或日志附件中提交账号、密码、验证码、完整持仓或其他敏感信息。安全问题请使用 [GitHub 私密安全报告](https://github.com/fqgate/FQGate-agent/security/advisories/new)。
