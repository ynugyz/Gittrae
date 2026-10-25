// 确定性统计原语。
// 口径固定为公共接口 v1：缺失逐列删除、样本标准差 n-1、type7 分位、Pearson 成对有效。
// 本模块不读取文件、不调用模型，只做纯计算。

/** 将来源单元格转为有限数值；空串与 null 视为缺失，0 与负数保留。 */
export function toFiniteNumber(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** 算术均值；无有效值返回 null。 */
export function mean(values) {
  if (!values.length) return null;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** type7 线性插值分位；无有效值返回 null。 */
export function quantileType7(values, p) {
  if (!values.length) return null;
  if (!(p >= 0 && p <= 1)) throw new RangeError('分位概率必须在 [0,1] 内');
  const sorted = [...values].sort((a, b) => a - b);
  const h = (sorted.length - 1) * p;
  const lower = Math.floor(h);
  const upper = Math.ceil(h);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (h - lower) * (sorted[upper] - sorted[lower]);
}

/** 中位数，等价于 type7 的 0.5 分位。 */
export function median(values) {
  return quantileType7(values, 0.5);
}

/** 样本标准差（分母 n-1）；n<2 返回 null。 */
export function sampleStdDev(values) {
  if (values.length < 2) return null;
  const mu = mean(values);
  let squares = 0;
  for (const value of values) squares += (value - mu) ** 2;
  return Math.sqrt(squares / (values.length - 1));
}

/**
 * Pearson 相关；调用方保证 xs/ys 为成对有效数值且长度一致。
 * n<2 或任一列方差为 0 时返回 { value: null, reason }。
 */
export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return { value: null, reason: 'insufficient_sample' };
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i];
    sumY += ys[i];
    sumXX += xs[i] * xs[i];
    sumYY += ys[i] * ys[i];
    sumXY += xs[i] * ys[i];
  }
  const numerator = n * sumXY - sumX * sumY;
  const left = n * sumXX - sumX * sumX;
  const right = n * sumYY - sumY * sumY;
  if (left <= 0 || right <= 0) return { value: null, reason: 'constant_field' };
  const denominator = Math.sqrt(left * right);
  if (!Number.isFinite(denominator) || denominator === 0) {
    return { value: null, reason: 'constant_field' };
  }
  const value = Math.max(-1, Math.min(1, numerator / denominator));
  return { value, reason: null };
}

/**
 * 10 等宽直方图，左闭右开，最后一箱包含右端点。
 * 常量范围扩展为 [value-0.5, value+0.5]；无有效值返回空数组。
 */
export function histogram(values) {
  if (!values.length) return { edges: [], counts: [], bins: [] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const low = min === max ? min - 0.5 : min;
  const high = min === max ? max + 0.5 : max;
  const width = (high - low) / 10;
  // 分箱边界按 12 位有效数字输出，避免 2.4000000000000004 这类浮点噪声进入图表数据。
  const edges = Array.from({ length: 11 }, (_, index) => Number((low + width * index).toPrecision(12)));
  edges[0] = low;
  edges[10] = high;
  const counts = new Array(10).fill(0);
  const bins = Array.from({ length: 10 }, () => []);
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    let index = Math.floor((value - low) / width + 1e-12);
    if (index < 0) index = 0;
    if (index > 9) index = 9;
    counts[index] += 1;
    bins[index].push(i);
  }
  return { edges, counts, bins };
}

/**
 * 箱线图摘要：type7 四分位，1.5 IQR 围栏，须线取围栏内最远实际观测值。
 * 返回值为数值摘要；异常点通过索引返回，便于调用方映射 recordId。
 */
export function boxplot(values) {
  if (!values.length) {
    return { q1: null, median: null, q3: null, iqr: null, lowerFence: null, upperFence: null, low: null, high: null, outliers: [] };
  }
  const q1 = quantileType7(values, 0.25);
  const q3 = quantileType7(values, 0.75);
  const mid = quantileType7(values, 0.5);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  let low = null;
  let high = null;
  const outliers = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value < lowerFence || value > upperFence) {
      outliers.push({ index, value });
      continue;
    }
    if (low === null || value < low) low = value;
    if (high === null || value > high) high = value;
  }
  return { q1, median: mid, q3, iqr, lowerFence, upperFence, low, high, outliers };
}
