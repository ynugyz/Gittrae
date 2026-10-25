// 手算样例自测：对照 acceptance/fixtures/expected.json 的口径。
// 这些样例是团队自建参考，不是组委会官方真值。
// 文件名使用 .test.ts，以便并入人员3 的 `tsx --test src/**/*.test.ts`。

import assert from 'node:assert/strict';
import test from 'node:test';

import { analyze, AnalysisError } from './analyze.mjs';
import { buildFacts } from './facts.mjs';
import { validateInsights } from './validate.mjs';
import { boxplot, histogram, mean, median, pearson, quantileType7, sampleStdDev } from './statistics.mjs';
import { createInsightsServer } from '../../server/insights.mjs';

const TOLERANCE = 1e-9;

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) <= TOLERANCE, `${message}: 期望 ${expected}，实际 ${actual}`);
}

const FIELD_BASE = [
  { fieldId: 'id', label: '编号', role: 'identifier', valueType: 'text', unit: '', analysisPolicy: 'allowed' },
  { fieldId: 'region', label: '地区', role: 'dimension', valueType: 'text', unit: '', analysisPolicy: 'allowed' },
  { fieldId: 'x', label: 'x 指标', role: 'measure', valueType: 'number', unit: '', analysisPolicy: 'allowed' },
  { fieldId: 'y', label: 'y 指标', role: 'measure', valueType: 'number', unit: '', analysisPolicy: 'allowed' },
  { fieldId: 'constant', label: '常量列', role: 'measure', valueType: 'number', unit: '', analysisPolicy: 'allowed' },
];

function makeBundle(records, overrides = {}) {
  return {
    schemaVersion: 1,
    datasetId: 'ds:fixture',
    datasetVersion: 'v1',
    domain: 'generic',
    fields: overrides.fields ?? FIELD_BASE,
    records,
    ...overrides.bundle,
  };
}

function request(overrides = {}) {
  return {
    datasetId: 'ds:fixture',
    datasetVersion: 'v1',
    measureFieldIds: ['x'],
    correlationPair: null,
    filters: [],
    ...overrides,
  };
}

function basicRecords() {
  return [
    { recordId: 'a', values: { id: 'a', region: 'R1', x: 1, y: 2, constant: 5 } },
    { recordId: 'b', values: { id: 'b', region: 'R1', x: 2, y: 4, constant: 5 } },
    { recordId: 'c', values: { id: 'c', region: 'R2', x: 3, y: 6, constant: 5 } },
  ];
}

function resultOf(analysis, metric, fieldIds) {
  const result = analysis.results.find(
    (item) => item.metric === metric && item.fieldIds.join('+') === fieldIds.join('+'),
  );
  assert.ok(result, `缺少结果 ${metric} ${fieldIds.join('+')}`);
  return result;
}

