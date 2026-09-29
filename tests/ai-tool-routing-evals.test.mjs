import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixture = JSON.parse(readFileSync(join(root, "tests/fixtures/ai-tool-routing-evals.json"), "utf8"));
const appConfig = JSON.parse(readFileSync(join(root, "mcp-apps/mcp-apps/apps.json"), "utf8"));
const skills = new Set(
  readdirSync(join(root, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, "skills", entry.name, "SKILL.md")))
    .map((entry) => entry.name)
);

const categories = ["market", "chart", "screener", "information", "order-flow", "boundary", "ui"];
const appTools = {
  candle: new Set(["fqgate_bar_series", "fqgate_intraday_series"]),
  information: new Set(["fqgate_information_articles", "fqgate_information_major_events"]),
  "market-quotes": new Set(["fqgate_quote_mainland"]),
  "order-flow": new Set([
    "fqgate_level2_order_events",
    "fqgate_level2_trade_ticks",
    "fqgate_level2_cancellations_buy",
    "fqgate_level2_cancellations_sell"
  ])
};

const flatten = (entry) => entry.expectedTools.sequences.flat();
const unsupportedAccountOrTradingTool = /^fqgate_(?:login|session|portfolio|account_(?!watchlist)|order_(?:place|submit|cancel)|trade_(?:buy|sell))/;

test("路由评测覆盖四个 Skill、无工具边界和全部 MCP Apps", () => {
  assert.equal(fixture.schemaVersion, 2);
  assert.ok(fixture.cases.length >= 21);
  const ids = new Set();
  const categoryCounts = new Map(categories.map((category) => [category, 0]));
  const usedSkills = new Set();
  const usedApps = new Set();
  for (const entry of fixture.cases) {
    assert.match(entry.id, /^[a-z0-9-]+-\d{3}$/);
    assert.equal(ids.has(entry.id), false, `评测编号重复：${entry.id}`);
    ids.add(entry.id);
    assert.ok(categories.includes(entry.category), `${entry.id} 分类无效`);
    categoryCounts.set(entry.category, categoryCounts.get(entry.category) + 1);
    assert.match(entry.prompt, /[\u3400-\u9fff]/);
    if (entry.expectedSkill !== null) {
      assert.ok(skills.has(entry.expectedSkill), `${entry.id} 引用了不存在的 Skill`);
      usedSkills.add(entry.expectedSkill);
    }
    assert.ok(["ordered", "oneOf", "none"].includes(entry.expectedTools.mode));
    if (entry.expectedTools.mode === "none") {
      assert.deepEqual(entry.expectedTools.sequences, []);
    } else {
      assert.ok(entry.expectedTools.sequences.length > 0);
      for (const tool of flatten(entry)) assert.match(tool, /^fqgate_[a-z0-9_]+$/);
    }
    assert.ok(entry.forbidden.length > 0);
    for (const rule of entry.forbidden) assert.ok(rule in fixture.forbiddenBehaviors);
    if (entry.expectedUi) {
      assert.ok(appTools[entry.expectedUi], `${entry.id} 引用了不存在的 App`);
      assert.ok(flatten(entry).some((tool) => appTools[entry.expectedUi].has(tool)));
      usedApps.add(entry.expectedUi);
    }
  }
  for (const [category, count] of categoryCounts) assert.ok(count >= 3, `${category} 覆盖不足`);
  assert.deepEqual([...usedSkills].sort(), [...skills].sort());
  assert.deepEqual([...usedApps].sort(), Object.keys(appTools).sort());
  assert.deepEqual(
    appConfig.apps.map((app) => app.id).sort(),
    Object.keys(appTools).sort()
  );
});

test("评测不引用 FQGate 2.0 未发布的登录、账户或交易工具", () => {
  for (const entry of fixture.cases) {
    for (const tool of flatten(entry)) {
      assert.doesNotMatch(tool, unsupportedAccountOrTradingTool);
    }
  }
  assert.ok(
    fixture.cases.some(
      (entry) =>
        entry.expectedTools.mode === "none" &&
        entry.forbidden.includes("claim-unsupported-account-or-trading")
    )
  );
});

test("Level-2 权限失败与低等级补充数据保持明确区分", () => {
  const cases = fixture.cases.filter((entry) => entry.category === "order-flow");
  assert.ok(cases.some((entry) => entry.forbidden.includes("downgrade-level2-silently")));
  assert.ok(cases.some((entry) => entry.forbidden.includes("infer-actor-identity")));
});
