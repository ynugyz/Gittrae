// 真实 API 探通脚本：只打印脱敏结果，不打印密钥与完整响应正文。
import { requestDeepSeekInsights, readConfig } from './insights.mjs';

const config = readConfig();
if (!config.apiKey) {
  console.error('缺少 DEEPSEEK_API_KEY');
  process.exit(2);
}

const facts = [
  {
    resultId: 'analysis:probe:mean:x',
    metric: 'mean',
    value: 2,
    unit: '',
    method: 'arithmetic_mean',
    validCount: 3,
  },
];

const startedAt = Date.now();
try {
  const result = await requestDeepSeekInsights(
    {
      analysisId: 'analysis:probe',
      facts,
      context: {
        domain: 'generic',
        fieldMeanings: { x: '手算样例字段，取值 1、2、3' },
        limitations: ['相关不等于因果'],
      },
    },
    { config, logger: { info() {}, warn() {}, error() {} } },
  );
  const valid = result.insights.filter((insight) => insight.status === 'valid');
  console.log(
    JSON.stringify(
      {
        ok: true,
        requestId: result.requestId,
        model: result.model,
        insightCount: result.insights.length,
        invalidCount: result.insights.length - valid.length,
        durationMs: Date.now() - startedAt,
      },
      null,
      2,
    ),
  );
  for (const insight of valid) console.log(`- ${insight.textTemplate}`);
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        code: error.code ?? 'unknown',
        message: error.message,
        retryable: Boolean(error.retryable),
        durationMs: Date.now() - startedAt,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
