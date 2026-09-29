import { formatCompact, formatPrice } from "@/features/candle/formatters";
import type {
  MarketDepthLevel,
  MarketDepthMode,
} from "@/shared/contracts";
import { append, element, replace } from "@/ui/dom";

export class OrderBookSummary {
  readonly root = element("section", "order-book-summary");

  private readonly levels = element("div", "order-book-summary__levels");
  private bids: MarketDepthLevel[] = [];
  private asks: MarketDepthLevel[] = [];
  private mode: MarketDepthMode = "basic";
  private previousClose: number | null = null;

  constructor() {
    this.levels.setAttribute("role", "table");
    this.levels.setAttribute("aria-label", "买卖盘口");
    append(this.root, this.levels);
    this.render();
  }

  setMode(mode: MarketDepthMode): void {
    this.mode = mode;
    this.render();
  }

  setReferencePrice(previousClose: number | null): void {
    this.previousClose = previousClose;
    this.render();
  }

  update(
    bids: readonly MarketDepthLevel[],
    asks: readonly MarketDepthLevel[],
  ): void {
    this.bids = [...bids];
    this.asks = [...asks];
    this.render();
  }

  reset(): void {
    this.bids = [];
    this.asks = [];
    this.previousClose = null;
    this.render();
  }

  private render(): void {
    const count = this.mode === "level2" ? 10 : 5;
    const asks = fillLevels(this.asks, count, true);
    const bids = fillLevels(this.bids, count, false);
    const maximum = Math.max(
      1,
      ...asks.map(({ volume }) => volume ?? 0),
      ...bids.map(({ volume }) => volume ?? 0),
    );
    replace(
      this.levels,
      this.headerRow(),
      ...asks.map((level) => this.depthRow(level, "sell", maximum)),
      this.midpoint(),
      ...bids.map((level) => this.depthRow(level, "buy", maximum)),
    );
  }

  private headerRow(): HTMLElement {
    const row = element("div", "order-book-row is-header");
    row.setAttribute("role", "row");
    append(row, cell("档位"), cell("价格"), cell("数量"));
    return row;
  }

  private midpoint(): HTMLElement {
    const row = element("div", "order-book-midpoint");
    append(
      row,
      element("span", "order-book-midpoint__sell", "卖盘"),
      element("span", "order-book-midpoint__buy", "买盘"),
    );
    return row;
  }

  private depthRow(
    level: MarketDepthLevel,
    side: "buy" | "sell",
    maximum: number,
  ): HTMLElement {
    const row = element("div", `order-book-row is-${side}`);
    row.setAttribute("role", "row");
    row.setAttribute(
      "aria-label",
      `${side === "buy" ? "买" : "卖"}${level.level}，价格 ${formatPrice(level.price)}，数量 ${formatCompact(level.volume)}`,
    );
    row.style.setProperty(
      "--depth-ratio",
      `${Math.min(100, ((level.volume ?? 0) / maximum) * 100)}%`,
    );
    append(
      row,
      cell(`${side === "buy" ? "买" : "卖"}${level.level}`, "depth-label"),
      cell(formatPrice(level.price), `numeric ${priceTone(level.price, this.previousClose)}`),
      cell(formatCompact(level.volume), "numeric depth-volume"),
    );
    return row;
  }
}

function fillLevels(
  source: readonly MarketDepthLevel[],
  count: number,
  reverse: boolean,
): MarketDepthLevel[] {
  const byLevel = new Map(source.map((item) => [item.level, item]));
  const result = Array.from({ length: count }, (_, index) => {
    const level = index + 1;
    return byLevel.get(level) ?? { level, price: null, volume: null };
  });
  return reverse ? result.reverse() : result;
}

function cell(value: string, className = ""): HTMLElement {
  const node = element("span", className, value);
  node.setAttribute("role", "cell");
  return node;
}

function priceTone(price: number | null, previousClose: number | null): string {
  if (price === null || previousClose === null || price === previousClose)
    return "is-flat";
  return price > previousClose ? "is-rise" : "is-fall";
}
