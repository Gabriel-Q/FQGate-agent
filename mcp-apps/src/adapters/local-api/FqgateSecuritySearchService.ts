import type { MarketSecurity, SecuritySearchService } from "@/shared/contracts";
import { securityFromMainlandCode } from "@/ui/securityCode";
import {
  FqgateHttpClient,
  type FqgateHttpClientOptions,
} from "./FqgateHttpClient";

interface FqgateSearchData {
  items: Array<{ security: { code: string; market: string }; name: string }>;
}

/** 共用真实证券目录查询；组件不自行推断证券市场或名称。 */
export class FqgateSecuritySearchService implements SecuritySearchService {
  readonly kind = "fqgate-local-api";
  private readonly client: FqgateHttpClient;
  constructor(options: FqgateHttpClientOptions = {}) {
    this.client = new FqgateHttpClient(options);
  }
  get connection() {
    return this.client.connection;
  }
  searchSecurities(
    pattern: string,
    signal?: AbortSignal,
  ): Promise<MarketSecurity[]> {
    return searchFqgateSecurities(this.client, pattern, signal);
  }
}

export async function searchFqgateSecurities(
  client: FqgateHttpClient,
  pattern: string,
  signal?: AbortSignal,
): Promise<MarketSecurity[]> {
  const query = pattern.trim();
  const exactSecurity = securityFromMainlandCode(query);
  if (exactSecurity) return [exactSecurity];

  const results = await Promise.all(
    ["XSHG", "XSHE"].map((market) => {
      const parameters = new URLSearchParams({ query, market });
      return client.get<FqgateSearchData>(
        `/v2/instruments/search?${parameters.toString()}`,
        signal,
      );
    }),
  );
  return results
    .flatMap((result) => result.items)
    .map((item) => ({
      market: item.security.market,
      code: item.security.code,
      name: item.name,
      fullCode: `${item.security.market}${item.security.code}`,
    }));
}
