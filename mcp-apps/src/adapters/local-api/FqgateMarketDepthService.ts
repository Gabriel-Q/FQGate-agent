import type {
  MarketDepthData,
  MarketDepthFallbackReason,
  MarketDepthLevel,
  MarketDepthMode,
  MarketDepthPreference,
  MarketDepthService,
  MarketSecurity,
  MarketTransaction,
} from "@/shared/contracts";
import {
  FqgateApiError,
  FqgateHttpClient,
  type FqgateHttpClientOptions,
} from "./FqgateHttpClient";
import {
  MARKET_TRANSACTION_LIMIT,
  parseBasicTransactions,
  parseLevel2Transactions,
  parseStandardOrderBook,
  type FqgateMarketDataPayload,
  type FqgateStandardOrderBookData,
} from "./FqgateMarketDataParsers";
import { toFqgateStandardSecurity } from "./FqgateStandardMarket";

interface LoadedMarketDetails {
  bids: MarketDepthLevel[];
  asks: MarketDepthLevel[];
  transactions: MarketTransaction[];
}

export interface FqgateMarketDepthServiceOptions extends FqgateHttpClientOptions {
  preferredDepthMode?: MarketDepthPreference;
}

/**
 * FQGate 个股盘口快照适配器。它负责首屏和断线重同步，持续更新由
 * McpPollingMarketRealtimeService 接管，二者共享同一套字段解析规则。
 */
export class FqgateMarketDepthService implements MarketDepthService {
  readonly kind = "fqgate-local-api";
  private readonly client: FqgateHttpClient;
  private readonly preferredDepthMode: MarketDepthPreference;

  constructor(options: FqgateMarketDepthServiceOptions = {}) {
    const { preferredDepthMode = "auto", ...clientOptions } = options;
    this.preferredDepthMode = preferredDepthMode;
    this.client = new FqgateHttpClient({
      ...clientOptions,
      timeoutMs: clientOptions.timeoutMs ?? 32_000,
    });
  }

  get connection() {
    return this.client.connection;
  }

  async getMarketDepth(
    security: MarketSecurity,
    signal?: AbortSignal,
  ): Promise<MarketDepthData> {
    if (this.preferredDepthMode === "basic") {
      return this.toResult(
        security,
        "basic",
        "level2_not_enabled",
        await this.loadBasic(security, signal),
      );
    }
    try {
      return this.toResult(
        security,
        "level2",
        undefined,
        await this.loadLevel2(security, signal),
      );
    } catch (error) {
      if (!(error instanceof FqgateApiError) || !isPermissionError(error.code))
        throw error;
      return this.toResult(
        security,
        "basic",
        "permission_denied",
        await this.loadBasic(security, signal),
      );
    }
  }

  private async loadLevel2(
    security: MarketSecurity,
    signal?: AbortSignal,
  ): Promise<LoadedMarketDetails> {
    const [depthResult, transactionResult] = await Promise.allSettled([
      this.client.post<FqgateStandardOrderBookData>(
        "/v2/market/level2/order-books/ten-level",
        { securities: [toFqgateStandardSecurity(security)] },
        signal,
        30_000,
      ),
      this.client.post<FqgateMarketDataPayload>(
        "/v2/market/level2/trade-ticks",
        {
          security: toFqgateStandardSecurity(security),
          range: { type: "recent", count: MARKET_TRANSACTION_LIMIT },
        },
        signal,
        30_000,
      ),
    ]);
    const permissionFailure = [depthResult, transactionResult].find(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof FqgateApiError &&
        isPermissionError(result.reason.code),
    );
    if (permissionFailure?.status === "rejected")
      throw permissionFailure.reason;
    if (
      depthResult.status === "rejected" &&
      transactionResult.status === "rejected"
    )
      throw depthResult.reason;
    return {
      ...(depthResult.status === "fulfilled"
        ? parseStandardOrderBook(depthResult.value, 10)
        : emptyDepth(10)),
      transactions:
        transactionResult.status === "fulfilled"
          ? parseLevel2Transactions(transactionResult.value)
          : [],
    };
  }

  private async loadBasic(
    security: MarketSecurity,
    signal?: AbortSignal,
  ): Promise<LoadedMarketDetails> {
    const [depthResult, transactionResult] = await Promise.allSettled([
      this.client.post<FqgateStandardOrderBookData>(
        "/v2/market/order-books/five-level",
        { securities: [toFqgateStandardSecurity(security)] },
        signal,
        30_000,
      ),
      this.client.post<FqgateMarketDataPayload>(
        "/v2/market/trade-prints",
        { security: toFqgateStandardSecurity(security) },
        signal,
        30_000,
      ),
    ]);
    if (
      depthResult.status === "rejected" &&
      transactionResult.status === "rejected"
    )
      throw depthResult.reason;
    return {
      ...(depthResult.status === "fulfilled"
        ? parseStandardOrderBook(depthResult.value, 5)
        : emptyDepth(5)),
      transactions:
        transactionResult.status === "fulfilled"
          ? parseBasicTransactions(transactionResult.value)
          : [],
    };
  }

  private toResult(
    security: MarketSecurity,
    mode: MarketDepthMode,
    fallbackReason: MarketDepthFallbackReason | undefined,
    loaded: LoadedMarketDetails,
  ): MarketDepthData {
    return {
      security: completeSecurity(security),
      mode,
      fallbackReason,
      fetchedAt: new Date().toISOString(),
      ...loaded,
    };
  }
}

function emptyDepth(levelCount: 5 | 10): {
  bids: MarketDepthLevel[];
  asks: MarketDepthLevel[];
} {
  const levels = () =>
    Array.from({ length: levelCount }, (_, index) => ({
      level: index + 1,
      price: null,
      volume: null,
    }));
  return { bids: levels(), asks: levels() };
}

function isPermissionError(code: number | string): boolean {
  return (
    code === 3006 ||
    code === "PERMISSION_DENIED" ||
    code === "CAPABILITY_UNAVAILABLE"
  );
}

function completeSecurity(security: MarketSecurity): Required<MarketSecurity> {
  return {
    market: security.market,
    code: security.code,
    name: security.name || security.code,
    fullCode: security.fullCode || `${security.market}${security.code}`,
  };
}
