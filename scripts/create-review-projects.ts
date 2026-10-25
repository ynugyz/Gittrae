import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import type {
  DatasetBundle,
  ProjectSnapshot,
  SourceFile,
} from "../src/contracts";
import { createExampleProject } from "../src/contracts/example";
import {
  bytesToBase64,
  exportProject,
  reparseSource,
  sha256,
} from "../src/storage";

const generatedAt = "2026-10-25T00:00:00.000Z";
const parseOptions: SourceFile["parseOptions"] = {
  delimiter: ",",
  quoteChar: '"',
  escapeChar: '"',
  skipEmptyLines: false,
};
function wrap(bundle: DatasetBundle, name: string): ProjectSnapshot {
  return {
    schemaVersion: 1,
    projectId: `review:${name}`,
    createdAt: generatedAt,
    savedAt: generatedAt,
    datasets: [bundle],
    analyses: [],
    insights: [],
    selection: {
      datasetId: bundle.datasetId,
      analysisId: null,
      measureFieldIds: [],
      nodeId: null,
    },
  };
}

/** 财务原文展示压力夹具，所有单元格仍是字符串，没有业务清洗、财务适配或计算。 */
export async function createFinancialDisplayProject(): Promise<ProjectSnapshot> {
  const manifest = JSON.parse(
    await readFile(new URL("../data/manifest.json", import.meta.url), "utf8"),
  ) as {
    files: {
      relativePath: string;
      sha256: string;
      encoding: string;
      columns: string[];
      parsedRecordCount: number;
    }[];
  };
  const entry = manifest.files.find((file) =>
    file.relativePath.includes("FY2025"),
  );
  if (!entry) throw new Error("manifest 缺少 FY2025 原始财务文件");
  const bytes = new Uint8Array(
    await readFile(new URL(`../${entry.relativePath}`, import.meta.url)),
  );
  const sourceId = `source:${entry.sha256}`;
  const source: SourceFile = {
    sourceId,
    originalFileName: entry.relativePath.split("/").at(-1)!,
    sha256: entry.sha256,
    encoding: entry.encoding,
    parseOptions,
    headers: entry.columns,
    rawRecords: [],
    rawBytesBase64: bytesToBase64(bytes),
  };
  Object.assign(source, await reparseSource(source));
  if (source.rawRecords.length !== entry.parsedRecordCount)
    throw new Error("压力夹具原始记录数与 manifest 不符");
  const datasetId = "review:financial-display";
  const fields: DatasetBundle["fields"] = source.headers.map(
    (label, index) => ({
      fieldId: `review:f${index}`,
      label,
      role: "identifier",
      valueType: "string",
      unit: "",
      meaning:
        "未经适配的原始字符串展示压力样例；此角色设置仅用于测试页面和来源定位。",
      definitionStatus: "unknown",
      analysisPolicy: "excluded",
      exclusionReason: "展示压力样例未经财务适配，禁止用于统计或 AI 结论",
    }),
  );
  return wrap(
    {
      schemaVersion: 1,
      datasetId,
      datasetVersion: `review:display:v1:${entry.sha256}`,
      domain: "D2",
      adapterType: "generic-csv",
      adapterVersion: "mock:display",
      sources: [source],
      fields,
      records: source.rawRecords.map((row, index) => ({
        recordId: `review:r${index + 1}`,
        values: Object.fromEntries(
          fields.map((field, column) => [field.fieldId, row[column] ?? null]),
        ),
        provenance: Object.fromEntries(
          fields.map((field, column) => [
            field.fieldId,
            column < row.length
              ? [{ sourceId, recordIndex: index + 1, columnIndex: column }]
              : [],
          ]),
        ),
      })),
      transformations: [],
      issues: [
        {
          code: "MOCK",
          severity: "warning",
          message:
            "完整 FY2025 原文展示压力样例：仅核验分页、原文回查与保存恢复；全部字段保留字符串并禁用统计，不代表财务适配、计算或真实 AI 已完成。",
        },
      ],
      graph: {
        schemaVersion: 1,
        owner: "data",
        nodes: [
          {
            id: datasetId,
            type: "dataset",
            label: "FY2025 原文展示压力样例",
            ref: datasetId,
          },
          {
            id: sourceId,
            type: "source",
            label: source.originalFileName,
            ref: sourceId,
          },
        ],
        edges: [
          {
            id: "review:financial-display:source",
            from: datasetId,
            to: sourceId,
            type: "derived_from",
          },
        ],
      },
    },
    "financial-display",
  );
}

