import type {
  MarketDepthFallbackReason,
  MarketDepthLevel,
  MarketDepthMode,
  MarketDetailService,
  MarketRealtimePoint,
  MarketSecurity,
  MarketTransaction,
} from "@/shared/contracts";
import { append, button, element } from "@/ui/dom";
import { OrderBookSummary } from "./OrderBookSummary";
import { PanoramicOrderBookView } from "./PanoramicOrderBookView";
import { TransactionDetailView } from "./TransactionDetailView";
import { TransactionSummary } from "./TransactionSummary";

type InspectorState = "summary" | "panorama" | "transactions";
export type MarketInspectorWorkspaceMode = "split" | "panorama";

export interface MarketInspectorOptions {
  security: MarketSecurity;
  detailService: MarketDetailService;
  onWorkspaceModeChange(mode: MarketInspectorWorkspaceMode): void;
}

/** K 线右侧行情钻取控制器：盘口与成交明细留在侧栏，全景盘口独占工作区。 */
export class MarketInspector {
  readonly root = element("aside", "market-inspector");

  private readonly summary = element("div", "market-inspector-summary");
  private readonly title = element("strong", "market-inspector-title", "五档");
  private readonly panoramaButton = button(
    "全景 500 档",
    "market-inspector-panorama",
  );
  private readonly orderBook: OrderBookSummary;
  private readonly transactions: TransactionSummary;
  private readonly panorama: PanoramicOrderBookView;
  private readonly transactionDetail: TransactionDetailView;
  private security: MarketSecurity;
  private mode: MarketDepthMode = "basic";
  private state: InspectorState = "summary";

  constructor(private readonly options: MarketInspectorOptions) {
    this.security = { ...options.security };
    this.orderBook = new OrderBookSummary();
    this.transactions = new TransactionSummary(() => this.openTransactions());
    this.panorama = new PanoramicOrderBookView(options.detailService, () =>
      this.showSummary(),
    );
    this.transactionDetail = new TransactionDetailView(
      options.detailService,
      () => this.showSummary(),
    );
    this.build();
    this.renderState();
  }

  setSecurity(security: MarketSecurity): void {
    this.security = { ...security };
    this.showSummary();
    this.reset();
  }

  setMode(
    mode: MarketDepthMode,
    _fallbackReason?: MarketDepthFallbackReason,
  ): void {
    const changed = this.mode !== mode;
    this.mode = mode;
    this.orderBook.setMode(mode);
    this.transactions.setMode(mode);
    if (changed && (this.state === "panorama" || this.state === "transactions")) {
      this.showSummary();
    }
    this.renderMode();
  }

  setReferencePrice(previousClose: number | null): void {
    this.orderBook.setReferencePrice(previousClose);
    this.transactions.setReferencePrice(previousClose);
  }

  updateDepth(
    bids: readonly MarketDepthLevel[],
    asks: readonly MarketDepthLevel[],
  ): void {
    this.orderBook.update(bids, asks);
  }

  updateTransactions(transactions: readonly MarketTransaction[]): void {
    this.transactions.update(transactions);
    this.transactionDetail.sync(transactions, this.mode);
  }

  updateIntraday(points: readonly MarketRealtimePoint[]): void {
    this.transactions.updateIntraday(points);
  }

  reset(): void {
    this.orderBook.reset();
    this.transactions.reset();
  }

  destroy(): void {
    this.panorama.destroy();
    this.transactionDetail.destroy();
  }

  private build(): void {
    this.root.setAttribute("aria-label", "盘口与成交");
    this.root.tabIndex = -1;
    const header = element("header", "market-inspector-header");
    this.panoramaButton.title = "查看全景 500 档";
    this.panoramaButton.addEventListener("click", () => this.openPanorama());
    append(header, this.title, this.panoramaButton);

    this.orderBook.root.id = "market-inspector-order-book";
    this.transactions.root.id = "market-inspector-transactions";
    append(this.summary, header, this.orderBook.root, this.transactions.root);
    append(this.root, this.summary, this.panorama.root, this.transactionDetail.root);
    this.root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (this.state !== "summary") {
        event.preventDefault();
        this.showSummary();
      }
    });
  }

  private openPanorama(): void {
    if (this.mode !== "level2") return;
    this.state = "panorama";
    this.options.onWorkspaceModeChange("panorama");
    this.renderState();
    this.panorama.open(this.security);
  }

  private openTransactions(): void {
    this.state = "transactions";
    this.options.onWorkspaceModeChange("split");
    this.renderState();
    this.transactionDetail.open(this.security, this.mode);
  }

  private showSummary(): void {
    this.panorama.close();
    this.transactionDetail.close();
    this.state = "summary";
    this.options.onWorkspaceModeChange("split");
    this.renderState();
  }

  private renderState(): void {
    const panorama = this.state === "panorama";
    const transactions = this.state === "transactions";
    this.summary.hidden = panorama || transactions;
    this.panorama.root.hidden = this.state !== "panorama";
    this.transactionDetail.root.hidden = this.state !== "transactions";
    this.root.classList.toggle("is-panorama", panorama);
    this.root.classList.toggle("is-transactions", transactions);
    this.renderMode();
  }

  private renderMode(): void {
    this.title.textContent = this.mode === "level2" ? "十档" : "五档";
    this.panoramaButton.hidden = this.mode !== "level2";
  }
}
