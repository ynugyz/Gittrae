/**
 * D3 适配器：cpca-table —— 乘联会（CPCA）结构与总量表（13 张）。
 *
 * 分成三份 Bundle（契约：厂商榜/车型榜/CPCA 总量不硬塞同一观测表）：
 * 1. ds:d3-cpca-total   —— 观测单位 = 年×月：零售/批发/产量/出口/整体市场销量（万辆）
 * 2. ds:d3-cpca-share   —— 观测单位 = 年×月：NEV/ICE 占比、国别份额、各细分市场份额（%）
 * 3. ds:d3-cpca-manrank —— 观测单位 = 厂商×年月：单月批发 / 累计批发（万辆）
 *
 * 月份格式两种：'1月'（配合年份列）与 '2025-9月'（自带年份），适配器统一为 YYYY-MM。
 */
import { parseCsv } from '../csv.ts';
import { decodeBytes, makeSourceFile, parseNumber, datasetVersion, ym } from '../util.ts';
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

export type CpcaFamily = 'total' | 'share' | 'manrank';

export function cpcaFamilyOf(fileName: string): CpcaFamily {
  if (/CPCA_manrank_/.test(fileName)) return 'manrank';
  if (/CPCA_(fuel_销量占比|country|segment_)/.test(fileName)) return 'share';
  if (/CPCA_(total_|fuel_整体市场)/.test(fileName)) return 'total';
  throw new Error(`未知 CPCA 表类型：${fileName}`);
}

interface CpcaFile {
  source: SourceFile;
  family: CpcaFamily;
  headers: string[];
  rows: string[][];
}

async function loadOne(file: InputFile): Promise<CpcaFile> {
  const family = cpcaFamilyOf(file.name);
  const { text, encoding } = decodeBytes(file.bytes);
  const parsed = parseCsv(text);
  const source = await makeSourceFile(file.name, file.bytes, parsed.headers, parsed.rawRecords, encoding);
  return { source, family, headers: parsed.headers, rows: parsed.rawRecords };
}

/** '1月' → 12（需要配合年份列）；'2025-9月' → {y:2025, m:9}。 */
function parseMonthCell(cell: string): { y: number | null; m: number } {
  let m = cell.match(/^(\d{4})-(\d{1,2})月$/);
  if (m) return { y: Number(m[1]), m: Number(m[2]) };
  m = cell.match(/^(\d{1,2})月$/);
  if (m) return { y: null, m: Number(m[1]) };
  throw new Error(`无法解析月份单元格："${cell}"`);
}

const SEGMENTS: { file: string; prefix: string; label: string }[] = [
  { file: 'CPCA_segment_轿车.csv', prefix: 'sedan', label: '轿车' },
  { file: 'CPCA_segment_SUV.csv', prefix: 'suv', label: 'SUV' },
  { file: 'CPCA_segment_MPV.csv', prefix: 'mpv', label: 'MPV' },
];

const COUNTRY_NAMES = ['其他欧系', '德系', '日系', '法系', '美系', '自主', '韩系'];
const COUNTRY_SLUGS = ['other_eu', 'german', 'japanese', 'french', 'american', 'domestic', 'korean'];

/* ---------------- 1. 总量表 ---------------- */

const TOTAL_MEASURES: { match: RegExp; fieldId: string; label: string }[] = [
  { match: /CPCA_total_狭义乘用车_零售\.csv$/, fieldId: 'retail', label: '狭义乘用车零售' },
  { match: /CPCA_total_狭义乘用车_批发\.csv$/, fieldId: 'wholesale', label: '狭义乘用车批发' },
  { match: /CPCA_total_狭义乘用车_产量\.csv$/, fieldId: 'output', label: '狭义乘用车产量' },
  { match: /CPCA_total_狭义乘用车_出口\.csv$/, fieldId: 'export', label: '狭义乘用车出口' },
  { match: /CPCA_fuel_整体市场\.csv$/, fieldId: 'fuel_market_total', label: '整体市场销量' },
];

