/**
 * D1 适配器：nbs-regional-wide —— 国家统计局居民收支（31 省年份宽表）。
 *
 * 口径（handoff/00_共同上下文.md §4、TASK.md）：
 * - 19 张宽表合成一份 Bundle：观测单位 = 地区 × 年份（2020–2024）。
 * - 首列空表头显式识别为地区；年份列倒序（2024→2020）。
 * - 全体/城镇/农村分别成字段，不混算；31 省简单均值不是全国人口加权均值（由解读层负责表达）。
 * - 微波炉/照相机 2023 起停更：2023/2024 为 null（缺失不是零），发 issue 说明。
 */
import { parseCsv } from '../csv.ts';
import { decodeBytes, makeSourceFile, parseNumber, datasetVersion } from '../util.ts';
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
const DS_ID = 'ds:d1-resident-income-expenditure';

/** 耐用品指标 → 字段 slug。 */
const DURABLE_SLUGS: Record<string, string> = {
  家用汽车: 'car',
  彩色电视机: 'tv_color',
  微波炉: 'microwave',
  排油烟机: 'range_hood',
  摩托车: 'motorcycle',
  洗衣机: 'washer',
  热水器: 'water_heater',
  照相机: 'camera',
  电冰箱: 'fridge',
  电动助力车: 'e_bike',
  移动电话: 'mobile_phone',
  空调: 'air_conditioner',
  计算机: 'computer',
};

type Kind = 'income' | 'expend' | 'durable';
type Category = 'all' | 'urban' | 'rural' | null;

interface D1File {
  source: SourceFile;
  kind: Kind;
  slug: string;
  label: string;
  unit: string;
  years: number[]; // 按列序
  regions: string[]; // 按行序（strip 后）
  cellRefs: SourceRef[][]; // [行][年份列序] → SourceRef
  values: (string | null)[][]; // 原始字符串，空 → null
}

function categorize(fileName: string): { kind: Kind; category: Category } {
  const kind: Kind = fileName.includes('_income__')
    ? 'income'
    : fileName.includes('_expend__')
      ? 'expend'
      : 'durable';
  let category: Category = null;
  if (kind !== 'durable') {
    category = fileName.includes('全体居民') ? 'all' : fileName.includes('城镇居民') ? 'urban' : 'rural';
  }
  return { kind, category };
}

function durableMeta(fileName: string): { slug: string; label: string; unit: string } {
  const m = fileName.match(/每百户年末(.+?)拥有量\((.+?)\)/);
  const item = m ? m[1] : '未知耐用品';
  const unitRaw = m ? m[2] : '台';
  let slug = 'unknown';
  for (const [key, s] of Object.entries(DURABLE_SLUGS)) {
    if (item.includes(key)) {
      slug = s;
      break;
    }
  }
  return { slug: `durable_${slug}`, label: `每百户年末${item}拥有量`, unit: `${unitRaw}/百户` };
}

async function loadOne(file: InputFile): Promise<D1File> {
  const { text, encoding } = decodeBytes(file.bytes);
  const parsed = parseCsv(text);
  const source = await makeSourceFile(file.name, file.bytes, parsed.headers, parsed.rawRecords, encoding);

  const headers = parsed.headers;
  const yearCols: { col: number; year: number }[] = [];
  for (let c = 1; c < headers.length; c++) {
    const m = headers[c].match(/^(\d{4})年$/);
    if (m) yearCols.push({ col: c, year: Number(m[1]) });
  }
  if (yearCols.length === 0) throw new Error(`D1 文件缺少年份列：${file.name}`);

  const regions: string[] = [];
  const values: (string | null)[][] = [];
  const cellRefs: SourceRef[][] = [];
  parsed.rawRecords.forEach((rec, r) => {
    regions.push((rec[0] ?? '').trim());
    const rowVals: (string | null)[] = [];
    const rowRefs: SourceRef[] = [];
    for (const { col } of yearCols) {
      const raw = (rec[col] ?? '').trim();
      rowVals.push(raw === '' ? null : raw);
      rowRefs.push({ sourceId: source.sourceId, recordIndex: r + 1, columnIndex: col });
    }
    values.push(rowVals);
    cellRefs.push(rowRefs);
  });

  const { kind, category } = categorize(file.name);
  let meta: { slug: string; label: string; unit: string };
  if (kind === 'durable') {
    meta = durableMeta(file.name);
  } else {
    const cn = category === 'all' ? '全体' : category === 'urban' ? '城镇' : '农村';
    meta = {
      slug: `${kind}_${category}`,
      label: kind === 'income' ? `人均可支配收入（${cn}居民）` : `人均消费支出（${cn}居民）`,
      unit: '元',
    };
  }

  return {
    source,
    kind,
    slug: meta.slug,
    label: meta.label,
    unit: meta.unit,
    years: yearCols.map((y) => y.year),
    regions,
    cellRefs,
    values,
  };
}

