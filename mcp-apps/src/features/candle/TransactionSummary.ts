import { formatCompact, formatPrice } from "@/features/candle/formatters";
import type {
  MarketDepthMode,
  MarketRealtimePoint,
  MarketTransaction,
} from "@/shared/contracts";
import { append, element, replace } from "@/ui/dom";
import { formatTime } from "@/ui/format";

const BASIC_SUMMARY_ROWS = 6;
const LEVEL2_SUMMARY_ROWS = 2;

export function transactionSummaryRowLimit(mode: MarketDepthMode): number {
  return mode === "level2" ? LEVEL2_SUMMARY_ROWS : BASIC_SUMMARY_ROWS;
}

export class TransactionSummary {
  readonly root = element("section", "transaction-summary");

  private readonly title = element("strong", "transaction-summary__title", "明细");
  private readonly rows = element("div", "transaction-summary__rows");
  private mode: MarketDepthMode = "basic";
  private previousClose: number | null = null;
  private transactions: MarketTransaction[] = [];

  constructor(onOpenDetail: () => void) {
    const header = element("header", "transaction-summary__header");
    append(header, this.title, element("span", "transaction-summary__disclosure", "›"));
    this.rows.setAttribute("role", "table");
    this.rows.setAttribute("aria-label", "最近成交");
    this.root.tabIndex = 0;
    this.root.setAttribute("role", "button");
    this.root.setAttribute("aria-label", "展开成交明细");
    this.root.addEventListener("click", onOpenDetail);
    this.root.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onOpenDetail();
    });
    append(this.root, header, this.rows);
    this.render();
  }

  setMode(mode: MarketDepthMode): void {
    this.mode = mode;
    this.root.setAttribute(
      "aria-label",
      mode === "level2" ? "展开逐笔明细" : "展开成交明细",
    );
    this.render();
  }

  setReferencePrice(previousClose: number | null): void {
    this.previousClose = previousClose;
    this.render();
  }

  update(transactions: readonly MarketTransaction[]): void {
    this.transactions = [...transactions];
    this.render();
  }

  updateIntraday(points: readonly MarketRealtimePoint[]): void {
    if (this.mode === "level2" || !points.length) return;
    const rowLimit = transactionSummaryRowLimit(this.mode);
    let previousVolume: number | null = null;
    this.transactions = points
      .map((point) => {
        const volume =
          point.volume === null || previousVolume === null
            ? null
            : Math.max(0, point.volume - previousVolume);
        previousVolume = point.volume;
        return {
          id: `intraday:${point.timestamp}`,
          timestamp: point.timestamp,
          price: point.price,
          volume,
          amount: null,
          side: "unknown" as const,
        };
      })
      .slice(-rowLimit)
      .reverse();
    this.render();
  }

  reset(): void {
    this.transactions = [];
    this.previousClose = null;
    this.render();
  }

  private render(): void {
    const items = this.transactions.slice(
      0,
      transactionSummaryRowLimit(this.mode),
    );
    if (!items.length) {
      const empty = element("div", "market-detail-empty", "等待成交数据");
      replace(this.rows, empty);
      return;
    }
    replace(
      this.rows,
      ...items.map((item) => {
        const tone = item.side === "buy"
          ? "is-rise"
          : item.side === "sell"
            ? "is-fall"
            : priceTone(item.price, this.previousClose);
        const node = row(
          [formatTime(item.timestamp), formatPrice(item.price), formatCompact(item.volume)],
          tone,
        );
        node.setAttribute(
          "aria-label",
          `${sideLabel(item.side)}，${formatTime(item.timestamp)}，价格 ${formatPrice(item.price)}，数量 ${formatCompact(item.volume)}`,
        );
        return node;
      }),
    );
  }
}

function row(values: readonly string[], className = ""): HTMLElement {
  const node = element("div", `transaction-summary-row ${className}`.trim());
  node.setAttribute("role", "row");
  for (const value of values) {
    const cell = element("span", "numeric", value);
    cell.setAttribute("role", "cell");
    node.append(cell);
  }
  return node;
}

function sideLabel(side: MarketTransaction["side"]): string {
  if (side === "buy") return "主动买入";
  if (side === "sell") return "主动卖出";
  return "成交";
}

function priceTone(price: number | null, previousClose: number | null): string {
  if (price === null || previousClose === null || price === previousClose)
    return "is-flat";
  return price > previousClose ? "is-rise" : "is-fall";
}
