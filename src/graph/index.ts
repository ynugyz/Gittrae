import type {
  AnalysisResult,
  DatasetBundle,
  EdgeType,
  Field,
  GraphEdge,
  GraphFragment,
  GraphNode,
  GraphSnapshot,
  Insight,
  MetricResult,
  NodeType,
  ProjectSnapshot,
  Scalar,
  Scope,
  SourceRef,
  Transformation,
} from "../contracts";

const directions: Record<EdgeType, readonly [NodeType, NodeType]> = {
  derived_from: ["dataset", "source"],
  contains: ["dataset", "indicator"],
  selects: ["scope", "dataset"],
  uses_scope: ["calculation", "scope"],
  uses_indicator: ["calculation", "indicator"],
  cites: ["finding", "calculation"],
};
const nodeTypes = new Set<NodeType>([
  "source",
  "dataset",
  "indicator",
  "scope",
  "calculation",
  "finding",
]);

function fail(message: string): never {
  throw new Error(message);
}
function requireText(value: unknown, context: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) fail(`${context}不能为空。`);
}
function sameNode(a: GraphNode, b: GraphNode) {
  return a.type === b.type && a.label === b.label && a.ref === b.ref;
}
function sameEdge(a: GraphEdge, b: GraphEdge) {
  return a.from === b.from && a.to === b.to && a.type === b.type;
}

/** 合并先完整收集节点，再检查跨分片边，分片输入顺序不影响结果。 */
export function mergeGraph(fragments: readonly GraphFragment[]): GraphSnapshot {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  for (const fragment of fragments) {
    if (
      fragment.schemaVersion !== 1 ||
      !["data", "analysis", "insight"].includes(fragment.owner)
    )
      fail("图谱分片版本或归属不受支持。");
    for (const node of fragment.nodes) {
      requireText(node.id, "节点编号");
      requireText(node.ref, "节点引用");
      requireText(node.label, "节点名称");
      if (!nodeTypes.has(node.type)) fail(`不支持的节点类型：${node.type}`);
      if (node.type === "calculation" && node.id !== `calculation:${node.ref}`)
        fail(`计算节点编号不符合结果引用：${node.id}`);
      if (node.type === "finding" && node.id !== `finding:${node.ref}`)
        fail(`发现节点编号不符合解释引用：${node.id}`);
      const existing = nodes.get(node.id);
      if (existing && !sameNode(existing, node))
        fail(`节点编号冲突：${node.id}`);
      nodes.set(node.id, {
        id: node.id,
        type: node.type,
        label: node.label,
        ref: node.ref,
      });
    }
    for (const edge of fragment.edges) {
      requireText(edge.id, "关系编号");
      requireText(edge.from, "关系起点");
      requireText(edge.to, "关系终点");
      if (!Object.hasOwn(directions, edge.type))
        fail(`不允许的关系类型：${edge.type}`);
      const expectedOwner =
        edge.type === "derived_from" || edge.type === "contains"
          ? "data"
          : edge.type === "cites"
            ? "insight"
            : "analysis";
      // 人员2可在分析分片中提供事实引用边；其余归属必须遵循契约。
      if (
        fragment.owner !== expectedOwner &&
        !(edge.type === "cites" && fragment.owner === "analysis")
      )
        fail(`关系归属错误：${edge.id}`);
      const existing = edges.get(edge.id);
      if (existing && !sameEdge(existing, edge))
        fail(`关系编号冲突：${edge.id}`);
      edges.set(edge.id, {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        type: edge.type,
      });
    }
  }
  for (const edge of edges.values()) {
    const from = nodes.get(edge.from),
      to = nodes.get(edge.to);
    if (!from || !to) fail(`关系引用了不存在的节点：${edge.id}`);
    const [fromType, toType] = directions[edge.type];
    if (from.type !== fromType || to.type !== toType)
      fail(`关系方向或节点类型错误：${edge.id}`);
    if (edge.type === "cites" && edge.id !== `cites:${from.ref}:${to.ref}`)
      fail(`引用边编号不符合契约：${edge.id}`);
  }
  return {
    schemaVersion: 1,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  };
}

