import assert from "node:assert/strict";

import { FqgateMarketDetailService } from "../src/adapters/local-api/FqgateMarketDetailService.ts";

const security = { market: "XSHG", code: "600519", name: "贵州茅台" };
const paths: string[] = [];
const service = new FqgateMarketDetailService({
  baseUrl: "http://fqgate-detail.test",
  fetch: createFetch(paths),
});

const panorama = await service.getPanoramicOrderBook(security);
assert.deepEqual(
  panorama.bids.map(({ position, price, volume }) => ({ position, price, volume })),
  [
    { position: 1, price: 1235.5, volume: 100 },
    { position: 2, price: 1235.4, volume: 200 },
  ],
);
assert.deepEqual(
  panorama.asks.map(({ position, price, volume }) => ({ position, price, volume })),
  [{ position: 1, price: 1235.6, volume: 300 }],
);

const level2 = await service.getTransactionDetails(security, "level2");
assert.equal(level2[0]?.amount, 123_560);
assert.equal(level2[0]?.side, "buy");

const basic = await service.getTransactionDetails(security, "basic");
assert.equal(basic[0]?.amount, 247_100);
assert.equal(basic[0]?.side, "sell");

assert.deepEqual(paths, [
  "/v2/market/level2/order-book-rankings",
  "/v2/market/level2/trade-ticks",
  "/v2/market/trade-prints",
]);

process.stdout.write("全景盘口和成交明细按权限读取真实接口，验收通过。\n");

function createFetch(paths: string[]): typeof fetch {
  return async (input) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    let data: unknown;
    if (path.endsWith("order-book-rankings")) {
      data = {
        items: [
          { side: "sell", position: 1, price: 1235.6, quantity: 300 },
          { side: "buy", position: 2, price: 1235.4, quantity: 200 },
          { side: "buy", position: 1, price: 1235.5, quantity: 100 },
        ],
      };
    } else if (path.endsWith("trade-ticks")) {
      data = {
        items: [
          {
            record_id: "l2-1",
            event_time: "2026-09-30T07:00:00Z",
            price: 1235.6,
            volume: 100,
            amount: 123_560,
            side: "buy",
          },
        ],
      };
    } else {
      data = {
        items: [
          {
            record_id: "l1-1",
            event_time: "2026-09-30T06:59:00Z",
            price: 1235.5,
            quantity: 200,
            transaction_amount: 247_100,
            side: "sell",
          },
        ],
      };
    }
    return new Response(
      JSON.stringify({ code: 0, message: "操作成功", data }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
}