test('统计原语符合 basic.csv 手算值', () => {
  const x = [1, 2, 3];
  const y = [2, 4, 6];
  assert.equal(mean(x), 2);
  assert.equal(median(x), 2);
  assert.equal(sampleStdDev(x), 1);
  assert.equal(quantileType7(x, 0.25), 1.5);
  assert.equal(quantileType7(x, 0.75), 2.5);
  assert.equal(pearson(x, y).value, 1);

  const hist = histogram(x);
  assert.deepEqual(hist.edges, [1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3]);
  assert.deepEqual(hist.counts, [1, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual(
    hist.bins.map((bin) => bin.length),
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  );

  const box = boxplot(x);
  assert.equal(box.low, 1);
  assert.equal(box.high, 3);
  assert.deepEqual(box.outliers, []);
});

test('analyze 产出均值、三图数据与派生图', () => {
  const bundle = makeBundle(basicRecords());
  const analysis = analyze(bundle, request({ measureFieldIds: ['x', 'y'], correlationPair: ['x', 'y'] }));

  assert.match(analysis.analysisId, /^analysis:[0-9a-f]{24}$/);
  assert.deepEqual(analysis.scope.recordIds, ['a', 'b', 'c']);
  assert.ok(typeof analysis.scope.label === 'string' && analysis.scope.label.length > 0);
  assert.ok(Array.isArray(analysis.scope.limitations) && analysis.scope.limitations.length > 0);

  close(resultOf(analysis, 'mean', ['x']).value, 2, 'x 均值');
  close(resultOf(analysis, 'median', ['x']).value, 2, 'x 中位数');
  close(resultOf(analysis, 'stddev', ['x']).value, 1, 'x 标准差');
  close(resultOf(analysis, 'low', ['x']).value, 1, 'x 下须');
  close(resultOf(analysis, 'high', ['x']).value, 3, 'x 上须');
  close(resultOf(analysis, 'pearson', ['x', 'y']).value, 1, 'Pearson');

  for (const result of analysis.results) {
    assert.equal(result.validCount, result.validRecordIds.length);
  }

  assert.equal(analysis.chartData.histograms.length, 2);
  const histX = analysis.chartData.histograms.find((item) => item.fieldId === 'x');
  assert.equal(histX.edges.length, 11);
  assert.deepEqual(histX.counts, [1, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual(histX.binRecordIds.map((ids) => ids.length), histX.counts);

  const boxX = analysis.chartData.boxplots.find((item) => item.fieldId === 'x');
  assert.equal(boxX.lowResultId, resultOf(analysis, 'low', ['x']).resultId);
  assert.equal(boxX.highResultId, resultOf(analysis, 'high', ['x']).resultId);
  assert.deepEqual(boxX.outliers, []);

  assert.equal(analysis.chartData.scatter.points.length, 3);
  assert.equal(analysis.chartData.scatter.correlationResultId, resultOf(analysis, 'pearson', ['x', 'y']).resultId);

  const edgeTypes = new Set(analysis.graph.edges.map((edge) => edge.type));
  assert.deepEqual([...edgeTypes].sort(), ['selects', 'uses_indicator', 'uses_scope']);
  assert.equal(analysis.graph.owner, 'analysis');
});

test('图节点符合人员3 共享类型：ref 为字符串且编号一致', () => {
  const bundle = makeBundle(basicRecords(), {
    bundle: {
      graph: {
        schemaVersion: 1,
        owner: 'data',
        nodes: [{ id: 'dataset:custom-node', type: 'dataset', label: '样例数据', ref: 'ds:fixture' }],
        edges: [],
      },
    },
  });
  const analysis = analyze(bundle, request({ measureFieldIds: ['x', 'y'], correlationPair: ['x', 'y'] }));
  for (const node of analysis.graph.nodes) {
    assert.equal(typeof node.ref, 'string');
    assert.ok(node.ref.length > 0);
  }
  for (const node of analysis.graph.nodes.filter((item) => item.type === 'calculation')) {
    assert.equal(node.id, `calculation:${node.ref}`);
  }
  const scopeNode = analysis.graph.nodes.find((item) => item.type === 'scope');
  assert.equal(scopeNode.ref, analysis.scope.scopeId);
  const indicators = analysis.graph.nodes.filter((item) => item.type === 'indicator');
  assert.deepEqual(indicators.map((item) => item.ref).sort(), ['x', 'y']);

  const facts = buildFacts(analysis);
  for (const node of facts.graph.nodes.filter((item) => item.type === 'finding')) {
    assert.equal(node.id, `finding:${node.ref}`);
    assert.equal(node.label, '数据事实');
  }
});

test('缺失与常量：逐列删除、成对相关、常量箱线图', () => {
  const records = [
    { recordId: 'a', values: { id: 'a', region: 'R1', x: 1, y: 2, constant: 5 } },
    { recordId: 'b', values: { id: 'b', region: 'R1', x: null, y: 4, constant: 5 } },
    { recordId: 'c', values: { id: 'c', region: 'R2', x: 3, y: null, constant: 5 } },
    { recordId: 'd', values: { id: 'd', region: 'R2', x: 5, y: 10, constant: 5 } },
  ];
  const analysis = analyze(makeBundle(records), request({ measureFieldIds: ['x', 'y', 'constant'], correlationPair: ['x', 'y'] }));

  close(resultOf(analysis, 'mean', ['x']).value, 3, 'x 均值');
  close(resultOf(analysis, 'stddev', ['x']).value, 2, 'x 标准差');
  close(resultOf(analysis, 'mean', ['y']).value, 16 / 3, 'y 均值');
  close(resultOf(analysis, 'stddev', ['y']).value, Math.sqrt(52 / 3), 'y 标准差');
  assert.deepEqual(resultOf(analysis, 'median', ['x']).excludedRecordIds, ['b']);
  assert.deepEqual(resultOf(analysis, 'mean', ['y']).excludedRecordIds, ['c']);

  const correlation = resultOf(analysis, 'pearson', ['x', 'y']);
  assert.equal(correlation.value, 1);
  assert.deepEqual(correlation.validRecordIds, ['a', 'd']);
  assert.deepEqual(correlation.excludedRecordIds, ['b', 'c']);

  const constantHist = analysis.chartData.histograms.find((item) => item.fieldId === 'constant');
  assert.deepEqual(constantHist.edges, [4.5, 4.6, 4.7, 4.8, 4.9, 5, 5.1, 5.2, 5.3, 5.4, 5.5]);
  assert.deepEqual(constantHist.counts, [0, 0, 0, 0, 0, 4, 0, 0, 0, 0]);

  const constantCorrelation = analyzerWithConstant(records);
  assert.equal(constantCorrelation.value, null);
  assert.equal(constantCorrelation.reason, 'constant_field');
});

function analyzerWithConstant(records) {
  const analysis = analyze(makeBundle(records), request({ measureFieldIds: ['x'], correlationPair: ['x', 'constant'] }));
  return resultOf(analysis, 'pearson', ['x', 'constant']);
}

test('单值样本：标准差与 Pearson 为 null 且有原因', () => {
  const records = [{ recordId: 'only', values: { id: 'only', region: 'R1', x: 7, y: 14, constant: 5 } }];
  const analysis = analyze(makeBundle(records), request({ measureFieldIds: ['x'], correlationPair: ['x', 'y'] }));
  assert.equal(resultOf(analysis, 'mean', ['x']).value, 7);
  assert.equal(resultOf(analysis, 'median', ['x']).value, 7);
  assert.equal(resultOf(analysis, 'stddev', ['x']).value, null);
  assert.equal(resultOf(analysis, 'pearson', ['x', 'y']).value, null);
  assert.ok(analysis.issues.some((issue) => issue.code === 'insufficient_sample'));
});

test('全缺失：统计为 null，直方图为空', () => {
  const records = [
    { recordId: 'a', values: { id: 'a', region: 'R1', x: null, y: null, constant: null } },
    { recordId: 'b', values: { id: 'b', region: 'R1', x: '', y: null, constant: null } },
  ];
  const analysis = analyze(makeBundle(records), request({ measureFieldIds: ['x'] }));
  assert.equal(resultOf(analysis, 'mean', ['x']).value, null);
  assert.equal(resultOf(analysis, 'mean', ['x']).validCount, 0);
  const hist = analysis.chartData.histograms.find((item) => item.fieldId === 'x');
  assert.deepEqual(hist.edges, []);
  assert.deepEqual(hist.counts, []);
  assert.deepEqual(hist.binRecordIds, []);
  assert.ok(analysis.issues.some((issue) => issue.code === 'no_valid_values'));
});

test('筛选会改变分析编号与范围', () => {
  const bundle = makeBundle(basicRecords());
  const all = analyze(bundle, request());
  const filtered = analyze(bundle, request({ filters: [{ fieldId: 'region', operator: 'eq', values: ['R1'] }] }));
  assert.notEqual(all.analysisId, filtered.analysisId);
  assert.deepEqual(filtered.scope.recordIds, ['a', 'b']);
  assert.equal(resultOf(filtered, 'mean', ['x']).value, 1.5);
});

test('分析编号绑定方法版本，并复用人员1 的数据集节点 ID', () => {
  const bundle = makeBundle(basicRecords(), {
    bundle: {
      graph: {
        schemaVersion: 1,
        owner: 'data',
        nodes: [{ id: 'dataset:custom-node', type: 'dataset', label: '自定义数据集', ref: 'ds:fixture' }],
        edges: [],
      },
    },
  });
  const analysis = analyze(bundle, request());
  assert.equal(analysis.methodVersion, 'analysis-methods-v1');
  const selects = analysis.graph.edges.find((edge) => edge.type === 'selects');
  assert.equal(selects.to, 'dataset:custom-node');
});

test('箱线图异常点仍能映射回原始记录', () => {
  const records = [
    { recordId: 'a', values: { id: 'a', region: 'R1', x: 1, y: 1, constant: 5 } },
    { recordId: 'b', values: { id: 'b', region: 'R1', x: 2, y: 1, constant: 5 } },
    { recordId: 'c', values: { id: 'c', region: 'R1', x: 3, y: 1, constant: 5 } },
    { recordId: 'd', values: { id: 'd', region: 'R1', x: 4, y: 1, constant: 5 } },
    { recordId: 'e', values: { id: 'e', region: 'R1', x: 100, y: 1, constant: 5 } },
  ];
  const analysis = analyze(makeBundle(records), request());
  const box = analysis.chartData.boxplots.find((item) => item.fieldId === 'x');
  assert.deepEqual(box.outliers, [{ recordId: 'e', value: 100 }]);
  assert.equal(resultOf(analysis, 'low', ['x']).value, 1);
  assert.equal(resultOf(analysis, 'high', ['x']).value, 4);
});

test('重复记录 ID 被拒绝', () => {
  const records = [
    { recordId: 'dup', values: { id: 'dup', region: 'R1', x: 1, y: 1, constant: 5 } },
    { recordId: 'dup', values: { id: 'dup', region: 'R2', x: 2, y: 2, constant: 5 } },
  ];
  assert.throws(
    () => analyze(makeBundle(records), request()),
    (error) => error instanceof AnalysisError && error.code === 'duplicate_record_id',
  );
});

test('拒绝未知字段、版本不一致、排除字段与非数值度量', () => {
  const bundle = makeBundle(basicRecords());
  assert.throws(
    () => analyze(bundle, request({ measureFieldIds: ['nope'] })),
    (error) => error instanceof AnalysisError && error.code === 'unknown_field',
  );
  assert.throws(
    () => analyze(bundle, request({ datasetVersion: 'v2' })),
    (error) => error instanceof AnalysisError && error.code === 'dataset_version_mismatch',
  );

  const excludedBundle = makeBundle(basicRecords(), {
    fields: FIELD_BASE.map((field) => (field.fieldId === 'x' ? { ...field, analysisPolicy: 'excluded', exclusionReason: '原始环比列' } : field)),
  });
  assert.throws(
    () => analyze(excludedBundle, request({ measureFieldIds: ['x'] })),
    (error) => error instanceof AnalysisError && error.code === 'field_excluded',
  );

  const textMeasure = makeBundle(basicRecords(), {
    fields: FIELD_BASE.map((field) => (field.fieldId === 'x' ? { ...field, valueType: 'text' } : field)),
  });
  assert.throws(
    () => analyze(textMeasure, request({ measureFieldIds: ['x'] })),
    (error) => error instanceof AnalysisError && error.code === 'non_numeric_measure',
  );
});

test('结果有效记录可回到原始来源引用', () => {
  // 共享类型 DataRecord.provenance 是 { [fieldId]: SourceRef[] }。
  const records = basicRecords().map((record, index) => ({
    ...record,
    provenance: {
      x: [{ sourceId: 'acceptance/fixtures/basic.csv', recordIndex: index + 2, columnIndex: 2 }],
    },
  }));
  const analysis = analyze(makeBundle(records), request());
  const mean = resultOf(analysis, 'mean', ['x']);
  assert.deepEqual(mean.validRecordIds, ['a', 'b', 'c']);
  const byId = new Map(records.map((record) => [record.recordId, record]));
  assert.equal(byId.get('a').provenance.x[0].recordIndex, 2);
  assert.equal(byId.get('c').provenance.x[0].sourceId, 'acceptance/fixtures/basic.csv');

  const calculationId = `calculation:${mean.resultId}`;
  const usesScope = analysis.graph.edges.find((edge) => edge.from === calculationId && edge.type === 'uses_scope');
  assert.ok(usesScope);
  assert.ok(analysis.graph.edges.some((edge) => edge.from === usesScope.to && edge.type === 'selects'));
});

test('buildFacts 生成可回源的确定性事实与发现图', () => {
  const analysis = analyze(makeBundle(basicRecords()), request({ measureFieldIds: ['x', 'y'], correlationPair: ['x', 'y'] }));
  const facts = buildFacts(analysis);
  assert.ok(facts.insights.length >= 6);
  const check = validateInsights(facts.insights, {
    analysisId: analysis.analysisId,
    resultIds: analysis.results.map((result) => result.resultId),
  });
  assert.equal(check.valid, true);
  assert.equal(facts.graph.nodes.length, facts.insights.length);
  assert.equal(facts.graph.edges.length, facts.insights.length);
  for (const insight of facts.insights) {
    assert.equal(insight.kind, 'fact');
    assert.equal(insight.origin, 'computed');
    assert.equal(insight.model, null);
    assert.match(insight.textTemplate, /\{\{result:[^}]+\}\}/);
  }
});

test('引用校验拒绝跨分析或不存在的 resultId', () => {
  const analysis = analyze(makeBundle(basicRecords()), request());
  const resultIds = analysis.results.map((result) => result.resultId);
  const bad = {
    insightId: 'insight:bad',
    analysisId: analysis.analysisId,
    kind: 'interpretation',
    origin: 'live_ai',
    textTemplate: '均值为 {{result:analysis:other:mean:x}}。',
    resultRefs: ['analysis:other:mean:x'],
    generatedAt: new Date().toISOString(),
    model: 'deepseek-flash',
    status: 'valid',
  };
  const check = validateInsights([bad], { analysisId: analysis.analysisId, resultIds });
  assert.equal(check.valid, false);
  assert.ok(check.checks[0].errors.some((error) => error.code === 'unknown_result'));
});

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function fakeFetch(content, { model = 'deepseek-flash' } = {}) {
  const state = { calls: 0 };
  const fetchImpl = async () => {
    state.calls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ model, choices: [{ message: { content } }] }),
    };
  };
  return { fetchImpl, state };
}

