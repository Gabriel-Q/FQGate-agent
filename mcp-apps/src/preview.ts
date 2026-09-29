import {
  FqgateCandleService,
  FqgateInformationService,
  FqgateMarketDetailService,
  FqgateSecuritySearchService,
} from "@/adapters/local-api";
import {
  McpPollingMarketQuoteService,
  McpPollingMarketRealtimeService,
  McpPollingOrderFlowService,
} from "@/adapters/mcp-app";
import { CandleApp } from "@/apps/CandleApp";
import { InformationApp } from "@/apps/InformationApp";
import { MarketQuotesApp } from "@/apps/MarketQuotesApp";
import { OrderFlowApp } from "@/apps/OrderFlowApp";
import type { MarketSecurity } from "@/shared/contracts";
import { append, button, element, requiredRoot } from "@/ui/dom";
import type { NativeApp } from "@/mcp-apps/bootstrap";
import "@/styles/market-ui.css";

const root = requiredRoot();
const shell = element("main", "preview-shell");
const navigation = element("nav", "preview-nav");
const canvas = element("div", "preview-canvas");
const previewSecurity: MarketSecurity = {
  market: "USHA",
  code: "600151",
  fullCode: "USHA600151",
  name: "航天机电",
};
const previewSecurities: MarketSecurity[] = [
  previewSecurity,
  { market: "USHA", code: "600519", name: "贵州茅台" },
  { market: "USHA", code: "600036", name: "招商银行" },
  { market: "USHA", code: "601318", name: "中国平安" },
  { market: "USZA", code: "000001", name: "平安银行" },
  { market: "USZA", code: "300750", name: "宁德时代" },
];
let current: NativeApp | undefined;

const factories: Record<string, () => NativeApp> = {
  candle: () =>
    new CandleApp(canvas, {
      service: new FqgateCandleService(),
      securityService: new FqgateSecuritySearchService(),
      realtimeService: new McpPollingMarketRealtimeService({
        preferredDepthMode: "basic",
      }),
      detailService: new FqgateMarketDetailService(),
      security: previewSecurity,
    }),
  information: () =>
    new InformationApp(canvas, new FqgateInformationService(), previewSecurity),
  "market-quotes": () =>
    new MarketQuotesApp(
      canvas,
      new McpPollingMarketQuoteService(),
      previewSecurities,
    ),
  "order-flow": () =>
    new OrderFlowApp(canvas, new McpPollingOrderFlowService(), previewSecurity),
};

function select(key: string): void {
  const factory = factories[key] ?? factories["market-quotes"]!;
  current?.destroy();
  current = factory();
  current.start?.();
  for (const item of navigation.querySelectorAll<HTMLButtonElement>("button")) {
    item.setAttribute("aria-pressed", String(item.dataset.key === key));
  }
  const url = new URL(window.location.href);
  url.searchParams.set("component", key);
  history.replaceState(null, "", url);
}

for (const [key, label] of [
  ["candle", "个股行情"],
  ["information", "资讯"],
  ["market-quotes", "多股行情"],
  ["order-flow", "逐笔委托"],
] as const) {
  const item = button(label, "button preview-nav__item");
  item.dataset.key = key;
  item.addEventListener("click", () => select(key));
  navigation.append(item);
}
append(shell, navigation, canvas);
root.append(shell);
const initial =
  new URLSearchParams(window.location.search).get("component") ||
  "market-quotes";
select(initial in factories ? initial : "market-quotes");
window.addEventListener("pagehide", () => current?.destroy(), { once: true });
