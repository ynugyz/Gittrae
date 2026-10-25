/**
 * RFC4180 CSV 解析器（无依赖）。
 *
 * 契约要点（handoff/01_公共接口.md §1、data/README.md §3）：
 * - SourceRef.recordIndex 从 1 开始、不含表头；空记录也占位置，过滤后不得重编号。
 * - 引号内逗号/换行/转义引号按 RFC4180 处理；一条记录可跨物理行。
 * - 表头是单独一条记录，保留空表头（如 D1 首列地区）。
 */

export interface ParsedCsv {
  /** records[0] 为表头；其余为数据记录（空记录保留为一个空字段数组）。 */
  records: string[][];
}

const CR = 0x0d;
const LF = 0x0a;
const QUOTE = 0x22;
const COMMA = 0x2c;

/** 解析整个文本。返回全部记录（含表头与空记录）。 */
export function parseCsvText(text: string): ParsedCsv {
  const records: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let fieldStarted = false; // 当前记录是否已产生任何字段（含空字段）
  let sawCharSinceSep = false; // 自上一个记录分隔符以来是否消费了任何字符

  const pushField = () => {
    row.push(field);
    field = '';
    fieldStarted = true;
  };
  const pushRecord = () => {
    pushField();
    records.push(row);
    row = [];
    fieldStarted = false;
    sawCharSinceSep = false;
  };

  let prev = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inQuotes) {
      if (c === QUOTE) {
        if (i + 1 < text.length && text.charCodeAt(i + 1) === QUOTE) {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += text[i];
      }
      sawCharSinceSep = true;
    } else if (c === QUOTE && field === '') {
      inQuotes = true;
      sawCharSinceSep = true;
    } else if (c === COMMA) {
      pushField();
    } else if (c === CR || c === LF) {
      // \r\n 视为一个分隔符
      if (c === CR && i + 1 < text.length && text.charCodeAt(i + 1) === LF) i++;
      pushRecord();
    } else {
      field += text[i];
      sawCharSinceSep = true;
    }
    prev = c;
  }

  // 文件末尾：只有当末尾没有以记录分隔符结束、且当前记录已有内容时才补一条记录。
  // 空记录判定：自分隔符以来无任何字符 → 不是新记录（避免文件末尾换行产生虚假空记录）。
  if (sawCharSinceSep || fieldStarted) {
    if (!(field === '' && row.length === 0 && !sawCharSinceSep)) {
      pushField();
      records.push(row);
    }
  }
  // 修正：若最后以分隔符结尾且当前 row 为空但 fieldStarted（如 "a\nb," ）→ 已 push。
  // 若文本以分隔符结束（如 "a,b\n"），上面循环里 pushRecord 已处理，末尾不会再补。

  return { records };
}

/** 去除 UTF-8 BOM。 */
export function stripBom(text: string): { text: string; hadBom: boolean } {
  if (text.charCodeAt(0) === 0xfeff) {
    return { text: text.slice(1), hadBom: true };
  }
  return { text, hadBom: false };
}

export interface CsvParseResult {
  headers: string[]; // 保留空表头
  rawRecords: string[][]; // 表头之后的数据记录（原始字符串），recordIndex = 数组下标 + 1
  hadBom: boolean;
}

/** 解析 CSV 文本为表头 + 原始记录。至少需要表头一行。 */
export function parseCsv(text: string): CsvParseResult {
  const { text: t, hadBom } = stripBom(text);
  const { records } = parseCsvText(t);
  if (records.length === 0) {
    throw new Error('CSV 为空：缺少表头记录');
  }
  return {
    headers: records[0],
    rawRecords: records.slice(1),
    hadBom,
  };
}
