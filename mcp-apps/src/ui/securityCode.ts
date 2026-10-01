import type { MarketSecurity } from "@/shared/contracts";

export function securitySearchPattern(code: string): string {
  const normalized = code.trim().toUpperCase();
  return /^[A-Z]{4}\d+$/.test(normalized) ? normalized.slice(4) : normalized;
}

/** 标准六位境内代码的市场归属是确定性规则，无需为此调用搜索服务。 */
export function securityFromMainlandCode(
  code: string,
): MarketSecurity | undefined {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) return undefined;
  const market = /^(?:0|1|2|3)/.test(normalized)
    ? "XSHE"
    : /^(?:5|6|7)/.test(normalized)
      ? "XSHG"
      : undefined;
  if (!market) return undefined;
  return { market, code: normalized, fullCode: `${market}${normalized}` };
}

/** 代码输入只保留精确身份；名称输入保留数据源返回的候选。 */
export function matchingSecurityCodes(
  code: string,
  results: MarketSecurity[],
): MarketSecurity[] {
  const normalized = code.trim().toUpperCase();
  const codeInput = /^(?:[A-Z]{4})?\d{6}$/.test(normalized);
  const matches = codeInput
    ? results.filter((security) =>
        [
          security.code,
          security.fullCode,
          `${security.market}${security.code}`,
        ].some((value) => value?.toUpperCase() === normalized),
      )
    : results;
  const unique = new Map(
    matches.map((security) => [
      `${security.market}${security.code}`.toUpperCase(),
      security,
    ]),
  );
  return [...unique.values()];
}
