import test from "node:test";
import assert from "node:assert/strict";
import { createExampleProject } from "../contracts/example";
import type { InsightRequest } from "../contracts";
import { requestInsights } from "./api";

test("AI客户端只发送当前计算投影和口径，不发送原始记录、字节或密钥", async (context) => {
  const sample = await createExampleProject();
  const bundle = sample.datasets[0],
    analysis = sample.analyses[0];
  const controller = new AbortController();
  let payload: InsightRequest | undefined;
  const mockedFetch = context.mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(url, "/api/insights");
      assert.equal(init?.method, "POST");
      assert.deepEqual(init?.headers, { "Content-Type": "application/json" });
      assert.ok(init?.signal instanceof AbortSignal);
      payload = JSON.parse(String(init?.body)) as InsightRequest;
      return Response.json({
        analysisId: analysis.analysisId,
        requestId: "test-only-request",
      });
    },
  );
  const response = await requestInsights(bundle, analysis, controller.signal);
  assert.equal(response.analysisId, analysis.analysisId);
  assert.equal(mockedFetch.mock.callCount(), 1);
  assert.ok(payload);
  assert.deepEqual(Object.keys(payload).sort(), [
    "analysisId",
    "context",
    "facts",
  ]);
  assert.deepEqual(payload.context.scope.recordIds, []);
  assert.equal(
    payload.facts[0].sampleSize,
    analysis.results[0].validRecordIds.length,
  );
  assert.deepEqual(
    payload.facts.map((result) => result.resultId),
    analysis.results.map((result) => result.resultId),
  );
  const serialized = JSON.stringify(payload);
  for (const forbidden of [
    "rawRecords",
    "rawBytesBase64",
    "sources",
    "provenance",
    "validRecordIds",
    "excludedRecordIds",
    "DEEPSEEK_API_KEY",
    "apiKey",
    "Authorization",
  ]) {
    assert.equal(serialized.includes(`"${forbidden}"`), false, forbidden);
  }
  assert.equal(serialized.includes(bundle.sources[0].rawBytesBase64), false);
  assert.equal(serialized.includes(analysis.scope.recordIds[0]), false);
});

test("HTTP错误、服务错误和非JSON响应均明确失败，不包装为成功", async (context) => {
  const sample = await createExampleProject();
  const bundle = sample.datasets[0],
    analysis = sample.analyses[0];
  const replies = [
    Response.json({ analysisId: analysis.analysisId }, { status: 503 }),
    Response.json(
      {
        analysisId: analysis.analysisId,
        error: { code: "NO_CREDIT", message: "测试额度错误", retryable: false },
      },
      { status: 402 },
    ),
    new Response("<html>service unavailable</html>", { status: 502 }),
  ];
  context.mock.method(globalThis, "fetch", async () => replies.shift()!);
  const signal = new AbortController().signal;
  await assert.rejects(requestInsights(bundle, analysis, signal), /HTTP 503/);
  await assert.rejects(
    requestInsights(bundle, analysis, signal),
    /测试额度错误/,
  );
  await assert.rejects(requestInsights(bundle, analysis, signal), /有效 JSON/);
});

test("其他分析的响应和网络失败被拒绝，没有自动重试", async (context) => {
  const sample = await createExampleProject();
  const bundle = sample.datasets[0],
    analysis = sample.analyses[0];
  const mockedFetch = context.mock.method(globalThis, "fetch", async () =>
    Response.json({ analysisId: "another-analysis" }),
  );
  const signal = new AbortController().signal;
  await assert.rejects(requestInsights(bundle, analysis, signal), /分析编号/);
  mockedFetch.mock.mockImplementation(async () => {
    throw new TypeError("test-only-network-failure");
  });
  await assert.rejects(
    requestInsights(bundle, analysis, signal),
    /test-only-network-failure/,
  );
  assert.equal(mockedFetch.mock.callCount(), 2);
});
