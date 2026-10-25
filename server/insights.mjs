// 本机 DeepSeek 代理：POST /api/insights
// 密钥只从服务端环境变量读取，不写入响应、日志或项目文件。

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { shortHash } from '../src/analysis/ids.mjs';
import { validateInsight } from '../src/analysis/validate.mjs';

export const DEFAULT_BASE_URL = 'https://api.deepseek.com';
export const DEFAULT_MODEL = 'deepseek-flash';

export class ApiError extends Error {
  constructor(code, message, { retryable = false, statusCode = 502 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

export function readConfig(env = process.env) {
  return {
    apiKey: typeof env.DEEPSEEK_API_KEY === 'string' ? env.DEEPSEEK_API_KEY.trim() : '',
    baseUrl: (env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: env.DEEPSEEK_MODEL || DEFAULT_MODEL,
    timeoutMs: Number(env.DEEPSEEK_TIMEOUT_MS || 60000),
    maxTokens: Number(env.DEEPSEEK_MAX_TOKENS || 1200),
  };
}

export function buildMessages({ analysisId, facts, context }) {
  const system = [
    '你是经济数据分析助手。你只解释给定的确定性统计结果，不重新计算、不修改、不编造数字。',
    '严格只输出一个 JSON 对象，不要输出 Markdown 或解释文字。',
    'JSON 结构示例：{"insights":[{"textTemplate":"字段「示例」的均值为 {{result:analysis:demo:mean:demoField}}。","resultRefs":["analysis:demo:mean:demoField"]}]}',
    '要求：',
    '1. 占位符 {{result:...}} 的花括号内必须逐字复制输入 facts 中某个 resultId 的完整字符串，不能写成 resultId 字面量。',
    '2. resultRefs 必须与占位符一一对应，且只能引用输入 facts 中出现的 resultId；不存在或跨分析的引用会被判为无效。',
    '3. 不要在 textTemplate 中直接写任何数值（包括样本量）；所有数值只能用占位符引用计算结果，样本量由界面单独展示。',
    '4. 输出 1 到 4 条简短解读；区分事实与推测，明确相关不等于因果。',
    '5. 不补造外部事实，不给买卖建议，不把榜单样本当作全部市场。',
    '6. 只输出 json。',
  ].join('\n');
  const resultIds = facts.map((fact) => fact.resultId);
  const user = JSON.stringify({
    analysisId,
    resultIds,
    facts,
    context: context ?? {},
  });
  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `以下是当前分析的确定性结果。可引用 resultId（必须逐字复制到 {{result:...}} 中）：\n${resultIds.join(
        '\n',
      )}\n请输出 json：\n${user}`,
    },
  ];
}

function normalizeFacts(facts) {
  if (!Array.isArray(facts) || facts.length === 0) {
    throw new ApiError('invalid_facts', 'facts 必须是非空数组', { retryable: false, statusCode: 400 });
  }
  const normalized = facts.map((fact) => {
    if (!fact || typeof fact.resultId !== 'string' || fact.resultId.trim() === '') {
      throw new ApiError('invalid_facts', '每条 fact 必须包含 resultId', { retryable: false, statusCode: 400 });
    }
    return {
      resultId: fact.resultId,
      metric: fact.metric ?? null,
      value: fact.value ?? null,
      unit: fact.unit ?? '',
      method: fact.method ?? null,
      validCount: Number.isFinite(fact.validCount) ? fact.validCount : null,
    };
  });
  return normalized;
}

function parseModelContent(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ApiError('invalid_json', '模型返回内容不是合法 JSON', { retryable: true, statusCode: 502 });
  }
  if (!parsed || !Array.isArray(parsed.insights)) {
    throw new ApiError('invalid_payload', '模型 JSON 缺少 insights 数组', { retryable: true, statusCode: 502 });
  }
  return parsed.insights;
}

function buildFindingGraph(insights) {
  const nodes = [];
  const edges = [];
  for (const insight of insights) {
    if (insight.status !== 'valid') continue;
    nodes.push({
      id: `finding:${insight.insightId}`,
      type: 'finding',
      label: insight.textTemplate.replace(/\{\{result:[^}]+\}\}/g, '数值'),
      ref: { insightId: insight.insightId },
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
  return { schemaVersion: 1, owner: 'insight', nodes, edges };
}

/**
 * 调用真实 DeepSeek 官方 API，返回带引用校验的 Insight。
 * 失败必须抛出 ApiError；空 content 会按官方提示重试一次后仍失败。
 */
export async function requestDeepSeekInsights(
  { analysisId, facts, context },
  { config = readConfig(), fetchImpl = globalThis.fetch, logger = console } = {},
) {
  if (!config.apiKey) {
    throw new ApiError('missing_api_key', '未配置 DEEPSEEK_API_KEY', { retryable: false, statusCode: 503 });
  }
  if (typeof analysisId !== 'string' || analysisId.trim() === '') {
    throw new ApiError('invalid_analysis_id', 'analysisId 缺失', { retryable: false, statusCode: 400 });
  }
  const normalizedFacts = normalizeFacts(facts);
  const resultIds = new Set(normalizedFacts.map((fact) => fact.resultId));
  const messages = buildMessages({ analysisId, facts: normalizedFacts, context });
  const requestId = randomUUID();
  const startedAt = Date.now();

  let lastEmpty = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    let payload;
    try {
      const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          response_format: { type: 'json_object' },
          max_tokens: config.maxTokens,
          stream: false,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const status = response.status;
        throw new ApiError(
          `upstream_http_${status}`,
          `DeepSeek 返回 HTTP ${status}`,
          { retryable: status === 429 || status >= 500, statusCode: 502 },
        );
      }
      payload = await response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error?.name === 'AbortError') {
        throw new ApiError('timeout', `请求超过 ${config.timeoutMs}ms`, { retryable: true, statusCode: 504 });
      }
      throw new ApiError('network_error', '无法连接 DeepSeek 服务', { retryable: true, statusCode: 502 });
    } finally {
      clearTimeout(timer);
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      lastEmpty = true;
      if (attempt === 0) {
        logger.warn?.('[insights] 模型返回空 content，按官方说明重试一次');
        continue;
      }
      throw new ApiError('empty_content', '模型返回空内容', { retryable: true, statusCode: 502 });
    }

    const generatedAt = new Date().toISOString();
    const model = payload?.model || config.model;
    const rawInsights = parseModelContent(content);
    const insights = rawInsights.map((item, index) => {
      const textTemplate = typeof item?.textTemplate === 'string' ? item.textTemplate : '';
      const resultRefs = Array.isArray(item?.resultRefs) ? item.resultRefs.map(String) : [];
      const insight = {
        insightId: `insight:${shortHash(`${analysisId}|live_ai|${requestId}|${index}|${textTemplate}`)}`,
        analysisId,
        kind: 'interpretation',
        origin: 'live_ai',
        textTemplate,
        resultRefs,
        generatedAt,
        model,
        status: 'valid',
      };
      const check = validateInsight(insight, { analysisId, resultIds });
      if (!check.valid) {
        insight.status = 'invalid';
        insight.validationErrors = check.errors;
      }
      return insight;
    });

    logger.info?.(
      JSON.stringify({
        event: 'deepseek_insight',
        requestId,
        analysisId,
        model,
        status: 'ok',
        insightCount: insights.length,
        invalidCount: insights.filter((insight) => insight.status !== 'valid').length,
        durationMs: Date.now() - startedAt,
        emptyRetried: lastEmpty,
      }),
    );

    return {
      analysisId,
      requestId,
      insights,
      graph: buildFindingGraph(insights),
      model,
      generatedAt,
    };
  }