async function buildTotal(files: CpcaFile[], issues: Issue[]): Promise<DatasetBundle> {
  const dsId = 'ds:d3-cpca-total-monthly';
  const fields: Field[] = [
    { fieldId: 'year', label: '年份', role: 'dimension', valueType: 'number', unit: '', meaning: '年份', definitionStatus: 'confirmed', analysisPolicy: 'allowed' },
    { fieldId: 'month', label: '月份', role: 'dimension', valueType: 'number', unit: '', meaning: '月份（1-12）', definitionStatus: 'confirmed', analysisPolicy: 'allowed' },
  ];
  for (const t of TOTAL_MEASURES) {
    const f = files.find((x) => t.match.test(x.source.originalFileName));
    if (!f) continue;
    fields.push({
      fieldId: t.fieldId, label: t.label, role: 'measure', valueType: 'number', unit: '万辆',
      meaning: `${t.label}（乘联会口径，万辆）`, definitionStatus: 'confirmed', analysisPolicy: 'allowed',
    });
  }

  interface Agg { values: Record<string, CellValue>; prov: Record<string, SourceRef[]> }
  const map = new Map<string, Agg>();

  for (const f of files) {
    const t = TOTAL_MEASURES.find((x) => x.match.test(f.source.originalFileName));
    if (!t) continue;
    // 年份列：'2025年'、'2026年'
    const yearCols: { col: number; y: number }[] = [];
    f.headers.forEach((h, col) => {
      const m = h.match(/^(\d{4})年$/);
      if (m) yearCols.push({ col, y: Number(m[1]) });
    });
    f.rows.forEach((rec, r) => {
      const mc = parseMonthCell((rec[0] ?? '').trim());
      const recordIndex = r + 1;
      for (const { col, y } of yearCols) {
        const raw = (rec[col] ?? '').trim();
        if (raw === '') continue;
        const n = parseNumber(raw);
        if (!n.ok) {
          issues.push({
            code: 'D3_NON_NUMERIC', severity: 'warning',
            message: `非数值：${t.fieldId} ${y}-${mc.m} = "${raw}"`,
            fieldId: t.fieldId,
            sourceRefs: [{ sourceId: f.source.sourceId, recordIndex, columnIndex: col }],
          });
          continue;
        }
        const key = `${y}-${mc.m}`;
        let agg = map.get(key);
        if (!agg) {
          agg = { values: { year: y, month: mc.m }, prov: {} };
          map.set(key, agg);
        }
        if (agg.values[t.fieldId] !== undefined) {
          issues.push({
            code: 'D3_CPCA_CONFLICT', severity: 'error',
            message: `重复键：${t.fieldId} ${key} 已有值（${f.source.originalFileName}）`,
            fieldId: t.fieldId,
            sourceRefs: [{ sourceId: f.source.sourceId, recordIndex, columnIndex: col }],
          });
          continue;
        }
        agg.values[t.fieldId] = n.value;
        agg.prov[t.fieldId] = [{ sourceId: f.source.sourceId, recordIndex, columnIndex: col }];
      }
    });
  }

  const records: RecordRow[] = [...map.keys()]
    .sort((a, b) => {
      const [ay, am] = a.split('-').map(Number);
      const [by, bm] = b.split('-').map(Number);
      return ay - by || am - bm;
    })
    .map((k) => {
      const agg = map.get(k)!;
      const [y, m] = k.split('-').map(Number);
      const yms = ym(y, m);
      return { recordId: `rec:d3-cpca-total:${yms}`, values: agg.values, provenance: agg.prov };
    });

  if (records.length > 0) {
    const first = records[0].values;
    const last = records[records.length - 1].values;
    issues.push({
      code: 'D3_CPCA_COVERAGE',
      severity: 'info',
      message: `总量表数据期覆盖 ${first['year']}-${String(first['month']).padStart(2, '0')} ~ ${last['year']}-${String(last['month']).padStart(2, '0')}（共 ${records.length} 个月）；未来月份无数据，不生成全空记录`,
    });
  }

  const sources = files.map((f) => f.source);
  const fieldsAll = [...fields];
  const version = await datasetVersion('cpca-table', ADAPTER_VERSION, sources.map((s) => s.sha256), fieldsAll.map((f2) => f2.fieldId));
  return {
    schemaVersion: 1, datasetId: dsId, datasetVersion: version, domain: 'D3',
    adapterType: 'cpca-table', adapterVersion: ADAPTER_VERSION,
    sources, fields: fieldsAll, records,
    transformations: [{
      transformId: `t:w2l:${dsId}`,
      type: 'wide_to_long', inputSourceIds: sources.map((s) => s.sourceId),
      description: '月份×年份宽表转长表：观测单位 年×月，各指标（万辆）分别定位到各自来源列',
      fieldIds: TOTAL_MEASURES.map((t) => t.fieldId),
      affectedCount: records.length,
    }],
    issues,
    graph: buildGraph(dsId, 'D3 乘联会总量表（零售/批发/产量/出口/整体，万辆）', sources, fieldsAll.filter((f2) => f2.role === 'measure')),
  };
}

