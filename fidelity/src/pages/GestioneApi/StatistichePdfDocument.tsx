import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ApiStatistics } from "./types";

// ── Palette corporate ─────────────────────────────────────────────────────────

const P = {
  navy:     "#0F172A",
  navySoft: "#1E293B",
  primary:  "#1E40AF",
  ink:      "#1E293B",
  inkSoft:  "#475569",
  muted:    "#94A3B8",
  line:     "#E2E8F0",
  lineSoft: "#F8FAFC",
  white:    "#FFFFFF",
  success:  "#059669",
  danger:   "#DC2626",
  warning:  "#D97706",
};

// ── Foglio stili ─────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    backgroundColor: P.white,
    paddingTop: 0,
    paddingBottom: 44,
    paddingHorizontal: 0,
    color: P.ink,
    fontFamily: "Helvetica",
    fontSize: 9,
  },

  // ── Barra + intestazione ──────────────────────────────────────────────────
  topBar: {
    height: 5,
    backgroundColor: P.primary,
  },
  pageHeader: {
    paddingHorizontal: 36,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: P.line,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: "column", alignItems: "flex-end" },
  reportLabel: {
    fontSize: 7,
    color: P.primary,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  reportTitle: {
    color: P.navy,
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    lineHeight: 1.2,
  },
  reportSubtitle: {
    color: P.inkSoft,
    fontSize: 9,
    marginTop: 5,
    lineHeight: 1.4,
  },
  headerDate: { color: P.muted, fontSize: 8 },
  headerCompany: {
    color: P.muted,
    fontSize: 8,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // ── Corpo ─────────────────────────────────────────────────────────────────
  body: { paddingHorizontal: 36 },

  // ── Sezione ───────────────────────────────────────────────────────────────
  section: { marginBottom: 20 },
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
  sectionRule: {
    height: 1,
    backgroundColor: P.line,
    marginBottom: 10,
  },

  // ── KPI ───────────────────────────────────────────────────────────────────
  kpiRow: { flexDirection: "row", marginHorizontal: -4 },
  kpiCell: { flex: 1, paddingHorizontal: 4 },
  kpiCard: {
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: P.white,
  },
  kpiBarAccent: { height: 3, borderRadius: 2, marginBottom: 8 },
  kpiLabel: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: P.muted,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  kpiValue: { fontSize: 22, fontFamily: "Helvetica-Bold", lineHeight: 1 },
  kpiUnit: { fontSize: 8, color: P.muted, marginTop: 2 },

  // ── Tabella ───────────────────────────────────────────────────────────────
  tableHead: {
    flexDirection: "row",
    backgroundColor: P.navySoft,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
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
  tableRowAlt: { backgroundColor: P.lineSoft },
  tableCell: { flex: 1, color: P.inkSoft, fontSize: 8 },
  tableCellMono: {
    flex: 1,
    color: P.inkSoft,
    fontSize: 7,
    fontFamily: "Helvetica",
  },

  // ── Badge status ──────────────────────────────────────────────────────────
  badgeSuccess: {
    color: P.success,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },
  badgeWarning: {
    color: P.warning,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },
  badgeDanger: {
    color: P.danger,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
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
  footerText: { fontSize: 7, color: P.muted },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function nowDateStr(): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date());
}

function nowDateTimeStr(): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date());
}

function statusStyle(code: number) {
  if (code >= 200 && code < 300) return S.badgeSuccess;
  if (code >= 300 && code < 400) return S.badgeWarning;
  return S.badgeDanger;
}

function truncEnd(s: string, max: number): string {
  return s.length > max ? "…" + s.slice(-(max - 1)) : s;
}

// ── Componente principale ────────────────────────────────────────────────────

interface StatistichePdfDocumentProps {
  aggregate: ApiStatistics;
  details: ApiStatistics["attivita_recente"];
}

