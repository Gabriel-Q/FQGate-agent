import { append, button, element, externalLink, replace } from "./dom";

export type FrameConnectionState = "connected" | "reconnecting" | "disconnected";

export interface AppFrameOptions {
  realtime?: boolean;
  refreshable?: boolean;
  statusBar?: boolean;
  onRefresh?: () => void;
}

/** 所有 App 共用的紧凑状态栏、连接反馈与加载遮罩。 */
export class AppFrame {
  readonly content = element("div", "app-frame__content");
  readonly root = element("section", "app-frame");

  private readonly connection = element("span", "connection-status is-disconnected");
  private readonly connectionLabel = element("span", "connection-status__label", "已断开");
  private readonly busyMask = element("div", "busy-mask");
  private readonly busyText = element("span", "busy-mask__text", "正在读取…");
  private readonly refreshButton?: HTMLButtonElement;

  constructor(host: HTMLElement, options: AppFrameOptions = {}) {
    const statusBar = element("header", "app-frame__status");
    const badges = element("div", "app-frame__badges");
    const source = element("span", "source-badge", "免费 AI 量化数据源 · 同花顺");
    const sourceDetail = element("span", "visually-hidden", "FQGate 数据源");
    source.append(sourceDetail);
    append(
      badges,
      source,
      externalLink(
        "GitHub 开源",
        "https://github.com/fqgate/FQGate-agent",
        "opensource-badge"
      )
    );

    const actions = element("div", "app-frame__actions");
    if (options.realtime) {
      const dot = element("span", "connection-status__dot");
      dot.setAttribute("aria-hidden", "true");
      this.connection.setAttribute("role", "status");
      this.connection.setAttribute("aria-live", "polite");
      append(this.connection, dot, this.connectionLabel);
      actions.append(this.connection);
    }
    if (options.refreshable) {
      this.refreshButton = button("↻", "icon-button app-frame__refresh");
      this.refreshButton.title = "刷新数据";
      this.refreshButton.setAttribute("aria-label", "刷新数据");
      this.refreshButton.addEventListener("click", () => options.onRefresh?.());
      actions.append(this.refreshButton);
    }
    append(statusBar, badges, actions);

    const spinner = element("span", "busy-mask__spinner");
    spinner.setAttribute("aria-hidden", "true");
    append(this.busyMask, spinner, this.busyText);
    this.busyMask.setAttribute("role", "status");
    this.busyMask.hidden = true;
    if (options.statusBar === false) {
      this.root.classList.add("app-frame--without-status");
      append(this.root, this.content, this.busyMask);
    } else {
      append(this.root, statusBar, this.content, this.busyMask);
    }
    replace(host, this.root);
  }

  setConnection(state: FrameConnectionState, message?: string): void {
    const label = state === "connected" ? "已连接" : state === "reconnecting" ? "重连中" : "已断开";
    this.connection.className = `connection-status is-${state}`;
    this.connectionLabel.textContent = label;
    this.connection.title = message || label;
  }

  setBusy(busy: boolean, label = "正在读取…"): void {
    this.busyMask.hidden = !busy;
    this.busyText.textContent = label;
    this.root.setAttribute("aria-busy", String(busy));
  }

  setRefreshBusy(busy: boolean): void {
    if (!this.refreshButton) return;
    this.refreshButton.disabled = busy;
    this.refreshButton.classList.toggle("is-spinning", busy);
  }
}
