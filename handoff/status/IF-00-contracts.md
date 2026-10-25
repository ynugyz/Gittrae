# IF-00 · 公共契约与集成【全员必读】

人员3，2026-10-25 15:59。集成代码：`d88c32a5e035e813ee4f862e04eb8b7aa501ede7`（dev/app），已合人员1 `1ba946d`、人员2 `042ca2c`。依据[总控正式决定](https://github.com/ynugyz/Gittrae/blob/db28c7cd6a23dfb45ded717baaf2e803b7f42145/handoff/decisions/2026-10-25-final-40-minutes.md)；schemaVersion=1，src/contracts为唯一浏览器契约。

File[]入口和默认范围钩子已接入。统计通过同机8787的POST /api/analyze，投影保留身份/版本/域/适配信息/字段/规范值/问题/基础图；不传原始字节、rawRecords或provenance。AI facts含fieldIds及sampleSize。引用校验后重建finding/cites；异步返回检查请求序号与项目快照。启动兼容.mjs，严格项目校验保持。

| 阶段 | 实际状态 |
|---|---|
| 集成/自测 | passed：50项测试及构建；Node侧analysis.test.ts仍由npm test执行，不纳入浏览器生产类型检查 |
| D1页面 | passed：2024年31/155记录；三图、均值回源、4条真实AI（15:56:58，deepseek-flash） |
| D2页面 | passed：完整FY2025原文件，5228规范记录；三图、有效回源、4条真实AI（15:57:48） |
| D3与合并保存恢复 | in_progress |
| 独立产品审计 | not_started：由人员4按本集成版本复验 |

剩余边界：IF-02已登记缺失/未分类筛选的Scalar比较错误，待人员2修复；D2唯一营收缺失记录的原单元格回源待核对。重复计算事实仅时间变化的冲突已在c1eda91修复。不能将默认范围通过扩写为全部验收通过。

接手只读[人员3入口](../人员3_界面与集成/START_HERE.md)、[调用说明](../人员3_界面与集成/IMPLEMENTATION.md)、[IF-08真实AI](IF-08-live-insights.md)。真实界面证据保留在reports/person3/final；后续按接口卡更新，不新增重复模板。
