import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test, { before } from "node:test";
import type { DatasetBundle, ProjectSnapshot } from "../../contracts";
import { importFiles, getDefaultRequest } from "../index.ts";
import { importFiles as importBytes } from "../importFiles.ts";

const root = resolve(process.cwd());
const appRoot = process.env.T3_APP_ROOT ?? root;
let validateProject: typeof import("../../storage/index.ts").validateProject;
let getRecordEvidence: typeof import("../../graph/index.ts").getRecordEvidence;
const manifest = JSON.parse(
  readFileSync(resolve(root, "data/manifest.json"), "utf8"),
);
const tokens = [
  "income__全体居民",
  "expend__全体居民",
  "FY2025",
  "GASGOO_rank_firm_202608",
  "CPCA_total_狭义乘用车_零售",
  "CPCA_fuel_销量占比_ICE_NEV",
  "CPCA_manrank_狭义乘用车_单月",
];
const input = (manifest.files as { relativePath: string }[])
  .filter((item) => tokens.some((token) => item.relativePath.includes(token)))
  .map((item) => ({
    name: item.relativePath.split("/").at(-1)!,
    bytes: new Uint8Array(readFileSync(resolve(root, item.relativePath))),
  }));
let bundles: DatasetBundle[];
let project: ProjectSnapshot;
before(async () => {
  ({ validateProject } = await import(
    pathToFileURL(resolve(appRoot, "src/storage/index.ts")).href
  ));
  ({ getRecordEvidence } = await import(
    pathToFileURL(resolve(appRoot, "src/graph/index.ts")).href
  ));
  bundles = await importFiles(
    input.map((file) => new File([file.bytes], file.name)),
  );
  project = {
    schemaVersion: 1,
    projectId: "data-wrapper-check",
    createdAt: "2026-10-25T07:55:00Z",
    savedAt: "2026-10-25T07:55:00Z",
    datasets: bundles,
    analyses: [],
    insights: [],
    selection: {
      datasetId: null,
      analysisId: null,
      measureFieldIds: [],
      nodeId: null,
    },
  };
});

test("File[] 三域及三类 CPCA 输出通过人员3真实项目校验", async () => {
  assert.equal(bundles.length, 6);
  await validateProject(project);
  for (const bundle of bundles) {
    for (const source of bundle.sources) {
      assert.ok(source.originalFileName);
      assert.equal("originalName" in source || "byteLength" in source, false);
      assert.deepEqual(source.parseOptions, {
        delimiter: ",",
        quoteChar: '"',
        escapeChar: '"',
        skipEmptyLines: false,
      });
    }
    for (const field of bundle.fields)
      assert.equal(typeof field.unit, "string");
    for (const transform of bundle.transformations) {
      assert.equal("affectedFields" in transform, false);
      assert.ok(Number.isInteger(transform.affectedCount));
      assert.ok(
        transform.fieldIds.every((id) =>
          bundle.fields.some((field) => field.fieldId === id),
        ),
      );
    }
  }
});

test("包装保留旧适配器来源、规范记录、字段身份、版本和原字节", async () => {
  const original = await importBytes(input);
  for (const bundle of bundles) {
    const before = original.find(
      (item) => item.datasetId === bundle.datasetId,
    )!;
    assert.equal(bundle.datasetVersion, before.datasetVersion);
    assert.deepEqual(bundle.records, before.records);
    assert.deepEqual(
      bundle.fields.map((field) => field.fieldId),
      before.fields.map((field) => field.fieldId),
    );
    assert.deepEqual(
      bundle.sources.map((source) => [
        source.sourceId,
        source.sha256,
        source.rawBytesBase64,
      ]),
      before.sources.map((source) => [
        source.sourceId,
        source.sha256,
        source.rawBytesBase64,
      ]),
    );
    assert.deepEqual(
      bundle.graph.nodes.map((node) => node.id),
      before.graph.nodes.map((node) => node.id),
    );
  }
});

