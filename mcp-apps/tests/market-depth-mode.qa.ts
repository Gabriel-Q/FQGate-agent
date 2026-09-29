import assert from "node:assert/strict";

import { FqgateMarketDepthService } from "../src/adapters/local-api/FqgateMarketDepthService.ts";
import { parseRealtimePoints } from "../src/adapters/local-api/FqgateMarketDataParsers.ts";
import { transactionSummaryRowLimit } from "../src/features/candle/TransactionSummary.ts";

const security = { market: "XSHG", code: "600519", name: "贵州茅台" };

const basicPaths: string[] = [];
const basicService = new FqgateMarketDepthService({
  baseUrl: "http://fqgate-basic.test",
  preferredDepthMode: "basic",
  fetch: createMarketFetch(basicPaths, true),
});
const basic = await basicService.getMarketDepth(security);
assert.equal(basic.mode, "basic");
assert.equal(basic.fallbackReason, "level2_not_enabled");
assert.equal(
  basic.bids[0]?.price,
  1235.5,
  "成交明细失败时不能丢弃已成功的五档盘口",
);
assert.deepEqual(basic.transactions, []);
assert.deepEqual(basicPaths.sort(), [
  "/v2/market/order-books/five-level",
  "/v2/market/trade-prints",
]);

const level2Paths: string[] = [];
const level2Service = new FqgateMarketDepthService({
  baseUrl: "http://fqgate-level2.test",
  preferredDepthMode: "level2",
  fetch: createMarketFetch(level2Paths),
});
const level2 = await level2Service.getMarketDepth(security);
assert.equal(level2.mode, "level2");
assert.equal(level2.fallbackReason, undefined);
assert.deepEqual(level2Paths.sort(), [
  "/v2/market/level2/order-books/ten-level",
  "/v2/market/level2/trade-ticks",
]);
assert.equal(transactionSummaryRowLimit("basic"), 6);
assert.equal(transactionSummaryRowLimit("level2"), 2);

assert.deepEqual(
  parseRealtimePoints({
    items: [
      {
        event_time: "2026-09-29T07:00:00Z",
        latest: 1235.58,
        volume: 2636600,
        transaction_amount: 3260000000,
      },
    ],
  }),
  [
    {
      timestamp: Date.parse("2026-09-29T07:00:00Z"),
      price: 1235.58,
      volume: 2636600,
      amount: 3260000000,
    },
  ],
);

process.stdout.write("盘口数据源按账号 L1/L2 能力自动选择，验收通过。\n");

function createMarketFetch(
  paths: string[],
  failTradePrints = false,
): typeof fetch {
  return async (input) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    if (failTradePrints && url.pathname === "/v2/market/trade-prints") {
      return new Response(
        JSON.stringify({ code: 1099, message: "成交明细暂不可用", data: null }),
        {
          status: 502,
          headers: { "content-type": "application/json" },
        },
      );
    }
    const data = url.pathname.includes("order-books")
      ? {
          items: [
            {
              security: { market: "XSHG", code: "600519" },
              bids: [{ level: 1, price: 1235.5, volume: 100 }],
              asks: [{ level: 1, price: 1235.6, volume: 200 }],
            },
          ],
        }
      : { items: [] };
    return new Response(
      JSON.stringify({ code: 0, message: "操作成功", data }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };
}
