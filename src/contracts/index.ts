/** 唯一共享类型入口；语义以 handoff/01_公共接口.md 为准。 */
export type Scalar = string | number | null;
export type Domain = "D1" | "D2" | "D3" | "generic";
export type AdapterType =
  | "nbs-regional-wide"
  | "eastmoney-financial"
  | "gasgoo-ranking"
  | "cpca-table"
  | "generic-csv";
export interface SourceRef {
  sourceId: string;
  recordIndex: number;
  columnIndex: number;
}
export interface ParseOptions {
  delimiter: string;
  quoteChar: string;
  escapeChar: string;
  skipEmptyLines: false;
}
export interface SourceFile {
  sourceId: string;
  originalFileName: string;
  sha256: string;
  encoding: string;
  parseOptions: ParseOptions;
  headers: string[];
  rawRecords: string[][];
  rawBytesBase64: string;
}
export interface Field {
  fieldId: string;
  label: string;
  role: "identifier" | "dimension" | "measure";
  valueType: "string" | "number";
  unit: string;
  meaning: string;
  definitionStatus: "confirmed" | "unknown";
  analysisPolicy: "allowed" | "excluded";
  exclusionReason?: string;
}
export interface DataRecord {
  recordId: string;
  values: Record<string, Scalar>;
  provenance: Record<string, SourceRef[]>;
}
export interface Transformation {
  transformId: string;
  type: string;
  inputSourceIds: string[];
  description: string;
  fieldIds: string[];
  affectedCount: number;
}
export interface Issue {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  fieldId?: string;
  recordIds?: string[];
  sourceRefs?: SourceRef[];
}
export type NodeType =
  "source" | "dataset" | "indicator" | "scope" | "calculation" | "finding";
export type EdgeType =
  | "derived_from"
  | "contains"
  | "selects"
  | "uses_scope"
  | "uses_indicator"
  | "cites";
export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  ref: string;
}
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
}
export interface GraphSnapshot {
  schemaVersion: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
export interface GraphFragment extends GraphSnapshot {
  owner: "data" | "analysis" | "insight";
}
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
export interface Filter {
  fieldId: string;
  operator: "eq" | "in";
  values: Scalar[];
}
export interface AnalysisRequest {
  datasetId: string;
  datasetVersion: string;
  measureFieldIds: string[];
  correlationPair: [string, string] | null;
  filters: Filter[];
}
export interface Scope {
  scopeId: string;
  filters: Filter[];
  recordIds: string[];
  label: string;
  limitations: string[];
}
export interface MetricResult {
  resultId: string;
  metric: string;
  fieldIds: string[];
  value: number | null;
  unit: string;
  method: string;
  parameters: Record<string, Scalar>;
  validRecordIds: string[];
  excludedRecordIds: string[];
  exclusionReasons: Record<string, string>;
}
export interface Histogram {
  fieldId: string;
  edges: number[];
  counts: number[];
  binRecordIds: string[][];
}
export interface Scatter {
  xFieldId: string;
  yFieldId: string;
  correlationResultId: string;
  points: { recordId: string; x: number; y: number }[];
}
export interface Boxplot {
  fieldId: string;
  lowResultId: string;
  q1ResultId: string;
  medianResultId: string;
  q3ResultId: string;
  highResultId: string;
  outliers: { recordId: string; value: number }[];
}
export interface AnalysisResult {
  schemaVersion: 1;
  analysisId: string;
  datasetId: string;
  datasetVersion: string;
  request: AnalysisRequest;
  scope: Scope;
  results: MetricResult[];
  chartData: {
    histograms: Histogram[];
    scatter: Scatter | null;
    boxplots: Boxplot[];
  };
  issues: Issue[];
  graph: GraphFragment;
}
export interface Insight {
  insightId: string;
  analysisId: string;
  kind: "fact" | "interpretation";
  origin: "computed" | "live_ai";
  textTemplate: string;
  resultRefs: string[];
  generatedAt: string;
  model: string | null;
  status: "valid" | "invalid";
}
export interface Selection {
  datasetId: string | null;
  analysisId: string | null;
  measureFieldIds: string[];
  nodeId: string | null;
}
export interface ProjectSnapshot {
  schemaVersion: 1;
  projectId: string;
  createdAt: string;
  savedAt: string;
  datasets: DatasetBundle[];
  analyses: AnalysisResult[];
  insights: Insight[];
  selection: Selection;
}
export interface ImportOptions {
  adapterType?: AdapterType;
  fieldMappings?: Record<string, string>;
  units?: Record<string, string>;
  fieldRoles?: Record<string, Field["role"]>;
}
export interface FactsOutput {
  insights: Insight[];
  graph: GraphFragment;
}
export interface InsightResponse extends FactsOutput {
  analysisId: string;
  requestId: string;
  model: string;
  generatedAt: string;
}
export interface InsightRequest {
  analysisId: string;
  facts: {
    resultId: string;
    metric: string;
    value: number | null;
    unit: string;
    method: string;
    sampleSize: number;
  }[];
  context: {
    fields: Pick<Field, "fieldId" | "label" | "meaning" | "unit">[];
    scope: Scope;
    limitations: string[];
  };
}
