import { McpFqgateFetch, McpPollingMarketQuoteService } from "@/adapters/mcp-app";
import { MarketQuotesApp } from "@/apps/MarketQuotesApp";
import { requiredRoot } from "@/ui/dom";
import {
  FQGATE_LOOPBACK_URL,
  connectMcpApp,
  mountNativeApp,
  readSecurities,
  showEntryError
} from "./bootstrap";

async function main(): Promise<void> {
  const runtime = await connectMcpApp("fqgate-market-quotes", "fqgate_quote_mainland");
  const securities = readSecurities(await runtime.waitForToolInput());
  if (securities.length === 0) throw new Error("没有收到多股行情所需的证券列表。");

  const bridge = new McpFqgateFetch(runtime);
  const service = new McpPollingMarketQuoteService({
    baseUrl: FQGATE_LOOPBACK_URL,
    fetch: bridge.fetch
  });
  mountNativeApp(new MarketQuotesApp(requiredRoot(), service, securities));
}

void main().catch(showEntryError);
