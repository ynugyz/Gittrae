# IF-05 · getEvidence：数字回源

必做；负责人/报告人：本机人员3；2026-10-25；分支 `dev/app`。
产品commit：`c5c91cb292936e1aa0986caa05adc751453433a6`；已合人员1 `1ba946d`、人员2 `6095758`。

**必读依赖：** [IF-00 契约](IF-00-contracts.md) → [IF-01 来源](IF-01-import-files.md) → [IF-02 结果](IF-02-analyze.md) → [IF-03 发现](IF-03-build-facts.md)；AI另读 [IF-08](IF-08-live-insights.md)。
[实现入口](https://github.com/ynugyz/Gittrae/blob/c5c91cb292936e1aa0986caa05adc751453433a6/src/graph/index.ts)：返回方法、范围、有效/排除记录、原字符串和来源位置。

| 检查 | 状态与证据 |
|---|---|
| D1均值有效回源 | passed：安徽原文36782，记录12、列1；[截图](../../reports/person3/final/d1-source.png) |
| D2均值有效回源 | passed：第一有效原文895470048.65，记录8、列4；[有效回源截图](../../reports/person3/final/d2-graph-source.png) |
| D3均值有效回源 | passed：北京奔驰原文27312，记录22、列1；[截图](../../reports/person3/final/d3-source.png) |
| D2缺失营收回源 | blocked：688759的sources为空，已交IF-01；[缺失记录截图](../../reports/person3/final/d2-excluded.png)不能证明有效来源 |
| 发现节点页面回源 | passed：三域AI文字数字与发现节点均回到相应原始记录；缺失来源仍单列 |
| 当前产品自动检查 | passed：53项测试与构建；不替代上述页面检查 |

上述位置按页面显示记录；历史来源边界检查见 [开发自测](../../reports/person3/verification.md)。8a8c8bd已拒绝AI裸数字，AI引用证据以IF-08为准。
当前c5c91cb及页面尚无独立签收；人员4的2cc2df1报告针对旧产品78f7678。

下一步：人员1修复缺失营收来源，人员3复验该缺失记录；人员4按新commit和 [验收矩阵](../../acceptance/cases.md) 复验TRACE-01、GRAPH-01、D1-01。
