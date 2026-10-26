import {
  Document,
  Image,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import IstantaLogo from "@/assets/images/logo_ext.png";
import type {
  KpiCardItem,
  TracciatoReport,
  TracciatoReportWidget,
  TracciatoFieldChange,
  TracciatoWidgetCallout,
  TracciatoWidgetChart,
  TracciatoWidgetDualPieChart,
  TracciatoWidgetGroupedTable,
  TracciatoWidgetKpiGrid,
  TracciatoWidgetPriceDiff,
  TracciatoWidgetPriceDiffCellValue,
  TracciatoWidgetPriceDiffExtraColumn,
  TracciatoWidgetPriceDiffExtraFields,
  TracciatoWidgetReferenzeSplitTable,
  TracciatoWidgetTable,
} from "../../../lib/types";

// ── Palette corporate ─────────────────────────────────────────────────────────

const P = {
  navy:      "#0F172A",
  navySoft:  "#1E293B",
  primary:   "#1E40AF",
  ink:       "#1E293B",
  inkSoft:   "#475569",
  muted:     "#94A3B8",
  line:      "#E2E8F0",
  lineSoft:  "#F8FAFC",
  white:     "#FFFFFF",
  // KPI accent colors (testo, non background)
  success:   "#059669",
  danger:    "#DC2626",
  warning:   "#D97706",
  amber:     "#D97706",
  neutral:   "#475569",
};

// Callout severity → colori PDF
const CALLOUT_COLORS: Record<
  NonNullable<TracciatoWidgetCallout["severity"]>,
  { bar: string; bg: string; border: string; title: string; text: string }
> = {
  info:    { bar: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", title: "#1E40AF", text: "#1D4ED8" },
  success: { bar: "#10B981", bg: "#ECFDF5", border: "#A7F3D0", title: "#065F46", text: "#047857" },
  warning: { bar: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", title: "#92400E", text: "#B45309" },
  error:   { bar: "#EF4444", bg: "#FEF2F2", border: "#FECACA", title: "#991B1B", text: "#B91C1C" },
};

const KPI_ACCENT: Record<NonNullable<KpiCardItem["color"]>, { text: string; bar: string }> = {
  green: { text: P.success, bar: P.success },
  red:   { text: P.danger,  bar: P.danger  },
  blue:  { text: P.primary, bar: P.primary },
  amber: { text: P.amber,   bar: P.amber   },
  slate: { text: P.inkSoft, bar: P.muted   },
};

const CHART_COLORS = [
  "#1E40AF", "#059669", "#D97706", "#DC2626",
  "#7C3AED", "#0891B2", "#4F46E5", "#0F766E",
];

// ── Foglio stili ──────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    backgroundColor: P.white,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 0,
    color: P.ink,
    fontFamily: "Helvetica",
    fontSize: 9,
  },

  // ── Intestazione pagina (solo prima pagina: non è "fixed") ────────────────
  topBar: {
    height: 5,
    backgroundColor: P.primary,
    // Compensa il paddingTop della pagina così la barra resta a filo del bordo superiore
    marginTop: -24,
  },
  pageHeader: {
    paddingHorizontal: 36,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: P.line,
    marginBottom: 16,
  },
  headerMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerContent: {
    flex: 1,
    paddingRight: 14,
  },
  headerBrandPanel: {
    width: 196,
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 8,
    backgroundColor: P.lineSoft,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "column",
    alignItems: "center",
  },
  headerLogo: {
    width: 132,
    height: 30,
    marginBottom: 3,
  },
  promoName: {
    color: P.navy,
    fontFamily: "Helvetica-Bold",
    fontSize: 30,
    lineHeight: 1.1,
    marginBottom: 8,
  },
  reportLabel: {
    fontSize: 6.5,
    color: P.primary,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  reportTitle: {
    color: P.navy,
    fontFamily: "Helvetica-Bold",
    fontSize: 14.8,
    lineHeight: 1.26,
  },
  reportSubtitle: {
    color: P.inkSoft,
    fontSize: 8,
    marginTop: 4,
    lineHeight: 1.4,
  },
  headerDate: {
    color: P.muted,
    fontSize: 7,
    marginTop: 1,
  },
  // ── Corpo pagina ───────────────────────────────────────────────────────────
  body: {
    paddingHorizontal: 36,
  },

  // ── Sezione generica ───────────────────────────────────────────────────────
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  sectionTitle: {
    color: P.navy,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    flex: 1,
  },
  sectionBadge: {
    fontSize: 7,
    color: P.primary,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionDescription: {
    color: P.inkSoft,
    fontSize: 8,
    lineHeight: 1.4,
    marginBottom: 8,
  },
  sectionRule: {
    height: 1,
    backgroundColor: P.line,
    marginBottom: 10,
  },

  // ── KPI ────────────────────────────────────────────────────────────────────
  kpiRow: {
    flexDirection: "row",
    marginHorizontal: -4,
  },
  kpiCell: {
    flex: 1,
    paddingHorizontal: 4,
  },
  kpiCard: {
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: P.white,
  },
  kpiBarAccent: {
    height: 3,
    borderRadius: 2,
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: P.muted,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1,
  },
  kpiPercent: {
    fontSize: 7,
    color: P.muted,
    marginTop: 4,
  },
  kpiUnit: {
    fontSize: 8,
    color: P.muted,
    marginTop: 2,
  },

  // ── Grafici ────────────────────────────────────────────────────────────────
  chartFootnote: {
    fontSize: 7,
    color: P.muted,
    marginTop: 6,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    marginBottom: 3,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    marginRight: 4,
  },
  legendText: {
    fontSize: 7,
    color: P.inkSoft,
  },
  pieRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pieLegend: {
    marginLeft: 16,
    flex: 1,
  },
  pieLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  pieLegendText: {
    fontSize: 8,
    color: P.inkSoft,
  },

  // ── Tabella ────────────────────────────────────────────────────────────────
  tableHead: {
    flexDirection: "row",
    backgroundColor: P.navySoft,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 0,
  },
  tableCellHead: {
    flex: 1,
    color: P.white,
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: P.line,
  },
  tableRowAlt: {
    backgroundColor: P.lineSoft,
  },
  tableCell: {
    flex: 1,
    color: P.inkSoft,
    fontSize: 8,
  },
  // Separatori verticali tra colonne (l'ultima colonna ha solo il padding)
  cellPad: {
    paddingHorizontal: 3,
  },
  cellDivider: {
    paddingHorizontal: 3,
    borderRightWidth: 0.75,
    borderRightColor: P.line,
  },
  tableTotalsRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1.5,
    borderTopColor: P.line,
    backgroundColor: P.lineSoft,
    marginTop: 1,
  },
  tableTotalsCell: {
    flex: 1,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: P.navy,
  },
  tableNote: {
    color: P.muted,
    fontSize: 7,
    marginTop: 5,
    fontStyle: "italic",
  },

  // ── Callout ────────────────────────────────────────────────────────────────
  calloutWrapper: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 18,
  },
  calloutBar: {
    width: 4,
  },
  calloutBody: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  calloutTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginBottom: 4,
  },
  calloutDescription: {
    fontSize: 8,
    marginBottom: 3,
    lineHeight: 1.3,
    opacity: 0.8,
  },
  calloutMessage: {
    fontSize: 8.5,
    lineHeight: 1.5,
  },
  calloutBadge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    alignSelf: "flex-start",
    marginTop: 5,
    opacity: 0.7,
  },

  // ── Dual pie ───────────────────────────────────────────────────────────────
  dualPieOuter: {
    flexDirection: "row",
    gap: 12,
  },
  dualPiePanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 4,
    padding: 10,
    alignItems: "center",
  },
  dualPieLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: P.muted,
    marginBottom: 6,
    textAlign: "center",
  },
  dualPieMoment: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: P.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  dualPieTotal: {
    fontSize: 7,
    color: P.muted,
    marginTop: 6,
    textAlign: "center",
  },

  // ── Price diff ─────────────────────────────────────────────────────────────
  priceDiffBadgePos: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#DC2626",
  },
  priceDiffBadgeNeg: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#059669",
  },
  priceDiffBadgeNeutral: {
    fontSize: 7,
    color: P.muted,
  },
  priceDiffTipoSingolo: {
    fontSize: 7,
    color: "#1E40AF",
    fontFamily: "Helvetica-Bold",
  },
  priceDiffTipoGruppo: {
    fontSize: 7,
    color: "#6D28D9",
    fontFamily: "Helvetica-Bold",
  },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 18,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: P.line,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: P.muted,
  },
});

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    year: "numeric", month: "long", day: "numeric",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(value);
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