test('本机代理：缺密钥返回 503，不泄露密钥', async () => {
  const server = createInsightsServer({ env: {}, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) });
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId: 'analysis:test', facts: [{ resultId: 'r1' }], context: {} }),
    });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'missing_api_key');
    assert.equal(JSON.stringify(body).includes('sk-'), false);
  } finally {
    server.close();
  }
});

test('本机代理：真实调用成功时校验引用并生成发现图', async () => {
  const analysis = analyze(makeBundle(basicRecords()), request());
  const meanResult = resultOf(analysis, 'mean', ['x']);
  const content = `\`\`\`json\n${JSON.stringify({
    insights: [{ textTemplate: `字段「x 指标」的均值为 {{result:${meanResult.resultId}}}。`, resultRefs: [meanResult.resultId] }],
  })}\n\`\`\``;
  const { fetchImpl, state } = fakeFetch(content);
  const server = createInsightsServer({ env: { DEEPSEEK_API_KEY: 'test-key' }, fetchImpl });
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysisId: analysis.analysisId,
        facts: analysis.results.map((result) => ({
          resultId: result.resultId,
          metric: result.metric,
          value: result.value,
          unit: result.unit,
          method: result.method,
          // 按共享契约 InsightRequest 使用 sampleSize。
          sampleSize: result.validCount,
        })),
        context: { domain: 'generic' },
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.insights.length, 1);
    assert.equal(body.insights[0].status, 'valid');
    assert.equal(body.model, 'deepseek-flash');
    assert.equal(body.graph.nodes.length, 1);
    assert.equal(body.graph.nodes[0].label, 'AI 解读');
    assert.equal(body.graph.nodes[0].ref, body.insights[0].insightId);
    assert.equal(state.calls, 1);
    assert.equal(JSON.stringify(body).includes('test-key'), false);
  } finally {
    server.close();
  }
});

