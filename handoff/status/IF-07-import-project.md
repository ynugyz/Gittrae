# IF-07 · importProject：原子恢复

必做；负责人/报告人：本机人员3；2026-10-25T15:38:25+08:00；分支dev/app。契约：[v1.0](../01_公共接口.md)，无新增批准。直接依赖：IF-00、IF-06；完整项目另依赖真实上游；兼容问题统一见 [IF-00](IF-00-contracts.md)。

实现commit：`39c92f147dc1ff81e0bdaf9f4190b81051a74cbd`；[实现入口](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/storage/index.ts)。已做：版本/哈希/原字节重解析/缓存/引用校验，成功才替换状态；保留ID与历史时间，不重发模型请求。

| 阶段 | 当前状态 |
|---|---|
| 实现 | in_progress：本模块已交付，完整链路待接入 |
| 本机自测 | passed：存储测试：合法快照恢复、损坏哈希/缓存/悬空引用拒绝；58份真实CSV逐项匹配manifest；实际通过。原始字节核对不证明业务口径 |
| 三域真实联调 | blocked：上游已交付但契约/运行入口不相容，尚未接入 |
| 人员4产品复验 | not_started：等待明确集成commit；基线材料核验不算应用复验 |

本轮检查commit：`197d6b2478e5666eef2dd241a4bd1a0443fce435`；产品文件与实现commit一致。测试输入、操作与历史浏览器证据见 [自测记录](../../reports/person3/verification.md#handoff-recheck)；本轮未运行上游模块、浏览器或真实API。

下一步：总控裁决IF-00、原负责人对齐并交commit后，人员3真实三域项目恢复及损坏文件拒绝；核对失败保留原项目、历史解释不冒充实时调用。人员4按 [验收矩阵](../../acceptance/cases.md) 的 SAVE-01/02/03、STATE-01 独立复验；依赖未齐暂缓真实联调与签收，不减少必做项。
