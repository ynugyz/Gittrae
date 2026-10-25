# 人员2 本机模型代理

本机确定性分析与真实 DeepSeek 官方 API 代理，共用一个服务，只绑定 `127.0.0.1:8787`。密钥仅从环境变量读取，不写入仓库、日志或响应。需要 Node 18+，本轮在 Node 22 验证。

## 启动

人员3 的 `npm run dev` 会检测 `server/index.ts` 并自动拉起本服务；也可单独启动：

```powershell
$env:DEEPSEEK_API_KEY = "<本机密钥>"
node server/index.mjs    # 或 node server/index.ts（Node 22.18+）
```

可选环境变量：`DEEPSEEK_BASE_URL`（默认 `https://api.deepseek.com`）、`DEEPSEEK_MODEL`（默认 `deepseek-flash`）、`DEEPSEEK_TIMEOUT_MS`（默认 60000）、`DEEPSEEK_MAX_TOKENS`（默认 4096；思考模型推理 token 与正文共用，过小会截断 JSON）、`PORT`（默认 8787）。参考 `server/env.example`，不要把真实密钥提交。

## 接口

- `GET /api/health` → `{ ok, model, baseUrlHost, keyConfigured, timeoutMs }`，不返回密钥。
- `POST /api/analyze`，请求 `{ bundle, request }`，成功 `{ analysis, facts }`，其中 `facts={insights,graph}`。bundle仅含 `schemaVersion:1、datasetId、datasetVersion、domain、fields、records:{recordId,values}[]、issues、graph`，不发送原字节、原始记录缓存或逐格来源。此路由上限16MB，不需要模型密钥。
- `POST /api/insights`，请求 `{ analysisId, facts, context }`，`facts` 为 `MetricResult` 最小投影（`resultId、metric、fieldIds、value、unit、method、sampleSize`）；sampleSize取有效记录数量，兼容旧名validCount。context.fields提供指标意义。此路由上限仍为1MB。
- 成功 `{ analysisId, requestId, insights, graph, model, generatedAt }`。
- 失败 `{ analysisId, error: { code, message, retryable } }`，HTTP 状态对应 400/413/502/503/504。
- 返回的 `graph` 为 `owner: "insight"` 的 finding/cites 分片，ref为insightId字符串，标签与人员3重建结果一致。

失败码：`missing_api_key`、`timeout`、`network_error`、`upstream_http_<status>`、`truncated_output`、`empty_content`、`empty_insights`、`invalid_json`、`invalid_payload`、`invalid_insight_reference`、`unbound_numeric_value`。官方 JSON Output 说明提示可能返回空 content，这里会自动重试一次，仍为空则报错，不伪造成成功；模型偶尔包裹 Markdown 代码围栏时会先剥离再解析。`finish_reason=length` 视为明确的截断失败而非成功。

## 调用约定

- 界面只接受当前 `analysisId` 的返回；旧响应由人员3按分析编号丢弃或存为历史，不得覆盖当前分析。分析编号绑定 `methodVersion`，方法口径变化会生成新编号。
- 超时 60 秒，不自动无限重试；用户可手动重试。请求取消由界面中止 fetch，代理不保存“取消”状态。
- 每条 Insight 的 `resultRefs` 必须属于当前 `facts`并与文本占位符一致；不存在或跨分析的引用返回HTTP 502、`invalid_insight_reference`，不产生成功发现图。
- 输出使用人员3唯一契约：scope.recordIds/label、字符串GraphNode.ref；methodVersion和不可计算原因放在MetricResult.parameters，有效样本量由validRecordIds.length得到。箱线须线判定的有效记录包括全部有效输入，须端值仍是实际观测值。
- `generatedAt` 为实际生成时间；历史恢复不自动重发请求。

## 自测

```powershell
node --test src/analysis/analysis.test.ts
# 并入人员3 的工程后也可用：npx tsx --test src/analysis/analysis.test.ts
```

真实调用探通（需先配置密钥）：

```powershell
node server/probe.mjs
```

证据只记录时间、requestId、模型、状态、analysisId 与脱敏错误，不含密钥。
