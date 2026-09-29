import type { DataServiceAvailability } from "@/shared/dataService";
import { isDataServiceUnavailableError } from "@/shared/dataService";

export interface ServiceRecoveryCallbacks {
  onReconnecting?(reconnecting: boolean): void;
  onRecovered?(): Promise<void> | void;
}

/** 把共享数据连接状态转成与具体渲染框架无关的恢复生命周期。 */
export class ServiceRecoveryController {
  private seenRevision: number;
  private recoveryRun = 0;
  private stopped = false;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly service: DataServiceAvailability,
    private readonly callbacks: ServiceRecoveryCallbacks
  ) {
    const initial = service.connection.getSnapshot();
    this.seenRevision = initial.recoveryRevision;
    callbacks.onReconnecting?.(initial.state === "reconnecting");
    this.unsubscribe = service.connection.subscribe((snapshot) => {
      if (this.stopped) return;
      callbacks.onReconnecting?.(snapshot.state === "reconnecting");
      if (snapshot.recoveryRevision <= this.seenRevision) return;
      this.seenRevision = snapshot.recoveryRevision;
      const run = ++this.recoveryRun;
      void Promise.resolve(callbacks.onRecovered?.()).finally(() => {
        if (!this.stopped && run === this.recoveryRun) callbacks.onReconnecting?.(false);
      });
    });
  }

  handleError(error: unknown): boolean {
    if (!isDataServiceUnavailableError(error)) return false;
    this.service.connection.reportUnavailable();
    return true;
  }

  destroy(): void {
    this.stopped = true;
    this.recoveryRun += 1;
    this.unsubscribe();
  }
}
