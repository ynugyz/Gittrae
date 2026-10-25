# IF-06 · exportProject：项目导出

必做；负责人/报告人：本机人员3；2026-10-25T15:38:25+08:00；分支dev/app。契约：[v1.0](../01_公共接口.md)，无新增批准。直接依赖：IF-00、IF-01、IF-02、IF-03；真实解释另依赖IF-08；兼容问题统一见 [IF-00](IF-00-contracts.md)。

实现commit：`39c92f147dc1ff81e0bdaf9f4190b81051a74cbd`；[实现入口](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/storage/index.ts)。已做：严格校验后输出紧凑JSON，携带源字节、分析、ID和历史解释；不保存未计算筛选草稿。

| 阶段 | 当前状态 |
|---|---|
| 实现 | in_progress：本模块已交付，完整链路待接入 |
| 本机自测 | passed：存储测试：固定样例及11,525行FY2025展示夹具导出后恢复，预期ID/值/来源保持；实际通过，JSON约33.0MiB。该夹具不证明财务适配/统计 |
| 三域真实联调 | blocked：上游已交付但契约/运行入口不相容，尚未接入 |
| 人员4产品复验 | not_started：等待明确集成commit；基线材料核验不算应用复验 |

本轮检查commit：`197d6b2478e5666eef2dd241a4bd1a0443fce435`；产品文件与实现commit一致。测试输入、操作与历史浏览器证据见 [自测记录](../../reports/person3/verification.md#handoff-recheck)；本轮未运行上游模块、浏览器或真实API。

下一步：总控裁决IF-00、原负责人对齐并交commit后，人员3用真实三域和实时解释项目验证导出、清空、恢复，核对文件不含密钥。人员4按 [验收矩阵](../../acceptance/cases.md) 的 SAVE-01/02、PERF-01 独立复验；依赖未齐暂缓真实联调与签收，不减少必做项。
