# 人员3接入说明

**人员1、2、3接入前必读；总控与人员4核对运行条件。** [进度与下一步](START_HERE.md) · [公共设计v1.0](../01_公共接口.md) · [总控正式决定（db28c7c）](https://github.com/ynugyz/Gittrae/blob/db28c7cd6a23dfb45ded717baaf2e803b7f42145/handoff/decisions/2026-10-25-final-40-minutes.md)。以下按本轮已批准接口说明；实际进度只维护在 [IF-00](../status/IF-00-contracts.md) 等接口卡。

<a id="delivered"></a>

## 1. 唯一入口

[共享类型](https://github.com/ynugyz/Gittrae/blob/3a558506094c7934ccb1927108bf02950e71dee5/src/contracts/index.ts)、[MOCK样例](https://github.com/ynugyz/Gittrae/blob/3a558506094c7934ccb1927108bf02950e71dee5/src/contracts/example.ts)、[模块接线](https://github.com/ynugyz/Gittrae/blob/3a558506094c7934ccb1927108bf02950e71dee5/src/app/modules.ts)、[图谱与回源](https://github.com/ynugyz/Gittrae/blob/3a558506094c7934ccb1927108bf02950e71dee5/src/graph/index.ts)、[保存恢复](https://github.com/ynugyz/Gittrae/blob/3a558506094c7934ccb1927108bf02950e71dee5/src/storage/index.ts)。最终产品commit为 `3a558506094c7934ccb1927108bf02950e71dee5`，精确取入人员1 `42c91031f0baff61135018d0c26da4f8eec225eb`、人员2 `62fed25342fd724b73d197666279a8bc6a24d5c1`；代码已冻结。原基线c5c91cb的53项测试为历史检查，本轮26项针对性检查及构建通过，未重跑全套。

<a id="data"></a>

## 2. 人员1接入

当前页面检测 `src/data/index.ts`，调用 `importFiles(files: File[], options: ImportOptions): Promise<DatasetBundle[]>`。所有记录及源字节经项目校验后进入页面；同datasetId不同内容拒绝覆盖。

`SourceFile.originalFileName` 只存文件名，CSV参数为delimiter/quoteChar/escapeChar/skipEmptyLines:false。存储提供 `reparseSource`、`sha256`、`bytesToBase64`。空记录保留，终端换行伪记录不新增编号。D2适配器1.0.1生成新数据版本；新导入页面已确认688759空营收映射到记录2755、列4，原字符串为空，统计有效5227/缺失1不变。旧项目不自动补造来源，复验使用新导入版本。

`getDefaultRequest(bundle)` 已正式批准为可选钩子，不增加持久化字段；按真实维度选择D1 2024、D2 FY2025与沪深代码规则、GASGOO 2026-08，CPCA保留自身口径。当前options为空对象；保留普通CSV入口，未知字段/口径明确提示，暂停高级角色配置。

<a id="analysis"></a>

## 3. 人员2接入

确定性 `analyze/buildFacts` 在现有Node服务运行，保留.mjs与node:crypto；浏览器异步调用同机 `POST /api/analyze`，请求 `{ bundle, request }`，成功返回 `{ analysis, facts }`，其中facts为 `{ insights, graph }`。失败返回明确HTTP错误及 `{ error: { code, message, retryable } }`；过时分析响应不得覆盖当前状态。

分析bundle仅投影必要身份、版本、域、适配信息、字段、recordId与values、问题及基础图信息，不发送rawBytesBase64、rawRecords或逐格provenance；完整来源仍在浏览器用于回源和导出。分析请求使用有界大小限制，不另起服务。

按共享类型提供 `scope.recordIds/label/limitations`、字符串型 `GraphNode.ref` 等。每项结果的valid/excluded记录互斥且完整覆盖scope；字段与ID必须一致，页面不重算统计。finding/cites使用 `buildInsightGraph` 重建。

AI客户端请求 `POST /api/insights`，60秒超时、不自动重试；最小facts投影已批准加入fieldIds，配合context.fields标识指标，样本数使用sampleSize。响应须含匹配的分析/请求编号、实际model和generatedAt，实时记录为 `live_ai / interpretation / valid`；跨分析、未知引用、错误占位符或占位符外裸数字拒绝。历史恢复不算本次实时调用。

<a id="runtime"></a>

## 4. 运行与恢复【人员3、4必读】

Node >=22.12；首次安装用 `npm ci`，启动用 `npm run dev`。网页 http://127.0.0.1:5173 ，分析与模型共用 http://127.0.0.1:8787 ，生产预览4173。已有服务勿重复启动；重启须在服务端环境或本机.env配置 `DEEPSEEK_API_KEY`。启动脚本优先检测 `server/index.mjs`，兼容 `server/index.ts`；密钥不进入浏览器、仓库或项目文件。健康检查不能替代真实页面AI结果，后者见 [IF-08](../status/IF-08-live-insights.md)。

`exportProject(project): Promise<string>`、`importProject(json): Promise<ProjectSnapshot>`、`validateProject(value): Promise<ProjectSnapshot>`。紧凑JSON携带源字节、ID与历史结果；严格校验属性、哈希、重解析缓存和引用，恢复成功才替换状态，失败保留原项目。完整性校验不认证作者或统计正确性。

已计算范围随分析恢复；未计算筛选草稿不在v1持久化承诺内，当前只保存指标选择。恢复不重算或请求模型。人员2已明确将旧D1两条、D2一条解释标为invalid并保留原文；`three-domain-semantic-reviewed.t3project.json` 已完成，不把无效历史恢复成有效结论。历史检查见 [自测记录](../../reports/person3/verification.md)，当前覆盖以接口卡为准。

<a id="pending"></a>

## 5. 接口决定与剩余事项

默认范围钩子、Node分析路由及AI结果指标映射已由 [总控正式决定](https://github.com/ynugyz/Gittrae/blob/db28c7cd6a23dfb45ded717baaf2e803b7f42145/handoff/decisions/2026-10-25-final-40-minutes.md) 批准；通用CSV高级配置与未计算筛选草稿持久化暂停。剩余兼容问题和实际验证只读 [IF-00](../status/IF-00-contracts.md)，不得关闭来源、版本、引用或恢复校验。

<a id="next"></a>

## 6. 下一角色接手

D2新版页面16:18:40真实AI成功4条，analysisId为 `analysis:e98f90033b1c0bda7fca4f31`；首次裸数字响应拒绝后手动重试一次成功，详见 [IF-08](../status/IF-08-live-insights.md)。当前主机项目 `.local/person3-final/three-domain-freeze.t3project.json` 为16,739,046字节、3域，D2使用新版数据及分析；旧D2与invalid原文保留在同目录 `three-domain-semantic-reviewed.t3project.json`，原始 `three-domain-final.t3project.json` 另存备份。旧往返测试仍按原commit与项目取证，不自动转记为新冻结项目恢复通过。按 [精简交接](START_HERE.md) 交付固定最终commit与实际证据，代码不再修改。最终独立签收尚无；人员4按新commit独立验收，不沿用旧版本自测或材料核验作为产品通过结论。
