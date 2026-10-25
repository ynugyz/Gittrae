import { useEffect, useRef } from "react";
import { init, use, type EChartsCoreOption } from "echarts/core";
import {
  BarChart,
  ScatterChart,
  BoxplotChart,
  GraphChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type {
  AnalysisResult,
  DatasetBundle,
  GraphSnapshot,
  NodeType,
} from "../contracts";

use([
  BarChart,
  ScatterChart,
  BoxplotChart,
  GraphChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  CanvasRenderer,
]);
type ChartClick = {
  dataIndex: number;
  seriesIndex: number;
  data: unknown;
  dataType?: string;
};
export const nodeNames: Record<NodeType, string> = {
  source: "来源",
  dataset: "数据集",
  indicator: "指标",
  scope: "分析范围",
  calculation: "计算",
  finding: "发现",
};
const palette = [
  "#245d55",
  "#749d8f",
  "#cf8454",
  "#496c95",
  "#8e7d9e",
  "#a89651",
];
export function number(value: number | null) {
  return value === null
    ? "不可计算"
    : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(
        value,
      );
}

function Chart({
  option,
  onClick,
  label,
}: {
  option: EChartsCoreOption;
  onClick?: (event: ChartClick) => void;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const click = useRef(onClick);
  click.current = onClick;
  useEffect(() => {
    const chart = init(container.current!, undefined, { renderer: "canvas" });
    chart.on("click", (event) =>
      click.current?.(event as unknown as ChartClick),
    );
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container.current!);
    chart.setOption({
      ...option,
      animation: !matchMedia("(prefers-reduced-motion: reduce)").matches,
      aria: { enabled: true, label: { description: label } },
      textStyle: {
        fontFamily: "Microsoft YaHei, sans-serif",
        color: "#48605b",
      },
    });
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);
  return (
    <div ref={container} className="chart" role="img" aria-label={label} />
  );
}

export function StatisticalChart({
  kind,
  bundle,
  analysis,
  fieldId,
  onResult,
  onRecords,
}: {
  kind: "histogram" | "scatter" | "boxplot";
  bundle: DatasetBundle;
  analysis: AnalysisResult;
  fieldId: string;
  onResult: (id: string) => void;
  onRecords: (ids: string[], fields: string[]) => void;
}) {
  const field = (id: string) => bundle.fields.find((f) => f.fieldId === id);
  const label = (id: string) =>
    `${field(id)?.label ?? id}${field(id)?.unit ? `（${field(id)?.unit}）` : ""}`;
  const grid = { left: 60, right: 30, top: 28, bottom: 65 };
  const base = {
    color: palette,
    grid,
    tooltip: { trigger: "item", renderMode: "richText" },
    xAxis: {
      axisLine: { lineStyle: { color: "#ccd5d0" } },
      axisTick: { show: false },
    },
    yAxis: { splitLine: { lineStyle: { color: "#edf0ed" } } },
  };
  if (kind === "histogram") {
    const histogram = analysis.chartData.histograms.find(
      (h) => h.fieldId === fieldId,
    );
    if (!histogram?.counts.length)
      return (
        <div className="chart-empty">当前指标没有有效数值，无法绘制分布。</div>
      );
    const bins = histogram.counts.map(
      (_, i) =>
        `${number(histogram.edges[i])}–${number(histogram.edges[i + 1])}`,
    );
    return (
      <>
        <Chart
          label={`${label(fieldId)}直方图，点击分箱回源。下方提供同等功能的分箱按钮。`}
          option={{
            ...base,
            xAxis: {
              ...base.xAxis,
              type: "category",
              data: bins,
              axisLabel: { rotate: 25, fontSize: 11 },
              name: field(fieldId)?.unit,
            },
            yAxis: {
              ...base.yAxis,
              type: "value",
              minInterval: 1,
              name: "记录数",
            },
            series: [
              {
                type: "bar",
                data: histogram.counts,
                barWidth: "85%",
                itemStyle: { borderRadius: [4, 4, 0, 0] },
              },
            ],
          }}
          onClick={(event) =>
            onRecords(histogram.binRecordIds[event.dataIndex], [fieldId])
          }
        />
        <div className="chart-controls" aria-label="分箱记录">
          <span>查看分箱</span>
          {bins.map((bin, i) => (
            <button
              key={i}
              className="chip"
              disabled={!histogram.counts[i]}
              onClick={() => onRecords(histogram.binRecordIds[i], [fieldId])}
              title={bin}
            >
              {i + 1}箱 · {histogram.counts[i]}
            </button>
          ))}
        </div>
      </>
    );
  }
  if (kind === "scatter") {
    const scatter = analysis.chartData.scatter;
    if (!scatter?.points.length)
      return (
        <div className="chart-empty">选择两个数值指标后查看成对有效记录。</div>
      );
    const metric = analysis.results.find(
      (r) => r.resultId === scatter.correlationResultId,
    );
    return (
      <>
        <Chart
          label={`${label(scatter.xFieldId)}与${label(scatter.yFieldId)}散点图`}
          option={{
            ...base,
            xAxis: {
              ...base.xAxis,
              type: "value",
              name: field(scatter.xFieldId)?.label,
              nameLocation: "middle",
              nameGap: 35,
            },
            yAxis: {
              ...base.yAxis,
              type: "value",
              name: field(scatter.yFieldId)?.label,
              scale: true,
            },
            series: [
              {
                type: "scatter",
                symbolSize: 10,
                data: scatter.points.map((p) => [p.x, p.y]),
                itemStyle: { opacity: 0.8 },
              },
            ],
          }}
          onClick={(event) =>
            onRecords(
              [scatter.points[event.dataIndex].recordId],
              [scatter.xFieldId, scatter.yFieldId],
            )
          }
        />
        <div className="chart-controls">
          <button
            className="text-button"
            onClick={() => onResult(scatter.correlationResultId)}
          >
            Pearson r = {number(metric?.value ?? null)} ↗
          </button>
          <button
            className="chip"
            onClick={() =>
              onRecords(
                scatter.points.map((p) => p.recordId),
                [scatter.xFieldId, scatter.yFieldId],
              )
            }
          >
            查看 {scatter.points.length} 条成对记录
          </button>
          <span>相关不等于因果</span>
        </div>
      </>
    );
  }
  const box = analysis.chartData.boxplots.find((b) => b.fieldId === fieldId);
  if (!box) return <div className="chart-empty">暂无箱线数据。</div>;
  const refs = [
    box.lowResultId,
    box.q1ResultId,
    box.medianResultId,
    box.q3ResultId,
    box.highResultId,
  ];
  const values = refs.map(
    (id) => analysis.results.find((r) => r.resultId === id)?.value ?? null,
  );
  if (values.some((v) => v === null))
    return (
      <div className="chart-empty">当前指标没有有效数值，无法绘制箱线图。</div>
    );
  return (
    <>
      <Chart
        label={`${label(fieldId)}箱线图，须线为阈值内真实观测值`}
        option={{
          ...base,
          xAxis: {
            ...base.xAxis,
            type: "category",
            data: [field(fieldId)?.label],
          },
          yAxis: {
            ...base.yAxis,
            type: "value",
            name: field(fieldId)?.unit,
            scale: true,
          },
          series: [
            {
              type: "boxplot",
              data: [values],
              itemStyle: { color: "#dcebe4", borderColor: palette[0] },
            },
            {
              type: "scatter",
              data: box.outliers.map((o) => [0, o.value]),
              itemStyle: { color: palette[2] },
            },
          ],
        }}
        onClick={(event) =>
          event.seriesIndex === 1
            ? onRecords([box.outliers[event.dataIndex].recordId], [fieldId])
            : onResult(box.medianResultId)
        }
      />
      <div className="chart-controls">
        {refs.map((id, i) => (
          <button className="chip" key={id} onClick={() => onResult(id)}>
            {["下须", "Q1", "中位数", "Q3", "上须"][i]} {number(values[i])}
          </button>
        ))}
      </div>
    </>
  );
}

export function NetworkChart({
  graph,
  selected,
  onSelect,
}: {
  graph: GraphSnapshot;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const types = Object.keys(nodeNames) as NodeType[];
  return (
    <Chart
      label="当前分析的信息网络。下方节点按钮可用键盘选择。"
      option={{
        tooltip: { renderMode: "richText" },
        series: [
          {
            type: "graph",
            layout: "force",
            roam: true,
            draggable: true,
            force: { repulsion: 260, edgeLength: [65, 115], gravity: 0.12 },
            data: graph.nodes.map((n) => ({
              id: n.id,
              name: n.label,
              value: nodeNames[n.type],
              symbolSize:
                n.id === selected ? 30 : n.type === "finding" ? 26 : 18,
              itemStyle: {
                color: palette[types.indexOf(n.type)],
                borderColor: "#fff",
                borderWidth: 3,
              },
              label: {
                show: graph.nodes.length < 35 || n.id === selected,
                position: "bottom",
                fontSize: 11,
                width: 110,
                overflow: "truncate",
              },
            })),
            links: graph.edges.map((e) => ({ source: e.from, target: e.to })),
            edgeSymbol: ["none", "arrow"],
            edgeSymbolSize: [0, 6],
            lineStyle: { color: "#b1c2ba", curveness: 0.08 },
            emphasis: { focus: "adjacency" },
          },
        ],
      }}
      onClick={(e) => {
        const data = e.data as { id?: string };
        if (e.dataType === "node" && data.id) onSelect(data.id);
      }}
    />
  );
}
