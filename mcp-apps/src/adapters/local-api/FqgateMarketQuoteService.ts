import type { MarketSecurity } from "@/shared/contracts";
import type { MarketQuotePatch } from "@/features/market-quotes/contracts";
import { marketSecurityKey } from "@/features/market-quotes/contracts";
import { FqgateHttpClient, type FqgateHttpClientOptions } from "./FqgateHttpClient";
import type {
  FqgateStandardQuote,
  FqgateStandardQuoteData
} from "./FqgateMarketDataParsers";
import {
  fqgateStandardSecurityKey,
  toFqgateStandardSecurity
} from "./FqgateStandardMarket";

type RawRecord = Record<string, unknown>;

export type FqgateMarketQuoteServiceOptions = FqgateHttpClientOptions;

const QUOTE_FIELDS = [
  "security_name",
  "latest",
  "previous_close",
  "open",
  "high",
  "low",
  "volume",
  "transaction_amount"
] as const;
const MAX_TREND_POINTS = 64;
const TREND_CONCURRENCY = 4;

/** 只提供 V2 快照读取，供本地预览与 MCP Apps 轮询共同复用。 */
export class FqgateMarketQuoteSnapshotService {
  readonly kind: string = "fqgate-market-quote-snapshot";

  protected readonly client: FqgateHttpClient;

  constructor(options: FqgateHttpClientOptions = {}) {
    this.client = new FqgateHttpClient(options);
  }

  get connection() {
    return this.client.connection;
  }

  async getQuotes(
    securities: readonly MarketSecurity[],
    signal?: AbortSignal
  ): Promise<MarketQuotePatch[]> {
    const groups = groupByMarket(securities);
    const batches = await Promise.all([...groups.values()].map(async (group) => {
      const data = await this.client.post<FqgateStandardQuoteData>("/v2/market/quotes/mainland", {
        securities: group.map(toFqgateStandardSecurity),
        fields: QUOTE_FIELDS
      }, signal);
      return parseStandardQuoteItems(data.items, group);
    }));
    return batches.flat();
  }

  async getIntradayTrends(
    securities: readonly MarketSecurity[],
    signal?: AbortSignal
  ): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();
    let nextIndex = 0;
    const workers = Array.from(
      { length: Math.min(TREND_CONCURRENCY, securities.length) },
      async () => {
        while (!signal?.aborted && nextIndex < securities.length) {
          const security = securities[nextIndex++];
          try {
            const data = await this.client.post<{ items?: unknown }>(
              "/v2/market/intraday",
              { security: toFqgateStandardSecurity(security) },
              signal
            );
            const values = (Array.isArray(data.items) ? data.items : [])
              .map((record) => isRecord(record) ? directNumber(record.latest) : undefined)
              .filter((value): value is number => value !== undefined);
            result.set(marketSecurityKey(security), downsample(values, MAX_TREND_POINTS));
          } catch {
            if (signal?.aborted) return;
            // 趋势属于辅助信息，单只证券失败不能阻断其余快照和实时行情。
            result.set(marketSecurityKey(security), []);
          }
        }
      }
    );
    await Promise.all(workers);
    return result;
  }
}

function groupByMarket(securities: readonly MarketSecurity[]): Map<string, MarketSecurity[]> {
  const groups = new Map<string, MarketSecurity[]>();
  for (const security of uniqueSecurities(securities)) {
    const group = groups.get(security.market) ?? [];
    group.push(security);
    groups.set(security.market, group);
  }
  return groups;
}

function uniqueSecurities(securities: readonly MarketSecurity[]): MarketSecurity[] {
  return [...new Map(securities.map((item) => [marketSecurityKey(item), { ...item }])).values()];
}

function parseStandardQuoteItems(
  items: readonly FqgateStandardQuote[],
  knownSecurities: readonly MarketSecurity[]
): MarketQuotePatch[] {
  const byStandardSecurity = new Map(
    knownSecurities.map((item) => [fqgateStandardSecurityKey(item), item] as const)
  );
  const result: MarketQuotePatch[] = [];
  for (const item of items) {
    const security = byStandardSecurity.get(`${item.security.market}:${item.security.code}`);
    if (!security) continue;
    result.push(compactUndefined({
      security: {
        ...security,
        fullCode: security.fullCode || `${security.market}${security.code}`
      },
      name: displayNameValue(item.security_name),
      latestPrice: directNumber(item.latest),
      previousClose: directNumber(item.previous_close),
      openPrice: directNumber(item.open),
      highPrice: directNumber(item.high),
      lowPrice: directNumber(item.low),
      volume: directNumber(item.volume),
      amount: directNumber(item.transaction_amount),
      receivedAt: Date.now()
    }));
  }
  return result;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function displayNameValue(value: unknown): string | undefined {
  const name = stringValue(value);
  return name && !name.includes("\uFFFD") ? name : undefined;
}

function directNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function downsample(values: number[], limit: number): number[] {
  if (values.length <= limit) return values;
  return Array.from({ length: limit }, (_, index) => {
    const sourceIndex = Math.round(index * (values.length - 1) / (limit - 1));
    return values[sourceIndex];
  });
}

function compactUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

function isRecord(value: unknown): value is RawRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