  throw new ApiError('empty_content', '模型返回空内容', { retryable: true, statusCode: 502 });
}

function sendJson(res, statusCode, body) {
  const text = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  });
  res.end(text);
}

function readBody(req, limitBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new ApiError('body_too_large', '请求体超过 1MB', { retryable: false, statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => reject(new ApiError('read_body_failed', '读取请求体失败', { retryable: false, statusCode: 400 })));
  });
}

export function createInsightsServer({ env = process.env, fetchImpl = globalThis.fetch, logger = console } = {}) {
  const config = readConfig(env);

  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/api/health') {
      let host = '';
      try {
        host = new URL(config.baseUrl).host;
      } catch {
        host = '';
      }
      sendJson(res, 200, {
        ok: true,
        model: config.model,
        baseUrlHost: host,
        keyConfigured: Boolean(config.apiKey),
        timeoutMs: config.timeoutMs,
      });
      return;
    }
    if (req.method !== 'POST' || url.pathname !== '/api/insights') {
      sendJson(res, 404, { error: { code: 'not_found', message: '未找到接口', retryable: false } });
      return;
    }

    let body;
    try {
      const text = await readBody(req);
      body = JSON.parse(text);
    } catch (error) {
      if (error instanceof ApiError) {
        sendJson(res, error.statusCode, { error: { code: error.code, message: error.message, retryable: false } });
        return;
      }
      sendJson(res, 400, { error: { code: 'invalid_json_body', message: '请求体不是合法 JSON', retryable: false } });
      return;
    }

    const analysisId = body?.analysisId;
    try {
      const result = await requestDeepSeekInsights(
        { analysisId, facts: body?.facts, context: body?.context },
        { config, fetchImpl, logger },
      );
      sendJson(res, 200, result);
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError('internal_error', '服务内部错误', { retryable: true, statusCode: 500 });
      logger.error?.(
        JSON.stringify({
          event: 'deepseek_insight',
          analysisId: typeof analysisId === 'string' ? analysisId : null,
          status: 'error',
          code: apiError.code,
          retryable: apiError.retryable,
          message: apiError.message,
        }),
      );
      sendJson(res, apiError.statusCode, {
        analysisId: typeof analysisId === 'string' ? analysisId : null,
        error: { code: apiError.code, message: apiError.message, retryable: apiError.retryable },
      });
    }
  });
}
