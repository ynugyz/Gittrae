import Papa from "papaparse";
import type {
  DatasetBundle,
  ProjectSnapshot,
  SourceFile,
  SourceRef,
} from "../contracts";
import { currentGraph, rebuildGraph } from "../graph";

type Check = (value: unknown, path: string) => void;
const fail = (path: string, message: string): never => {
  throw new Error(`项目文件 ${path}：${message}`);
};
const text: Check = (value, path) => {
  if (typeof value !== "string") fail(path, "必须是文本");
};
const id: Check = (value, path) => {
  text(value, path);
  if (!(value as string).trim()) fail(path, "编号不能为空");
};
const number: Check = (value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value))
    fail(path, "必须是有限数值");
};
const integer: Check = (value, path) => {
  number(value, path);
  if (!Number.isInteger(value) || (value as number) < 0)
    fail(path, "必须是非负整数");
};
const scalar: Check = (value, path) => {
  if (value !== null && typeof value !== "string") number(value, path);
};
const oneOf =
  (...values: unknown[]): Check =>
  (value, path) => {
    if (!values.includes(value)) fail(path, "值不在约定范围内");
  };
const nullable =
  (check: Check): Check =>
  (value, path) => {
    if (value !== null) check(value, path);
  };
const list =
  (check: Check): Check =>
  (value, path) => {
    if (!Array.isArray(value)) fail(path, "必须是数组");
    (value as unknown[]).forEach((item, index) =>
      check(item, `${path}[${index}]`),
    );
  };
function plain(value: unknown, path: string): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    fail(path, "必须是普通对象");
  return value as Record<string, unknown>;
}
function object(
  required: Record<string, Check>,
  optional: Record<string, Check> = {},
): Check {
  return (value, path) => {
    const record = plain(value, path);
    for (const key of Object.keys(record))
      if (!Object.hasOwn(required, key) && !Object.hasOwn(optional, key))
        fail(`${path}.${key}`, "存在未约定字段，禁止导出本机配置或密钥");
    for (const [key, check] of Object.entries(required))
      check(record[key], `${path}.${key}`);
    for (const [key, check] of Object.entries(optional))
      if (Object.hasOwn(record, key)) check(record[key], `${path}.${key}`);
  };
}
const dictionary =
  (check: Check): Check =>
  (value, path) => {
    for (const [key, item] of Object.entries(plain(value, path))) {
      if (
        /^(?:__proto__|prototype|constructor|DEEPSEEK_API_KEY|apiKey|authorization|password|secret)$/i.test(
          key,
        )
      )
        fail(path, "包含不允许的配置键");
      check(item, `${path}.${key}`);
    }
  };
