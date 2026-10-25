import type {
  AnalysisResult,
  DatasetBundle,
  GraphEdge,
  Insight,
  MetricResult,
  ProjectSnapshot,
} from "./index";

/** 固定手算联调样例。没有数据适配或统计算法，也不代表真实数据/API验收。 */
export async function createExampleProject(): Promise<ProjectSnapshot> {
  const bytes = new TextEncoder().encode("\uFEFFid,x,y\na,1,2\nb,2,4\nc,3,6\n");
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
  const sourceId = `source:${hash}`,
    datasetId = "mock:basic",
    analysisId = "mock:basic:analysis:v1";
  const recordIds = ["a", "b", "c"].map((id) => `mock:${id}`);
  const fields: DatasetBundle["fields"] = [
    {
      fieldId: "id",
      label: "记录",
      role: "identifier",
      valueType: "string",
      unit: "",
      meaning: "自建样例记录编号",
      definitionStatus: "confirmed",
      analysisPolicy: "excluded",
      exclusionReason: "标识列不可统计",
    },
    ...["x", "y"].map((fieldId) => ({
      fieldId,
      label: `示例指标 ${fieldId.toUpperCase()}`,
      role: "measure" as const,
      valueType: "number" as const,
      unit: "示例单位",
      meaning: "团队构造数值，仅用于界面联调",
      definitionStatus: "confirmed" as const,
      analysisPolicy: "allowed" as const,
    })),
  ];
  const bundle: DatasetBundle = {
    schemaVersion: 1,
    datasetId,
    datasetVersion: "mock:basic:v1",
    domain: "generic",
    adapterType: "generic-csv",
    adapterVersion: "mock:1",
    sources: [
      {
        sourceId,
        originalFileName: "联调样例.csv",
        sha256: hash,
        encoding: "utf-8-sig",
        parseOptions: {
          delimiter: ",",
          quoteChar: '"',
          escapeChar: '"',
          skipEmptyLines: false,
        },
        headers: ["id", "x", "y"],
        rawRecords: [
          ["a", "1", "2"],
          ["b", "2", "4"],
          ["c", "3", "6"],
        ],
        rawBytesBase64: btoa(
          Array.from(bytes, (x) => String.fromCharCode(x)).join(""),
        ),
      },
    ],
    fields,
    records: recordIds.map((recordId, i) => ({
      recordId,
      values: { id: ["a", "b", "c"][i], x: i + 1, y: (i + 1) * 2 },
      provenance: Object.fromEntries(
        ["id", "x", "y"].map((fieldId, columnIndex) => [
          fieldId,
          [{ sourceId, recordIndex: i + 1, columnIndex }],
        ]),
      ),
    })),
    transformations: [],
    issues: [
      {
        code: "MOCK",
        severity: "warning",
        message:
          "联调样例：数值为团队手算参考，不是三域真实数据，也不代表统计模块或实时 AI 已验收。",
      },
    ],
    graph: {
      schemaVersion: 1,
      owner: "data",
      nodes: [
        { id: sourceId, type: "source", label: "联调样例.csv", ref: sourceId },
        {
          id: datasetId,
          type: "dataset",
          label: "手算联调样例",
          ref: datasetId,
        },
        ...fields
          .filter((f) => f.role === "measure")
          .map((f) => ({
            id: `indicator:mock:${f.fieldId}`,
            type: "indicator" as const,
            label: f.label,
            ref: f.fieldId,
          })),
      ],
      edges: [
        {
          id: "mock:derived",
          from: datasetId,
          to: sourceId,
          type: "derived_from",
        },
        ...["x", "y"].map((id) => ({
          id: `mock:contains:${id}`,
          from: datasetId,
          to: `indicator:mock:${id}`,
          type: "contains" as const,
        })),
      ],
    },
  };
  const results: MetricResult[] = ["x", "y"].flatMap((fieldId, i) => {
    const known = i === 0 ? [2, 2, 1, 1, 1.5, 2.5, 3] : [4, 4, 2, 2, 3, 5, 6];
    return ["mean", "median", "std", "low", "q1", "q3", "high"].map(
      (metric, j) => ({
        resultId: `${analysisId}:${fieldId}:${metric}`,
        metric,
        fieldIds: [fieldId],
        value: known[j],
        unit: "示例单位",
        method:
          metric === "std"
            ? "样本标准差 n−1（固定手算参考）"
            : metric === "mean"
              ? "算术平均数（固定手算参考）"
              : ["low", "high"].includes(metric)
                ? "1.5IQR 内实际观测须线（固定手算参考）"
                : "Type7 线性插值（固定手算参考）",
        parameters: {},
        validRecordIds: recordIds,
        excludedRecordIds: [],
        exclusionReasons: {},
      }),
    );
  });
  results.push({
    resultId: `${analysisId}:pearson`,
    metric: "pearson",
    fieldIds: ["x", "y"],
    value: 1,
    unit: "",
    method: "Pearson 成对有效样本（固定手算参考）",
    parameters: {},
    validRecordIds: recordIds,
    excludedRecordIds: [],
    exclusionReasons: {},
  });
  const scopeId = `${analysisId}:scope`;
  const edges: GraphEdge[] = [
    { id: `${scopeId}:selects`, from: scopeId, to: datasetId, type: "selects" },
  ];
  for (const result of results) {
    const id = `calculation:${result.resultId}`;
    edges.push({
      id: `${id}:scope`,
      from: id,
      to: scopeId,
      type: "uses_scope",
    });
    for (const f of result.fieldIds)
      edges.push({
        id: `${id}:${f}`,
        from: id,
        to: `indicator:mock:${f}`,
        type: "uses_indicator",
      });
  }
  const analysis: AnalysisResult = {
    schemaVersion: 1,
    analysisId,
    datasetId,
    datasetVersion: bundle.datasetVersion,
    request: {
      datasetId,
      datasetVersion: bundle.datasetVersion,
      measureFieldIds: ["x", "y"],
      correlationPair: ["x", "y"],
      filters: [],
    },
    scope: {
      scopeId,
      filters: [],
      recordIds,
      label: "团队构造 · 3 条记录",
      limitations: ["仅作界面与回源联调。相关不等于因果。"],
    },
    results,
    chartData: {
      histograms: ["x", "y"].map((fieldId, i) => ({
        fieldId,
        edges: [1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3].map(
          (v) => v * (i + 1),
        ),
        counts: [1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
        binRecordIds: [
          [recordIds[0]],
          [],
          [],
          [],
          [],
          [recordIds[1]],
          [],
          [],
          [],
          [recordIds[2]],
        ],
      })),
      scatter: {
        xFieldId: "x",
        yFieldId: "y",
        correlationResultId: `${analysisId}:pearson`,
        points: recordIds.map((recordId, i) => ({
          recordId,
          x: i + 1,
          y: (i + 1) * 2,
        })),
      },
      boxplots: ["x", "y"].map((fieldId) => ({
        fieldId,
        lowResultId: `${analysisId}:${fieldId}:low`,
        q1ResultId: `${analysisId}:${fieldId}:q1`,
        medianResultId: `${analysisId}:${fieldId}:median`,
        q3ResultId: `${analysisId}:${fieldId}:q3`,
        highResultId: `${analysisId}:${fieldId}:high`,
        outliers: [],
      })),
    },
    issues: [],
    graph: {
      schemaVersion: 1,
      owner: "analysis",
      nodes: [
        { id: scopeId, type: "scope", label: "3 条样例记录", ref: scopeId },
        ...results.map((r) => ({
          id: `calculation:${r.resultId}`,
          type: "calculation" as const,
          label: `${r.fieldIds.join("/")} · ${r.metric}`,
          ref: r.resultId,
        })),
      ],
      edges,
    },
  };
  const generatedAt = "2026-10-25T00:00:00.000Z";
  const insights: Insight[] = [
    {
      insightId: `${analysisId}:fact:mean`,
      analysisId,
      kind: "fact",
      origin: "computed",
      textTemplate: `样例中，X 的均值为 {{result:${analysisId}:x:mean}}，Y 的均值为 {{result:${analysisId}:y:mean}}。点击数字查看三条原始记录。`,
      resultRefs: [`${analysisId}:x:mean`, `${analysisId}:y:mean`],
      generatedAt,
      model: null,
      status: "valid",
    },
  ];
  return {
    schemaVersion: 1,
    projectId: "mock:example-project",
    createdAt: generatedAt,
    savedAt: generatedAt,
    datasets: [bundle],
    analyses: [analysis],
    insights,
    selection: {
      datasetId,
      analysisId,
      measureFieldIds: ["x", "y"],
      nodeId: null,
    },
  };
}
