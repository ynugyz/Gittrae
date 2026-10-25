# IF-04 · mergeGraph：图合并与邻域

必做；负责人/报告人：本机人员3；2026-10-25；分支 `dev/app`。
产品commit：`c5c91cb292936e1aa0986caa05adc751453433a6`；已合人员1 `1ba946d`、人员2 `6095758`。

**必读依赖：** [IF-00 契约](IF-00-contracts.md) → [IF-01 数据图](IF-01-import-files.md) → [IF-02 分析](IF-02-analyze.md) → [IF-03 发现](IF-03-build-facts.md)；[验收矩阵](../../acceptance/cases.md)。
[实现入口](https://github.com/ynugyz/Gittrae/blob/c5c91cb292936e1aa0986caa05adc751453433a6/src/graph/index.ts)：分片合并、冲突/悬空/方向拒绝、finding/cites重建与当前邻域。

| 检查 | 状态与边界 |
|---|---|
| 真实分片函数集成 | passed：基础、analysis、finding分片集成及严格校验通过 |
| 当前产品自动检查 | passed：53项测试及构建通过；不是53项图谱页面检查 |
| 三域页面首轮 | passed：统计、三图、统计数字/AI数字/发现节点三种入口回源均完成 |
| 图谱页面发现节点点击 | passed：三域AI发现节点→引用计算→原始记录均已操作 |
| 当前产品独立复验 | not_started：不能沿用旧产品审计签收c5c91cb或页面 |

历史函数检查和浏览器证据：[开发自测](../../reports/person3/verification.md)。
人员4 [2cc2df1审计](https://github.com/ynugyz/Gittrae/blob/2cc2df1/acceptance/reports/2026-10-25_78f7678_audit.md) 的受测产品为78f7678；不是本版本或页面签收。

下一步：三域发现节点点击与范围隔离已完成；人员4按明确新commit独立复验GRAPH-01、STATE-01、PERF-01。
