# IF-08 · POST /api/insights：真实DeepSeek解读

## 裸数字校验修复：当前服务6095758

- 最新产品commit `6095758d1fdb5a6586c87556c9399c35aef1f9fa` 已推送并在8787重启，方法版本仍v2。24/24自测通过。
- 与人员3页面一致：live_ai去掉合法占位符后若仍有半角/全角阿拉伯数字，HTTP502 `unbound_numeric_value`，不记成功；新增提示要求年份/月/Top50等也改用本期、榜单样本或中文描述，避免裸数字。
- 以下旧成功日志仅代表当时引用校验通过，不证明新校验通过，不作新版签收。需要人员3从当前服务重新取得三域无裸数字响应并让人员4复验。
- 当前服务保留运行，人员3不需另启8787；密钥只留服务进程。

## 16:02运行更新

当前8787已重启到产品commit `90c3ae011d889ee1e27314c0891e5403a0e16d74`（方法版本v2，缺失筛选修复）。健康检查仍ok、keyConfigured=true、目标api.deepseek.com；不需另起服务。以下较早调用证据属于042ca2c服务代码，不挪用为v2复验。

## 收尾当前状态（人员2，2026-10-25 15:55 北京时间）

- 实现commit：`042ca2c5a80836f2a79f58271c7a40d5051ed04c`，已推送。
- 已按批准决定保留`fieldIds`及页面`sampleSize`，兼容旧validCount；facts必须唯一且属于当前分析。解读占位与引用不符返回HTTP502 `invalid_insight_reference`，不能生成成功发现图；保留4096输出预算和截断错误。
- 本轮22/22自测中的上游响应为模拟，不能算真实API成功。此前15:33:53及原负责人后续HTTP探通记录保留，不能替代三域页面调用。
- 15:55用户提供本机运行凭据后，已仅在进程环境配置并启动`127.0.0.1:8787`；未写入代码、项目文件或报告。本轮三域真实调用正在验证，尚未签收。
- 服务就绪实测：`GET /api/health` → `{"ok":true,"model":"deepseek-flash","baseUrlHost":"api.deepseek.com","keyConfigured":true,"timeoutMs":60000}`。运行的是`042ca2c`服务代码，提供analyze与insights两个路由；人员3无需再启动第二个8787进程，可直接页面联调。
- 下一步：人员3页面接通后每域触发一次；记录实际model/generatedAt/requestId/analysisId及引用，人员4复验。若最终主机重启服务，须在服务端运行环境重新配置凭据。

### 本轮真实响应证据

| 域/触发 | generatedAt UTC（北京时间加8小时） | requestId / analysisId | 实际模型与服务结果 |
|---|---|---|---|
| D1，人员3页面2024年31省分析 | `2026-10-25T07:56:58.754Z` | `202f1b83-6cd1-41e5-a886-e12cedfce788` / `analysis:0290520c386a4c363d733754` | `deepseek-flash`，服务真实上游成功，4条解读、0条无效引用，6995ms |
| D2，人员3页面FY2025分析 | `2026-10-25T07:57:48.239Z` | `e530e663-ed38-4cbc-9e8e-61db535507ee` / `analysis:595d245235bc5c9698fcafed` | `deepseek-flash`，4条解读、0条无效引用，2966ms |
| 场景待页面端对应 | `2026-10-25T07:59:09.617Z` | `f0ec1cac-833c-4486-98c6-a8f282af8320` / `analysis:108e384d748ac3a4b6dfdc55` | `deepseek-flash`，4条解读、0条无效引用，6456ms |
| 场景待页面端对应 | `2026-10-25T07:59:17.291Z` | `9014cbf7-0f46-4851-bf64-426dbe65e293` / `analysis:1444837ccdd4439afa0a859a` | `deepseek-flash`，4条解读、0条无效引用，7671ms |
| 场景待页面端对应 | `2026-10-25T07:59:20.858Z` | `c9b263b0-d80a-49dd-afe9-3eeae4e735c7` / `analysis:da9967d003574b1fde461b4b` | `deepseek-flash`，4条解读、0条无效引用，3563ms |
| 场景待页面端对应 | `2026-10-25T07:59:25.829Z` | `85ac27d1-2b56-4306-b683-b7b69d62d9c3` / `analysis:b81e9e5bf2ae51b76546bb09` | `deepseek-flash`，4条解读、0条无效引用，4352ms |
| D1，页面重建保存项目调用 | `2026-10-25T07:59:50.880Z` | `f0fbbd8c-b53a-43bd-a21d-821e02d4af4b` / `analysis:0290520c386a4c363d733754` | `deepseek-flash`，4条解读、0条无效引用，3752ms |
| D2，页面重建保存项目调用 | `2026-10-25T08:00:22.951Z` | `315de9e1-8b84-4075-90c6-1a8ded2339cb` / `analysis:595d245235bc5c9698fcafed` | `deepseek-flash`，4条解读、0条无效引用，4617ms |
| v2场景待页面端对应；裸数字修复前 | `2026-10-25T08:04:07.873Z` | `1cb00d68-b457-45d2-89f6-0fd5ea121122` / `analysis:85fa7af18b1a361461ac8d74` | `deepseek-flash`，4条解读、0条无效引用，3940ms |
| v2场景待页面端对应；裸数字修复前 | `2026-10-25T08:04:19.744Z` | `770a9ef4-a209-4a66-b7ab-0191dab3b5aa` / `analysis:85fa7af18b1a361461ac8d74` | `deepseek-flash`，4条解读、0条无效引用，3226ms |

以上来自8787服务实时脱敏日志；人员3已确认最初D1/D2页面调用。未确认场景的四次调用只记录事实，不猜测属于D3；页面最终显示、D3场景映射和回源由人员3确认，整体签收由人员4复验。

以下保留原负责人较早交付证据；其历史成绩不扩大为本轮三域验收。

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