/* ---------------- 2. 份额表 ---------------- */

async function buildShare(files: CpcaFile[], issues: Issue[]): Promise<DatasetBundle> {
  const dsId = 'ds:d3-cpca-share-monthly';
  const fields: Field[] = [
    { fieldId: 'year_month', label: '年月', role: 'dimension', valueType: 'string', unit: '', meaning: '年月（YYYY-MM）', definitionStatus: 'confirmed', analysisPolicy: 'allowed' },
  ];
  const pushMeasure = (fieldId: string, label: string) => {
    fields.push({
      fieldId, label, role: 'measure', valueType: 'number', unit: '%',
      meaning: `${label}（乘联会口径，百分数点）`, definitionStatus: 'confirmed', analysisPolicy: 'allowed',
    });
  };

  interface Agg { values: Record<string, CellValue>; prov: Record<string, SourceRef[]> }
  const map = new Map<string, Agg>();

  const ingest = (f: CpcaFile, cols: { col: number; fieldId: string }[]) => {
    f.rows.forEach((rec, r) => {
      const mc = parseMonthCell((rec[0] ?? '').trim());
      const key = ym(mc.y ?? 0, mc.m);
      if (mc.y === null) {
        issues.push({
          code: 'D3_SHARE_MONTH_AMBIGUOUS', severity: 'error',
          message: `份额表月份缺年份（${f.source.originalFileName} 行 ${r + 1}）："${rec[0]}"`,
          sourceRefs: [{ sourceId: f.source.sourceId, recordIndex: r + 1, columnIndex: 0 }],
        });
        return;
      }
      let agg = map.get(key);
      if (!agg) {
        agg = { values: { year_month: key }, prov: {} };
        map.set(key, agg);
      }
      for (const { col, fieldId } of cols) {
        const raw = (rec[col] ?? '').trim();
        if (raw === '') continue;
        const n = parseNumber(raw);
        if (!n.ok) continue;
        if (agg.values[fieldId] !== undefined) {
          issues.push({
            code: 'D3_CPCA_CONFLICT', severity: 'error',
            message: `重复键：${fieldId} ${key}（${f.source.originalFileName}）`,
            fieldId: fieldId,
            sourceRefs: [{ sourceId: f.source.sourceId, recordIndex: r + 1, columnIndex: col }],
          });
          continue;
        }
        agg.values[fieldId] = n.value;
        agg.prov[fieldId] = [{ sourceId: f.source.sourceId, recordIndex: r + 1, columnIndex: col }];
      }
    });
  };

  for (const f of files) {
    const name = f.source.originalFileName;
    if (/CPCA_fuel_销量占比_ICE_NEV\.csv$/.test(name)) {
      pushMeasure('nev_share', '新能源零售占比');
      pushMeasure('ice_share', '传统燃油零售占比');
      const cols: { col: number; fieldId: string }[] = [];
      f.headers.forEach((h, col) => {
        if (h === 'NEV') cols.push({ col, fieldId: 'nev_share' });
        else if (h === 'ICE') cols.push({ col, fieldId: 'ice_share' });
      });
      ingest(f, cols);
    } else if (/CPCA_country\.csv$/.test(name)) {
      COUNTRY_NAMES.forEach((cn, i) => pushMeasure(`country_${COUNTRY_SLUGS[i]}_share`, `${cn}份额`));
      const cols: { col: number; fieldId: string }[] = [];
      f.headers.forEach((h, col) => {
        const i = COUNTRY_NAMES.indexOf(h);
        if (i >= 0) cols.push({ col, fieldId: `country_${COUNTRY_SLUGS[i]}_share` });
      });
      ingest(f, cols);
    } else {
      const seg = SEGMENTS.find((s) => name.endsWith(s.file));
      if (!seg) continue;
      const grades = ['A0', 'A', 'B', 'C'];
      for (const g of grades) pushMeasure(`seg_${seg.prefix}_${g.toLowerCase()}_share`, `${seg.label} ${g} 级份额`);
      const cols: { col: number; fieldId: string }[] = [];
      f.headers.forEach((h, col) => {
        const g = grades.indexOf(h);
        if (g >= 0) cols.push({ col, fieldId: `seg_${seg.prefix}_${grades[g].toLowerCase()}_share` });
      });
      ingest(f, cols);
    }
  }

  const records: RecordRow[] = [...map.keys()]
    .sort()
    .map((k) => {
      const agg = map.get(k)!;
      return { recordId: `rec:d3-cpca-share:${k}`, values: agg.values, provenance: agg.prov };
    });

  const sources = files.map((f) => f.source);
  const version = await datasetVersion('cpca-table', ADAPTER_VERSION, sources.map((s) => s.sha256), fields.map((f2) => f2.fieldId));
  return {
    schemaVersion: 1, datasetId: dsId, datasetVersion: version, domain: 'D3',
    adapterType: 'cpca-table', adapterVersion: ADAPTER_VERSION,
    sources, fields, records,
    transformations: [{
      transformId: `t:w2l:${dsId}`,
      type: 'wide_to_long', inputSourceIds: sources.map((s) => s.sourceId),
      description: '份额表按年月归位：NEV/ICE、国别、各细分市场级别份额（%），观测单位 年×月',
      fieldIds: fields.filter((f2) => f2.role === 'measure').map((f2) => f2.fieldId),
      affectedCount: records.length,
    }],
    issues,
    graph: buildGraph(dsId, 'D3 乘联会结构与份额表（%）', sources, fields.filter((f2) => f2.role === 'measure')),
  };
}

