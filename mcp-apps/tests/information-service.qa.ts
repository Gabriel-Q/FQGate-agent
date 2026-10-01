import assert from "node:assert/strict";

import { FqgateInformationService } from "../src/adapters/local-api/FqgateInformationService.ts";

const requestedUrls: URL[] = [];
const service = new FqgateInformationService({
  baseUrl: "http://fqgate-information.test",
  fetch: createFetch(requestedUrls),
});

const result = await service.getInformation({
  security: { market: "XSHG", code: "600151", name: "航天机电" },
  category: "security",
});

assert.equal(result.items.length, 1);
assert.equal(result.items[0]?.title, "航天机电资讯");
assert.equal(
  result.items[0]?.url,
  "https://news.10jqka.com.cn/field/20260930/680384208.shtml",
  "同花顺资讯原文必须升级为桌面端允许打开的 HTTPS 地址",
);
assert.equal(requestedUrls[1]?.pathname, "/v2/information/articles");
assert.equal(
  requestedUrls[1]?.searchParams.get("category_id"),
  "14369",
  "个股资讯必须选择真实的新闻叶子栏目，不能误选先出现的“个股资料”目录",
);

const unsupportedService = new FqgateInformationService({
  baseUrl: "http://fqgate-information-unsupported.test",
  fetch: createFetch([], false),
});
await assert.rejects(
  unsupportedService.getInformation({
    security: { market: "XSHG", code: "600151", name: "航天机电" },
    category: "security",
  }),
  /没有提供“security”对应的资讯分类/,
  "无法识别资讯栏目时必须明确失败，不能回退到任意分类并显示假空状态",
);

process.stdout.write("个股资讯按明确叶子栏目读取，验收通过。\n");

function createFetch(urls: URL[], includeKnownCategories = true): typeof fetch {
  return async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    const data = url.pathname.endsWith("/categories")
      ? {
          items: includeKnownCategories
            ? [
                { category_id: "2057", name: "个股资料", parent_category_id: "2048" },
                { category_id: "2058", name: "同花顺F10", parent_category_id: "2057" },
                { category_id: "14336", name: "行业类资讯" },
                { category_id: "14369", name: "改版个股新闻", parent_category_id: "14336" },
              ]
            : [{ category_id: "2057", name: "个股资料" }],
        }
      : {
          items: [
            {
              article_id: "680384208",
              published_at: "2026-09-30T00:07:43Z",
              security: { code: "600151", market: "XSHG" },
              source: "同花顺iNews",
              title: "航天机电资讯",
              url: "http://news.10jqka.com.cn/field/20260930/680384208.shtml?",
            },
          ],
        };
    return new Response(
      JSON.stringify({ code: 0, message: "操作成功", data }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
}
