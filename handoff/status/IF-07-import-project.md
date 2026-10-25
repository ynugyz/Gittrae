# IF-07 · importProject：原子恢复

必做；负责人/报告人：本机人员3；2026-10-25；分支 `dev/app`。
产品commit：`33c34387025c0bce96b8d66a98af5fe0414b34a3`；已合人员1 `1ba946d`、人员2 `90c3ae0`。

**必读依赖：** [IF-00 契约](IF-00-contracts.md) → [IF-06 导出](IF-06-export-project.md)；历史解释读 [IF-08](IF-08-live-insights.md)，来源缺口读 [IF-05](IF-05-get-evidence.md)。
[实现入口](https://github.com/ynugyz/Gittrae/blob/33c34387025c0bce96b8d66a98af5fe0414b34a3/src/storage/index.ts)：版本、哈希、原字节重解析、缓存和引用全部通过后才替换项目；失败保留原状态。

| 检查 | 状态与边界 |
|---|---|
| 当前产品自动检查 | passed：52项测试及构建通过 |
| 全新空白页实际恢复 | passed：恢复3域、3分析、9条有效历史及3条invalid；原文不改写 |
| 恢复后再次保存 | passed：16,614,813字节项目除savedAt外全内容相等 |
| 当前产品独立签收 | not_started：旧产品核心复验不签收新版本或页面 |

本轮 [实际页面往返证据](../../reports/person3/final/restore-check.json) 的受测代码记录为 `8a8c8bd + 90c3ae0`，保留原证据绑定。
人员4 [2cc2df1审计](https://github.com/ynugyz/Gittrae/blob/2cc2df1/acceptance/reports/2026-10-25_78f7678_audit.md) 已通过旧产品78f7678核心恢复与损坏缓存检查；未签收33c3438及本轮页面。
恢复不重新计算或请求模型；历史解释不冒充本次实时调用，invalid记录继续无效。历史边界检查见 [开发自测](../../reports/person3/verification.md)。
D2缺失营收sources为空仍由IF-01处理；快照可恢复不代表所有来源完整或三域全链通过。

下一步：人员4固定新commit复验 [SAVE-01/02/03、STATE-01](../../acceptance/cases.md)，重点检查损坏文件拒绝、失败保留原项目与历史状态。
