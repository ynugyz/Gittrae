# 人员3接入说明

**人员1、2、3接入前必读；总控与人员4核对运行条件。** [进度与下一步](START_HERE.md) · [公共设计v1.0](../01_公共接口.md) · [总控正式决定（db28c7c）](https://github.com/ynugyz/Gittrae/blob/db28c7cd6a23dfb45ded717baaf2e803b7f42145/handoff/decisions/2026-10-25-final-40-minutes.md)。以下按本轮已批准接口说明；实际进度只维护在 [IF-00](../status/IF-00-contracts.md) 等接口卡。

<a id="delivered"></a>

## 1. 唯一入口

[共享类型](https://github.com/ynugyz/Gittrae/blob/d88c32a5e035e813ee4f862e04eb8b7aa501ede7/src/contracts/index.ts)、[MOCK样例](https://github.com/ynugyz/Gittrae/blob/d88c32a5e035e813ee4f862e04eb8b7aa501ede7/src/contracts/example.ts)、[模块接线](https://github.com/ynugyz/Gittrae/blob/d88c32a5e035e813ee4f862e04eb8b7aa501ede7/src/app/modules.ts)、[图谱与回源](https://github.com/ynugyz/Gittrae/blob/d88c32a5e035e813ee4f862e04eb8b7aa501ede7/src/graph/index.ts)、[保存恢复](https://github.com/ynugyz/Gittrae/blob/d88c32a5e035e813ee4f862e04eb8b7aa501ede7/src/storage/index.ts)。本轮集成版本为d88c32a，已纳入人员1 1ba946d、人员2 042ca2c。

<a id="data"></a>

## 2. 人员1接入

当前页面检测 `src/data/index.ts`，调用 `importFiles(files: File[], options: ImportOptions): Promise<DatasetBundle[]>`。所有记录及源字节经项目校验后进入页面；同datasetId不同内容拒绝覆盖。

`SourceFile.originalFileName` 只存文件名，CSV参数为delimiter/quoteChar/escapeChar/skipEmptyLines:false。存储提供 `reparseSource`、`sha256`、`bytesToBase64`。空记录保留，终端换行伪记录不新增编号。

`getDefaultRequest(bundle)` 已正式批准为可选钩子，不增加持久化字段；按真实维度选择D1 2024、D2 FY2025与沪深代码规则、GASGOO 2026-08，CPCA保留自身口径。当前options为空对象；保留普通CSV入口，未知字段/口径明确提示，暂停高级角色配置。

<a id="analysis"></a>

## 3. 人员2接入

确定性 `analyze/buildFacts` 在现有Node服务运行，保留.mjs与node:crypto；浏览器异步调用同机 `POST /api/analyze`，请求 `{ bundle, request }`，成功返回 `{ analysis, facts }`，其中facts为 `{ insights, graph }`。失败返回明确HTTP错误及 `{ error: { code, message, retryable } }`；过时分析响应不得覆盖当前状态。

分析bundle仅投影必要身份、版本、域、适配信息、字段、recordId与values、问题及基础图信息，不发送rawBytesBase64、rawRecords或逐格provenance；完整来源仍在浏览器用于回源和导出。分析请求使用有界大小限制，不另起服务。

按共享类型提供 `scope.recordIds/label/limitations`、字符串型 `GraphNode.ref` 等。每项结果的valid/excluded记录互斥且完整覆盖scope；字段与ID必须一致，页面不重算统计。finding/cites使用 `buildInsightGraph` 重建。

AI客户端请求 `POST /api/insights`，60秒超时、不自动重试；最小facts投影已批准加入fieldIds，配合context.fields标识指标，样本数使用sampleSize。响应须含匹配的分析/请求编号、实际model和generatedAt，实时记录为 `live_ai / interpretation / valid`；跨分析、未知引用或错误占位符拒绝。历史恢复不算本次实时调用。

<a id="runtime"></a>

## 4. 运行与恢复【人员3、4必读】

Node >=22.12；`npm ci`、`npm run dev`。网页127.0.0.1:5173，预览4173，分析与模型共用服务8787。启动脚本优先检测 `server/index.mjs`，兼容 `server/index.ts`，仅在服务端读取本机.env。当前本机 `/api/health` 返回keyConfigured=true、model=deepseek-flash；这只证明配置已加载，真实页面AI结果见 [IF-08](../status/IF-08-live-insights.md)。

`exportProject(project): Promise<string>`、`importProject(json): Promise<ProjectSnapshot>`、`validateProject(value): Promise<ProjectSnapshot>`。紧凑JSON携带源字节、ID与历史结果；严格校验属性、哈希、重解析缓存和引用，恢复成功才替换状态，失败保留原项目。完整性校验不认证作者或统计正确性。

已计算范围随分析恢复；未计算筛选草稿不在v1持久化承诺内，当前只保存指标选择。恢复不重算或请求模型。验证命令与实际覆盖见 [自测记录](../../reports/person3/verification.md)。

<a id="pending"></a>

## 5. 接口决定与剩余事项

默认范围钩子、Node分析路由及AI结果指标映射已由 [总控正式决定](https://github.com/ynugyz/Gittrae/blob/db28c7cd6a23dfb45ded717baaf2e803b7f42145/handoff/decisions/2026-10-25-final-40-minutes.md) 批准；通用CSV高级配置与未计算筛选草稿持久化暂停。剩余兼容问题和实际验证只读 [IF-00](../status/IF-00-contracts.md)，不得关闭来源、版本、引用或恢复校验。

<a id="next"></a>

## 6. 下一角色接手

按 [精简交接](START_HERE.md) 完成三域页面实测与保存恢复；人员4按明确的集成commit独立验收，不沿用历史自测或材料核验作为产品通过结论。
