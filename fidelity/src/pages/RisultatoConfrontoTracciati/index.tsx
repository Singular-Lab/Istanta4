import Alert from "@/components/Base/Alert";
import Badge from "@/components/Base/Badge";
import BarraFiltri from "@/components/Base/BarraFiltri";
import CampoRicerca from "@/components/Base/CampoRicerca";
import Chart from "@/components/Base/Chart";
import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import type { TonoStato } from "@/constants/stati";
import { useNotification } from "@/context/NotificationContext";
import { opzioniBase, paletteColore } from "@/utils/chartTheme";
import { getColor } from "@/utils/colors";
import { formatData, formatDataOra, formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { Fragment, memo, useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
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

// ── Toni dei KPI: stessi colori di StatusBadge e StatCard ─────────────────────

const KPI_TONO: Record<NonNullable<KpiCardItem["color"]>, TonoStato> = {
  green: "success",
  red: "danger",
  blue: "info",
  amber: "warning",
  slate: "neutral",
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

// ── Sezione del widget ────────────────────────────────────────────────────────

/**
 * Ogni widget è una Sezione di primo livello (titolo h2): intestazione con titolo,
 * descrizione, eventuali azioni e il badge a destra; il contenuto arriva ai bordi.
 */
function WidgetSezione({
  title,
  description,
  badge,
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  badge?: string;
  /** Comandi del widget, prima del badge (Button size="sm"). */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const azioni =
    actions || badge ? (
      <>
        {actions}
        {badge && (
          <Badge variant="secondary" size="sm" className="flex-none">
            {badge}
          </Badge>
        )}
      </>
    ) : undefined;

  return (
    <Sezione senzaPadding titolo={title} descrizione={description} azioni={azioni} className={className}>
      {children}
    </Sezione>
  );
}

/** Piè del widget: conteggi sotto una tabella a filo. */
function WidgetPiede({ children }: { children: ReactNode }) {
  return <div className="border-t border-slate-100 px-5 py-3 text-right text-sm text-slate-500">{children}</div>;
}

/** Riga vuota di una tabella: lo stato vuoto occupa tutte le colonne. */
function RigaVuota({ colonne, titolo, icona = "Inbox" }: { colonne: number; titolo: string; icona?: Parameters<typeof EmptyState>[0]["icon"] }) {
  return (
    <Table.Tr>
      <Table.Td colSpan={colonne} className="p-0">
        <EmptyState compatta icon={icona} title={titolo} description="" />
      </Table.Td>
    </Table.Tr>
  );
}

/** Tipo di referenza (singolo o gruppo) con lo stesso aspetto in tutti i widget. */
function BadgeTipo({ tipo, children }: { tipo: string; children: ReactNode }) {
  return (
    <Badge variant={tipo.toLowerCase() === "gruppo" ? "primary" : "info"} size="sm">
      {children}
    </Badge>
  );
}

// ── KPI grid ─────────────────────────────────────────────────────────────────

function KpiGridWidget({ widget }: { widget: TracciatoWidgetKpiGrid }) {
  const totalValue = widget.items.reduce((s, i) => s + i.value, 0);

  return (
    <WidgetSezione title={widget.title} description={widget.description} badge={widget.badge}>
      <div className="px-5 pb-5">
        <StatCardGrid>
          {widget.items.map((item, idx) => {
            const tono = KPI_TONO[item.color ?? "slate"];
            return (
              <StatCard
                key={idx}
                densita="compatta"
                etichetta={item.label}
                icona={item.icon ?? KPI_ICON_FALLBACK[item.label] ?? "BarChart2"}
                tono={tono}
                evidenzia={tono === "success" || tono === "danger" || tono === "warning"}
                valore={
                  <>
                    {formatNumero(item.value)}
                    {item.unit && <span className="ml-1 text-sm font-normal text-slate-500">{item.unit}</span>}
                  </>
                }
                sottotitolo={
                  totalValue > 0 ? `${Math.round((item.value / totalValue) * 100)}% del totale` : undefined
                }
              />
            );
          })}
        </StatCardGrid>
      </div>
    </WidgetSezione>
  );
}

// ── Bar chart ────────────────────────────────────────────────────────────────

// Legenda in basso con i pallini, comune ai grafici dei widget
const LEGENDA_PALLINI = { usePointStyle: true, pointStyle: "circle", boxWidth: 8 } as const;

function BarChartWidget({ widget }: { widget: TracciatoWidgetChart }) {
  const chartData = useMemo(
    () => ({
      labels: widget.labels,
      datasets: widget.datasets.map((dataset, indice) => ({
        label: dataset.label,
        data: dataset.data,
        // Il colore arriva dal report; se manca si usa la palette comune
        backgroundColor: dataset.backgroundColor ?? paletteColore(indice),
        borderRadius: 6,
        maxBarThickness: 36,
      })),
    }),
    [widget.labels, widget.datasets]
  );

  const chartOptions = useMemo(
    () =>
      opzioniBase("bar", {
        plugins: {
          legend: { position: "bottom", labels: { ...LEGENDA_PALLINI, padding: 16 } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true },
        },
      }),
    []
  );

  return (
    <WidgetSezione title={widget.title} description={widget.description} badge={widget.badge}>
      <div className="px-5 pb-5">
        <Chart type="bar" data={chartData} options={chartOptions as any} height={260} />
      </div>
    </WidgetSezione>
  );
}

// ── Line chart ────────────────────────────────────────────────────────────────

import type { ChartOptions, TooltipItem } from "chart.js";

function LineChartWidget({ widget }: { widget: TracciatoWidgetLineChart }) {
  const chartData = useMemo(
    () => ({
      labels: widget.labels,
      datasets: widget.datasets.map((dataset, indice) => {
        // Il colore arriva dal report; se manca si usa la palette comune
        const colore = dataset.borderColor ?? paletteColore(indice);
        return {
          label: dataset.label,
          data: dataset.data,
          borderColor: colore,
          backgroundColor: dataset.backgroundColor ?? colore,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: 0.35,
          fill: false,
        };
      }),
    }),
    [widget.labels, widget.datasets]
  );

  const chartOptions = useMemo<ChartOptions<"line">>(() => {
    const titoloAsse = (testo: string) => ({
      display: true,
      text: testo,
      color: getColor("slate.500"),
      font: { size: 11, weight: 600 },
    });

    return opzioniBase("line", {
      plugins: {
        legend: { position: "bottom", labels: { ...LEGENDA_PALLINI, padding: 12 } },
        tooltip: {
          callbacks: {
            label(context: TooltipItem<"line">) {
              const label = context.dataset.label ?? "Reparto";
              // context.parsed.y can be number or null
              const value = typeof context.parsed.y === "number" ? context.parsed.y : 0;
              return `${label}: ${Math.round(value)}%`;
            },
          },
        },
      },
      scales: {
        x: { title: titoloAsse("Confronti") },
        y: {
          min: 0,
          max: 100,
          title: titoloAsse("Punteggio (%)"),
          ticks: {
            stepSize: 20,
            callback: (value: number | string) => `${value}%`,
          },
        },
      },
    });
  }, []);

  return (
    <WidgetSezione title={widget.title} description={widget.description} badge={widget.badge}>
      <div className="px-5 pb-5">
        <Chart type="line" data={chartData} options={chartOptions as any} height={280} />
      </div>
    </WidgetSezione>
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
        // Il colore arriva dal report; se manca uno per fetta dalla palette comune
        backgroundColor: dataset.backgroundColor ?? widget.labels.map((_, indice) => paletteColore(indice)),
        borderWidth: 2,
        borderColor: getColor("slate.50"),
        hoverOffset: 6,
      })),
    }),
    [widget.labels, widget.datasets]
  );

  const chartOptions = useMemo(
    () =>
      opzioniBase("doughnut", {
        plugins: {
          legend: { position: "right", labels: { ...LEGENDA_PALLINI, padding: 14 } },
        },
        cutout: "60%",
      }),
    []
  );

  return (
    <WidgetSezione title={widget.title} description={widget.description} badge={widget.badge}>
      <div className="px-5 pb-5">
        <Chart type="doughnut" data={chartData} options={chartOptions as any} height={240} />
        {totalSum > 0 && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Totale: <span className="font-semibold tabular-nums text-slate-700">{formatNumero(totalSum)}</span>
          </p>
        )}
      </div>
    </WidgetSezione>
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
    <WidgetSezione
      title={widget.title}
      description={widget.description}
      badge={widget.badge ?? `${widget.rows.length} ${widget.rows.length === 1 ? "riga" : "righe"}`}
      className="overflow-hidden"
    >
      <div className="overflow-x-auto">
        <Table>
          <Table.Thead>
            <Table.Tr>
              {widget.columns.map((column, index) => (
                <Table.Th key={index} className={clsx(numericKeys.has(column.key) && "text-right tabular-nums")}>
                  {column.label}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {widget.rows.length === 0 ? (
              <RigaVuota colonne={widget.columns.length} titolo="Nessun dato disponibile" />
            ) : (
              widget.rows.map((row, rowIndex) => (
                <Table.Tr key={rowIndex} className="[&_td]:last:border-b-0">
                  {widget.columns.map((column, colIndex) => (
                    <Table.Td
                      key={colIndex}
                      className={clsx("text-slate-700", numericKeys.has(column.key) && "text-right tabular-nums")}
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
      {widget.rows.length > 10 && <WidgetPiede>{formatNumero(widget.rows.length)} risultati totali</WidgetPiede>}
    </WidgetSezione>
  );
}

// ── Callout ───────────────────────────────────────────────────────────────────

const CALLOUT_TONE: Record<
  NonNullable<TracciatoWidgetCallout["severity"]>,
  { variant: "soft-info" | "soft-success" | "soft-warning" | "soft-danger"; icon: string }
> = {
  info: { variant: "soft-info", icon: "Info" },
  success: { variant: "soft-success", icon: "CircleCheck" },
  warning: { variant: "soft-warning", icon: "TriangleAlert" },
  error: { variant: "soft-danger", icon: "CircleAlert" },
};

function CalloutWidget({ widget }: { widget: TracciatoWidgetCallout }) {
  const severity = widget.severity ?? "info";
  const tone = CALLOUT_TONE[severity];

  return (
    <Alert
      variant={tone.variant}
      icona={widget.icon ?? tone.icon}
      titolo={
        <span className="flex items-start justify-between gap-3">
          <span>{widget.title}</span>
          {widget.badge && (
            <Badge variant="secondary" size="sm" className="flex-none">
              {widget.badge}
            </Badge>
          )}
        </span>
      }
    >
      {widget.description && <p className="text-xs opacity-80">{widget.description}</p>}
      <p className="mt-1 text-sm leading-relaxed">{widget.message}</p>
    </Alert>
  );
}

// ── Referenze split table ─────────────────────────────────────────────────────

type SchedaReferenze = "singoli" | "gruppi";

function ReferenzeTabella({
  columns,
  rows,
}: {
  columns: TracciatoWidgetReferenzeSplitTable["columns"];
  rows: TracciatoWidgetReferenzeSplitTable["singoli"];
}) {
  const numericKeys = useMemo<Set<string>>(() => {
    const first = rows[0];
    if (!first) return new Set();
    return new Set(Object.keys(first).filter((k) => typeof first[k] === "number"));
  }, [rows]);

  return (
    <div className="max-h-96 overflow-auto">
      <Table>
        <Table.Thead>
          <Table.Tr>
            {columns.map((col, i) => (
              <Table.Th
                key={i}
                className={clsx("sticky top-0 z-10", numericKeys.has(col.key) && "text-right tabular-nums")}
              >
                {col.label}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <RigaVuota colonne={columns.length} titolo="Nessuna referenza" />
          ) : (
            rows.map((row, ri) => (
              <Table.Tr key={ri} className="[&_td]:last:border-b-0">
                {columns.map((col, ci) => {
                  const val = row[col.key];
                  return (
                    <Table.Td
                      key={ci}
                      className={clsx("py-2.5 text-slate-700", numericKeys.has(col.key) && "text-right tabular-nums")}
                    >
                      {col.key === "tipo" ? (
                        <BadgeTipo tipo={String(val ?? "")}>{String(val ?? "—")}</BadgeTipo>
                      ) : (
                        String(val ?? "—")
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
  );
}

function ReferenzeSplitTableWidget({ widget }: { widget: TracciatoWidgetReferenzeSplitTable }) {
  const [activeTab, setActiveTab] = useState<SchedaReferenze>("singoli");

  const tabs: Array<{ key: SchedaReferenze; label: string; rows: TracciatoWidgetReferenzeSplitTable["singoli"] }> = [
    { key: "singoli", label: "Singoli", rows: widget.singoli },
    { key: "gruppi", label: "Gruppi", rows: widget.gruppi },
  ];
  const indiceAttivo = Math.max(0, tabs.findIndex((tab) => tab.key === activeTab));
  const rows = tabs[indiceAttivo].rows;

  return (
    <WidgetSezione title={widget.title} description={widget.description} badge={widget.badge} className="overflow-hidden">
      <Tab.Group selectedIndex={indiceAttivo} onChange={(indice: number) => setActiveTab(tabs[indice].key)}>
        <Tab.List variant="link-tabs" className="border-b border-slate-200 px-5">
          {tabs.map((tab) => (
            <Tab key={tab.key} fullWidth={false}>
              <Tab.Button as="span" className="flex items-center gap-2 text-sm">
                {tab.label}
                <span className="tabular-nums text-slate-400">{formatNumero(tab.rows.length)}</span>
              </Tab.Button>
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels>
          {tabs.map((tab) => (
            <Tab.Panel key={tab.key}>
              <ReferenzeTabella columns={widget.columns} rows={tab.rows} />
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
      {rows.length > 10 && (
        <WidgetPiede>
          {formatNumero(rows.length)} risultati
        </WidgetPiede>
      )}
    </WidgetSezione>
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
        borderColor: getColor("slate.50"),
        hoverOffset: 8,
      },
    ],
  });

  const chartOptions = useMemo(
    () =>
      opzioniBase("doughnut", {
        plugins: {
          legend: { position: "bottom", labels: { ...LEGENDA_PALLINI, padding: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const total = (ctx.dataset.data as number[]).reduce((s: number, v: number) => s + v, 0);
                const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                return ` ${ctx.label}: ${formatNumero(ctx.parsed)} (${pct}%)`;
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

  const grafici = [
    { chiave: "prima", titolo: "Prima", etichetta: widget.labelA, dati: widget.dataA, totale: totalA, pallino: "bg-slate-400", ritardo: 0 },
    { chiave: "dopo", titolo: "Dopo", etichetta: widget.labelB, dati: widget.dataB, totale: totalB, pallino: "bg-info", ritardo: 0.1 },
  ];

  return (
    <WidgetSezione title={widget.title} description={widget.description} badge={widget.badge}>
      <div className="grid grid-cols-1 gap-6 px-5 pb-5 sm:grid-cols-2">
        {grafici.map((grafico) => (
          <motion.div
            key={grafico.chiave}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: grafico.ritardo }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className={clsx("h-2 w-2 rounded-full", grafico.pallino)} />
              <h3 className="title-eyebrow">{grafico.titolo}</h3>
              <Badge variant={grafico.chiave === "dopo" ? "info" : "secondary"} size="sm" className="tabular-nums">
                {grafico.etichetta}
              </Badge>
            </div>
            <div className="relative h-56 w-full">
              <Chart type="doughnut" data={makeChartData(grafico.dati)} options={chartOptions as any} height={220} />
            </div>
            <p className="text-xs text-slate-500">
              Totale: <span className="font-semibold tabular-nums text-slate-700">{formatNumero(grafico.totale)}</span> referenze
            </p>
          </motion.div>
        ))}
      </div>
    </WidgetSezione>
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
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-3xs font-bold tabular-nums",
        isPos && "bg-danger/10 text-danger",
        isNeg && "bg-success/10 text-success",
        !isPos && !isNeg && "bg-slate-100 text-slate-500",
      )}
    >
      {isPos && <Lucide icon="TrendingUp" aria-hidden="true" className="h-2.5 w-2.5" />}
      {isNeg && <Lucide icon="TrendingDown" aria-hidden="true" className="h-2.5 w-2.5" />}
      {change.deltaPercent}
    </span>
  );
}

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
      aria-label={title}
      className="rounded-control p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 group-hover/copy:opacity-100"
    >
      <Lucide
        icon={copied ? "Check" : "Copy"}
        aria-hidden="true"
        className={clsx("h-3 w-3 transition-colors", copied && "text-success")}
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
    <WidgetSezione
      title={widget.title}
      description={widget.description}
      badge={widget.badge ?? `${formatNumero(widget.rows.length)} referenze · ${formatNumero(totalChanges)} variazioni`}
      className="overflow-hidden"
    >
      {widget.rows.length > 0 && (
        <BarraFiltri
          destra={
            <Button
              type="button"
              variant="outline-secondary"
              size="sm"
              onClick={toggleAll}
              disabled={filteredRows.length === 0}
            >
              <Lucide
                icon={allExpanded ? "ChevronsUp" : "ChevronsDown"}
                aria-hidden="true"
                className="mr-1.5 h-3.5 w-3.5"
              />
              {allExpanded ? "Comprimi tutto" : "Espandi tutto"}
            </Button>
          }
        >
          <CampoRicerca
            etichetta="Cerca per codice referenza"
            placeholder="Codice, reparto o descrizione"
            value={searchCodice}
            onChange={setSearchCodice}
          />
        </BarraFiltri>
      )}

      <div className="max-h-96 overflow-auto">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="sticky top-0 z-10 w-8">
                <span className="sr-only">Dettaglio</span>
              </Table.Th>
              {["Codice", "Reparto", "Tipo", ...extraColumns.map((column) => column.label), "Campi modificati"].map(
                (label, i) => (
                  <Table.Th key={i} className="sticky top-0 z-10">
                    {label}
                  </Table.Th>
                ),
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredRows.length === 0 ? (
              <RigaVuota
                colonne={mainColumnCount}
                icona={normalizedSearch ? "Search" : "Inbox"}
                titolo={normalizedSearch ? "Nessuna referenza trovata per questo codice" : "Nessuna variazione rilevata"}
              />
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
                      className="cursor-pointer [&:hover_td]:bg-slate-50"
                    >
                      <Table.Td className="w-8 px-3 py-2.5 text-slate-400">
                        {/* La riga resta cliccabile col mouse; da tastiera si espande dal pulsante */}
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Comprimi" : "Espandi"} ${row.codice}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(index);
                          }}
                          className="flex rounded-control p-0.5 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
                        >
                          <Lucide
                            icon={isExpanded ? "ChevronDown" : "ChevronRight"}
                            aria-hidden="true"
                            className="h-4 w-4 transition-transform"
                          />
                        </button>
                      </Table.Td>
                      <Table.Td className="py-2.5 font-medium text-slate-800">
                        <div className="group/copy flex items-center gap-1.5">
                          <span className="font-mono" title={row.codice}>
                            {row.codice.length > 20 ? `${row.codice.slice(0, 20)}…` : row.codice}
                          </span>
                          <CopyButton text={row.codice} />
                        </div>
                      </Table.Td>
                      <Table.Td className="py-2.5 text-slate-600">{row.reparto}</Table.Td>
                      <Table.Td className="py-2.5">
                        <BadgeTipo tipo={row.tipo}>{row.tipo === "singolo" ? "Singolo" : "Gruppo"}</BadgeTipo>
                      </Table.Td>
                      {extraColumns.map((column) => {
                        const value = formatPriceDiffExtraValue(getPriceDiffExtraValue(row, column.key));
                        const isCopyable = PRICE_DIFF_COPYABLE_COLUMNS.has(column.key) && value !== "—";
                        return (
                          <Table.Td key={column.key} className="py-2.5 text-slate-600">
                            <span className="group/copy inline-flex max-w-full items-center gap-1.5">
                              <span className="whitespace-nowrap" title={value}>
                                {value.length > 24 ? `${value.slice(0, 24)}…` : value}
                              </span>
                              {isCopyable && (
                                <CopyButton text={value} title={`Copia ${column.label.toLowerCase()}`} />
                              )}
                            </span>
                          </Table.Td>
                        );
                      })}
                      <Table.Td className="py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {row.changes.map((c) => (
                            <Badge key={c.campo} variant="warning" size="sm">
                              {c.label}
                            </Badge>
                          ))}
                        </div>
                      </Table.Td>
                    </motion.tr>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <tr>
                        <Table.Td colSpan={mainColumnCount} className="bg-slate-50 pb-3 pt-0">
                          <div className="overflow-x-auto rounded-control border border-slate-200 bg-white">
                            <Table sm hover={false}>
                              <Table.Thead>
                                <Table.Tr>
                                  {["Campo", "Prima", "Dopo", "Variazione"].map((h, hi) => (
                                    <Table.Th key={hi} className={hi >= 1 ? "text-right" : undefined}>
                                      {h}
                                    </Table.Th>
                                  ))}
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {row.changes.map((c, ci) => (
                                  <Table.Tr key={ci} className="[&_td]:last:border-b-0">
                                    <Table.Td className="font-medium text-slate-700">{c.label}</Table.Td>
                                    <Table.Td className="text-right font-mono tabular-nums text-slate-400 line-through decoration-danger/40">
                                      {c.valoreA}
                                    </Table.Td>
                                    <Table.Td className="text-right font-mono font-medium tabular-nums text-success">
                                      {c.valoreB}
                                    </Table.Td>
                                    <Table.Td className="text-right">
                                      <FieldChangeBadgeDelta change={c} />
                                    </Table.Td>
                                  </Table.Tr>
                                ))}
                              </Table.Tbody>
                            </Table>
                          </div>
                        </Table.Td>
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
        <WidgetPiede>
          {formatNumero(filteredRows.length)} referenze visibili · {formatNumero(visibleChanges)} variazioni visibili
          {filteredRows.length !== widget.rows.length ? ` (su ${formatNumero(widget.rows.length)} referenze)` : ""}
        </WidgetPiede>
      )}
    </WidgetSezione>
  );
}

// ── Scoreboard widget ─────────────────────────────────────────────────────────

// Soglie proprie dello scoreboard (80/60/40, quattro fasce): il PDF non mostra lo score,
// quindi restano distinte da tonoScore di chartTheme (70/40). Colori dai token dove esistono.
const getScoreColor = (score: number) => {
  if (score >= 80) return { bar: "bg-success", text: "text-success" };
  if (score >= 60) return { bar: "bg-amber-400", text: "text-amber-700" };
  if (score >= 40) return { bar: "bg-orange-400", text: "text-orange-700" };
  return { bar: "bg-danger", text: "text-danger" };
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
    text: "text-sky-800",
    stripe: "border-l-sky-400",
    label: "Info",
    badgeBg: "bg-sky-100",
    badgeText: "text-sky-800",
    dot: "bg-sky-500",
  },
  warn: {
    icon: "AlertTriangle" as const,
    text: "text-amber-800",
    stripe: "border-l-amber-400",
    label: "Avviso",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    dot: "bg-amber-500",
  },
  danger: {
    icon: "AlertCircle" as const,
    text: "text-orange-700",
    stripe: "border-l-orange-500",
    label: "Attenzione",
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-700",
    dot: "bg-orange-500",
  },
  critical: {
    icon: "Zap" as const,
    text: "text-red-700",
    stripe: "border-l-red-500",
    label: "Critico",
    badgeBg: "bg-red-100",
    badgeText: "text-red-700",
    dot: "bg-red-500",
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
        "flex items-start gap-2.5 rounded-control border border-l-4 border-slate-200 bg-white px-3 py-2.5",
        tone.stripe,
      )}
    >
      <Lucide icon={tone.icon} aria-hidden="true" className={clsx("mt-px h-3.5 w-3.5 shrink-0", tone.text)} />
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-700">{audit.message}</p>
      <div className="flex shrink-0 items-center gap-1.5">
        {source && (
          <span className="rounded-control bg-slate-100 px-1.5 py-0.5 font-mono text-3xs text-slate-500">
            {source}
          </span>
        )}
        <span
          className={clsx(
            "rounded-full px-2 py-0.5 text-3xs font-semibold uppercase tracking-wide",
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
            <span aria-hidden="true" className={clsx("h-1.5 w-1.5 rounded-full", AUDIT_TYPE_TONE[t].dot)} />
            <span className={clsx("text-3xs font-semibold tabular-nums", AUDIT_TYPE_TONE[t].text)}>
              {counts[t]}
              <span className="sr-only"> {AUDIT_TYPE_TONE[t].label}</span>
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
  // Solo i livelli presenti, oltre a "Tutti"
  const opzioniFiltro = filterOptions
    .filter(({ key }) => key === "all" || typeCounts[key] > 0)
    .map(({ key, label }) => ({ valore: key, etichetta: label, conteggio: typeCounts[key] }));

  return (
    <div className="border-b border-slate-200 bg-slate-50">
      <BarraFiltri
        destra={
          <span className="flex flex-wrap items-center gap-3">
            {(["critical", "danger", "warn", "info"] as AuditTypeKey[]).map((t) =>
              typeCounts[t] > 0 ? (
                <span key={t} className="flex items-center gap-1.5 text-xs">
                  <span aria-hidden="true" className={clsx("h-2 w-2 rounded-full", AUDIT_TYPE_TONE[t].dot)} />
                  <span className={clsx("font-semibold tabular-nums", AUDIT_TYPE_TONE[t].text)}>{typeCounts[t]}</span>
                  <span className="text-slate-500">{AUDIT_TYPE_TONE[t].label}</span>
                </span>
              ) : null,
            )}
          </span>
        }
      >
        <span className="title-eyebrow">Diagnostica</span>
        <Segmenti etichetta="Livello dei messaggi" valore={activeFilter} onChange={onFilterChange} opzioni={opzioniFiltro} />
      </BarraFiltri>

      {/* Reparto list */}
      <div className="max-h-80 divide-y divide-slate-100/80 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState compatta icon="CircleCheck" title="Nessun messaggio per questo filtro" description="" />
        ) : (
          filtered.map(({ reparto, audits }) => {
            const isClosed = closedReparti.has(reparto);
            const worst = AUDIT_TYPE_TONE[worstSeverity(audits)];
            return (
              <div key={reparto}>
                <button
                  type="button"
                  aria-expanded={!isClosed}
                  onClick={() => toggleReparto(reparto)}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-1/40"
                >
                  <Lucide icon={worst.icon} aria-hidden="true" className={clsx("h-3.5 w-3.5 shrink-0", worst.text)} />
                  <span className="title-eyebrow flex-1 text-slate-600">
                    {reparto}
                  </span>
                  <SeverityDots audits={audits} />
                  <Lucide
                    icon={isClosed ? "ChevronDown" : "ChevronUp"}
                    aria-hidden="true"
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

const SCORE_CHIPS = [
  { chiave: "inalterati", etichetta: "Inalterati", icona: "Minus", classi: "bg-slate-100 text-slate-700" },
  { chiave: "modificati", etichetta: "Modificati", icona: "Pencil", classi: "bg-amber-100 text-amber-800" },
  { chiave: "entranti", etichetta: "Entranti", icona: "TrendingUp", classi: "bg-teal-100 text-teal-800" },
  { chiave: "uscenti", etichetta: "Uscenti", icona: "TrendingDown", classi: "bg-red-100 text-red-700" },
] as const;

function ScoreChips({ row }: { row: Pick<TracciatoWidgetScoreboardCodiceRow, 'inalterati' | 'modificati' | 'entranti' | 'uscenti'> }) {
  return (
    <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
      {SCORE_CHIPS.map(({ chiave, etichetta, icona, classi }) =>
        row[chiave] > 0 ? (
          <span
            key={chiave}
            title={etichetta}
            className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-semibold tabular-nums", classi)}
          >
            <Lucide icon={icona} aria-hidden="true" className="h-2.5 w-2.5" />
            <span className="sr-only">{etichetta}:</span>
            {row[chiave]}
          </span>
        ) : null,
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

  const toneAudit = AUDIT_TYPE_TONE[worstAuditType];

  return (
    <WidgetSezione
      title={widget.title}
      description={widget.description}
      badge={widget.badge}
      className="overflow-hidden"
      actions={
        totalAudits > 0 && (
          <Button
            type="button"
            variant="outline-secondary"
            size="sm"
            aria-expanded={auditOpen}
            onClick={() => setAuditOpen((o) => !o)}
          >
            <Lucide icon={toneAudit.icon} aria-hidden="true" className={clsx("mr-1.5 h-3.5 w-3.5", toneAudit.text)} />
            Audit
            <span
              className={clsx(
                "ml-1.5 rounded-full px-1.5 py-0.5 text-3xs tabular-nums",
                toneAudit.badgeBg,
                toneAudit.badgeText,
              )}
            >
              {totalAudits}
            </span>
            <Lucide icon={auditOpen ? "ChevronUp" : "ChevronDown"} aria-hidden="true" className="ml-1 h-3 w-3 text-slate-400" />
          </Button>
        )
      }
    >
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

      <div className="divide-y divide-slate-100 border-t border-slate-100">
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
                  hasChildren && "cursor-pointer hover:bg-slate-50 transition-colors"
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
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Comprimi" : "Espandi"} ${row.reparto}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(row.reparto);
                        }}
                        className="flex shrink-0 rounded-control text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-1/40"
                      >
                        <Lucide
                          icon={isOpen ? "ChevronDown" : "ChevronRight"}
                          aria-hidden="true"
                          className="w-3.5 h-3.5"
                        />
                      </button>
                    )}
                    {row.reparto}
                  </span>
                  {rowAudits.length > 0 && (
                    <span title="Messaggi di audit" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-3xs font-semibold tabular-nums text-amber-800">
                      <Lucide icon="AlertTriangle" aria-hidden="true" className="h-2.5 w-2.5" />
                      <span className="sr-only">Messaggi di audit:</span>
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
                  <span className={clsx("w-10 shrink-0 text-right text-xs font-bold tabular-nums", colors.text)}>
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
                <div className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50">
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
                              <span title="Messaggi di audit" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-3xs font-semibold tabular-nums text-amber-800">
                                <Lucide icon="AlertTriangle" aria-hidden="true" className="h-2.5 w-2.5" />
                                <span className="sr-only">Messaggi di audit:</span>
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
                                "w-10 text-right text-2xs font-bold shrink-0",
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
    </WidgetSezione>
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
          hasSubCodici && "cursor-pointer hover:bg-slate-50 transition-colors"
        )}
        onClick={hasSubCodici ? handleToggle : undefined}
      >
        {/* Expand chevron — only for gruppo */}
        <span className="w-4 mt-0.5 shrink-0 flex justify-center">
          {hasSubCodici ? (
            <button
              type="button"
              aria-expanded={isGruppoOpen}
              aria-label={`${isGruppoOpen ? "Comprimi" : "Espandi"} ${row.codice}`}
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              className="flex rounded-control text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
            >
              <Lucide
                icon={isGruppoOpen ? "ChevronDown" : "ChevronRight"}
                aria-hidden="true"
                className="w-3.5 h-3.5"
              />
            </button>
          ) : (
            <span className="w-3.5" />
          )}
        </span>

        {/* Codice + descrizione stacked */}
        <span className="min-w-0 flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 flex-wrap group/copy">
            <span className="max-w-40 truncate font-mono font-semibold text-slate-700" title={row.codice}>{row.codice}</span>
            <BadgeTipo tipo={row.tipo}>{row.tipo === "gruppo" ? "Gruppo" : "Singolo"}</BadgeTipo>
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
        <div className="divide-y divide-slate-100 border-b border-slate-100 bg-slate-50">
          {row.subCodici!.map((sub, subIndex) => (
            <div key={`${sub.codice}-${subIndex}`} className="pl-12 pr-5 py-1.5 flex items-start gap-2 text-xs">
              <span aria-hidden="true" className="mt-1 h-3 w-px shrink-0 bg-slate-300" />
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
      <div className="flex items-center gap-2 border-y border-slate-200 bg-slate-50 px-5 py-2">
        <h3 className="title-card">{group.reparto}</h3>
        <span className="text-xs tabular-nums text-slate-400">({formatNumero(group.rows.length)})</span>
      </div>

      {/* Column header */}
      <div className={`px-5 py-2 ${GROUPED_TABLE_GRID_CLASS} border-b border-slate-100 bg-white text-2xs font-medium uppercase tracking-wide text-slate-500`}>
        <span className="w-4" />
        <span>Codice / Descrizione</span>
        <span>Tema</span>
        <span className="text-right">Sconto</span>
        <span className="text-right">Prezzo promo</span>
        <span className="text-right">Prezzo cont.</span>
        <span className="text-right">Prestazione</span>
      </div>

      {/* Referenze rows */}
      <div className="divide-y divide-slate-100">
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
    <WidgetSezione
      title={widget.title}
      description={widget.description}
      badge={widget.badge ?? `${formatNumero(widget.totalCount)} referenze`}
      className="overflow-hidden"
    >
      {widget.groups.length === 0 ? (
        <EmptyState compatta icon="Inbox" title="Nessuna referenza" description="" />
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
    </WidgetSezione>
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

/** Scelta a pillola, con lo stesso aspetto per il canale/area e per la promo. */
function Pillola({ attiva, onClick, children }: { attiva: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={attiva}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40",
        attiva
          ? "border-theme-1 bg-theme-1 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-theme-1/40 hover:text-theme-1",
      )}
    >
      {children}
    </button>
  );
}

function ViewSelector({
  views,
  selectedKey,
  onSelect,
}: {
  views: TracciatoReportCanaleAreaView[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const idEtichetta = useId();
  return (
    <Sezione compatta aria-labelledby={idEtichetta}>
      <div role="group" aria-labelledby={idEtichetta} className="flex flex-wrap items-center gap-2">
        <span id={idEtichetta} className="title-eyebrow mr-1">
          Canale / Area
        </span>
        {views.map((view) => {
          const key = `${view.guidCanale}::${view.guidArea}`;
          return (
            <Pillola key={key} attiva={selectedKey === key} onClick={() => onSelect(key)}>
              {view.label || `${view.nomeCanale} — ${view.nomeArea}`}
            </Pillola>
          );
        })}
      </div>
    </Sezione>
  );
}

// ── Multi-report view (per_promo | trend) ────────────────────────────────────

function MultiReportView({ queryResult }: { queryResult: TracciatoQueryResult }) {
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
    <Pagina
      titolo={isTrend ? "Trend temporale" : "Report per promo"}
      descrizione={`${formatNumero(reports.length)} promo analizzate · calcolato il ${formatDataOra(queryResult.computedAt)}`}
      indietro={{ to: "/report/tracciati", etichetta: "Nuova query" }}
    >
      {/* Selettore promo */}
      <Sezione
        compatta
        icona={isTrend ? "TrendingUp" : "LayoutGrid"}
        titolo={isTrend ? "Seleziona punto del trend" : "Seleziona promo"}
      >
        <div role="group" aria-label={isTrend ? "Punto del trend" : "Promo"} className="flex flex-wrap gap-2">
          {reports.map((r, i) => (
            <Pillola key={r.promoId} attiva={i === activeIndex} onClick={() => setActiveIndex(i)}>
              {isTrend && <span className="font-semibold tabular-nums opacity-70">{formatData(r.date)}</span>}
              <span className="max-w-44 truncate">{r.promoNome}</span>
            </Pillola>
          ))}
        </div>
      </Sezione>

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
        <div className="grid grid-cols-12 gap-6">
          {activeWidgets.map((widget) => (
            <div key={widget.id} className={resolveSpanClass(widget)}>
              <ReportWidget widget={widget} />
            </div>
          ))}
        </div>
      )}
    </Pagina>
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

  // Query fallita: si mostra il motivo con "Riprova" invece di tornare indietro senza spiegazioni
  const queryReport = isScoreboardRoute ? scoreboardQuery : confrontoQuery;
  const erroreCaricamento = !reportFromState && queryReport.isError ? queryReport.error : null;

  useEffect(() => {
    const isLoading = confrontoQuery.isLoading || scoreboardQuery.isLoading;
    if (!report && !isLoading && !isMultiReport && !erroreCaricamento) {
      navigate(fallbackPath, { replace: true });
    }
  }, [report, isMultiReport, erroreCaricamento, confrontoQuery.isLoading, scoreboardQuery.isLoading, navigate, fallbackPath]);

  const indietro = { to: fallbackPath, etichetta: idPromo ? "Torna alla promo" : "Nuovo confronto" };

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
        error?.message
          ? `Errore esportazione PDF: ${error.message}`
          : "Non è stato possibile generare il PDF. Riprova.",
        { variant: "error" }
      );
    },
  });

  if (isMultiReport) {
    return <MultiReportView queryResult={queryResult!} />;
  }

  if (!report) {
    if (erroreCaricamento) {
      return (
        <Pagina titolo={isScoreboardRoute ? "Scoreboard della promo" : "Confronto tracciati"} indietro={indietro}>
          <PageError
            titolo={isScoreboardRoute ? "Impossibile caricare lo scoreboard" : "Impossibile caricare il confronto"}
            motivo={
              erroreCaricamento instanceof Error && erroreCaricamento.message
                ? erroreCaricamento.message
                : "Il servizio non ha risposto. Riprova tra qualche istante."
            }
            onRiprova={() => queryReport.refetch()}
          />
        </Pagina>
      );
    }
    if (confrontoQuery.isLoading || scoreboardQuery.isLoading) {
      return (
        <div role="status" className="box box--stacked flex flex-col items-center gap-3 p-8 text-slate-500">
          <Spinner decorativo />
          <span className="text-sm">Caricamento confronto…</span>
        </div>
      );
    }
    return null;
  }

  const formattedDate = formatDataOra(report.generatedAt);

  const description = [
    report.subtitle,
    formattedDate !== VALORE_ASSENTE ? `Generato il ${formattedDate}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pagina
      titolo={report.title}
      descrizione={description || undefined}
      indietro={indietro}
      azioni={
        <Button
          type="button"
          onClick={() => pdfMutation.mutate()}
          disabled={pdfMutation.isPending}
          loading={pdfMutation.isPending}
          variant="primary"
        >
          {!pdfMutation.isPending && <Lucide icon="FileDown" aria-hidden="true" className="mr-2 h-4 w-4" />}
          Esporta PDF
        </Button>
      }
    >

      {report.viewsPerCanaleArea && report.viewsPerCanaleArea.length > 1 && (
        <ViewSelector
          views={report.viewsPerCanaleArea}
          selectedKey={selectedViewKey}
          onSelect={setSelectedViewKey}
        />
      )}

      <div className="grid grid-cols-12 gap-6">
        {activeWidgets.map((widget) => (
          <div key={widget.id} className={resolveSpanClass(widget)}>
            <ReportWidget widget={widget} />
          </div>
        ))}
      </div>
    </Pagina>
  );
}

export default withSessionCheck(Main);
