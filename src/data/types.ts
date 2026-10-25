/**
 * T3 人员1：数据与来源 —— 公共契约类型镜像 v1.0
 *
 * 注意：本文件镜像 handoff/01_公共接口.md v1.0 的字段约定。
 * src/contracts 由人员3统一编码落地后，本文件应替换为对 src/contracts 的引用，
 * 不得成为第二套共享类型。任何字段差异以 handoff/01_公共接口.md 为准，
 * 发现冲突必须报告总控，不得私自改契约。
 */

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

export interface SourceFile {
  sourceId: string;
  originalName: string;
  sha256: string;
  encoding: string; // 'utf-8-sig' | 'utf-8' | 其他实际检测值
  byteLength: number;
  parseOptions: {
    delimiter: string;
    quote: string;
    keepEmptyRecords: boolean;
  };
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
  unit: string | null; // 独立记录；百分数用百分数点（5.18 = 5.18%）
  meaning: string;
  definitionStatus: DefinitionStatus;
  analysisPolicy: AnalysisPolicy;
  exclusionReason?: string; // analysisPolicy=excluded 时必须提供
}

/** 规范记录值：string | number | null。缺失为 null，零和负值保留。 */
export type CellValue = string | number | null;

export interface RecordRow {
  recordId: string; // 数据集内稳定、确定性
  values: Record<string, CellValue>; // fieldId → 值
  provenance: Record<string, SourceRef[]>; // fieldId → 支持该值的来源引用（可多个）
}

export interface Transformation {
  transformId: string;
  type:
    | 'wide_to_long'
    | 'filter'
    | 'join'
    | 'unit_transform'
    | 'duplicate_key_check'
    | 'parse';
  inputSourceIds: string[];
  description: string;
  affectedFields?: string[];
  affectedCount?: number;
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

export type GraphOwner = 'data' | 'analysis' | 'insight';
export type GraphNodeType = 'source' | 'dataset' | 'indicator' | 'scope' | 'calculation' | 'finding';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  ref: string; // 真实对象 ID
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: 'derived_from' | 'contains' | 'selects' | 'uses_scope' | 'uses_indicator' | 'cites';
}

/** 人员1产出：owner 固定 'data'，只用 derived_from（dataset→source）与 contains（dataset→indicator）。 */
export interface GraphFragment {
  schemaVersion: 1;
  owner: GraphOwner;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** DatasetBundle：人员1的唯一数据产出对象。 */
export interface DatasetBundle {
  schemaVersion: 1;
  datasetId: string;
  datasetVersion: string;
  domain: Domain;
  adapterType: AdapterType;
  adapterVersion: string;
  sources: SourceFile[];
  fields: Field[];
  records: RecordRow[];
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
  /** 对 generic-csv 上传的字段角色确认结果：fieldId/列序号 → 覆盖 role/unit */
  fieldOverrides?: Record<string, Partial<Pick<Field, 'role' | 'unit' | 'label'>>>;
}

/** 适配器在数据包内的默认分析范围提示（供人员3生成默认 AnalysisRequest）。 */
export interface DefaultScopeHint {
  filters: { fieldId: string; operator: 'eq' | 'in'; values: (string | number)[] }[];
  note: string;
}
