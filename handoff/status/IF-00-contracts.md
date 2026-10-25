# IF-00 · 公共契约与接线

必做；人员3维护，总控批准语义。报告：本机人员3，2026-10-25T15:51:37+08:00，dev/app；实现commit `a0023b3da87a2a1b888f1b7d99b882f5ac427901`。

总控本阶段启动指令已批准：schemaVersion=1不变；File[]数据入口与可选getDefaultRequest；统计留在Node；同一8787服务新增POST /api/analyze；AI最小facts添加fieldIds，sampleSize为有效记录数。

已实现：前端调用/api/analyze，payload为 `{bundle, request}`；bundle仅含schemaVersion/datasetId/datasetVersion/domain/fields/records(recordId+values)/graph，原字节、rawRecords和逐格provenance留在浏览器。响应为 `{analysis,facts}`，facts为 `{insights,graph}`；先校验computed/fact引用再用buildInsightGraph重建。API types统一在src/contracts。启动兼容server/index.mjs；计算前后及项目校验后检查请求序号和项目快照，过时不覆盖。

| 阶段 | 状态 |
|---|---|
| 实现 | in_progress：人员3薄接线已提交；等待人员1 File[]包装与人员2 /api/analyze最新commit |
| 本机自测 | passed：22项测试、生产构建；大分包体积提示保留 |
| 真实联调 | not_started：尚未在页面取得首个真实域完整结果 |
| 独立审计 | not_started：等待集成commit |

依赖IF-01/02/03/08；当前已看到上游70caccb、ffd11a7的新对齐提交，仍需核对本阶段入口交付。下一步人员3接入相容commit，先D1再D2/D3；16:00前汇报首域，16:10三域真实AI，16:18冻结，16:23截止。严格来源、缓存、引用校验保留；不重写上游算法。
