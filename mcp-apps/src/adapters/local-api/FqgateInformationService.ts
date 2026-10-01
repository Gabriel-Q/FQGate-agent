import type {
  InformationCategory,
  InformationData,
  InformationItem,
  InformationQuery,
  InformationService,
  MarketSecurity
} from "@/shared/contracts";
import { FqgateHttpClient, type FqgateHttpClientOptions } from "./FqgateHttpClient";
import { toFqgateStandardSecurity } from "./FqgateStandardMarket";

interface FqgateInformationData {
  items?: unknown;
}

interface FqgateInformationCategoryData {
  items?: unknown;
}

type RawInformationItem = Record<string, unknown>;

interface InformationCategoryRecord {
  id: string;
  name: string;
  parentId: string;
}

/**
 * 同花顺分类树包含“个股资料”等目录节点，不能用模糊关键词取首项。
 * 这里按业务语义列出可提供文章列表的叶子栏目，顺序代表优先级。
 */
const categoryNames: Record<InformationCategory, readonly string[]> = {
  market: ["财经要闻", "证券要闻", "要闻"],
  security: ["改版个股新闻", "个股头条-新闻", "新闻资讯", "新闻"],
  announcement: ["个股公告", "重要公告", "公司公告", "滚动公告"]
};

export type FqgateInformationServiceOptions = FqgateHttpClientOptions;

/** 把 FQGate 资讯字段整理成不依赖数据来源的通用资讯结构。 */
export class FqgateInformationService implements InformationService {
  readonly kind = "fqgate-local-api";

  private readonly client: FqgateHttpClient;
  private categoryIds?: Map<InformationCategory, string>;

  constructor(options: FqgateInformationServiceOptions = {}) {
    this.client = new FqgateHttpClient({ ...options, timeoutMs: options.timeoutMs ?? 32_000 });
  }

  get connection() {
    return this.client.connection;
  }

  async getInformation(query: InformationQuery, signal?: AbortSignal): Promise<InformationData> {
    const categoryId = (await this.getCategoryIds(signal)).get(query.category);
    if (!categoryId) throw new Error(`FQGate 没有提供“${query.category}”对应的资讯分类。`);
    const security = toFqgateStandardSecurity(query.security);
    const parameters = new URLSearchParams({
      market: security.market,
      code: security.code,
      category_id: categoryId
    });
    const data = await this.client.get<FqgateInformationData>(
      `/v2/information/articles?${parameters.toString()}`,
      signal
    );
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items = rawItems
      .map((item, index) => toInformationItem(item, index))
      .filter((item): item is InformationItem => item !== null)
      .sort((left, right) => (right.publishedAt ?? 0) - (left.publishedAt ?? 0));

    return {
      security: completeSecurity(query.security),
      category: query.category,
      fetchedAt: new Date().toISOString(),
      items
    };
  }

  private async getCategoryIds(signal?: AbortSignal): Promise<Map<InformationCategory, string>> {
    if (this.categoryIds) return this.categoryIds;
    const data = await this.client.get<FqgateInformationCategoryData>(
      "/v2/information/categories",
      signal
    );
    const categories = (Array.isArray(data.items) ? data.items : [])
      .filter(isRecord)
      .map((item) => ({
        id: stringValue(item.category_id),
        name: stringValue(item.name),
        parentId: stringValue(item.parent_category_id)
      }))
      .filter((item) => item.id && item.name);
    const parentIds = new Set(categories.map((item) => item.parentId).filter(Boolean));
    this.categoryIds = new Map(
      (Object.keys(categoryNames) as InformationCategory[]).map((category) => {
        const matched = resolveArticleCategory(categories, parentIds, categoryNames[category]);
        return [category, matched?.id || ""];
      })
    );
    return this.categoryIds;
  }
}

function resolveArticleCategory(
  categories: readonly InformationCategoryRecord[],
  parentIds: ReadonlySet<string>,
  preferredNames: readonly string[]
): InformationCategoryRecord | undefined {
  for (const name of preferredNames) {
    const matched = categories.find((item) => item.name === name && !parentIds.has(item.id));
    if (matched) return matched;
  }
  return undefined;
}

function toInformationItem(
  value: unknown,
  index: number
): InformationItem | null {
  if (!isRecord(value)) return null;
  const title = stringValue(value.title);
  const summary = stringValue(value.summary);
  if (!title && !summary) return null;
  const publishedAt = epochMilliseconds(value.published_at);
  const identifier = stringValue(value.article_id) || `${publishedAt ?? "unknown"}-${index}`;

  return {
    id: `information-${identifier}`,
    title: title || summary.slice(0, 48),
    summary,
    source: stringValue(value.source),
    publishedAt,
    url: safeHttpUrl(value.url),
    securityCode: stringValue(isRecord(value.security) ? value.security.code : undefined)
  };
}

function completeSecurity(security: MarketSecurity): Required<MarketSecurity> {
  return {
    market: security.market,
    code: security.code,
    name: security.name?.trim() || security.code,
    fullCode: security.fullCode?.trim() || `${security.market}${security.code}`
  };
}

function epochMilliseconds(value: unknown): number | null {
  if (typeof value === "string" && /[T:-]/.test(value)) {
    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate)) return parsedDate;
  }
  const parsed = Number(stringValue(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed > 10_000_000_000 ? Math.floor(parsed) : Math.floor(parsed * 1000);
}

function safeHttpUrl(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (url.protocol === "http:" && url.hostname === "news.10jqka.com.cn") {
      url.protocol = "https:";
    }
    if (!url.searchParams.toString()) url.search = "";
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function isRecord(value: unknown): value is RawInformationItem {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
