/**
 * 通用 CSV 适配器：generic-csv —— 未知格式的用户上传。
 *
 * 契约（handoff/00_共同上下文.md §4）：
 * - 字段角色与单位允许用户确认；未知含义明确标记（definitionStatus='unknown'）。
 * - 不凭猜测自动合并指标；第一列默认作标识/维度，数值列作度量。
 * - 用户可通过 ImportOptions.fieldOverrides 覆盖角色/单位/标签。
 */
import { parseCsv } from '../csv.ts';
import { decodeBytes, makeSourceFile, parseNumber, datasetVersion } from '../util.ts';
import { buildGraph } from '../graph.ts';
import type {
  CellValue,
  DatasetBundle,
  Field,
  ImportOptions,
  InputFile,
  RecordRow,
  SourceFile,
  SourceRef,
  Transformation,
} from '../types.ts';

const ADAPTER_VERSION = '1.0.0';

export async function buildGenericBundle(file: InputFile, options: ImportOptions = {}): Promise<DatasetBundle> {
  const { text, encoding } = decodeBytes(file.bytes);
  const parsed = parseCsv(text);
  const source: SourceFile = await makeSourceFile(file.name, file.bytes, parsed.headers, parsed.rawRecords, encoding);
  const overrides = options.fieldOverrides ?? {};

  const issues: Issue[] = [];
  const fields: Field[] = [];
  const roleByCol: ('identifier' | 'dimension' | 'measure')[] = [];

  parsed.headers.forEach((h, col) => {
    const label = h.trim() === '' ? `第${col}列` : h.trim();
    // 列值数值占比 > 80% 且非首列 → 度量；首列 → 标识；其余 → 维度
    let numeric = 0;
    let nonEmpty = 0;
    for (const rec of parsed.rawRecords) {
      const v = (rec[col] ?? '').trim();
      if (v === '') continue;
      nonEmpty++;
      if (parseNumber(v).ok && /^-?(\d+\.?\d*|\.\d+)$/.test(v)) numeric++;
    }
    const numericRatio = nonEmpty === 0 ? 0 : numeric / nonEmpty;
    let role: 'identifier' | 'dimension' | 'measure' =
      col === 0 ? 'identifier' : numericRatio > 0.8 ? 'measure' : 'dimension';
    const ov = overrides[String(col)] ?? overrides[label];
    if (ov?.role) role = ov.role;
    roleByCol.push(role);
    fields.push({
      fieldId: `col${col}`,
      label: ov?.label ?? label,
      role,
      valueType: role === 'measure' ? 'number' : 'string',
      unit: ov?.unit ?? '',
      meaning: '含义未确认（generic-csv 上传），请在界面确认字段角色与单位',
      definitionStatus: 'unknown',
      analysisPolicy: 'allowed',
    });
  });

  issues.push({
    code: 'GENERIC_UNCONFIRMED',
    severity: 'warning',
    message: `generic-csv：文件 ${file.name} 的字段含义未确认（definitionStatus=unknown）；请通过字段映射入口确认角色与单位后再发起分析`,
  });

  const records: RecordRow[] = parsed.rawRecords.map((rec, r) => {
    const values: Record<string, CellValue> = {};
    const prov: Record<string, SourceRef[]> = {};
    fields.forEach((f, col) => {
      const raw = (rec[col] ?? '').trim();
      const ref: SourceRef = { sourceId: source.sourceId, recordIndex: r + 1, columnIndex: col };
      if (raw === '') return; // 缺失 → null
      if (f.valueType === 'number') {
        const n = parseNumber(raw);
        if (!n.ok) {
          issues.push({
            code: 'GENERIC_NON_NUMERIC', severity: 'warning',
            message: `非数值出现在度量列：第 ${r + 1} 行 ${f.label} = "${raw}"`,
            fieldId: f.fieldId,
            sourceRefs: [ref],
          });
          return;
        }
        values[f.fieldId] = n.value;
      } else {
        values[f.fieldId] = raw;
      }
      prov[f.fieldId] = [ref];
    });
    return { recordId: `rec:generic:${source.sourceId.slice(4)}:${r + 1}`, values, provenance: prov };
  });

  const transformations: Transformation[] = [
    {
      transformId: `t:parse:${source.sourceId}`,
      type: 'parse',
      inputSourceIds: [source.sourceId],
      description: 'generic-csv：保留原始字符串与位置，数值列按严格规则解析；未合并任何指标',
      affectedCount: parsed.rawRecords.length,
    },
  ];

  const version = await datasetVersion(
    'generic-csv', ADAPTER_VERSION, [source.sha256], fields.map((f) => f.fieldId),
  );

  return {
    schemaVersion: 1,
    datasetId: `ds:generic:${source.sourceId.slice(4)}`,
    datasetVersion: version,
    domain: 'generic',
    adapterType: 'generic-csv',
    adapterVersion: ADAPTER_VERSION,
    sources: [source],
    fields,
    records,
    transformations,
    issues,
    graph: buildGraph(
      `ds:generic:${source.sourceId.slice(4)}`,
      `上传数据：${file.name}`,
      [source],
      fields.filter((f) => f.role === 'measure'),
    ),
  };
}
