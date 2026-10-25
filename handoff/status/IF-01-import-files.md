# IF-01 · importFiles：CSV与来源导入

## 身份与依赖

| 字段 | 当前记录 |
|---|---|
| 首版必要性 | 必做 |
| 实现负责人 | 人员1 |
| 下游接手者 | 人员2、人员3 |
| 负责人报告来源分支 | `dev/data`；本文件初始记录在docs/control，实现负责人在 dev/data 分支更新本卡 |
| 直接依赖 | [IF-00](IF-00-contracts.md) |
| 公共契约 | [v1.0](../01_公共接口.md)；已按人员3落地的 `src/contracts/index.ts` 完成逐字段对齐（见下文） |
| 报告人/更新时间 | 人员1；2026-10-25T15:47:12+08:00；实现负责人完成声明（自测证据绑定 commit） |
| 总体进展 | in_progress；实现交付与开发者自测已完成，三域真实联调与独立复验未开始 |
| 实现commit | `2781eca`（核心交付）+ `8d62176`（契约对齐与锚点补强），分支 `dev/data` |

## 已做与未做

已交付（证据绑定 `2781eca` 与 `8d62176`，均在 origin/dev/data）：

- `src/data/importFiles.ts`：importFiles(files, options) → Promise<DatasetBundle[]>；按文件名模式识别适配器，adapterHints 可覆盖；同内容（同 sha256）复用来源身份；缺失统一显式 null。
- 适配器：D1 `nbs-regional-wide`（19 表合 1 Bundle，155 条）、D2 `eastmoney-financial`（沪深筛选，代码文本化）、D3 `gasgoo-ranking`（firm/model 各 1）、D3 `cpca-table`（total/share/manrank 3 份）、`generic-csv` 兜底；GraphFragment（owner=data，仅 derived_from/contains 边）。
- RFC4180 CSV 解析：引号内换行/转义、空记录占位、BOM 检测；SourceRef.recordIndex 从 1 起不含表头、columnIndex 从 0 起。
- 契约对齐（`8d62176`）：`originalFileName`、`unit: string`（无单位 `""`）、`Transformation{fieldIds, affectedCount}` 必填、`ParseOptions{quoteChar/escapeChar/skipEmptyLines:false}`、`Scalar`/`DataRecord` 命名。

自测证据（`node src/data/tests/run-verify.ts`，绑定 `8d62176`，主机 Node 22.23.2）：

- fixtures 14 项 PASS（csv_quoted 空记录占位与跨行字段、leading_zero 前导零、join 重复键、BOM、缺失不补零等）。
- 58/58 文件 sha256、记录数、表头与 data/manifest.json 一致（清单见 `src/data/tests/COVERAGE.md`）。
- 三域来源回查：D1 北京 85415、D3 比亚迪 432684、CPCA 2026-01 零售 153.9064 均可回查原始字符串与行列位置。
- D2 审计锚点：FY2025 沪深筛选保留 5228 / 排除 6297（与人员4 STATUS.md 数字一致）；营收同比全量重算一致率 >99.5%。
- 汇总：PASS 56 / FAIL 0；importFiles 全量导入 7 份 Bundle 约 0.6s。

| 阶段 | 当前事实/状态 |
|---|---|
| 实现交付 | done：模块在 origin/dev/data `2781eca`+`8d62176`，接口与 IF-00 v1.0 对齐 |
| 开发者自测 | passed：56/56 PASS，证据见上与 `src/data/REPORT.md` |
| 三域真实联调 | not_started；等本分支与 dev/app、dev/analysis-ai 集成后执行 |
| 人员4产品独立复验 | not_started；待人员4领取受测 commit |

成果/证据：实现说明 `src/data/REPORT.md`；核验入口 `src/data/tests/run-verify.ts`；覆盖清单 `src/data/tests/COVERAGE.md`。

## 检查与接手标准

重点：58份CSV逐项覆盖；三域、通用CSV、重复键、前导零、缺失和原始位置。

对应验收：IMP-01/02、D1-01、D2-01、D3-01/02、JOIN-01；具体标准以[验收矩阵](../../acceptance/cases.md)为准。三域适用项分别给出D1/D2/D3证据；MOCK不替代真实数据及调用。

## 当前阻塞与候选下一步

未完成/前置条件：三域真实联调需要人员3按 `src/contracts` 接入本模块（dev/app 侧调用 importFiles），人员2用真实 Bundle 跑统计；需要总控确认集成 commit。

待总控/下游注意的实现细化：`ImportOptions{adapterHints, fieldOverrides}` 为本方扩展；`DatasetBundle.defaultScope` 建议列入契约 v1.1 裁决（当前由 issue 承载，见 REPORT.md §4）。

建议责任动作：总控审查本 PR 并合并 dev/data；人员3接线后与本模块联调；人员2直接消费 Bundle。

下一步判断：实现与自测证据已绑定 commit 提交，具备联调前置条件；签收仍以联调与人员4复验为准。

解除阻塞或完成检查时，负责人更新本卡的实现commit、实际结果与证据；下游追加接手记录；审计结论链接人员4在acceptance/reports的报告及受测commit。未经原报告人确认，不替他人填写通过成绩。

## 本卡后续交接记录

| 报告人/北京时间 | 代码commit/契约版本 | 本次已做与实测证据 | 未完成/阻塞及责任人 | 下一动作/前置条件/验收者 |
|---|---|---|---|---|
| 总控；2026-10-25T15:24:40+08:00 | 未取得 | 初始化本卡；确认 main/dev/app 无人员1实现 | 真实接入缺人员1提交（总控） | 等待人员1 commit 与覆盖报告 |
| 人员1；2026-10-25T15:47:12+08:00 | `2781eca`+`8d62176` / 契约 v1.0 | 实现交付+自测 56/56 PASS；58/58 覆盖；D2 锚点 5228/6297；契约逐字段对齐 | 三域联调 not_started（人员3/人员2）；复验 not_started（人员4） | 总控审查合并 PR；人员3 接线联调 |