// Le virgole senza spazio impediscono l'a-capo (UAX #14 tratta cifra,cifra come numero unico):
// ", " rende la lista di codici wrappabile dentro la cella invece di sbordare sulle colonne vicine
function formatCodici(codice: string): string {
  return codice.replace(/,/g, ", ");
}

function resolveColor(color: string | string[] | undefined, index: number): string {
  if (Array.isArray(color)) return color[index] ?? CHART_COLORS[index % CHART_COLORS.length];
  if (typeof color === "string") return color;
  return CHART_COLORS[index % CHART_COLORS.length];
}

// Separatore verticale tra colonne: bordo destro su tutte le celle tranne l'ultima
function dividerStyle(index: number, count: number) {
  return index < count - 1 ? S.cellDivider : S.cellPad;
}

// ── Intestazione sezione ──────────────────────────────────────────────────────

function SectionHeader({ widget }: { widget: TracciatoReportWidget }) {
  return (
    <View style={S.sectionHeader}>
      <Text style={S.sectionTitle}>{widget.title}</Text>
      {widget.badge ? <Text style={S.sectionBadge}>{widget.badge}</Text> : null}
    </View>
  );
}

// ── KPI ───────────────────────────────────────────────────────────────────────

function PdfKpiGrid({ widget }: { widget: TracciatoWidgetKpiGrid }) {
  const total = widget.items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <View style={S.section} wrap={false}>
      <SectionHeader widget={widget} />
      {widget.description ? (
        <Text style={S.sectionDescription}>{widget.description}</Text>
      ) : (
        <View style={S.sectionRule} />
      )}
      <View style={S.kpiRow}>
        {widget.items.map((item, i) => {
          const tone = KPI_ACCENT[item.color ?? "slate"];
          const pct  = Math.round((item.value / total) * 100);
          return (
            <View key={i} style={S.kpiCell}>
              <View style={S.kpiCard}>
                <View style={[S.kpiBarAccent, { backgroundColor: tone.bar }]} />
                <Text style={S.kpiLabel}>{item.label}</Text>
                <Text style={[S.kpiValue, { color: tone.text }]}>
                  {formatNumber(item.value)}
                </Text>
                {item.unit ? <Text style={S.kpiUnit}>{item.unit}</Text> : null}
                <Text style={S.kpiPercent}>{pct}% del totale</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

const BAR_W = 516;
const BAR_H = 130;
const AXIS_LEFT = 32;

function PdfBarChart({ widget }: { widget: TracciatoWidgetChart }) {
  const allVals = widget.datasets.flatMap((d) => d.data).map((v) => Math.max(0, v));
  const maxVal  = Math.max(1, ...allVals);
  const avgVal  = allVals.length > 0 ? allVals.reduce((s, v) => s + v, 0) / allVals.length : 0;

  const groups     = Math.max(widget.labels.length, 1);
  const sets       = Math.max(widget.datasets.length, 1);
  const groupWidth = (BAR_W - AXIS_LEFT - 8) / groups;
  const barWidth   = Math.max(4, Math.min(20, ((groupWidth - 6) / sets) * 0.85));

  // Y-axis tick values
  const ticks = [0, 1, 2, 3, 4].map((i) => Math.round((maxVal / 4) * (4 - i)));

  return (
    <View style={S.section} wrap={false}>
      <SectionHeader widget={widget} />
      {widget.description ? (
        <Text style={S.sectionDescription}>{widget.description}</Text>
      ) : (
        <View style={S.sectionRule} />
      )}

      {/* Y-axis labels */}
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: AXIS_LEFT, height: BAR_H, justifyContent: "space-between", alignItems: "flex-end", paddingRight: 4, paddingBottom: 16 }}>
          {ticks.map((v, i) => (
            <Text key={i} style={{ fontSize: 6, color: P.muted }}>{formatNumber(v)}</Text>
          ))}
        </View>

        <Svg width={BAR_W - AXIS_LEFT} height={BAR_H}>
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((step) => {
            const y = ((BAR_H - 20) / 4) * step;
            return (
              <Path
                key={step}
                d={`M0,${y} L${BAR_W - AXIS_LEFT},${y}`}
                stroke={P.line}
                strokeWidth={0.6}
              />
            );
          })}
          {/* Baseline */}
          <Path d={`M0,${BAR_H - 20} L${BAR_W - AXIS_LEFT},${BAR_H - 20}`} stroke={P.inkSoft} strokeWidth={0.8} />

          {/* Bars */}
          {widget.datasets.flatMap((dataset, di) =>
            dataset.data.map((value, gi) => {
              const norm   = Math.max(0, value);
              const height = ((BAR_H - 20) * norm) / maxVal;
              const x      = gi * groupWidth + 2 + di * barWidth;
              const y      = BAR_H - 20 - height;
              return (
                <Rect
                  key={`b${di}-${gi}`}
                  x={x} y={y}
                  width={barWidth - 1}
                  height={Math.max(1, height)}
                  fill={resolveColor(dataset.backgroundColor, di)}
                  rx={1}
                />
              );
            })
          )}
        </Svg>
      </View>

      {/* X-axis labels */}
      <View style={{ flexDirection: "row", marginLeft: AXIS_LEFT }}>
        {widget.labels.map((label, i) => (
          <View key={i} style={{ width: groupWidth }}>
            <Text style={{ fontSize: 6.5, color: P.muted, textAlign: "center" }}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={S.legendRow}>
        {widget.datasets.map((d, i) => (
          <View key={i} style={S.legendItem}>
            <View style={[S.legendDot, { backgroundColor: resolveColor(d.backgroundColor, i) }]} />
            <Text style={S.legendText}>{d.label}</Text>
          </View>
        ))}
      </View>

      <Text style={S.chartFootnote}>
        Massimo: {formatNumber(Math.max(0, ...allVals))}  ·  Media: {formatNumber(Math.round(avgVal))}
      </Text>
    </View>
  );
}

// ── Pie chart ─────────────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCartesian(cx, cy, r, end);
  const e = polarToCartesian(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} Z`;
}

function PdfPieChart({ widget }: { widget: TracciatoWidgetChart }) {
  const dataset = widget.datasets[0];
  if (!dataset) return null;

  const rawTotal = dataset.data.reduce((s, v) => s + Math.max(0, v), 0);
  const total    = rawTotal || 1;
  let cursor = 0;
  const slices = dataset.data.map((val, i) => {
    const norm  = Math.max(0, val);
    const sweep = (norm / total) * 360;
    const slice = {
      value: norm,
      label: widget.labels[i] ?? `Voce ${i + 1}`,
      color: resolveColor(dataset.backgroundColor, i),
      path:  describeArc(58, 58, 50, cursor, cursor + sweep),
    };
    cursor += sweep;
    return slice;
  });

  return (
    <View style={S.section} wrap={false}>
      <SectionHeader widget={widget} />
      {widget.description ? (
        <Text style={S.sectionDescription}>{widget.description}</Text>
      ) : (
        <View style={S.sectionRule} />
      )}
      <View style={S.pieRow}>
        <Svg width={120} height={120}>
          {slices.map((sl, i) => (
            <Path key={i} d={sl.path} fill={sl.color} stroke={P.white} strokeWidth={1.5} />
          ))}
          {/* centro bianco per effetto donut */}
          <Path d={`M 58 58 m -22 0 a 22 22 0 1 0 44 0 a 22 22 0 1 0 -44 0`} fill={P.white} />
        </Svg>
        <View style={S.pieLegend}>
          {slices.map((sl, i) => (
            <View key={i} style={S.pieLegendItem}>
              <View style={[S.legendDot, { backgroundColor: sl.color, marginRight: 5 }]} />
              <Text style={S.pieLegendText}>
                {sl.label}: {formatNumber(sl.value)} ({Math.round((sl.value / total) * 100)}%)
              </Text>
            </View>
          ))}
          {rawTotal > 0 && (
            <Text style={[S.chartFootnote, { marginTop: 8 }]}>
              Totale: {formatNumber(rawTotal)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Tabella ───────────────────────────────────────────────────────────────────

function PdfTable({ widget }: { widget: TracciatoWidgetTable }) {
  const rows = widget.rows;

  const firstRow   = widget.rows[0];
  const numericKeys = new Set<string>(
    firstRow ? Object.keys(firstRow).filter((k) => typeof firstRow[k] === "number") : []
  );

  const totals = widget.columns.reduce<Record<string, number | null>>((acc, col) => {
    if (numericKeys.has(col.key)) {
      acc[col.key] = widget.rows.reduce(
        (s, row) => s + (typeof row[col.key] === "number" ? (row[col.key] as number) : 0),
        0
      );
    } else {
      acc[col.key] = null;
    }
    return acc;
  }, {});

  return (
    <View style={S.section}>
      <View wrap={false}>
        <SectionHeader widget={widget} />
        {widget.description ? (
          <Text style={S.sectionDescription}>{widget.description}</Text>
        ) : (
          <View style={S.sectionRule} />
        )}

        {/* Header */}
        <View style={S.tableHead}>
          {widget.columns.map((col, i) => (
            <Text
              key={i}
              style={[S.tableCellHead, dividerStyle(i, widget.columns.length), numericKeys.has(col.key) ? { textAlign: "right" as const } : {}]}
            >
              {col.label}
            </Text>
          ))}
        </View>
      </View>

      {/* Rows */}
      {rows.length === 0 ? (
        <View style={S.tableRow}>
          <Text style={S.tableCell}>Nessun dato disponibile</Text>
        </View>
      ) : (
        rows.map((row, ri) => (
          <View key={ri} style={[S.tableRow, ri % 2 === 1 ? S.tableRowAlt : {}]} wrap={false}>
            {widget.columns.map((col, ci) => (
              <Text
                key={ci}
                style={[S.tableCell, dividerStyle(ci, widget.columns.length), numericKeys.has(col.key) ? { textAlign: "right" as const } : {}]}
              >
                {safeString(row[col.key])}
              </Text>
            ))}
          </View>
        ))
      )}

      {/* Totals row */}
      {rows.length > 0 && (
        <View style={S.tableTotalsRow} wrap={false}>
          {widget.columns.map((col, ci) => {
            const colTotal = totals[col.key];
            return (
              <Text
                key={ci}
                style={[S.tableTotalsCell, dividerStyle(ci, widget.columns.length), numericKeys.has(col.key) ? { textAlign: "right" as const } : {}]}
              >
                {ci === 0 ? "Totale" : colTotal !== null ? formatNumber(colTotal) : ""}
              </Text>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Callout ───────────────────────────────────────────────────────────────────

function PdfCallout({ widget }: { widget: TracciatoWidgetCallout }) {
  const tone = CALLOUT_COLORS[widget.severity ?? "info"];
  return (
    <View style={[S.calloutWrapper, { borderColor: tone.border, backgroundColor: tone.bg }]} wrap={false}>
      <View style={[S.calloutBar, { backgroundColor: tone.bar }]} />
      <View style={S.calloutBody}>
        <Text style={[S.calloutTitle, { color: tone.title }]}>{widget.title}</Text>
        {widget.description ? (
          <Text style={[S.calloutDescription, { color: tone.text }]}>{widget.description}</Text>
        ) : null}
        <Text style={[S.calloutMessage, { color: tone.text }]}>{widget.message}</Text>
        {widget.badge ? (
          <Text style={[S.calloutBadge, { color: tone.title }]}>{widget.badge}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Referenze split table ─────────────────────────────────────────────────────

function PdfReferenzeSplitSection({
  label,
  color,
  rows,
  columns,
  numericKeys,
}: {
  label: string;
  color: string;
  rows: Record<string, string | number>[];
  columns: Array<{ key: string; label: string }>;
  numericKeys: Set<string>;
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <View wrap={false}>
        <View style={{ backgroundColor: color, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 3, marginBottom: 2 }}>
          <Text style={{ color: P.white, fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.8 }}>
            {label} ({formatNumber(rows.length)})
          </Text>
        </View>
        <View style={S.tableHead}>
          {columns.map((col, i) => (
            <Text key={i} style={[S.tableCellHead, dividerStyle(i, columns.length), numericKeys.has(col.key) ? { textAlign: "right" as const } : {}]}>
              {col.label}
            </Text>
          ))}
        </View>
      </View>
      {rows.length === 0 ? (
        <View style={S.tableRow}>
          <Text style={[S.tableCell, { color: P.muted }]}>Nessuna referenza</Text>
        </View>
      ) : (
        rows.map((row, ri) => (
          <View key={ri} style={[S.tableRow, ri % 2 === 1 ? S.tableRowAlt : {}]} wrap={false}>
            {columns.map((col, ci) => (
              <Text key={ci} style={[S.tableCell, dividerStyle(ci, columns.length), numericKeys.has(col.key) ? { textAlign: "right" as const } : {}]}>
                {safeString(row[col.key])}
              </Text>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function PdfReferenzeSplitTable({ widget }: { widget: TracciatoWidgetReferenzeSplitTable }) {
  const firstRow = widget.singoli[0] ?? widget.gruppi[0];
  const numericKeys = new Set<string>(
    firstRow ? Object.keys(firstRow).filter((k) => typeof firstRow[k] === "number") : []
  );
  return (
    <View style={S.section}>
      <SectionHeader widget={widget} />
      {widget.description ? (
        <Text style={S.sectionDescription}>{widget.description}</Text>
      ) : (
        <View style={S.sectionRule} />
      )}
      <PdfReferenzeSplitSection label="Singoli" color="#2563EB" rows={widget.singoli} columns={widget.columns} numericKeys={numericKeys} />
      <PdfReferenzeSplitSection label="Gruppi"  color="#7C3AED" rows={widget.gruppi}  columns={widget.columns} numericKeys={numericKeys} />
    </View>
  );
}

// ── Grouped table ─────────────────────────────────────────────────────────────

const GROUPED_PDF_COLS = [
  { key: "codice",         label: "Codice",       flex: 1.7, right: false },
  { key: "tipo",           label: "Tipo",         flex: 0.6, right: false },
  { key: "tema",           label: "Tema",         flex: 1.3, right: false },
  { key: "txt_sconto",     label: "Sconto",       flex: 0.7, right: true  },
  { key: "prezzo",         label: "Prezzo promo", flex: 0.9, right: true  },
  { key: "prezzo_continuo",label: "Prezzo cont.", flex: 0.9, right: true  },
  { key: "prestazione",    label: "Prestazione",  flex: 1.2, right: false },
] as const;

function PdfGroupedTable({ widget }: { widget: TracciatoWidgetGroupedTable }) {
  return (
    <View style={S.section}>
      <SectionHeader widget={widget} />
      {widget.description ? (
        <Text style={S.sectionDescription}>{widget.description}</Text>
      ) : (
        <View style={S.sectionRule} />
      )}
      {widget.groups.map((group, gi) => {
        const colCount = GROUPED_PDF_COLS.length;
        return (
          <View key={gi} style={{ marginBottom: 10 }}>
            <View wrap={false}>
              {/* Reparto header */}
              <View style={{ backgroundColor: P.navySoft, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 3, marginBottom: 2 }}>
                <Text style={{ color: P.white, fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {group.reparto} ({formatNumber(group.rows.length)})
                </Text>
              </View>
              {/* Column headers */}
              <View style={S.tableHead}>
                {GROUPED_PDF_COLS.map((col, ci) => (
                  <Text key={col.key} style={[S.tableCellHead, dividerStyle(ci, colCount), { flex: col.flex }, col.right ? { textAlign: "right" as const } : {}]}>
                    {col.label}
                  </Text>
                ))}
              </View>
            </View>
            {/* Rows */}
            {group.rows.map((row, ri) => {
              const isSingolo = row.tipo === "singolo";
              const subCount  = row.subCodici?.length ?? 0;
              return (
                <View key={ri} style={[S.tableRow, ri % 2 === 1 ? S.tableRowAlt : {}]} wrap={false}>
                  <View style={[dividerStyle(0, colCount), { flex: 1.7 }]}>
                    <Text style={{ fontSize: 8, color: P.ink, fontFamily: "Helvetica-Bold" }}>{formatCodici(row.codice)}</Text>
                    {row.descrizione ? (
                      <Text style={{ fontSize: 7, color: P.muted }}>{row.descrizione}</Text>
                    ) : null}
                    {subCount > 0 ? (
                      <Text style={{ fontSize: 6.5, color: P.primary }}>+{subCount} art.</Text>
                    ) : null}
                  </View>
                  <Text style={[isSingolo ? S.priceDiffTipoSingolo : S.priceDiffTipoGruppo, dividerStyle(1, colCount), { flex: 0.6 }]}>
                    {isSingolo ? "Singolo" : "Gruppo"}
                  </Text>
                  <Text style={[S.tableCell, dividerStyle(2, colCount), { flex: 1.3 }]}>{row.tema || "—"}</Text>
                  <Text style={[S.tableCell, dividerStyle(3, colCount), { flex: 0.7, textAlign: "right" as const, fontFamily: "Helvetica-Bold" }]}>{row.txt_sconto || "—"}</Text>
                  <Text style={[S.tableCell, dividerStyle(4, colCount), { flex: 0.9, textAlign: "right" as const, color: P.success, fontFamily: "Helvetica-Bold" }]}>{row.prezzo || "—"}</Text>
                  <Text style={[S.tableCell, dividerStyle(5, colCount), { flex: 0.9, textAlign: "right" as const, color: P.muted }]}>{row.prezzo_continuo || "—"}</Text>
                  <Text style={[S.tableCell, dividerStyle(6, colCount), { flex: 1.2 }]}>{row.prestazione || "—"}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
      {widget.totalCount > 0 && (
        <Text style={[S.tableNote, { marginTop: 4 }]}>
          Totale referenze: {formatNumber(widget.totalCount)}
        </Text>
      )}
    </View>
  );
}

// ── Dual pie chart ────────────────────────────────────────────────────────────

function PdfSingleDonut({
  data,
  labels,
  colors,
  cx,
  cy,
  r,
}: {
  data: number[];
  labels: string[];
  colors: string[];
  cx: number;
  cy: number;
  r: number;
}) {
  const total = data.reduce((s, v) => s + Math.max(0, v), 0) || 1;
  let cursor = 0;
  const slices = data.map((val, i) => {
    const norm  = Math.max(0, val);
    const sweep = (norm / total) * 360;
    // evita archi di 360° esatti che producono path invalido
    const safeSweep = sweep >= 359.99 ? 359.98 : sweep;
    const path = describeArc(cx, cy, r, cursor, cursor + safeSweep);
    cursor += sweep;
    return { value: norm, label: labels[i] ?? `Voce ${i + 1}`, color: colors[i] ?? CHART_COLORS[i % CHART_COLORS.length], path };
  });

  const innerR = Math.round(r * 0.44);

  return (
    <>
      {slices.map((sl, i) => (
        <Path key={i} d={sl.path} fill={sl.color} stroke={P.white} strokeWidth={1} />
      ))}
      {/* centro bianco per effetto donut */}
      <Path
        d={`M ${cx} ${cy} m -${innerR} 0 a ${innerR} ${innerR} 0 1 0 ${innerR * 2} 0 a ${innerR} ${innerR} 0 1 0 -${innerR * 2} 0`}
        fill={P.white}
      />
    </>
  );
}

function PdfDualPieChart({ widget }: { widget: TracciatoWidgetDualPieChart }) {
  const totalA = widget.dataA.reduce((s, v) => s + v, 0);
  const totalB = widget.dataB.reduce((s, v) => s + v, 0);
  const CX = 80, CY = 80, R = 68;
  const SIZE = CX * 2;

  // Legenda compatta condivisa (stesse label/colori per entrambe le torte)
  const legendItems = widget.labels.map((label, i) => ({
    label,
    color: widget.colors[i] ?? CHART_COLORS[i % CHART_COLORS.length],
    valA: widget.dataA[i] ?? 0,
    valB: widget.dataB[i] ?? 0,
  }));
  const sharedTotal = Math.max(totalA, totalB, 1);

  return (
    <View style={S.section} wrap={false}>
      <SectionHeader widget={widget} />
      {widget.description ? (
        <Text style={S.sectionDescription}>{widget.description}</Text>
      ) : (
        <View style={S.sectionRule} />
      )}

      <View style={S.dualPieOuter}>
        {/* Pannello Prima */}
        <View style={S.dualPiePanel}>
          <Text style={S.dualPieLabel}>Prima</Text>
          <Text style={S.dualPieMoment}>{widget.labelA}</Text>
          <Svg width={SIZE} height={SIZE}>
            <PdfSingleDonut data={widget.dataA} labels={widget.labels} colors={widget.colors} cx={CX} cy={CY} r={R} />
          </Svg>
          <Text style={S.dualPieTotal}>
            Totale: {formatNumber(totalA)} ref.
          </Text>
        </View>

        {/* Pannello Dopo */}
        <View style={S.dualPiePanel}>
          <Text style={S.dualPieLabel}>Dopo</Text>
          <Text style={S.dualPieMoment}>{widget.labelB}</Text>
          <Svg width={SIZE} height={SIZE}>
            <PdfSingleDonut data={widget.dataB} labels={widget.labels} colors={widget.colors} cx={CX} cy={CY} r={R} />
          </Svg>
          <Text style={S.dualPieTotal}>
            Totale: {formatNumber(totalB)} ref.
          </Text>
        </View>
      </View>

      {/* Legenda condivisa */}
      <View style={[S.legendRow, { marginTop: 10 }]}>
        {legendItems.map((item, i) => {
          const pctA = Math.round((item.valA / sharedTotal) * 100);
          const pctB = Math.round((item.valB / sharedTotal) * 100);
          return (
            <View key={i} style={[S.legendItem, { marginBottom: 4 }]}>
              <View style={[S.legendDot, { backgroundColor: item.color }]} />
              <Text style={S.legendText}>
                {item.label}: {formatNumber(item.valA)} ({pctA}%) → {formatNumber(item.valB)} ({pctB}%)
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Price diff ────────────────────────────────────────────────────────────────

type FlatChangeRow = {
  codice: string;
  reparto: string;
  tipo: "singolo" | "gruppo";
  descrizione?: string;
  extraFields?: TracciatoWidgetPriceDiffExtraFields;
  change: TracciatoFieldChange;
  isFirst: boolean;
};

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
  row: Pick<FlatChangeRow, "descrizione" | "extraFields">,
  key: string,
): TracciatoWidgetPriceDiffCellValue {
  if (key === "descrizione") {
    return row.extraFields?.descrizione ?? row.descrizione;
  }

  return row.extraFields?.[key];
}

function PdfPriceDiff({ widget }: { widget: TracciatoWidgetPriceDiff }) {
  // Flatten rows → one entry per (codice × campo)
  const extraColumns = getPriceDiffExtraColumns(widget);
  const flatRows: FlatChangeRow[] = [];
  for (const row of widget.rows) {
    for (let ci = 0; ci < row.changes.length; ci++) {
      flatRows.push({ codice: row.codice, reparto: row.reparto, tipo: row.tipo, descrizione: row.descrizione, extraFields: row.extraFields, change: row.changes[ci], isFirst: ci === 0 });
    }
  }
  const visibleRows = flatRows;

  const columns = [
    { key: "codice",  label: "Codice",  right: false, flex: 1.4 },
    { key: "reparto", label: "Reparto", right: false, flex: 1.0 },
    { key: "tipo",    label: "Tipo",    right: false, flex: 0.6 },
    ...extraColumns.map((column) => ({ key: column.key, label: column.label, right: false, flex: 2.0 })),
    { key: "campo",   label: "Campo",   right: false, flex: 1.2 },
    { key: "prima",   label: "Prima",   right: true,  flex: 1.2 },
    { key: "dopo",    label: "Dopo",    right: true,  flex: 1.2 },
    { key: "var",     label: "Δ%",      right: true,  flex: 0.6 },
  ];

  return (
    <View style={S.section}>
      {/* Section header + table header kept together so they never split across pages */}
      <View wrap={false}>
        <SectionHeader widget={widget} />
        {widget.description ? (
          <Text style={S.sectionDescription}>{widget.description}</Text>
        ) : (
          <View style={S.sectionRule} />
        )}
        <View style={S.tableHead}>
          {columns.map((col, i) => (
            <Text
              key={i}
              style={[S.tableCellHead, dividerStyle(i, columns.length), { flex: col.flex }, col.right ? { textAlign: "right" as const } : {}]}
            >
              {col.label}
            </Text>
          ))}
        </View>
      </View>

      {visibleRows.length === 0 ? (
        <View style={S.tableRow}>
          <Text style={S.tableCell}>Nessuna variazione rilevata</Text>
        </View>
      ) : (
        visibleRows.map((fr, ri) => {
          const isPos = fr.change.delta !== null && fr.change.delta > 0;
          const isNeg = fr.change.delta !== null && fr.change.delta < 0;
          const rowStyle = [
            S.tableRow,
            ri % 2 === 1 ? S.tableRowAlt : {},
            // Thin top border to visually separate each new codice group
            fr.isFirst && ri > 0 ? { borderTop: "1pt solid #CBD5E1" } : {},
          ];
          const colCount = columns.length;
          return (
            <View key={ri} style={rowStyle} wrap={false}>
              {/* Codice: shown only on first change of this referenza */}
              <Text style={[S.tableCell, dividerStyle(0, colCount), { flex: 1.4 }]}>
                {fr.isFirst ? formatCodici(fr.codice) : ""}
              </Text>
              <Text style={[S.tableCell, dividerStyle(1, colCount), { flex: 1.0 }]}>
                {fr.isFirst ? fr.reparto : ""}
              </Text>
              <Text style={[
                fr.isFirst
                  ? (fr.tipo === "singolo" ? S.priceDiffTipoSingolo : S.priceDiffTipoGruppo)
                  : S.tableCell,
                dividerStyle(2, colCount),
                { flex: 0.6 },
              ]}>
                {fr.isFirst ? (fr.tipo === "singolo" ? "Singolo" : "Gruppo") : ""}
              </Text>
              {extraColumns.map((column, xi) => (
                <Text key={column.key} style={[S.tableCell, dividerStyle(3 + xi, colCount), { flex: 2.0 }]}>
                  {fr.isFirst ? formatPriceDiffExtraValue(getPriceDiffExtraValue(fr, column.key)) : ""}
                </Text>
              ))}
              {/* Campo modificato */}
              <Text style={[S.tableCell, dividerStyle(3 + extraColumns.length, colCount), { flex: 1.2, color: "#92400E" }]}>
                {fr.change.label}
              </Text>
              <Text style={[S.tableCell, dividerStyle(4 + extraColumns.length, colCount), { flex: 1.2, textAlign: "right" as const, color: "#9CA3AF" }]}>
                {fr.change.valoreA}
              </Text>
              <Text style={[S.tableCell, dividerStyle(5 + extraColumns.length, colCount), { flex: 1.2, textAlign: "right" as const, color: "#059669", fontFamily: "Helvetica-Bold" }]}>
                {fr.change.valoreB}
              </Text>
              <Text
                style={[
                  isPos ? S.priceDiffBadgePos : isNeg ? S.priceDiffBadgeNeg : S.priceDiffBadgeNeutral,
                  dividerStyle(6 + extraColumns.length, colCount),
                  { flex: 0.6, textAlign: "right" as const },
                ]}
              >
                {fr.change.deltaPercent ?? "—"}
              </Text>
            </View>
          );
        })
      )}

    </View>
  );
}

// ── Widget router ─────────────────────────────────────────────────────────────

function PdfWidget({ widget }: { widget: TracciatoReportWidget }) {
  if (widget.type === "kpi_grid")             return <PdfKpiGrid widget={widget} />;
  if (widget.type === "bar_chart")            return <PdfBarChart widget={widget} />;
  if (widget.type === "pie_chart")            return <PdfPieChart widget={widget} />;
  if (widget.type === "table")                return <PdfTable widget={widget} />;
  if (widget.type === "callout")              return <PdfCallout widget={widget} />;
  if (widget.type === "referenze_split_table") return <PdfReferenzeSplitTable widget={widget} />;
  if (widget.type === "grouped_table")        return <PdfGroupedTable widget={widget} />;
  if (widget.type === "dual_pie_chart")       return <PdfDualPieChart widget={widget} />;
  if (widget.type === "price_diff")           return <PdfPriceDiff widget={widget} />;
  return null;
}

// ── Documento ─────────────────────────────────────────────────────────────────

export function TracciatoReportPdfDocument({ report, promoName }: { report: TracciatoReport; promoName?: string }) {
  return (
    <Document title={report.title} author="Istanta 2 GDO Suite" subject="Report confronto tracciati">
      <Page size="A4" style={S.page} wrap>

        {/* Barra primaria e intestazione: solo sulla prima pagina (non "fixed") */}
        <View style={S.topBar} />

        <View style={S.pageHeader}>
          {promoName ? <Text style={S.promoName}>{promoName}</Text> : null}
          <View style={S.headerMainRow}>
            <View style={S.headerContent}>
              <Text style={S.reportLabel}>Report Confronto Tracciati</Text>
              <Text style={S.reportTitle}>{report.title}</Text>
              {report.subtitle ? (
                <Text style={S.reportSubtitle}>{report.subtitle}</Text>
              ) : null}
            </View>
            <View style={S.headerBrandPanel}>
              <Image src={IstantaLogo} style={S.headerLogo} />
              <Text style={S.headerDate}>{formatDate(report.generatedAt)}</Text>
            </View>
          </View>
        </View>

        {/* Contenuto */}
        <View style={S.body}>
          {report.widgets.map((widget) => (
            <PdfWidget key={widget.id} widget={widget} />
          ))}
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Istanta 2 GDO Suite · Documento riservato</Text>
          <Text style={S.footerText}>{formatDateTime(report.generatedAt)}</Text>
          <Text
            style={S.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Pagina ${pageNumber} di ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
