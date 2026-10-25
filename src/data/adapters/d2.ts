/**
 * D2 适配器：eastmoney-financial —— 东方财富业绩报表（FY2024 + FY2025）。
 *
 * 口径（handoff/00_共同上下文.md §4、TASK.md、公共接口 §1）：
 * - 股票代码全程文本，前导零不丢（000001 ≠ 1）。
 * - 合并两期为一份 Bundle：观测单位 = 公司 × 报告期（reportPeriod）。
 * - 明确筛选 6 位代码 60/00/30/68 开头（沪深）并记录排除数量；不把全部原始记录标为 A 股。
 * - 缺失行业为 null（界面显示"未分类"），亏损与 ST 保留不删。
 * - 同比/环比/毛利率/ROE 等百分数列保持百分数点口径（0.5414 = 0.5414%），不做 ×100。
 *   该口径已用 FY2024 文件重算营收同比全量核验（见 tests/run-verify.ts D2 口径核验）。
 */
import { parseCsv } from '../csv.ts';
import { decodeBytes, makeSourceFile, parseNumber, parsePercent, datasetVersion } from '../util.ts';
import { buildGraph } from '../graph.ts';
import type {
  CellValue,
  DatasetBundle,
  Field,
  InputFile,
  Issue,
  RecordRow,
  SourceFile,
  SourceRef,
  Transformation,
} from '../types.ts';

const ADAPTER_VERSION = '1.0.0';
const DS_ID = 'ds:d2-listed-company-finance';

interface ColumnSpec {
  header: string; // 原始表头
  fieldId: string;
  label: string;
  unit: string | null;
  meaning: string;
  percent: boolean; // true → parsePercent；false → parseNumber
}

/** 数值/百分数列定义（表头顺序即源列序；代码/简称/行业/公告日期单独处理）。 */
const MEASURE_COLS: ColumnSpec[] = [
  { header: '每股收益', fieldId: 'eps', label: '每股收益', unit: '元', meaning: '报告期每股收益', percent: false },
  { header: '营业总收入-营业总收入', fieldId: 'revenue', label: '营业总收入', unit: '元', meaning: '报告期营业总收入', percent: false },
  { header: '营业总收入-同比增长', fieldId: 'revenue_yoy', label: '营收同比', unit: '%', meaning: '营业总收入同比增长（百分数点：0.5414 表示 0.5414%）', percent: true },
  { header: '营业总收入-季度环比增长', fieldId: 'revenue_qoq', label: '营收环比', unit: '%', meaning: '营业总收入季度环比增长（百分数点）', percent: true },
  { header: '净利润-净利润', fieldId: 'net_profit', label: '净利润', unit: '元', meaning: '报告期净利润（亏损为负值，保留）', percent: false },
  { header: '净利润-同比增长', fieldId: 'net_profit_yoy', label: '净利润同比', unit: '%', meaning: '净利润同比增长（百分数点）', percent: true },
  { header: '净利润-季度环比增长', fieldId: 'net_profit_qoq', label: '净利润环比', unit: '%', meaning: '净利润季度环比增长（百分数点）', percent: true },
  { header: '每股净资产', fieldId: 'bps', label: '每股净资产', unit: '元', meaning: '报告期每股净资产', percent: false },
  { header: '净资产收益率', fieldId: 'roe', label: '净资产收益率', unit: '%', meaning: '净资产收益率（百分数点）', percent: true },
  { header: '每股经营现金流量', fieldId: 'ocf_per_share', label: '每股经营现金流', unit: '元', meaning: '每股经营活动现金流量', percent: false },
  { header: '销售毛利率', fieldId: 'gross_margin', label: '销售毛利率', unit: '%', meaning: '销售毛利率（百分数点）', percent: true },
];

/** 判断是否沪深 A 股代码：6 位且 60/00/30/68 开头。 */
export function isAshareCode(code: string): boolean {
  return /^[0-9]{6}$/.test(code) && /^(60|00|30|68)/.test(code);
}

interface D2File {
  source: SourceFile;
  reportPeriod: string; // FY2025 / FY2024
  headerIndex: Map<string, number>;
  rows: string[][];
}