test("默认范围和相关对使用真实字段，错误环比始终禁用", () => {
  const requests = new Map(
    bundles.map((bundle) => [bundle.datasetId, getDefaultRequest(bundle)]),
  );
  assert.deepEqual(requests.get("ds:d1-resident-income-expenditure")?.filters, [
    { fieldId: "year", operator: "eq", values: [2024] },
  ]);
  assert.deepEqual(
    requests.get("ds:d1-resident-income-expenditure")?.correlationPair,
    ["income_all", "expend_all"],
  );
  assert.deepEqual(requests.get("ds:d2-listed-company-finance")?.filters, [
    { fieldId: "report_period", operator: "eq", values: ["FY2025"] },
  ]);
  assert.deepEqual(
    requests.get("ds:d2-listed-company-finance")?.correlationPair,
    ["revenue", "net_profit"],
  );
  assert.deepEqual(requests.get("ds:d3-gasgoo-firm-monthly")?.filters, [
    { fieldId: "year_month", operator: "eq", values: ["2026-08"] },
  ]);
  assert.deepEqual(requests.get("ds:d3-gasgoo-firm-monthly")?.correlationPair, [
    "month_sales",
    "yoy",
  ]);
  assert.deepEqual(requests.get("ds:d3-cpca-total-monthly")?.filters, [
    { fieldId: "year", operator: "eq", values: [2026] },
  ]);
  assert.deepEqual(requests.get("ds:d3-cpca-share-monthly")?.filters, []);
  const finance = bundles.find((bundle) => bundle.domain === "D2")!;
  assert.equal(finance.records.length, 5228);
  assert.ok(
    finance.records.every((record) =>
      /^(?:60|00|30|68)\d{4}$/.test(String(record.values.code)),
    ),
  );
  assert.equal(
    finance.transformations.find((transform) => transform.type === "filter")
      ?.affectedCount,
    6297,
  );
  const ranking = bundles.find(
    (bundle) => bundle.adapterType === "gasgoo-ranking",
  )!;
  assert.equal(
    ranking.fields.find((field) => field.fieldId === "mom")?.analysisPolicy,
    "excluded",
  );
});

test("三域逐域经人员3回源函数定位原文件、数据记录及列", () => {
  const cases = [
    {
      id: "ds:d1-resident-income-expenditure",
      field: "income_all",
      raw: "85415",
      row: 1,
      col: 1,
      select: (values: Record<string, unknown>) =>
        values.region === "北京市" && values.year === 2024,
    },
    {
      id: "ds:d2-listed-company-finance",
      field: "revenue",
      raw: "131442000000.0",
      row: 11211,
      col: 4,
      select: (values: Record<string, unknown>) => values.code === "000001",
    },
    {
      id: "ds:d3-gasgoo-firm-monthly",
      field: "month_sales",
      raw: "432684",
      row: 1,
      col: 1,
      select: (values: Record<string, unknown>) =>
        values.vendor === "比亚迪汽车" && values.year_month === "2026-08",
    },
  ];
  for (const item of cases) {
    const bundle = bundles.find(
      (candidate) => candidate.datasetId === item.id,
    )!;
    const record = bundle.records.find((candidate) =>
      item.select(candidate.values),
    )!;
    const evidence = getRecordEvidence(
      project,
      bundle.datasetId,
      [record.recordId],
      [item.field],
    );
    const source = evidence.records[0].cells[0].sources[0];
    assert.equal(source.rawValue, item.raw);
    assert.equal(source.recordIndex, item.row);
    assert.equal(source.columnIndex, item.col);
    assert.ok(source.fileName.endsWith(".csv"));
  }
});

test("通用 CSV 保留前导零、跨行及空记录，字段确认使用共享 options", async () => {
  for (const name of [
    "leading_zero.csv",
    "csv_quoted.csv",
    "all_missing.csv",
  ]) {
    const bytes = readFileSync(resolve(root, "acceptance/fixtures", name));
    const options =
      name === "all_missing.csv"
        ? { fieldRoles: { col1: "measure" as const }, units: { col1: "" } }
        : {};
    const [bundle] = await importFiles([new File([bytes], name)], options);
    await validateProject({ ...project, datasets: [bundle] });
    assert.ok(
      bundle.fields.every((field) => field.definitionStatus === "unknown"),
    );
    if (name === "leading_zero.csv")
      assert.equal(bundle.records[0].values.col0, "000001");
    if (name === "csv_quoted.csv") {
      assert.equal(bundle.sources[0].rawRecords.length, 4);
      assert.equal(bundle.records[2].provenance.col1[0].recordIndex, 3);
    }
    if (name === "all_missing.csv") {
      assert.equal(bundle.fields[1].role, "measure");
      assert.ok(bundle.records.every((record) => record.values.col1 === null));
    }
  }
});