const ids = list(id);
const strings = list(text);
const date: Check = (value, path) => {
  text(value, path);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value as string,
    ) ||
    !Number.isFinite(Date.parse(value as string))
  )
    fail(path, "需要有效的 ISO 8601 时间");
};
const sourceRef = object({
  sourceId: id,
  recordIndex: integer,
  columnIndex: integer,
});
const issue = object(
  { code: id, severity: oneOf("info", "warning", "error"), message: text },
  { fieldId: id, recordIds: ids, sourceRefs: list(sourceRef) },
);
const filter = object({
  fieldId: id,
  operator: oneOf("eq", "in"),
  values: list(scalar),
});
const graph = object({
  schemaVersion: oneOf(1),
  owner: oneOf("data", "analysis", "insight"),
  nodes: list(
    object({
      id,
      type: oneOf(
        "source",
        "dataset",
        "indicator",
        "scope",
        "calculation",
        "finding",
      ),
      label: text,
      ref: id,
    }),
  ),
  edges: list(
    object({
      id,
      from: id,
      to: id,
      type: oneOf(
        "derived_from",
        "contains",
        "selects",
        "uses_scope",
        "uses_indicator",
        "cites",
      ),
    }),
  ),
});
const source = object({
  sourceId: id,
  originalFileName: id,
  sha256: id,
  encoding: id,
  parseOptions: object({
    delimiter: id,
    quoteChar: id,
    escapeChar: id,
    skipEmptyLines: oneOf(false),
  }),
  headers: strings,
  rawRecords: list(strings),
  rawBytesBase64: text,
});
const dataset = object({
  schemaVersion: oneOf(1),
  datasetId: id,
  datasetVersion: id,
  domain: oneOf("D1", "D2", "D3", "generic"),
  adapterType: oneOf(
    "nbs-regional-wide",
    "eastmoney-financial",
    "gasgoo-ranking",
    "cpca-table",
    "generic-csv",
  ),
  adapterVersion: id,
  sources: list(source),
  fields: list(
    object(
      {
        fieldId: id,
        label: text,
        role: oneOf("identifier", "dimension", "measure"),
        valueType: oneOf("string", "number"),
        unit: text,
        meaning: text,
        definitionStatus: oneOf("confirmed", "unknown"),
        analysisPolicy: oneOf("allowed", "excluded"),
      },
      { exclusionReason: text },
    ),
  ),
  records: list(
    object({
      recordId: id,
      values: dictionary(scalar),
      provenance: dictionary(list(sourceRef)),
    }),
  ),
  transformations: list(
    object({
      transformId: id,
      type: id,
      inputSourceIds: ids,
      description: text,
      fieldIds: ids,
      affectedCount: integer,
    }),
  ),
  issues: list(issue),
  graph,
});
const request = object({
  datasetId: id,
  datasetVersion: id,
  measureFieldIds: ids,
  correlationPair: nullable(ids),
  filters: list(filter),
});
const analysis = object({
  schemaVersion: oneOf(1),
  analysisId: id,
  datasetId: id,
  datasetVersion: id,
  request,
  scope: object({
    scopeId: id,
    filters: list(filter),
    recordIds: ids,
    label: text,
    limitations: strings,
  }),
  results: list(
    object({
      resultId: id,
      metric: id,
      fieldIds: ids,
      value: nullable(number),
      unit: text,
      method: text,
      parameters: dictionary(scalar),
      validRecordIds: ids,
      excludedRecordIds: ids,
      exclusionReasons: dictionary(text),
    }),
  ),
  chartData: object({
    histograms: list(
      object({
        fieldId: id,
        edges: list(number),
        counts: list(integer),
        binRecordIds: list(ids),
      }),
    ),
    scatter: nullable(
      object({
        xFieldId: id,
        yFieldId: id,
        correlationResultId: id,
        points: list(object({ recordId: id, x: number, y: number })),
      }),
    ),
    boxplots: list(
      object({
        fieldId: id,
        lowResultId: id,
        q1ResultId: id,
        medianResultId: id,
        q3ResultId: id,
        highResultId: id,
        outliers: list(object({ recordId: id, value: number })),
      }),
    ),
  }),
  issues: list(issue),
  graph,
});
const projectCheck = object({
  schemaVersion: oneOf(1),
  projectId: id,
  createdAt: date,
  savedAt: date,
  datasets: list(dataset),
  analyses: list(analysis),
  insights: list(
    object({
      insightId: id,
      analysisId: id,
      kind: oneOf("fact", "interpretation"),
      origin: oneOf("computed", "live_ai"),
      textTemplate: text,
      resultRefs: ids,
      generatedAt: date,
      model: nullable(text),
      status: oneOf("valid", "invalid"),
    }),
  ),
  selection: object({
    datasetId: nullable(id),
    analysisId: nullable(id),
    measureFieldIds: ids,
    nodeId: nullable(id),
  }),
});

