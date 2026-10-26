import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrdinamentoMerceologico } from "../../../../../lib/ordinamentoMerceologico";
import type { DataFields, RisultatoConfrontoMomento, TracciatoReportWidget, TracciatoWidgetGroupedTable } from "../../../../../lib/types";
import { Config } from "../../../models";
import { CoopfiAgenziaLib } from "../index.js";

const sut = new CoopfiAgenziaLib({} as any);

const ordinamento: OrdinamentoMerceologico = {
  universale: true,
  campi: { area: "settore", settore: "reparto", reparto: "categoria", categoria: "" },
  voci: [
    { area: "freschissimi", settore: "ortofrutta", reparto: "mele", categoria: "", orderIndex: 1 },
    { area: "freschissimi", settore: "macelleria", reparto: "bovino", categoria: "", orderIndex: 10 },
    { area: "casa", settore: "detersivi", reparto: "piatti", categoria: "", orderIndex: 50 },
  ],
};

// Record grezzo di Istanta, come arriva da analisiConfronto
const grezzo = (codice: string, settore: string, reparto: string, categoria: string): DataFields => ({
  "Referenza.Codice": codice,
  "Scatto.CodiceGruppo": codice,
  settore,
  reparto,
  categoria,
  tema: "SPRINT",
});

const entranti = (widgets: TracciatoReportWidget[]) =>
  widgets.find((w) => w.id === "table-referenze-entranti") as TracciatoWidgetGroupedTable;

const confronto = (secondario: DataFields[], ordinamentoMerceologico?: OrdinamentoMerceologico): RisultatoConfrontoMomento => ({
  primario: { guidId: "m1", nomeMomento: "A", tracciati: [{ guidCanale: "c", guidArea: "a", context: "[]", records: [] }] },
  secondario: { guidId: "m2", nomeMomento: "B", tracciati: [{ guidCanale: "c", guidArea: "a", context: "[]", records: secondario }] },
  ordinamentoMerceologico,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("coopfi report di confronto: ordine merceologico", () => {
  const secondario = [
    grezzo("D", "casa", "detersivi", "piatti"),
    grezzo("B", "freschissimi", "macelleria", "bovino"),
    grezzo("A", "freschissimi", "ortofrutta", "mele"),
  ];

  it("le referenze entranti seguono l'ordine merceologico, reparti compresi", async () => {
    vi.spyOn(Config, "findOne").mockResolvedValue(null);

    const report = await sut.elaboraDatoPerAgenzia(confronto(secondario, ordinamento));

    const tabella = entranti(report.viewsPerCanaleArea![0].widgets);
    expect(tabella.groups.flatMap((g) => g.rows.map((r) => r.codice))).toEqual(["A", "B", "D"]);
    expect(tabella.groups.map((g) => g.reparto)).toEqual(["ortofrutta", "macelleria", "detersivi"]);
  });

  it("senza ordinamento i reparti restano in ordine alfabetico", async () => {
    vi.spyOn(Config, "findOne").mockResolvedValue(null);

    const report = await sut.elaboraDatoPerAgenzia(confronto(secondario));

    const tabella = entranti(report.viewsPerCanaleArea![0].widgets);
    expect(tabella.groups.map((g) => g.reparto)).toEqual(["detersivi", "macelleria", "ortofrutta"]);
  });
});
