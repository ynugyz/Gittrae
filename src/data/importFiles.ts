/**
 * 人员1 对外接口：importFiles(files, options) → Promise<DatasetBundle[]>
 *
 * - 按文件名模式识别适配器（文件名只是入口线索，字段与表内容在适配器内核对）；
 *   可用 options.adapterHints 覆盖。
 * - 分组规则：
 *   D1：NBS_fsYearData_* → 一份 Bundle（地区×年份）
 *   D2：EM_yjbb_*        → 一份 Bundle（公司×报告期）
 *   D3：GASGOO_rank_firm_* / GASGOO_rank_model_* → 各一份 Bundle
 *       CPCA_*           → 三份 Bundle（total / share / manrank）
 *   其余                  → 每文件一份 generic-csv Bundle
 * - 同内容文件（同 sha256）复用来源身份；文件名仅作展示别名。
 * - 不修改原始字节；所有规范化产物附带 SourceRef 定位。
 */
import { buildD1Bundle } from './adapters/d1.ts';
import { buildD2Bundle } from './adapters/d2.ts';
import { buildGasgooBundle, gasgooKindOf } from './adapters/gasgoo.ts';
import { buildCpcaBundles, cpcaFamilyOf } from './adapters/cpca.ts';
import { buildGenericBundle } from './adapters/generic.ts';
import type { AdapterType, DatasetBundle, ImportOptions, InputFile } from './types.ts';

export type DetectedAdapter = AdapterType;

/** 文件名 → 适配器提示（入口线索，不做内容判定）。 */
export function detectAdapter(fileName: string): DetectedAdapter {
  if (/^NBS_fsYearData_/.test(fileName)) return 'nbs-regional-wide';
  if (/^EM_yjbb_/.test(fileName)) return 'eastmoney-financial';
  if (/^GASGOO_rank_/.test(fileName)) return 'gasgoo-ranking';
  if (/^CPCA_/.test(fileName)) return 'cpca-table';
  return 'generic-csv';
}

export async function importFiles(files: InputFile[], options: ImportOptions = {}): Promise<DatasetBundle[]> {
  if (files.length === 0) return [];
  const bundles = await buildBundles(files, options);
  // 契约：缺失一律显式 null（不是 undefined，更不是 0）
  return bundles.map(withExplicitNulls);
}

function withExplicitNulls(bundle: DatasetBundle): DatasetBundle {
  const fieldIds = bundle.fields.map((f) => f.fieldId);
  for (const r of bundle.records) {
    for (const fid of fieldIds) {
      if (r.values[fid] === undefined) r.values[fid] = null;
    }
  }
  return bundle;
}

async function buildBundles(files: InputFile[], options: ImportOptions): Promise<DatasetBundle[]> {

  // 去重：同内容（sha256 由适配器计算后天然复用 sourceId）；此处按字节长度+文件名快速分组即可，
  // 真正的来源身份复用发生在 makeSourceFile（同 sha → 同 sourceId）。
  const groups: {
    d1: InputFile[];
    d2: InputFile[];
    gasgooFirm: InputFile[];
    gasgooModel: InputFile[];
    cpca: InputFile[];
    generic: InputFile[];
  } = { d1: [], d2: [], gasgooFirm: [], gasgooModel: [], cpca: [], generic: [] };

  for (const f of files) {
    const hint = options.adapterHints?.[f.name] ?? detectAdapter(f.name);
    if (hint === 'nbs-regional-wide') groups.d1.push(f);
    else if (hint === 'eastmoney-financial') groups.d2.push(f);
    else if (hint === 'gasgoo-ranking') {
      const kind = gasgooKindOf(f.name);
      (kind === 'firm' ? groups.gasgooFirm : groups.gasgooModel).push(f);
    } else if (hint === 'cpca-table') {
      cpcaFamilyOf(f.name); // 校验可识别，未知类型在适配器内报错
      groups.cpca.push(f);
    } else {
      groups.generic.push(f);
    }
  }

  const bundles: DatasetBundle[] = [];
  if (groups.d1.length > 0) bundles.push(await buildD1Bundle(groups.d1));
  if (groups.d2.length > 0) bundles.push(await buildD2Bundle(groups.d2));
  if (groups.gasgooFirm.length > 0) bundles.push(await buildGasgooBundle(groups.gasgooFirm));
  if (groups.gasgooModel.length > 0) bundles.push(await buildGasgooBundle(groups.gasgooModel));
  if (groups.cpca.length > 0) bundles.push(...(await buildCpcaBundles(groups.cpca)));
  for (const f of groups.generic) {
    bundles.push(await buildGenericBundle(f, options));
  }
  return bundles;
}

export { buildD1Bundle } from './adapters/d1.ts';
export { buildD2Bundle, isAshareCode } from './adapters/d2.ts';
export { buildGasgooBundle } from './adapters/gasgoo.ts';
export { buildCpcaBundles } from './adapters/cpca.ts';
export { buildGenericBundle } from './adapters/generic.ts';
export { parseCsv, parseCsvText } from './csv.ts';
export type * from './types.ts';
