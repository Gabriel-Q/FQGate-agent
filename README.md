<p align="center">
  <img src="assets/brand/fqgate-logo.png" alt="FQGate" width="152">
</p>

# FQGate Agent

FQGate Agent 是 FQGate 2.0 的公开 AI 插件仓库。它只维护三类内容：Codex 与 Claude Code 的插件入口、可复用的金融数据 Skill，以及由 FQGate MCP Server 提供的 MCP Apps 界面源码。

FQGate 2.0 当前向 Agent 提供只读数据查询，不提供账户、持仓、下单、撤单或资金操作。

## 安装

推荐在 FQGate 桌面主程序的“AI 接入”页面完成安装。主程序会调用对应 AI 工具的官方 CLI，依次执行检测、计划确认、配置备份、安装、验证；移除时只处理由 FQGate 自己创建的插件资源。

也可以直接使用官方 CLI：

```bash
# Codex
codex plugin marketplace add fqgate/FQGate-agent --json
codex plugin add fqgate-agent@fqgate-official --json

# Claude Code
claude plugin marketplace add fqgate/FQGate-agent --scope user
claude plugin install fqgate-agent@tonghuasun-agent --scope user
```

安装后重新打开 AI 会话，使插件、MCP 和 Skill 按宿主机制重新加载。FQGate 主程序必须在本机运行；默认 MCP 地址为 `http://127.0.0.1:17281/mcp`。

## 当前能力

| Skill | 目标 |
| --- | --- |
| `fqgate-realtime-stock-analyzer` | 具体证券的当前行情、K 线与趋势分析 |
| `fqgate-stock-screener` | 自然语言条件选股并复核候选盘面 |
| `fqgate-order-flow-analyzer` | 分时、盘口、逐笔与 Level-2 微观结构 |
| `fqgate-event-research` | 资讯、重大事件与价格时间轴研究 |

行情、资讯和 Level-2 是否可用，以本机 FQGate 的数据源状态与账号权限为准。权限不足时必须明确说明，不能把低等级数据冒充用户指定的数据。

## 项目结构

```text
agent-plugin/
  plugin.json                     可移植插件元数据
  mcp.json                        可移植 MCP 清单
  .mcp.json                       Codex / Claude Code MCP 发现文件
  .codex-plugin/plugin.json       Codex 插件清单
  .claude-plugin/                 Claude Code 插件与市场清单
  .agents/plugins/marketplace.json Codex 市场清单
  skills/                         唯一 Skill 源码
  mcp-apps/                       唯一 MCP Apps 源码、测试和发布工具
  scripts/                        跨仓库内置与版本辅助脚本
  tests/                          插件结构和技能路由门禁
  docs/                           架构、发布与法律文档
  compatibility.json             Agent、FQGate 与 MCP 协议兼容合同
```

这里没有 `plugins/fqgate/` 空包装层，也不再按宿主复制业务目录。宿主差异只存在于各自要求的根级清单中。

## MCP Apps 的内置与更新

界面源码在本仓库的 `mcp-apps/`。FQGate 主程序仓库只保存构建后的内置快照：

```bash
npm --prefix mcp-apps ci
npm run embed:mcp-apps -- --fqgate-root ../fqgate
```

主程序首次启动或离线时使用该快照；启动后会检查 `fqgate/FQGate-releases` 中经过 Ed25519 签名的稳定通道。更新会安装到版本目录并切换新会话，已有 MCP 会话继续固定使用创建时的版本。

MCP Apps 的运行时资源由 FQGate MCP Server 返回。AI 宿主负责渲染 `ui://` 资源，但不维护组件源码或更新逻辑。

## 开发门禁

```bash
npm --prefix mcp-apps ci
npm test
```

`npm test` 会校验插件清单、Skill 路由、MCP Apps bridge、类型、自包含构建和签名发布合同。

详细边界见[架构设计](./docs/架构设计.md)与[自动发布](./docs/自动发布.md)。FQGate 主程序安装包从 [FQGate-releases](https://github.com/fqgate/FQGate-releases/releases) 获取。

## 安全与许可

- MCP 默认只监听回环地址，不应配置到公网或局域网地址。
- Skill 与 MCP Apps 不保存密码、验证码、完整账号或会话凭据。
- AI 的分析与推断必须和 FQGate 返回的数据事实分开表达。
- 本项目不提供投资建议或收益承诺。

插件、Skill 与 MCP Apps 源码依据 [AGPL-3.0-only](./LICENSE) 开源。FQGate 主程序安装包适用其随包许可；完整说明见[法律文档](./docs/legal/)。