/* ---------------- 3. 厂商批发榜 ---------------- */

async function buildManrank(files: CpcaFile[], issues: Issue[]): Promise<DatasetBundle> {
  const dsId = 'ds:d3-cpca-manrank';
  const fields: Field[] = [
    { fieldId: 'vendor', label: '厂商', role: 'identifier', valueType: 'string', unit: '', meaning: '厂商名称（乘联会口径）', definitionStatus: 'confirmed', analysisPolicy: 'allowed' },
    { fieldId: 'year_month', label: '年月', role: 'dimension', valueType: 'string', unit: '', meaning: '年月（YYYY-MM）', definitionStatus: 'confirmed', analysisPolicy: 'allowed' },
    { fieldId: 'wholesale_single', label: '单月批发', role: 'measure', valueType: 'number', unit: '万辆', meaning: '当月厂商批发销量（万辆）', definitionStatus: 'confirmed', analysisPolicy: 'allowed' },
    { fieldId: 'wholesale_cum', label: '累计批发', role: 'measure', valueType: 'number', unit: '万辆', meaning: '年内累计厂商批发销量（万辆，单月与累计不混算）', definitionStatus: 'confirmed', analysisPolicy: 'allowed' },
  ];

  interface Agg { values: Record<string, CellValue>; prov: Record<string, SourceRef[]> }
  const map = new Map<string, Agg>();

  for (const f of files) {
    const isCum = /累计/.test(f.source.originalFileName);
    const fieldId = isCum ? 'wholesale_cum' : 'wholesale_single';
    const yearCols: { col: number; y: number; m: number }[] = [];
    f.headers.forEach((h, col) => {
      const m = h.match(/^(\d{4})年(\d{1,2})月$/);
      if (m) yearCols.push({ col, y: Number(m[1]), m: Number(m[2]) });
    });
    f.rows.forEach((rec, r) => {
      const vendor = (rec[0] ?? '').trim();
      if (vendor === '') return;
      for (const { col, y, m } of yearCols) {
        const raw = (rec[col] ?? '').trim();
        if (raw === '') continue;
        const n = parseNumber(raw);
        if (!n.ok) continue;
        const key = `${vendor}|${ym(y, m)}`;
        let agg = map.get(key);
        if (!agg) {
          agg = { values: { vendor, year_month: ym(y, m) }, prov: {} };
          map.set(key, agg);
        }
        if (agg.values[fieldId] !== undefined) {
          issues.push({
            code: 'D3_CPCA_CONFLICT', severity: 'error',
            message: `重复键：${fieldId} ${vendor} ${y}-${m}（${f.source.originalFileName}）`,
            fieldId,
            sourceRefs: [{ sourceId: f.source.sourceId, recordIndex: r + 1, columnIndex: col }],
          });
          continue;
        }
        agg.values[fieldId] = n.value;
        agg.prov[fieldId] = [{ sourceId: f.source.sourceId, recordIndex: r + 1, columnIndex: col }];
      }
    });
  }

  const records: RecordRow[] = [...map.keys()].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')).map((k) => {
    const agg = map.get(k)!;
    const [vendor, m] = k.split('|');
    return { recordId: `rec:d3-cpca-manrank:${vendor}:${m}`, values: agg.values, provenance: agg.prov };
  });

  const sources = files.map((f) => f.source);
  const version = await datasetVersion('cpca-table', ADAPTER_VERSION, sources.map((s) => s.sha256), fields.map((f2) => f2.fieldId));
  return {
    schemaVersion: 1, datasetId: dsId, datasetVersion: version, domain: 'D3',
    adapterType: 'cpca-table', adapterVersion: ADAPTER_VERSION,
    sources, fields, records,
    transformations: [{
      transformId: `t:w2l:${dsId}`,
      type: 'wide_to_long', inputSourceIds: sources.map((s) => s.sourceId),
      description: '厂商×年月长表：单月批发与累计批发分别成字段（万辆），来自单月/累计两张表',
      fieldIds: ['wholesale_single', 'wholesale_cum'],
      affectedCount: records.length,
    }],
    issues,
    graph: buildGraph(dsId, 'D3 乘联会厂商批发榜（单月/累计，万辆）', sources, fields.filter((f2) => f2.role === 'measure')),
  };
}

/** CPCA 全家桶：13 张表 → 3 份 Bundle。 */
export async function buildCpcaBundles(files: InputFile[]): Promise<DatasetBundle[]> {
  const loaded = await Promise.all(files.map(loadOne));
  const issues: Issue[] = [];
  const bundles: DatasetBundle[] = [];
  for (const family of ['total', 'share', 'manrank'] as CpcaFamily[]) {
    const group = loaded.filter((l) => l.family === family);
    if (group.length === 0) continue;
    if (family === 'total') bundles.push(await buildTotal(group, issues));
    else if (family === 'share') bundles.push(await buildShare(group, issues));
    else bundles.push(await buildManrank(group, issues));
  }
  return bundles;
}
