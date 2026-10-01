import {
  McpFqgateFetch,
  McpPollingMarketRealtimeService,
} from "@/adapters/mcp-app";
import {
  FqgateCandleService,
  FqgateMarketDetailService,
  FqgateSecuritySearchService,
} from "@/adapters/local-api";
import { CandleApp } from "@/apps/CandleApp";
import type {
  KlineAdjustment,
  KlineInterval,
  MarketDepthPreference,
} from "@/shared/contracts";
import {
  applyPreviewHostActionInset,
  readPreviewSourceContext,
  requestPreviewSourceSelection,
} from "@/shared/previewSource";
import { requiredRoot } from "@/ui/dom";
import {
  FQGATE_LOOPBACK_URL,
  connectMcpApp,
  mountNativeApp,
  readSecurity,
  showEntryError,
} from "./bootstrap";

const KLINE_INTERVALS = new Set<KlineInterval>([
  "intraday",
  "five_day",
  "1m",
  "5m",
  "15m",
  "30m",
  "60m",
  "day",
  "week",
  "month",
]);

async function main(): Promise<void> {
  const runtime = await connectMcpApp("fqgate-candle", "fqgate_bar_series");
  const argumentsValue = await runtime.waitForToolInput();
  const security = readSecurity(argumentsValue);
  if (!security) throw new Error("没有收到个股行情所需的证券代码。");

  const bridge = new McpFqgateFetch(runtime);
  const serviceOptions = {
    baseUrl: FQGATE_LOOPBACK_URL,
    fetch: bridge.fetch,
  };
  const preferredDepthMode = readDepthMode(argumentsValue?.marketDepthMode);
  const previewSource = readPreviewSourceContext(argumentsValue);
  applyPreviewHostActionInset(argumentsValue);
  mountNativeApp(
    new CandleApp(requiredRoot(), {
      service: new FqgateCandleService(serviceOptions),
      securityService: new FqgateSecuritySearchService(serviceOptions),
      realtimeService: new McpPollingMarketRealtimeService({
        ...serviceOptions,
        preferredDepthMode,
      }),
      detailService: new FqgateMarketDetailService(serviceOptions),
      security,
      initialInterval: readInterval(argumentsValue?.interval),
      count: positiveInteger(argumentsValue?.count) ?? 160,
      adjustment: readAdjustment(argumentsValue?.adjustment),
      previewSource,
      onPreviewSourceChange: requestPreviewSourceSelection,
    }),
  );
}

function readDepthMode(value: unknown): MarketDepthPreference {
  return value === "level2" || value === "basic" ? value : "auto";
}

function readInterval(value: unknown): KlineInterval | undefined {
  return typeof value === "string" &&
    KLINE_INTERVALS.has(value as KlineInterval)
    ? (value as KlineInterval)
    : undefined;
}

function readAdjustment(value: unknown): KlineAdjustment {
  return value === "forward" || value === "backward" ? value : "";
}

function positiveInteger(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

void main().catch(showEntryError);
