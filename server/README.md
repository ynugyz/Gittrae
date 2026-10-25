# 人员2 本机模型代理

真实 DeepSeek 官方 API 代理，只绑定 `127.0.0.1`。密钥仅从环境变量读取，不写入仓库、日志或响应。需要 Node 18+（本机内置 Node 24 可直接运行）。

## 启动

人员3 的 `npm run dev` 会检测 `server/index.ts` 并自动拉起本服务；也可单独启动：

```powershell
$env:DEEPSEEK_API_KEY = "<本机密钥>"
node server/index.mjs    # 或 node server/index.ts（Node 22.18+）
```

可选环境变量：`DEEPSEEK_BASE_URL`（默认 `https://api.deepseek.com`）、`DEEPSEEK_MODEL`（默认 `deepseek-flash`）、`DEEPSEEK_TIMEOUT_MS`（默认 60000）、`DEEPSEEK_MAX_TOKENS`（默认 4096；思考模型推理 token 与正文共用，过小会截断 JSON）、`PORT`（默认 8787）。参考 `server/env.example`，不要把真实密钥提交。

## 接口

- `GET /api/health` → `{ ok, model, baseUrlHost, keyConfigured, timeoutMs }`，不返回密钥。
- `POST /api/insights`，请求 `{ analysisId, facts, context }`，`facts` 为 `MetricResult` 最小投影（`resultId、metric、value、unit、method、sampleSize`；兼容旧字段 `validCount`）。
- 成功 `{ analysisId, requestId, insights, graph, model, generatedAt }`，与人员3 的 `InsightResponse` 一致。
- 失败 `{ analysisId, error: { code, message, retryable } }`，HTTP 状态对应 400/502/503/504。
- 返回的 `graph` 为 `owner: "insight"` 的 finding/cites 分片：节点 `ref` 为字符串（`insightId`），`fact` 节点名 `数据事实`、`live_ai` 节点名 `AI 解读`，与人员3 的 `buildInsightGraph` 可直接合并。

失败码：`missing_api_key`、`timeout`、`network_error`、`upstream_http_<status>`、`truncated_output`、`empty_content`、`empty_insights`、`invalid_json`、`invalid_payload`。官方 JSON Output 说明提示可能返回空 content，这里会自动重试一次，仍为空则报错，不伪造成成功；模型偶尔包裹 Markdown 代码围栏时会先剥离再解析。`deepseek-flash` 为思考模型，`finish_reason=length` 视为明确的截断失败而非成功。

## 调用约定

- 界面只接受当前 `analysisId` 的返回；旧响应由人员3按分析编号丢弃或存为历史，不得覆盖当前分析。分析编号绑定 `methodVersion`，方法口径变化会生成新编号。
- 超时 60 秒，不自动无限重试；用户可手动重试。请求取消由界面中止 fetch，代理不保存“取消”状态。
- 每条 Insight 的 `resultRefs` 必须属于当前 `facts`；不存在的引用标记为 `status: "invalid"`，不得展示为有效结论。
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
