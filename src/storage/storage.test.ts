import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createExampleProject } from "../contracts/example";
import type { SourceFile } from "../contracts";
import {
  bytesToBase64,
  exportProject,
  importProject,
  reparseSource,
  sha256,
} from "./index";
import { createFinancialDisplayProject } from "../../scripts/create-review-projects";

test("项目保存恢复保留ID、原字节、历史时间和选中发现，不触发网络", async () => {
  const project = await createExampleProject();
  const finding = project.insights.find((item) => item.status === "valid");
  assert.ok(finding);
  project.selection.nodeId = `finding:${finding.insightId}`;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("保存恢复不能发起网络请求");
  }) as typeof fetch;
  try {
    const restored = await importProject(await exportProject(project));
    assert.deepEqual(restored, project);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("保持原字节与哈希不变，篡改rawRecords缓存仍被拒绝", async () => {
  const project = await createExampleProject();
  project.datasets[0].sources[0].rawRecords[0][0] += "篡改";
  await assert.rejects(importProject(JSON.stringify(project)), /缓存.*不一致/);
});

test("损坏哈希、未知版本、未知配置属性与非有限数值拒绝恢复或导出", async () => {
  const original = await createExampleProject();
  const changedHash = structuredClone(original);
  changedHash.datasets[0].sources[0].sha256 = "0".repeat(64);
  await assert.rejects(importProject(JSON.stringify(changedHash)), /SHA-256/);
  await assert.rejects(
    importProject(JSON.stringify({ ...original, schemaVersion: 2 })),
    /schemaVersion/,
  );
  await assert.rejects(
    exportProject({
      ...original,
      apiKey: "test-only-never-real",
    } as typeof original),
    /未约定字段/,
  );
  const nonFinite = structuredClone(original);
  nonFinite.analyses[0].results[0].value = Infinity;
  await assert.rejects(exportProject(nonFinite), /有限数值/);
});

test("悬空来源、错误数据版本、错误选择与不存在结果引用被拒绝", async () => {
  const original = await createExampleProject();
  const damagedRef = structuredClone(original);
  const refs = Object.values(damagedRef.datasets[0].records[0].provenance).find(
    (value) => value.length,
  )!;
  refs[0].recordIndex = 999999;
  await assert.rejects(
    importProject(JSON.stringify(damagedRef)),
    /原始文件.*不存在/,
  );
  const wrongVersion = structuredClone(original);
  wrongVersion.analyses[0].datasetVersion += "-wrong";
  await assert.rejects(importProject(JSON.stringify(wrongVersion)), /数据版本/);
  const wrongNode = structuredClone(original);
  wrongNode.selection.nodeId = "finding:does-not-exist";
  await assert.rejects(importProject(JSON.stringify(wrongNode)), /引用不存在/);
  const wrongInsight = structuredClone(original);
  wrongInsight.insights[0].resultRefs = ["missing-result"];
  await assert.rejects(importProject(JSON.stringify(wrongInsight)));
});

test("CSV重解析支持引号内换行、空记录和前导零，来源记录不重编号", async () => {
  const bytes = new Uint8Array(
    await readFile(
      new URL("../../acceptance/fixtures/csv_quoted.csv", import.meta.url),
    ),
  );
  const source: SourceFile = {
    sourceId: "source:quoted",
    originalFileName: "csv_quoted.csv",
    sha256: await sha256(bytes),
    encoding: "utf-8",
    parseOptions: {
      delimiter: ",",
      quoteChar: '"',
      escapeChar: '"',
      skipEmptyLines: false,
    },
    headers: [],
    rawRecords: [],
    rawBytesBase64: bytesToBase64(bytes),
  };
  const parsed = await reparseSource(source);
  assert.equal(parsed.rawRecords.length, 4);
  assert.deepEqual(parsed.rawRecords[1], [""]);
  assert.equal(parsed.rawRecords[2][0], "000002");
  assert.equal(
    parsed.rawRecords[2][1].replaceAll("\r\n", "\n"),
    "第一行\n第二行",
  );
  assert.equal(parsed.rawRecords[3][1], '含"引号"');
});

test("58份真实CSV的恢复解析与manifest表头、记录数、原字节哈希一致", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../data/manifest.json", import.meta.url),
      "utf8",
    ),
  ) as {
    files: {
      relativePath: string;
      sha256: string;
      encoding: string;
      columns: string[];
      parsedRecordCount: number;
    }[];
  };
  assert.equal(manifest.files.length, 58);
  for (const entry of manifest.files) {
    const bytes = new Uint8Array(
      await readFile(new URL(`../../${entry.relativePath}`, import.meta.url)),
    );
    const parsed = await reparseSource({
      sourceId: `source:${entry.sha256}`,
      originalFileName: entry.relativePath.split("/").at(-1)!,
      sha256: entry.sha256,
      encoding: entry.encoding,
      parseOptions: {
        delimiter: ",",
        quoteChar: '"',
        escapeChar: '"',
        skipEmptyLines: false,
      },
      headers: entry.columns,
      rawRecords: [],
      rawBytesBase64: bytesToBase64(bytes),
    });
    assert.deepEqual(parsed.headers, entry.columns, entry.relativePath);
    assert.equal(
      parsed.rawRecords.length,
      entry.parsedRecordCount,
      entry.relativePath,
    );
  }
});

test("完整FY2025财务原文展示夹具保存恢复，11525条记录及来源位置保持不变", async (context) => {
  const project = await createFinancialDisplayProject();
  const original = project.datasets[0];
  assert.equal(original.records.length, 11525);
  assert.equal(original.graph.nodes.length, 2);
  assert.equal(project.analyses.length, 0);
  assert.ok(
    original.fields.every(
      (field) =>
        field.valueType === "string" && field.analysisPolicy === "excluded",
    ),
  );
  const started = performance.now();
  const serialized = await exportProject(project);
  const exported = performance.now();
  const restored = await importProject(serialized);
  const finished = performance.now();
  const result = restored.datasets[0];
  assert.equal(result.records.length, 11525);
  assert.equal(
    result.sources[0].rawBytesBase64,
    original.sources[0].rawBytesBase64,
  );
  assert.deepEqual(result.records, original.records);
  for (const index of [0, 5762, 11524]) {
    const record = result.records[index];
    for (const [columnIndex, field] of result.fields.entries()) {
      assert.deepEqual(record.provenance[field.fieldId], [
        {
          sourceId: result.sources[0].sourceId,
          recordIndex: index + 1,
          columnIndex,
        },
      ]);
      assert.equal(
        record.values[field.fieldId],
        result.sources[0].rawRecords[index][columnIndex],
      );
    }
  }
  context.diagnostic(
    `财务展示夹具仅验证保存恢复：导出 ${Math.round(exported - started)} ms，恢复 ${Math.round(finished - exported)} ms，JSON ${(new TextEncoder().encode(serialized).length / 1024 / 1024).toFixed(1)} MiB；不设硬耗时阈值。`,
  );
});
