import assert from "node:assert/strict";
import test from "node:test";
import type { GraphFragment, Insight, ProjectSnapshot } from "../contracts";
import {
  buildInsightGraph,
  currentGraph,
  getEvidence,
  getNeighborhood,
  getRecordEvidence,
  mergeGraph,
  rebuildGraph,
  validateInsight,
} from "./index";

function projectFixture(): ProjectSnapshot {
  const now = "2026-10-25T07:00:00.000Z";
  return {
    schemaVersion: 1,
    projectId: "test:project",
    createdAt: now,
    savedAt: now,
    datasets: [
      {
        schemaVersion: 1,
        datasetId: "test:data",
        datasetVersion: "v1",
        domain: "generic",
        adapterType: "generic-csv",
        adapterVersion: "test",
        sources: [
          {
            sourceId: "s1",
            originalFileName: "quoted.csv",
            sha256: "0".repeat(64),
            encoding: "utf-8",
            parseOptions: {
              delimiter: ",",
              quoteChar: '"',
              escapeChar: '"',
              skipEmptyLines: false,
            },
            headers: ["code", "description", "value"],
            rawRecords: [
              ["000001", "收入,支出", "1"],
              [""],
              ["000002", "第一行\n第二行", "3"],
              ["000003", '含"引号"', ""],
            ],
            rawBytesBase64: "",
          },
        ],
        fields: [
          {
            fieldId: "x",
            label: "数值",
            role: "measure",
            valueType: "number",
            unit: "元",
            meaning: "测试数值",
            definitionStatus: "confirmed",
            analysisPolicy: "allowed",
          },
        ],
        records: [
          {
            recordId: "r3",
            values: { x: 3 },
            provenance: {
              x: [{ sourceId: "s1", recordIndex: 3, columnIndex: 2 }],
            },
          },
          {
            recordId: "r4",
            values: { x: null },
            provenance: {
              x: [{ sourceId: "s1", recordIndex: 4, columnIndex: 2 }],
            },
          },
        ],
        transformations: [],
        issues: [],
        graph: {
          schemaVersion: 1,
          owner: "data",
          nodes: [
            { id: "d", type: "dataset", label: "数据", ref: "test:data" },
            { id: "s", type: "source", label: "quoted.csv", ref: "s1" },
            { id: "x", type: "indicator", label: "数值", ref: "x" },
          ],
          edges: [
            { id: "d:s", type: "derived_from", from: "d", to: "s" },
            { id: "d:x", type: "contains", from: "d", to: "x" },
          ],
        },
      },
    ],
    analyses: [
      {
        schemaVersion: 1,
        analysisId: "a1",
        datasetId: "test:data",
        datasetVersion: "v1",
        request: {
          datasetId: "test:data",
          datasetVersion: "v1",
          measureFieldIds: ["x"],
          correlationPair: null,
          filters: [],
        },
        scope: {
          scopeId: "scope1",
          filters: [],
          recordIds: ["r3", "r4"],
          label: "测试范围",
          limitations: ["团队构造样例"],
        },
        results: [
          {
            resultId: "a1:mean",
            metric: "mean",
            fieldIds: ["x"],
            value: 3,
            unit: "元",
            method: "算术平均",
            parameters: {},
            validRecordIds: ["r3"],
            excludedRecordIds: ["r4"],
            exclusionReasons: { r4: "缺失值" },
          },
        ],
        chartData: { histograms: [], scatter: null, boxplots: [] },
        issues: [],
        graph: {
          schemaVersion: 1,
          owner: "analysis",
          nodes: [
            { id: "scope1", type: "scope", label: "测试范围", ref: "scope1" },
            {
              id: "calculation:a1:mean",
              type: "calculation",
              label: "均值",
              ref: "a1:mean",
            },
          ],
          edges: [
            { id: "scope1:d", type: "selects", from: "scope1", to: "d" },
            {
              id: "c:scope",
              type: "uses_scope",
              from: "calculation:a1:mean",
              to: "scope1",
            },
            {
              id: "c:x",
              type: "uses_indicator",
              from: "calculation:a1:mean",
              to: "x",
            },
          ],
        },
      },
    ],
    insights: [
      {
        insightId: "i1",
        analysisId: "a1",
        kind: "fact",
        origin: "computed",
        textTemplate: "测试均值为 {{result:a1:mean}}。",
        resultRefs: ["a1:mean"],
        generatedAt: now,
        model: null,
        status: "valid",
      },
    ],
    selection: {
      datasetId: "test:data",
      analysisId: "a1",
      measureFieldIds: ["x"],
      nodeId: "finding:i1",
    },
  };
}

