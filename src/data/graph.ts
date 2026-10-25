/**
 * 基础信息网络图分片（owner='data'）。
 * 契约（handoff/01_公共接口.md §2 GraphFragment）：
 * - 只产出 derived_from（dataset→source）与 contains（dataset→indicator）两种边。
 * - 不为每个单元格建点；明细通过 SourceRef 按需读取。
 */
import type { Field, GraphFragment, SourceFile } from './types.ts';

export function buildGraph(
  datasetId: string,
  datasetLabel: string,
  sources: SourceFile[],
  measureFields: Field[],
): GraphFragment {
  const nodes = [
    { id: datasetId, type: 'dataset' as const, label: datasetLabel, ref: datasetId },
    ...sources.map((s) => ({
      id: `source:${s.sourceId}`,
      type: 'source' as const,
      label: s.originalFileName,
      ref: s.sourceId,
    })),
    ...measureFields.map((f) => ({
      id: `indicator:${datasetId}:${f.fieldId}`,
      type: 'indicator' as const,
      label: `${f.label}${f.unit ? `（${f.unit}）` : ''}`,
      ref: `${datasetId}:${f.fieldId}`,
    })),
  ];

  const edges = [
    ...sources.map((s) => ({
      id: `derived_from:${datasetId}:${s.sourceId}`,
      from: datasetId,
      to: `source:${s.sourceId}`,
      type: 'derived_from' as const,
    })),
    ...measureFields.map((f) => ({
      id: `contains:${datasetId}:${f.fieldId}`,
      from: datasetId,
      to: `indicator:${datasetId}:${f.fieldId}`,
      type: 'contains' as const,
    })),
  ];

  return { schemaVersion: 1, owner: 'data', nodes, edges };
}
