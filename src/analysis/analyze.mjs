// AnalysisResult 产出：确定性统计、三图数据、范围快照与派生图。
// 严格按 handoff/01_公共接口.md v1 执行；不读取原始 CSV，不产生模型副作用。

import { shortHash, stableStringify } from './ids.mjs';
import {
  boxplot,
  histogram,
  mean,
  pearson,
  quantileSortedType7,
  sampleStdDev,
  toFiniteNumber,
} from './statistics.mjs';

export const METHODS_VERSION = 'analysis-methods-v2';

export class AnalysisError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AnalysisError';
    this.code = code;
  }
}

const DOMAIN_LABELS = { D1: '居民收支', D2: '企业财务', D3: '汽车行业', generic: '通用CSV' };

const DOMAIN_LIMITATIONS = {
  D1: [
    '全体、城镇、农村与单位口径分别保留；31 省简单均值不等于全国人口加权均值。',
    '停更年份保留缺失，不补零。',
  ],
  D2: [
    '原始表混合市场，股票代码按文本处理；筛选规则与排除数量需在范围中可见。',
    '缺失行业不补分类，亏损与 ST 不静默删除；数据为后续披露版本，不作历史可交易断言。',
  ],
  D3: [
    '车企榜、车型榜与 CPCA 结构/总量口径分开；Top50 不是全市场。',
    '原环比列不得用于统计结论；单月/累计、产量/批发/零售/出口、辆/万辆/百分数不混算。',
  ],
  generic: ['字段含义与单位需人工确认；未知含义不作为结论依据。'],
};

const METRIC_LABELS = {
  mean: '均值',
  median: '中位数',
  stddev: '样本标准差',
  q1: '下四分位',
  q3: '上四分位',
  low: '下须（实际观测）',
  high: '上须（实际观测）',
  pearson: 'Pearson 相关系数',
};

function normalizeFilters(filters) {
  if (!Array.isArray(filters) || filters.length === 0) return [];
  return filters.map((filter) => ({
    fieldId: String(filter.fieldId),
    operator: filter.operator,
    // 保留Scalar类型；null、数字与同名文本是不同筛选值。
    values: Array.isArray(filter.values) ? [...filter.values] : [],
  }));
}

function assertBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') throw new AnalysisError('invalid_bundle', 'DatasetBundle 缺失');
  if (bundle.schemaVersion !== 1) throw new AnalysisError('unsupported_schema', '仅支持 schemaVersion=1');
  if (!bundle.datasetId || !bundle.datasetVersion) {
    throw new AnalysisError('invalid_bundle', 'DatasetBundle 缺少 datasetId 或 datasetVersion');
  }
  if (!Array.isArray(bundle.fields) || !Array.isArray(bundle.records)) {
    throw new AnalysisError('invalid_bundle', 'DatasetBundle 缺少 fields 或 records');
  }
  const recordIds = new Set();
  for (const record of bundle.records) {
    if (!record || typeof record.recordId !== 'string' || record.recordId === '') {
      throw new AnalysisError('invalid_record', '记录缺少 recordId');
    }
    if (recordIds.has(record.recordId)) {
      throw new AnalysisError('duplicate_record_id', `记录 ID 重复：${record.recordId}`);
    }
    recordIds.add(record.recordId);
  }
}

function buildFieldMap(bundle) {
  const map = new Map();
  for (const field of bundle.fields) {
    if (!field || !field.fieldId) throw new AnalysisError('invalid_field', '字段缺少 fieldId');
    if (map.has(field.fieldId)) throw new AnalysisError('duplicate_field', `字段重复：${field.fieldId}`);
    map.set(field.fieldId, field);
  }
  return map;
}

const NUMERIC_VALUE_TYPES = new Set(['number', 'numeric', 'integer', 'float', 'decimal']);

