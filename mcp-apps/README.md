# FQGate MCP Apps

这里是 FQGate MCP Apps 的唯一源码。FQGate MCP Server 在运行时返回构建后的 `ui://` HTML，Codex 等支持 MCP Apps 的宿主负责渲染。

当前 Apps：

- `candle`：K 线、均线、成交量和行情摘要；
- `information`：资讯、分类与重大事件；
- `market-quotes`：沪深京多股行情；
- `order-flow`：Level-2 委托、逐笔成交与撤单。

FQGate 2.0 不向 Agent 暴露登录或交易工具，因此这里没有登录、账户和交易界面。

## 开发

```bash
npm ci
npm run dev
npm run test:mcp-apps
```

`mcp-apps/apps.json` 是 App 标识、版本化资源 URI 和 V2 工具绑定的唯一配置。界面使用原生 HTML、CSS 和 TypeScript，不引入通用 UI 框架：

- `src/apps/`：4 个 App 的界面与生命周期；
- `src/features/`：K 线、行情等领域能力；
- `src/ui/`：轻量 DOM、状态栏、可见性与重连控制；
- `src/styles/`：12px 紧凑行情设计层、深浅色和无障碍规则；
- `src/adapters/mcp-app/`：MCP Apps bridge；
- `src/adapters/local-api/`：FQGate 2.0 标准接口适配。

构建输出位于 `dist/mcp-apps/`，每个页面必须是自包含 HTML。开发预览壳不会进入正式资源。

## 内置到主程序

从仓库根执行：

```bash
npm run embed:mcp-apps -- --fqgate-root ../fqgate
```

脚本会生成稳定格式的未签名内置包，校验清单后原子替换主程序的 `assets/mcp-apps/embedded/`。内置包通过 FQGate 安装包完整性获得信任；远程更新则必须额外通过 Ed25519 签名验证。

## 正式发布

本地发布命令只生成一个可提交到发行仓库的签名目录：

```bash
npm run release:mcp-apps -- --output <FQGate-releases>/releases/v2/mcp-apps \
  --signing-key-file <安全目录>/mcp-apps-ed25519-private.pem
```

正式环境使用 GitHub Actions 的受保护密钥。输出结构为：

```text
mcp-apps/
  stable.json
  stable.sig
  versions/<bundleVersion>/
    manifest.json
    manifest.sig
    *.html
```

版本目录不可覆盖；稳定指针最后切换。详细流程见[自动发布](../docs/自动发布.md)。
