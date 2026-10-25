# IF-02 · analyze：确定性统计与三图数据

## 身份与依赖

| 字段 | 当前记录 |
|---|---|
| 首版必要性 | 必做 |
| 实现负责人 | 人员2 |
| 下游接手者 | 人员3、人员4；IF-03与IF-08 |
| 负责人报告来源分支 | `dev/analysis-ai`；本文件初始记录在docs/control |
| 直接依赖 | [IF-00](IF-00-contracts.md)、[IF-01](IF-01-import-files.md) |
| 公共契约 | [v1.0](../01_公共接口.md)；类型细节按人员3 `39c92f1` 的 `src/contracts/index.ts` 对齐，未批准部分仍待总控裁决 |
| 报告人/更新时间 | 人员2（本机）；2026-10-25T16:05+08:00（更新；初始化记录由总控 15:24:40） |
| 总体进展 | in_progress |
| 实现commit | `f41c37cba44b66e35278114e4fd0a8dd65eb4326`（完整模块；此前 `d72ab3f7a98d88f2f0904d6241729af7e85bd4d5`） |

## 已做与未做

接口边界：analyze(bundle, request) → AnalysisResult；纯计算，带范围、有效/排除ID和派生图。

| 阶段 | 当前事实/状态 |
|---|---|
| 实现交付 | passed：`src/analysis/statistics.mjs`、`analyze.mjs`、`index.ts`；Scope 输出 `recordIds/label/limitations`，图节点 `ref` 为字符串。 |
| 开发者自测 | passed：`node --test src/analysis/analysis.test.ts` 20/20（含 basic 手算、缺失/常量、图节点契约形状、来源引用路径）。 |
| 三域真实联调 | blocked：人员1 已交 `dev/data` `2781eca`（58/58 覆盖），但尚无与 `dev/app` 固定的集成 commit；`src/data/types.ts` 镜像与 `src/contracts` 的字段拼写待统一。 |
| 人员4产品独立复验 | not_started：未收到绑定集成版本的复验结论。 |

成果/证据：`src/analysis/`、[人员2交付与复验](../../reports/人员2_交付与复验.md)。本轮实测输入为手写 DatasetBundle（`basic.csv` 口径），未用真实 CSV 代替 fixture；密钥未出现在证据中。

## 检查与接手标准

重点：均值/中位数/样本标准差/Type7/Pearson/10箱及观测须；逐列和成对缺失。

对应验收：STAT-01/02、CHART-01、D1-02、D2-02、D3-02；具体标准以[验收矩阵](../../acceptance/cases.md)为准。三域适用项分别给出D1/D2/D3证据；MOCK不替代真实数据及调用。

## 当前阻塞与候选下一步

未完成/前置条件：三域真实联调依赖 IF-01 的固定集成 commit 与真实 Bundle；人员4 复验依赖集成版本。

建议责任动作：人员3 合并 `dev/analysis-ai` 后逐域触发；人员1 与人员3 统一类型镜像；人员4 按 `f41c37c` 独立复算。

下一步判断：本接口为首版必做；实现与自测已有证据，真实联调与签收未完成。列出动作不等于启动开发或自动跨对话调度。

## 本卡后续交接记录

| 报告人/北京时间 | 代码commit/契约版本 | 本次已做与实测证据 | 未完成/阻塞及责任人 | 下一动作/前置条件/验收者 |
|---|---|---|---|---|
| 人员2（本机）/2026-10-25 16:05 | `f41c37c`；契约 v1.0 + 人员3 类型细化 | 模块交付；20/20 测试；图的 `ref`/编号、Scope 字段结构断言；fixture 回源路径 | 三域真实联调缺固定集成 commit（人员3/总控）；人员1 类型镜像待统一；人员4 未复验 | 人员3 合并后逐域触发；人员4 按 `f41c37c` 复算 |
