import {
  FqgateApiError,
  FqgateHttpClient,
  type FqgateHttpClientOptions
} from "@/adapters/local-api/FqgateHttpClient";
import type { FqgateStandardQuoteData } from "@/adapters/local-api/FqgateMarketDataParsers";
import {
  parseOrderFlowRecords,
  parseStandardOrderFlowQuote
} from "@/adapters/local-api/FqgateOrderFlowParsers";
import { searchFqgateSecurities } from "@/adapters/local-api/FqgateSecuritySearchService";
import { toFqgateStandardSecurity } from "@/adapters/local-api/FqgateStandardMarket";
import type {
  MarketSecurity,
  OrderFlowDataMode,
  OrderFlowRecord,
  OrderFlowWatchConnection,
  OrderFlowWatchListener,
  OrderFlowWatchService
} from "@/shared/contracts";
import { McpPollingConnection, type McpPollingState } from "./McpPollingConnection";

export interface McpPollingOrderFlowServiceOptions extends FqgateHttpClientOptions {
  pollIntervalMs?: number;
}

/** MCP Apps 版逐笔委托，通过 MCP 快照轮询代替组件内 WebSocket。 */
export class McpPollingOrderFlowService implements OrderFlowWatchService {
  readonly kind = "fqgate-mcp-polling";

  private readonly client: FqgateHttpClient;
  private readonly pollIntervalMs: number;

  constructor(options: McpPollingOrderFlowServiceOptions = {}) {
    this.client = new FqgateHttpClient(options);
    this.pollIntervalMs = options.pollIntervalMs ?? 3_000;
  }

  get connection() {
    return this.client.connection;
  }

  searchSecurities(pattern: string, signal?: AbortSignal): Promise<MarketSecurity[]> {
    return searchFqgateSecurities(this.client, pattern, signal);
  }

  async connect(
    security: MarketSecurity,
    listener: OrderFlowWatchListener,
    signal?: AbortSignal
  ): Promise<OrderFlowWatchConnection> {
    let mode: OrderFlowDataMode = "level2";
    listener.onModeChange({ mode });
    const connection = new McpPollingConnection({
      signal,
      intervalMs: this.pollIntervalMs,
      retryIntervalMs: 3_000,
      poll: async (pollSignal) => {
        const quoteData = await this.client.post<FqgateStandardQuoteData>("/v2/market/quotes/mainland", {
          securities: [toFqgateStandardSecurity(security)],
          fields: ["latest", "previous_close"]
        }, pollSignal);
        const quote = parseStandardOrderFlowQuote(quoteData);
        if (quote) listener.onQuote(quote);

        if (mode === "level2") {
          try {
            listener.onRecords(await this.loadLevel2Records(security, pollSignal));
          } catch (error) {
            if (!(error instanceof FqgateApiError) || !isPermissionError(error.code)) throw error;
            mode = "basic";
            listener.onModeChange({ mode, fallbackReason: "permission_denied" });
          }
        }
      },
      onStateChange: (state) => listener.onConnectionState(state, pollingStateMessage(state)),
      onError: (error) => listener.onError(error.message)
    });
    return { close: () => connection.close() };
  }

  private async loadLevel2Records(
    security: MarketSecurity,
    signal: AbortSignal
  ): Promise<OrderFlowRecord[]> {
    const baseRequest = {
      security: toFqgateStandardSecurity(security),
      range: { type: "recent", count: 200 }
    };
    const [orders, buyCancels, sellCancels] = await Promise.all([
      this.client.post<unknown>(
        "/v2/market/level2/order-events",
        baseRequest,
        signal,
        30_000
      ),
      this.client.post<unknown>(
        "/v2/market/level2/cancellations/buy",
        baseRequest,
        signal,
        30_000
      ),
      this.client.post<unknown>(
        "/v2/market/level2/cancellations/sell",
        baseRequest,
        signal,
        30_000
      )
    ]);
    return [
      ...parseOrderFlowRecords(orders, "order", "order_detail"),
      ...parseOrderFlowRecords(buyCancels, "cancel", "buy_cancel"),
      ...parseOrderFlowRecords(sellCancels, "cancel", "sell_cancel")
    ];
  }
}

function isPermissionError(code: number | string): boolean {
  return code === 3006 || code === "PERMISSION_DENIED" || code === "CAPABILITY_UNAVAILABLE";
}

function pollingStateMessage(state: McpPollingState): string {
  if (state === "connected") return "实时数据已连接";
  if (state === "reconnecting") return "实时数据连接中断，正在重试";
  if (state === "closed") return "实时数据已暂停";
  return "正在连接实时数据…";
}
