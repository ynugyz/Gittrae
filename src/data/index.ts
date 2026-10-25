/** 浏览器入口：复用既有适配器，只在出口对齐唯一公共契约。 */
import type {
  AnalysisRequest,
  DatasetBundle,
  ImportOptions,
  Transformation,
} from "../contracts";
import { importFiles as importBytes } from "./importFiles.ts";
import type {
  DatasetBundle as AdapterBundle,
  ImportOptions as AdapterOptions,
} from "./types.ts";

function toContract(bundle: AdapterBundle): DatasetBundle {
  const fieldIds = new Set(bundle.fields.map((field) => field.fieldId));
  const transformations: Transformation[] = bundle.transformations.map(
    (transform) => {
      const fields = (transform.fieldIds ?? [...fieldIds]).filter((id) =>
        fieldIds.has(id),
      );
      const sources = new Set(transform.inputSourceIds);
      return {
        transformId: transform.transformId,
        type: transform.type,
        inputSourceIds: transform.inputSourceIds,
        description: transform.description,
        fieldIds: fields,
        affectedCount:
          transform.affectedCount ??
          bundle.records.filter((record) =>
            fields.some((id) =>
              record.provenance[id]?.some((ref) => sources.has(ref.sourceId)),
            ),
          ).length,
      };
    },
  );
  const derivedDimensions = bundle.fields
    .filter(
      (field) =>
        field.role !== "measure" &&
        bundle.records.some(
          (record) =>
            record.values[field.fieldId] !== null &&
            !record.provenance[field.fieldId]?.length,
        ),
    )
    .map((field) => field.fieldId);
  if (derivedDimensions.length) {
    transformations.push({
      transformId: `t:derived-dimensions:${bundle.datasetId}`,
      type: "parse",
      inputSourceIds: bundle.sources.map((source) => source.sourceId),
      description:
        "从原始地区/厂商/车型字段、月份字段及已知文件名/年份列名解析规范标识与期间维度；转换输入来源保留，不伪装成原始数值单元格。",
      fieldIds: derivedDimensions,
      affectedCount: bundle.records.filter((record) =>
        derivedDimensions.some(
          (id) => record.values[id] !== null && !record.provenance[id]?.length,
        ),
      ).length,
    });
  }
  return {
    ...bundle,
    sources: bundle.sources.map((source) => ({
      sourceId: source.sourceId,
      originalFileName: source.originalFileName,
      sha256: source.sha256,
      encoding: source.encoding,
      parseOptions: {
        delimiter: source.parseOptions.delimiter,
        quoteChar: source.parseOptions.quoteChar,
        escapeChar: source.parseOptions.escapeChar,
        skipEmptyLines: false,
      },
      headers: source.headers,
      rawRecords: source.rawRecords,
      rawBytesBase64: source.rawBytesBase64,
    })),
    fields: bundle.fields.map((field) => ({
      ...field,
      unit: field.unit ?? "",
    })),
    transformations,
    graph: {
      ...bundle.graph,
      nodes: bundle.graph.nodes.map((node) => ({
        ...node,
        ref:
          node.type === "indicator" &&
          node.ref.startsWith(`${bundle.datasetId}:`)
            ? node.ref.slice(bundle.datasetId.length + 1)
            : node.ref,
      })),
    },
  };
}

export async function importFiles(
  files: File[],
  options: ImportOptions = {},
): Promise<DatasetBundle[]> {
  const input = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );
  const fieldOverrides: NonNullable<AdapterOptions["fieldOverrides"]> = {};
  for (const key of new Set([
    ...Object.keys(options.fieldMappings ?? {}),
    ...Object.keys(options.fieldRoles ?? {}),
    ...Object.keys(options.units ?? {}),
  ])) {
    const column = /^col\d+$/.test(key) ? key.slice(3) : key;
    fieldOverrides[column] = {
      ...(options.fieldMappings?.[key] !== undefined
        ? { label: options.fieldMappings[key] }
        : {}),
      ...(options.fieldRoles?.[key] !== undefined
        ? { role: options.fieldRoles[key] }
        : {}),
      ...(options.units?.[key] !== undefined
        ? { unit: options.units[key] }
        : {}),
    };
  }
  const bundles = await importBytes(input, {
    adapterHints: options.adapterType
      ? Object.fromEntries(
          input.map((file) => [file.name, options.adapterType!]),
        )
      : undefined,
    fieldOverrides,
  });
  return bundles.map(toContract);
}

/** 运行时默认请求，不向 Bundle 增加持久化字段。 */
export function getDefaultRequest(bundle: DatasetBundle): AnalysisRequest {
  const allowed = bundle.fields
    .filter(
      (field) =>
        field.role === "measure" &&
        field.valueType === "number" &&
        field.analysisPolicy === "allowed",
    )
    .map((field) => field.fieldId);
  const filters: AnalysisRequest["filters"] = [];
  const filter = (fieldId: string, value: string | number) => {
    if (bundle.fields.some((field) => field.fieldId === fieldId))
      filters.push({ fieldId, operator: "eq", values: [value] });
  };
  let preferred: string[] = [];
  if (bundle.domain === "D1") {
    filter("year", 2024);
    preferred = ["income_all", "expend_all"];
  } else if (bundle.domain === "D2") {
    filter("report_period", "FY2025");
    preferred = ["revenue", "net_profit"];
  } else if (bundle.adapterType === "gasgoo-ranking") {
    filter("year_month", "2026-08");
    preferred = ["month_sales", "yoy"];
  } else if (bundle.adapterType === "cpca-table") {
    if (bundle.datasetId === "ds:d3-cpca-total-monthly") {
      filter("year", 2026);
      preferred = ["retail", "wholesale"];
    } else if (bundle.datasetId === "ds:d3-cpca-share-monthly") {
      preferred = ["nev_share", "ice_share"];
    } else {
      filter("year_month", "2026-08");
      preferred = ["wholesale_single", "wholesale_cum"];
    }
  }
  const chosen = preferred.filter((id) => allowed.includes(id));
  const measureFieldIds = chosen.length ? chosen : allowed.slice(0, 2);
  return {
    datasetId: bundle.datasetId,
    datasetVersion: bundle.datasetVersion,
    measureFieldIds,
    correlationPair:
      measureFieldIds.length === 2
        ? [measureFieldIds[0], measureFieldIds[1]]
        : null,
    filters,
  };
}