/** 与浏览器和 Node 22 共用；不依赖 Node Buffer。 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 16384)
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(binary);
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  const buffer = new Uint8Array(bytes).buffer;
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
function decodeBytes(base64: string): Uint8Array {
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      base64,
    )
  )
    fail("原字节", "Base64 编码损坏");
  try {
    return Uint8Array.from(atob(base64), (character) =>
      character.charCodeAt(0),
    );
  } catch {
    return fail("原字节", "Base64 解码失败");
  }
}

/** 仅重解析原始字节，保留字符串及中间空记录，不承担任何数据适配。 */
export async function reparseSource(
  file: SourceFile,
): Promise<Pick<SourceFile, "headers" | "rawRecords">> {
  source(file, "source");
  if (!/^[a-f0-9]{64}$/.test(file.sha256))
    fail(file.originalFileName, "SHA-256 格式无效");
  if (
    /^(?:[a-z]:|[\\/]|[a-z]+:\/\/)/i.test(file.originalFileName) ||
    file.originalFileName.split(/[\\/]/).includes("..")
  )
    fail("原文件名", "不能包含绝对路径或父目录路径");
  const options = file.parseOptions;
  if (
    options.delimiter.length !== 1 ||
    /[\r\n\uFEFF]/.test(options.delimiter) ||
    options.quoteChar.length !== 1 ||
    options.escapeChar.length !== 1 ||
    options.delimiter === options.quoteChar
  )
    fail(file.originalFileName, "CSV 解析参数无效");
  const bytes = decodeBytes(file.rawBytesBase64);
  if ((await sha256(bytes)) !== file.sha256)
    fail(file.originalFileName, "原始字节与 SHA-256 不一致");
  let csv: string;
  try {
    csv = new TextDecoder(
      file.encoding.toLowerCase() === "utf-8-sig" ? "utf-8" : file.encoding,
      { fatal: true },
    ).decode(bytes);
  } catch {
    return fail(
      file.originalFileName,
      "编码不支持或原始字节无法按保存的编码解码",
    );
  }
  if (!csv.length) fail(file.originalFileName, "原文件没有表头");
  const parsed = Papa.parse<string[]>(csv, {
    ...options,
    header: false,
    dynamicTyping: false,
  });
  if (parsed.errors.length)
    fail(file.originalFileName, `CSV 无法重解析：${parsed.errors[0].message}`);
  // 末尾行终止符不是额外记录；中间及真实尾部空行仍按原位置保留。
  if (
    /[\r\n]$/.test(csv) &&
    parsed.data.at(-1)?.length === 1 &&
    parsed.data.at(-1)?.[0] === ""
  )
    parsed.data.pop();
  return { headers: parsed.data[0], rawRecords: parsed.data.slice(1) };
}

function unique(values: string[], path: string): Set<string> {
  const set = new Set(values);
  if (set.size !== values.length) fail(path, "编号重复");
  return set;
}
function member(value: string, allowed: Set<string>, path: string): void {
  if (!allowed.has(value)) fail(path, `引用不存在：${value}`);
}
function members(values: string[], allowed: Set<string>, path: string): void {
  unique(values, path);
  values.forEach((value) => member(value, allowed, path));
}
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a))
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => same(item, b[index]))
    );
  if (
    !a ||
    !b ||
    typeof a !== "object" ||
    typeof b !== "object" ||
    Array.isArray(b)
  )
    return false;
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every(
      (key) => Object.hasOwn(right, key) && same(left[key], right[key]),
    )
  );
}

function sourceReference(
  ref: SourceRef,
  files: Map<string, SourceFile>,
  path: string,
): void {
  const file = files.get(ref.sourceId);
  if (
    !file ||
    ref.recordIndex < 1 ||
    ref.recordIndex > file.rawRecords.length ||
    ref.columnIndex >= file.headers.length ||
    ref.columnIndex >= file.rawRecords[ref.recordIndex - 1].length
  )
    fail(path, "原始文件、记录序号或列位置不存在");
}
function validateIssues(
  bundle: DatasetBundle,
  issues: DatasetBundle["issues"],
  path: string,
): void {
  const fields = new Set(bundle.fields.map((field) => field.fieldId));
  const records = new Set(bundle.records.map((record) => record.recordId));
  const sources = new Map(bundle.sources.map((file) => [file.sourceId, file]));
  for (const problem of issues) {
    if (problem.fieldId) member(problem.fieldId, fields, path);
    if (problem.recordIds) members(problem.recordIds, records, path);
    if (problem.sourceRefs)
      problem.sourceRefs.forEach((ref) => sourceReference(ref, sources, path));
  }
}