/** 三指标纯构造夹具，无预存分析，专门回归指标选择和相关性选择器。 */
export async function createThreeMeasureProject(): Promise<ProjectSnapshot> {
  const bytes = new TextEncoder().encode(
    "\uFEFFid,x,y,z\na,1,2,3\nb,2,4,6\nc,3,6,9\n",
  );
  const hash = await sha256(bytes),
    sourceId = `source:${hash}`,
    datasetId = "review:three-measures";
  const source: SourceFile = {
    sourceId,
    originalFileName: "三指标选择联调样例.csv",
    sha256: hash,
    encoding: "utf-8-sig",
    parseOptions,
    headers: ["id", "x", "y", "z"],
    rawRecords: [
      ["a", "1", "2", "3"],
      ["b", "2", "4", "6"],
      ["c", "3", "6", "9"],
    ],
    rawBytesBase64: bytesToBase64(bytes),
  };
  const fields: DatasetBundle["fields"] = [
    {
      fieldId: "review:id",
      label: "记录",
      role: "identifier",
      valueType: "string",
      unit: "",
      meaning: "团队构造样例记录",
      definitionStatus: "confirmed",
      analysisPolicy: "excluded",
      exclusionReason: "记录标识不可计算",
    },
    ...["x", "y", "z"].map((letter) => ({
      fieldId: `review:${letter}`,
      label: `测试指标 ${letter.toUpperCase()}`,
      role: "measure" as const,
      valueType: "number" as const,
      unit: "示例单位",
      meaning: "固定构造的三指标选择夹具，无统计结果",
      definitionStatus: "confirmed" as const,
      analysisPolicy: "allowed" as const,
    })),
  ];
  const values = [
    { "review:id": "a", "review:x": 1, "review:y": 2, "review:z": 3 },
    { "review:id": "b", "review:x": 2, "review:y": 4, "review:z": 6 },
    { "review:id": "c", "review:x": 3, "review:y": 6, "review:z": 9 },
  ];
  return wrap(
    {
      schemaVersion: 1,
      datasetId,
      datasetVersion: `mock:three-measures:${hash}`,
      domain: "generic",
      adapterType: "generic-csv",
      adapterVersion: "mock:1",
      sources: [source],
      fields,
      records: values.map((value, index) => ({
        recordId: `review:selection:r${index + 1}`,
        values: value,
        provenance: Object.fromEntries(
          fields.map((field, columnIndex) => [
            field.fieldId,
            [{ sourceId, recordIndex: index + 1, columnIndex }],
          ]),
        ),
      })),
      transformations: [],
      issues: [
        {
          code: "MOCK",
          severity: "warning",
          message:
            "三指标选择联调样例：全部数值为团队构造，仅测试选择控件，不代表业务适配、统计或真实 AI。",
        },
      ],
      graph: {
        schemaVersion: 1,
        owner: "data",
        nodes: [
          {
            id: datasetId,
            type: "dataset",
            label: "三指标选择样例",
            ref: datasetId,
          },
          {
            id: sourceId,
            type: "source",
            label: source.originalFileName,
            ref: sourceId,
          },
          ...fields
            .filter((field) => field.role === "measure")
            .map((field) => ({
              id: `indicator:${field.fieldId}`,
              type: "indicator" as const,
              label: field.label,
              ref: field.fieldId,
            })),
        ],
        edges: [
          {
            id: "review:three-measures:source",
            from: datasetId,
            to: sourceId,
            type: "derived_from",
          },
          ...fields
            .filter((field) => field.role === "measure")
            .map((field) => ({
              id: `contains:${field.fieldId}`,
              from: datasetId,
              to: `indicator:${field.fieldId}`,
              type: "contains" as const,
            })),
        ],
      },
    },
    "three-measures",
  );
}

async function main(): Promise<void> {
  const output = new URL("../local/", import.meta.url);
  await mkdir(output, { recursive: true });
  for (const [name, make] of [
    ["financial-display", createFinancialDisplayProject],
    ["example", createExampleProject],
    ["three-measures", createThreeMeasureProject],
  ] as const) {
    const started = performance.now();
    const project = await make();
    const json = await exportProject(project);
    await writeFile(new URL(`${name}.t3project.json`, output), json, "utf8");
    console.log(
      `${name}：${project.datasets[0].records.length} 条，${new TextEncoder().encode(json).length} 字节，${Math.round(performance.now() - started)} ms`,
    );
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
