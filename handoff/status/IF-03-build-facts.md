# IF-03 · buildFacts：计算事实与发现引用

## 身份与依赖

| 字段 | 当前记录 |
|---|---|
| 首版必要性 | 必做 |
| 实现负责人 | 人员2 |
| 下游接手者 | 人员3、人员4 |
| 负责人报告来源分支 | `dev/analysis-ai`；本文件初始记录在docs/control |
| 直接依赖 | [IF-00](IF-00-contracts.md)、[IF-02](IF-02-analyze.md) |
| 公共契约 | [v1.0](../01_公共接口.md)；`FactsOutput = { insights, graph }` 与 finding 标签按人员3 `39c92f1` 对齐 |
| 报告人/更新时间 | 人员2（本机）；2026-10-25T16:05+08:00（更新；初始化记录由总控 15:24:40） |
| 总体进展 | in_progress |
| 实现commit | `f41c37cba44b66e35278114e4fd0a8dd65eb4326`（此前 `d72ab3f`） |

## 已做与未做

接口边界：buildFacts(analysis) → computed Insight[] 与 finding/cites 图；数字使用 `{{result:...}}` 占位。

| 阶段 | 当前事实/状态 |
|---|---|
| 实现交付 | passed：`src/analysis/facts.mjs`；`kind=fact`、`origin=computed`、`model=null`、`status=valid`，finding 节点名 `数据事实`、`ref=insightId`。 |
| 开发者自测 | passed：20/20 测试中的 buildFacts 用例与引用校验用例；每条事实只引用同一分析的 resultId。 |
| 三域真实联调 | blocked：依赖 IF-02 的固定集成 commit；尚无页面实际展示与点击回源证据。 |
| 人员4产品独立复验 | not_started：未收到绑定集成版本的复验结论。 |

成果/证据：`src/analysis/facts.mjs`、[人员2交付与复验](../../reports/人员2_交付与复验.md)。事实文本只含占位符，不直写数值；本次为 fixture 分析，不是三域真实数据。

## 检查与接手标准

重点：不重新计算数字；结果属于同一分析；finding/cites 可稳定重建；事实与 AI 分开。

对应验收：GRAPH-01、TRACE-01、AI-02 中的事实分区；具体标准以[验收矩阵](../../acceptance/cases.md)为准。

## 当前阻塞与候选下一步

未完成/前置条件：真实联调依赖有效的三域 AnalysisResult 与集成 commit。

建议责任动作：人员3 合并后用 `buildInsightGraph` 重建并核对点击路径；人员4 按明确 commit 复验。

下一步判断：本接口为首版必做；实现与自测已有证据，真实联调未完成。

## 本卡后续交接记录

| 报告人/北京时间 | 代码commit/契约版本 | 本次已做与实测证据 | 未完成/阻塞及责任人 | 下一动作/前置条件/验收者 |
|---|---|---|---|---|
| 人员2（本机）/2026-10-25 16:05 | `f41c37c`；契约 v1.0 + 人员3 类型细化 | 事实与发现图交付；20/20 测试；引用校验拒绝跨分析 ID；finding 与 `buildInsightGraph` 同名同编号 | 缺三域真实分析与页面展示证据；依赖 IF-02 集成 | 人员3 合并后重建图并核对回源；人员4 按 `f41c37c` 复验 |
