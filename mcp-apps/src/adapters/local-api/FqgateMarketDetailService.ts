import type {
  MarketDepthMode,
  MarketDetailService,
  MarketSecurity,
  MarketTransaction,
  PanoramicOrderBookData,
} from "@/shared/contracts";
import {
  FqgateHttpClient,
  type FqgateHttpClientOptions,
} from "./FqgateHttpClient";
import {
  MARKET_TRANSACTION_LIMIT,
  parseBasicTransactions,
  parseLevel2Transactions,
  parsePanoramicOrderBook,
  type FqgateMarketDataPayload,
  type FqgatePriceRankingData,
} from "./FqgateMarketDataParsers";
import { toFqgateStandardSecurity } from "./FqgateStandardMarket";

/** 按需读取全景盘口和成交明细，避免把大量明细请求放进 K 线首屏轮询。 */
export class FqgateMarketDetailService implements MarketDetailService {
  readonly kind = "fqgate-market-detail";
  private readonly client: FqgateHttpClient;

  constructor(options: FqgateHttpClientOptions = {}) {
    this.client = new FqgateHttpClient({
      ...options,
      timeoutMs: options.timeoutMs ?? 32_000,
    });
  }

  get connection() {
    return this.client.connection;
  }

  async getPanoramicOrderBook(
    security: MarketSecurity,
    signal?: AbortSignal,
  ): Promise<PanoramicOrderBookData> {
    const data = await this.client.post<FqgatePriceRankingData>(
      "/v2/market/level2/order-book-rankings",
      { security: toFqgateStandardSecurity(security) },
      signal,
      30_000,
    );
    return {
      security: completeSecurity(security),
      fetchedAt: new Date().toISOString(),
      ...parsePanoramicOrderBook(data),
    };
  }

  async getTransactionDetails(
    security: MarketSecurity,
    mode: MarketDepthMode,
    signal?: AbortSignal,
  ): Promise<MarketTransaction[]> {
    if (mode === "level2") {
      const data = await this.client.post<FqgateMarketDataPayload>(
        "/v2/market/level2/trade-ticks",
        {
          security: toFqgateStandardSecurity(security),
          range: { type: "recent", count: MARKET_TRANSACTION_LIMIT },
        },
        signal,
        30_000,
      );
      return parseLevel2Transactions(data);
    }
    const data = await this.client.post<FqgateMarketDataPayload>(
      "/v2/market/trade-prints",
      { security: toFqgateStandardSecurity(security) },
      signal,
      30_000,
    );
    return parseBasicTransactions(data);
  }
}

function completeSecurity(security: MarketSecurity): Required<MarketSecurity> {
  return {
    market: security.market,
    code: security.code,
    name: security.name || security.code,
    fullCode: security.fullCode || `${security.market}${security.code}`,
  };
}
