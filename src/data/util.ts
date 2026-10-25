/**
 * 通用工具：解码、哈希、Base64、数值解析、确定性 ID。
 * 全部无第三方依赖；sha256 使用 WebCrypto（Node 22 与浏览器均可用）。
 */
import type { CellValue, SourceFile } from './types.ts';

/** 字节 → UTF-8 文本，检测 BOM。 */
export function decodeBytes(bytes: Uint8Array): { text: string; encoding: string } {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8-sig' };
  }
  return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8' };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/**
 * 严格数值解析：'' / 空白 → null（缺失不是零）；非法字符串 → { ok:false }。
 * 零和负数保留。
 */
export function parseNumber(s: string): { value: CellValue; ok: boolean } {
  const t = s.trim();
  if (t === '') return { value: null, ok: true };
  if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
    const v = Number(t);
    if (Number.isFinite(v)) return { value: v, ok: true };
  }
  return { value: null, ok: false };
}

/** 解析带百分号的字符串："16.47%" → 16.47（百分数点，即 16.47%）。 */
export function parsePercent(s: string): { value: CellValue; ok: boolean } {
  const t = s.trim();
  if (t === '') return { value: null, ok: true };
  if (t.endsWith('%')) {
    return parseNumber(t.slice(0, -1));
  }
  return parseNumber(t);
}

/** 稳定 sourceId：sha256 前 20 位，同内容复用身份（文件名仅作展示别名）。 */
export function sourceIdFromSha(sha: string): string {
  return `src:${sha.slice(0, 20)}`;
}

/** 构造 SourceFile 的公共部分。 */
export async function makeSourceFile(
  name: string,
  bytes: Uint8Array,
  headers: string[],
  rawRecords: string[][],
  encoding: string,
): Promise<SourceFile> {
  const sha = await sha256Hex(bytes);
  return {
    sourceId: sourceIdFromSha(sha),
    originalName: name,
    sha256: sha,
    encoding,
    byteLength: bytes.length,
    parseOptions: { delimiter: ',', quote: '"', keepEmptyRecords: true },
    headers,
    rawRecords,
    rawBytesBase64: bytesToBase64(bytes),
  };
}

/** 规范数据版本：由适配器版本 + 有序源 sha + 字段清单的 sha256 决定（契约 §1）。 */
export async function datasetVersion(
  adapterType: string,
  adapterVersion: string,
  sourceShas: string[],
  fieldIds: string[],
): Promise<string> {
  const canonical =
    `v1|${adapterType}|${adapterVersion}|` +
    [...sourceShas].sort().join(',') +
    '|' +
    fieldIds.join(',');
  const sha = await sha256Hex(new TextEncoder().encode(canonical));
  return `v1:${sha.slice(0, 24)}`;
}

/** 月份格式化：2026, 8 → '2026-08'。 */
export function ym(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