export function StatistichePdfDocument({ aggregate, details }: StatistichePdfDocumentProps) {
  const successRate = aggregate.totale_richieste > 0
    ? ((aggregate.richieste_riuscite / aggregate.totale_richieste) * 100).toFixed(1)
    : "0.0";

  const avgMs = Math.round(aggregate.tempo_medio_risposta_ms);
  const dateStr = nowDateStr();
  const dateTimeStr = nowDateTimeStr();

  const overviewRows: [string, string][] = [
    ["Totale Richieste",          aggregate.totale_richieste.toString()],
    ["Richieste Riuscite",        aggregate.richieste_riuscite.toString()],
    ["Richieste Fallite",         aggregate.richieste_fallite.toString()],
    ["Tasso di Successo",         `${successRate}%`],
    ["Tempo Medio Risposta",      `${avgMs} ms`],
    ["Richieste Ultimo Giorno",   aggregate.statistiche_temporali.ultimo_giorno.richieste_totali.toString()],
    ["Richieste Ultima Settimana",aggregate.statistiche_temporali.ultima_settimana.richieste_totali.toString()],
    ["Richieste Ultimo Mese",     aggregate.statistiche_temporali.ultimo_mese.richieste_totali.toString()],
  ];

  const topEndpoints = (aggregate.endpoint_piu_utilizzati ?? []).slice(0, 8);
  const activityRows  = details.slice(0, 50);

  return (
    <Document title="Statistiche API" author="Istanta 2 GDO Suite" subject="Report statistiche API">
      <Page size="A4" style={S.page} wrap>

        {/* Barra primaria */}
        <View style={S.topBar} fixed />

        {/* Intestazione */}
        <View style={S.pageHeader} fixed>
          <View style={S.headerLeft}>
            <Text style={S.reportLabel}>Report Statistiche API</Text>
            <Text style={S.reportTitle}>Statistiche API</Text>
            <Text style={S.reportSubtitle}>
              Panoramica delle performance e dell'attività recente
            </Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerCompany}>Istanta 2 GDO Suite</Text>
            <Text style={S.headerDate}>{dateStr}</Text>
          </View>
        </View>

        <View style={S.body}>

          {/* ── KPI ── */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Riepilogo</Text>
            </View>
            <View style={S.sectionRule} />
            <View style={S.kpiRow}>
              {[
                { label: "Totale Richieste", value: aggregate.totale_richieste.toLocaleString("it-IT"), unit: "richieste", color: P.primary },
                { label: "Tasso Successo",   value: `${successRate}%`,                                  unit: "richieste riuscite", color: P.success },
                { label: "Tempo Medio",      value: `${avgMs}`,                                          unit: "ms per risposta", color: P.warning },
                { label: "Richieste Oggi",   value: aggregate.richieste_oggi?.toLocaleString("it-IT") ?? "—", unit: "oggi", color: P.inkSoft },
              ].map((kpi) => (
                <View key={kpi.label} style={S.kpiCell}>
                  <View style={S.kpiCard}>
                    <View style={[S.kpiBarAccent, { backgroundColor: kpi.color }]} />
                    <Text style={S.kpiLabel}>{kpi.label}</Text>
                    <Text style={[S.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
                    <Text style={S.kpiUnit}>{kpi.unit}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ── Panoramica ── */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Panoramica Metriche</Text>
            </View>
            <View style={S.sectionRule} />
            <View style={S.tableHead}>
              <Text style={[S.tableCellHead, { flex: 3 }]}>Metrica</Text>
              <Text style={[S.tableCellHead, { flex: 2 }]}>Valore</Text>
            </View>
            {overviewRows.map(([label, value], i) => (
              <View key={label} style={[S.tableRow, i % 2 !== 0 ? S.tableRowAlt : {}]}>
                <Text style={[S.tableCell, { flex: 3, color: P.ink }]}>{label}</Text>
                <Text style={[S.tableCell, { flex: 2, fontFamily: "Helvetica-Bold", color: P.navy }]}>{value}</Text>
              </View>
            ))}
          </View>

          {/* ── Top Endpoints ── */}
          {topEndpoints.length > 0 && (
            <View style={S.section}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionTitle}>Endpoint Più Utilizzati</Text>
              </View>
              <View style={S.sectionRule} />
              <View style={S.tableHead}>
                <Text style={[S.tableCellHead, { flex: 5 }]}>Endpoint</Text>
                <Text style={[S.tableCellHead, { flex: 2 }]}>Richieste</Text>
                <Text style={[S.tableCellHead, { flex: 2 }]}>Tempo Medio</Text>
              </View>
              {topEndpoints.map((ep, i) => (
                <View key={ep.endpoint} style={[S.tableRow, i % 2 !== 0 ? S.tableRowAlt : {}]}>
                  <Text style={[S.tableCellMono, { flex: 5 }]}>{truncEnd(ep.endpoint, 55)}</Text>
                  <Text style={[S.tableCell, { flex: 2 }]}>{ep.richieste.toLocaleString("it-IT")}</Text>
                  <Text style={[S.tableCell, { flex: 2 }]}>{Math.round(ep.tempo_medio_ms)} ms</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Attività Recente ── */}
          {activityRows.length > 0 && (
            <View style={S.section}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionTitle}>
                  Attività Recente{activityRows.length < details.length ? ` (ultimi ${activityRows.length} record)` : ""}
                </Text>
              </View>
              <View style={S.sectionRule} />
              <View style={S.tableHead}>
                <Text style={[S.tableCellHead, { flex: 1 }]}>Orario</Text>
                <Text style={[S.tableCellHead, { flex: 1 }]}>Data</Text>
                <Text style={[S.tableCellHead, { flex: 4 }]}>Endpoint</Text>
                <Text style={[S.tableCellHead, { flex: 1 }]}>Metodo</Text>
                <Text style={[S.tableCellHead, { flex: 1 }]}>Status</Text>
                <Text style={[S.tableCellHead, { flex: 1 }]}>Tempo</Text>
                <Text style={[S.tableCellHead, { flex: 2 }]}>Ruolo</Text>
              </View>
              {activityRows.map((row, i) => (
                <View key={i} style={[S.tableRow, i % 2 !== 0 ? S.tableRowAlt : {}]} wrap={false}>
                  <Text style={[S.tableCell, { flex: 1 }]}>{row.orario}</Text>
                  <Text style={[S.tableCell, { flex: 1 }]}>{row.data}</Text>
                  <Text style={[S.tableCellMono, { flex: 4 }]}>{truncEnd(row.endpoint, 40)}</Text>
                  <Text style={[S.tableCell, { flex: 1, fontFamily: "Helvetica-Bold", color: P.primary }]}>{row.metodo}</Text>
                  <Text style={[statusStyle(row.codice_risposta), { flex: 1 }]}>{row.codice_risposta}</Text>
                  <Text style={[S.tableCell, { flex: 1 }]}>{row.tempo_risposta_ms} ms</Text>
                  <Text style={[S.tableCell, { flex: 2, color: P.muted }]}>{row.ruolo_utente || "—"}</Text>
                </View>
              ))}
            </View>
          )}

        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Istanta 2 GDO Suite · Documento riservato</Text>
          <Text style={S.footerText}>{dateTimeStr}</Text>
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
