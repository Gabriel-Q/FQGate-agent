import type {
  InformationData,
  InformationItem,
  InformationService,
  MarketSecurity
} from "@/shared/contracts";
import { AppFrame } from "@/ui/AppFrame";
import { append, button, element, errorText, externalLink, replace } from "@/ui/dom";
import { ServiceRecoveryController } from "@/ui/ServiceRecoveryController";

export class InformationApp {
  private readonly frame: AppFrame;
  private readonly title = element("h1", "panel-title");
  private readonly feed = element("div", "information-feed");
  private readonly status = element("footer", "status-message", "等待资讯数据");
  private readonly recovery: ServiceRecoveryController;
  private data?: InformationData;
  private request?: AbortController;
  private requestVersion = 0;

  constructor(
    host: HTMLElement,
    private readonly service: InformationService,
    private readonly security: MarketSecurity
  ) {
    this.frame = new AppFrame(host, { refreshable: true, onRefresh: () => void this.load(true) });
    const toolbar = element("header", "panel-toolbar");
    toolbar.append(this.title);
    this.feed.setAttribute("aria-live", "polite");
    append(this.frame.content, toolbar, this.feed, this.status);
    this.recovery = new ServiceRecoveryController(service, {
      onReconnecting: (value) => this.frame.setBusy(value && !this.data, "正在重连数据服务…"),
      onRecovered: () => this.load()
    });
    this.render();
  }

  start(): void {
    void this.load();
  }

  destroy(): void {
    this.requestVersion += 1;
    this.request?.abort();
    this.recovery.destroy();
  }

  private async load(force = false): Promise<void> {
    const version = ++this.requestVersion;
    this.request?.abort();
    const controller = new AbortController();
    this.request = controller;
    this.frame.setRefreshBusy(true);
    this.frame.setBusy(!this.data, "正在读取资讯…");
    this.status.classList.remove("is-error");
    this.status.textContent = force ? "正在刷新资讯…" : "正在读取资讯…";
    try {
      const result = await this.service.getInformation({
        security: this.security,
        category: "security"
      }, controller.signal);
      if (version !== this.requestVersion) return;
      this.data = result;
      this.render();
    } catch (reason) {
      if (version !== this.requestVersion || controller.signal.aborted) return;
      if (!this.recovery.handleError(reason)) this.renderError(errorText(reason, "资讯读取失败，请稍后重试。"));
    } finally {
      if (version === this.requestVersion) {
        this.frame.setBusy(false);
        this.frame.setRefreshBusy(false);
      }
    }
  }

  private render(): void {
    const name = this.data?.security.name || this.security.name || this.security.code;
    this.title.textContent = `${name}资讯`;
    replace(this.feed);
    const items = this.data?.items ?? [];
    if (!items.length) {
      this.feed.append(element("div", "empty-state", "暂无资讯"));
    } else {
      const list = element("ul", "information-list");
      for (const item of items) list.append(this.renderItem(item));
      this.feed.append(list);
    }
    const fetched = this.data?.fetchedAt ? formatFetchedAt(this.data.fetchedAt) : "";
    this.status.textContent = `${items.length} 条资讯${fetched ? ` · ${fetched}` : ""}`;
    this.status.classList.remove("is-error");
  }

  private renderItem(item: InformationItem): HTMLLIElement {
    const row = element("li", "information-item");
    const meta = element("div", "information-item__meta");
    const time = element("time", "numeric", formatPublishedAt(item.publishedAt));
    if (item.publishedAt) time.dateTime = new Date(item.publishedAt).toISOString();
    append(meta, time, item.source ? element("span", "information-item__source", item.source) : null);
    if (item.url) meta.append(externalLink("原文 ↗", item.url, "information-item__link"));
    const title = element("h2", "information-item__title", item.title);
    append(row, meta, title, item.summary ? element("p", "information-item__summary", item.summary) : null);
    return row;
  }

  private renderError(message: string): void {
    if (!this.data) {
      const state = element("div", "empty-state");
      const box = element("div", "error-stack");
      const retry = button("重新读取");
      retry.addEventListener("click", () => void this.load(true));
      append(box, element("p", "error-banner", message), retry);
      state.append(box);
      replace(this.feed, state);
    }
    this.status.textContent = message;
    this.status.classList.add("is-error");
  }
}

function formatPublishedAt(value: number | null): string {
  if (!value) return "时间未知";
  const date = new Date(value);
  const sameDay = dateParts(date) === dateParts(new Date());
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    ...(sameDay ? {} : { month: "2-digit", day: "2-digit" }),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function dateParts(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatFetchedAt(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "刚刚更新";
  return `更新于 ${new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(parsed)}`;
}
