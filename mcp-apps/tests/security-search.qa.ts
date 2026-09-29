import assert from "node:assert/strict";

import type { FqgateHttpClient } from "../src/adapters/local-api/FqgateHttpClient.ts";
import { parseStandardRealtimeQuote } from "../src/adapters/local-api/FqgateMarketDataParsers.ts";
import { searchFqgateSecurities } from "../src/adapters/local-api/FqgateSecuritySearchService.ts";

class FakeClient {
  readonly paths: string[] = [];

  async get<T>(path: string): Promise<T> {
    this.paths.push(path);
    return {
      items: path.includes("market=XSHG")
        ? [
            {
              security: { market: "XSHG", code: "600519" },
              name: "贵州茅台",
            },
          ]
        : [],
    } as T;
  }
}

const client = new FakeClient();
const exactResults = await searchFqgateSecurities(
  client as unknown as FqgateHttpClient,
  " 600519 ",
);
assert.deepEqual(exactResults, [
  {
    market: "XSHG",
    code: "600519",
    fullCode: "XSHG600519",
  },
]);
assert.deepEqual(client.paths, [], "精确的标准六位代码不应再依赖模糊搜索服务");

const nameResults = await searchFqgateSecurities(
  client as unknown as FqgateHttpClient,
  "贵州茅台",
);
assert.deepEqual(client.paths, [
  "/v2/instruments/search?query=%E8%B4%B5%E5%B7%9E%E8%8C%85%E5%8F%B0&market=XSHG",
  "/v2/instruments/search?query=%E8%B4%B5%E5%B7%9E%E8%8C%85%E5%8F%B0&market=XSHE",
]);
assert.deepEqual(nameResults, [
  {
    market: "XSHG",
    code: "600519",
    name: "贵州茅台",
    fullCode: "XSHG600519",
  },
]);

assert.equal(
  parseStandardRealtimeQuote({
    items: [
      {
        security: { market: "XSHG", code: "600519" },
        security_name: "贵州茅台",
        latest: 1235.58,
      },
    ],
  })?.securityName,
  "贵州茅台",
);

process.stdout.write("证券搜索标准参数和结果映射验收通过。\n");
