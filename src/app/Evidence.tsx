import { useEffect, useRef, useState } from "react";
import type {
  EvidenceRecord,
  MetricEvidence,
  RecordEvidenceGroup,
} from "../graph";
import { number } from "./Charts";

export type EvidenceView = {
  title: string;
  metric?: MetricEvidence;
  group?: RecordEvidenceGroup;
};
export default function Evidence({
  view,
  onClose,
}: {
  view: EvidenceView;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [excluded, setExcluded] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  const metric = view.metric;
  const records: EvidenceRecord[] = metric
    ? excluded
      ? metric.excludedRecords
      : metric.validRecords
    : view.group!.records;
  const transformations =
    metric?.transformations ?? view.group?.transformations ?? [];
  return (
    <dialog
      ref={dialog}
      className="evidence-dialog"
      aria-labelledby="evidence-title"
      onCancel={onClose}
    >
      <div className="dialog-header">
        <div>
          <span className="eyebrow">EVIDENCE / 原始依据</span>
          <h2 id="evidence-title">{view.title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="关闭来源明细"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {metric && (
        <div className="evidence-meta">
          <strong>
            {number(metric.result.value)} <small>{metric.result.unit}</small>
          </strong>
          <p>{metric.result.method}</p>
          <p>{metric.scope.label}</p>
          <details>
            <summary>计算参数与筛选快照</summary>
            <pre>
              {JSON.stringify(
                {
                  analysisId: metric.analysisId,
                  fullPrecisionValue: metric.result.value,
                  parameters: metric.result.parameters,
                  filters: metric.scope.filters,
                },
                null,
                2,
              )}
            </pre>
          </details>
          <div className="tabs">
            <button
              className={!excluded ? "active" : ""}
              onClick={() => {
                setExcluded(false);
                setPage(0);
              }}
            >
              有效记录 {metric.validCount}
            </button>
            <button
              className={excluded ? "active" : ""}
              onClick={() => {
                setExcluded(true);
                setPage(0);
              }}
            >
              排除记录 {metric.excludedCount}
            </button>
          </div>
        </div>
      )}
      <p className="muted">
        记录编号从 1 开始、不含表头；列索引从 0
        开始。引号内换行仍属于同一条记录。
      </p>
      <div className="evidence-rows">
        {records.slice(page * 15, (page + 1) * 15).map((record) => (
          <article className="evidence-record" key={record.recordId}>
            <h3>{record.recordId}</h3>
            {record.exclusionReason && (
              <p className="warning-text">排除原因：{record.exclusionReason}</p>
            )}
            {record.cells.map((cell) => (
              <div className="evidence-cell" key={cell.fieldId}>
                <div>
                  <strong>{cell.label}</strong>
                  <span>
                    {cell.value === null ? "缺失" : String(cell.value)}{" "}
                    {cell.unit}
                  </span>
                </div>
                {cell.sources.length ? (
                  cell.sources.map((source, i) => (
                    <details key={i}>
                      <summary>
                        {source.fileName} · 第 {source.recordIndex} 条记录 · 第{" "}
                        {source.columnIndex} 列 · 原文「
                        {source.rawValue || "空字符串"}」
                      </summary>
                      <dl>
                        <dt>字段</dt>
                        <dd>{source.columnName || "空表头"}</dd>
                        <dt>来源编号</dt>
                        <dd>{source.sourceId}</dd>
                        <dt>文件 SHA-256</dt>
                        <dd>{source.sha256}</dd>
                      </dl>
                      <pre>{JSON.stringify(source.rawRecord)}</pre>
                    </details>
                  ))
                ) : (
                  <p className="muted">
                    此值无直接原始单元格，请检查下方转换记录。
                  </p>
                )}
              </div>
            ))}
          </article>
        ))}
        {records.length === 0 && <p className="empty-inline">没有此类记录。</p>}
      </div>
      {records.length > 15 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>
            上一页
          </button>
          <span>
            {page + 1} / {Math.ceil(records.length / 15)} · 共 {records.length}{" "}
            条
          </span>
          <button
            disabled={(page + 1) * 15 >= records.length}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </button>
        </div>
      )}
      {transformations.length > 0 && (
        <details className="transforms">
          <summary>数据转换记录（{transformations.length}）</summary>
          {transformations.map((t) => (
            <p key={t.transformId}>
              {t.description} · 影响 {t.affectedCount} 条
            </p>
          ))}
        </details>
      )}
    </dialog>
  );
}
