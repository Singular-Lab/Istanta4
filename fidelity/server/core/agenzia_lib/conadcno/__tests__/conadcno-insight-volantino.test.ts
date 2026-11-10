import { describe, expect, it } from "vitest";
import { PALETTE_REPORT_STANDARD, type DatiReportVolantino, type SezioneReport } from "../../../../../lib/insightVolantino/report";
import type { IUserService } from "../../../interfaces/IUserService";
import { chiaveSezione, ORDINE_SEZIONI_STANDARD, TITOLI_REPORT } from "../../../utils/reportVolantino";
import { DefaultAgenziaLib } from "../../default/index.js";
import type { IAgenziaLib } from "../../types.js";
import { ConadcnoAgenziaLib } from "../index.js";

// Spec insight-volantino: regole del report PDF di CONAD CNO; il default non le dichiara e valgono
// gli standard.

const tabella = (chiave: string, titolo: string): SezioneReport => ({ chiave, tipo: "tabella", titolo, introduzione: null, colonne: [], righe: [], nota: null });

/** Tutte le sezioni standard, nell'ordine standard, con la loro chiave come le compone il server. */
const STANDARD: SezioneReport[] = [
  { chiave: "sintesi", tipo: "sintesi", titolo: TITOLI_REPORT.sintesi, indicatori: [], frasi: [] },
  { chiave: "assortimento", tipo: "grafici", titolo: TITOLI_REPORT.assortimento, introduzione: null, grafici: [] },
  { chiave: "prezziMarche", tipo: "grafici", titolo: TITOLI_REPORT.prezziMarche, introduzione: null, grafici: [] },
  tabella("confronto", TITOLI_REPORT.confronto),
  tabella("entratiUsciti", TITOLI_REPORT.entratiUsciti),
  { chiave: "metodo", tipo: "metodo", titolo: TITOLI_REPORT.metodo, paragrafi: [] },
];

/** Le stesse con i titoli cambiati: si riconoscono dalla chiave. */
const CON_ALTRI_TITOLI: SezioneReport[] = STANDARD.map(sezione => ({ ...sezione, titolo: `Altro titolo ${sezione.chiave}` }));

/** Le stesse senza chiave: si riconoscono dal tipo e dal titolo, come prima delle chiavi. */
const SENZA_CHIAVE: SezioneReport[] = STANDARD.map((sezione) => {
  const copia = { ...sezione };
  delete copia.chiave;
  return copia;
});

const DATI = {} as DatiReportVolantino;
const userService = {} as IUserService;

describe("ConadcnoAgenziaLib: report del volantino", () => {
  const { insightVolantino } = new ConadcnoAgenziaLib(userService);

  it("palette sobria propria per primario e accento, il resto dagli standard", () => {
    expect(insightVolantino?.palette).toEqual({ primario: expect.stringMatching(/^#[0-9a-f]{6}$/i), accento: expect.stringMatching(/^#[0-9a-f]{6}$/i) });
    expect(insightVolantino?.palette?.primario).not.toBe(PALETTE_REPORT_STANDARD.primario);
    expect(insightVolantino?.palette?.accento).not.toBe(insightVolantino?.palette?.primario);
  });

  it("intestazione col nome del cliente e la riservatezza, senza logo", () => {
    expect(insightVolantino?.intestazione).toEqual({ cliente: "Conad Centro Nord", riservatezza: "Riservato - uso interno" });
    expect(insightVolantino?.intestazione).not.toHaveProperty("logo");
  });

  it("dichiara solo palette, intestazione, sezioni e linee del distributore: niente pesi della visibilita' ne' previsione", () => {
    expect(Object.keys(insightVolantino ?? {}).sort()).toEqual(["intestazione", "lineeDistributore", "palette", "sezioniReport"]);
  });

  it("dopo la sintesi vengono il confronto con l'edizione precedente e i prodotti entrati e usciti", () => {
    const sezioni = insightVolantino!.sezioniReport!(DATI, STANDARD);

    expect(sezioni.map(chiaveSezione)).toEqual(["sintesi", "confronto", "entratiUsciti", "assortimento", "prezziMarche", "metodo"]);
    // Riordina soltanto: le stesse sezioni, nessuna tolta o aggiunta
    expect(new Set(sezioni)).toEqual(new Set(STANDARD));
  });

  it("riconosce le sezioni dalla chiave anche con i titoli cambiati; senza chiave, dal titolo", () => {
    const attese = insightVolantino!.sezioniReport!(DATI, STANDARD).map(chiaveSezione);

    expect(insightVolantino!.sezioniReport!(DATI, CON_ALTRI_TITOLI).map(chiaveSezione)).toEqual(attese);
    expect(insightVolantino!.sezioniReport!(DATI, SENZA_CHIAVE).map(chiaveSezione)).toEqual(attese);
  });

  it("senza confronto (prima edizione) l'ordine e' lo standard", () => {
    const senzaConfronto = STANDARD.filter(sezione => !["confronto", "entratiUsciti"].includes(chiaveSezione(sezione) ?? ""));

    const sezioni = insightVolantino!.sezioniReport!(DATI, senzaConfronto);

    expect(sezioni).toEqual(senzaConfronto);
    expect(sezioni.map(chiaveSezione)).toEqual(ORDINE_SEZIONI_STANDARD.filter(chiave => chiave !== "confronto" && chiave !== "entratiUsciti"));
  });
});

describe("DefaultAgenziaLib: report del volantino", () => {
  it("non dichiara regole del report: valgono gli standard", () => {
    const agenzia = new DefaultAgenziaLib(userService) as IAgenziaLib;

    expect(agenzia.insightVolantino).toBeUndefined();
  });
});

describe("Libreria agenzia senza vendite", () => {
  it("nessuna libreria dichiara un tracciato delle vendite", () => {
    for (const agenzia of [new DefaultAgenziaLib(userService), new ConadcnoAgenziaLib(userService)]) {
      expect(agenzia).not.toHaveProperty("importVendite");
    }
  });
});
