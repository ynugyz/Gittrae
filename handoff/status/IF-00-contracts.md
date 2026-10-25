# IF-00 · 公共契约与集成【全员必读】

人员3，2026-10-25 16:10阶段汇报。产品固定为 `c5c91cb292936e1aa0986caa05adc751453433a6`（dev/app）；数据入口 `1ba946d`，服务实现 `6095758`。依据[总控正式决定](https://github.com/ynugyz/Gittrae/blob/db28c7cd6a23dfb45ded717baaf2e803b7f42145/handoff/decisions/2026-10-25-final-40-minutes.md)；schemaVersion=1，src/contracts为唯一浏览器契约。

File[]与默认范围已接通。统计走同机8787 POST /api/analyze；只传规范值及必要元数据，不传原字节/原始记录/逐格来源。AI facts含fieldIds/sampleSize；引用检查后重建发现图。异步返回检查请求序号和项目快照。共享校验与服务均拒绝AI占位符外裸数字；null筛选及重复分析时间冲突已修复。

| 阶段 | 实际状态 |
|---|---|
| 开发验证 | 53项测试、生产构建通过；Node统计测试仍由npm test执行；大图表分包提示保留 |
| 三域页面 | D1 2024年31条、D2 FY2025 5228条、D3 2026-08 Top50：统计、三图、统计数字/AI数字/发现节点回源均已操作通过 |
| 真实AI | 每域4条通过新版严格校验，模型deepseek-flash；时间/请求/分析编号见[IF-08](IF-08-live-insights.md) |
| 保存恢复 | 最终19,372,951字节，3域6次历史分析，选中发现节点及全部内容往返一致（仅savedAt改变）；历史AI标注正确 |
| 独立签收 | 尚未完成最终版本的独立页面复验；不得把作者页面证据称独立签收 |

剩余限制：D2唯一缺失营收688759未提供直接单元格来源，已在[IF-01](IF-01-import-files.md)交人员1（原记录2755、列4）；AI部分D1/D2措辞使用“榜单/市场”，文字含义仍待审阅，引用检查不等于语义正确。旧版3条裸数字解释明确标invalid保留原文，不进入发现图或有效解释。

最小接手：[人员3入口](../人员3_界面与集成/START_HERE.md) → [运行说明](../人员3_界面与集成/IMPLEMENTATION.md#runtime) → [机器证据](../../reports/person3/final/integration-checks.json)及[恢复比较](../../reports/person3/final/restore-check.json)。接下来仅补上述缺口与独立审计，不扩功能。
