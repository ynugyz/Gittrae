/**
 * D3 适配器：gasgoo-ranking —— 盖世汽车月度榜单（车企榜 firm / 车型榜 model）。
 *
 * 口径（handoff/00_共同上下文.md §4、TASK.md）：
 * - 12 个月份表合成一份 Bundle（firm、model 各一份）：观测单位 = 名称 × 年月。
 * - 动态表头：'2026-8'（当月）、'8月同比'、'8月环比'、'2026-1到8'/'2025-1到8'/'2024-1到8'（各年累计）。
 * - 环比列源站口径异常（约 -68%~-94%），命题文档禁止用于统计结论：
 *   analysisPolicy='excluded'，保留原值与来源，界面禁选、统计层独立拒绝。
 * - Top50 是榜单截尾样本，不能声称整个市场（由解读层表达）。
 * - 单月与累计是不同度量，不混算。
 */
import { parseCsv } from '../csv.ts';
import { decodeBytes, makeSourceFile, parseNumber, parsePercent, datasetVersion, ym } from '../util.ts';
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

export type GasgooKind = 'firm' | 'model';

interface GasgooFile {
  source: SourceFile;
  kind: GasgooKind;
  fileMonth: { y: number; m: number }; // 文件名中的年月
  monthSales: { col: number; ym: string }[];
  yoy: { col: number; ym: string }[];
  mom: { col: number; ym: string }[];
  cum: { col: number; ym: string }[];
  nameCol: number;
  rows: string[][];
}

export function gasgooKindOf(fileName: string): GasgooKind {
  if (/GASGOO_rank_firm_\d{6}\.csv$/.test(fileName)) return 'firm';
  if (/GASGOO_rank_model_\d{6}\.csv$/.test(fileName)) return 'model';
  throw new Error(`非 GASGOO 榜单文件：${fileName}`);
}

async function loadOne(file: InputFile): Promise<GasgooFile> {
  const kind = gasgooKindOf(file.name);
  const fm = file.name.match(/GASGOO_rank_(?:firm|model)_(\d{4})(\d{2})\.csv$/);
  if (!fm) throw new Error(`无法从文件名解析年月：${file.name}`);
  const { text, encoding } = decodeBytes(file.bytes);
  const parsed = parseCsv(text);
  const source = await makeSourceFile(file.name, file.bytes, parsed.headers, parsed.rawRecords, encoding);

  const monthSales: GasgooFile['monthSales'] = [];
  const yoyCols: GasgooFile['yoy'] = [];
  const momCols: GasgooFile['mom'] = [];
  const cum: GasgooFile['cum'] = [];
  let nameCol = -1;

  parsed.headers.forEach((h, col) => {
    let m = h.match(/^(\d{4})-(\d{1,2})$/);
    if (m) {
      monthSales.push({ col, ym: ym(Number(m[1]), Number(m[2])) });
      return;
    }
    m = h.match(/^(\d{1,2})月同比$/);
    if (m) {
      yoyCols.push({ col, ym: ym(Number(fm[1]), Number(m[1])) });
      return;
    }
    m = h.match(/^(\d{1,2})月环比$/);
    if (m) {
      momCols.push({ col, ym: ym(Number(fm[1]), Number(m[1])) });
      return;
    }
    m = h.match(/^(\d{4})-1到(\d{1,2})$/);
    if (m) {
      cum.push({ col, ym: ym(Number(m[1]), Number(m[2])) });
      return;
    }
    if (h === '厂商' || h === '车型') nameCol = col;
  });
  if (nameCol < 0) throw new Error(`GASGOO 文件缺少名称列：${file.name}`);

  return {
    source,
    kind,
    fileMonth: { y: Number(fm[1]), m: Number(fm[2]) },
    monthSales,
    yoy: yoyCols,
    mom: momCols,
    cum,
    nameCol,
    rows: parsed.rawRecords,
  };
}

const MOM_EXCLUSION_REASON =
  '源站环比列口径异常（数值区间约 -68%~-94%，与市场实际变化不符），命题文档明确禁止用于统计结论；保留原值仅供展示与回源';

