import { createHash } from 'node:crypto';

/** 稳定序列化：对象键排序，保证相同输入得到相同身份。 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

/** 确定性短哈希；仅用于生成稳定 ID，不作为数据完整性校验。 */
export function shortHash(input, length = 24) {
  return createHash('sha256').update(input).digest('hex').slice(0, length);
}
