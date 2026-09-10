import Chart from "@/components/Base/Chart";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import Table from "@/components/Base/Table";
import withSessionCheck from "@/components/SessionChecker";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { Fragment, memo, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ServerCall } from "../../../lib/server_call";
import type {
  IPromo,
  KpiCardItem,
  TracciatiMomentoConfrontoResponseDTO,
  TracciatoFieldChange,
  TracciatoQueryResult,
  TracciatoReport,
  TracciatoReportCanaleAreaView,
  TracciatoReportWidget,
  TracciatoWidgetCallout,
  TracciatoWidgetChart,
  TracciatoWidgetDualPieChart,
  TracciatoWidgetGroupedTable,
  TracciatoWidgetGroupedTableGroup,
  TracciatoWidgetGroupedTableRow,
  TracciatoWidgetKpiGrid,
  TracciatoWidgetLineChart,
  TracciatoWidgetPriceDiff,
  TracciatoWidgetPriceDiffCellValue,
  TracciatoWidgetPriceDiffExtraColumn,
  TracciatoWidgetReferenzeSplitTable,
  TracciatoWidgetScoreAudit,
  TracciatoWidgetScoreboard,
  TracciatoWidgetScoreboardCodiceRow,
  TracciatoWidgetScoreboardRow,
  TracciatoWidgetTable,
} from "../../../lib/types";
import Button from "../../components/Base/Button";

// ── Tone styles — allineato con AuditLogDashboard ────────────────────────────

const KPI_TONE: Record<
  NonNullable<KpiCardItem["color"]>,
  { border: string; iconBg: string; iconText: string; valueText: string }
> = {
  green: {
    border: "border-emerald-200",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-500",
    valueText: "text-emerald-700",
  },
  red: {
    border: "border-red-200",
    iconBg: "bg-red-50",
    iconText: "text-red-500",
    valueText: "text-red-600",
  },
  blue: {
    border: "border-blue-200",
    iconBg: "bg-blue-50",
    iconText: "text-blue-500",
    valueText: "text-slate-800",
  },
  amber: {
    border: "border-amber-200",
    iconBg: "bg-amber-50",
    iconText: "text-amber-500",
    valueText: "text-amber-600",
  },
  slate: {
    border: "border-slate-200",
    iconBg: "bg-slate-100",
    iconText: "text-slate-500",
    valueText: "text-slate-800",
  },
};

const KPI_ICON_FALLBACK: Record<string, string> = {
  Uscenti: "TrendingDown",
  Entranti: "TrendingUp",
  Inalterati: "Minus",
  Alterati: "Pencil",
};

const GRID_SPAN: Record<number, string> = {
  1: "col-span-12 md:col-span-3",
  2: "col-span-12 md:col-span-6",
  3: "col-span-12 md:col-span-9",
  4: "col-span-12",
};

// ── Widget header ─────────────────────────────────────────────────────────────

function WidgetHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4">
      <div>
        <div className="font-medium text-slate-800">{title}</div>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      {badge && (
        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {badge}
        </span>
      )}
    </div>
  );
}

// ── KPI grid ─────────────────────────────────────────────────────────────────

