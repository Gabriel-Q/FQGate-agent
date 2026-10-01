import {
  formatCompact,
  formatFetchedAt,
  formatPrice,
} from "@/features/candle/formatters";
import type {
  MarketDetailService,
  MarketSecurity,
  PanoramicOrderBookLevel,
} from "@/shared/contracts";
import { append, button, element, errorText } from "@/ui/dom";
import { VirtualRowList } from "./VirtualRowList";

interface PanoramicRow {
  bid?: PanoramicOrderBookLevel;
  ask?: PanoramicOrderBookLevel;
}

export class PanoramicOrderBookView {
  readonly root = element("section", "market-detail-view panoramic-order-book");

  private readonly title = element("strong", "market-detail-title", "全景 500 档");
  private readonly meta = element("span", "market-detail-meta", "等待读取");
  private readonly status = element("div", "market-detail-status");
  private readonly refreshButton = button("刷新", "market-detail-refresh");
  private readonly list = new VirtualRowList<PanoramicRow>(25, (item) =>
    this.renderRow(item),
  );
  private security?: MarketSecurity;
  private request?: AbortController;
  private version = 0;

  constructor(
    private readonly service: MarketDetailService,
    onBack: () => void,
  ) {
    this.root.hidden = true;
    this.root.setAttribute("aria-label", "全景 500 档");
    const toolbar = element("header", "market-detail-toolbar");
    const back = button("‹ 返回 K 线", "market-detail-back");
    back.addEventListener("click", onBack);
    this.refreshButton.addEventListener("click", () => void this.load());
    append(toolbar, back, this.title, this.meta, this.refreshButton);
    const head = element("div", "panoramic-header");
    head.setAttribute("role", "row");
    for (const label of ["买档", "买价", "数量", "卖档", "卖价", "数量"] as const) {
      const cell = element("span", undefined, label);
      cell.setAttribute("role", "columnheader");
      head.append(cell);
    }
    this.list.root.setAttribute("role", "table");
    this.list.root.setAttribute("aria-label", "全景买卖盘口");
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    append(this.root, toolbar, head, this.list.root, this.status);
  }

  open(security: MarketSecurity): void {
    this.security = { ...security };
    this.root.hidden = false;
    void this.load();
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
    this.setBusy(true, "正在读取全景盘口…");
    try {
      const data = await this.service.getPanoramicOrderBook(
        this.security,
        controller.signal,
      );
      if (version !== this.version) return;
      const count = Math.max(data.bids.length, data.asks.length);
      this.list.setItems(
        Array.from({ length: count }, (_, index) => ({
          bid: data.bids[index],
          ask: data.asks[index],
        })),
      );
      this.meta.textContent = `买 ${data.bids.length} · 卖 ${data.asks.length} · ${formatFetchedAt(data.fetchedAt)}`;
      this.status.textContent = count ? "" : "当前没有可显示的全景盘口数据";
      this.status.classList.remove("is-error");
    } catch (error) {
      if (controller.signal.aborted || version !== this.version) return;
      this.status.textContent = errorText(error, "全景盘口读取失败，请稍后重试。");
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

  private renderRow(item: PanoramicRow): HTMLElement {
    const row = element("div", "panoramic-row");
    row.setAttribute("role", "row");
    append(
      row,
      dataCell(item.bid ? `买${item.bid.position}` : "—", "depth-label is-buy"),
      dataCell(item.bid ? formatPrice(item.bid.price) : "—", "numeric is-fall"),
      dataCell(item.bid ? formatCompact(item.bid.volume) : "—", "numeric depth-volume"),
      dataCell(item.ask ? `卖${item.ask.position}` : "—", "depth-label is-sell"),
      dataCell(item.ask ? formatPrice(item.ask.price) : "—", "numeric is-rise"),
      dataCell(item.ask ? formatCompact(item.ask.volume) : "—", "numeric depth-volume"),
    );
    return row;
  }
}

function dataCell(value: string, className: string): HTMLElement {
  const cell = element("span", className, value);
  cell.setAttribute("role", "cell");
  return cell;
}
