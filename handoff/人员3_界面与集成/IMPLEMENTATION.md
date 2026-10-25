# 人员3实现与接入说明

日期：2026-10-25。分支：`dev/app`。起点：`472d151b811cb9f4af0620c2bdc6bd8e78a09de7`。

用户已明确要求本机人员3尽可能推进可完成工作，本轮进入开发阶段。当前成果是人员3实现与自测，仍待人员1、2接入，以及总控确认集成范围、人员4独立复验。

## 1. 已交付入口

| 路径 | 用途 |
|---|---|
| `src/contracts/index.ts` | 六个共同对象及关联类型唯一入口 |
| `src/contracts/example.ts` | `createExampleProject()`，始终含MOCK问题标记的固定手算联调输入 |
| `src/app/App.tsx` | 上传入口、范围与指标、三图、事实/AI、历史分析、来源和保存恢复 |
| `src/app/modules.ts` | 唯一业务模块接入位置，缺模块明确未准备 |
| `src/app/state.ts` | 新增数据/分析、当前AI响应验证、旧响应隔离 |
| `src/app/api.ts` | POST `/api/insights`，60秒超时、HTTP/JSON失败、最小统计投影 |
| `src/graph/index.ts` | 图合并、当前分析查询、发现图重建、证据查询 |
| `src/storage/index.ts` | 项目校验、导出和原子恢复；原字节重解析工具 |
| `scripts/dev.mjs` | 统一启动网页及可选模型服务 |
| `scripts/create-review-projects.ts` | 生成仅用于展示/交互自测的本地项目文件 |

页面不重算直方分箱、四分位或成对样本。计算值保持原精度，显示至多4位小数；数字和图表提供来源入口。大量表格分页，图默认只包含当前分析，超过60节点时显示选中节点的两跳邻域。

## 2. 人员1接入

在 `src/data/index.ts` 导出：

```ts
import type { DatasetBundle, ImportOptions, AnalysisRequest } from '../contracts';
export async function importFiles(files: File[], options: ImportOptions): Promise<DatasetBundle[]>;
// 可选集成钩子，见第5节待确认项。
export function getDefaultRequest(bundle: DatasetBundle): AnalysisRequest;
```

浏览器通过 `File[]` 交付用户选择的文件。一次可返回多个Bundle；同datasetId不同内容会被拒绝，不能覆盖仍被旧分析引用的版本。所有记录值与来源位置需按公共契约提供。导入结果进入全项目校验后才进入页面。

`SourceFile.originalFileName` 仅保存文件名。`parseOptions` 实现细化为 `delimiter / quoteChar / escapeChar / skipEmptyLines:false`。存储模块公开 `reparseSource(source)`、`sha256(bytes)`、`bytesToBase64(bytes)`，供对齐来源缓存时复用；空行保留，末尾换行符形成的终端伪空记录不算新记录。

目前上传调用的 options 为空对象；指定适配器、通用CSV字段角色与单位确认流程，须在人员1提供实际识别/确认结果后共同接入。UI不会自行把标识列变成度量列。

## 3. 人员2接入

在 `src/analysis/index.ts` 导出：

```ts
import type { AnalysisResult, AnalysisRequest, DatasetBundle, FactsOutput } from '../contracts';
export function analyze(bundle: DatasetBundle, request: AnalysisRequest): AnalysisResult;
export function buildFacts(analysis: AnalysisResult): FactsOutput;
```

`FactsOutput = { insights, graph }`。共享字段拼写以类型入口为准，例如 `scope.recordIds / scope.label / scope.limitations`、`GraphNode.ref:string`、`exclusionReasons: Record<recordId,string>`、`selection.measureFieldIds / selection.nodeId`。这些是原设计里未逐一命名字段的实现细化，需在首次模块联调时核对。

所有MetricResult记录必须落在本次scope；valid/excluded互斥且完整覆盖scope，排除原因按recordId登记。结果ID按 `analysisId:...` 命名。仅允许可分析的数值measure；缺失值保持null。

`server/index.ts` 由人员2实现并绑定127.0.0.1:8787。`npm run dev` 自动检测此入口；服务端用Node加载`.env`，浏览器不读取密钥。新增依赖由人员3统一更新锁文件。启动服务后浏览器统一调用 `/api/insights`。

实时响应必须有分析编号、请求编号、实际模型名和生成时间，insights须为 `origin:live_ai, kind:interpretation, status:valid`；unknown/cross-analysis引用或占位符不一致均拒绝。事实区仅展示computed fact。恢复的live_ai记录标记历史，只有本页面实际收到并验证的响应显示本次实时调用。

finding和cites由 `buildInsightGraph` 统一重建；建议直接使用其输出构造返回graph，避免相同ID不同label产生冲突。`GraphFragment.owner`不能把data/analysis都改成insight。

## 4. 项目与运行约定

`exportProject(project):Promise<string>`、`importProject(json):Promise<ProjectSnapshot>`、`validateProject(value):Promise<ProjectSnapshot>`。UI在恢复全部校验成功后才替换状态；失败保留原项目。

导出使用紧凑JSON，包含源字节和历史结果；只允许约定属性，原字节hash、重解析缓存、引用和当前选择都核验。完整FY2025展示夹具约34.6MB，包含逐格来源映射；这是可携带原始来源的成本。没有数字签名，完整性校验不能认证项目作者或所有统计值的正确性。

已完成分析的筛选随AnalysisResult恢复。v1 selection未约定未计算的筛选草稿，当前只恢复已选指标，不承诺保存未提交筛选。API失败、取消和超时均保留统计与回源；不自动重试。

Node >=22.12，测试主机22.23.2。`npm ci`、`npm run dev`、`npm run build`、`npm test`、`npm run format:check`。前端5173，生产预览4173，模型服务8787；均限制本机地址，端口占用明确失败。

## 5. 需要总控及上游对齐的接口事项

1. 默认分析范围的数据传递位置在原公共文档中尚未定形。本实现提供可选 `getDefaultRequest(bundle)` 钩子作为可运行接线点；缺钩子时不猜年份或月份，用户显式选择，对未筛选的多值维度在计算前确认。此钩子尚非总控批准的公共契约变更。
2. 模型请求最小facts投影在原文没有resultId到fieldId映射。当前实现遵循原投影，尚未擅增字段；人员2接入时应由总控明确补充fieldIds或等价映射，避免不透明resultId下模型误认指标。真实模型验收尚未进行。
3. 通用CSV的字段角色/单位确认、D1/D2/D3适配默认值依赖人员1，统计和真实DeepSeek证据依赖人员2。当前只具备接入壳和显式缺模块状态，不宣称三域全流程已完成。

## 6. 下一角色接手

- 人员1：依据当前类型和样例实现/对齐importFiles与默认范围，交模块commit及58文件实际导入证据。
- 人员2：对齐analyze/buildFacts及服务启动入口，提供三域真实API证据并解决结果到指标映射。
- 总控：确认第5节接口事项，确定模块commit与集成顺序；本轮没有合并main。
- 人员4：以本分支提交运行人员3自测和复现步骤，再在真正集成后的新commit独立验收。自测记录不替代审计报告。
