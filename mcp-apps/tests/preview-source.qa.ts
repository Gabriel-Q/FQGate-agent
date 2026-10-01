import assert from "node:assert/strict";

import {
  applyPreviewHostActionInset,
  readPreviewSourceContext,
} from "../src/shared/previewSource";

assert.deepEqual(
  readPreviewSourceContext({
    _fqgatePreview: {
      selectedInstanceId: "tonghuashun-user",
      sources: [
        {
          id: "tonghuashun-user",
          label: "同花顺 - mx_****5435 - L2",
          depthMode: "level2",
        },
      ],
    },
  }),
  {
    selectedInstanceId: "tonghuashun-user",
    sources: [
      {
        id: "tonghuashun-user",
        label: "同花顺 - mx_****5435 - L2",
        depthMode: "level2",
      },
    ],
  },
);

assert.equal(
  readPreviewSourceContext({
    _fqgatePreview: {
      selectedInstanceId: "removed-guest",
      sources: [
        {
          id: "tonghuashun-user",
          label: "同花顺 - mx_****5435 - L2",
          depthMode: "level2",
        },
      ],
    },
  }),
  undefined,
);

const styleValues = new Map<string, string>();
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    documentElement: {
      style: {
        setProperty: (key: string, value: string) => styleValues.set(key, value),
      },
    },
  },
});
applyPreviewHostActionInset({ _fqgatePreview: { hostActionInset: 68 } });
assert.equal(styleValues.get("--fqgate-host-action-inset"), "68px");
applyPreviewHostActionInset({ _fqgatePreview: { hostActionInset: 999 } });
assert.equal(styleValues.get("--fqgate-host-action-inset"), "160px");

process.stdout.write("MCP App 预览数据源上下文验收通过。\n");