function reportPeriodOf(fileName: string): string {
  const m = fileName.match(/EM_yjbb_(FY\d{4})_/);
  if (!m) throw new Error(`无法从文件名解析报告期：${fileName}`);
  return m[1];
}

async function loadOne(file: InputFile): Promise<D2File> {
  const { text, encoding } = decodeBytes(file.bytes);
  const parsed = parseCsv(text);
  const source = await makeSourceFile(file.name, file.bytes, parsed.headers, parsed.rawRecords, encoding);
  const headerIndex = new Map<string, number>();
  parsed.headers.forEach((h, i) => headerIndex.set(h, i));
  return { source, reportPeriod: reportPeriodOf(file.name), headerIndex, rows: parsed.rawRecords };
}

export async function buildD2Bundle(files: InputFile[]): Promise<DatasetBundle> {
  const loaded = await Promise.all(files.map(loadOne));
  const issues: Issue[] = [];

  const fields: Field[] = [
    {
      fieldId: 'code', label: '股票代码', role: 'identifier', valueType: 'string', unit: '',
      meaning: '6位股票代码（文本，前导零保留；仅保留 60/00/30/68 开头的沪深公司）',
      definitionStatus: 'confirmed', analysisPolicy: 'allowed',
    },
    {
      fieldId: 'name', label: '股票简称', role: 'dimension', valueType: 'string', unit: '',
      meaning: '股票简称（含 ST/退市标识，保留原文）',
      definitionStatus: 'confirmed', analysisPolicy: 'allowed',
    },
    {
      fieldId: 'report_period', label: '报告期', role: 'dimension', valueType: 'string', unit: '',
      meaning: '会计报告期（FY2025/FY2024）',
      definitionStatus: 'confirmed', analysisPolicy: 'allowed',
    },
    {
      fieldId: 'industry', label: '所处行业', role: 'dimension', valueType: 'string', unit: '',
      meaning: '东方财富行业分类；缺失为 null（界面显示"未分类"）',
      definitionStatus: 'confirmed', analysisPolicy: 'allowed',
    },
    {
      fieldId: 'announce_date', label: '最新公告日期', role: 'dimension', valueType: 'string', unit: '',
      meaning: '该行数据的最新公告日期（数据为后续披露版本，不做历史可交易断言）',
      definitionStatus: 'confirmed', analysisPolicy: 'allowed',
    },
    ...MEASURE_COLS.map(
      (c): Field => ({
        fieldId: c.fieldId, label: c.label, role: 'measure', valueType: 'number', unit: c.unit,
        meaning: c.meaning, definitionStatus: 'confirmed', analysisPolicy: 'allowed',
      }),
    ),
  ];

  const records: RecordRow[] = [];
  const transformations: Transformation[] = [];
  let totalKept = 0;
  let totalExcluded = 0;
  let missingIndustry = 0;

  for (const l of loaded) {
    const ci = (h: string) => l.headerIndex.get(h);
    const codeCol = ci('股票代码');
    const nameCol = ci('股票简称');
    const indCol = ci('所处行业');
    const dateCol = ci('最新公告日期');
    if (codeCol === undefined || nameCol === undefined) {
      throw new Error(`D2 文件缺少 股票代码/股票简称 列：${l.source.originalFileName}`);
    }
    const measureCols = MEASURE_COLS.map((c) => ({ spec: c, col: ci(c.header) }));

    let kept = 0;
    let excluded = 0;

    l.rows.forEach((rec, r) => {
      const code = (rec[codeCol] ?? '').trim();
      const recordIndex = r + 1;
      if (!isAshareCode(code)) {
        excluded++;
        return; // 混合市场过滤：新三板/北交所等排除，计数并保留在原始来源中
      }
      kept++;

      const values: Record<string, CellValue> = {
        code, // 文本保留前导零
        name: (rec[nameCol] ?? '').trim() || null,
        report_period: l.reportPeriod,
      };
      const prov: Record<string, SourceRef[]> = {
        code: [{ sourceId: l.source.sourceId, recordIndex, columnIndex: codeCol }],
        name: [{ sourceId: l.source.sourceId, recordIndex, columnIndex: nameCol }],
        report_period: [], // 派生自文件名，非原始单元格 → 记录变换
      };

      if (indCol !== undefined) {
        const ind = (rec[indCol] ?? '').trim();
        if (ind === '') {
          missingIndustry++;
        } else {
          values.industry = ind;
          prov.industry = [{ sourceId: l.source.sourceId, recordIndex, columnIndex: indCol }];
        }
      }
      if (dateCol !== undefined) {
        const d = (rec[dateCol] ?? '').trim();
        if (d !== '') {
          values.announce_date = d;
          prov.announce_date = [{ sourceId: l.source.sourceId, recordIndex, columnIndex: dateCol }];
        }
      }

      for (const { spec, col } of measureCols) {
        if (col === undefined) continue;
        const raw = (rec[col] ?? '').trim();
        if (raw === '') continue; // 缺失 → null，不补零
        const num = spec.percent ? parsePercent(raw) : parseNumber(raw);
        if (!num.ok) {
          issues.push({
            code: 'D2_NON_NUMERIC',
            severity: 'warning',
            message: `非数值：${code} ${l.reportPeriod} ${spec.fieldId} = "${raw}"`,
            fieldId: spec.fieldId,
            sourceRefs: [{ sourceId: l.source.sourceId, recordIndex, columnIndex: col }],
          });
          continue;
        }
        values[spec.fieldId] = num.value;
        prov[spec.fieldId] = [{ sourceId: l.source.sourceId, recordIndex, columnIndex: col }];
      }

      records.push({ recordId: `rec:d2:${l.reportPeriod}:${code}`, values, provenance: prov });
    });

    totalKept += kept;
    totalExcluded += excluded;
    transformations.push({
      transformId: `t:filter-market:${l.source.sourceId}`,
      type: 'filter',
      inputSourceIds: [l.source.sourceId],
      description: `沪深筛选：仅保留 6 位且 60/00/30/68 开头的股票代码（${l.reportPeriod}），排除 ${excluded} 条（新三板/北交所/其他市场），原始来源保留全部记录`,
      fieldIds: ['code'],
      affectedCount: excluded,
    });
  }

  issues.push({
    code: 'D2_MARKET_FILTER',
    severity: 'info',
    message: `混合市场过滤：保留 ${totalKept} 条沪深记录，排除 ${totalExcluded} 条非沪深记录；全部原始记录保留在来源中，不得将全部原始记录称为 A 股`,
  });
  if (missingIndustry > 0) {
    issues.push({
      code: 'D2_INDUSTRY_MISSING',
      severity: 'info',
      message: `${missingIndustry} 条记录行业缺失（显示为"未分类"），未删除、未补零`,
      fieldId: 'industry',
    });
  }
  issues.push({
    code: 'D2_DISCLOSURE_VERSION',
    severity: 'info',
    message: '业绩报表为后续披露版本数据，不做历史可交易断言；同比/环比/毛利率/ROE 均为百分数点口径（0.5414 表示 0.5414%）',
  });
  issues.push({
    code: 'D2_YOY_RESTATED_NOTE',
    severity: 'info',
    message: '口径核验（tests/run-verify.ts 全量重算）：营收同比与按上年披露值重算一致率 >99.8%，确认百分数点口径；净利润同比对约 1/4 记录与简单重算不符，符合源站采用追溯调整后上年基数/扭亏处理（归母口径差异）的数据特征——本适配器原样保留列值，不做改写；涉及该字段的分析建议优先使用营收同比或净利润绝对值',
    fieldId: 'net_profit_yoy',
  });

  const sources = loaded.map((l) => l.source);
  const version = await datasetVersion(
    'eastmoney-financial', ADAPTER_VERSION,
    sources.map((s) => s.sha256),
    fields.map((f) => f.fieldId),
  );

  return {
    schemaVersion: 1,
    datasetId: DS_ID,
    datasetVersion: version,
    domain: 'D2',
    adapterType: 'eastmoney-financial',
    adapterVersion: ADAPTER_VERSION,
    sources,
    fields,
    records,
    transformations,
    issues,
    graph: buildGraph(DS_ID, 'D2 A股上市公司财务（FY2024–FY2025）', sources, fields.filter((f) => f.role === 'measure')),
  };
}
