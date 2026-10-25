# IF-04 · mergeGraph：图合并与邻域

必做；负责人/报告人：本机人员3；2026-10-25T15:38:25+08:00；分支dev/app。契约：[v1.0](../01_公共接口.md)，无新增批准。直接依赖：IF-00、IF-01、IF-02、IF-03；兼容问题统一见 [IF-00](IF-00-contracts.md)。

实现commit：`39c92f147dc1ff81e0bdaf9f4190b81051a74cbd`；[实现入口](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/graph/index.ts)。已做：分片合并、同内容去重、冲突/悬空/方向拒绝、发现图重建与当前邻域。

| 阶段 | 当前状态 |
|---|---|
| 实现 | in_progress：本模块已交付，完整链路待接入 |
| 本机自测 | passed：图测试：合并合法分片并投入冲突/伪造边，预期拒绝无效图；实际通过，历史分析隔离通过 |
| 三域真实联调 | blocked：上游已交付但契约/运行入口不相容，尚未接入 |
| 人员4产品复验 | not_started：等待明确集成commit；基线材料核验不算应用复验 |

本轮检查commit：`197d6b2478e5666eef2dd241a4bd1a0443fce435`；产品文件与实现commit一致。测试输入、操作与历史浏览器证据见 [自测记录](../../reports/person3/verification.md#handoff-recheck)；本轮未运行上游模块、浏览器或真实API。

下一步：总控裁决IF-00、原负责人对齐并交commit后，人员3接入真实基础/分析/发现分片，核验三域当前图与完整财务表表现。人员4按 [验收矩阵](../../acceptance/cases.md) 的 GRAPH-01、STATE-01、PERF-01 独立复验；依赖未齐暂缓真实联调与签收，不减少必做项。