function KpiGridWidget({ widget }: { widget: TracciatoWidgetKpiGrid }) {
  const totalValue = widget.items.reduce((s, i) => s + i.value, 0);

  return (
    <div className="box box--stacked">
      <WidgetHeader title={widget.title} description={widget.description} badge={widget.badge} />
      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
        {widget.items.map((item, idx) => {
          const tone = KPI_TONE[item.color ?? "slate"];
          const iconName = item.icon ?? KPI_ICON_FALLBACK[item.label] ?? "BarChart2";
          return (
            <div
              key={idx}
              className={clsx(
                "flex items-center gap-4 rounded-xl border bg-white px-4 py-4 transition-shadow hover:shadow-sm",
                tone.border
              )}
            >
              <div
                className={clsx(
                  "flex h-10 w-10 flex-none items-center justify-center rounded-xl",
                  tone.iconBg
                )}
              >
                <Lucide icon={iconName} className={clsx("h-5 w-5", tone.iconText)} />
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  {item.label}
                </span>
                <span className={clsx("mt-0.5 text-2xl font-bold tabular-nums", tone.valueText)}>
                  {item.value.toLocaleString("it-IT")}
                  {item.unit && (
                    <span className="ml-1 text-sm font-normal text-slate-500">{item.unit}</span>
                  )}
                </span>
                {totalValue > 0 && (
                  <span className="mt-0.5 text-[10px] text-slate-400">
                    {Math.round((item.value / totalValue) * 100)}% del totale
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Bar chart ────────────────────────────────────────────────────────────────

function BarChartWidget({ widget }: { widget: TracciatoWidgetChart }) {
  const chartData = useMemo(
    () => ({
      labels: widget.labels,
      datasets: widget.datasets.map((dataset) => ({
        label: dataset.label,
        data: dataset.data,
        backgroundColor: dataset.backgroundColor,
        borderRadius: 6,
        maxBarThickness: 36,
      })),
    }),
    [widget.labels, widget.datasets]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            usePointStyle: true,
            pointStyle: "circle" as const,
            boxWidth: 8,
            padding: 16,
            font: { size: 11 },
            color: "#64748b",
          },
        },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#94a3b8", font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(148,163,184,0.15)" },
          ticks: { color: "#94a3b8", font: { size: 11 } },
        },
      },
    }),
    []
  );

  return (
    <div className="box box--stacked">
      <WidgetHeader title={widget.title} description={widget.description} badge={widget.badge} />
      <div className="p-5">
        <Chart type="bar" data={chartData} options={chartOptions} height={260} />
      </div>
    </div>
  );
}

// ── Line chart ────────────────────────────────────────────────────────────────

import type { ChartOptions, TooltipItem } from "chart.js";

function LineChartWidget({ widget }: { widget: TracciatoWidgetLineChart }) {
  const chartData = useMemo(
    () => ({
      labels: widget.labels,
      datasets: widget.datasets.map((dataset) => ({
        label: dataset.label,
        data: dataset.data,
        borderColor: dataset.borderColor ?? "#0EA5E9",
        backgroundColor: dataset.backgroundColor ?? dataset.borderColor ?? "#0EA5E9",
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.35,
        fill: false,
      })),
    }),
    [widget.labels, widget.datasets]
  );

  const chartOptions = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8,
            padding: 12,
            font: { size: 11 },
            color: "#64748b",
          },
        },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label(this: any, context: TooltipItem<"line">) {
              const label = context.dataset.label ?? "Reparto";
              // context.parsed.y can be number or null
              const value = typeof context.parsed.y === "number" ? context.parsed.y : 0;
              return `${label}: ${Math.round(value)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(148,163,184,0.08)" },
          title: {
            display: true,
            text: "Confronti",
            color: "#64748b",
            font: { size: 11, weight: 600 },
          },
          ticks: { color: "#94a3b8", font: { size: 11 } },
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: "rgba(148,163,184,0.15)" },
          title: {
            display: true,
            text: "Punteggio (%)",
            color: "#64748b",
            font: { size: 11, weight: 600 },
          },
          ticks: {
            stepSize: 20,
            color: "#94a3b8",
            font: { size: 11 },
            callback: (value: number | string) => `${value}%`,
          },
        },
      },
    }),
    []
  );

  return (
    <div className="box box--stacked">
      <WidgetHeader title={widget.title} description={widget.description} badge={widget.badge} />
      <div className="p-5">
        <Chart type="line" data={chartData} options={chartOptions as any} height={280} />
      </div>
    </div>
  );
}

// ── Pie chart ────────────────────────────────────────────────────────────────

function PieChartWidget({ widget }: { widget: TracciatoWidgetChart }) {
  const totalSum = useMemo(
    () => widget.datasets[0]?.data.reduce((s, v) => s + Math.max(0, v), 0) ?? 0,
    [widget.datasets]
  );

  const chartData = useMemo(
    () => ({
      labels: widget.labels,
      datasets: widget.datasets.map((dataset) => ({
        label: dataset.label,
        data: dataset.data,
        backgroundColor: dataset.backgroundColor,
        borderWidth: 2,
        borderColor: "#f8fafc",
        hoverOffset: 6,
      })),
    }),
    [widget.labels, widget.datasets]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right" as const,
          labels: {
            usePointStyle: true,
            pointStyle: "circle" as const,
            boxWidth: 8,
            padding: 14,
            font: { size: 11 },
            color: "#64748b",
          },
        },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 10,
          cornerRadius: 8,
        },
      },
      cutout: "60%",
    }),
    []
  );

  return (
    <div className="box box--stacked">
      <WidgetHeader
        title={widget.title}
        description={widget.description}
        badge={widget.badge}
      />
      <div className="p-5">
        <Chart type="doughnut" data={chartData} options={chartOptions} height={240} />
        {totalSum > 0 && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Totale:{" "}
            <span className="font-semibold text-slate-700">
              {totalSum.toLocaleString("it-IT")}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

function TableWidget({ widget }: { widget: TracciatoWidgetTable }) {
  const numericKeys = useMemo<Set<string>>(() => {
    const firstRow = widget.rows[0];
    if (!firstRow) return new Set();
    return new Set(
      Object.keys(firstRow).filter((key) => typeof firstRow[key] === "number")
    );
  }, [widget.rows]);

  return (
    <div className="box box--stacked overflow-hidden">
      <WidgetHeader
        title={widget.title}
        description={widget.description}
        badge={widget.badge ?? `${widget.rows.length} ${widget.rows.length === 1 ? "riga" : "righe"}`}
      />
      <div className="overflow-x-auto">
        <Table bordered hover>
          <Table.Thead>
            <Table.Tr>
              {widget.columns.map((column, index) => (
                <Table.Td
                  key={index}
                  className={clsx(
                    "whitespace-nowrap border-t border-slate-200/80 bg-slate-50/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500",
                    numericKeys.has(column.key) && "text-right tabular-nums"
                  )}
                >
                  {column.label}
                </Table.Td>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {widget.rows.length === 0 ? (
              <Table.Tr>
                <Table.Td
                  colSpan={widget.columns.length}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  Nessun dato disponibile
                </Table.Td>
              </Table.Tr>
            ) : (
              widget.rows.map((row, rowIndex) => (
                <Table.Tr key={rowIndex} className="[&_td]:last:border-b-0">
                  {widget.columns.map((column, colIndex) => (
                    <Table.Td
                      key={colIndex}
                      className={clsx(
                        "border-dashed border-slate-200/70 px-4 py-3 text-sm text-slate-700",
                        numericKeys.has(column.key) && "text-right tabular-nums"
                      )}
                    >
                      {String(row[column.key] ?? "-")}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </div>
      {widget.rows.length > 10 && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-2.5 text-right text-xs text-slate-400">
          {widget.rows.length} risultati totali
        </div>
      )}
    </div>
  );
}

// ── Callout ───────────────────────────────────────────────────────────────────

const CALLOUT_TONE: Record<
  NonNullable<TracciatoWidgetCallout["severity"]>,
  { wrapper: string; bar: string; iconText: string; titleText: string; messageText: string; icon: string }
> = {
  info: {
    wrapper: "border-blue-200 bg-blue-50/60",
    bar: "bg-blue-500",
    iconText: "text-blue-500",
    titleText: "text-blue-800",
    messageText: "text-blue-700",
    icon: "Info",
  },
  success: {
    wrapper: "border-emerald-200 bg-emerald-50/60",
    bar: "bg-emerald-500",
    iconText: "text-emerald-600",
    titleText: "text-emerald-800",
    messageText: "text-emerald-700",
    icon: "CircleCheck",
  },
  warning: {
    wrapper: "border-amber-200 bg-amber-50/60",
    bar: "bg-amber-400",
    iconText: "text-amber-600",
    titleText: "text-amber-800",
    messageText: "text-amber-700",
    icon: "TriangleAlert",
  },
  error: {
    wrapper: "border-red-200 bg-red-50/60",
    bar: "bg-red-500",
    iconText: "text-red-600",
    titleText: "text-red-800",
    messageText: "text-red-700",
    icon: "CircleAlert",
  },
};

function CalloutWidget({ widget }: { widget: TracciatoWidgetCallout }) {
  const severity = widget.severity ?? "info";
  const tone = CALLOUT_TONE[severity];
  const iconName = (widget.icon ?? tone.icon) as Parameters<typeof Lucide>[0]["icon"];

  return (
    <div className={clsx("box box--stacked flex overflow-hidden", widget.gridSpan === 4 && "col-span-12")}>
      {/* Barra colorata laterale */}
      <div className={clsx("w-1 shrink-0 self-stretch", tone.bar)} />

      <div className={clsx("flex flex-1 items-start gap-4 px-5 py-4", tone.wrapper)}>
        {/* Icona */}
        <div className="mt-0.5 shrink-0">
          <Lucide icon={iconName} className={clsx("h-5 w-5", tone.iconText)} />
        </div>

        {/* Testo */}
        <div className="flex-1 min-w-0">
          <div className={clsx("text-sm font-semibold leading-snug", tone.titleText)}>
            {widget.title}
          </div>
          {widget.description && (
            <div className={clsx("mt-0.5 text-xs", tone.messageText)}>
              {widget.description}
            </div>
          )}
          <p className={clsx("mt-2 text-sm leading-relaxed", tone.messageText)}>
            {widget.message}
          </p>
        </div>

        {/* Badge opzionale */}
        {widget.badge && (
          <span className="shrink-0 self-start rounded-full border border-current/20 bg-white/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">
            {widget.badge}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Referenze split table ─────────────────────────────────────────────────────

const TIPO_BADGE: Record<string, { bg: string; text: string }> = {
  singolo: { bg: "bg-blue-50 border border-blue-200", text: "text-blue-700" },
  gruppo: { bg: "bg-violet-50 border border-violet-200", text: "text-violet-700" },
};

function ReferenzeSplitTableWidget({ widget }: { widget: TracciatoWidgetReferenzeSplitTable }) {
  const [activeTab, setActiveTab] = useState<"singoli" | "gruppi">("singoli");
  const rows = activeTab === "singoli" ? widget.singoli : widget.gruppi;

  const numericKeys = useMemo<Set<string>>(() => {
    const first = rows[0];
    if (!first) return new Set();
    return new Set(Object.keys(first).filter((k) => typeof first[k] === "number"));
  }, [rows]);

  const tabs = [
    { key: "singoli" as const, label: "Singoli", count: widget.singoli.length, color: "blue" },
    { key: "gruppi" as const, label: "Gruppi", count: widget.gruppi.length, color: "violet" },
  ];

  return (
    <div className="box box--stacked overflow-hidden">
      <WidgetHeader title={widget.title} description={widget.description} badge={widget.badge} />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200/80 px-4 pt-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              "relative flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
            <span
              className={clsx(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                tab.color === "blue" && "bg-blue-100 text-blue-700",
                tab.color === "violet" && "bg-violet-100 text-violet-700"
              )}
            >
              {tab.count.toLocaleString("it-IT")}
            </span>
            {activeTab === tab.key && (
              <motion.div
                layoutId="referenze-tab-underline"
                className={clsx(
                  "absolute inset-x-0 bottom-0 h-0.5 rounded-full",
                  tab.color === "blue" && "bg-blue-500",
                  tab.color === "violet" && "bg-violet-500"
                )}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <div className="overflow-auto" style={{ maxHeight: 400 }}>
            <Table bordered hover>
              <Table.Thead>
                <Table.Tr>
                  {widget.columns.map((col, i) => (
                    <Table.Td
                      key={i}
                      className={clsx(
                        "sticky top-0 z-10 whitespace-nowrap border-t border-slate-200/80 bg-slate-50/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 backdrop-blur-sm",
                        numericKeys.has(col.key) && "text-right tabular-nums"
                      )}
                    >
                      {col.label}
                    </Table.Td>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.length === 0 ? (
                  <Table.Tr>
                    <Table.Td
                      colSpan={widget.columns.length}
                      className="px-4 py-10 text-center text-sm text-slate-400"
                    >
                      Nessuna referenza
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  rows.map((row, ri) => (
                    <Table.Tr key={ri} className="[&_td]:last:border-b-0">
                      {widget.columns.map((col, ci) => {
                        const val = row[col.key];
                        const isType = col.key === "tipo";
                        const tipoKey = String(val).toLowerCase() as keyof typeof TIPO_BADGE;
                        return (
                          <Table.Td
                            key={ci}
                            className={clsx(
                              "border-dashed border-slate-200/70 px-4 py-2.5 text-sm",
                              numericKeys.has(col.key) && "text-right tabular-nums text-slate-700"
                            )}
                          >
                            {isType ? (
                              <span
                                className={clsx(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  TIPO_BADGE[tipoKey]?.bg ?? "bg-slate-100",
                                  TIPO_BADGE[tipoKey]?.text ?? "text-slate-600"
                                )}
                              >
                                {String(val ?? "—")}
                              </span>
                            ) : (
                              <span className="text-slate-700">{String(val ?? "—")}</span>
                            )}
                          </Table.Td>
                        );
                      })}
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </div>
          {rows.length > 10 && (
            <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-2.5 text-right text-xs text-slate-400">
              {rows.length} risultati — tab {activeTab}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Dual pie chart ────────────────────────────────────────────────────────────

function DualPieChartWidget({ widget }: { widget: TracciatoWidgetDualPieChart }) {
  const makeChartData = (data: number[]) => ({
    labels: widget.labels,
    datasets: [
      {
        data,
        backgroundColor: widget.colors,
        borderWidth: 2,
        borderColor: "#f8fafc",
        hoverOffset: 8,
      },
    ],
  });

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            usePointStyle: true,
            pointStyle: "circle" as const,
            boxWidth: 8,
            padding: 12,
            font: { size: 11 },
            color: "#64748b",
          },
        },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx: any) => {
              const total = (ctx.dataset.data as number[]).reduce((s: number, v: number) => s + v, 0);
              const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
              return ` ${ctx.label}: ${ctx.parsed.toLocaleString("it-IT")} (${pct}%)`;
            },
          },
        },
      },
      cutout: "58%",
    }),
    []
  );

  const totalA = useMemo(() => widget.dataA.reduce((s, v) => s + v, 0), [widget.dataA]);
  const totalB = useMemo(() => widget.dataB.reduce((s, v) => s + v, 0), [widget.dataB]);

  return (
    <div className="box box--stacked">
      <WidgetHeader title={widget.title} description={widget.description} badge={widget.badge} />
      <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
        {/* Grafico A — Prima */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-col items-center gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Prima
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 tabular-nums">
              {widget.labelA}
            </span>
          </div>
          <div className="relative w-full" style={{ height: 220 }}>
            <Chart type="doughnut" data={makeChartData(widget.dataA)} options={chartOptions} height={220} />
          </div>
          <p className="text-xs text-slate-500">
            Totale:{" "}
            <span className="font-semibold text-slate-700">{totalA.toLocaleString("it-IT")}</span> referenze
          </p>
        </motion.div>

        {/* Grafico B — Dopo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dopo
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 tabular-nums">
              {widget.labelB}
            </span>
          </div>
          <div className="relative w-full" style={{ height: 220 }}>
            <Chart type="doughnut" data={makeChartData(widget.dataB)} options={chartOptions} height={220} />
          </div>
          <p className="text-xs text-slate-500">
            Totale:{" "}
            <span className="font-semibold text-slate-700">{totalB.toLocaleString("it-IT")}</span> referenze
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// ── Price diff ────────────────────────────────────────────────────────────────

function FieldChangeBadgeDelta({ change }: { change: TracciatoFieldChange }) {
  if (!change.deltaPercent) return <span className="text-slate-400">—</span>;
  const isPos = change.delta !== null && change.delta > 0;
  const isNeg = change.delta !== null && change.delta < 0;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
        isPos && "bg-red-50 text-red-600",
        isNeg && "bg-emerald-50 text-emerald-600",
        !isPos && !isNeg && "bg-slate-100 text-slate-500",
      )}
    >
      {isPos && <Lucide icon="TrendingUp" className="h-2.5 w-2.5" />}
      {isNeg && <Lucide icon="TrendingDown" className="h-2.5 w-2.5" />}
      {change.deltaPercent}
    </span>
  );
}

const TIPO_SINGOLO_CLS = "border border-blue-200 bg-blue-50 text-blue-700";
const TIPO_GRUPPO_CLS = "border border-violet-200 bg-violet-50 text-violet-700";

function CopyButton({ text, title = "Copia" }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={title}
      className="opacity-0 group-hover/copy:opacity-100 transition-opacity p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
    >
      <Lucide
        icon={copied ? "Check" : "Copy"}
        className={clsx("h-3 w-3 transition-colors", copied && "text-emerald-500")}
      />
    </button>
  );
}

function formatPriceDiffExtraValue(value: TracciatoWidgetPriceDiffCellValue): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sì" : "No";
  return String(value);
}

function humanizePriceDiffExtraKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const PRICE_DIFF_DESCRIZIONE_COLUMN: TracciatoWidgetPriceDiffExtraColumn = {
  key: "descrizione",
  label: "Descrizione",
};

const PRICE_DIFF_COPYABLE_COLUMNS = new Set(["descrizione", "tema"]);

function getPriceDiffExtraColumns(widget: TracciatoWidgetPriceDiff): TracciatoWidgetPriceDiffExtraColumn[] {
  const columns = new Map<string, TracciatoWidgetPriceDiffExtraColumn>();

  if (widget.rows.some((row) => row.descrizione || row.extraFields?.descrizione)) {
    columns.set(PRICE_DIFF_DESCRIZIONE_COLUMN.key, PRICE_DIFF_DESCRIZIONE_COLUMN);
  }

  widget.extraColumns?.forEach((column) => {
    columns.set(column.key, column);
  });

  widget.rows.forEach((row) => {
    Object.keys(row.extraFields ?? {}).forEach((key) => {
      if (!columns.has(key)) {
        columns.set(key, { key, label: humanizePriceDiffExtraKey(key) });
      }
    });
  });

  return [...columns.values()];
}

function getPriceDiffExtraValue(
  row: TracciatoWidgetPriceDiff["rows"][number],
  key: string,
): TracciatoWidgetPriceDiffCellValue {
  if (key === "descrizione") {
    return row.extraFields?.descrizione ?? row.descrizione;
  }

  return row.extraFields?.[key];
}

function PriceDiffWidget({ widget }: { widget: TracciatoWidgetPriceDiff }) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [searchCodice, setSearchCodice] = useState("");
  const normalizedSearch = searchCodice.trim().toLowerCase();
  const extraColumns = useMemo(() => getPriceDiffExtraColumns(widget), [widget]);
  const mainColumnCount = 5 + extraColumns.length;

  const filteredRows = useMemo(
    () =>
      widget.rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => {
          if (normalizedSearch.length === 0) return true;

          const searchableText = [
            row.codice,
            row.reparto,
            row.tipo,
            ...extraColumns.map((column) => formatPriceDiffExtraValue(getPriceDiffExtraValue(row, column.key))),
          ].filter(Boolean).join(" ").toLowerCase();

          return searchableText.includes(normalizedSearch);
        }),
    [widget.rows, normalizedSearch, extraColumns],
  );

  const allExpanded =
    filteredRows.length > 0 &&
    filteredRows.every(({ index }) => expandedRows.has(index));

  const toggleRow = (i: number) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const toggleAll = () =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (allExpanded) {
        filteredRows.forEach(({ index }) => next.delete(index));
      } else {
        filteredRows.forEach(({ index }) => next.add(index));
      }
      return next;
    });

  const totalChanges = widget.rows.reduce((s, r) => s + r.changes.length, 0);
  const visibleChanges = filteredRows.reduce((s, r) => s + r.row.changes.length, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <WidgetHeader
        title={widget.title}
        description={widget.description}
        badge={widget.badge ?? `${widget.rows.length} referenze · ${totalChanges} variazioni`}
      />

      {widget.rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/40 px-4 py-2">
          <div className="relative w-full max-w-xs">
            <Lucide
              icon="Search"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchCodice}
              onChange={(e) => setSearchCodice(e.target.value)}
              placeholder="Cerca per codice referenza..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-xs text-slate-700 outline-none transition-colors focus:border-blue-300"
            />
          </div>
          <button
            onClick={toggleAll}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <Lucide
              icon={allExpanded ? "ChevronsUp" : "ChevronsDown"}
              className="h-3.5 w-3.5"
            />
            {allExpanded ? "Comprimi tutto" : "Espandi tutto"}
          </button>
        </div>
      )}

      <div className="overflow-auto max-h-[400px]" >
        <Table bordered>
          <Table.Thead>
            <Table.Tr>
              {["", "Codice", "Reparto", "Tipo", ...extraColumns.map((column) => column.label), "Campi modificati"].map(
                (label, i) => (
                  <Table.Td
                    key={i}
                    className="sticky top-0 z-10 whitespace-nowrap border-t border-slate-200/80 bg-slate-50/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 backdrop-blur-sm"
                  >
                    {label}
                  </Table.Td>
                ),
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredRows.length === 0 ? (
              <Table.Tr>
                <Table.Td
                  colSpan={mainColumnCount}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  {normalizedSearch
                    ? "Nessuna referenza trovata per questo codice"
                    : "Nessuna variazione rilevata"}
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredRows.map(({ row, index }, visibleIndex) => {
                const isExpanded = expandedRows.has(index);
                return (
                  <Fragment key={index}>
                    {/* Main row */}
                    <motion.tr
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.18,
                        delay: Math.min(visibleIndex, 8) * 0.02,
                        ease: "easeOut",
                      }}
                      onClick={() => toggleRow(index)}
                      className="cursor-pointer border-b border-dashed border-slate-200/70 last:border-b-0 hover:bg-slate-50/60"
                    >
                      <td className="w-8 px-3 py-2.5 text-slate-400">
                        <Lucide
                          icon={isExpanded ? "ChevronDown" : "ChevronRight"}
                          className="h-4 w-4 transition-transform"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-800">
                        <div className="flex items-center gap-1.5 group/copy">
                          <span className="font-mono" title={row.codice}>
                            {row.codice.length > 20 ? `${row.codice.slice(0, 20)}…` : row.codice}
                          </span>
                          <CopyButton text={row.codice} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">
                        {row.reparto}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.tipo === "singolo" ? TIPO_SINGOLO_CLS : TIPO_GRUPPO_CLS}`}
                        >
                          {row.tipo === "singolo" ? "Singolo" : "Gruppo"}
                        </span>
                      </td>
                      {extraColumns.map((column) => {
                        const value = formatPriceDiffExtraValue(getPriceDiffExtraValue(row, column.key));
                        const isCopyable = PRICE_DIFF_COPYABLE_COLUMNS.has(column.key) && value !== "—";
                        return (
                          <td key={column.key} className="px-4 py-2.5 text-sm text-slate-600">
                            <span className="group/copy inline-flex max-w-full items-center gap-1.5">
                              <span className="whitespace-nowrap" title={value}>
                                {value.length > 24 ? `${value.slice(0, 24)}…` : value}
                              </span>
                              {isCopyable && (
                                <CopyButton text={value} title={`Copia ${column.label.toLowerCase()}`} />
                              )}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {row.changes.map((c) => (
                            <span
                              key={c.campo}
                              className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                            >
                              {c.label}
                            </span>
                          ))}
                        </div>
                      </td>
                    </motion.tr>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <tr>
                        <td
                          colSpan={mainColumnCount}
                          className="bg-slate-50/70 px-5 pb-3 pt-0"
                        >
                          <div className="overflow-x-auto rounded border border-slate-200">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="bg-slate-100/80">
                                  {["Campo", "Prima", "Dopo", "Variazione"].map(
                                    (h, hi) => (
                                      <th
                                        key={hi}
                                        className={clsx(
                                          "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500",
                                          hi >= 1 ? "text-right" : "text-left",
                                        )}
                                      >
                                        {h}
                                      </th>
                                    ),
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {row.changes.map((c, ci) => (
                                  <tr
                                    key={ci}
                                    className={
                                      ci % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                                    }
                                  >
                                    <td className="px-3 py-1.5 font-medium text-slate-700">
                                      {c.label}
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-400 line-through decoration-red-300">
                                      {c.valoreA}
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-mono tabular-nums font-medium text-emerald-700">
                                      {c.valoreB}
                                    </td>
                                    <td className="px-3 py-1.5 text-right">
                                      <FieldChangeBadgeDelta change={c} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </div>

      {totalChanges > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-2 text-right text-xs text-slate-400">
          {filteredRows.length} referenze visibili · {visibleChanges} variazioni visibili
          {filteredRows.length !== widget.rows.length
            ? ` (su ${widget.rows.length} referenze)`
            : ""}
        </div>
      )}
    </div>
  );
}

// ── Scoreboard widget ─────────────────────────────────────────────────────────

const getScoreColor = (score: number) => {
  if (score >= 80) return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (score >= 60) return { bar: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" };
  if (score >= 40) return { bar: "bg-orange-400", text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" };
  return { bar: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" };
};

type AuditWithSource = TracciatoWidgetScoreAudit & { source?: string };

const normalizeScoreAudits = <T extends TracciatoWidgetScoreAudit>(audits?: T[]): T[] => {
  if (!audits?.length) return [];
  const unique = new Map<string, T>();
  for (const audit of audits) {
    const key = `${audit.type}|${audit.message}`;
    if (!unique.has(key)) unique.set(key, audit);
  }
  return [...unique.values()];
};

// ── Audit type tones ──────────────────────────────────────────────────────────

const AUDIT_TYPE_TONE = {
  info: {
    icon: "Info" as const,
    text: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    stripe: "border-l-blue-400",
    label: "Info",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-700",
    dot: "bg-blue-400",
    pillActive: "border-blue-300 bg-blue-100 text-blue-800",
  },
  warn: {
    icon: "AlertTriangle" as const,
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    stripe: "border-l-amber-400",
    label: "Avviso",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
    dot: "bg-amber-400",
    pillActive: "border-amber-300 bg-amber-100 text-amber-800",
  },
  danger: {
    icon: "AlertCircle" as const,
    text: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    stripe: "border-l-orange-500",
    label: "Attenzione",
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-700",
    dot: "bg-orange-500",
    pillActive: "border-orange-300 bg-orange-100 text-orange-800",
  },
  critical: {
    icon: "Zap" as const,
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    stripe: "border-l-red-500",
    label: "Critico",
    badgeBg: "bg-red-100",
    badgeText: "text-red-700",
    dot: "bg-red-500",
    pillActive: "border-red-300 bg-red-100 text-red-800",
  },
} as const;

type AuditTypeKey = keyof typeof AUDIT_TYPE_TONE;

const worstSeverity = (audits: Pick<TracciatoWidgetScoreAudit, "type">[]): AuditTypeKey =>
  audits.some((a) => a.type === "critical") ? "critical"
    : audits.some((a) => a.type === "danger") ? "danger"
      : audits.some((a) => a.type === "warn") ? "warn"
        : "info";

// ── ScoreAuditItem ────────────────────────────────────────────────────────────

function ScoreAuditItem({
  audit,
  source,
}: {
  audit: TracciatoWidgetScoreAudit;
  source?: string;
}) {
  const tone = AUDIT_TYPE_TONE[audit.type as AuditTypeKey] ?? AUDIT_TYPE_TONE.warn;
  return (
    <div
      className={clsx(
        "flex items-start gap-2.5 rounded-md border-l-[3px] bg-white px-3 py-2.5 ring-1 ring-slate-100",
        tone.stripe,
      )}
    >
      <Lucide icon={tone.icon} className={clsx("mt-px h-3.5 w-3.5 shrink-0", tone.text)} />
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-700">{audit.message}</p>
      <div className="flex shrink-0 items-center gap-1.5">
        {source && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
            {source}
          </span>
        )}
        <span
          className={clsx(
            "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            tone.badgeBg,
            tone.badgeText,
          )}
        >
          {tone.label}
        </span>
      </div>
    </div>
  );
}

// ── SeverityDots — indicatore compatto multi-severity per header reparto ──────

function SeverityDots({ audits }: { audits: Pick<TracciatoWidgetScoreAudit, "type">[] }) {
  const counts = { critical: 0, danger: 0, warn: 0, info: 0 } as Record<AuditTypeKey, number>;
  for (const a of audits) {
    const t = a.type as AuditTypeKey;
    if (t in counts) counts[t]++;
  }
  return (
    <span className="flex items-center gap-2">
      {(["critical", "danger", "warn", "info"] as AuditTypeKey[]).map((t) =>
        counts[t] > 0 ? (
          <span key={t} className="flex items-center gap-1">
            <span className={clsx("h-1.5 w-1.5 rounded-full", AUDIT_TYPE_TONE[t].dot)} />
            <span className={clsx("text-[10px] font-semibold tabular-nums", AUDIT_TYPE_TONE[t].text)}>
              {counts[t]}
            </span>
          </span>
        ) : null,
      )}
    </span>
  );
}

// ── ScoreboardAuditPanel ──────────────────────────────────────────────────────

function ScoreboardAuditPanel({
  rows,
  activeFilter,
  onFilterChange,
}: {
  rows: TracciatoWidgetScoreboardRow[];
  activeFilter: AuditTypeKey | "all";
  onFilterChange: (f: AuditTypeKey | "all") => void;
}) {
  const [closedReparti, setClosedReparti] = useState<Set<string>>(new Set());
  const toggleReparto = (reparto: string) =>
    setClosedReparti((prev) => {
      const next = new Set(prev);
      next.has(reparto) ? next.delete(reparto) : next.add(reparto);
      return next;
    });

  const byReparto = useMemo<Array<{ reparto: string; audits: AuditWithSource[] }>>(() => {
    return rows
      .map((row) => {
        const rowAudits: AuditWithSource[] = (row.audit ?? []).map((a) => ({ ...a }));
        const codiceAudits: AuditWithSource[] = (row.codici ?? []).flatMap((c) =>
          (c.audit ?? []).map((a) => ({ ...a, source: c.codice }))
        );
        const seen = new Set<string>();
        const deduped = [...rowAudits, ...codiceAudits].filter((a) => {
          const k = `${a.type}|${a.message}|${a.source ?? ""}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return { reparto: row.reparto, audits: deduped };
      })
      .filter(({ audits }) => audits.length > 0);
  }, [rows]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return byReparto;
    return byReparto
      .map(({ reparto, audits }) => ({
        reparto,
        audits: audits.filter((a) => a.type === activeFilter),
      }))
      .filter(({ audits }) => audits.length > 0);
  }, [byReparto, activeFilter]);

  const typeCounts = useMemo<Record<AuditTypeKey | "all", number>>(() => {
    const all = byReparto.flatMap((r) => r.audits);
    return {
      all: all.length,
      info: all.filter((a) => a.type === "info").length,
      warn: all.filter((a) => a.type === "warn").length,
      danger: all.filter((a) => a.type === "danger").length,
      critical: all.filter((a) => a.type === "critical").length,
    };
  }, [byReparto]);

  const filterOptions: Array<{ key: AuditTypeKey | "all"; label: string }> = [
    { key: "all", label: "Tutti" },
    { key: "critical", label: "Critici" },
    { key: "danger", label: "Attenzione" },
    { key: "warn", label: "Avvisi" },
    { key: "info", label: "Info" },
  ];

  return (
    <div className="border-b border-slate-200/60 bg-slate-50/60">

      {/* Summary bar */}
      <div className="flex items-center gap-4 border-b border-slate-100 bg-white/60 px-5 py-2">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Diagnostica
        </span>
        <div className="flex flex-wrap items-center gap-4">
          {(["critical", "danger", "warn", "info"] as AuditTypeKey[]).map((t) =>
            typeCounts[t] > 0 ? (
              <span key={t} className="flex items-center gap-1.5">
                <span className={clsx("h-2 w-2 rounded-full", AUDIT_TYPE_TONE[t].dot)} />
                <span className={clsx("text-[11px] font-bold tabular-nums", AUDIT_TYPE_TONE[t].text)}>
                  {typeCounts[t]}
                </span>
                <span className="text-[11px] text-slate-400">{AUDIT_TYPE_TONE[t].label}</span>
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-1.5 px-5 py-2.5">
        {filterOptions.map(({ key, label }) => {
          const count = typeCounts[key];
          if (key !== "all" && count === 0) return null;
          const tone = key !== "all" ? AUDIT_TYPE_TONE[key as AuditTypeKey] : null;
          const isActive = activeFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onFilterChange(key)}
              className={clsx(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
                isActive
                  ? tone ? tone.pillActive : "border-slate-300 bg-slate-200 text-slate-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {tone && (
                <Lucide
                  icon={tone.icon}
                  className={clsx("h-3 w-3", isActive ? tone.text : "text-slate-400")}
                />
              )}
              {label}
              <span
                className={clsx(
                  "min-w-[14px] rounded-full px-1.5 text-center text-[9px] tabular-nums",
                  isActive && tone ? `${tone.badgeBg} ${tone.badgeText}` : "bg-slate-100 text-slate-500",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Reparto list */}
      <div className="max-h-80 divide-y divide-slate-100/80 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8">
            <Lucide icon="CheckCircle" className="h-7 w-7 text-slate-200" />
            <span className="text-xs text-slate-400">Nessun messaggio per questo filtro</span>
          </div>
        ) : (
          filtered.map(({ reparto, audits }) => {
            const isClosed = closedReparti.has(reparto);
            const worst = AUDIT_TYPE_TONE[worstSeverity(audits)];
            return (
              <div key={reparto}>
                <button
                  type="button"
                  onClick={() => toggleReparto(reparto)}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-white/70"
                >
                  <Lucide icon={worst.icon} className={clsx("h-3.5 w-3.5 shrink-0", worst.text)} />
                  <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    {reparto}
                  </span>
                  <SeverityDots audits={audits} />
                  <Lucide
                    icon={isClosed ? "ChevronDown" : "ChevronUp"}
                    className="ml-1 h-3.5 w-3.5 shrink-0 text-slate-400"
                  />
                </button>
                <AnimatePresence initial={false}>
                  {!isClosed && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1.5 px-5 pb-3 pt-0.5">
                        {audits.map((audit, idx) => (
                          <ScoreAuditItem
                            key={`${audit.type}-${idx}`}
                            audit={audit}
                            source={audit.source}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ScoreChips({ row }: { row: Pick<TracciatoWidgetScoreboardCodiceRow, 'inalterati' | 'modificati' | 'entranti' | 'uscenti'> }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
      {row.inalterati > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
          <Lucide icon="Minus" className="w-2.5 h-2.5" />{row.inalterati}
        </span>
      )}
      {row.modificati > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
          <Lucide icon="Pencil" className="w-2.5 h-2.5" />{row.modificati}
        </span>
      )}
      {row.entranti > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
          <Lucide icon="TrendingUp" className="w-2.5 h-2.5" />{row.entranti}
        </span>
      )}
      {row.uscenti > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
          <Lucide icon="TrendingDown" className="w-2.5 h-2.5" />{row.uscenti}
        </span>
      )}
    </div>
  );
}

function ScoreboardWidget({ widget }: { widget: TracciatoWidgetScoreboard }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditFilter, setAuditFilter] = useState<AuditTypeKey | "all">("all");

  const { totalAudits, worstAuditType } = useMemo(() => {
    const rowAudits = widget.rows.flatMap((row) => row.audit ?? []);
    const codiceAudits = widget.rows.flatMap((row) =>
      (row.codici ?? []).flatMap((codice) => codice.audit ?? [])
    );
    const all = normalizeScoreAudits([...rowAudits, ...codiceAudits]);
    return { totalAudits: all.length, worstAuditType: worstSeverity(all) };
  }, [widget.rows]);

  const toggle = (reparto: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(reparto) ? next.delete(reparto) : next.add(reparto);
      return next;
    });

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header con toggle audit */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4">
        <div>
          <div className="font-medium text-slate-800">{widget.title}</div>
          {widget.description && (
            <p className="mt-0.5 text-xs text-slate-500">{widget.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {totalAudits > 0 && (() => {
            const tone = AUDIT_TYPE_TONE[worstAuditType];
            return (
              <button
                type="button"
                onClick={() => setAuditOpen((o) => !o)}
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                  auditOpen
                    ? clsx(tone.bg, tone.border, tone.text)
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <Lucide icon={tone.icon} className={clsx("h-3.5 w-3.5", auditOpen ? tone.text : "text-slate-400")} />
                Audit
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    auditOpen ? clsx(tone.badgeBg, tone.badgeText) : "bg-slate-100 text-slate-500",
                  )}
                >
                  {totalAudits}
                </span>
                <Lucide icon={auditOpen ? "ChevronUp" : "ChevronDown"} className="h-3 w-3 text-slate-400" />
              </button>
            );
          })()}
          {widget.badge && (
            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {widget.badge}
            </span>
          )}
        </div>
      </div>

      {/* Pannello audit espandibile */}
      <AnimatePresence initial={false}>
        {auditOpen && totalAudits > 0 && (
          <motion.div
            key="audit-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <ScoreboardAuditPanel
              rows={widget.rows}
              activeFilter={auditFilter}
              onFilterChange={setAuditFilter}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="divide-y divide-slate-100">
        {widget.rows.map((row, i) => {
          const colors = getScoreColor(row.score);
          const hasChildren = (row.codici?.length ?? 0) > 1;
          const isOpen = expanded.has(row.reparto);
          const rowAudits = normalizeScoreAudits([
            ...(row.audit ?? []),
            ...((row.codici ?? []).flatMap((codice) => codice.audit ?? [])),
          ]);

          return (
            <Fragment key={row.reparto}>
              <div
                className={clsx(
                  "px-5 py-3.5 flex items-center gap-4",
                  hasChildren && "cursor-pointer hover:bg-slate-50/60 transition-colors"
                )}
                onClick={hasChildren ? () => toggle(row.reparto) : undefined}
              >
                <span className="w-6 text-center text-xs font-semibold text-slate-400 shrink-0">
                  {i + 1}
                </span>

                <div className="w-44 shrink-0 flex items-center gap-1.5 min-w-0">
                  <span
                    className="min-w-0 flex items-center gap-1 text-sm font-medium text-slate-700 truncate"
                    title={row.reparto}
                  >
                    {hasChildren && (
                      <Lucide
                        icon={isOpen ? "ChevronDown" : "ChevronRight"}
                        className="w-3.5 h-3.5 shrink-0 text-slate-400"
                      />
                    )}
                    {row.reparto}
                  </span>
                  {rowAudits.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 shrink-0">
                      <Lucide icon="AlertTriangle" className="h-2.5 w-2.5" />
                      {rowAudits.length}
                    </span>
                  )}
                </div>

                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={clsx("h-full rounded-full transition-all duration-500", colors.bar)}
                      style={{ width: `${row.score}%` }}
                    />
                  </div>
                  <span className={clsx("w-10 text-right text-xs font-bold shrink-0", colors.text)}>
                    {row.score}%
                  </span>
                </div>

                <ScoreChips row={row} />
              </div>

              {/* Audit inline per righe senza figli (nascosti quando il pannello e aperto) */}
              {!hasChildren && rowAudits.length > 0 && !auditOpen && (
                <div className="space-y-1.5 px-5 pb-3 pl-16">
                  {([
                    ...(row.audit ?? []).map((audit): AuditWithSource => ({ ...audit })),
                    ...((row.codici ?? []).flatMap((c) =>
                      (c.audit ?? []).map((audit): AuditWithSource => ({ ...audit, source: c.codice }))
                    )),
                  ]).map((audit, idx) => (
                    <ScoreAuditItem key={`${audit.type}-${idx}`} audit={audit} source={audit.source} />
                  ))}
                </div>
              )}

              {/* Codici espansi */}
              {hasChildren && isOpen && (
                <div className="bg-slate-50/50 border-t border-slate-100 divide-y divide-slate-100/80">
                  {row.codici!.map((codice) => {
                    const cColors = getScoreColor(codice.score);
                    const codiceAudits = normalizeScoreAudits(codice.audit);
                    return (
                      <div key={codice.codice} className="px-5 py-2.5">
                        <div className="flex items-center gap-4">
                          <span className="w-6 shrink-0 flex justify-center text-slate-200">
                            <span className="w-px h-4 bg-slate-200" />
                          </span>
                          <div className="w-44 shrink-0 min-w-0 flex items-center gap-1.5">
                            <span
                              className="min-w-0 text-xs font-mono text-slate-400 truncate"
                              title={codice.codice}
                            >
                              {codice.codice}
                            </span>
                            {codiceAudits.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 shrink-0">
                                <Lucide icon="AlertTriangle" className="h-2.5 w-2.5" />
                                {codiceAudits.length}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={clsx(
                                  "h-full rounded-full transition-all duration-500",
                                  cColors.bar
                                )}
                                style={{ width: `${codice.score}%` }}
                              />
                            </div>
                            <span
                              className={clsx(
                                "w-10 text-right text-[11px] font-bold shrink-0",
                                cColors.text
                              )}
                            >
                              {codice.score}%
                            </span>
                          </div>
                          <ScoreChips row={codice} />
                        </div>

                        {/* Audit codice (nascosti quando il pannello e aperto) */}
                        {codiceAudits.length > 0 && !auditOpen && (
                          <div className="ml-10 mt-1.5 space-y-1.5">
                            {codiceAudits.map((audit, idx) => (
                              <ScoreAuditItem
                                key={`${audit.type}-${idx}`}
                                audit={audit}
                                source={codice.codice}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
// ── Grouped table widget (entranti / uscenti per reparto) ────────────────────

const GROUPED_TABLE_GRID_CLASS =
  "grid grid-cols-[auto_minmax(12rem,1fr)_minmax(20rem,2.3fr)_5.5rem_8rem_8rem_minmax(9rem,1fr)] gap-3";

const getGruppoKey = (reparto: string, rowIndex: number, codice: string) =>
  `${reparto}__${rowIndex}__${codice}`;

type GroupedTableRowProps = {
  row: TracciatoWidgetGroupedTableRow;
  gruppoKey: string;
  isGruppoOpen: boolean;
  onToggle: (key: string) => void;
};

const GroupedTableRow = memo(function GroupedTableRow({
  row,
  gruppoKey,
  isGruppoOpen,
  onToggle,
}: GroupedTableRowProps) {
  const hasSubCodici = row.tipo === "gruppo" && (row.subCodici?.length ?? 0) > 0;

  const handleToggle = useCallback(() => {
    if (!hasSubCodici) return;
    onToggle(gruppoKey);
  }, [gruppoKey, hasSubCodici, onToggle]);

  return (
    <Fragment>
      <div
        className={clsx(
          `px-5 py-2.5 ${GROUPED_TABLE_GRID_CLASS} items-start text-xs`,
          hasSubCodici && "cursor-pointer hover:bg-slate-50/60 transition-colors"
        )}
        onClick={hasSubCodici ? handleToggle : undefined}
      >
        {/* Expand chevron — only for gruppo */}
        <span className="w-4 mt-0.5 shrink-0 flex justify-center">
          {hasSubCodici ? (
            <Lucide
              icon={isGruppoOpen ? "ChevronDown" : "ChevronRight"}
              className="w-3.5 h-3.5 text-slate-400"
            />
          ) : (
            <span className="w-3.5" />
          )}
        </span>

        {/* Codice + descrizione stacked */}
        <span className="min-w-0 flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 flex-wrap group/copy">
            <span className="font-mono font-semibold text-slate-700 max-w-[10rem] truncate" title={row.codice}>{row.codice}</span>
            <span
              className={clsx(
                "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                row.tipo === "gruppo"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              {row.tipo}
            </span>
            <CopyButton text={row.codice} />
          </span>
          {row.descrizione && row.descrizione !== "—" && (
            <span className="flex items-center gap-1 group/copy">
              <span className="text-slate-400 truncate" title={row.descrizione}>
                {row.descrizione}
              </span>
              <CopyButton text={row.descrizione} title="Copia descrizione" />
            </span>
          )}
        </span>

        <span className="min-w-0 flex items-center gap-1 group/copy mt-0.5">
          <span className="text-slate-500 truncate">{row.tema || "—"}</span>
          {row.tema && row.tema !== "—" && (
            <CopyButton text={row.tema} title="Copia tema" />
          )}
        </span>
        <span className="text-right font-semibold text-slate-700 mt-0.5">{row.txt_sconto || "—"}</span>
        <span className="text-right font-semibold text-slate-700 mt-0.5">{row.prezzo || "—"}</span>
        <span className="text-right text-slate-500 mt-0.5">{row.prezzo_continuo || "—"}</span>
        <span className="text-slate-500 truncate mt-0.5">{row.prestazione || "—"}</span>
      </div>

      {/* Sub-codici del gruppo */}
      {hasSubCodici && isGruppoOpen && (
        <div className="bg-slate-50/50 divide-y divide-slate-100/40 border-b border-slate-100/60">
          {row.subCodici!.map((sub, subIndex) => (
            <div key={`${sub.codice}-${subIndex}`} className="pl-12 pr-5 py-1.5 flex items-start gap-2 text-xs">
              <span className="w-px h-3 bg-slate-300 shrink-0 mt-1" />
              <span className="min-w-0 flex flex-col gap-0.5">
                <span className="flex items-center gap-1 group/copy">
                  <span className="font-mono text-slate-500">{sub.codice}</span>
                  <CopyButton text={sub.codice} />
                </span>
                <span className="text-slate-400 truncate" title={sub.descrizione || "—"}>
                  {sub.descrizione || "—"}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Fragment>
  );
});

type GroupedTableGroupSectionProps = {
  group: TracciatoWidgetGroupedTableGroup;
  expandedGruppi: Set<string>;
  onToggle: (key: string) => void;
};

const GroupedTableGroupSection = memo(function GroupedTableGroupSection({
  group,
  expandedGruppi,
  onToggle,
}: GroupedTableGroupSectionProps) {
  return (
    <Fragment>
      {/* Reparto header — static, always visible */}
      <div className="px-5 py-2 flex items-center gap-2 bg-slate-50 border-y border-slate-100">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{group.reparto}</span>
        <span className="text-[10px] text-slate-400">({group.rows.length})</span>
      </div>

      {/* Column header */}
      <div className={`px-5 py-1.5 ${GROUPED_TABLE_GRID_CLASS} text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100/60 bg-white`}>
        <span className="w-4" />
        <span>Codice / Descrizione</span>
        <span>Tema</span>
        <span className="text-right">Sconto</span>
        <span className="text-right">Prezzo promo</span>
        <span className="text-right">Prezzo cont.</span>
        <span className="text-right">Prestazione</span>
      </div>

      {/* Referenze rows */}
      <div className="divide-y divide-slate-100/60">
        {group.rows.map((row, rowIndex) => {
          const gruppoKey = getGruppoKey(group.reparto, rowIndex, row.codice);
          return (
            <GroupedTableRow
              key={gruppoKey}
              row={row}
              gruppoKey={gruppoKey}
              isGruppoOpen={expandedGruppi.has(gruppoKey)}
              onToggle={onToggle}
            />
          );
        })}
      </div>
    </Fragment>
  );
}, (prevProps, nextProps) => {
  if (prevProps.group !== nextProps.group) return false;
  if (prevProps.onToggle !== nextProps.onToggle) return false;

  const rows = prevProps.group.rows;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const key = getGruppoKey(prevProps.group.reparto, i, row.codice);
    if (prevProps.expandedGruppi.has(key) !== nextProps.expandedGruppi.has(key)) {
      return false;
    }
  }
  return true;
});

const GroupedTableWidget = memo(function GroupedTableWidget({ widget }: { widget: TracciatoWidgetGroupedTable }) {
  const [expandedGruppi, setExpandedGruppi] = useState<Set<string>>(() => new Set());

  const toggleGruppo = useCallback((key: string) => {
    setExpandedGruppi((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <WidgetHeader
        title={widget.title}
        description={widget.description}
        badge={widget.badge ?? `${widget.totalCount.toLocaleString("it-IT")} referenze`}
      />

      {widget.groups.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">Nessuna referenza</div>
      ) : (
        <div>
          {widget.groups.map((group, groupIndex) => (
            <GroupedTableGroupSection
              key={`${group.reparto}-${groupIndex}`}
              group={group}
              expandedGruppi={expandedGruppi}
              onToggle={toggleGruppo}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ── Widget router ─────────────────────────────────────────────────────────────

function resolveSpanClass(widget: TracciatoReportWidget): string {
  if (widget.type === "table") return "col-span-12";
  if (widget.type === "callout") return "col-span-12";
  if (widget.type === "referenze_split_table") return "col-span-12";
  if (widget.type === "dual_pie_chart") return "col-span-12";
  if (widget.type === "price_diff") return "col-span-12";
  if (widget.type === "scoreboard") return "col-span-12";
  if (widget.type === "grouped_table") return "col-span-12";
  if (widget.type === "line_chart") return "col-span-12";
  return GRID_SPAN[widget.gridSpan ?? 4] ?? "col-span-12";
}

function ReportWidget({ widget }: { widget: TracciatoReportWidget }) {
  switch (widget.type) {
    case "kpi_grid":
      return <KpiGridWidget widget={widget} />;
    case "bar_chart":
      return <BarChartWidget widget={widget} />;
    case "line_chart":
      return <LineChartWidget widget={widget} />;
    case "pie_chart":
      return <PieChartWidget widget={widget} />;
    case "table":
      return <TableWidget widget={widget} />;
    case "callout":
      return <CalloutWidget widget={widget} />;
    case "referenze_split_table":
      return <ReferenzeSplitTableWidget widget={widget} />;
    case "dual_pie_chart":
      return <DualPieChartWidget widget={widget} />;
    case "price_diff":
      return <PriceDiffWidget widget={widget} />;
    case "scoreboard":
      return <ScoreboardWidget widget={widget} />;
    case "grouped_table":
      return <GroupedTableWidget widget={widget} />;
    default:
      return null;
  }
}

// ── Selettore canale/area ─────────────────────────────────────────────────────

const PILL_BASE = "rounded-full border px-3 py-1 text-xs font-semibold transition-colors";
const PILL_ACTIVE = "border-blue-200 bg-blue-50 text-blue-700";
const PILL_INACTIVE = "border-slate-200 bg-white text-slate-500 hover:bg-slate-50";

function ViewSelector({
  views,
  selectedKey,
  onSelect,
}: {
  views: TracciatoReportCanaleAreaView[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Canale / Area
      </span>
      {views.map((view) => {
        const key = `${view.guidCanale}::${view.guidArea}`;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`${PILL_BASE} ${selectedKey === key ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            {view.label || `${view.nomeCanale} — ${view.nomeArea}`}
          </button>
        );
      })}
    </div>
  );
}

// ── Multi-report view (per_promo | trend) ────────────────────────────────────

function MultiReportView({ queryResult }: { queryResult: TracciatoQueryResult }) {
  const navigate = useNavigate();
  const reports = queryResult.reports ?? [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedViewKey, setSelectedViewKey] = useState("");

  const active = reports[activeIndex];

  useEffect(() => {
    setSelectedViewKey("");
  }, [activeIndex]);

  useEffect(() => {
    if (active?.report.viewsPerCanaleArea?.length && !selectedViewKey) {
      const first = active.report.viewsPerCanaleArea[0];
      setSelectedViewKey(`${first.guidCanale}::${first.guidArea}`);
    }
  }, [active, selectedViewKey]);

  const activeWidgets = useMemo(() => {
    if (!active) return [];
    const views = active.report.viewsPerCanaleArea;
    if (views?.length) {
      const view = views.find((v) => `${v.guidCanale}::${v.guidArea}` === selectedViewKey);
      return view?.widgets ?? views[0].widgets;
    }
    return active.report.widgets;
  }, [active, selectedViewKey]);

  const isTrend = queryResult.aggregazione === "trend";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={isTrend ? "Trend temporale" : "Report per promo"}
        description={`${reports.length} promo analizzate · calcolato il ${dayjs(queryResult.computedAt).format("DD/MM/YYYY HH:mm")}`}
        actions={
          <button
            type="button"
            onClick={() => navigate("/report/tracciati")}
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Lucide icon="ArrowLeft" className="h-4 w-4" />
            Nuova query
          </button>
        }
      />

      {/* Selettore promo */}
      <div className="box box--stacked">
        <div className="border-b border-slate-200/70 px-5 py-3">
          <div className="flex items-center gap-2">
            <Lucide icon={isTrend ? "TrendingUp" : "LayoutGrid"} className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-slate-800">
              {isTrend ? "Seleziona punto del trend" : "Seleziona promo"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 p-4">
          {reports.map((r, i) => (
            <button
              key={r.promoId}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={clsx(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                i === activeIndex
                  ? "bg-primary text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary"
              )}
            >
              {isTrend && (
                <span className="font-semibold opacity-70">{dayjs(r.date).format("DD/MM/YY")}</span>
              )}
              <span className="max-w-[180px] truncate">{r.promoNome}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selettore canale/area della promo attiva */}
      {active?.report.viewsPerCanaleArea && active.report.viewsPerCanaleArea.length > 1 && (
        <ViewSelector
          views={active.report.viewsPerCanaleArea}
          selectedKey={selectedViewKey}
          onSelect={setSelectedViewKey}
        />
      )}

      {/* Widget del report attivo */}
      {active && (
        <div className="grid grid-cols-12 gap-5">
          {activeWidgets.map((widget) => (
            <div key={widget.id} className={resolveSpanClass(widget)}>
              <ReportWidget widget={widget} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function Main() {
  const location = useLocation();
  const navigate = useNavigate();
  const { idPromo, guidIdConfronto } = useParams();
  const { showNotification } = useNotification();

  const queryResult = location.state?.queryResult as TracciatoQueryResult | undefined;
  const isMultiReport = Boolean(queryResult && queryResult.aggregazione !== "merged");

  const confronto = location.state?.confronto as TracciatiMomentoConfrontoResponseDTO | undefined;
  const promoNameFromState = location.state?.promoName as string | undefined;
  const reportFromState =
    (location.state?.report as TracciatoReport | undefined) ??
    (queryResult?.report as TracciatoReport | undefined) ??
    (confronto?.report as TracciatoReport | undefined);

  const [selectedViewKey, setSelectedViewKey] = useState<string>("");

  const isScoreboardRoute = guidIdConfronto === "promo-scoreboard";

  const confrontoQuery = useQuery({
    queryKey: ["tracciatiMomentoConfronto", guidIdConfronto],
    enabled: Boolean(guidIdConfronto) && !reportFromState && !isScoreboardRoute,
    queryFn: () =>
      ServerCall.get<TracciatiMomentoConfrontoResponseDTO>(`/tracciati/momenti/confronti/${guidIdConfronto}`),
  });

  const scoreboardQuery = useQuery({
    queryKey: ["promoScoreboard", idPromo],
    enabled: isScoreboardRoute && !reportFromState && Boolean(idPromo),
    staleTime: Infinity,
    queryFn: () => ServerCall.get<TracciatoReport>(`/scoreboard/promo/${idPromo}`),
  });

  // Nome della promo: usato nel PDF come titolo gigante in prima pagina
  const promoQuery = useQuery({
    queryKey: ["promoDettagli", idPromo],
    enabled: Boolean(idPromo),
    staleTime: Infinity,
    queryFn: () => ServerCall.get<IPromo>(`/promo/${idPromo}`),
  });

  const report = reportFromState
    ?? (isScoreboardRoute ? scoreboardQuery.data : confrontoQuery.data?.report as TracciatoReport | undefined)
    ?? undefined;

  const promoName = useMemo(() => {
    const cachedPromoName = idPromo ? sessionStorage.getItem(`promo_${idPromo}`) : null;
    return promoQuery.data?.nomePromo ?? promoNameFromState ?? cachedPromoName ?? undefined;
  }, [idPromo, promoNameFromState, promoQuery.data?.nomePromo]);

  // Inizializza la selezione sulla prima vista disponibile quando il report arriva
  useEffect(() => {
    if (report?.viewsPerCanaleArea?.length && !selectedViewKey) {
      const first = report.viewsPerCanaleArea[0];
      setSelectedViewKey(`${first.guidCanale}::${first.guidArea}`);
    }
  }, [report, selectedViewKey]);

  const activeWidgets = useMemo(() => {
    if (!report) return [];
    const views = report.viewsPerCanaleArea;
    if (views?.length) {
      const view = views.find(
        (v: TracciatoReportCanaleAreaView) => `${v.guidCanale}::${v.guidArea}` === selectedViewKey,
      );
      return view?.widgets ?? views[0].widgets;
    }
    return report.widgets;
  }, [report, selectedViewKey]);

  const fallbackPath = idPromo ? `/promozioni/in-corso/dettagli/${idPromo}` : "/report/tracciati";

  useEffect(() => {
    const isLoading = confrontoQuery.isLoading || scoreboardQuery.isLoading;
    if (!report && !isLoading) {
      navigate(fallbackPath, { replace: true });
    }
  }, [report, confrontoQuery.isLoading, scoreboardQuery.isLoading, navigate, fallbackPath]);

  const pdfMutation = useMutation({
    mutationFn: async () => {
      const { createTracciatoReportPdfBlob } = await import("./createTracciatoReportPdf");

      const selectedView = report!.viewsPerCanaleArea?.find(
        (v) => `${v.guidCanale}::${v.guidArea}` === selectedViewKey,
      ) ?? report!.viewsPerCanaleArea?.[0];

      const viewLabel = selectedView?.label || (selectedView ? `${selectedView.nomeCanale} — ${selectedView.nomeArea}` : "");
      const pdfSubtitle = [report!.subtitle, viewLabel].filter(Boolean).join(" — ") || undefined;
      const fileSlug = viewLabel
        ? viewLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        : "";
      const filename = fileSlug
        ? `report-tracciati-${fileSlug}-${dayjs().format("YYYY-MM-DD")}.pdf`
        : `report-tracciati-${dayjs().format("YYYY-MM-DD")}.pdf`;

      // Il PDF usa la variante `widgetsPdf` calcolata dall'agenzia lib (regole per-cliente,
      // es. Coopfi esclude alcuni temi); se assente si usano i widget normali. La vista a
      // schermo continua invece a usare `activeWidgets`.
      const pdfWidgets = selectedView
        ? (selectedView.widgetsPdf ?? activeWidgets)
        : (report!.widgetsPdf ?? activeWidgets);

      const blob = await createTracciatoReportPdfBlob(
        { ...report!, widgets: pdfWidgets, subtitle: pdfSubtitle },
        promoName,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (error: any) => {
      showNotification(
        <div className="flex items-start gap-3">
          <Lucide icon="CircleAlert" className="h-6 w-6 shrink-0 text-danger" />
          <div>
            <div className="text-sm font-semibold">Errore esportazione PDF</div>
            <div className="mt-1 text-xs text-slate-500">
              {error?.message || "Non è stato possibile generare il PDF. Riprova."}
            </div>
          </div>
        </div>,
        { variant: "error" }
      );
    },
  });

  if (isMultiReport) {
    return <MultiReportView queryResult={queryResult!} />;
  }

  if (!report) {
    return null;
  }

  const formattedDate = dayjs(report.generatedAt).isValid()
    ? dayjs(report.generatedAt).format("DD/MM/YYYY HH:mm")
    : "";

  const description = [
    report.subtitle,
    formattedDate ? `Generato il ${formattedDate}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={report.title}
        description={description || undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(fallbackPath)}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Lucide icon="ArrowLeft" className="h-4 w-4" />
              Nuovo confronto
            </button>
            <Button
              type="button"
              onClick={() => pdfMutation.mutate()}
              disabled={pdfMutation.isPending}
              variant="primary"
              className="flex h-9 items-center gap-2 rounded-lg  px-4 text-sm font-medium  "
            >
              {pdfMutation.isPending ? (
                <>
                  <div className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  Creazione PDF...
                </>
              ) : (
                <>
                  <Lucide icon="FileDown" className="h-4 w-4" />
                  Esporta PDF
                </>
              )}
            </Button>
          </div>
        }
      />

      {report.viewsPerCanaleArea && report.viewsPerCanaleArea.length > 1 && (
        <ViewSelector
          views={report.viewsPerCanaleArea}
          selectedKey={selectedViewKey}
          onSelect={setSelectedViewKey}
        />
      )}

      <div className="grid grid-cols-12 gap-5">
        {activeWidgets.map((widget) => (
          <div key={widget.id} className={resolveSpanClass(widget)}>
            <ReportWidget widget={widget} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default withSessionCheck(Main);