function resolveMeasure(fieldId, fields, role = 'measure') {
  const field = fields.get(fieldId);
  if (!field) throw new AnalysisError('unknown_field', `未知字段：${fieldId}`);
  if (field.role !== role) throw new AnalysisError('invalid_field_role', `字段 ${fieldId} 不是 ${role}`);
  if (field.analysisPolicy === 'excluded') {
    throw new AnalysisError('field_excluded', `字段 ${fieldId} 已被排除：${field.exclusionReason ?? '未说明'}`);
  }
  if (field.analysisPolicy !== 'allowed') {
    throw new AnalysisError('field_not_allowed', `字段 ${fieldId} 未标记为 allowed`);
  }
  if (!NUMERIC_VALUE_TYPES.has(field.valueType)) {
    throw new AnalysisError('non_numeric_measure', `字段 ${fieldId} 不是数值度量`);
  }
  return field;
}

function assertRequest(request, bundle, fields) {
  if (!request || typeof request !== 'object') throw new AnalysisError('invalid_request', 'AnalysisRequest 缺失');
  if (request.datasetId !== bundle.datasetId) throw new AnalysisError('dataset_mismatch', 'datasetId 与数据包不一致');
  if (request.datasetVersion !== bundle.datasetVersion) {
    throw new AnalysisError('dataset_version_mismatch', 'datasetVersion 与数据包不一致');
  }
  const measureFieldIds = Array.isArray(request.measureFieldIds) ? [...new Set(request.measureFieldIds.map(String))] : [];
  if (measureFieldIds.length === 0) throw new AnalysisError('empty_measure', '至少选择一个度量字段');
  for (const fieldId of measureFieldIds) resolveMeasure(fieldId, fields);
  let correlationPair = null;
  if (request.correlationPair !== null && request.correlationPair !== undefined) {
    if (!Array.isArray(request.correlationPair) || request.correlationPair.length !== 2) {
      throw new AnalysisError('invalid_correlation_pair', 'correlationPair 必须是两个字段 ID');
    }
    const [xFieldId, yFieldId] = request.correlationPair.map(String);
    if (xFieldId === yFieldId) throw new AnalysisError('invalid_correlation_pair', '相关字段不能相同');
    resolveMeasure(xFieldId, fields);
    resolveMeasure(yFieldId, fields);
    correlationPair = [xFieldId, yFieldId];
  }
  const filters = normalizeFilters(request.filters);
  for (const filter of filters) {
    if (!filter.fieldId) throw new AnalysisError('invalid_filter', '筛选条件缺少 fieldId');
    if (!fields.has(filter.fieldId)) throw new AnalysisError('unknown_field', `筛选字段未知：${filter.fieldId}`);
    if (filter.operator !== 'eq' && filter.operator !== 'in') {
      throw new AnalysisError('invalid_filter_operator', `不支持的筛选操作：${filter.operator}`);
    }
    if (filter.values.length === 0) throw new AnalysisError('invalid_filter', '筛选条件缺少 values');
  }
  return { measureFieldIds, correlationPair, filters };
}

function applyFilters(records, filters) {
  if (filters.length === 0) return records;
  return records.filter((record) =>
    filters.every((filter) => {
      return filter.values.includes(record.values?.[filter.fieldId]);
    }),
  );
}

function classify(record, fieldId) {
  const raw = record.values?.[fieldId];
  const value = toFiniteNumber(raw);
  if (value !== null) return { value, reason: null };
  const isMissing =
    raw === null ||
    raw === undefined ||
    (typeof raw === 'string' && raw.trim() === '');
  return { value: null, reason: isMissing ? 'missing_value' : 'non_numeric' };
}

function summarizeField(records, fieldId) {
  const valid = [];
  const excluded = [];
  const reasons = {};
  for (const record of records) {
    const result = classify(record, fieldId);
    if (result.value === null) {
      excluded.push(record.recordId);
      reasons[record.recordId] = result.reason;
    } else {
      valid.push({ recordId: record.recordId, value: result.value });
    }
  }
  return { valid, excluded, reasons };
}

