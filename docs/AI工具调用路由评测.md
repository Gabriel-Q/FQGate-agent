# AI 工具调用路由评测

`tests/fixtures/ai-tool-routing-evals.json` 用自然语言样例检查四个 Skill 的选择、V2 工具顺序、MCP App 绑定和能力边界。

当前覆盖七类请求：实时行情、K 线、条件选股、资讯事件、盘口逐笔、FQGate 2.0 不支持的账户/交易请求，以及四个 MCP Apps 的展示请求。

每条用例包含：

- `expectedSkill`：应选择的 Skill；`null` 表示不应触发 FQGate Skill；
- `expectedTools`：`ordered` 为固定顺序，`oneOf` 为允许的候选顺序，`none` 为不调用工具；
- `expectedUi`：工具结果可打开的 MCP App；
- `forbidden`：不得出现的数据替代、伪造、静默降级或越权声明。

运行：

```bash
npm run test:plugin
```

该门禁只验证仓库合同，不连接真实行情或 AI 服务。新增 Skill、工具名、界面绑定或能力边界时，必须同步更新评测。
