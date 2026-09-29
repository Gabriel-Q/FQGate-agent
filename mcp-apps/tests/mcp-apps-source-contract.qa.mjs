import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = join(root, "src");
const sourceFiles = collectSourceFiles(sourceRoot);

for (const path of sourceFiles) {
  const body = readFileSync(path, "utf8");
  const name = relative(root, path);
  assert.doesNotMatch(body, /\/v1\//, `${name} 不得依赖 FQGate V1`);
  assert.doesNotMatch(
    body,
    /\b(?:LoginPanel|LoginService|QrLogin|SmsLogin)\b/,
    `${name} 不得包含登录界面合同`,
  );
  assert.doesNotMatch(
    body,
    /new\s+WebSocket\s*\(/,
    `${name} 不得从组件沙箱直连 WebSocket`,
  );
  assert.doesNotMatch(
    body,
    /from\s+["']vue["']|\.vue["']|@arco-design/,
    `${name} 必须保持原生 HTML 实现`,
  );
}

const preview = readFileSync(join(sourceRoot, "preview.ts"), "utf8");
for (const service of [
  "McpPollingMarketQuoteService",
  "McpPollingMarketRealtimeService",
  "McpPollingOrderFlowService",
]) {
  assert.match(preview, new RegExp(`new ${service}\\(`));
}

const packageJson = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
);
for (const dependency of [
  "vue",
  "vue-tsc",
  "@vitejs/plugin-vue",
  "@arco-design/web-vue",
]) {
  assert.equal(
    packageJson.dependencies?.[dependency],
    undefined,
    `运行依赖不得包含 ${dependency}`,
  );
  assert.equal(
    packageJson.devDependencies?.[dependency],
    undefined,
    `开发依赖不得包含 ${dependency}`,
  );
}
const styles = readFileSync(join(sourceRoot, "styles", "reset.css"), "utf8");
assert.match(styles, /font-size:\s*12px/, "正文基准字号必须为 12px");
const tokens = readFileSync(join(sourceRoot, "styles", "tokens.css"), "utf8");
assert.match(tokens, /Microsoft YaHei UI/, "Windows 必须使用系统 UI 字体栈");
assert.match(tokens, /prefers-color-scheme:\s*dark/, "必须支持系统深色模式");
const marketStyles = readFileSync(
  join(sourceRoot, "styles", "market-ui.css"),
  "utf8",
);
assert.match(
  marketStyles,
  /prefers-reduced-motion:\s*reduce/,
  "必须尊重减少动态效果设置",
);
const candleStyle =
  marketStyles.match(/\.candle-app\s*\{([^}]*)\}/s)?.[1] ?? "";
