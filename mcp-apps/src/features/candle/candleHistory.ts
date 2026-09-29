import type {
  CandleData,
  CandleHistoryPage,
  CandleHistoryQuery,
  CandleQuery,
  KlineInterval
} from "@/shared/contracts";
import { isLineKlineInterval } from "@/shared/kline";

const SHANGHAI_OFFSET_SECONDS = 8 * 60 * 60;

/**
 * 日期范围接口按自然日取数。窗口覆盖量按各周期约 160 根 K 线设计，并额外
 * 容纳周末、节假日和停牌间隔，避免用户一次左拖触发多个连续请求。
 */
const HISTORY_WINDOW_DAYS: Partial<Record<KlineInterval, number>> = {
  "1m": 7,
  "5m": 14,
  "15m": 35,
  "30m": 70,
  "60m": 140,
  day: 365,
  week: 5 * 365,
  month: 20 * 365
};

export interface CandleHistoryMerge {
  data: CandleData;
  addedBefore: number;
}

export function initialHistoryEndDate(data: CandleData): string | null {
  const earliest = data.bars.at(0);
  if (!earliest || isLineKlineInterval(data.interval)) return null;
  const earliestDate = shanghaiDateKey(earliest.time);

  // count 查询的分钟 K 可能从交易日中段开始，第一页必须包含当天以补齐日内更早数据。
  // 日、周、月 K 每根只对应一个交易日期，可直接从前一天开始，避免重复请求。
  return data.interval.endsWith("m") ? earliestDate : addDays(earliestDate, -1);
}

export function createHistoryQuery(
  base: CandleQuery,
  endDate: string
): CandleHistoryQuery | null {
  const windowDays = HISTORY_WINDOW_DAYS[base.interval];
  if (!windowDays) return null;
  return {
    security: base.security,
    interval: base.interval,
    startDate: addDays(endDate, 1 - windowDays),
    endDate,
    adjustment: base.adjustment
  };
}

export function previousHistoryEndDate(query: CandleHistoryQuery): string {
  return addDays(query.startDate, -1);
}

export function mergeCandleHistory(
  current: CandleData,
  page: CandleHistoryPage
): CandleHistoryMerge {
  assertCompatible(current, page);
  const earliest = current.bars.at(0)?.time ?? Number.POSITIVE_INFINITY;
  const byTime = new Map(page.bars.map((bar) => [bar.time, bar]));
  for (const bar of current.bars) byTime.set(bar.time, bar);
  const bars = [...byTime.values()].sort((left, right) => left.time - right.time);
  return {
    data: { ...current, bars },
    addedBefore: bars.filter((bar) => bar.time < earliest).length
  };
}

/** 用最新快照覆盖重叠区间，同时保留此前已经加载的历史区间。 */
export function mergeLatestCandles(cached: CandleData, latest: CandleData): CandleData {
  if (!sameSeries(cached, latest)) return latest;
  const byTime = new Map(cached.bars.map((bar) => [bar.time, bar]));
  for (const bar of latest.bars) byTime.set(bar.time, bar);
  return {
    ...latest,
    bars: [...byTime.values()].sort((left, right) => left.time - right.time)
  };
}

function assertCompatible(current: CandleData, page: CandleHistoryPage): void {
  if (
    current.interval !== page.interval
    || current.security.market !== page.security.market
    || current.security.code !== page.security.code
  ) {
    throw new Error("历史 K 线与当前证券或周期不一致。");
  }
}

function sameSeries(left: CandleData, right: CandleData): boolean {
  return left.interval === right.interval
    && left.security.market === right.security.market
    && left.security.code === right.security.code;
}

function shanghaiDateKey(unixSeconds: number): string {
  const date = new Date((unixSeconds + SHANGHAI_OFFSET_SECONDS) * 1000);
  return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function addDays(value: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`K 线日期无效：${value}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function dateKey(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}
