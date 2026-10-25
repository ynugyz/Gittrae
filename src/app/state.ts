import type {
  AnalysisRequest,
  AnalysisResult,
  DatasetBundle,
  InsightResponse,
  Insight,
  ProjectSnapshot,
} from "../contracts";
import {
  rebuildGraph,
  validateInsight,
  mergeGraph,
  buildInsightGraph,
} from "../graph";

export function emptyProject(): ProjectSnapshot {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    projectId: crypto.randomUUID(),
    createdAt: now,
    savedAt: now,
    datasets: [],
    analyses: [],
    insights: [],
    selection: {
      datasetId: null,
      analysisId: null,
      measureFieldIds: [],
      nodeId: null,
    },
  };
}
export function blankRequest(bundle: DatasetBundle): AnalysisRequest {
  return {
    datasetId: bundle.datasetId,
    datasetVersion: bundle.datasetVersion,
    measureFieldIds: [],
    correlationPair: null,
    filters: [],
  };
}
export function sameRequest(a: AnalysisRequest, b: AnalysisRequest) {
  return sameContent(a, b);
}
function sameContent(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a))
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => sameContent(v, b[i]))
    );
  if (
    !a ||
    !b ||
    typeof a !== "object" ||
    typeof b !== "object" ||
    Array.isArray(b)
  )
    return false;
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every(
      (k) => Object.hasOwn(right, k) && sameContent(left[k], right[k]),
    )
  );
}
function appendInsights(existing: Insight[], incoming: Insight[]) {
  const all = new Map(existing.map((i) => [i.insightId, i]));
  for (const insight of incoming) {
    const previous = all.get(insight.insightId);
    if (previous && !sameContent(previous, insight))
      throw new Error("解释编号冲突：历史解释不能被同编号的新内容覆盖。");
    all.set(insight.insightId, insight);
  }
  return [...all.values()];
}
export function addDatasets(
  project: ProjectSnapshot,
  bundles: DatasetBundle[],
): ProjectSnapshot {
  const datasets = [...project.datasets];
  for (const b of bundles) {
    const existing = datasets.find((d) => d.datasetId === b.datasetId);
    if (existing && !sameContent(existing, b))
      throw new Error(
        "数据身份冲突：相同 datasetId 指向不同内容，请由数据模块确认版本编号。",
      );
    if (!existing) datasets.push(b);
  }
  const result = { ...project, datasets };
  rebuildGraph(result);
  return result;
}
export function addAnalysis(
  project: ProjectSnapshot,
  analysis: AnalysisResult,
  request: AnalysisRequest,
  insights: ProjectSnapshot["insights"],
): ProjectSnapshot {
  if (
    !sameRequest(analysis.request, request) ||
    analysis.datasetId !== request.datasetId ||
    analysis.datasetVersion !== request.datasetVersion
  )
    throw new Error("统计模块返回的分析范围或版本与请求不一致。");
  const existing = project.analyses.find(
    (a) => a.analysisId === analysis.analysisId,
  );
  if (existing && !sameContent(existing, analysis))
    throw new Error("分析编号冲突：同一编号返回不同计算结果。");
  for (const insight of insights) validateInsight(insight, analysis);
  const result: ProjectSnapshot = {
    ...project,
    analyses: existing ? project.analyses : [...project.analyses, analysis],
    insights: appendInsights(project.insights, insights),
    selection: {
      datasetId: analysis.datasetId,
      analysisId: analysis.analysisId,
      measureFieldIds: request.measureFieldIds,
      nodeId: null,
    },
  };
  rebuildGraph(result);
  return result;
}
/** 旧响应直接丢弃。调用者还以请求序号拦截重复分析的并发请求。 */
export function applyInsightResponse(
  project: ProjectSnapshot,
  response: InsightResponse,
): ProjectSnapshot {
  if (project.selection.analysisId !== response.analysisId) return project;
  const analysis = project.analyses.find(
    (a) => a.analysisId === response.analysisId,
  );
  if (!analysis) throw new Error("找不到解释对应的分析。");
  if (
    !response.requestId ||
    !response.model ||
    !Number.isFinite(Date.parse(response.generatedAt)) ||
    !Array.isArray(response.insights) ||
    !response.insights.length
  )
    throw new Error("模型返回格式不完整。");
  for (const insight of response.insights) {
    if (
      insight.origin !== "live_ai" ||
      insight.kind !== "interpretation" ||
      insight.model !== response.model ||
      insight.status !== "valid"
    )
      throw new Error("模型响应的来源、状态或模型标识无效。");
    validateInsight(insight, analysis);
  }
  const expected = buildInsightGraph(response.insights, [analysis]);
  if (
    !response.graph ||
    response.graph.owner !== "insight" ||
    response.graph.nodes.length !== expected.nodes.length ||
    response.graph.edges.length !== expected.edges.length
  )
    throw new Error("模型发现图与解释引用不一致。");
  for (const node of expected.nodes) {
    const actual = response.graph.nodes.find((n) => n.id === node.id);
    if (!actual || actual.type !== node.type || actual.ref !== node.ref)
      throw new Error("模型发现节点引用错误。");
  }
  for (const edge of expected.edges)
    if (
      !response.graph.edges.some(
        (e) =>
          e.id === edge.id &&
          e.from === edge.from &&
          e.to === edge.to &&
          e.type === edge.type,
      )
    )
      throw new Error("模型引用边错误。");
  mergeGraph([
    ...project.datasets.map((d) => d.graph),
    ...project.analyses.map((a) => a.graph),
    response.graph,
  ]);
  const result = {
    ...project,
    insights: appendInsights(project.insights, response.insights),
  };
  rebuildGraph(result);
  return result;
}