assert.match(
  candleStyle,
  /width:\s*100%[^;]*;\s*height:\s*100vh/,
  "个股 K 线必须跟随宿主内容区尺寸",
);
assert.match(candleStyle, /border:\s*0/, "个股 K 线根容器不得重复添加卡片边框");
assert.match(
  candleStyle,
  /border-radius:\s*0/,
  "个股 K 线根容器不得重复添加卡片圆角",
);
assert.match(
  candleStyle,
  /box-shadow:\s*none/,
  "个股 K 线根容器不得重复添加卡片阴影",
);
assert.doesNotMatch(
  candleStyle,
  /aspect-ratio/,
  "个股 K 线不得在宿主窗口内再固定画布比例",
);
const candleSource = readFileSync(
  join(sourceRoot, "apps", "CandleApp.ts"),
  "utf8",
);
assert.match(
  candleSource,
  /new MarketInspector\(\{/,
  "个股 K 线必须提供可钻取的盘口与成交侧栏",
);
assert.match(
  candleSource,
  /onDepth:[\s\S]*onTransactions:/,
  "个股 K 线必须订阅盘口与成交更新",
);
assert.match(
  candleSource,
  /setInspectorWorkspaceMode/,
  "个股 K 线必须支持全景盘口工作区和右侧栏成交明细",
);
const inspectorSource = readFileSync(
  join(sourceRoot, "features", "candle", "MarketInspector.ts"),
  "utf8",
);
const transactionSummarySource = readFileSync(
  join(sourceRoot, "features", "candle", "TransactionSummary.ts"),
  "utf8",
);
assert.match(inspectorSource, /全景 500 档/);
assert.match(inspectorSource, /mode === "level2" \? "十档" : "五档"/);
assert.doesNotMatch(inspectorSource, />L1<|"L1"/);
assert.match(transactionSummarySource, /const BASIC_SUMMARY_ROWS = 6/);
assert.match(transactionSummarySource, /const LEVEL2_SUMMARY_ROWS = 2/);
assert.match(transactionSummarySource, /transactionSummaryRowLimit/);
assert.match(transactionSummarySource, /role", "button"/);
const virtualRowListSource = readFileSync(
  join(sourceRoot, "features", "candle", "VirtualRowList.ts"),
  "utf8",
);
assert.match(
  virtualRowListSource,
  /setProperty\("--virtual-row-height", `\$\{rowHeight\}px`\)/,
  "虚拟列表必须把计算行高同步给实际渲染行",
);
assert.match(
  marketStyles,
  /\.panoramic-row,\s*\.transaction-detail-row\s*\{[\s\S]*?height:\s*var\(--virtual-row-height\)/,
  "全景盘口和成交明细的实际行高必须与虚拟列表一致",
);
assert.match(inspectorSource, /openTransactions/);
assert.match(
  inspectorSource,
  /openPanorama\(\)[\s\S]*?onWorkspaceModeChange\("panorama"\)/,
  "全景盘口必须切换到独立工作区",
);
assert.match(
  inspectorSource,
  /openTransactions\(\)[\s\S]*?onWorkspaceModeChange\("split"\)/,
  "成交明细必须在右侧栏内展开并保留 K 线",
);
assert.match(
  candleSource,
  /"is-inspector-panorama"/,
  "宿主只能在全景盘口状态隐藏 K 线",
);
const detailServiceSource = readFileSync(
  join(sourceRoot, "adapters", "local-api", "FqgateMarketDetailService.ts"),
  "utf8",
);
assert.match(
  detailServiceSource,
  /\/v2\/market\/level2\/order-book-rankings/,
  "全景 500 档必须使用真实的 Level-2 买卖盘价格排名",
);
assert.match(
  candleSource,
  /statusBar:\s*false/,
  "个股 K 线必须使用自包含的窄屏工具栏",
);
assert.match(
  candleSource,
  /candle-heading__source-select/,
  "个股 K 线必须在标题旁提供数据源账号选择器",
);
const realtimeSource = readFileSync(
  join(sourceRoot, "adapters", "mcp-app", "McpPollingMarketRealtimeService.ts"),
  "utf8",
);
assert.match(
  realtimeSource,
  /wantsDepth\s*=\s*Boolean\(\s*listener\.onModeChange\s*\|\|\s*listener\.onDepth\s*\|\|\s*listener\.onTransactions\s*,?\s*\)/,
  "只有订阅盘口的 App 才请求盘口数据",
);
const orderFlowSource = readFileSync(
  join(sourceRoot, "apps", "OrderFlowApp.ts"),
  "utf8",
);
assert.match(
  orderFlowSource,
  /this\.searchResults\.id\s*=\s*["']order-flow-search-results["'];\s*this\.setSearchResultsVisible\(false\);/,
  "逐笔委托的空搜索结果浮层必须默认关闭",
);
assert.match(
  orderFlowSource,
  /this\.searchResults\.hidden\s*=\s*!visible;\s*this\.searchInput\.setAttribute\(["']aria-expanded["'],\s*String\(visible\)\);/,
  "搜索结果浮层的显示状态和无障碍状态必须统一维护",
);

const config = JSON.parse(
  readFileSync(join(root, "mcp-apps", "apps.json"), "utf8"),
);
assert.equal(config.bundleVersion, "0.4.0");
assert.deepEqual(config.apps.map((app) => app.id).sort(), [
  "candle",
  "information",
  "market-quotes",
  "order-flow",
]);
for (const app of config.apps) {
  assert.ok(app.toolPaths.length > 0);
  for (const path of app.toolPaths) assert.match(path, /^\/v2\//);
  assert.match(app.preview.entryTool, /^fqgate_/);
  assert.ok(app.preview.inputs.length > 0);
}

process.stdout.write("MCP Apps 源码边界验收通过。\n");

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return [".ts", ".vue", ".md"].includes(extname(entry.name)) ? [path] : [];
  });
}
