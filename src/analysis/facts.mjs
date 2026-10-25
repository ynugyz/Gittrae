// 确定性事实（computed Insight）与发现图分片。
// 文本只通过 {{result:resultId}} 占位引用计算结果，模型与模板都不重写统计值。

import { shortHash } from './ids.mjs';

function indicatorLabels(analysis) {
  const labels = new Map();
  for (const node of analysis.graph?.nodes ?? []) {
    // GraphNode.ref 为字符串：indicator 的 ref 即 fieldId。
    if (node.type === 'indicator' && typeof node.ref === 'string') labels.set(node.ref, node.label);
  }
  return labels;
}

function resultIndex(analysis) {
  return new Map(analysis.results.map((result) => [result.resultId, result]));
}

function makeInsight({ analysisId, index, textTemplate, resultRefs, generatedAt }) {
  return {
    insightId: `insight:${shortHash(`${analysisId}|computed|${index}|${textTemplate}|${resultRefs.join(',')}`)}`,
    analysisId,
    kind: 'fact',
    origin: 'computed',
    textTemplate,
    resultRefs,
    generatedAt,
    model: null,
    status: 'valid',
  };
}

function formatUnit(unit) {
  return unit ? `（单位：${unit}）` : '';
}

export function buildFacts(analysis) {
  const labels = indicatorLabels(analysis);
  const results = resultIndex(analysis);
  const generatedAt = new Date().toISOString();
  const insights = [];

  for (const fieldId of analysis.request.measureFieldIds) {
    const label = labels.get(fieldId) ?? fieldId;
    const meanResult = results.get(`${analysis.analysisId}:mean:${fieldId}`);
    const medianResult = results.get(`${analysis.analysisId}:median:${fieldId}`);
    const stdResult = results.get(`${analysis.analysisId}:stddev:${fieldId}`);

    if (meanResult && meanResult.value !== null) {
      insights.push(
        makeInsight({
          analysisId: analysis.analysisId,
          index: `${fieldId}:mean`,
          textTemplate: `字段「${label}」的均值为 {{result:${meanResult.resultId}}}${formatUnit(meanResult.unit)}。`,
          resultRefs: [meanResult.resultId],
          generatedAt,
        }),
      );
    }
    if (medianResult && medianResult.value !== null) {
      insights.push(
        makeInsight({
          analysisId: analysis.analysisId,
          index: `${fieldId}:median`,
          textTemplate: `字段「${label}」的中位数为 {{result:${medianResult.resultId}}}${formatUnit(medianResult.unit)}。`,
          resultRefs: [medianResult.resultId],
          generatedAt,
        }),
      );
    }
    if (stdResult && stdResult.value !== null) {
      insights.push(
        makeInsight({
          analysisId: analysis.analysisId,
          index: `${fieldId}:stddev`,
          textTemplate: `字段「${label}」的样本标准差为 {{result:${stdResult.resultId}}}${formatUnit(stdResult.unit)}，按 n−1 计算。`,
          resultRefs: [stdResult.resultId],
          generatedAt,
        }),
      );
    }
  }

  if (analysis.request.correlationPair) {
    const [xFieldId, yFieldId] = analysis.request.correlationPair;
    const correlation = results.get(`${analysis.analysisId}:pearson:${xFieldId}+${yFieldId}`);
    if (correlation && correlation.value !== null) {
      const xLabel = labels.get(xFieldId) ?? xFieldId;
      const yLabel = labels.get(yFieldId) ?? yFieldId;
      insights.push(
        makeInsight({
          analysisId: analysis.analysisId,
          index: 'pearson',
          textTemplate: `字段「${xLabel}」与「${yLabel}」的 Pearson 相关系数为 {{result:${correlation.resultId}}}；相关不等于因果。`,
          resultRefs: [correlation.resultId],
          generatedAt,
        }),
      );
    }
  }

  const nodes = [];
  const edges = [];
  for (const insight of insights) {
    nodes.push({
      id: `finding:${insight.insightId}`,
      type: 'finding',
      // 与人员3 buildInsightGraph 的标签保持一致，否则合并同编号节点会冲突。
      label: '数据事实',
      ref: insight.insightId,
    });
    for (const resultId of insight.resultRefs) {
      edges.push({
        id: `cites:${insight.insightId}:${resultId}`,
        from: `finding:${insight.insightId}`,
        to: `calculation:${resultId}`,
        type: 'cites',
      });
    }
  }

  return {
    insights,
    graph: { schemaVersion: 1, owner: 'insight', nodes, edges },
  };
}
