# IF-02 · analyze：确定性统计与三图数据

## 16:02修复更新

- 最新产品commit `90c3ae011d889ee1e27314c0891e5403a0e16d74`（含`b7f7f8a`），已推送并更新本机8787。23/23自测通过。
- 修复真实阻断：按Scalar原类型筛选，null不再变成空字符串；数字与数字文本不混选。分析身份同样保留类型，方法版本升为`analysis-methods-v2`，避免复用旧筛选语义的ID；已保存的旧分析无需重算。
- 当前8787真实财务HTTP复验：FY2025 + industry=null选中1条 `rec:d2:FY2025:001235`，HTTP200，`analysis:aa5b36d39126a6489e350f57`，Pearson为null（单样本）。问题提示的fieldId均为真实字段，可通过项目引用检查。
- 人员3需接收本修复并复验“缺失/未分类”筛选；前面三域数值证据保持原受测版本，不改写成新版本成绩。

## 收尾当前状态（人员2，2026-10-25 15:55 北京时间）

- 实现commit：`042ca2c5a80836f2a79f58271c7a40d5051ed04c`，已推送dev/analysis-ai；在原负责人`ffd11a7`之后正常快进，保留既有改动。
- 已交付：同一8787服务新增`POST /api/analyze`，固定`{bundle,request} → {analysis,facts}`，facts为`{insights,graph}`。只需要分析投影；16MB上限，AI仍1MB；无需模型密钥即可统计。
- 规范输出：scope.recordIds/label、字符串ref、复用基础indicator节点ID；旧reason/methodVersion移入parameters，删除额外validCount。箱线low/high记录全部有效输入和真实缺失排除；相关问题绑定真实fieldId。
- 实测passed：`node --test src/analysis/analysis.test.ts` 22/22；FY2025完整原文件SHA `c519acb415f858731e5cda99f578b536acb5eb0b59d57963d871ed23223b43a6` 经人员1既有导入器形成5228条规范记录，分析投影2193590字节返回HTTP200；营收/成对样本均5227。16MB分析和1MB AI超限均HTTP413；错误数据版本HTTP400。
- 未完成：三域页面验收、最终集成提交及独立审计。下一步人员3一次await接入上述路由；人员2继续三域HTTP及真实AI验证。

### 三域路由与独立复算（15:57，本机服务代码042ca2c）

使用人员1既有导入器2781eca读取真实CSV，再发送必要投影；本项只证明统计/HTTP，不冒充最新人员1入口或页面/图合并验收。

| 域与范围 | analysisId | 范围数/成对有效数 | HTTP与事实 | 独立原始CSV复算 |
|---|---|---|---|---|
| D1全体居民2024年 | `analysis:0290520c386a4c363d733754` | 31/31 | 200，7条事实 | 两指标均值/样本标准差、Pearson通过 |
| D2 FY2025沪深前缀子集 | `analysis:595d245235bc5c9698fcafed` | 5228/5227 | 200，7条事实 | 营收/净利润均值/样本标准差、Pearson通过 |
| D3车企2026-08 Top50 | `analysis:33613dcdc8be7c86901ced45` | 50/50 | 200，7条事实 | 单月/年内累计均值/样本标准差、Pearson通过 |

独立工具为Python标准库csv/statistics，直接读取原始字节对应文件；比较容差`max(1e-6,abs(reference)*1e-9)`。三域频数等于逐箱recordIds数量，结果valid/excluded互斥且完整覆盖scope；事实引用均存在于当前analysis。

输入SHA：D1收入`9b19c0e867b282d4b47d3e72ae05441872f9cb0cd7eb79a15b0da16ccbb71a78`、消费`3a55ba5fd6327ad0ddbf1ec19e3c0f40c1d823e26830331ee0a8cb24f137a0c0`；D2见上；D3`c46f0b18fe99e619c8b0545a030b4cb0a22d36afc5d67a87ca378f81fec64262`。

以下保留较早交付记录；如与本段冲突，以本段已绑定commit的状态为准。

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
