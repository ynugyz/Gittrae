# IF-07 · importProject：原子恢复

必做；负责人/报告人：本机人员3；2026-10-25；分支 `dev/app`。
产品commit：`3a558506094c7934ccb1927108bf02950e71dee5`；精确取入人员1 `42c91031f0baff61135018d0c26da4f8eec225eb`、人员2 `62fed25342fd724b73d197666279a8bc6a24d5c1`。

**必读依赖：** [IF-00 契约](IF-00-contracts.md) → [IF-06 导出](IF-06-export-project.md)；历史解释读 [IF-08](IF-08-live-insights.md)，来源缺口读 [IF-05](IF-05-get-evidence.md)。
[实现入口](https://github.com/ynugyz/Gittrae/blob/3a558506094c7934ccb1927108bf02950e71dee5/src/storage/index.ts)：版本、哈希、原字节重解析、缓存和引用全部通过后才替换项目；失败保留原状态。

| 检查 | 状态与边界 |
|---|---|
| 当前产品自动检查 | passed：本轮26项针对性检查及构建；原基线c5c91cb的53项全套未重跑 |
| 最终冻结项目空白页恢复 | passed：16:19:59，16,739,046字节项目恢复再保存除savedAt完全一致；当前FY2025、选中finding及16:18:40历史时间保留，无模型重发；见证据freeze字段 |
| 原基线全新空白页恢复 | passed：c5c91cb项目恢复3域、6次历史分析及旧历史/invalid；原文不改写 |
| 原基线恢复后再次保存 | passed：c5c91cb的19,372,951字节项目除savedAt外全内容相等；不覆盖新冻结项目 |
| 当前产品独立签收 | not_started：旧产品核心复验不签收新版本或页面 |

本轮 [实际页面往返证据](../../reports/person3/final/restore-check.json) 保留首轮记录并追加finalRound，绑定原基线c5c91cb；损坏缓存实际页面拒绝且原项目保留。
人员4 [2cc2df1审计](https://github.com/ynugyz/Gittrae/blob/2cc2df1/acceptance/reports/2026-10-25_78f7678_audit.md) 已通过旧产品78f7678核心恢复与损坏缓存检查；未签收3a558506及本轮页面。
恢复不重新计算或请求模型；历史解释不冒充本次实时调用，invalid记录继续无效。历史边界检查见 [开发自测](../../reports/person3/verification.md)。
当前主机项目 `.local/person3-final/three-domain-freeze.t3project.json` 为3域、16,739,046字节，D2使用已修复来源的新数据/分析；新项目恢复证据已独立追加freeze字段。旧D2及invalid原文在同目录语义复核项目，原始three-domain-final仍备份。

下一步：人员4固定新commit复验 [SAVE-01/02/03、STATE-01](../../acceptance/cases.md)，重点检查损坏文件拒绝、失败保留原项目与历史状态。
