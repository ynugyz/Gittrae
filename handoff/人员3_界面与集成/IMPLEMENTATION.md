# 人员3接入说明

**人员1、2、3接入前必读；总控与人员4核对待定项和运行条件。** [进度与下一步](START_HERE.md) · [公共设计v1.0](../01_公共接口.md)。下述为人员3当前实现，不表示其他模块已兼容；差异只维护在 [IF-00](../status/IF-00-contracts.md)。

<a id="delivered"></a>

## 1. 唯一入口

[共享类型](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/contracts/index.ts)、[MOCK样例](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/contracts/example.ts)、[模块接线](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/app/modules.ts)、[图谱与回源](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/graph/index.ts)、[保存恢复](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/storage/index.ts)。固定代码版本为39c92f1。

<a id="data"></a>

## 2. 人员1接入

当前页面检测 `src/data/index.ts`，调用 `importFiles(files: File[], options: ImportOptions): Promise<DatasetBundle[]>`。所有记录及源字节经项目校验后进入页面；同datasetId不同内容拒绝覆盖。

`SourceFile.originalFileName` 只存文件名，CSV参数为delimiter/quoteChar/escapeChar/skipEmptyLines:false。存储提供 `reparseSource`、`sha256`、`bytesToBase64`。空记录保留，终端换行伪记录不新增编号。

`getDefaultRequest(bundle)` 是可选钩子，尚未经总控批准为公共契约；当前options为空对象，通用CSV角色/单位确认与适配默认范围仍待对齐。

<a id="analysis"></a>

## 3. 人员2接入

当前页面检测 `src/analysis/index.ts`，同步调用 `analyze(bundle, request): AnalysisResult` 和 `buildFacts(analysis): FactsOutput`；后者为 `{ insights, graph }`。统计在浏览器执行，不能直接依赖Node专属模块。

按共享类型提供 `scope.recordIds/label/limitations`、字符串型 `GraphNode.ref` 等。每项结果的valid/excluded记录互斥且完整覆盖scope；字段与ID必须一致，页面不重算统计。finding/cites使用 `buildInsightGraph` 重建。

AI客户端请求 `POST /api/insights`，60秒超时、不自动重试；只发最小统计投影。响应须含匹配的分析/请求编号、实际model和generatedAt，实时记录为 `live_ai / interpretation / valid`；跨分析、未知引用或错误占位符拒绝。历史恢复不算本次实时调用。

<a id="runtime"></a>

## 4. 运行与恢复【人员3、4必读】

Node >=22.12；`npm ci`、`npm run dev`。网页127.0.0.1:5173，预览4173，模型服务8787。当前启动脚本只检测 `server/index.ts` 并仅在服务端读取本机.env；人员2现有.mjs入口尚未接通。

`exportProject(project): Promise<string>`、`importProject(json): Promise<ProjectSnapshot>`、`validateProject(value): Promise<ProjectSnapshot>`。紧凑JSON携带源字节、ID与历史结果；严格校验属性、哈希、重解析缓存和引用，恢复成功才替换状态，失败保留原项目。完整性校验不认证作者或统计正确性。

已计算范围随分析恢复；未计算筛选草稿不在v1持久化承诺内，当前只保存指标选择。恢复不重算或请求模型。验证命令与实际覆盖见 [自测记录](../../reports/person3/verification.md)。

<a id="pending"></a>

## 5. 待定与不兼容项

只读 [IF-00](../status/IF-00-contracts.md)：默认范围、AI结果到指标映射、通用CSV确认仍待裁决；新取得的上游结构和运行边界也须对齐。此处不再重复维护状态。

<a id="next"></a>

## 6. 下一角色接手

按 [精简交接](START_HERE.md) 的顺序处理。下游确认实际模块commit和真实数据证据后接入；人员4按新集成commit独立验收。
