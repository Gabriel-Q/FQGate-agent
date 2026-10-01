export type VisibilityListener = (visible: boolean) => void;

/** 不可见一段时间后暂停轮询；重新可见时立即恢复。 */
export class VisibilityController {
  private documentVisible = document.visibilityState !== "hidden";
  private intersects = true;
  private enabled = false;
  private hiddenTimer?: number;
  private observer?: IntersectionObserver;

  constructor(
    private readonly target: HTMLElement,
    private readonly listener: VisibilityListener,
    private readonly hiddenDelayMs = 10_000
  ) {
    this.measure();
    document.addEventListener("visibilitychange", this.onDocumentVisibility);
    if (typeof IntersectionObserver === "function") {
      this.observer = new IntersectionObserver(([entry]) => {
        this.intersects = Boolean(entry?.isIntersecting);
        this.apply();
      });
      this.observer.observe(target);
    }
    this.apply();
  }

  isVisible(): boolean {
    return this.enabled;
  }

  destroy(): void {
    if (this.hiddenTimer !== undefined) window.clearTimeout(this.hiddenTimer);
    this.observer?.disconnect();
    document.removeEventListener("visibilitychange", this.onDocumentVisibility);
  }

  private readonly onDocumentVisibility = (): void => {
    this.documentVisible = document.visibilityState !== "hidden";
    this.apply();
  };

  private measure(): void {
    const rect = this.target.getBoundingClientRect();
    this.intersects = rect.width > 0 && rect.height > 0
      && rect.bottom > 0 && rect.right > 0
      && rect.top < window.innerHeight && rect.left < window.innerWidth;
  }

  private apply(): void {
    if (this.hiddenTimer !== undefined) window.clearTimeout(this.hiddenTimer);
    this.hiddenTimer = undefined;
    const visible = this.documentVisible && this.intersects;
    if (visible) {
      if (!this.enabled) {
        this.enabled = true;
        this.listener(true);
      }
      return;
    }
    if (!this.enabled) return;
    this.hiddenTimer = window.setTimeout(() => {
      this.enabled = false;
      this.hiddenTimer = undefined;
      this.listener(false);
    }, this.hiddenDelayMs);
  }
}
