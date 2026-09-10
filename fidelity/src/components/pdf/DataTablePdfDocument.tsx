import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

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
  body: { paddingHorizontal: 36 },
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
    letterSpacing: 0.4,
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

// ── Props ────────────────────────────────────────────────────────────────────

export interface DataTablePdfDocumentProps {
  title?: string;
  headers: string[];
  rows: string[][];
  landscape?: boolean;
}

// ── Componente ───────────────────────────────────────────────────────────────

export function DataTablePdfDocument({
  title = "Esportazione Dati",
  headers,
  rows,
  landscape = false,
}: DataTablePdfDocumentProps) {
  const dateStr = nowDateStr();
  const dateTimeStr = nowDateTimeStr();

  return (
    <Document title={title} author="Istanta 2 GDO Suite" subject="Export dati tabellare">
      <Page
        size="A4"
        orientation={landscape ? "landscape" : "portrait"}
        style={S.page}
        wrap
      >
        {/* Barra primaria */}
        <View style={S.topBar} fixed />

        {/* Intestazione */}
        <View style={S.pageHeader} fixed>
          <View style={S.headerLeft}>
            <Text style={S.reportLabel}>Esportazione Dati</Text>
            <Text style={S.reportTitle}>{title}</Text>
            <Text style={S.reportSubtitle}>
              {rows.length} righe · {headers.length} colonne
            </Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerCompany}>Istanta 2 GDO Suite</Text>
            <Text style={S.headerDate}>{dateStr}</Text>
          </View>
        </View>

        {/* Tabella */}
        <View style={S.body}>
          <View style={S.tableHead}>
            {headers.map((h) => (
              <Text key={h} style={S.tableCellHead}>{h}</Text>
            ))}
          </View>
          {rows.map((row, i) => (
            <View key={i} style={[S.tableRow, ...(i % 2 !== 0 ? [S.tableRowAlt] : [])]} wrap={false}>
              {row.map((cell, ci) => (
                <Text key={ci} style={S.tableCell}>{cell}</Text>
              ))}
            </View>
          ))}
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
