import { describe, expect, it } from "vitest";
import type {
  DataFields,
  TracciatoReportWidget,
  TracciatoWidgetGroupedTable,
  TracciatoWidgetKpiGrid,
  TracciatoWidgetPriceDiff,
  TracciatoWidgetTable,
} from "../../../../../lib/types";
import { CoopfiAgenziaLib } from "../index.js";

const sut = new CoopfiAgenziaLib({} as any);

type RecordOpts = { codice: string; tema: string; reparto?: string; prezzo?: string };

const makeRecord = ({ codice, tema, reparto = "Ortofrutta", prezzo = "1,00" }: RecordOpts): DataFields => ({
  codice_referenza: codice,
  scatto_codice: codice,
  descrizione_uno: `Descrizione`,
  descrizione_due: codice,
  reparto,
  tema,
  tipo: "singolo",
  prezzo,
});

// buildWidgets è privato: nei test si accede via cast, come farebbe elaboraDatoPerAgenzia.
const buildWidgets = (primario: DataFields[], secondario: DataFields[]): TracciatoReportWidget[] =>
  (sut as any).buildWidgets(primario, secondario, "A", "B");

const findWidget = <T extends TracciatoReportWidget>(widgets: TracciatoReportWidget[], id: string): T =>
  widgets.find((w) => w.id === id) as T;

describe("coopfi filtraRecordPerPdf", () => {
  it("scarta i record con tema escluso (case-insensitive, substring)", () => {
    const records = [
      makeRecord({ codice: "001", tema: "Ortofrutta" }),
      makeRecord({ codice: "002", tema: "SPECIALE FUORI DEPLIANT FOOD" }),
      makeRecord({ codice: "003", tema: "ex tripla vini" }),
      makeRecord({ codice: "004", tema: "Fuori Depliant Casa" }),
    ];

    const filtrati = sut.filtraRecordPerPdf(records);

    expect(filtrati.map((r) => r.codice_referenza)).toEqual(["001"]);
    // L'input non viene mutato.
    expect(records).toHaveLength(4);
  });

  it("restituisce lo stesso array quando non c'è nulla da escludere", () => {
    const records = [makeRecord({ codice: "001", tema: "Ortofrutta" }), makeRecord({ codice: "002", tema: "Vini" })];

    expect(sut.filtraRecordPerPdf(records)).toBe(records);
  });

  it("tratta il tema mancante come non escluso", () => {
    const senzaTema: DataFields = { ...makeRecord({ codice: "001", tema: "" }), tema: undefined };

    expect(sut.filtraRecordPerPdf([senzaTema])).toHaveLength(1);
  });
});

describe("coopfi widget PDF calcolati sui record filtrati", () => {
  // 001 inalterato, 002 entrante, 003 uscente, 004 modificato: tutti e quattro con tema escluso,
  // più una referenza "pulita" per ciascuna categoria.
  const primario = [
    makeRecord({ codice: "001", tema: "Ortofrutta" }),
    makeRecord({ codice: "003", tema: "Ortofrutta" }),
    makeRecord({ codice: "004", tema: "Ortofrutta", prezzo: "1,00" }),
    makeRecord({ codice: "101", tema: "FUORI DEPLIANT" }),
    makeRecord({ codice: "103", tema: "FUORI DEPLIANT" }),
    makeRecord({ codice: "104", tema: "EX TRIPLA", prezzo: "1,00" }),
  ];
  const secondario = [
    makeRecord({ codice: "001", tema: "Ortofrutta" }),
    makeRecord({ codice: "002", tema: "Ortofrutta" }),
    makeRecord({ codice: "004", tema: "Ortofrutta", prezzo: "2,00" }),
    makeRecord({ codice: "101", tema: "FUORI DEPLIANT" }),
    makeRecord({ codice: "102", tema: "FUORI DEPLIANT" }),
    makeRecord({ codice: "104", tema: "EX TRIPLA", prezzo: "2,00" }),
  ];

  const widgets = buildWidgets(primario, secondario);
  const widgetsPdf = buildWidgets(sut.filtraRecordPerPdf(primario), sut.filtraRecordPerPdf(secondario));

  it("esclude le referenze dalle liste Entranti/Uscenti e dalle Variazioni", () => {
    const entranti = findWidget<TracciatoWidgetGroupedTable>(widgetsPdf, "table-referenze-entranti");
    const uscenti = findWidget<TracciatoWidgetGroupedTable>(widgetsPdf, "table-referenze-uscenti");
    const priceDiff = findWidget<TracciatoWidgetPriceDiff>(widgetsPdf, "price-diff");

    expect(entranti.groups.flatMap((g) => g.rows).map((r) => r.codice)).toEqual(["002"]);
    expect(entranti.totalCount).toBe(1);
    expect(uscenti.groups.flatMap((g) => g.rows).map((r) => r.codice)).toEqual(["003"]);
    expect(uscenti.totalCount).toBe(1);
    expect(priceDiff.rows.map((r) => r.codice)).toEqual(["004"]);
  });

  it("allinea i KPI del riepilogo alle referenze effettivamente mostrate", () => {
    const kpiCompleti = findWidget<TracciatoWidgetKpiGrid>(widgets, "kpi-reparto-summary");
    const kpiPdf = findWidget<TracciatoWidgetKpiGrid>(widgetsPdf, "kpi-reparto-summary");
    const valore = (kpi: TracciatoWidgetKpiGrid, label: string) =>
      kpi.items.find((i) => i.label === label)?.value;

    // Senza filtro i conteggi includono anche i temi esclusi…
    expect(valore(kpiCompleti, "Entranti")).toBe(2);
    expect(valore(kpiCompleti, "Uscenti")).toBe(2);
    expect(valore(kpiCompleti, "Variazioni")).toBe(2);
    expect(valore(kpiCompleti, "Inalterati")).toBe(2);

    // …nella variante PDF resta una sola referenza per categoria.
    expect(valore(kpiPdf, "Entranti")).toBe(1);
    expect(valore(kpiPdf, "Uscenti")).toBe(1);
    expect(valore(kpiPdf, "Variazioni")).toBe(1);
    expect(valore(kpiPdf, "Inalterati")).toBe(1);
    expect(kpiPdf.description).toContain("4 referenze totali");
  });

  it("allinea anche il dettaglio per reparto", () => {
    const tabella = findWidget<TracciatoWidgetTable>(widgetsPdf, "table-reparto");
    const riga = tabella.rows[0] as Record<string, unknown>;

    expect(tabella.rows).toHaveLength(1);
    expect(riga.entranti).toBe(1);
    expect(riga.uscenti).toBe(1);
    expect(riga.modificati).toBe(1);
    expect(riga.inalterati).toBe(1);
    expect(riga.inPrimario).toBe(3);
    expect(riga.inSecondario).toBe(3);
  });
});