export async function buildGasgooBundle(files: InputFile[]): Promise<DatasetBundle> {
  const loaded = await Promise.all(files.map(loadOne));
  const kind = loaded[0].kind;
  const dsId = kind === 'firm' ? 'ds:d3-gasgoo-firm-monthly' : 'ds:d3-gasgoo-model-monthly';
  const nameLabel = kind === 'firm' ? '厂商' : '车型';
  const issues: Issue[] = [];

  const fields: Field[] = [
    {
      fieldId: kind === 'firm' ? 'vendor' : 'model',
      label: nameLabel, role: 'identifier', valueType: 'string', unit: '',
      meaning: `${nameLabel}名称（榜单内唯一键）`, definitionStatus: 'confirmed', analysisPolicy: 'allowed',
    },
    {
      fieldId: 'year_month', label: '年月', role: 'dimension', valueType: 'string', unit: '',
      meaning: '统计年月（YYYY-MM）', definitionStatus: 'confirmed', analysisPolicy: 'allowed',
    },
    {
      fieldId: 'month_sales', label: '当月销量', role: 'measure', valueType: 'number', unit: '辆',
      meaning: '当月销量（榜单 Top50 截尾样本）', definitionStatus: 'confirmed', analysisPolicy: 'allowed',
    },
    {
      fieldId: 'yoy', label: '同比', role: 'measure', valueType: 'number', unit: '%',
      meaning: '当月销量同比（百分数点：16.47 表示 16.47%）', definitionStatus: 'confirmed', analysisPolicy: 'allowed',
    },
    {
      fieldId: 'mom', label: '环比', role: 'measure', valueType: 'number', unit: '%',
      meaning: '当月销量环比（源站口径异常）', definitionStatus: 'confirmed',
      analysisPolicy: 'excluded', exclusionReason: MOM_EXCLUSION_REASON,
    },
    {
      fieldId: 'cum_ytd', label: '年内累计销量', role: 'measure', valueType: 'number', unit: '辆',
      meaning: '对应年份 1 月至当月累计销量（单月与累计不混算）',
      definitionStatus: 'confirmed', analysisPolicy: 'allowed',
    },
  ];

  // 合并：recordKey = name|ym
  interface Agg {
    values: Record<string, CellValue>;
    prov: Record<string, SourceRef[]>;
  }
  const map = new Map<string, Agg>();

  for (const l of loaded) {
    l.rows.forEach((rec, r) => {
      const name = (rec[l.nameCol] ?? '').trim();
      if (name === '') return;
      const recordIndex = r + 1;
      const ref = (col: number): SourceRef => ({ sourceId: l.source.sourceId, recordIndex, columnIndex: col });

      const ensure = (key: string) => {
        const k = `${name}|${key}`;
        let agg = map.get(k);
        if (!agg) {
          agg = {
            values: {
              [kind === 'firm' ? 'vendor' : 'model']: name,
              year_month: key,
            },
            prov: {},
          };
          map.set(k, agg);
        }
        return agg;
      };

      const put = (key: string, fieldId: string, value: CellValue, col?: number) => {
        if (value === null) return;
        const agg = ensure(key);
        if (agg.values[fieldId] !== undefined && agg.values[fieldId] !== null) {
          issues.push({
            code: 'D3_GASGOO_CONFLICT',
            severity: 'error',
            message: `重复键冲突：${name} ${key} 字段 ${fieldId} 已有值，来自 ${l.source.originalFileName}`,
            fieldId,
            sourceRefs: col !== undefined ? [ref(col)] : undefined,
          });
          return;
        }
        agg.values[fieldId] = value;
        if (col !== undefined) agg.prov[fieldId] = [ref(col)];
      };

      // 先按文件声明的列建立记录骨架（名称×年月），再填值——缺失单元格最终为显式 null
      for (const ms of l.monthSales) ensure(ms.ym);
      for (const c of l.yoy) ensure(c.ym);
      for (const c of l.mom) ensure(c.ym);
      for (const c of l.cum) ensure(c.ym);

      for (const ms of l.monthSales) {
        const raw = (rec[ms.col] ?? '').trim();
        if (raw === '') continue;
        const n = parseNumber(raw);
        if (!n.ok) {
          issues.push({
            code: 'D3_NON_NUMERIC', severity: 'warning',
            message: `非数值：${name} ${ms.ym} month_sales = "${raw}"`,
            fieldId: 'month_sales', sourceRefs: [ref(ms.col)],
          });
          continue;
        }
        put(ms.ym, 'month_sales', n.value, ms.col);
      }
      for (const c of l.yoy) {
        const raw = (rec[c.col] ?? '').trim();
        if (raw === '') continue;
        const n = parsePercent(raw);
        if (!n.ok) continue;
        put(c.ym, 'yoy', n.value, c.col);
      }
      for (const c of l.mom) {
        const raw = (rec[c.col] ?? '').trim();
        if (raw === '') continue;
        const n = parsePercent(raw);
        if (!n.ok) continue;
        put(c.ym, 'mom', n.value, c.col); // excluded 字段仍保留值与来源
      }
      for (const c of l.cum) {
        const raw = (rec[c.col] ?? '').trim();
        if (raw === '') continue;
        const n = parseNumber(raw);
        if (!n.ok) continue;
        put(c.ym, 'cum_ytd', n.value, c.col);
      }
    });
  }

  // 确定性排序：名称（zh locale）+ 年月
  const keys = [...map.keys()].sort((a, b) => {
    const [an, am] = a.split('|');
    const [bn, bm] = b.split('|');
    return an.localeCompare(bn, 'zh-Hans-CN') || am.localeCompare(bm);
  });
  const records: RecordRow[] = keys.map((k) => {
    const [name, m] = k.split('|');
    const agg = map.get(k)!;
    return {
      recordId: `rec:d3-gasgoo-${kind}:${name}:${m}`,
      values: agg.values,
      provenance: agg.prov,
    };
  });

  const transformations: Transformation[] = loaded.map((l) => ({
    transformId: `t:w2l:${l.source.sourceId}`,
    type: 'wide_to_long',
    inputSourceIds: [l.source.sourceId],
    description: `月份宽表转长表（${nameLabel}×年月）：当月/同比/环比/各年累计列按表头年月归位；环比列保留值但标为 excluded`,
    fieldIds: ['month_sales', 'yoy', 'mom', 'cum_ytd'],
    affectedCount: l.rows.length,
  }));
  const momCount = records.filter((r) => r.values['mom'] !== undefined && r.values['mom'] !== null).length;
  transformations.push({
    transformId: `t:policy-excluded:${dsId}:mom`,
    type: 'parse',
    inputSourceIds: loaded.map((l) => l.source.sourceId),
    description: `环比字段 analysisPolicy=excluded：${MOM_EXCLUSION_REASON}`,
    fieldIds: ['mom'],
    affectedCount: momCount,
  });

  issues.push({
    code: 'D3_MOM_EXCLUDED',
    severity: 'warning',
    message: `环比列已保留来源但 analysisPolicy=excluded：${MOM_EXCLUSION_REASON}；界面禁选，统计层独立拒绝`,
    fieldId: 'mom',
  });
  issues.push({
    code: 'D3_TOP50_SCOPE',
    severity: 'info',
    message: '盖世榜单为 Top50 截尾样本，不可声称覆盖全市场；市场总量分析请使用 CPCA 表',
  });

  const sources = loaded.map((l) => l.source);
  const version = await datasetVersion(
    'gasgoo-ranking', ADAPTER_VERSION,
    sources.map((s) => s.sha256),
    fields.map((f) => f.fieldId),
  );

  return {
    schemaVersion: 1,
    datasetId: dsId,
    datasetVersion: version,
    domain: 'D3',
    adapterType: 'gasgoo-ranking',
    adapterVersion: ADAPTER_VERSION,
    sources,
    fields,
    records,
    transformations,
    issues,
    graph: buildGraph(dsId, `D3 盖世${nameLabel}销量月榜（2025-09~2026-08）`, sources, fields.filter((f) => f.role === 'measure')),
  };
}