export function validateInsight(
  insight: Insight,
  analysis: AnalysisResult,
): void {
  requireText(insight.insightId, "解释编号");
  if (insight.analysisId !== analysis.analysisId) fail("解释引用了其他分析。");
  if (insight.status !== "valid") fail("该解释未通过有效性校验。");
  if (
    !["fact", "interpretation"].includes(insight.kind) ||
    !["computed", "live_ai"].includes(insight.origin)
  )
    fail("解释类型或来源不受支持。");
  requireText(insight.textTemplate, "解释文本");
  if (insight.origin === "live_ai")
    requireText(insight.model, "实时 AI 模型名称");
  else if (insight.model !== null) fail("确定性事实的模型名称必须为空。");
  if (
    typeof insight.generatedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      insight.generatedAt,
    ) ||
    !Number.isFinite(Date.parse(insight.generatedAt))
  )
    fail("解释生成时间无效。");
  if (!Array.isArray(insight.resultRefs) || insight.resultRefs.length === 0)
    fail("解释没有结果引用。");
  const refs = new Set(insight.resultRefs);
  if (refs.size !== insight.resultRefs.length) fail("解释包含重复结果引用。");
  const results = new Set(analysis.results.map((result) => result.resultId));
  for (const ref of refs)
    if (!results.has(ref))
      fail(`解释引用了不存在或不属于当前分析的结果：${ref}`);
  const placeholders = [
    ...insight.textTemplate.matchAll(/\{\{result:([^{}]+)\}\}/g),
  ].map((match) => match[1]);
  const used = new Set(placeholders);
  if (used.size !== refs.size || [...used].some((ref) => !refs.has(ref)))
    fail("解释数字占位符与结果引用不一致。");
  if (
    /\{\{|\}\}/.test(
      insight.textTemplate.replace(/\{\{result:([^{}]+)\}\}/g, ""),
    )
  )
    fail("解释包含无法识别的数字占位符。");
}

export function buildInsightGraph(
  insights: readonly Insight[],
  analyses: readonly AnalysisResult[],
): GraphFragment {
  const byId = new Map(
    analyses.map((analysis) => [analysis.analysisId, analysis]),
  );
  const nodes: GraphNode[] = [],
    edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const insight of insights) {
    if (seen.has(insight.insightId)) fail(`解释编号重复：${insight.insightId}`);
    seen.add(insight.insightId);
    if (insight.status === "invalid") continue;
    const analysis = byId.get(insight.analysisId);
    if (!analysis) fail(`解释对应的分析不存在：${insight.analysisId}`);
    validateInsight(insight, analysis);
    nodes.push({
      id: `finding:${insight.insightId}`,
      type: "finding",
      label: insight.kind === "fact" ? "数据事实" : "AI 解读",
      ref: insight.insightId,
    });
    for (const resultId of insight.resultRefs)
      edges.push({
        id: `cites:${insight.insightId}:${resultId}`,
        from: `finding:${insight.insightId}`,
        to: `calculation:${resultId}`,
        type: "cites",
      });
  }
  return { schemaVersion: 1, owner: "insight", nodes, edges };
}

function datasetFor(
  project: ProjectSnapshot,
  datasetId: string,
  version?: string,
): DatasetBundle {
  const candidates = project.datasets.filter(
    (dataset) =>
      dataset.datasetId === datasetId &&
      (version === undefined || dataset.datasetVersion === version),
  );
  if (candidates.length !== 1)
    fail(
      candidates.length
        ? "数据集存在多个版本，请指定分析的数据版本。"
        : `数据集或版本不存在：${datasetId}`,
    );
  return candidates[0];
}

