# IF-08 · POST /api/insights：真实DeepSeek解读

## 身份与依赖

| 字段 | 当前记录 |
|---|---|
| 首版必要性 | 必做 |
| 实现负责人 | 人员2（服务）；人员3（客户端接线） |
| 下游接手者 | 页面解释、图与回源、历史项目及人员4 |
| 负责人报告来源分支 | `dev/analysis-ai`（服务）；`dev/app`（客户端）；本文件初始记录在docs/control |
| 直接依赖 | [IF-00](IF-00-contracts.md)、[IF-02](IF-02-analyze.md) |
| 公共契约 | [v1.0](../01_公共接口.md)；`InsightResponse` 字段与 `sampleSize` 按人员3 `39c92f1` 对齐 |
| 报告人/更新时间 | 人员2（本机）；2026-10-25T16:05+08:00（更新；初始化记录由总控 15:24:40） |
| 总体进展 | in_progress |
| 实现commit | 服务端 `f41c37cba44b66e35278114e4fd0a8dd65eb4326`；客户端 `39c92f147dc1ff81e0bdaf9f4190b81051a74cbd`（人员3） |

## 已做与未做

接口边界：POST /api/insights；analysisId/facts/context → insights/graph/实际model/generatedAt 或明确 error。

| 阶段 | 当前事实/状态 |
|---|---|
| 实现交付 | passed：`server/insights.mjs`、`server/index.ts`（`npm run dev` 可检测）、`server/probe.mjs`；仅绑定 127.0.0.1:8787，密钥只读环境变量。 |
| 开发者自测 | passed：20/20 测试含 6 项代理路由用例；真实 `probe.mjs` 成功；完整 HTTP `POST /api/insights` 15 条 facts 返回 4 条 Insight、`invalidCount: 0`。 |
| 三域真实联调 | not_started：服务可用且有单域真实证据，但页面尚未在本分支联动，也没有固定集成 commit 的三域页面触发记录。 |
| 人员4产品独立复验 | not_started：未收到绑定集成版本的复验结论。 |

成果/证据：[人员2交付与复验](../../reports/人员2_交付与复验.md) 第 3 节；`server/README.md`。

- 探通：requestId `9b6bbc4f-e025-4c56-a5ca-7d7a0bdb1310`，`analysis:probe`，约 2289 ms。
- HTTP：requestId `b0113e9b-3795-4351-9af2-6c7dc0fe323c`，`analysis:75b7ebe8ac64855a7b48d635`，HTTP 200，4/4 有效，5043 ms，generatedAt `2026-10-25T07:47:19.455Z`。
- 失败记录 1：requestId `5aa99f78-c045-4de0-a361-971f8dc9c22e`，占位符写成 `resultId` 字面量，2 条 invalid；改提示词后复测通过。
- 失败记录 2：同一 analysisId 前两次调用因 `max_tokens=1200` 被推理 token 耗尽而截断 JSON；已改默认 4096，并把 `finish_reason=length` 明确映射为 `truncated_output`，复测成功。
- 密钥未写入仓库、日志或证据正文。

## 检查与接手标准

重点：每域一次实际应用触发的官方调用；引用与范围有效；超时/错误/旧响应；密钥仅服务端。

对应验收：AI-01/02/03、STATE-01、TRACE-01；具体标准以[验收矩阵](../../acceptance/cases.md)为准。三域适用项分别给出 D1/D2/D3 证据；MOCK 不替代真实数据及调用。

## 当前阻塞与候选下一步

未完成/前置条件：
1. 页面需在集成后的固定 commit 上逐域触发并记录 requestId/analysisId。
2. `InsightRequest.facts` 缺少 `resultId → fieldId` 映射（人员3 实现说明第 5.2 条），需总控裁决是否在 facts 投影增加可选 `fieldIds`；当前模型只能看到 `metric/method/sampleSize`。
3. `analysisId` 的当前响应校验由人员3 客户端执行，需联调确认旧响应丢弃。

建议责任动作：人员3 合并后逐域触发；总控裁决 facts 映射；人员4 核对脱敏响应与引用。

下一步判断：本接口为首版必做；服务端实现与单域真实调用已有证据，三域页面触发未完成，不能签收。

## 本卡后续交接记录

| 报告人/北京时间 | 代码commit/契约版本 | 本次已做与实测证据 | 未完成/阻塞及责任人 | 下一动作/前置条件/验收者 |
|---|---|---|---|---|
| 人员2（本机）/2026-10-25 16:05 | `f41c37c`；契约 v1.0 + 人员3 类型细化 | 服务交付；20/20 测试；真实 probe 与 HTTP 200（4/4 有效）；失败码含 `truncated_output` | 三域页面触发未做（人员3 集成）；facts 指标映射待总控裁决；人员4 未复验 | 人员3 合并后逐域触发；总控裁决映射；人员4 按集成 commit 复验 |
