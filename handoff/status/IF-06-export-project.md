# IF-06 · exportProject：项目导出

必做；负责人/报告人：本机人员3；2026-10-25；分支 `dev/app`。
产品commit：`33c34387025c0bce96b8d66a98af5fe0414b34a3`；已合人员1 `1ba946d`、人员2 `90c3ae0`。

**必读依赖：** [IF-00 契约](IF-00-contracts.md)、[IF-01 数据](IF-01-import-files.md)、[IF-02 分析](IF-02-analyze.md)、[IF-03 发现](IF-03-build-facts.md)、[IF-08 AI历史](IF-08-live-insights.md)；往返结果读 [IF-07](IF-07-import-project.md)。
[实现入口](https://github.com/ynugyz/Gittrae/blob/33c34387025c0bce96b8d66a98af5fe0414b34a3/src/storage/index.ts)：严格校验后导出紧凑JSON，保留源字节、ID、分析与历史解释；不保存未计算筛选草稿。

| 检查 | 状态与边界 |
|---|---|
| 当前产品自动检查 | passed：52项测试及构建通过 |
| 实际页面保存 | passed：3域、3分析，16,614,813字节；含9条有效历史及3条invalid，原文保留 |
| 新空白页恢复再保存 | passed：除savedAt外全内容一致；源字节、ID、值、选择及AI时间/状态均保持 |
| 当前产品独立签收 | not_started：旧版本核心通过不自动覆盖33c3438或页面 |

本轮 [往返证据](../../reports/person3/final/restore-check.json) 明记运行代码为 `8a8c8bd + 90c3ae0`，不改写成另一受测commit；8a8c8bd已拒绝AI裸数字。
invalid历史仅保留证据原文，不作为有效实时AI结论；三域全链仍未签收，D2缺失来源问题见 [IF-05](IF-05-get-evidence.md)。
人员4 [2cc2df1审计](https://github.com/ynugyz/Gittrae/blob/2cc2df1/acceptance/reports/2026-10-25_78f7678_audit.md) 对旧产品78f7678的核心导出恢复通过；本轮页面由人员3自测。
历史展示夹具及检查见 [开发自测](../../reports/person3/verification.md)，不替代本轮真实项目证据。

下一步：交明确新commit及往返证据给人员4，按 [验收矩阵](../../acceptance/cases.md) 独立复验SAVE-01/02、PERF-01；不得将保存成功当作来源或统计正确性签收。