function createResult({ analysisId, metric, fieldIds, value, unit = '', parameters = {}, method, reason = null, validRecordIds = [], excludedRecordIds = [], exclusionReasons = {} }) {
  const resultId = `${analysisId}:${metric}:${fieldIds.join('+')}`;
  return {
    resultId,
    metric,
    fieldIds,
    value: value === undefined ? null : value,
    unit,
    method,
    parameters: { ...parameters, methodVersion: METHODS_VERSION, ...(reason ? { reason } : {}) },
    validRecordIds,
    excludedRecordIds,
    exclusionReasons,
  };
}

export function analyze(bundle, request) {
  assertBundle(bundle);
  const fields = buildFieldMap(bundle);
  const normalized = assertRequest(request, bundle, fields);
  const selectedRecords = applyFilters(bundle.records, normalized.filters);

  const identity = {
    schemaVersion: 1,
    methodVersion: METHODS_VERSION,
    datasetId: bundle.datasetId,
    datasetVersion: bundle.datasetVersion,
    measureFieldIds: [...normalized.measureFieldIds].sort(),
    correlationPair: normalized.correlationPair,
    filters: normalized.filters
      .map((filter) => ({ ...filter, values: [...filter.values] }))
      .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))),
  };
  const analysisId = `analysis:${shortHash(stableStringify(identity))}`;
  // 范围编号绑定分析身份与筛选快照，不依赖记录顺序。
  const scopeId = `scope:${shortHash(stableStringify({ analysisId, filters: identity.filters }))}`;

  const results = [];
  const issues = [];
  const histograms = [];
  const boxplots = [];

  for (const fieldId of normalized.measureFieldIds) {
    const field = resolveMeasure(fieldId, fields);
    const summary = summarizeField(selectedRecords, fieldId);
    const values = summary.valid.map((entry) => entry.value);
    const sortedValues = [...values].sort((a, b) => a - b);
    const validIds = summary.valid.map((entry) => entry.recordId);
    const excludedIds = summary.excluded;

    const meanValue = mean(values);
    const medianValue = quantileSortedType7(sortedValues, 0.5);
    const stdValue = sampleStdDev(values);
    const q1Value = quantileSortedType7(sortedValues, 0.25);
    const q3Value = quantileSortedType7(sortedValues, 0.75);
    const box = boxplot(values);
    const boxLow = box.low;
    const boxHigh = box.high;

    const common = {
      analysisId,
      fieldIds: [fieldId],
      unit: field.unit ?? '',
      validRecordIds: validIds,
      excludedRecordIds: excludedIds,
      exclusionReasons: summary.reasons,
    };
    const noValidReason = values.length === 0 ? 'no_valid_values' : null;

    results.push(createResult({ ...common, metric: 'mean', value: meanValue, reason: noValidReason, method: 'arithmetic_mean', parameters: { missing: 'drop' } }));
    results.push(createResult({ ...common, metric: 'median', value: medianValue, reason: noValidReason, method: 'type7_linear', parameters: { p: 0.5 } }));
    results.push(
      createResult({
        ...common,
        metric: 'stddev',
        value: stdValue,
        reason: values.length < 2 ? 'insufficient_sample' : null,
        method: 'sample_stddev_ddof1',
        parameters: { ddof: 1 },
      }),
    );
    results.push(createResult({ ...common, metric: 'q1', value: q1Value, reason: noValidReason, method: 'type7_linear', parameters: { p: 0.25 } }));
    results.push(createResult({ ...common, metric: 'q3', value: q3Value, reason: noValidReason, method: 'type7_linear', parameters: { p: 0.75 } }));
    results.push(
      createResult({
        ...common,
        metric: 'low',
        value: boxLow,
        reason: noValidReason,
        method: 'observed_whisker_inside_1.5_iqr',
        parameters: { fence: 'q1-1.5*iqr' },
      }),
    );
    results.push(
      createResult({
        ...common,
        metric: 'high',
        value: boxHigh,
        reason: noValidReason,
        method: 'observed_whisker_inside_1.5_iqr',
        parameters: { fence: 'q3+1.5*iqr' },
      }),
    );

    const distribution = histogram(values);
    histograms.push({
      fieldId,
      edges: distribution.edges,
      counts: distribution.counts,
      binRecordIds: distribution.bins.map((bin) => bin.map((index) => summary.valid[index].recordId)),
    });

    const byMetric = new Map(results.filter((result) => result.fieldIds[0] === fieldId && result.fieldIds.length === 1).map((result) => [result.metric, result]));
    boxplots.push({
      fieldId,
      lowResultId: byMetric.get('low').resultId,
      q1ResultId: byMetric.get('q1').resultId,
      medianResultId: byMetric.get('median').resultId,
      q3ResultId: byMetric.get('q3').resultId,
      highResultId: byMetric.get('high').resultId,
      outliers: box.outliers.map((entry) => ({ recordId: summary.valid[entry.index].recordId, value: entry.value })),
    });

    if (values.length === 0) {
      issues.push({ code: 'no_valid_values', severity: 'warning', message: `字段 ${field.label ?? fieldId} 没有有效数值`, fieldId });
    } else if (values.length < 2) {
      issues.push({ code: 'insufficient_sample', severity: 'warning', message: `字段 ${field.label ?? fieldId} 有效样本不足 2 条，样本标准差为 null`, fieldId });
    }
    if (excludedIds.length > 0) {
      const nonNumeric = Object.values(summary.reasons).filter((reason) => reason === 'non_numeric').length;
      if (nonNumeric > 0) {
        issues.push({ code: 'non_numeric_values', severity: 'warning', message: `字段 ${field.label ?? fieldId} 有 ${nonNumeric} 条非数值记录被排除`, fieldId });
      }
    }
  }

  let scatter = null;
  if (normalized.correlationPair) {
    const [xFieldId, yFieldId] = normalized.correlationPair;
    const xField = resolveMeasure(xFieldId, fields);
    const yField = resolveMeasure(yFieldId, fields);
    const points = [];
    const excludedIds = [];
    const exclusionReasons = {};
    for (const record of selectedRecords) {
      const x = classify(record, xFieldId);
      const y = classify(record, yFieldId);
      if (x.value === null || y.value === null) {
        excludedIds.push(record.recordId);
        exclusionReasons[record.recordId] = x.reason ?? y.reason ?? 'missing_value';
      } else {
        points.push({ recordId: record.recordId, x: x.value, y: y.value });
      }
    }
    const correlation = pearson(points.map((point) => point.x), points.map((point) => point.y));
    const result = createResult({
      analysisId,
      metric: 'pearson',
      fieldIds: [xFieldId, yFieldId],
      value: correlation.value,
      reason: correlation.reason,
      unit: '',
      method: 'pearson_pairwise_complete',
      parameters: { missing: 'drop_pairwise' },
      validRecordIds: points.map((point) => point.recordId),
      excludedRecordIds: excludedIds,
      exclusionReasons,
    });
    results.push(result);
    scatter = { xFieldId, yFieldId, correlationResultId: result.resultId, points };
    if (points.length < 2) {
      issues.push({ code: 'insufficient_sample', severity: 'warning', message: '相关分析成对有效样本不足 2 条，Pearson 为 null', fieldId: xFieldId });
    } else if (correlation.value === null) {
      issues.push({ code: 'constant_field', severity: 'warning', message: `字段 ${xField.label ?? xFieldId} 或 ${yField.label ?? yFieldId} 为常量，Pearson 不可计算`, fieldId: xFieldId });
    }
  }

  // 按人员3 的共享类型输出 Scope：recordIds / label / limitations 是契约字段，
  // 不另存一份自定义 labels 对象，避免下游看到两套结构。
  const fieldLabel = (fieldId) => fields.get(fieldId)?.label ?? fieldId;
  const measureText = normalized.measureFieldIds
    .map((fieldId) => {
      const unit = fields.get(fieldId)?.unit;
      return unit ? `${fieldLabel(fieldId)}（${unit}）` : fieldLabel(fieldId);
    })
    .join('、');
  const filterText = normalized.filters
    .map((filter) => `${fieldLabel(filter.fieldId)}∈[${filter.values.map(String).join(',')}]`)
    .join(' 且 ');
  const scope = {
    scopeId,
    filters: normalized.filters,
    recordIds: selectedRecords.map((record) => record.recordId),
    label: [
      DOMAIN_LABELS[bundle.domain] ?? DOMAIN_LABELS.generic,
      `指标：${measureText}`,
      filterText ? `筛选：${filterText}` : null,
      `记录 ${selectedRecords.length}/${bundle.records.length}`,
    ]
      .filter(Boolean)
      .join('｜'),
    limitations: [...new Set([
      ...(DOMAIN_LIMITATIONS[bundle.domain] ?? DOMAIN_LIMITATIONS.generic),
      ...(bundle.issues ?? []).map((issue) => issue.message),
    ])],
  };

  const graph = buildGraph({ bundle, scope, results, fields, normalized });

  return {
    schemaVersion: 1,
    analysisId,
    datasetId: bundle.datasetId,
    datasetVersion: bundle.datasetVersion,
    request: {
      datasetId: bundle.datasetId,
      datasetVersion: bundle.datasetVersion,
      measureFieldIds: normalized.measureFieldIds,
      correlationPair: normalized.correlationPair,
      filters: normalized.filters,
    },
    scope,
    results,
    chartData: { histograms, scatter, boxplots },
    issues,
    graph,
  };
}

