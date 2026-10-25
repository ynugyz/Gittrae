// Insight 引用校验：只检查“引用是否存在且属于当前分析”，不把引用有效当作文字全对。
// 实时 AI 返回和应用内计算事实都必须经过这里。

const PLACEHOLDER = /\{\{result:([^}]+)\}\}/g;

export function validateInsight(insight, { analysisId, resultIds }) {
  const errors = [];
  if (!insight || typeof insight !== 'object') {
    return { valid: false, errors: [{ code: 'invalid_insight', message: 'Insight 不是对象' }] };
  }
  if (insight.analysisId !== analysisId) {
    errors.push({ code: 'analysis_mismatch', message: 'Insight 的 analysisId 与当前分析不一致' });
  }
  if (typeof insight.textTemplate !== 'string' || insight.textTemplate.trim() === '') {
    errors.push({ code: 'empty_text', message: 'textTemplate 为空' });
  }
  if (!Array.isArray(insight.resultRefs)) {
    errors.push({ code: 'invalid_result_refs', message: 'resultRefs 必须是数组' });
  }
  const known = resultIds instanceof Set ? resultIds : new Set(resultIds ?? []);
  const refs = Array.isArray(insight.resultRefs) ? insight.resultRefs.map(String) : [];
  for (const resultId of refs) {
    if (!known.has(resultId)) {
      errors.push({ code: 'unknown_result', message: `引用了不存在或不属于当前分析的结果：${resultId}` });
    }
  }
  const text = typeof insight.textTemplate === 'string' ? insight.textTemplate : '';
  const used = new Set();
  for (const match of text.matchAll(PLACEHOLDER)) {
    const resultId = match[1];
    used.add(resultId);
    if (!known.has(resultId)) {
      errors.push({ code: 'unknown_result', message: `占位引用了未知结果：${resultId}` });
    }
    if (!refs.includes(resultId)) {
      errors.push({ code: 'missing_ref', message: `占位引用的结果未列入 resultRefs：${resultId}` });
    }
  }
  const leftover = text.replace(PLACEHOLDER, '');
  if (leftover.includes('{{') || leftover.includes('}}')) {
    errors.push({ code: 'malformed_placeholder', message: '存在无法解析的占位符' });
  }
  return { valid: errors.length === 0, errors };
}

export function validateInsights(insights, { analysisId, resultIds }) {
  const list = Array.isArray(insights) ? insights : [];
  const checks = list.map((insight) => validateInsight(insight, { analysisId, resultIds }));
  return {
    valid: checks.length > 0 && checks.every((check) => check.valid),
    checks,
  };
}
