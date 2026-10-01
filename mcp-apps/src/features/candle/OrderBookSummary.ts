import {
  formatCompact,
  formatOrderBookAmount,
  formatPrice,
} from "@/features/candle/formatters";
import type {
  MarketDepthLevel,
  MarketDepthMode,
} from "@/shared/contracts";
import { append, element, replace } from "@/ui/dom";

export interface VisibleDepthStrength {
  buyAmount: number;
  sellAmount: number;
  buyPercent: number;
  sellPercent: number;
  hasData: boolean;
}

/** 计算当前界面实际展示档位的委买、委卖金额占比。 */
export function visibleDepthStrength(
  bids: readonly MarketDepthLevel[],
  asks: readonly MarketDepthLevel[],
): VisibleDepthStrength {
  const buyAmount = sumValidAmounts(bids);
  const sellAmount = sumValidAmounts(asks);
  const totalAmount = buyAmount + sellAmount;
  if (totalAmount <= 0) {
    return {
      buyAmount,
      sellAmount,
      buyPercent: 0,
      sellPercent: 0,
      hasData: false,
    };
  }
  const buyPercent = (buyAmount / totalAmount) * 100;
  return {
    buyAmount,
    sellAmount,
    buyPercent,
    sellPercent: 100 - buyPercent,
    hasData: true,
  };
}

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
      this.strengthRow(bids, asks, count),
      ...bids.map((level) => this.depthRow(level, "buy", maximum)),
    );
  }

  private headerRow(): HTMLElement {
    const row = element("div", "order-book-row is-header");
    row.setAttribute("role", "row");
    append(row, cell("档位"), cell("价格"), cell("金额"));
    return row;
  }

  private strengthRow(
    bids: readonly MarketDepthLevel[],
    asks: readonly MarketDepthLevel[],
    count: number,
  ): HTMLElement {
    const strength = visibleDepthStrength(bids, asks);
    const row = element(
      "div",
      `order-book-strength${strength.hasData ? "" : " is-empty"}`,
    );
    row.setAttribute("role", "row");
    row.style.setProperty(
      "--buy-strength",
      `${strength.hasData ? strength.buyPercent : 50}%`,
    );
    row.style.setProperty(
      "--sell-strength",
      `${strength.hasData ? strength.sellPercent : 50}%`,
    );
    const description = strength.hasData
      ? `${count}档委买金额 ${formatCompact(strength.buyAmount)}元，占 ${strength.buyPercent.toFixed(1)}%；委卖金额 ${formatCompact(strength.sellAmount)}元，占 ${strength.sellPercent.toFixed(1)}%`
      : `当前${count}档暂无有效委托金额`;
    row.setAttribute("aria-label", description);
    row.title = description;
    const track = element("div", "order-book-strength__track");
    track.setAttribute("role", "cell");
    const buy = element("span", "order-book-strength__buy");
    const sell = element("span", "order-book-strength__sell");
    buy.setAttribute("aria-hidden", "true");
    sell.setAttribute("aria-hidden", "true");
    append(track, buy, sell);
    append(row, track);
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
      `${side === "buy" ? "买" : "卖"}${level.level}，价格 ${formatPrice(level.price)}，委托金额 ${formatOrderBookAmount(level.price, level.volume)}元`,
    );
    row.style.setProperty(
      "--depth-ratio",
      `${Math.min(100, ((level.volume ?? 0) / maximum) * 100)}%`,
    );
    append(
      row,
      cell(`${side === "buy" ? "买" : "卖"}${level.level}`, "depth-label"),
      cell(formatPrice(level.price), `numeric ${priceTone(level.price, this.previousClose)}`),
      cell(formatOrderBookAmount(level.price, level.volume), "numeric depth-volume"),
    );
    return row;
  }
}

function sumValidAmounts(levels: readonly MarketDepthLevel[]): number {
  return levels.reduce((sum, { price, volume }) => {
    return price !== null &&
      volume !== null &&
      Number.isFinite(price) &&
      Number.isFinite(volume) &&
      price > 0 &&
      volume > 0
      ? sum + price * volume
      : sum;
  }, 0);
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
