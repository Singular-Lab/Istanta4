import React from "react";
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
  pageLandscape: {
    backgroundColor: P.white,
    paddingTop: 0,
    paddingBottom: 44,
    paddingHorizontal: 0,
    color: P.ink,
    fontFamily: "Helvetica",
    fontSize: 8,
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
  tableCell: {
    flex: 1,
    color: P.inkSoft,
    fontSize: 8,
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

// ── Props ────────────────────────────────────────────────────────────────────

export interface DataTablePdfDocumentProps {
  title?: string;
  headers: string[];
  rows: string[][];
  landscape?: boolean;
}

// ── Componente ───────────────────────────────────────────────────────────────

export function DataTablePdfDocument({ title = "Esportazione Dati", headers, rows, landscape = false }: DataTablePdfDocumentProps) {
  const dateStr = nowDateStr();
  const dateTimeStr = nowDateTimeStr();
  const pageStyle = landscape ? S.pageLandscape : S.page;

  return React.createElement(
    Document,
    { title, author: "Istanta 2 GDO Suite", subject: "Export dati tabellare" },
    React.createElement(
      Page,
      { size: "A4", orientation: landscape ? "landscape" : "portrait", style: pageStyle, wrap: true },

      // Barra primaria
      React.createElement(View, { style: S.topBar, fixed: true }),

      // Intestazione
      React.createElement(
        View,
        { style: S.pageHeader, fixed: true },
        React.createElement(
          View,
          { style: S.headerLeft },
          React.createElement(Text, { style: S.reportLabel }, "Esportazione Dati"),
          React.createElement(Text, { style: S.reportTitle }, title),
          React.createElement(
            Text,
            { style: S.reportSubtitle },
            `${rows.length} righe · ${headers.length} colonne`
          )
        ),
        React.createElement(
          View,
          { style: S.headerRight },
          React.createElement(Text, { style: S.headerCompany }, "Istanta 2 GDO Suite"),
          React.createElement(Text, { style: S.headerDate }, dateStr)
        )
      ),

      // Tabella
      React.createElement(
        View,
        { style: S.body },
        // Header colonne
        React.createElement(
          View,
          { style: S.tableHead },
          ...headers.map((h) =>
            React.createElement(Text, { key: h, style: S.tableCellHead }, h)
          )
        ),
        // Righe dati
        ...rows.map((row, i) =>
          React.createElement(
            View,
            { key: i, style: [S.tableRow, ...(i % 2 !== 0 ? [S.tableRowAlt] : [])], wrap: false },
            ...row.map((cell, ci) =>
              React.createElement(Text, { key: ci, style: S.tableCell }, cell)
            )
          )
        )
      ),

      // Footer
      React.createElement(
        View,
        { style: S.footer, fixed: true },
        React.createElement(Text, { style: S.footerText }, "Istanta 2 GDO Suite · Documento riservato"),
        React.createElement(Text, { style: S.footerText }, dateTimeStr),
        React.createElement(
          Text,
          {
            style: S.footerText,
            render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Pagina ${pageNumber} di ${totalPages}`,
          }
        )
      )
    )
  );
}
