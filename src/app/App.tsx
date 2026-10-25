import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AnalysisRequest,
  DatasetBundle,
  Insight,
  ProjectSnapshot,
  Scalar,
} from "../contracts";
import { createExampleProject } from "../contracts/example";
import {
  currentGraph,
  getEvidence,
  getNeighborhood,
  getRecordEvidence,
} from "../graph";
import { exportProject, importProject, validateProject } from "../storage";
import {
  addAnalysis,
  addDatasets,
  applyInsightResponse,
  blankRequest,
  emptyProject,
} from "./state";
import { dataModule, moduleStatus } from "./modules";
import { requestAnalysis, requestInsights } from "./api";
import { NetworkChart, nodeNames, number, StatisticalChart } from "./Charts";
import Evidence, { type EvidenceView } from "./Evidence";

const domainNames = {
  D1: "居民收支",
  D2: "企业财务",
  D3: "汽车销量",
  generic: "通用数据",
};
const metricNames: Record<string, string> = {
  mean: "均值",
  median: "中位数",
  std: "样本标准差",
  pearson: "Pearson 相关",
  q1: "第一四分位",
  q3: "第三四分位",
  low: "下须",
  high: "上须",
  min: "最小值",
  max: "最大值",
};
type Tab = "overview" | "network" | "records";
function Icon({
  name,
}: {
  name: "grid" | "network" | "table" | "upload" | "save" | "arrow";
}) {
  const paths = {
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    network:
      "M6 6l12 3M6 6l5 13M18 9l-7 10M4 4h4v4H4zM16 7h4v4h-4zM9 17h4v4H9z",
    table: "M3 4h18v16H3zM3 10h18M9 4v16",
    upload: "M12 16V3M7 8l5-5 5 5M4 16v5h16v-5",
    save: "M4 3h13l4 4v14H4zM8 3v6h8V3M8 21v-7h9v7",
    arrow: "M5 12h14M13 6l6 6-6 6",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
function InsightText({
  insight,
  project,
  onResult,
}: {
  insight: Insight;
  project: ProjectSnapshot;
  onResult: (id: string) => void;
}) {
  const analysis = project.analyses.find(
    (a) => a.analysisId === insight.analysisId,
  )!;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of insight.textTemplate.matchAll(
    /\{\{result:([^{}]+)\}\}/g,
  )) {
    parts.push(insight.textTemplate.slice(last, match.index));
    const result = analysis.results.find((r) => r.resultId === match[1]);
    parts.push(
      <button
        key={match.index}
        className="inline-number"
        onClick={() => onResult(match[1])}
      >
        {number(result?.value ?? null)}
        {result?.unit ? ` ${result.unit}` : ""} ↗
      </button>,
    );
    last = match.index! + match[0].length;
  }
  parts.push(insight.textTemplate.slice(last));
  return <>{parts}</>;
}

export default function App() {
  const [project, setProject] = useState<ProjectSnapshot>(emptyProject);
  const [draft, setDraft] = useState<AnalysisRequest | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [chart, setChart] = useState<"histogram" | "scatter" | "boxplot">(
    "histogram",
  );
  const [fieldId, setFieldId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [aiStatus, setAiStatus] = useState<
    "idle" | "loading" | "error" | "success"
  >("idle");
  const [aiError, setAiError] = useState("");
  const [liveIds, setLiveIds] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<EvidenceView | null>(null);
  const [page, setPage] = useState(0);
  const [dirty, setDirty] = useState(false);
  const projectRef = useRef(project);
  projectRef.current = project;
  const aiRequest = useRef<AbortController | null>(null);
  const analysisRequest = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const csvInput = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null);
  const dataset = project.datasets.find(
    (d) => d.datasetId === project.selection.datasetId,
  );
  const analysis = project.analyses.find(
    (a) => a.analysisId === project.selection.analysisId,
  );
  const mock = !!dataset?.issues.some((i) => i.code === "MOCK");
  const measures =
    dataset?.fields.filter(
      (f) => f.role === "measure" && f.valueType === "number",
    ) ?? [];
  const graph = useMemo(
    () =>
      analysis
        ? currentGraph(project, analysis.analysisId)
        : (dataset?.graph ?? null),
    [project, analysis, dataset],
  );
  const selectedNode = graph?.nodes.find(
    (n) => n.id === project.selection.nodeId,
  );
  const localGraph =
    graph && graph.nodes.length > 60
      ? getNeighborhood(
          graph,
          selectedNode?.id ??
            graph.nodes.find((n) => n.type === "finding")?.id ??
            graph.nodes[0]?.id,
          2,
        )
      : graph;
  const insights = project.insights.filter(
    (i) => i.analysisId === analysis?.analysisId && i.status === "valid",
  );
  const activeRecords = useMemo(() => {
    const ids = analysis ? new Set(analysis.scope.recordIds) : null;
    return dataset?.records.filter((r) => !ids || ids.has(r.recordId)) ?? [];
  }, [dataset, analysis]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(
    () => () => {
      aiRequest.current?.abort();
      analysisRequest.current?.abort();
    },
    [],
  );
  function invalidateAI() {
    generation.current++;
    aiRequest.current?.abort();
    analysisRequest.current?.abort();
    setAiStatus("idle");
    setAiError("");
  }
  function replace(next: ProjectSnapshot, restored = false) {
    invalidateAI();
    projectRef.current = next;
    setProject(next);
    setDraft(
      next.analyses.find((a) => a.analysisId === next.selection.analysisId)
        ?.request ??
        (next.datasets.find((d) => d.datasetId === next.selection.datasetId)
          ? {
              ...blankRequest(
                next.datasets.find(
                  (d) => d.datasetId === next.selection.datasetId,
                )!,
              ),
              measureFieldIds: next.selection.measureFieldIds,
              correlationPair:
                next.selection.measureFieldIds.length >= 2
                  ? [
                      next.selection.measureFieldIds[0],
                      next.selection.measureFieldIds[1],
                    ]
                  : null,
            }
          : null),
    );
    setFieldId(next.selection.measureFieldIds[0] ?? "");
    setEvidence(null);
    setPage(0);
    setLiveIds([]);
    setDirty(!restored);
    setError("");
  }
  function selectDataset(
    bundle: DatasetBundle,
    base = projectRef.current,
    internal = false,
  ) {
    if (busy && !internal) return;
    invalidateAI();
    const defaults =
      dataModule?.getDefaultRequest?.(bundle) ?? blankRequest(bundle);
    setDraft(defaults);
    setFieldId(defaults.measureFieldIds[0] ?? "");
    setPage(0);
    const next = {
      ...base,
      selection: {
        datasetId: bundle.datasetId,
        analysisId: null,
        measureFieldIds: defaults.measureFieldIds,
        nodeId: null,
      },
    };
    projectRef.current = next;
    setProject(next);
    setDirty(true);
    if (
      !dataModule?.getDefaultRequest &&
      !bundle.issues.some((i) => i.code === "MOCK")
    )
      setNotice(
        "适配模块未提供默认范围，请明确选择指标与年份／月份，再开始分析。",
      );
  }
  function changeDraft(next: AnalysisRequest) {
    if (busy) return;
    invalidateAI();
    setDraft(next);
    setPage(0);
    setFieldId(next.measureFieldIds[0] ?? "");
    setProject((p) => ({
      ...p,
      selection: {
        ...p.selection,
        analysisId: null,
        measureFieldIds: next.measureFieldIds,
        nodeId: null,
      },
    }));
    setDirty(true);
  }
  async function action(label: string, work: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作未完成，请检查输入文件。");
    } finally {
      setBusy("");
    }
  }
  async function loadExample() {
    await action("正在打开样例", async () => {
      if (
        dirty &&
        project.datasets.length &&
        !confirm("打开联调样例将替换当前未保存项目，是否继续？")
      )
        return;
      replace(await validateProject(await createExampleProject()));
      setNotice(
        "已打开固定手算联调样例。可以体验图表回源、信息网络与保存恢复。",
      );
    });
  }
  async function upload(files: File[]) {
    if (!moduleStatus.data) {
      setError(
        "CSV 适配模块尚未接入，请由人员1提供 src/data/index.ts。可先打开联调样例或已有项目。",
      );
      return;
    }
    await action("正在导入并校验来源", async () => {
      const bundles = await dataModule.importFiles(files, {});
      if (!bundles.length)
        throw new Error("导入未产生数据集，请检查文件适配结果。");
      const next = await validateProject(
        addDatasets(projectRef.current, bundles),
      );
      selectDataset(bundles[0], next, true);
      setNotice(`已接收 ${bundles.length} 个数据集，请确认分析范围。`);
    });
  }
  async function analyze() {
    if (!dataset || !draft) return;
    const unfiltered = dataset.fields.filter(
      (f) =>
        f.role === "dimension" &&
        !draft.filters.some((filter) => filter.fieldId === f.fieldId) &&
        new Set(dataset.records.map((r) => r.values[f.fieldId])).size > 1,
    );
    if (
      unfiltered.length &&
      !confirm(
        `以下维度将包含全部取值：${unfiltered.map((f) => f.label).join("、")}。确认在这一范围内计算？`,
      )
    )
      return;
    await action("正在计算", async () => {
      invalidateAI();
      const ticket = generation.current;
      const base = projectRef.current;
      const request = structuredClone(draft);
      const controller = new AbortController();
      analysisRequest.current = controller;
      const { analysis: result, facts } = await requestAnalysis(
        dataset,
        request,
        controller.signal,
      );
      if (ticket !== generation.current || projectRef.current !== base) return;
      const next = await validateProject(
        addAnalysis(base, result, request, facts.insights),
      );
      if (ticket !== generation.current || projectRef.current !== base) return;
      replace(next);
      setNotice("分析完成，数字、图表与来源已绑定同一次计算。");
    });
  }
  async function generateAI() {
    if (!dataset || !analysis || mock) return;
    invalidateAI();
    const ticket = generation.current;
    const controller = new AbortController();
    aiRequest.current = controller;
    setAiStatus("loading");
    setAiError("");
    try {
      const response = await requestInsights(
        dataset,
        analysis,
        controller.signal,
      );
      if (ticket !== generation.current) return;
      const base = projectRef.current;
      const next = await validateProject(applyInsightResponse(base, response));
      if (ticket !== generation.current || projectRef.current !== base) return;
      projectRef.current = next;
      setProject(next);
      setLiveIds((ids) => [
        ...ids,
        ...response.insights.map((i) => i.insightId),
      ]);
      setAiStatus("success");
      setDirty(true);
    } catch (e) {
      if (ticket !== generation.current) return;
      setAiStatus("error");
      setAiError(
        e instanceof Error
          ? e.name === "TimeoutError"
            ? "请求超过60秒，请稍后重试。"
            : e.message
          : "模型请求失败。",
      );
    }
  }
  async function save() {
    await action("正在校验并保存项目", async () => {
      const savedProject = projectRef.current;
      const json = await exportProject({
        ...savedProject,
        savedAt: new Date().toISOString(),
      });
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `T3-${new Date().toISOString().slice(0, 10)}.t3project.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (projectRef.current === savedProject) setDirty(false);
      setNotice("项目文件已交给浏览器下载，包含原始来源与历史分析。");
    });
  }
  async function restore(file: File) {
    await action("正在验证并恢复项目", async () => {
      const next = await importProject(await file.text());
      if (
        dirty &&
        project.datasets.length &&
        !confirm("恢复项目将替换当前未保存内容，是否继续？")
      )
        return;
      replace(next, true);
      setNotice("项目已恢复。AI解读按历史记录展示，未重新发起模型请求。");
    });
  }
  function showResult(id: string) {
    try {
      const metric = getEvidence(projectRef.current, id);
      setEvidence({
        title: `${metricNames[metric.result.metric] ?? metric.result.metric} · 计算依据`,
        metric,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function showRecords(ids: string[], fields: string[]) {
    if (!dataset) return;
    try {
      setEvidence({
        title: "记录与原始单元格",
        group: getRecordEvidence(
          projectRef.current,
          dataset.datasetId,
          ids,
          fields,
          dataset.datasetVersion,
        ),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function selectNode(id: string) {
    if (busy) return;
    const node = graph?.nodes.find((n) => n.id === id);
    if (!node) return;
    setProject((p) => ({ ...p, selection: { ...p.selection, nodeId: id } }));
    setDirty(true);
    if (node.type === "calculation") showResult(node.ref);
    if (node.type === "indicator" && dataset) {
      const selected = dataset.fields.find((f) => f.fieldId === node.ref);
      if (selected?.analysisPolicy === "allowed") {
        changeDraft({
          ...(draft ?? blankRequest(dataset)),
          measureFieldIds: [node.ref],
          correlationPair: null,
        });
        setTab("overview");
        setNotice(
          "已选择图中的指标，旧分析已退出当前视图。点击“开始分析”生成对应分析。",
        );
      }
    }
  }
  function openAnalysis(id: string) {
    if (busy) return;
    const found = project.analyses.find((a) => a.analysisId === id);
    if (!found) return;
    replace({
      ...project,
      selection: {
        datasetId: found.datasetId,
        analysisId: id,
        measureFieldIds: found.request.measureFieldIds,
        nodeId: null,
      },
    });
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#main">
          <span className="brand-mark">
            T<span>3</span>
          </span>
          <span>
            数据洞察官<small>DATA · EVIDENCE · INSIGHT</small>
          </span>
        </a>
        <div className="workspace-label">
          我的工作空间 <span>LOCAL</span>
        </div>
        <nav aria-label="主导航">
          {(
            [
              ["overview", "grid", "分析工作台"],
              ["network", "network", "信息网络"],
              ["records", "table", "数据与来源"],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              className={tab === id ? "nav-item active" : "nav-item"}
              onClick={() => setTab(id)}
            >
              <Icon name={icon} />
              {label}
              {id === "network" && graph && (
                <span className="nav-count">{graph.nodes.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-section">
          <div className="sidebar-heading">
            项目数据{" "}
            <span>{project.datasets.length.toString().padStart(2, "0")}</span>
          </div>
          {project.datasets.length ? (
            project.datasets.map((d) => (
              <button
                className={`dataset-link ${dataset?.datasetId === d.datasetId ? "selected" : ""}`}
                key={d.datasetId}
                disabled={!!busy}
                onClick={() => selectDataset(d)}
              >
                <span className="dataset-icon">
                  {d.domain === "generic" ? "CSV" : d.domain}
                </span>
                <span>
                  {d.sources[0]?.originalFileName ?? d.datasetId}
                  <small>{d.records.length.toLocaleString()} 条记录</small>
                </span>
              </button>
            ))
          ) : (
            <p className="sidebar-empty">
              还没有导入数据
              <br />
              从一份 CSV 开始探索
            </p>
          )}
          <button
            className="sidebar-add"
            onClick={() => csvInput.current?.click()}
            disabled={!!busy}
          >
            ＋ 添加数据
          </button>
        </div>
        <div className="sidebar-foot">
          <span className="status-dot" /> 本地运行
          <p>
            项目保存在你下载的文件中。
            <br />
            AI仅接收统计摘要与范围。
          </p>
          <button onClick={loadExample} disabled={!!busy}>
            打开联调样例 ↗
          </button>
        </div>
      </aside>
      <main id="main" className="main">
        <header className="topbar">
          <div className="breadcrumb">
            工作空间 <span>/</span>{" "}
            {tab === "overview"
              ? "分析工作台"
              : tab === "network"
                ? "信息网络"
                : "数据与来源"}
          </div>
          <div className="top-actions">
            <span className="save-state">
              {dirty ? "有未保存更改" : "本地项目"}
            </span>
            <button
              className="quiet"
              onClick={() => projectInput.current?.click()}
              disabled={!!busy}
            >
              恢复项目
            </button>
            <button
              className="button-secondary"
              onClick={save}
              disabled={!!busy || !project.datasets.length}
            >
              <Icon name="save" />
              保存项目
            </button>
            <button
              className="button-primary"
              onClick={() => csvInput.current?.click()}
              disabled={!!busy}
            >
              <Icon name="upload" />
              导入 CSV
            </button>
          </div>
        </header>
        <input
          ref={csvInput}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="visually-hidden"
          aria-label="选择 CSV 文件"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void upload(files);
          }}
        />
        <input
          ref={projectInput}
          type="file"
          accept=".json,.t3project.json"
          className="visually-hidden"
          aria-label="选择项目文件"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void restore(file);
          }}
        />
        <div className="content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">T3 / DATA EXPLORER</div>
              <h1>
                {tab === "overview"
                  ? "让每个结论，有据可查"
                  : tab === "network"
                    ? "沿着关系，找到依据"
                    : "数据保留原貌，来源清晰可查"}
              </h1>
              <p>
                {tab === "overview"
                  ? "从数据分布到文字解读，把发现连接到每一条原始记录。"
                  : tab === "network"
                    ? "来源、指标、范围、计算与发现，共同构成当前分析的证据路径。"
                    : "规范数据用于分析，原始内容和位置始终保留。"}
              </p>
            </div>
            <span className="local-badge">
              <span className="status-dot" /> 本机工作空间
            </span>
          </section>
          {busy && (
            <div className="notice" role="status">
              {busy}…
            </div>
          )}
          {error && (
            <div className="alert" role="alert">
              {error}
              <button aria-label="关闭错误提示" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {mock && (
            <div className="mock-banner">
              <strong>联调样例 / MOCK</strong>
              <span>
                固定手算参考，仅验证页面与回源流程。真实三域统计、实时 AI
                尚未验收。
              </span>
            </div>
          )}
          {!dataset ? (
            <section className="welcome">
              <div className="welcome-graphic" aria-hidden="true">
                <div className="mini-chart">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <span className="mini-source">CSV</span>
                <span className="mini-finding">可追溯的发现</span>
              </div>
              <span className="eyebrow">START WITH YOUR DATA</span>
              <h2>数据里的故事，从这里开始</h2>
              <p>
                导入居民收支、企业财务或汽车销量数据，
                <br />
                在同一个工作空间完成分析与证据回查。
              </p>
              <div className="welcome-actions">
                <button
                  className="button-primary"
                  onClick={() => csvInput.current?.click()}
                >
                  <Icon name="upload" />
                  选择 CSV 文件
                </button>
                <button className="button-secondary" onClick={loadExample}>
                  先体验联调样例 <Icon name="arrow" />
                </button>
              </div>
              <div className="domain-cards">
                {(["D1", "D2", "D3"] as const).map((domain, i) => (
                  <div key={domain}>
                    <span>{domain}</span>
                    <strong>{domainNames[domain]}</strong>
                    <small>
                      {[19, 2, 37][i]} 份原始 CSV · 适配
                      {moduleStatus.data ? "已接入" : "待接入"}
                    </small>
                  </div>
                ))}
              </div>
              <div className="integration-status">
                <span>
                  数据模块 · {moduleStatus.data ? "已接入" : "未接入"}
                </span>
                <span>统计计算 · 本机服务</span>
                <span>真实 AI · 未验证</span>
              </div>
            </section>
          ) : (
            <>
              <section className="scope-panel">
                <div className="scope-title">
                  <span className="eyebrow">ANALYSIS SCOPE</span>
                  <h2>明确范围，再看结果</h2>
                  <span className="tag">{domainNames[dataset.domain]}</span>
                </div>
                <div className="scope-fields">
                  <label>
                    数据集
                    <select
                      value={dataset.datasetId}
                      disabled={!!busy}
                      onChange={(e) =>
                        selectDataset(
                          project.datasets.find(
                            (d) => d.datasetId === e.target.value,
                          )!,
                        )
                      }
                    >
                      {project.datasets.map((d) => (
                        <option value={d.datasetId} key={d.datasetId}>
                          {d.sources[0]?.originalFileName ?? d.datasetId}
                        </option>
                      ))}
                    </select>
                  </label>
                  {dataset.fields
                    .filter((f) => f.role === "dimension")
                    .map((f) => {
                      const values = Array.from(
                        new Set(
                          dataset.records.map((r) => r.values[f.fieldId]),
                        ),
                      );
                      const selected = draft?.filters.find(
                        (filter) => filter.fieldId === f.fieldId,
                      )?.values[0];
                      return (
                        <label key={f.fieldId}>
                          {f.label}
                          <select
                            disabled={!!busy}
                            value={
                              selected === undefined
                                ? ""
                                : JSON.stringify(selected)
                            }
                            onChange={(e) => {
                              const current = draft ?? blankRequest(dataset);
                              changeDraft({
                                ...current,
                                filters: [
                                  ...current.filters.filter(
                                    (filter) => filter.fieldId !== f.fieldId,
                                  ),
                                  ...(e.target.value
                                    ? [
                                        {
                                          fieldId: f.fieldId,
                                          operator: "eq" as const,
                                          values: [
                                            JSON.parse(
                                              e.target.value,
                                            ) as Scalar,
                                          ],
                                        },
                                      ]
                                    : []),
                                ],
                              });
                            }}
                          >
                            <option value="">全部（请确认口径）</option>
                            {values.map((value) => (
                              <option
                                key={JSON.stringify(value)}
                                value={JSON.stringify(value)}
                              >
                                {value === null
                                  ? "缺失 / 未分类"
                                  : String(value)}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  <div className="analysis-action">
                    <button
                      className="button-primary"
                      disabled={!!busy || !draft?.measureFieldIds.length}
                      onClick={analyze}
                    >
                      开始分析 <Icon name="arrow" />
                    </button>
                  </div>
                </div>
                <div className="measure-list">
                  <span>分析指标</span>
                  {measures.map((f) => (
                    <label
                      className={`measure-choice ${f.analysisPolicy === "excluded" ? "excluded" : ""}`}
                      key={f.fieldId}
                      title={f.exclusionReason ?? f.meaning}
                    >
                      <input
                        type="checkbox"
                        disabled={f.analysisPolicy === "excluded" || !!busy}
                        checked={
                          draft?.measureFieldIds.includes(f.fieldId) ?? false
                        }
                        onChange={(e) => {
                          const current = draft ?? blankRequest(dataset);
                          const ids = e.target.checked
                            ? [...current.measureFieldIds, f.fieldId]
                            : current.measureFieldIds.filter(
                                (id) => id !== f.fieldId,
                              );
                          changeDraft({
                            ...current,
                            measureFieldIds: ids,
                            correlationPair:
                              ids.length >= 2 ? [ids[0], ids[1]] : null,
                          });
                        }}
                      />
                      {f.label}
                      {f.unit && <small>{f.unit}</small>}
                      {f.analysisPolicy === "excluded" && (
                        <small>禁选 · {f.exclusionReason}</small>
                      )}
                    </label>
                  ))}
                </div>
                {(draft?.measureFieldIds.length ?? 0) > 2 && (
                  <div className="correlation-fields">
                    <span>相关性指标对</span>
                    {[0, 1].map((index) => (
                      <select
                        key={index}
                        disabled={!!busy}
                        aria-label={
                          index === 0 ? "相关性 X 指标" : "相关性 Y 指标"
                        }
                        value={draft?.correlationPair?.[index] ?? ""}
                        onChange={(e) => {
                          const pair: [string, string] = [
                            draft?.correlationPair?.[0] ??
                              draft!.measureFieldIds[0],
                            draft?.correlationPair?.[1] ??
                              draft!.measureFieldIds[1],
                          ];
                          pair[index] = e.target.value;
                          if (pair[0] === pair[1])
                            pair[index === 0 ? 1 : 0] =
                              draft!.measureFieldIds.find(
                                (id) => id !== e.target.value,
                              )!;
                          changeDraft({
                            ...draft!,
                            correlationPair:
                              pair[0] && pair[1] && pair[0] !== pair[1]
                                ? pair
                                : null,
                          });
                        }}
                      >
                        <option value="">选择指标</option>
                        {draft!.measureFieldIds.map((id) => (
                          <option key={id} value={id}>
                            {measures.find((f) => f.fieldId === id)?.label}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                )}
                <div className="scope-foot">
                  <span>
                    {analysis ? analysis.scope.label : "当前选择尚未计算"}
                  </span>
                  <span>
                    来源 {dataset.sources.length} 份 · 规范记录{" "}
                    {dataset.records.length.toLocaleString()} 条
                  </span>
                  {project.analyses.some(
                    (a) => a.datasetId === dataset.datasetId,
                  ) && (
                    <select
                      disabled={!!busy}
                      aria-label="查看已有分析"
                      value={analysis?.analysisId ?? ""}
                      onChange={(e) => openAnalysis(e.target.value)}
                    >
                      <option value="">查看已有分析</option>
                      {project.analyses
                        .filter((a) => a.datasetId === dataset.datasetId)
                        .map((a) => (
                          <option key={a.analysisId} value={a.analysisId}>
                            {a.scope.label} ·{" "}
                            {a.request.measureFieldIds
                              .map(
                                (id) =>
                                  dataset.fields.find((f) => f.fieldId === id)
                                    ?.label,
                              )
                              .join("、")}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </section>
              {(dataset.issues.length > 0 ||
                analysis?.issues.length ||
                analysis?.scope.limitations.length) && (
                <details className="issues">
                  <summary>
                    数据口径与限制 ·{" "}
                    {dataset.issues.length +
                      (analysis?.issues.length ?? 0) +
                      (analysis?.scope.limitations.length ?? 0)}{" "}
                    项
                  </summary>
                  {[...dataset.issues, ...(analysis?.issues ?? [])].map(
                    (issue, i) => (
                      <p
                        key={i}
                        className={
                          issue.severity === "error" ? "warning-text" : ""
                        }
                      >
                        {issue.message}
                      </p>
                    ),
                  )}
                  {analysis?.scope.limitations.map((text, i) => (
                    <p key={`scope${i}`}>{text}</p>
                  ))}
                </details>
              )}
              {tab === "overview" && (
                <>
                  {analysis ? (
                    <>
                      <section className="metric-grid">
                        {analysis.results
                          .filter(
                            (r) =>
                              r.fieldIds[0] === fieldId &&
                              ["mean", "median", "std"].includes(r.metric),
                          )
                          .map((r) => (
                            <button
                              className="metric-card"
                              key={r.resultId}
                              onClick={() => showResult(r.resultId)}
                            >
                              <span>
                                {metricNames[r.metric]} <span>↗</span>
                              </span>
                              <strong>{number(r.value)}</strong>
                              <small>
                                {r.unit || "无量纲"} · 有效样本{" "}
                                {r.validRecordIds.length}
                              </small>
                            </button>
                          ))}
                        <div className="metric-card summary-card">
                          <span>当前有效范围</span>
                          <strong>
                            {analysis.scope.recordIds.length.toLocaleString()}
                            <small> 条</small>
                          </strong>
                          <small>每个统计量的有效样本独立核对</small>
                        </div>
                      </section>
                      <div className="analysis-grid">
                        <section className="panel chart-panel">
                          <div className="panel-header">
                            <div>
                              <span className="eyebrow">
                                DISTRIBUTION & RELATION
                              </span>
                              <h2>读懂数据的形状</h2>
                            </div>
                            <select
                              aria-label="图表指标"
                              value={fieldId}
                              onChange={(e) => setFieldId(e.target.value)}
                            >
                              {analysis.request.measureFieldIds.map((id) => (
                                <option key={id} value={id}>
                                  {
                                    dataset.fields.find((f) => f.fieldId === id)
                                      ?.label
                                  }
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="tabs">
                            {(
                              [
                                ["histogram", "直方图"],
                                ["scatter", "散点图"],
                                ["boxplot", "箱线图"],
                              ] as const
                            ).map(([id, label]) => (
                              <button
                                className={chart === id ? "active" : ""}
                                key={id}
                                onClick={() => setChart(id)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <StatisticalChart
                            kind={chart}
                            bundle={dataset}
                            analysis={analysis}
                            fieldId={fieldId}
                            onResult={showResult}
                            onRecords={showRecords}
                          />
                        </section>
                        <section className="panel insight-panel">
                          <div className="panel-header">
                            <div>
                              <span className="eyebrow">
                                INSIGHT WITH EVIDENCE
                              </span>
                              <h2>发现与解读</h2>
                            </div>
                            <span className="tag">可回源</span>
                          </div>
                          <h3 className="section-label">确定性事实</h3>
                          {insights
                            .filter(
                              (i) =>
                                i.kind === "fact" && i.origin === "computed",
                            )
                            .map((i) => (
                              <article className="insight" key={i.insightId}>
                                <InsightText
                                  insight={i}
                                  project={project}
                                  onResult={showResult}
                                />
                              </article>
                            ))}
                          {!insights.some(
                            (i) => i.kind === "fact" && i.origin === "computed",
                          ) && <p className="muted">暂无经过校验的事实。</p>}
                          <div className="ai-section">
                            <h3 className="section-label">DeepSeek 解读</h3>
                            <p className="muted">
                              解读引用当前统计结果。相关不等于因果。
                            </p>
                            {insights
                              .filter((i) => i.origin === "live_ai")
                              .map((i) => (
                                <article className="insight" key={i.insightId}>
                                  <InsightText
                                    insight={i}
                                    project={project}
                                    onResult={showResult}
                                  />
                                  <small>
                                    {liveIds.includes(i.insightId)
                                      ? "本次实时调用"
                                      : "历史记录"}{" "}
                                    · {i.model} ·{" "}
                                    {new Date(i.generatedAt).toLocaleString(
                                      "zh-CN",
                                    )}
                                  </small>
                                </article>
                              ))}
                            {aiError && (
                              <p className="inline-error" role="alert">
                                {aiError}
                              </p>
                            )}
                            <button
                              className="ai-button"
                              disabled={
                                !!busy || mock || aiStatus === "loading"
                              }
                              onClick={generateAI}
                            >
                              {aiStatus === "loading"
                                ? "正在生成，请稍候…"
                                : aiStatus === "error"
                                  ? "重试真实 AI 解读"
                                  : "生成真实 AI 解读"}{" "}
                              <Icon name="arrow" />
                            </button>
                            {mock && (
                              <p className="fineprint">
                                联调样例不调用模型。真实数据接入后启用。
                              </p>
                            )}
                            {aiStatus === "success" && (
                              <p className="fineprint">
                                响应已通过当前分析与引用检查；文字含义仍需审阅。
                              </p>
                            )}
                          </div>
                        </section>
                      </div>
                      <section className="panel result-panel">
                        <div className="panel-header">
                          <h2>计算结果明细</h2>
                          <span className="muted">
                            点击数字查看方法、样本和原文
                          </span>
                        </div>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>指标</th>
                                <th>统计量</th>
                                <th>结果</th>
                                <th>有效 / 排除</th>
                                <th>计算方法</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysis.results.map((r) => (
                                <tr key={r.resultId}>
                                  <td>
                                    {r.fieldIds
                                      .map(
                                        (id) =>
                                          dataset.fields.find(
                                            (f) => f.fieldId === id,
                                          )?.label ?? id,
                                      )
                                      .join(" / ")}
                                  </td>
                                  <td>{metricNames[r.metric] ?? r.metric}</td>
                                  <td>
                                    <button
                                      className="inline-number"
                                      onClick={() => showResult(r.resultId)}
                                    >
                                      {number(r.value)} {r.unit} ↗
                                    </button>
                                  </td>
                                  <td>
                                    {r.validRecordIds.length} /{" "}
                                    {r.excludedRecordIds.length}
                                  </td>
                                  <td>{r.method}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    </>
                  ) : (
                    <div className="panel no-analysis">
                      <h2>选择指标，开始一次有范围的分析</h2>
                      <p>
                        更改数据、指标或筛选后，旧结果会退出当前视图。新结果将在完成计算后展示。
                      </p>
                    </div>
                  )}
                </>
              )}
              {tab === "network" &&
                (localGraph ? (
                  <section className="panel network-panel">
                    <div className="panel-header">
                      <h2>
                        {analysis ? "当前分析的关系网络" : "数据与来源关系"}
                      </h2>
                      <span className="muted">
                        {localGraph.nodes.length} 个节点 ·{" "}
                        {localGraph.edges.length} 条有依据的关系
                      </span>
                    </div>
                    <div className="network-legend">
                      {Object.entries(nodeNames).map(([key, value]) => (
                        <span key={key} className={`legend-${key}`}>
                          {value}
                        </span>
                      ))}
                    </div>
                    <NetworkChart
                      graph={localGraph}
                      selected={project.selection.nodeId}
                      onSelect={selectNode}
                    />
                    {selectedNode && (
                      <div className="selected-node">
                        <strong>
                          {nodeNames[selectedNode.type]} · {selectedNode.label}
                        </strong>
                        {selectedNode.type === "finding" &&
                          project.insights
                            .find((i) => i.insightId === selectedNode.ref)
                            ?.resultRefs.map((id) => (
                              <button
                                className="chip"
                                key={id}
                                onClick={() => showResult(id)}
                              >
                                查看引用计算 ↗
                              </button>
                            ))}
                        {selectedNode.type === "scope" && analysis && (
                          <p>
                            {analysis.scope.label} ·{" "}
                            {analysis.scope.limitations.join("；")}
                          </p>
                        )}
                        {selectedNode.type === "source" && (
                          <p>
                            {
                              dataset.sources.find(
                                (s) => s.sourceId === selectedNode.ref,
                              )?.originalFileName
                            }{" "}
                            · 来源位置可从统计结果或记录明细查看。
                          </p>
                        )}
                      </div>
                    )}
                    <div
                      className="node-buttons"
                      aria-label="用按钮选择图谱节点"
                    >
                      {localGraph.nodes.map((node) => (
                        <button
                          key={node.id}
                          className={`chip ${selectedNode?.id === node.id ? "selected" : ""}`}
                          onClick={() => selectNode(node.id)}
                        >
                          {nodeNames[node.type]} · {node.label}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : (
                  <div className="panel no-analysis">
                    <h2>完成分析后，信息网络在这里展开</h2>
                    <p>图谱仅连接有真实引用的来源、指标、范围、计算和发现。</p>
                  </div>
                ))}
              {tab === "records" && (
                <section className="panel">
                  <div className="panel-header">
                    <h2>规范数据与来源</h2>
                    <span className="muted">
                      {activeRecords.length.toLocaleString()} 条 · 每页 20 条
                    </span>
                  </div>
                  <div className="source-chips">
                    {dataset.sources.map((source) => (
                      <details key={source.sourceId}>
                        <summary>{source.originalFileName}</summary>
                        <p>
                          编码 {source.encoding} · 原始记录{" "}
                          {source.rawRecords.length}
                        </p>
                        <code>SHA-256 {source.sha256}</code>
                      </details>
                    ))}
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>来源</th>
                          {dataset.fields.map((f) => (
                            <th key={f.fieldId}>
                              {f.label}
                              {f.unit && <small>（{f.unit}）</small>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeRecords
                          .slice(page * 20, (page + 1) * 20)
                          .map((record) => (
                            <tr key={record.recordId}>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    showRecords(
                                      [record.recordId],
                                      dataset.fields.map((f) => f.fieldId),
                                    )
                                  }
                                >
                                  查看原文 ↗
                                </button>
                              </td>
                              {dataset.fields.map((f) => (
                                <td key={f.fieldId}>
                                  {record.values[f.fieldId] === null ? (
                                    <span className="muted">缺失</span>
                                  ) : (
                                    String(record.values[f.fieldId])
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination">
                    <button
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      上一页
                    </button>
                    <span>
                      {page + 1} /{" "}
                      {Math.max(1, Math.ceil(activeRecords.length / 20))}
                    </span>
                    <button
                      disabled={(page + 1) * 20 >= activeRecords.length}
                      onClick={() => setPage(page + 1)}
                    >
                      下一页
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>T3 数据洞察官</span>
            <span>数值由程序计算 · 解释引用结果 · 证据可回到原文</span>
          </footer>
        </div>
      </main>
      {evidence && (
        <Evidence
          key={
            evidence.metric?.result.resultId ??
            evidence.group?.records.map((r) => r.recordId).join(",")
          }
          view={evidence}
          onClose={() => setEvidence(null)}
        />
      )}
    </div>
  );
}
