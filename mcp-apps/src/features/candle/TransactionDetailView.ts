import {
  formatCompact,
  formatCurrency,
  formatPrice,
} from "@/features/candle/formatters";
import type {
  MarketDepthMode,
  MarketDetailService,
  MarketSecurity,
  MarketTransaction,
} from "@/shared/contracts";
import { append, button, element, errorText } from "@/ui/dom";
import { formatTime } from "@/ui/format";
import { VirtualRowList } from "./VirtualRowList";

export class TransactionDetailView {
  readonly root = element("section", "market-detail-view transaction-detail");

  private readonly title = element("strong", "market-detail-title", "成交明细");
  private readonly meta = element("span", "market-detail-meta", "等待读取");
  private readonly status = element("div", "market-detail-status");
  private readonly refreshButton = button("刷新", "market-detail-refresh");
  private readonly list = new VirtualRowList<MarketTransaction>(27, (item) =>
    this.renderRow(item),
  );
  private security?: MarketSecurity;
  private mode: MarketDepthMode = "basic";
  private request?: AbortController;
  private version = 0;
  private hasLoaded = false;

  constructor(
    private readonly service: MarketDetailService,
    onBack: () => void,
  ) {
    this.root.hidden = true;
    const toolbar = element("header", "market-detail-toolbar");
    const back = button("‹ 盘口", "market-detail-back");
    back.addEventListener("click", onBack);
    this.refreshButton.addEventListener("click", () => void this.load());
    append(toolbar, back, this.title, this.meta, this.refreshButton);
    const head = element("div", "transaction-detail-header");
    head.setAttribute("role", "row");
    for (const label of ["时间", "成交价", "成交量", "成交额", "方向"] as const) {
      const cell = element("span", undefined, label);
      cell.setAttribute("role", "columnheader");
      head.append(cell);
    }
    this.list.root.setAttribute("role", "table");
    this.list.root.setAttribute("aria-label", "成交明细");
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    append(this.root, toolbar, head, this.list.root, this.status);
  }

  open(security: MarketSecurity, mode: MarketDepthMode): void {
    this.security = { ...security };
    this.mode = mode;
    this.hasLoaded = false;
    this.title.textContent = mode === "level2" ? "逐笔明细" : "成交明细";
    this.root.setAttribute("aria-label", this.title.textContent);
    this.list.root.setAttribute("aria-label", this.title.textContent);
    this.root.hidden = false;
    void this.load();
  }

  sync(transactions: readonly MarketTransaction[], mode: MarketDepthMode): void {
    if (this.root.hidden || !this.hasLoaded || mode !== this.mode) return;
    if (!this.list.isNearStart()) {
      this.status.textContent = "有新成交；返回列表顶部后自动更新";
      this.status.classList.remove("is-error");
      return;
    }
    this.list.setItems(transactions, true);
    this.meta.textContent = `${transactions.length} 条 · 实时更新`;
    this.status.textContent = "";
    this.status.classList.remove("is-error");
  }

  close(): void {
    this.request?.abort();
    this.request = undefined;
    this.root.hidden = true;
  }

  destroy(): void {
    this.close();
    this.list.destroy();
  }

  private async load(): Promise<void> {
    if (!this.security) return;
    const version = ++this.version;
    this.request?.abort();
    const controller = new AbortController();
    this.request = controller;
    this.setBusy(true, `正在读取${this.mode === "level2" ? "逐笔" : "成交"}明细…`);
    try {
      const items = await this.service.getTransactionDetails(
        this.security,
        this.mode,
        controller.signal,
      );
      if (version !== this.version) return;
      this.hasLoaded = true;
      this.list.setItems(items);
      this.meta.textContent = `${items.length} 条`;
      this.status.textContent = items.length ? "" : "当前没有可显示的成交明细";
      this.status.classList.remove("is-error");
    } catch (error) {
      if (controller.signal.aborted || version !== this.version) return;
      this.status.textContent = errorText(error, "成交明细读取失败，请稍后重试。");
      this.status.classList.add("is-error");
    } finally {
      if (version === this.version) this.setBusy(false);
    }
  }

  private setBusy(busy: boolean, message = ""): void {
    this.root.setAttribute("aria-busy", String(busy));
    this.refreshButton.disabled = busy;
    if (busy) {
      this.status.textContent = message;
      this.status.classList.remove("is-error");
    }
  }

  private renderRow(item: MarketTransaction): HTMLElement {
    const tone = item.side === "buy"
      ? "is-rise"
      : item.side === "sell"
        ? "is-fall"
        : "is-flat";
    const row = element("div", "transaction-detail-row");
    row.setAttribute("role", "row");
    append(
      row,
      dataCell(formatTime(item.timestamp), "numeric"),
      dataCell(formatPrice(item.price), `numeric ${tone}`),
      dataCell(formatCompact(item.volume), "numeric"),
      dataCell(formatCurrency(item.amount), "numeric"),
      dataCell(sideLabel(item.side), `transaction-side ${tone}`),
    );
    return row;
  }
}

function dataCell(value: string, className: string): HTMLElement {
  const cell = element("span", className, value);
  cell.setAttribute("role", "cell");
  return cell;
}

function sideLabel(side: MarketTransaction["side"]): string {
  if (side === "buy") return "主动买";
  if (side === "sell") return "主动卖";
  return "中性";
}