/** 信任边界检查，返回前不会改变当前项目，也不会重算统计或调用模型。 */
export async function validateProject(
  value: unknown,
): Promise<ProjectSnapshot> {
  projectCheck(value, "root");
  const project = value as ProjectSnapshot;
  const datasetIds = unique(
    project.datasets.map((bundle) => bundle.datasetId),
    "datasets",
  );
  const analysisIds = unique(
    project.analyses.map((item) => item.analysisId),
    "analyses",
  );
  unique(
    project.insights.map((item) => item.insightId),
    "insights",
  );
  const sourceRegistry = new Map<string, SourceFile>();
  const hashes = new Map<string, string>();
  for (const bundle of project.datasets) {
    const path = `数据集 ${bundle.datasetId}`;
    const fields = unique(
      bundle.fields.map((field) => field.fieldId),
      path,
    );
    unique(
      bundle.records.map((record) => record.recordId),
      path,
    );
    unique(
      bundle.transformations.map((transform) => transform.transformId),
      path,
    );
    unique(
      bundle.sources.map((file) => file.sourceId),
      path,
    );
    const files = new Map(bundle.sources.map((file) => [file.sourceId, file]));
    for (const file of bundle.sources) {
      const existing = sourceRegistry.get(file.sourceId);
      if (
        existing &&
        !same(
          { ...existing, originalFileName: "" },
          { ...file, originalFileName: "" },
        )
      )
        fail(path, "相同来源编号的内容冲突");
      if (hashes.has(file.sha256) && hashes.get(file.sha256) !== file.sourceId)
        fail(path, "相同原字节必须复用同一来源编号");
      if (!existing) {
        const reparsed = await reparseSource(file);
        if (
          !same(reparsed.headers, file.headers) ||
          !same(reparsed.rawRecords, file.rawRecords)
        )
          fail(
            file.originalFileName,
            "表头或原始记录缓存与原字节重解析结果不一致",
          );
      }
      sourceRegistry.set(file.sourceId, file);
      hashes.set(file.sha256, file.sourceId);
    }
    for (const field of bundle.fields)
      if (field.analysisPolicy === "excluded" && !field.exclusionReason?.trim())
        fail(path, "禁用字段缺少原因");
    for (const record of bundle.records) {
      members(Object.keys(record.values), fields, path);
      members(Object.keys(record.provenance), fields, path);
      if (Object.keys(record.values).length !== fields.size)
        fail(path, "规范记录缺少字段，缺失值应显式保存为 null");
      for (const field of bundle.fields) {
        const cell = record.values[field.fieldId];
        if (cell !== null && typeof cell !== field.valueType)
          fail(path, "单元格值与字段类型不一致");
        const refs = record.provenance[field.fieldId] ?? [];
        refs.forEach((ref) => sourceReference(ref, files, path));
        if (
          cell !== null &&
          !refs.length &&
          !bundle.transformations.some((transform) =>
            transform.fieldIds.includes(field.fieldId),
          )
        )
          fail(path, "非空单元格缺少来源或转换说明");
      }
    }
    for (const transform of bundle.transformations) {
      members(transform.inputSourceIds, new Set(files.keys()), path);
      members(transform.fieldIds, fields, path);
      if (!transform.inputSourceIds.length || !transform.description.trim())
        fail(path, "转换缺少输入或说明");
    }
    if (bundle.graph.owner !== "data") fail(path, "基础图必须由 data 提供");
    validateIssues(bundle, bundle.issues, path);
  }
  const resultIds = new Set<string>();
  for (const item of project.analyses) {
    const path = `分析 ${item.analysisId}`;
    const bundle = project.datasets.find(
      (candidate) => candidate.datasetId === item.datasetId,
    );
    if (
      !bundle ||
      bundle.datasetVersion !== item.datasetVersion ||
      item.request.datasetId !== item.datasetId ||
      item.request.datasetVersion !== item.datasetVersion
    )
      fail(path, "数据集或数据版本不一致");
    const data = bundle!;
    const fields = new Set(data.fields.map((field) => field.fieldId));
    const measures = new Set(
      data.fields
        .filter(
          (field) =>
            field.role === "measure" &&
            field.valueType === "number" &&
            field.analysisPolicy === "allowed",
        )
        .map((field) => field.fieldId),
    );
    const records = new Map(
      data.records.map((record) => [record.recordId, record]),
    );
    members(item.request.measureFieldIds, measures, path);
    if (item.request.correlationPair !== null) {
      if (item.request.correlationPair.length !== 2)
        fail(path, "相关性需要两个指标");
      members(item.request.correlationPair, measures, path);
    }
    for (const condition of [...item.request.filters, ...item.scope.filters]) {
      member(condition.fieldId, fields, path);
      if (!condition.values.length) fail(path, "筛选条件缺少值");
    }
    if (!same(item.request.filters, item.scope.filters))
      fail(path, "分析范围与请求筛选不一致");
    const scope = unique(item.scope.recordIds, path);
    members(item.scope.recordIds, new Set(records.keys()), path);
    // 只核对保存的范围成员，不重新计算统计结果。
    for (const record of data.records) {
      const selected = item.request.filters.every((condition) =>
        condition.values.includes(record.values[condition.fieldId]),
      );
      if (selected !== scope.has(record.recordId))
        fail(path, "分析范围记录与保存的筛选不一致");
    }
    const localResults = unique(
      item.results.map((result) => result.resultId),
      path,
    );
    for (const result of item.results) {
      if (resultIds.has(result.resultId)) fail(path, "不同分析的结果编号重复");
      resultIds.add(result.resultId);
      if (!result.resultId.startsWith(`${item.analysisId}:`))
        fail(path, "结果编号不属于当前分析命名空间");
      members(result.fieldIds, measures, path);
      members(result.validRecordIds, scope, path);
      members(result.excludedRecordIds, scope, path);
      const valid = new Set(result.validRecordIds);
      if (result.excludedRecordIds.some((recordId) => valid.has(recordId)))
        fail(path, "有效与排除记录重叠");
      if (
        result.validRecordIds.length + result.excludedRecordIds.length !==
        scope.size
      )
        fail(path, "统计有效与排除记录没有完整覆盖分析范围");
      members(
        Object.keys(result.exclusionReasons),
        new Set(result.excludedRecordIds),
        path,
      );
      for (const recordId of result.excludedRecordIds)
        if (!result.exclusionReasons[recordId]?.trim())
          fail(path, "排除记录缺少原因");
      for (const recordId of result.validRecordIds)
        if (
          result.fieldIds.some(
            (fieldId) =>
              typeof records.get(recordId)?.values[fieldId] !== "number",
          )
        )
          fail(path, "有效样本包含非数值或缺失值");
    }
    for (const histogram of item.chartData.histograms) {
      member(histogram.fieldId, measures, path);
      if (histogram.counts.length === 0) {
        if (histogram.edges.length || histogram.binRecordIds.length)
          fail(path, "空直方图必须全部为空");
      } else if (
        histogram.edges.length !== histogram.counts.length + 1 ||
        histogram.binRecordIds.length !== histogram.counts.length ||
        histogram.counts.some(
          (count, index) => histogram.binRecordIds[index].length !== count,
        )
      )
        fail(path, "直方图边界、频数和记录数量不一致");
      if (
        histogram.edges.some(
          (edge, index) => index > 0 && edge <= histogram.edges[index - 1],
        )
      )
        fail(path, "直方图边界没有严格递增");
      members(histogram.binRecordIds.flat(), scope, path);
    }
    const scatter = item.chartData.scatter;
    if (scatter) {
      members([scatter.xFieldId, scatter.yFieldId], measures, path);
      member(scatter.correlationResultId, localResults, path);
      members(
        scatter.points.map((point) => point.recordId),
        scope,
        path,
      );
      for (const point of scatter.points) {
        const record = records.get(point.recordId)!;
        if (
          point.x !== record.values[scatter.xFieldId] ||
          point.y !== record.values[scatter.yFieldId]
        )
          fail(path, "散点坐标与对应记录不一致");
      }
    }
    for (const box of item.chartData.boxplots) {
      member(box.fieldId, measures, path);
      for (const resultId of [
        box.lowResultId,
        box.q1ResultId,
        box.medianResultId,
        box.q3ResultId,
        box.highResultId,
      ]) {
        member(resultId, localResults, path);
        if (
          !item.results
            .find((result) => result.resultId === resultId)!
            .fieldIds.includes(box.fieldId)
        )
          fail(path, "箱线图引用了其他指标的结果");
      }
      members(
        box.outliers.map((point) => point.recordId),
        scope,
        path,
      );
      for (const point of box.outliers)
        if (point.value !== records.get(point.recordId)!.values[box.fieldId])
          fail(path, "异常点与对应记录不一致");
    }
    if (item.graph.owner !== "analysis")
      fail(path, "分析图必须由 analysis 提供");
    validateIssues(data, item.issues, path);
  }
  for (const insight of project.insights)
    member(insight.analysisId, analysisIds, "insight");
  const rebuilt = rebuildGraph(project);
  const selected = project.selection;
  if (selected.datasetId !== null)
    member(selected.datasetId, datasetIds, "selection");
  if (selected.analysisId !== null) {
    member(selected.analysisId, analysisIds, "selection");
    const active = project.analyses.find(
      (item) => item.analysisId === selected.analysisId,
    )!;
    if (active.datasetId !== selected.datasetId)
      fail("selection", "当前数据集和分析不一致");
    if (!same(selected.measureFieldIds, active.request.measureFieldIds))
      fail("selection", "当前指标与分析请求不一致");
  }
  if (selected.datasetId !== null) {
    const active = project.datasets.find(
      (item) => item.datasetId === selected.datasetId,
    )!;
    members(
      selected.measureFieldIds,
      new Set(
        active.fields
          .filter(
            (field) =>
              field.role === "measure" && field.analysisPolicy === "allowed",
          )
          .map((field) => field.fieldId),
      ),
      "selection",
    );
  } else if (selected.measureFieldIds.length || selected.nodeId !== null)
    fail("selection", "未选数据集时不能保留指标或节点");
  if (selected.nodeId !== null) {
    member(
      selected.nodeId,
      new Set(rebuilt.nodes.map((node) => node.id)),
      "selection",
    );
    const visible =
      selected.analysisId !== null
        ? currentGraph(project, selected.analysisId).nodes
        : project.datasets.find(
            (item) => item.datasetId === selected.datasetId,
          )!.graph.nodes;
    member(
      selected.nodeId,
      new Set(visible.map((node) => node.id)),
      "selection 当前范围",
    );
  }
  return project;
}

export async function importProject(json: string): Promise<ProjectSnapshot> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return fail("root", "不是有效的 JSON 文件");
  }
  return validateProject(parsed);
}

export async function exportProject(project: ProjectSnapshot): Promise<string> {
  // 异步哈希期间用户仍可操作；导出固定快照，避免检查后状态改变。
  const snapshot = structuredClone(project);
  await validateProject(snapshot);
  return JSON.stringify(snapshot);
}
