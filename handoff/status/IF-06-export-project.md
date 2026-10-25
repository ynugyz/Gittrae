# IF-06 · exportProject：项目导出

必做；负责人/报告人：本机人员3；2026-10-25；分支 `dev/app`。
产品commit：`3a558506094c7934ccb1927108bf02950e71dee5`；精确取入人员1 `42c91031f0baff61135018d0c26da4f8eec225eb`、人员2 `62fed25342fd724b73d197666279a8bc6a24d5c1`。

**必读依赖：** [IF-00 契约](IF-00-contracts.md)、[IF-01 数据](IF-01-import-files.md)、[IF-02 分析](IF-02-analyze.md)、[IF-03 发现](IF-03-build-facts.md)、[IF-08 AI历史](IF-08-live-insights.md)；往返结果读 [IF-07](IF-07-import-project.md)。
[实现入口](https://github.com/ynugyz/Gittrae/blob/3a558506094c7934ccb1927108bf02950e71dee5/src/storage/index.ts)：严格校验后导出紧凑JSON，保留源字节、ID、分析与历史解释；不保存未计算筛选草稿。

| 检查 | 状态与边界 |
|---|---|
| 当前产品自动检查 | passed：本轮26项针对性检查及构建；原基线c5c91cb的53项全套未重跑 |
| 当前冻结项目 | 已生成：`.local/person3-final/three-domain-freeze.t3project.json`，3域、16,739,046字节；D2为新版数据/分析及本轮4条实时AI |
| 最终冻结项目页面往返 | passed：16:19:59空白页恢复再导出，除savedAt外全部内容一致，范围、选中finding与历史时间保留；见证据freeze字段 |
| 原基线空白页恢复再保存 | passed：c5c91cb的19,372,951字节项目除savedAt全内容一致；不自动记作新冻结项目往返通过 |
| 当前产品独立签收 | not_started：旧版本核心通过不自动覆盖3a558506或页面 |

本轮 [往返证据](../../reports/person3/final/restore-check.json) 保留首轮记录，并新增finalRound绑定c5c91cb；旧记录不改写。
旧D2及invalid原文留在同目录 `three-domain-semantic-reviewed.t3project.json`；原始 `three-domain-final.t3project.json` 仍备份。D2缺失来源已修复，见 [IF-05](IF-05-get-evidence.md)；最终独立签收尚无。
人员4 [2cc2df1审计](https://github.com/ynugyz/Gittrae/blob/2cc2df1/acceptance/reports/2026-10-25_78f7678_audit.md) 对旧产品78f7678的核心导出恢复通过；本轮页面由人员3自测。
历史展示夹具及检查见 [开发自测](../../reports/person3/verification.md)，不替代本轮真实项目证据。

下一步：交明确新commit及往返证据给人员4，按 [验收矩阵](../../acceptance/cases.md) 独立复验SAVE-01/02、PERF-01；不得将保存成功当作来源或统计正确性签收。