test('本机代理：未知引用标记 invalid 且不进入发现图', async () => {
  const analysis = analyze(makeBundle(basicRecords()), request());
  const content = JSON.stringify({
    insights: [{ textTemplate: '均值为 {{result:analysis:unknown:mean:x}}。', resultRefs: ['analysis:unknown:mean:x'] }],
  });
  const { fetchImpl } = fakeFetch(content);
  const server = createInsightsServer({ env: { DEEPSEEK_API_KEY: 'test-key' }, fetchImpl });
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysisId: analysis.analysisId,
        facts: analysis.results.map((result) => ({ resultId: result.resultId })),
        context: {},
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.insights[0].status, 'invalid');
    assert.equal(body.graph.nodes.length, 0);
  } finally {
    server.close();
  }
});

test('本机代理：空 content 重试一次后报错', async () => {
  const { fetchImpl, state } = fakeFetch('');
  const server = createInsightsServer({
    env: { DEEPSEEK_API_KEY: 'test-key' },
    fetchImpl,
    logger: { info() {}, warn() {}, error() {} },
  });
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId: 'analysis:test', facts: [{ resultId: 'r1' }], context: {} }),
    });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error.code, 'empty_content');
    assert.equal(body.error.retryable, true);
    assert.equal(state.calls, 2);
  } finally {
    server.close();
  }
});

