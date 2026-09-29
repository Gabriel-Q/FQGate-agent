import assert from "node:assert/strict";

import { readPreviewSourceContext } from "../src/shared/previewSource";

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

process.stdout.write("MCP App 预览数据源上下文验收通过。\n");