/** 重建前验证节点确实引用了所属材料，图结构本身不是事实真值。 */
export function rebuildGraph(project: ProjectSnapshot): GraphSnapshot {
  const analysisIds = new Set<string>();
  const resultIds = new Set<string>();
  for (const dataset of project.datasets) {
    const sources = new Set(dataset.sources.map((source) => source.sourceId));
    const fields = new Set(dataset.fields.map((field) => field.fieldId));
    if (dataset.graph.owner !== "data") fail("数据集基础图归属必须为 data。");
    for (const node of dataset.graph.nodes) {
      const exists =
        node.type === "source"
          ? sources.has(node.ref)
          : node.type === "dataset"
            ? node.ref === dataset.datasetId
            : node.type === "indicator" && fields.has(node.ref);
      if (!exists) fail(`基础图节点引用不存在或类型错误：${node.id}`);
    }
  }
  for (const analysis of project.analyses) {
    if (analysisIds.has(analysis.analysisId))
      fail(`分析编号重复：${analysis.analysisId}`);
    analysisIds.add(analysis.analysisId);
    const dataset = datasetFor(
      project,
      analysis.datasetId,
      analysis.datasetVersion,
    );
    if (analysis.graph.owner !== "analysis")
      fail("分析图归属必须为 analysis。");
    const results = new Set(analysis.results.map((result) => result.resultId));
    const fields = new Set(dataset.fields.map((field) => field.fieldId));
    for (const result of analysis.results) {
      if (resultIds.has(result.resultId))
        fail(`结果编号重复：${result.resultId}`);
      resultIds.add(result.resultId);
    }
    for (const node of analysis.graph.nodes) {
      const exists =
        node.type === "scope"
          ? node.ref === analysis.scope.scopeId
          : node.type === "calculation"
            ? results.has(node.ref)
            : node.type === "dataset"
              ? node.ref === dataset.datasetId
              : node.type === "indicator"
                ? fields.has(node.ref)
                : node.type === "finding" &&
                  project.insights.some(
                    (insight) =>
                      insight.insightId === node.ref &&
                      insight.analysisId === analysis.analysisId &&
                      insight.status === "valid",
                  );
      if (!exists) fail(`分析图节点引用不存在或不属于本次分析：${node.id}`);
    }
    const calculations = new Set(
      analysis.graph.nodes
        .filter((node) => node.type === "calculation")
        .map((node) => node.ref),
    );
    for (const resultId of results)
      if (!calculations.has(resultId))
        fail(`统计结果缺少计算节点：${resultId}`);
  }
  const graph = mergeGraph([
    ...project.datasets.map((dataset) => dataset.graph),
    ...project.analyses.map((analysis) => analysis.graph),
    buildInsightGraph(project.insights, project.analyses),
  ]);
  const resultMap = new Map(
    project.analyses.flatMap((analysis) =>
      analysis.results.map(
        (result) => [result.resultId, { analysis, result }] as const,
      ),
    ),
  );
  const insightMap = new Map(
    project.insights.map((insight) => [insight.insightId, insight]),
  );
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const edge of graph.edges) {
    const from = nodeMap.get(edge.from)!,
      to = nodeMap.get(edge.to)!;
    if (edge.type === "cites") {
      const insight = insightMap.get(from.ref)!;
      if (
        insight.analysisId !== resultMap.get(to.ref)?.analysis.analysisId ||
        !insight.resultRefs.includes(to.ref)
      )
        fail(`发现引用边超出解释的有效引用：${edge.id}`);
    } else if (edge.type === "uses_scope") {
      if (resultMap.get(from.ref)?.analysis.scope.scopeId !== to.ref)
        fail(`计算连接了其他分析范围：${edge.id}`);
    } else if (edge.type === "uses_indicator") {
      if (!resultMap.get(from.ref)?.result.fieldIds.includes(to.ref))
        fail(`计算连接了未参与计算的指标：${edge.id}`);
    } else if (edge.type === "selects") {
      if (
        !project.analyses.some(
          (analysis) =>
            analysis.scope.scopeId === from.ref &&
            analysis.datasetId === to.ref,
        )
      )
        fail(`范围连接了错误的数据集：${edge.id}`);
    } else if (edge.type === "derived_from") {
      if (
        !project.datasets.some(
          (dataset) =>
            dataset.datasetId === from.ref &&
            dataset.sources.some((source) => source.sourceId === to.ref),
        )
      )
        fail(`数据集连接了未登记的来源：${edge.id}`);
    } else if (edge.type === "contains") {
      if (
        !project.datasets.some(
          (dataset) =>
            dataset.datasetId === from.ref &&
            dataset.fields.some((field) => field.fieldId === to.ref),
        )
      )
        fail(`数据集连接了不存在的指标：${edge.id}`);
    }
  }
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from)!.push(edge);
  }
  for (const [resultId, { analysis, result }] of resultMap) {
    const edges = outgoing.get(`calculation:${resultId}`) ?? [];
    const scopeLink = edges.find(
      (edge) =>
        edge.type === "uses_scope" &&
        nodeMap.get(edge.to)?.ref === analysis.scope.scopeId,
    );
    if (!scopeLink) fail(`统计结果缺少分析范围关系：${resultId}`);
    const scopeEdges = outgoing.get(scopeLink.to) ?? [];
    if (
      !scopeEdges.some(
        (edge) =>
          edge.type === "selects" &&
          nodeMap.get(edge.to)?.ref === analysis.datasetId,
      )
    )
      fail(`分析范围缺少数据集关系：${analysis.scope.scopeId}`);
    for (const fieldId of result.fieldIds) {
      if (
        !edges.some(
          (edge) =>
            edge.type === "uses_indicator" &&
            nodeMap.get(edge.to)?.ref === fieldId,
        )
      )
        fail(`统计结果缺少指标关系：${resultId} / ${fieldId}`);
    }
  }
  for (const dataset of project.datasets) {
    const datasetNodes = dataset.graph.nodes.filter(
      (node) => node.type === "dataset" && node.ref === dataset.datasetId,
    );
    if (datasetNodes.length !== 1)
      fail(`数据集必须有唯一图节点：${dataset.datasetId}`);
    const edges = outgoing.get(datasetNodes[0].id) ?? [];
    for (const source of dataset.sources) {
      if (
        !edges.some(
          (edge) =>
            edge.type === "derived_from" &&
            nodeMap.get(edge.to)?.ref === source.sourceId,
        )
      )
        fail(`数据集缺少来源关系：${dataset.datasetId} / ${source.sourceId}`);
    }
  }
  return graph;
}

