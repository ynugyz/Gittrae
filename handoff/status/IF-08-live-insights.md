# IF-08 · 本机分析与真实AI接线

必做；人员2服务，人员3客户端。人员3报告：2026-10-25T15:51:37+08:00，dev/app；客户端commit `a0023b3da87a2a1b888f1b7d99b882f5ac427901`；依据总控本阶段批准的窄范围接口决定，schemaVersion保持1。

已做：AI最小facts携带fieldIds及sampleSize；统计改为POST /api/analyze（见IF-00）；同一8787服务，启动兼容index.mjs。解释先检查所属分析、结果引用及占位，再重建固定finding/cites。共享验证禁止live_ai冒充fact，恢复路径同样检查。API响应和异步项目校验后均检查请求序号/快照。

| 阶段 | 状态 |
|---|---|
| 客户端自测 | passed：22项边界/存储/图谱检查及构建；其中新增统计请求不传原来源、未知引用拒绝、恢复拒绝伪造AI事实 |
| 服务端 | in_progress：人员2原探通证据保留；本轮等待/api/analyze及最新归一化交付，未由人员3复验 |
| 三域页面真实AI | not_started：待真实数据和服务接入 |
| 人员4产品复验 | not_started |

直接依赖IF-00/01/02/03。下一步人员3按D1→D2→D3接入，三域各一次页面真实调用，记录脱敏requestId/model/analysisId；人员4按AI/TRACE/STATE用例复验。密钥仅服务端；缺配置如实blocked，不用模板补验收。
