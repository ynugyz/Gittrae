# IF-08 · 本机服务与真实AI【人员2、3、4必读】

人员3接收记录，2026-10-25 15:59。集成代码`d88c32a`；服务来自人员2 `042ca2c`。同机127.0.0.1:8787，/api/health已确认keyConfigured=true、model=deepseek-flash。密钥只在人员2启动的服务进程，不进入页面或项目文件。

客户端发送最小facts（含fieldIds/sampleSize）；响应检查analysisId、模型、来源类型、结果引用与占位，随后重建固定发现图。旧响应及异步验证中项目变化均拒绝覆盖。恢复仍使用同样严格校验；历史解读不得显示为本次调用。

| 页面真实调用 | 状态/证据 |
|---|---|
| D1 2024收入/消费，31条 | passed：15:56:58，4条实时解读；[页面文本](../../reports/person3/final/d1-page.txt)、[截图](../../reports/person3/final/d1-page.png) |
| D2 FY2025营收/净利润，5228条 | passed：15:57:48，4条实时解读；[页面文本](../../reports/person3/final/d2-page.txt)、[截图](../../reports/person3/final/d2-page.png) |
| D3 2026-08月销量/同比 | in_progress |
| 三域合并保存恢复/独立审计 | 未完成 |

上述均由页面按钮触发，模型deepseek-flash；requestId/analysisId将与人员2脱敏服务日志对照，不以此前单独HTTP探通替代。首次临时浏览器会话意外关闭，页面证据已保存；重建合并项目进行恢复验收，最多每域再一次必要真实调用。所有作者历史探通记录保留在[人员2报告](../../reports/人员2_交付与复验.md)。
