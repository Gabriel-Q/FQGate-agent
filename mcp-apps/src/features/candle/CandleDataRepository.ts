import type {
  CandleData,
  CandleHistoryPage,
  CandleHistoryQuery,
  CandleQuery,
  CandleService
} from "@/shared/contracts";
import { mergeLatestCandles } from "./candleHistory";

interface ServiceCache {
  entries: Map<string, CandleData>;
  pending: Map<string, Promise<CandleData>>;
  historyEntries: Map<string, CandleHistoryPage>;
  historyPending: Map<string, Promise<CandleHistoryPage>>;
}

const serviceCaches = new WeakMap<CandleService, ServiceCache>();

/**
 * 在同一个数据服务实例内复用已取得的真实行情，并合并相同的在途请求。
 * 组件卸载后缓存仍跟随服务实例保留，返回组件时无需重复等待冷查询。
 */
export class CandleDataRepository {
  private readonly cache: ServiceCache;

  constructor(private readonly service: CandleService) {
    this.cache = cacheFor(service);
  }

  peek(query: CandleQuery): CandleData | undefined {
    return this.cache.entries.get(queryKey(query));
  }

  load(query: CandleQuery, force = false): Promise<CandleData> {
    const key = queryKey(query);
    const pending = this.cache.pending.get(key);
    if (pending) return pending;

    const cached = this.cache.entries.get(key);
    if (!force && cached) return Promise.resolve(cached);

    const request = this.service.getCandles(query)
      .then((result) => {
        const merged = cached ? mergeLatestCandles(cached, result) : result;
        this.cache.entries.set(key, merged);
        return merged;
      })
      .finally(() => {
        if (this.cache.pending.get(key) === request) this.cache.pending.delete(key);
      });
    this.cache.pending.set(key, request);
    return request;
  }

  store(query: CandleQuery, data: CandleData): void {
    this.cache.entries.set(queryKey(query), data);
  }

  loadHistory(query: CandleHistoryQuery, signal?: AbortSignal): Promise<CandleHistoryPage> {
    const key = historyQueryKey(query);
    const pending = this.cache.historyPending.get(key);
    if (pending) return pending;

    const cached = this.cache.historyEntries.get(key);
    if (cached) return Promise.resolve(cached);

    const request = this.service.getHistory(query, signal)
      .then((result) => {
        this.cache.historyEntries.set(key, result);
        return result;
      })
      .finally(() => {
        if (this.cache.historyPending.get(key) === request) this.cache.historyPending.delete(key);
      });
    this.cache.historyPending.set(key, request);
    return request;
  }
}

function cacheFor(service: CandleService): ServiceCache {
  const existing = serviceCaches.get(service);
  if (existing) return existing;
  const created: ServiceCache = {
    entries: new Map(),
    pending: new Map(),
    historyEntries: new Map(),
    historyPending: new Map()
  };
  serviceCaches.set(service, created);
  return created;
}

function historyQueryKey(query: CandleHistoryQuery): string {
  return [
    query.security.market,
    query.security.code,
    query.interval,
    query.startDate,
    query.endDate,
    query.adjustment ?? ""
  ].join(":");
}

function queryKey(query: CandleQuery): string {
  return [
    query.security.market,
    query.security.code,
    query.interval,
    query.count,
    query.adjustment ?? ""
  ].join(":");
}
