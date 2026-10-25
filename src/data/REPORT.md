# 人员1 · 数据与来源 —— 开发阶段交接报告

- 角色状态：核心交付完成，核验全绿，待集成
- 分支：`dev/data`（基于 main `472d151`）
- 核验：`node src/data/tests/run-verify.ts` → **PASS 54 / FAIL 0**（Node 22.23.2，无第三方依赖）

## 1. 本轮完成

| 项 | 状态 |
|---|---|
| RFC4180 CSV 解析器（引号内换行/转义、空记录占位、BOM、SourceRef recordIndex=1 起不含表头） | 完成 |
| D1 `nbs-regional-wide`：19 张宽表 → 1 份 Bundle（31省×5年=155 条），空表头地区列、城乡三口径分离、微波炉/照相机 2023 起停更为 null | 完成 |
| D2 `eastmoney-financial`：2 期 → 1 份 Bundle（公司×报告期），代码文本化前导零、60/00/30/68 沪深筛选（排除数已记录）、缺失行业 null（界面显示"未分类"） | 完成 |
| D3 `gasgoo-ranking`：12+12 张月表 → firm/model 各 1 份 Bundle（名称×年月，含跨年累计归位），环比列 `excluded`（保留值+exclusionReason） | 完成 |
| D3 `cpca-table`：13 张 → 3 份 Bundle（total 20 个月 / share / manrank），两种月份表头格式统一 YYYY-MM | 完成 |
| `generic-csv`：未知上传，definitionStatus=unknown，字段角色可经 options.fieldOverrides 确认 | 完成 |
| GraphFragment：owner='data'，仅 derived_from/contains 两种边 | 完成 |
| importFiles 编排：文件名模式识别（仅入口线索）+ adapterHints 覆盖，58 文件 → 7 份 Bundle，约 0.55s | 完成 |
| 缺失语义：全部 Bundle 显式 null（不是 undefined，更不是 0） | 完成 |

## 2. 核验证据（run-verify.ts）

- **fixtures**：csv_quoted（4 条记录、第 2 条空占位、跨物理行 description 定位正确）、leading_zero（000001 文本、负数与零保留）、basic（BOM）、join/all_missing 等
- **D1 回查**：北京市 2024 income_all=85415 → 收入-全体表 第1行第1列，原始字符串 "85415"
- **D2 回查与口径**：保留+排除=23173；茅台 FY2025 net_profit_yoy=-4.53；**营收同比全量重算一致率 11464/11487 = 99.8% → 百分数点口径证实（0.5414=0.5414%）**
- **D3 回查**：比亚迪 2026-08 月销 432684 → 202608 表第1行第1列；同比 16.47；环比 -83.49 保留但 excluded；乘联会 2026-01 零售 153.9064 万辆回源一致
- **覆盖清单**：58/58 sha256、记录数、表头与 manifest 一致（见 [COVERAGE.md](tests/COVERAGE.md)）

## 3. 需要总控/下游知道的三件事

1. **D2 净利润同比口径**（bundle issue `D2_YOY_RESTATED_NOTE`）：约 3.5% 记录用任何简单公式（含扭亏绝对值公式）都无法从上年披露值重算，符合源站采用追溯调整基数的特征。适配器原样保留列值；建议人员2该字段慎用，优先营收同比或净利润绝对值。
2. **CPCA 总量表覆盖期**：2025-01 ~ 2026-08 共 20 个月（2026-09 起为未来月份，源表空），不生成全空记录（issue `D3_CPCA_COVERAGE`）。
3. **默认范围提示**：D1 建议默认 2024；D2 建议默认 report_period=FY2025；GASGOO 建议默认 2026-08 横截面。当前以 bundle issue 承载，建议契约 v1.1 增加 `DatasetBundle.defaultScope` 字段（详见下节建议 2）。

## 4. 契约变更建议（提请总控定稿、人员3编码，不私改）

1. `src/contracts` 落地后，`src/data/types.ts`（镜像）应替换为引用；字段以 handoff/01 v1.0 为准，未发现与契约冲突。
2. 建议 `DatasetBundle` 增加可选 `defaultScope`（分析默认范围提示），当前暂由 issue 承载。
3. `ImportOptions`（adapterHints/fieldOverrides）为本方实现细化，如人员3 UI 需要不同形态请提出。

## 5. 已知边界（非缺陷）

- D1 耐用品无城乡分口径（源数据即全体口径）；income/expend 三口径独立成字段。
- GASGOO 车型榜新车型无上年累计（null），非数据缺失错误。
- `join_left_duplicate` 多对多展开阻断在统计层（人员2）实现，解析层仅保证定位与重复键检测就绪。
- 类型镜像文件不参与提交给审计的字段语义判断；一切以契约文档为准。

## 6. 运行方式

```bash
node src/data/tests/run-verify.ts   # 全量核验（fixtures + 三域回查 + 58 份覆盖）
```

环境：Node ≥22.18（类型剥离直接运行 .ts，无需编译）；本机使用便携版 Node 22.23.2（与主机一致）。
