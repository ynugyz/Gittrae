# IF-01 · importFiles：CSV与来源导入

**16:20最终覆盖：** 人员1 42c9103已纳入人员3产品3a558506；D2适配器1.0.1，688759缺失营收回源2755/4空字符串，页面及保存恢复通过；旧版本问题已解决，新导入才生效。[复验](../../reports/person3/final/d2-freeze-check.json)。

> 最新接入状态以文末「人员1收尾接入增量」为准；保留70caccb历史记录，默认范围方案以总控后续批准的getDefaultRequest为准。

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

## 人员1收尾接入增量（覆盖上文旧候选默认范围方案）

- 报告人：人员1；更新时间：2026-10-25T15:54:35.000+08:00；来源分支 `dev/data`。
- 本轮授权：总控启动收尾集成，仅改 `src/data` 与本卡；`getDefaultRequest(bundle)` 已批准，不新增持久化 schema。
- 已接上远程 `70caccb8149fd85f180a1206a4526c34d7559439`，保留8d62176的适配器契约对齐；最终实现 commit：`5b514215bbe5323ac07f7ef5b96c156046b5f7d0`。
- 接收方：人员2、人员3；核对的人员3契约/项目校验/回源实现：`6bbdf99053d9df18c16a42bff31876aec6cb993a`。本轮使用独立工作树，未修改其主目录。

## 已交付与实际检查

- `src/data/index.ts`：`importFiles(files: File[], options?: ImportOptions)`，复用既有字节适配器；出口对齐公共 SourceFile、parseOptions、unit、Transformation 及指标 ref，删除旧输出键。来源、记录、字段、版本、原字节及来源位置保持不变。
- `getDefaultRequest(bundle)`：D1 `year=2024` 数字、收入/消费；D2 `report_period=FY2025`、营收/净利润，既有6位60/00/30/68过滤保留；盖世 `year_month=2026-08`、单月销量/同比，错误环比 excluded；CPCA总量按2026年可用月份、结构表按已提供月序列、厂商榜按自身单月/累计字段。
- 补记从原始字段、表头及文件名解析出的规范标识/期间维度；转换数量据现有计数或实际受影响记录得出。不编造原始单元格引用，不重编号。
- 类型检查发现并修复两个既有纯类型问题：D2未使用的必填 `ColumnSpec.role`、generic漏导入 `Issue`；未改解析算法或依赖。
- **自测 passed，5/5**：`src/data/tests/index.integration.test.ts`。7份真实CSV生成6份Bundle，经人员3现有 `validateProject` 校验；核对稳定身份/原字节、默认请求/环比禁用、三域 `getRecordEvidence` 回源、前导零/跨行/空记录/缺失及共享options。
- FY2025实测：保留5,228条，市场过滤排除6,297条，行业缺失保留。三域回源实测：北京2024收入 `85415` → `(1,1)`；代码000001营收 `131442000000.0` → `(11211,4)`；比亚迪2026-08销量 `432684` → `(1,1)`。坐标为recordIndex、columnIndex，文件名/原串由人员3回源函数返回。
- 输入SHA见既有 `data/manifest.json`：居民全体收入 `9b19c0e867b282d4b47d3e72ae05441872f9cb0cd7eb79a15b0da16ccbb71a78`；FY2025 `c519acb415f858731e5cda99f578b536acb5eb0b59d57963d871ed23223b43a6`；盖世厂商202608 `c46f0b18fe99e619c8b0545a030b4cb0a22d36afc5d67a87ca378f81fec64262`。
- 严格类型检查 passed：临时联调目录引用本分支data及上述人员3共享/存储/图模块，使用现有Bundler配置与 `allowImportingTsExtensions:true`；人员3的6bbdf99已包含此选项。`git diff --check` passed。

## 复现、边界与下一步

集成后在仓库根执行 `npx tsx --test src/data/tests/index.integration.test.ts`。独立数据工作树可设置 `T3_APP_ROOT` 为人员3仓库根，并使用其已安装的tsx；本轮未安装/更换依赖。来源数据与旧 `src/data/tests/COVERAGE.md` 均未改动；原54项及远程后续56项、58文件覆盖证据仍绑定各自历史提交，本轮未重跑全量原包核验。

实现交付 passed；开发者最小接入自测 passed；完整三域上传→统计→AI→保存恢复联调 in_progress（人员3接入后确认）；人员4独立复验 not_started。本角色未调用模型，不将本轮检查记为实时AI或整体产品通过。

当前数据出口接入阻塞已解除。接入方式：合并origin/dev/data当前分支，或依次接入77f2456（包装）和5b51421（上游对齐修正）；不要只摘取后一笔。下一步：人员3接入实现commit，运行整项目构建及三域完整链路；人员2消费同一公共Bundle/指标ref；人员4按固定集成commit复验。若下游发现问题，回交人员1修数据。高级通用CSV配置、美化、解析器重构和新增覆盖系统继续暂停。


## 人员3接收检查（2026-10-25 16:00）【人员1、总控必读】

已合入1ba946d到dev/app d88c32a，File[]三域导入已在页面通过。D1/D2统计及真实AI已跑通。

待补：D2 rec:d2:FY2025:688759 的营收为空，排除正确但无直接来源。原文件确定位于数据记录2755、列索引4，原文空字符串。d2.ts空值continue发生在provenance赋值前，导致收入sources为空。建议人员1对存在的原列/单元格先保留来源再解析/判空，提升适配版本后重导；统计应仍为null，5227有效/1排除。人员3不伪造跨字段引用。