/** 当前视图只合并本次分析、其数据来源及其解释，不带入历史分析。 */
export function currentGraph(
  project: ProjectSnapshot,
  analysisId: string,
): GraphSnapshot {
  const analysis = project.analyses.find(
    (item) => item.analysisId === analysisId,
  );
  if (!analysis) fail(`分析不存在：${analysisId}`);
  const dataset = datasetFor(
    project,
    analysis.datasetId,
    analysis.datasetVersion,
  );
  const selected = {
    ...project,
    datasets: [dataset],
    analyses: [analysis],
    insights: project.insights.filter(
      (insight) => insight.analysisId === analysisId,
    ),
  };
  const graph = rebuildGraph(selected);
  const usedFields = new Set([
    ...analysis.request.measureFieldIds,
    ...(analysis.request.correlationPair ?? []),
    ...analysis.request.filters.map((filter) => filter.fieldId),
  ]);
  const nodes = graph.nodes.filter(
    (node) => node.type !== "indicator" || usedFields.has(node.ref),
  );
  const ids = new Set(nodes.map((node) => node.id));
  return {
    schemaVersion: 1,
    nodes,
    edges: graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
  };
}

export function getNeighborhood(
  graph: GraphSnapshot,
  nodeId: string,
  depth = 1,
): GraphSnapshot {
  if (!Number.isInteger(depth) || depth < 0) fail("展开层数必须为非负整数。");
  if (!graph.nodes.some((node) => node.id === nodeId))
    fail(`节点不存在：${nodeId}`);
  const neighbors = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (!neighbors.has(edge.from)) neighbors.set(edge.from, new Set());
    if (!neighbors.has(edge.to)) neighbors.set(edge.to, new Set());
    neighbors.get(edge.from)!.add(edge.to);
    neighbors.get(edge.to)!.add(edge.from);
  }
  const selected = new Set([nodeId]);
  let frontier = [nodeId];
  for (let i = 0; i < depth && frontier.length; i++) {
    const next: string[] = [];
    for (const id of frontier)
      for (const neighbor of neighbors.get(id) ?? [])
        if (!selected.has(neighbor)) {
          selected.add(neighbor);
          next.push(neighbor);
        }
    frontier = next;
  }
  return {
    schemaVersion: 1,
    nodes: graph.nodes.filter((node) => selected.has(node.id)),
    edges: graph.edges.filter(
      (edge) => selected.has(edge.from) && selected.has(edge.to),
    ),
  };
}