/** D1 组导入：多份宽表 → 一份 Bundle（观测单位 地区×年份）。 */
export async function buildD1Bundle(files: InputFile[]): Promise<DatasetBundle> {
  const loaded = await Promise.all(files.map(loadOne));
  const issues: Issue[] = [];

  const regionsSet = new Set<string>();
  for (const l of loaded) for (const r of l.regions) if (r) regionsSet.add(r);
  const regions = [...regionsSet].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  const yearsSet = new Set<number>();
  for (const l of loaded) for (const y of l.years) yearsSet.add(y);
  const years = [...yearsSet].sort((a, b) => a - b);

  // 文件内地区唯一性检查
  const indexByFile = loaded.map((l) => {
    const m = new Map<string, number>();
    l.regions.forEach((r, i) => {
      if (m.has(r)) {
        issues.push({
          code: 'D1_DUP_REGION',
          severity: 'error',
          message: `文件 ${l.source.originalName} 内地区重复：${r}`,
          sourceRefs: [{ sourceId: l.source.sourceId, recordIndex: i + 1, columnIndex: 0 }],
        });
      }
      m.set(r, i);
    });
    return m;
  });

  const fields: Field[] = [
    {
      fieldId: 'region',
      label: '地区',
      role: 'identifier',
      valueType: 'string',
      unit: null,
      meaning: '省级行政区（国家统计局分省口径）',
      definitionStatus: 'confirmed',
      analysisPolicy: 'allowed',
    },
    {
      fieldId: 'year',
      label: '年份',
      role: 'dimension',
      valueType: 'number',
      unit: null,
      meaning: '统计年份',
      definitionStatus: 'confirmed',
      analysisPolicy: 'allowed',
    },
  ];
  for (const l of loaded) {
    fields.push({
      fieldId: l.slug,
      label: l.label,
      role: 'measure',
      valueType: 'number',
      unit: l.unit,
      meaning: l.kind === 'durable' ? '居民平均每百户年末拥有量（年末存量）' : '人均水平（年度）',
      definitionStatus: 'confirmed',
      analysisPolicy: 'allowed',
    });
  }

  const records: RecordRow[] = [];
  for (const region of regions) {
    for (const year of years) {
      const valuesMap: Record<string, CellValue> = { region, year };
      const prov: Record<string, SourceRef[]> = {};
      loaded.forEach((l, fi) => {
        const yi = l.years.indexOf(year);
        if (yi < 0) return;
        const ri = indexByFile[fi].get(region);
        if (ri === undefined) return;
        const raw = l.values[ri][yi];
        if (raw === null) return; // 停更/缺失 → null，不补零
        const num = parseNumber(raw);
        if (!num.ok) {
          issues.push({
            code: 'D1_NON_NUMERIC',
            severity: 'warning',
            message: `非数值：${region} ${year} ${l.slug} = "${raw}"`,
            fieldId: l.slug,
            sourceRefs: [l.cellRefs[ri][yi]],
          });
          return;
        }
        valuesMap[l.slug] = num.value;
        prov[l.slug] = [l.cellRefs[ri][yi]];
      });
      records.push({ recordId: `rec:d1:${region}:${year}`, values: valuesMap, provenance: prov });
    }
  }

  const latestYear = years[years.length - 1];
  for (const l of loaded) {
    if (!l.years.includes(latestYear)) {
      issues.push({
        code: 'D1_DISCONTINUED',
        severity: 'info',
        message: `${l.label}：源文件未提供 ${latestYear} 年数据（停更），${latestYear} 年为 null，不插补`,
        fieldId: l.slug,
      });
    }
  }

  const transformations: Transformation[] = loaded.map((l) => ({
    transformId: `t:w2l:${l.source.sourceId}`,
    type: 'wide_to_long',
    inputSourceIds: [l.source.sourceId],
    description: `年份宽表转长表：地区×年份观测，字段 ${l.slug}（年份列 ${l.years.join('/')}，地区列为空表头首列）`,
    affectedFields: [l.slug],
    affectedCount: l.regions.length * l.years.length,
  }));

  const sources = loaded.map((l) => l.source);
  const version = await datasetVersion(
    'nbs-regional-wide',
    ADAPTER_VERSION,
    sources.map((s) => s.sha256),
    fields.map((f) => f.fieldId),
  );

  return {
    schemaVersion: 1,
    datasetId: DS_ID,
    datasetVersion: version,
    domain: 'D1',
    adapterType: 'nbs-regional-wide',
    adapterVersion: ADAPTER_VERSION,
    sources,
    fields,
    records,
    transformations,
    issues,
    graph: buildGraph(DS_ID, 'D1 居民收支（31省×2020–2024）', sources, fields.filter((f) => f.role === 'measure')),
  };
}
