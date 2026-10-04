<p align="center">
  <img src="assets/brand/fqgate-logo.png" alt="FQGate" width="152">
</p>

# FQGate Agent

FQGate Agent 让 AI 软件使用当前电脑上的 FQGate，帮助你查看证券行情、分析 K 线、筛选股票和了解相关消息。需要配合 FQGate 2.0 或更高版本使用。

支持的功能和数据范围取决于运行中的 FQGate、所选数据来源及账号权限。

## 能做什么

| 用途            | 你可以这样提问                                   |
| --------------- | ------------------------------------------------ |
| 行情与 K 线分析 | “看看这只股票的当前行情和近期走势。”             |
| 条件选股        | “找出符合这些条件的股票，再看看它们的当前盘面。” |
| 盘口与成交分析  | “看看这只股票的盘口、逐笔成交和买卖力量。”       |
| 消息与事件研究  | “这只股票最近有哪些消息？和价格变化有什么关系？” |

数据是否可用，取决于 FQGate 中开启的数据源、登录状态和账号权限。Level-2 等数据需要相应权限；插件不会增加账号已有的权限。AI 的分析不等于数据事实，也不构成投资建议或收益承诺。

在支持自选股管理的数据源中，还可以查询自选股、添加或移除证券，以及创建或删除自选列表。修改前请核对证券和列表，尤其注意删除操作。

## 开始使用

1. 从 [FQGate 官方下载页](https://github.com/fqgate/FQGate-releases/releases)下载并打开主程序。
2. 在主程序中开启需要的数据源，按提示完成登录，确认数据连接正常。
3. 打开“AI 接入”，选择正在使用的 AI 软件，按页面提示完成接入。
4. 重新打开 AI 会话，再提出行情或研究问题。

FQGate 主程序需要与 AI 软件运行在同一台电脑上，并保持开启。

### AI 软件的接入方式

FQGate 的“AI 接入”页面提供 ChatGPT（Codex 接入）、Claude Code、豆包、千问、DeepSeek Harness、WorkBuddy、ZCode 和 OpenClaw 的接入入口，但不同软件的安装条件并不相同：

- ChatGPT（Codex 接入）和 Claude Code 使用各自的插件市场安装 FQGate 插件。
- 豆包、千问的自动安装目前仅支持 Windows，需要先打开对应软件并进入一次工作任务。
- DeepSeek Harness、WorkBuddy、ZCode 和 OpenClaw 是否能自动接入，取决于软件版本和可用的命令行程序；条件不满足时，请按页面指引处理。

ChatGPT 入口使用电脑上的 Codex，普通 ChatGPT 网页和手机应用不能通过此入口连接。完成接入后，请重新打开 AI 对话，并尝试查询行情。

### 在终端安装 Codex 或 Claude Code 插件

如果你已经能在终端运行对应工具，也可以直接安装。以下命令仅适用于 Codex 和 Claude Code。

Codex：

```bash
codex plugin marketplace add fqgate/FQGate-agent --json
codex plugin add fqgate-agent@fqgate-official --json
```

Claude Code：

```bash
claude plugin marketplace add fqgate/FQGate-agent --scope user
claude plugin install fqgate-agent@tonghuasun-agent --scope user
```

安装后重新打开 AI 会话，FQGate 主程序仍需保持运行。

### 手动连接其他 AI 软件

如果软件支持 MCP（AI 调用本机数据的连接方式），可按它的使用说明添加连接。FQGate 默认的 Streamable HTTP 地址是：

```text
http://127.0.0.1:17281/mcp
```

如果软件只支持标准输入输出（STDIO）连接，请将 FQGate 可执行文件设为启动程序，并填写以下参数：

```text
--mcp-stdio --mcp-url http://127.0.0.1:17281/mcp
```

手动连接后可调用 FQGate 的数据工具；本插件的分析功能和图表需要所用 AI 软件另行支持。若主程序显示的 MCP 地址不同，请使用实际地址。FQGate 与 AI 软件需要运行在同一台电脑上。

## 图表展示

支持 MCP Apps（在 AI 对话中展示图表和信息页面）的软件，可以显示 K 线与成交量、证券行情、资讯和 Level-2 成交信息。未支持这种展示方式的软件仍可使用数据查询，不会因此自动获得图表界面。

FQGate 自带图表页面，无需另外安装这些页面。数据仍取决于连接状态和账号权限。

## 遇到问题

- AI 看不到 FQGate：确认主程序正在运行，回到“AI 接入”重新检测，并重新打开 AI 会话。
- 提示未登录或权限不足：在 FQGate 中检查所选数据源和账号；插件不能替代登录或绕过付费权限。
- 有数据但没有图表：检查 AI 软件是否支持 MCP Apps；接入成功不代表图表一定可显示。
- 反馈问题时，请说明主程序版本、AI 软件和错误提示，隐藏账号、密码、验证码等敏感信息。

## 安全与许可

FQGate Agent 不提供个人资产、持仓查询、证券买卖、撤单或资金操作。自选股操作只修改关注列表。

- 数据连接仅供本机使用，不应配置到公网或局域网地址。
- 插件的分析流程与图表页面不保存密码、验证码、完整账号或会话凭据。
- 使用云端 AI 服务时，对话和工具返回的数据可能由该服务处理，请留意其隐私政策。
- AI 的分析与推断必须和 FQGate 返回的数据事实分开表达。
- 本项目不提供投资建议或收益承诺。

本插件的源码依据 [AGPL-3.0-only](./LICENSE) 开源，FQGate 主程序不在这一开源许可的范围内。完整说明见[法律文档](./docs/legal/)。

项目技术说明见[架构设计](./docs/架构设计.md)与[自动发布](./docs/自动发布.md)。