export interface SourceEvidence extends SourceRef {
  fileName: string;
  sha256: string;
  columnName: string;
  rawValue: string;
  rawRecord: string[];
}
export interface EvidenceCell {
  fieldId: string;
  label: string;
  unit: string;
  value: Scalar;
  sources: SourceEvidence[];
}
export interface EvidenceRecord {
  recordId: string;
  cells: EvidenceCell[];
  exclusionReason?: string;
}
export interface RecordEvidenceGroup {
  datasetId: string;
  datasetVersion: string;
  fields: Field[];
  records: EvidenceRecord[];
  transformations: Transformation[];
}
export interface MetricEvidence {
  datasetId: string;
  datasetVersion: string;
  analysisId: string;
  result: MetricResult;
  scope: Scope;
  validCount: number;
  excludedCount: number;
  validRecords: EvidenceRecord[];
  excludedRecords: EvidenceRecord[];
  fields: Field[];
  transformations: Transformation[];
}

export function getRecordEvidence(
  project: ProjectSnapshot,
  datasetId: string,
  recordIds: readonly string[],
  fieldIds: readonly string[],
  datasetVersion?: string,
): RecordEvidenceGroup {
  const dataset = datasetFor(project, datasetId, datasetVersion);
  const fieldMap = new Map(
    dataset.fields.map((field) => [field.fieldId, field]),
  );
  const fields = fieldIds.map(
    (fieldId) => fieldMap.get(fieldId) ?? fail(`指标不存在：${fieldId}`),
  );
  const recordMap = new Map(
    dataset.records.map((record) => [record.recordId, record]),
  );
  const sourceMap = new Map(
    dataset.sources.map((source) => [source.sourceId, source]),
  );
  const records = recordIds.map((recordId) => {
    const record =
      recordMap.get(recordId) ?? fail(`规范记录不存在：${recordId}`);
    const cells = fields.map((field) => ({
      fieldId: field.fieldId,
      label: field.label,
      unit: field.unit,
      value: record.values[field.fieldId] ?? null,
      sources: (record.provenance[field.fieldId] ?? []).map((ref) => {
        const source =
          sourceMap.get(ref.sourceId) ??
          fail(`原始来源不存在：${ref.sourceId}`);
        const rawRecord = source.rawRecords[ref.recordIndex - 1];
        if (
          !Number.isInteger(ref.recordIndex) ||
          ref.recordIndex < 1 ||
          !Number.isInteger(ref.columnIndex) ||
          ref.columnIndex < 0 ||
          !rawRecord ||
          ref.columnIndex >= source.headers.length ||
          ref.columnIndex >= rawRecord.length
        )
          fail(
            `原始位置无效：${ref.sourceId}，记录${ref.recordIndex}，列${ref.columnIndex}`,
          );
        return {
          ...ref,
          fileName: source.originalFileName,
          sha256: source.sha256,
          columnName: source.headers[ref.columnIndex],
          rawValue: rawRecord[ref.columnIndex],
          rawRecord,
        };
      }),
    }));
    return { recordId, cells };
  });
  return {
    datasetId,
    datasetVersion: dataset.datasetVersion,
    fields,
    records,
    transformations: dataset.transformations.filter((transform) =>
      transform.fieldIds.some((fieldId) => fieldIds.includes(fieldId)),
    ),
  };
}

export function getEvidence(
  project: ProjectSnapshot,
  resultId: string,
): MetricEvidence {
  const matches = project.analyses.flatMap((analysis) =>
    analysis.results
      .filter((result) => result.resultId === resultId)
      .map((result) => ({ analysis, result })),
  );
  if (matches.length !== 1)
    fail(
      matches.length ? `结果编号冲突：${resultId}` : `结果不存在：${resultId}`,
    );
  const { analysis, result } = matches[0];
  const valid = getRecordEvidence(
    project,
    analysis.datasetId,
    result.validRecordIds,
    result.fieldIds,
    analysis.datasetVersion,
  );
  const excluded = getRecordEvidence(
    project,
    analysis.datasetId,
    result.excludedRecordIds,
    result.fieldIds,
    analysis.datasetVersion,
  );
  return {
    datasetId: analysis.datasetId,
    datasetVersion: analysis.datasetVersion,
    analysisId: analysis.analysisId,
    result,
    scope: analysis.scope,
    validCount: result.validRecordIds.length,
    excludedCount: result.excludedRecordIds.length,
    validRecords: valid.records,
    excludedRecords: excluded.records.map((record) => ({
      ...record,
      exclusionReason:
        result.exclusionReasons[record.recordId] ?? "未提供排除说明",
    })),
    fields: valid.fields,
    transformations: valid.transformations,
  };
}
