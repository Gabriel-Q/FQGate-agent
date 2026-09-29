import {
  FqgateHttpClient,
  type FqgateHttpClientOptions,
} from "@/adapters/local-api/FqgateHttpClient";
import { FqgateMarketDepthService } from "@/adapters/local-api/FqgateMarketDepthService";
import {
  parseRealtimePoints,
  parseStandardRealtimeQuote,
  type FqgateMarketDataPayload,
  type FqgateStandardQuoteData,
} from "@/adapters/local-api/FqgateMarketDataParsers";
import { toFqgateStandardSecurity } from "@/adapters/local-api/FqgateStandardMarket";
import type {
  MarketDepthFallbackReason,
  MarketDepthMode,
  MarketDepthPreference,
  MarketRealtimeConnection,
  MarketRealtimeListener,
  MarketRealtimeService,
  MarketSecurity,
} from "@/shared/contracts";
import {
  McpPollingConnection,
  type McpPollingState,
} from "./McpPollingConnection";

export interface McpPollingMarketRealtimeServiceOptions extends FqgateHttpClientOptions {
  pollIntervalMs?: number;
  detailEvery?: number;
  preferredDepthMode?: MarketDepthPreference;
}

/** MCP Apps 版个股实时层，不从组件沙箱直接访问 WebSocket。 */
export class McpPollingMarketRealtimeService implements MarketRealtimeService {
  readonly kind = "fqgate-mcp-polling";

  private readonly client: FqgateHttpClient;
  private readonly marketDepthService: FqgateMarketDepthService;
  private readonly pollIntervalMs: number;
  private readonly detailEvery: number;
  private readonly preferredDepthMode: MarketDepthPreference;

  constructor(options: McpPollingMarketRealtimeServiceOptions = {}) {
    const { preferredDepthMode = "auto", ...clientOptions } = options;
    this.client = new FqgateHttpClient(clientOptions);
    this.marketDepthService = new FqgateMarketDepthService(options);
    this.preferredDepthMode = preferredDepthMode;
    this.pollIntervalMs = options.pollIntervalMs ?? 3_000;
    this.detailEvery = Math.max(1, options.detailEvery ?? 5);
  }

  get connection() {
    return this.client.connection;
  }

  async connect(
    security: MarketSecurity,
    listener: MarketRealtimeListener,
    signal?: AbortSignal,
  ): Promise<MarketRealtimeConnection> {
    let successfulPolls = 0;
    const initialMode: MarketDepthMode =
      this.preferredDepthMode === "level2" ? "level2" : "basic";
    const initialFallbackReason: MarketDepthFallbackReason | undefined =
      this.preferredDepthMode === "basic"
        ? "level2_not_enabled"
        : this.preferredDepthMode === "auto"
          ? "level2_unknown"
          : undefined;
    listener.onModeChange?.(initialMode, initialFallbackReason);

    const connection = new McpPollingConnection({
      signal,
      intervalMs: this.pollIntervalMs,
      retryIntervalMs: 3_000,
      poll: async (pollSignal) => {
        const refreshDetails = successfulPolls % this.detailEvery === 0;
        const quoteData = await this.client.post<FqgateStandardQuoteData>(
          "/v2/market/quotes/mainland",
          {
            securities: [toFqgateStandardSecurity(security)],
            fields: [
              "security_name",
              "previous_close",
              "open",
              "high",
              "low",
              "latest",
              "volume",
              "transaction_amount",
            ],
          },
          pollSignal,
        );
        const quote = parseStandardRealtimeQuote(quoteData);
        if (quote) listener.onQuote(quote);

        if (refreshDetails) {
          await this.refreshDetails(security, listener, pollSignal);
        }
        successfulPolls += 1;
      },
      onStateChange: (state) =>
        listener.onConnectionState(state, pollingStateMessage(state)),
      onError: (error) => listener.onError(error.message),
    });
    return { close: () => connection.close() };
  }

  /** 整段分时变化较慢，降低刷新频率，避免给 AI 工具造成高频调用压力。 */
  private async refreshDetails(
    security: MarketSecurity,
    listener: MarketRealtimeListener,
    signal: AbortSignal,
  ): Promise<void> {
    const wantsDepth = Boolean(
      listener.onModeChange || listener.onDepth || listener.onTransactions,
    );
    const [intraday, depth] = await Promise.allSettled([
      this.client.post<FqgateMarketDataPayload>(
        "/v2/market/intraday",
        { security: toFqgateStandardSecurity(security) },
        signal,
      ),
      wantsDepth
        ? this.marketDepthService.getMarketDepth(security, signal)
        : Promise.resolve(undefined),
    ]);
    if (intraday.status === "fulfilled") {
      const points = parseRealtimePoints(intraday.value);
      if (points.length) listener.onIntraday(points);
    }
    if (depth.status === "fulfilled" && depth.value) {
      listener.onModeChange?.(depth.value.mode, depth.value.fallbackReason);
      listener.onDepth?.(depth.value.bids, depth.value.asks);
      if (depth.value.transactions.length)
        listener.onTransactions?.(depth.value.transactions);
    }
  }
}

function pollingStateMessage(state: McpPollingState): string {
  if (state === "connected") return "实时行情已连接";
  if (state === "reconnecting") return "实时行情连接中断，正在重试";
  if (state === "closed") return "实时行情已暂停";
  return "正在连接实时行情…";
}
