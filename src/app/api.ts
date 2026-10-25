import type {
  AnalysisRequest,
  AnalyzeRequest,
  AnalyzeResponse,
  AnalysisResult,
  DatasetBundle,
  InsightRequest,
  InsightResponse,
} from "../contracts";
import { buildInsightGraph, validateInsight } from "../graph";

export async function requestAnalysis(
  bundle: DatasetBundle,
  request: AnalysisRequest,
  signal: AbortSignal,
): Promise<AnalyzeResponse> {
  const payload: AnalyzeRequest = {
    bundle: {
      schemaVersion: bundle.schemaVersion,
      datasetId: bundle.datasetId,
      datasetVersion: bundle.datasetVersion,
      domain: bundle.domain,
      fields: bundle.fields,
      records: bundle.records.map(({ recordId, values }) => ({
        recordId,
        values,
      })),
      graph: bundle.graph,
    },
    request,
  };
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("统计服务没有返回有效 JSON，请检查本机服务是否已启动。");
  }
  if (!body || typeof body !== "object")
    throw new Error("统计服务返回空响应。");
  if ("error" in body) {
    const error = body.error as { message?: string };
    throw new Error(
      typeof error?.message === "string" ? error.message : "统计请求失败。",
    );
  }
  if (!response.ok)
    throw new Error(`统计服务请求失败（HTTP ${response.status}）。`);
  const result = body as AnalyzeResponse;
  if (!result.analysis || !Array.isArray(result.facts?.insights))
    throw new Error("统计服务返回结构不完整。");
  for (const insight of result.facts.insights) {
    if (
      insight.origin !== "computed" ||
      insight.kind !== "fact" ||
      insight.status !== "valid"
    )
      throw new Error("确定性事实的来源或状态无效。");
    validateInsight(insight, result.analysis);
  }
  result.facts.graph = buildInsightGraph(result.facts.insights, [
    result.analysis,
  ]);
  return result;
}

export async function requestInsights(
  bundle: DatasetBundle,
  analysis: AnalysisResult,
  signal: AbortSignal,
): Promise<InsightResponse> {
  const request: InsightRequest = {
    analysisId: analysis.analysisId,
    facts: analysis.results.map((r) => ({
      resultId: r.resultId,
      fieldIds: r.fieldIds,
      metric: r.metric,
      value: r.value,
      unit: r.unit,
      method: r.method,
      sampleSize: r.validRecordIds.length,
    })),
    context: {
      fields: bundle.fields.map(({ fieldId, label, meaning, unit }) => ({
        fieldId,
        label,
        meaning,
        unit,
      })),
      scope: { ...analysis.scope, recordIds: [] },
      limitations: [
        ...analysis.scope.limitations,
        ...bundle.issues.map((i) => i.message),
      ],
    },
  };
  const response = await fetch("/api/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("模型服务没有返回有效 JSON，请检查本机服务是否已启动。");
  }
  if (!body || typeof body !== "object")
    throw new Error("模型服务返回空响应。");
  if ("error" in body) {
    const error = body.error as { message?: string };
    throw new Error(
      typeof error?.message === "string"
        ? error.message
        : "模型请求失败，请稍后重试。",
    );
  }
  if (!response.ok)
    throw new Error(`模型服务请求失败（HTTP ${response.status}）。`);
  const result = body as InsightResponse;
  if (result.analysisId !== analysis.analysisId)
    throw new Error("模型响应分析编号与当前请求不一致。");
  if (!Array.isArray(result.insights)) throw new Error("模型解释列表无效。");
  for (const insight of result.insights) validateInsight(insight, analysis);
  result.graph = buildInsightGraph(result.insights, [analysis]);
  return result;
}
