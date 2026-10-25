# IF-08 · 真实AI交接【人员2、3、4必读】

2026-10-25 16:20；最终产品3a558506，服务提示修复62fed253；官方api.deepseek.com，实际模型deepseek-flash，密钥仅服务端。当前已恢复项目显示历史记录，无模型重发。

| 最终演示域 | 页面调用北京时间 | analysisId | 当前解释 |
|---|---|---|---|
| D1 2024收入/消费 | 16:06:02.368 | analysis:ae5630ca45ee22b7ba0444f1 | 保留2条；审阅后2条invalid |
| D2 新来源版本FY2025 | 16:18:40 | analysis:e98f90033b1c0bda7fca4f31 | 新版4条通过引用/裸数字检查；企业样本措辞 |
| D3 2026-08销量/同比 | 16:07:11.425 | analysis:0146ae7cff7d1b5651bb6f06 | 原4条保留 |

D2首次新调用因裸数字拒绝，不计成功；手动重试一次成功。[新版页面原文](../../reports/person3/final/d2-freeze-page.txt)与[机器证据freeze字段](../../reports/person3/final/integration-checks.json)保留ID、引用和时间。D1/D3原页面与三处回源证据属于c5c91cb，未改统计、原文或假称重新调用。

按[人员2语义审阅](https://github.com/ynugyz/Gittrae/blob/faee5466fb8b7e8bb66ce421bee18c26b3eb8297/handoff/status/IF-08-live-insights.md)，以下原文标invalid、退出有效解释与发现图：

- D1 `insight:531de00dde468583d5a56c0a`、`insight:a261581777e009c98d2c7fed`。
- 旧D2 `insight:95990c421ee8deb7af449ba2`。

原文及其余正确旧D2解释完整保存在本地three-domain-semantic-reviewed项目；最终three-domain-freeze使用重新导入D2及其新分析。另3条更早裸数字失效记录仍保留，未改写模型原文。引用有效不等于语义独立签收；人员4最终页面验收仍待完成。

全员入口[IF-00](IF-00-contracts.md)，保存恢复[IF-06](IF-06-export-project.md)/[IF-07](IF-07-import-project.md)。重启服务需服务端环境配置，当前8787保持运行。
