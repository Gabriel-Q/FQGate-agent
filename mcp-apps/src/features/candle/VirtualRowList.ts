import { element, replace } from "@/ui/dom";

/** 固定行高虚拟列表；全景盘口和逐笔明细共用，避免一次创建数百个节点。 */
export class VirtualRowList<T> {
  readonly root = element("div", "virtual-row-list");

  private readonly canvas = element("div", "virtual-row-list__canvas");
  private readonly viewport = element("div", "virtual-row-list__viewport");
  private readonly resizeObserver: ResizeObserver;
  private items: readonly T[] = [];

  constructor(
    private readonly rowHeight: number,
    private readonly renderRow: (item: T, index: number) => HTMLElement,
  ) {
    this.root.tabIndex = 0;
    this.root.style.setProperty("--virtual-row-height", `${rowHeight}px`);
    this.root.append(this.canvas);
    this.canvas.append(this.viewport);
    this.root.addEventListener("scroll", this.render);
    this.resizeObserver = new ResizeObserver(this.render);
    this.resizeObserver.observe(this.root);
  }

  setItems(items: readonly T[], preserveScroll = false): void {
    this.items = items;
    if (!preserveScroll) this.root.scrollTop = 0;
    this.canvas.style.height = `${items.length * this.rowHeight}px`;
    this.render();
  }

  isNearStart(): boolean {
    return this.root.scrollTop <= this.rowHeight * 2;
  }

  destroy(): void {
    this.root.removeEventListener("scroll", this.render);
    this.resizeObserver.disconnect();
  }

  private readonly render = (): void => {
    const height = this.root.clientHeight || 320;
    const first = Math.max(0, Math.floor(this.root.scrollTop / this.rowHeight) - 6);
    const count = Math.ceil(height / this.rowHeight) + 12;
    const last = Math.min(this.items.length, first + count);
    const rows: HTMLElement[] = [];
    for (let index = first; index < last; index += 1) {
      const item = this.items[index];
      if (item !== undefined) rows.push(this.renderRow(item, index));
    }
    this.viewport.style.transform = `translateY(${first * this.rowHeight}px)`;
    replace(this.viewport, ...rows);
  };
}
