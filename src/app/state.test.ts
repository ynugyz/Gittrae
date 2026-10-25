import test from "node:test";
import assert from "node:assert/strict";
import type { AnalysisResult, Insight, InsightResponse } from "../contracts";
import { createExampleProject } from "../contracts/example";
import { buildInsightGraph } from "../graph";
import {
  addAnalysis,
  addDatasets,
  applyInsightResponse,
  emptyProject,
} from "./state";

/** 只构造客户端边界测试响应，不会请求真实模型。 */
function responseFor(analysis: AnalysisResult): InsightResponse {
  const resultId = analysis.results[0].resultId;
  const generatedAt = "2026-10-25T01:00:00.000Z";
  const insight: Insight = {
    insightId: `${analysis.analysisId}:test-only-ai`,
    analysisId: analysis.analysisId,
    kind: "interpretation",
    origin: "live_ai",
    status: "valid",
    model: "test-only-model",
    generatedAt,
    textTemplate: `测试解读引用 {{result:${resultId}}}。相关不等于因果。`,
    resultRefs: [resultId],
  };
  return {
    analysisId: analysis.analysisId,
    requestId: "test-only-request",
    model: insight.model!,
    generatedAt,
    insights: [insight],
    graph: buildInsightGraph([insight], [analysis]),
  };
}

function alternateAnalysis(original: AnalysisResult): AnalysisResult {
  const next = JSON.parse(
    JSON.stringify(original).replaceAll(
      original.analysisId,
      `${original.analysisId}:filtered`,
    ),
  ) as AnalysisResult;
  // 同样三条记录，但请求中明确添加筛选，属于另一分析身份。
  next.request.filters = [
    { fieldId: "id", operator: "in", values: ["a", "b", "c"] },
  ];
  next.scope.filters = structuredClone(next.request.filters);
  return next;
}

test("新增数据和分析保留原状态，切到同一次分析的指标和结果", async () => {
  const sample = await createExampleProject();
  const empty = emptyProject();
  const withData = addDatasets(empty, sample.datasets);
  const current = addAnalysis(
    withData,
    sample.analyses[0],
    sample.analyses[0].request,
    sample.insights,
  );
  assert.equal(empty.datasets.length, 0);
  assert.equal(withData.analyses.length, 0);
  assert.equal(current.analyses.length, 1);
  assert.equal(current.selection.analysisId, sample.analyses[0].analysisId);
  assert.deepEqual(
    current.selection.measureFieldIds,
    sample.analyses[0].request.measureFieldIds,
  );
  assert.equal(
    addAnalysis(
      current,
      sample.analyses[0],
      sample.analyses[0].request,
      sample.insights,
    ).analyses.length,
    1,
  );
  const wrongVersion = structuredClone(sample.analyses[0]);
  wrongVersion.datasetVersion = "incorrect-version";
  assert.throws(
    () => addAnalysis(withData, wrongVersion, sample.analyses[0].request, []),
    /版本/,
  );
  const unknown = structuredClone(sample.insights);
  unknown[0].resultRefs = ["unknown-result"];
  unknown[0].textTemplate = "{{result:unknown-result}}";
  assert.throws(
    () =>
      addAnalysis(
        withData,
        sample.analyses[0],
        sample.analyses[0].request,
        unknown,
      ),
    /不存在|不属于/,
  );
});

test("重复计算仅生成时间变化时复用原事实，正文变化仍拒绝", async () => {
  const sample = await createExampleProject();
  const facts = structuredClone(sample.insights);
  facts[0].generatedAt = "2026-10-25T07:58:00.000Z";
  const repeated = addAnalysis(
    sample,
    sample.analyses[0],
    sample.analyses[0].request,
    facts,
  );
  assert.deepEqual(repeated.insights, sample.insights);
  facts[0].textTemplate += "改变内容";
  assert.throws(
    () =>
      addAnalysis(
        sample,
        sample.analyses[0],
        sample.analyses[0].request,
        facts,
      ),
    /冲突/,
  );
});

test("有效实时响应必须有一致的发现图，且只追加解释而不改变统计结果", async () => {
  const sample = await createExampleProject();
  const response = responseFor(sample.analyses[0]);
  const result = applyInsightResponse(sample, response);
  assert.equal(result.insights.length, sample.insights.length + 1);
  assert.strictEqual(result.analyses, sample.analyses);
  assert.strictEqual(result.selection, sample.selection);
  assert.equal(sample.insights.length, 1);
  const missingGraph = structuredClone(response);
  missingGraph.graph.edges = [];
  assert.throws(() => applyInsightResponse(sample, missingGraph), /发现图/);
  const wrongModel = structuredClone(response);
  wrongModel.insights[0].model = "different-model";
  assert.throws(() => applyInsightResponse(sample, wrongModel), /模型标识/);
});

test("未知和跨分析结果引用均拒绝，旧响应原样返回当前项目对象", async () => {
  const sample = await createExampleProject();
  const next = alternateAnalysis(sample.analyses[0]);
  const current = addAnalysis(sample, next, next.request, []);
  const oldResponse = responseFor(sample.analyses[0]);
  assert.strictEqual(applyInsightResponse(current, oldResponse), current);
  assert.equal(current.selection.analysisId, next.analysisId);
  const crossAnalysis = responseFor(next);
  crossAnalysis.insights[0].resultRefs = [
    sample.analyses[0].results[0].resultId,
  ];
  crossAnalysis.insights[0].textTemplate = `{{result:${sample.analyses[0].results[0].resultId}}}`;
  assert.throws(
    () => applyInsightResponse(current, crossAnalysis),
    /不存在|不属于/,
  );
  const unknown = responseFor(next);
  unknown.insights[0].resultRefs = ["missing-result"];
  unknown.insights[0].textTemplate = "{{result:missing-result}}";
  assert.throws(() => applyInsightResponse(current, unknown), /不存在|不属于/);
});

test("实时 AI 不能伪装为确定性事实，拒绝后原项目保持不变", async () => {
  const sample = await createExampleProject();
  const before = structuredClone(sample);
  const response = responseFor(sample.analyses[0]);
  response.insights[0].kind = "fact";
  assert.throws(
    () => applyInsightResponse(sample, response),
    /来源|状态|模型标识/,
  );
  assert.deepEqual(sample, before);
});

test("相同内容不同对象键顺序可复用，历史解释编号不能覆盖其他内容", async () => {
  const sample = await createExampleProject();
  const analysis = structuredClone(sample.analyses[0]);
  analysis.request = Object.fromEntries(
    Object.entries(analysis.request).reverse(),
  ) as typeof analysis.request;
  assert.equal(
    addAnalysis(sample, analysis, sample.analyses[0].request, []).analyses
      .length,
    1,
  );
  const response = responseFor(analysis);
  const accepted = applyInsightResponse(sample, response);
  assert.equal(
    applyInsightResponse(accepted, response).insights.length,
    accepted.insights.length,
  );
  const changed = structuredClone(response);
  changed.insights[0].textTemplate += " 新增了另一种说法。";
  assert.throws(() => applyInsightResponse(accepted, changed), /解释编号冲突/);
});