test('本机代理：思考 token 截断时返回明确失败', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      model: 'deepseek-flash',
      choices: [{ finish_reason: 'length', message: { content: '{"insights":[{"textTemplate":"x' } }],
    }),
  });
  const server = createInsightsServer({
    env: { DEEPSEEK_API_KEY: 'test-key' },
    fetchImpl,
    logger: { info() {}, warn() {}, error() {} },
  });
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId: 'analysis:test', facts: [{ resultId: 'r1' }], context: {} }),
    });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error.code, 'truncated_output');
    assert.equal(body.error.retryable, true);
  } finally {
    server.close();
  }
});

test('本机代理：非法 JSON 与空 insights 都返回明确失败', async () => {
  for (const [content, expectedCode] of [
    ['not-json', 'invalid_json'],
    ['{"insights":[]}', 'empty_insights'],
  ]) {
    const { fetchImpl } = fakeFetch(content);
    const server = createInsightsServer({
      env: { DEEPSEEK_API_KEY: 'test-key' },
      fetchImpl,
      logger: { info() {}, warn() {}, error() {} },
    });
    const port = await listen(server);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: 'analysis:test', facts: [{ resultId: 'r1' }], context: {} }),
      });
      const body = await response.json();
      assert.equal(response.status, 502);
      assert.equal(body.error.code, expectedCode);
    } finally {
      server.close();
    }
  }
});
