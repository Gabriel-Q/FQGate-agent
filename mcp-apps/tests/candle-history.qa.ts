import assert from "node:assert/strict";

import { FqgateCandleService } from "../src/adapters/local-api/FqgateCandleService.ts";
import { CandleDataRepository } from "../src/features/candle/CandleDataRepository.ts";
import {
  createHistoryQuery,
  initialHistoryEndDate,
  mergeCandleHistory,
  previousHistoryEndDate
} from "../src/features/candle/candleHistory.ts";
import { applyRealtimeQuote } from "../src/features/candle/realtimeCandles.ts";
import type {
  CandleBar,
  CandleData,
  CandleHistoryPage,
  CandleHistoryQuery,
  CandleQuery,
  CandleService
} from "../src/shared/contracts.ts";
import type { DataServiceConnection } from "../src/shared/dataService.ts";

const security = {
  market: "XSHG",
  code: "600519",
  name: "贵州茅台",
  fullCode: "XSHG600519"
};

class FakeCandleService implements CandleService {
  readonly kind = "fake";
  readonly connection: DataServiceConnection = {
    getSnapshot: () => ({ state: "connected", recoveryRevision: 0 }),
    subscribe: () => () => undefined,
    reportUnavailable: () => undefined
  };

  async getCandles(_query: CandleQuery): Promise<CandleData> {
    return candleData("day", ["2026-05-12", "2026-05-13", "2026-05-14"], [20, 30, 40]);
  }

  async getHistory(_query: CandleHistoryQuery): Promise<CandleHistoryPage> {
    throw new Error("本测试不应请求历史服务");
  }
}

const daily = candleData("day", ["2026-05-11", "2026-05-12", "2026-05-13"]);
assert.equal(initialHistoryEndDate(daily), "2026-05-10", "日 K 应从当前最早交易日的前一天继续");
const dailyPage = createHistoryQuery({
  security,
  interval: "day",
  count: 160,
  adjustment: ""
}, initialHistoryEndDate(daily)!);
assert.deepEqual(dailyPage && {
  startDate: dailyPage.startDate,
  endDate: dailyPage.endDate
}, {
  startDate: "2025-05-11",
  endDate: "2026-05-10"
});
assert.equal(previousHistoryEndDate(dailyPage!), "2025-05-10");

const minute = candleData("1m", ["2026-05-13T10:20:00+08:00", "2026-05-13T10:21:00+08:00"]);
assert.equal(initialHistoryEndDate(minute), "2026-05-13", "分钟 K 首次补数必须包含当前最早记录所在交易日");
assert.equal(initialHistoryEndDate(candleData("intraday", ["2026-05-13T10:20:00+08:00"])), null);
assert.equal(initialHistoryEndDate(candleData("five_day", ["2026-05-13T10:20:00+08:00"])), null);

const historicalPage: CandleHistoryPage = {
  security,
  interval: "day",
  startDate: "2026-05-01",
  endDate: "2026-05-11",
  fetchedAt: "2026-05-13T08:00:00Z",
  bars: [bar("2026-05-09", 9), bar("2026-05-11", 999)]
};
const merged = mergeCandleHistory(daily, historicalPage);
assert.equal(merged.addedBefore, 1);
assert.deepEqual(merged.data.bars.map((item) => item.close), [9, 1, 2, 3]);
assert.equal(merged.data.bars[1]!.close, 1, "重叠区间必须保留当前页的较新数据");

const realtimeQuote = {
  updatedAt: Date.parse("2026-05-15T10:00:00+08:00"),
  latestPrice: 5,
  previousClose: 3,
  open: 4,
  high: 5,
  low: 4,
  volume: 100,
  amount: 500,
  turnoverRate: 1
};
const expandedRealtime = applyRealtimeQuote({ ...merged.data, requestedCount: 3 }, realtimeQuote);
assert.deepEqual(
  expandedRealtime.bars.map((item) => item.close),
  [9, 1, 2, 3, 5],
  "实时更新不得裁掉用户已经加载的历史区间"
);
const rollingRealtime = applyRealtimeQuote({ ...daily, requestedCount: 3 }, realtimeQuote);
assert.deepEqual(
  rollingRealtime.bars.map((item) => item.close),
  [2, 3, 5],
  "未扩展历史时仍应维持首屏滚动容量"
);

const service = new FakeCandleService();
const repository = new CandleDataRepository(service);
const baseQuery: CandleQuery = { security, interval: "day", count: 160, adjustment: "" };
repository.store(baseQuery, merged.data);
const refreshed = await repository.load(baseQuery, true);
assert.deepEqual(refreshed.bars.map((item) => item.close), [9, 1, 20, 30, 40]);
assert.equal(refreshed.latest.close, 40, "刷新后摘要应来自最新快照");

let capturedBody: Record<string, unknown> | undefined;
const api = new FqgateCandleService({
  baseUrl: "http://127.0.0.1:17281",
  fetch: async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      code: 0,
      message: "操作成功",
      data: {
        items: [{
          trading_date: "2026-05-09",
          open: 9,
          high: 10,
          low: 8,
          close: 9.5,
          volume: 100,
          transaction_amount: 950
        }]
      }
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
});
const apiPage = await api.getHistory(dailyPage!);
assert.deepEqual(capturedBody, {
  security: { market: "XSHG", code: "600519" },
  range: {
    type: "date_range",
    start_date: "2025-05-11",
    end_date: "2026-05-10"
  },
  adjustment: "none",
  interval: "day"
});
assert.equal(apiPage.bars.length, 1);
assert.equal(apiPage.bars[0]!.close, 9.5);

process.stdout.write("K 线历史日期分页、去重合并和刷新保留验收通过。\n");

function candleData(
  interval: CandleData["interval"],
  timestamps: string[],
  closes = timestamps.map((_, index) => index + 1)
): CandleData {
  const bars = timestamps.map((timestamp, index) => bar(timestamp, closes[index]!));
  const latestBar = bars.at(-1)!;
  return {
    security,
    interval,
    intervalLabel: interval,
    requestedCount: 160,
    fetchedAt: "2026-05-13T08:00:00Z",
    latest: { ...latestBar, change: 1, changePercent: 1 },
    bars
  };
}

function bar(timestamp: string, close: number): CandleBar {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(timestamp)
    ? `${timestamp}T12:00:00+08:00`
    : timestamp;
  return {
    time: Math.floor(Date.parse(normalized) / 1000),
    label: timestamp,
    open: close,
    high: close,
    low: close,
    close,
    volume: close * 10,
    amount: close * 100,
    turnoverRate: null
  };
}
