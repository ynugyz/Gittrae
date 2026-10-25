/**
 * T3 人员1：数据与来源 —— 公共契约对齐层
 *
 * 本文件已与人员3落地的 src/contracts/index.ts（dev/app @ 39c92f1）逐字段对齐：
 * - SourceFile.originalFileName / parseOptions{delimiter,quoteChar,escapeChar,skipEmptyLines:false}
 * - Field.unit: string（无单位用 ""，不用 null）
 * - Transformation.fieldIds + affectedCount 必填
 * - DataRecord / Scalar 命名（保留 CellValue / RecordRow 别名以减少模块改动）
 *
 * src/contracts 进入主干后，本文件应替换为对 src/contracts 的 re-export，
 * 不得成为第二套共享类型。语义以 handoff/01_公共接口.md 为准，冲突报总控。
 */

export type Scalar = string | number | null;
/** 别名：模块内部沿用 CellValue 命名。 */
export type CellValue = Scalar;

export type Domain = 'D1' | 'D2' | 'D3' | 'generic';

export type AdapterType =
  | 'nbs-regional-wide'
  | 'eastmoney-financial'
  | 'gasgoo-ranking'
  | 'cpca-table'
  | 'generic-csv';

/** SourceRef：原始来源定位。recordIndex 从 1 起、不含表头、空记录占位；columnIndex 从 0 起。 */
export interface SourceRef {
  sourceId: string;
  recordIndex: number; // 1-based，不含表头
  columnIndex: number; // 0-based
}

export interface ParseOptions {
  delimiter: string;
  quoteChar: string;
  escapeChar: string;
  skipEmptyLines: false; // 空记录占位，不得跳过
}

export interface SourceFile {
  sourceId: string;
  originalFileName: string;
  sha256: string;
  encoding: string; // 'utf-8-sig' | 'utf-8' | 其他实际检测值
  parseOptions: ParseOptions;
  headers: string[]; // 保留空表头（如 D1 首列）
  rawRecords: string[][]; // 表头之后的原始字符串记录（已按 CSV 引号规则解析，非物理行）
  rawBytesBase64: string; // 原始字节，用于导出恢复
}

export type FieldRole = 'identifier' | 'dimension' | 'measure';
export type DefinitionStatus = 'confirmed' | 'unknown';
export type AnalysisPolicy = 'allowed' | 'excluded';

export interface Field {
  fieldId: string;
  label: string; // 中文展示名
  role: FieldRole;
  valueType: 'string' | 'number';
  unit: string; // 无单位用 ""；百分数用百分数点（5.18 = 5.18%）
  meaning: string;
  definitionStatus: DefinitionStatus;
  analysisPolicy: AnalysisPolicy;
  exclusionReason?: string; // analysisPolicy=excluded 时必须提供
}

export interface DataRecord {
  recordId: string; // 数据集内稳定、确定性
  values: Record<string, Scalar>; // fieldId → 值；缺失显式 null，不用 0
  provenance: Record<string, SourceRef[]>; // fieldId → 支持该值的来源引用
}
/** 别名：模块内部沿用 RecordRow 命名。 */
export type RecordRow = DataRecord;

export interface Transformation {
  transformId: string;
  type: string; // 'wide_to_long' | 'filter' | 'join' | 'unit_transform' | 'duplicate_key_check' | 'parse' | ...
  inputSourceIds: string[];
  description: string;
  fieldIds: string[]; // 受影响字段（契约命名）
  affectedCount: number; // 必填
}

export type IssueSeverity = 'info' | 'warning' | 'error';

export interface Issue {
  code: string;
  severity: IssueSeverity;
  message: string;
  fieldId?: string;
  recordIds?: string[];
  sourceRefs?: SourceRef[];
}

export type GraphNodeType =
  'source' | 'dataset' | 'indicator' | 'scope' | 'calculation' | 'finding';
export type GraphEdgeType =
  | 'derived_from' | 'contains' | 'selects' | 'uses_scope' | 'uses_indicator' | 'cites';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  ref: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: GraphEdgeType;
}

/** 人员1产出：owner 固定 'data'，只用 derived_from（dataset→source）与 contains（dataset→indicator）。 */
export interface GraphFragment {
  schemaVersion: 1;
  owner: 'data' | 'analysis' | 'insight';
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** DatasetBundle：人员1的唯一数据产出对象（与契约 DatasetBundle 一致）。 */
export interface DatasetBundle {
  schemaVersion: 1;
  datasetId: string;
  datasetVersion: string;
  domain: Domain;
  adapterType: AdapterType;
  adapterVersion: string;
  sources: SourceFile[];
  fields: Field[];
  records: DataRecord[];
  transformations: Transformation[];
  issues: Issue[];
  graph: GraphFragment;
}

/** importFiles 输入：文件名 + 原始字节（浏览器 File / Node 读入均可）。 */
export interface InputFile {
  name: string;
  bytes: Uint8Array;
}

/** importFiles 选项：适配器提示（文件名→适配器）、字段角色确认覆盖。 */
export interface ImportOptions {
  adapterHints?: Record<string, AdapterType>;
  /** 对 generic-csv 上传的字段角色确认结果：列序号或列标签 → 覆盖 role/unit/label */
  fieldOverrides?: Record<string, Partial<Pick<Field, 'role' | 'unit' | 'label'>>>;
}

/** 适配器在数据包内的默认分析范围提示（供人员3生成默认 AnalysisRequest；契约 v1.1 待裁决）。 */
export interface DefaultScopeHint {
  filters: { fieldId: string; operator: 'eq' | 'in'; values: Scalar[] }[];
  note: string;
}
