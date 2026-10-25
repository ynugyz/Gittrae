# IF-00 · 最终集成交付【全员必读】

人员3，2026-10-25 16:20冻结。产品分支dev/app，完整commit `3a558506094c7934ccb1927108bf02950e71dee5`；已正常推送。按总控决定仅取入人员1 `42c91031f0baff61135018d0c26da4f8eec225eb` 空值来源修复、人员2 `62fed25342fd724b73d197666279a8bc6a24d5c1` 语义提示约束，不扩功能。

- 本轮26项针对性检查及生产构建通过；此前c5c91cb的53项测试与三域三图、三种数字回源证据保留，未冒充最终全套重跑。
- D2重新导入为适配器1.0.1、新datasetVersion；FY2025范围5228、营收5227有效/1排除。页面已确认688759缺失值→原记录2755、列索引4、空字符串；[修复复验](../../reports/person3/final/d2-freeze-check.json)、[页面截图](../../reports/person3/final/d2-fixed-empty-source.png)。
- 人员2审阅指定的D1两条/D2一条解读已标invalid并保留原文；D1剩2条、D3原4条沿用正确历史；新版D2于16:18:40重新取得4条真实解读。首次裸数字错误被拒绝，手动重试一次成功。详见[IF-08](IF-08-live-insights.md)。
- 最终三域项目16,739,046字节，已导出→空白页恢复→再导出，全字段除savedAt一致；当前范围、选中finding和历史时间保留，恢复无模型重发。[恢复证据](../../reports/person3/final/restore-check.json)。
- 当前代码停止修改，独立最终页面签收尚未取得；大图表分包提示仍保留。不得将作者与协作自测标作人员4独立签收。

演示：本机http://127.0.0.1:5173/ → 恢复 `.local/person3-final/three-domain-freeze.t3project.json` → 左侧D1/D2/D3入口，分别选2024居民、FY2025企业、2026-08车企分析。三图、可点击数字与信息网络均在同一工作台。历史原文及旧D2版本保留在同目录 `three-domain-semantic-reviewed.t3project.json`；原始演示备份 `three-domain-final.t3project.json` 未覆盖。

统一启动：依赖已安装时 `npm run dev`；当前网页与8787服务保持运行，勿重复启动或安装。模型服务重启需服务端环境配置DEEPSEEK_API_KEY，密钥不进仓库/浏览器/项目。main仅同步交接；产品纳入main须按总控原审计条件。

[人员3最简入口](../人员3_界面与集成/START_HERE.md) · [运行与接线](../人员3_界面与集成/IMPLEMENTATION.md#runtime) · [总控决定](https://github.com/ynugyz/Gittrae/blob/db28c7cd6a23dfb45ded717baaf2e803b7f42145/handoff/decisions/2026-10-25-final-40-minutes.md)
