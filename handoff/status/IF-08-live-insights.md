# IF-08 · 真实AI交接【人员2、3、4必读】

人员3，2026-10-25 16:10阶段汇报。固定产品`c5c91cb`；页面测试客户端`33c3438`与当前前端代码一致，运行服务`6095758`。官方api.deepseek.com，实际模型deepseek-flash；密钥仅人员2启动的127.0.0.1:8787服务进程。

| 页面场景/北京时间 | analysisId | requestId | 有效解释 |
|---|---|---|---|
| D1 2024收入/消费，16:06:02.368 | analysis:ae5630ca45ee22b7ba0444f1 | c3c9f64d-4cfa-4384-b923-b18a3a606d22 | 4 |
| D2 FY2025营收/净利润，16:05:40.274 | analysis:85fa7af18b1a361461ac8d74 | d29d2513-f976-4234-ab7f-593fb57aef0a | 4 |
| D3 2026-08单月销量/同比，16:07:11.425 | analysis:0146ae7cff7d1b5651bb6f06 | e4af32b4-0752-45da-b6bd-a2ae5dea7787 | 4 |

均由页面触发，并与[人员2严格服务日志](https://github.com/ynugyz/Gittrae/blob/517dd2cdb885b8a542fc974b7ab58ccee96579ee/handoff/status/IF-08-live-insights.md)按时间和analysisId对应。逐条引用及输入SHA见[机器证据](../../reports/person3/final/integration-checks.json)；页面文本：[D1](../../reports/person3/final/d1-strict-page.txt)、[D2](../../reports/person3/final/d2-strict-page.txt)、[D3](../../reports/person3/final/d3-strict-page.txt)。每域AI数字和发现节点均已点击回到原始记录。

严格边界：字段映射/有效样本数保留；未知/跨分析引用、裸数字和错误占位拒绝；服务与共享图/恢复校验一致。旧响应不覆盖当前项目。最终项目保存并在空白页恢复，最新12条解释保留、标历史且未触发模型；[恢复证据](../../reports/person3/final/restore-check.json)。旧版3条裸数字解释已标invalid保留原文，[失效清单](../../reports/person3/final/invalidated-legacy-ai.json)，旧成功不替代新版成绩。

未签收：独立页面复验尚待人员4；D1/D2部分解释出现“榜单/市场”泛化措辞，须人工审阅，不能把数值引用通过视为全部语义正确。服务重启需在服务端重新配置环境变量；不上传密钥、不用模板补成功。