function buildGraph({ bundle, scope, results, fields, normalized }) {
  const nodes = [];
  const edges = [];
  // 数据集节点由人员1 提供；优先使用其实际节点 ID，找不到时退回约定 ID。
  const datasetNode = Array.isArray(bundle.graph?.nodes)
    ? bundle.graph.nodes.find((node) => node?.type === 'dataset')
    : null;
  const datasetNodeId = datasetNode?.id ?? `dataset:${bundle.datasetId}`;
  const indicatorIds = new Set(normalized.measureFieldIds);
  if (normalized.correlationPair) for (const fieldId of normalized.correlationPair) indicatorIds.add(fieldId);
  const indicatorNodeIds = new Map();
  for (const fieldId of indicatorIds) {
    const field = fields.get(fieldId);
    const existing = bundle.graph?.nodes?.find((node) => node.type === 'indicator' &&
      (node.ref === fieldId || node.ref?.fieldId === fieldId));
    const nodeId = existing?.id ?? `indicator:${fieldId}`;
    indicatorNodeIds.set(fieldId, nodeId);
    nodes.push({
      id: nodeId,
      type: 'indicator',
      label: existing?.label ?? field.label ?? fieldId,
      ref: fieldId,
    });
  }
  nodes.push({ id: scope.scopeId, type: 'scope', label: scope.label, ref: scope.scopeId });
  edges.push({
    id: `selects:${scope.scopeId}`,
    from: scope.scopeId,
    to: datasetNodeId,
    type: 'selects',
  });
  for (const result of results) {
    nodes.push({
      id: `calculation:${result.resultId}`,
      type: 'calculation',
      label: METRIC_LABELS[result.metric] ?? result.metric,
      ref: result.resultId,
    });
    edges.push({
      id: `uses_scope:${result.resultId}`,
      from: `calculation:${result.resultId}`,
      to: scope.scopeId,
      type: 'uses_scope',
    });
    for (const fieldId of result.fieldIds) {
      edges.push({
        id: `uses_indicator:${result.resultId}:${fieldId}`,
        from: `calculation:${result.resultId}`,
        to: indicatorNodeIds.get(fieldId),
        type: 'uses_indicator',
      });
    }
  }
  return { schemaVersion: 1, owner: 'analysis', nodes, edges };
}