test("合并分片可去重，并拒绝冲突、悬空、伪造关系和错误方向", () => {
  const project = projectFixture();
  const fragment = project.datasets[0].graph;
  assert.equal(
    mergeGraph([fragment, structuredClone(fragment)]).nodes.length,
    3,
  );
  const conflict = structuredClone(fragment);
  conflict.nodes[0].label = "不同内容";
  assert.throws(() => mergeGraph([fragment, conflict]), /编号冲突/);
  const missing = structuredClone(fragment);
  missing.edges[0].to = "不存在";
  assert.throws(() => mergeGraph([missing]), /不存在/);
  const reversed = structuredClone(fragment);
  reversed.edges[0].from = "s";
  reversed.edges[0].to = "d";
  assert.throws(() => mergeGraph([reversed]), /方向/);
  const forbidden = structuredClone(fragment);
  (forbidden.edges[0] as { type: string }).type = "__proto__";
  assert.throws(() => mergeGraph([forbidden]), /不允许/);
});

test("解释拒绝跨分析、未知结果、缺失占位和无模型的实时记录", () => {
  const project = projectFixture(),
    insight = project.insights[0],
    analysis = project.analyses[0];
  assert.doesNotThrow(() => validateInsight(insight, analysis));
  for (const patch of [
    { analysisId: "a2" },
    { resultRefs: ["a2:mean"] },
    { textTemplate: "均值为3。" },
    { origin: "live_ai", model: null },
    { generatedAt: "yesterday" },
    { status: "invalid" },
    { textTemplate: "均值 {{result:a1:mean}} 及 {{result:missing}}。" },
  ])
    assert.throws(() =>
      validateInsight({ ...insight, ...patch } as Insight, analysis),
    );
});

test("发现图可以从项目重建，编号和邻接查询稳定，当前视图不混入历史", () => {
  const project = projectFixture();
  const graph = rebuildGraph(project);
  assert.ok(graph.nodes.some((node) => node.id === project.selection.nodeId));
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.id === "cites:i1:a1:mean" && edge.to === "calculation:a1:mean",
    ),
  );
  const neighborhood = getNeighborhood(graph, "finding:i1");
  assert.deepEqual(neighborhood.nodes.map((node) => node.id).sort(), [
    "calculation:a1:mean",
    "finding:i1",
  ]);
  const past = structuredClone(project.analyses[0]);
  past.analysisId = "a2";
  past.scope.scopeId = "scope2";
  past.results[0].resultId = "a2:mean";
  past.graph.nodes[0].id = "scope2";
  past.graph.nodes[0].ref = "scope2";
  past.graph.nodes[1].id = "calculation:a2:mean";
  past.graph.nodes[1].ref = "a2:mean";
  past.graph.edges = [
    { id: "scope2:d", type: "selects", from: "scope2", to: "d" },
    {
      id: "c2:scope",
      type: "uses_scope",
      from: "calculation:a2:mean",
      to: "scope2",
    },
    {
      id: "c2:x",
      type: "uses_indicator",
      from: "calculation:a2:mean",
      to: "x",
    },
  ];
  project.analyses.push(past);
  assert.equal(
    currentGraph(project, "a1").nodes.some((node) => node.ref === "a2:mean"),
    false,
  );
  project.analyses[0].graph.edges[1].to = "scope2";
  assert.throws(() => rebuildGraph(project), /其他分析范围/);
});

test("回源保留解析记录位置、原始字符串、排除原因与所有来源引用", () => {
  const project = projectFixture();
  const evidence = getEvidence(project, "a1:mean");
  assert.equal(evidence.validCount, 1);
  assert.equal(evidence.excludedCount, 1);
  const source = evidence.validRecords[0].cells[0].sources[0];
  assert.equal(source.recordIndex, 3);
  assert.equal(source.columnIndex, 2);
  assert.equal(source.rawValue, "3");
  assert.equal(source.rawRecord[1], "第一行\n第二行");
  assert.equal(source.rawRecord[0], "000002");
  assert.equal(source.fileName, "quoted.csv");
  assert.equal(evidence.excludedRecords[0].cells[0].value, null);
  assert.equal(evidence.excludedRecords[0].cells[0].sources[0].rawValue, "");
  assert.equal(evidence.excludedRecords[0].exclusionReason, "缺失值");
  project.datasets[0].records[0].provenance.x.push({
    sourceId: "s1",
    recordIndex: 1,
    columnIndex: 2,
  });
  assert.equal(
    getRecordEvidence(project, "test:data", ["r3"], ["x"]).records[0].cells[0]
      .sources.length,
    2,
  );
  project.datasets[0].records[0].provenance.x[0].recordIndex = 99;
  assert.throws(() => getEvidence(project, "a1:mean"), /原始位置无效/);
});

test("无效解释不进入发现图，重复解释身份和伪造基础对象引用被拒绝", () => {
  const project = projectFixture();
  assert.equal(
    buildInsightGraph(
      [{ ...project.insights[0], status: "invalid" }],
      project.analyses,
    ).nodes.length,
    0,
  );
  assert.throws(
    () =>
      buildInsightGraph(
        [project.insights[0], project.insights[0]],
        project.analyses,
      ),
    /编号重复/,
  );
  project.datasets[0].graph.nodes[0].ref = "伪造数据集";
  assert.throws(() => rebuildGraph(project), /基础图节点引用不存在/);
});
