import { describe, expect, it } from "vitest";
import { REGOLE_PREVISIONE_STANDARD } from "../../../../../lib/insightVolantino/rendimento";
import { PALETTE_REPORT_STANDARD, type DatiReportVolantino, type SezioneReport } from "../../../../../lib/insightVolantino/report";
import { PESI_VISIBILITA } from "../../../../../lib/insightVolantino/tipi";
import type { IUserService } from "../../../interfaces/IUserService";
import { chiaveSezione, ORDINE_SEZIONI_STANDARD, TITOLI_REPORT } from "../../../utils/reportVolantino";
import { TRACCIATO_VENDITE_GENERICO } from "../../../vendite/tracciatoGenerico";
import { DefaultAgenziaLib } from "../../default/index.js";
import type { IAgenziaLib } from "../../types.js";
import { ConadcnoAgenziaLib } from "../index.js";
import { importPuntiVenditaConadCno } from "../punti-vendita.js";

// Spec insight-volantino e vendite-volantino: regole del report PDF e tracciato delle vendite di
// CONAD CNO; il default non le dichiara e valgono gli standard.

const tabella = (chiave: string, titolo: string): SezioneReport => ({ chiave, tipo: "tabella", titolo, introduzione: null, colonne: [], righe: [], nota: null });

/** Tutte le sezioni standard, nell'ordine standard, con la loro chiave come le compone il server. */
const STANDARD: SezioneReport[] = [
  { chiave: "sintesi", tipo: "sintesi", titolo: TITOLI_REPORT.sintesi, indicatori: [], frasi: [] },
  { chiave: "mappa", tipo: "pagine", titolo: "Mappa", misura: "vendite", introduzione: null, boxInEvidenza: 3 },
  { chiave: "assortimento", tipo: "grafici", titolo: TITOLI_REPORT.assortimento, introduzione: null, grafici: [] },
  { chiave: "prezziMarche", tipo: "grafici", titolo: TITOLI_REPORT.prezziMarche, introduzione: null, grafici: [] },
  tabella("rendimento", TITOLI_REPORT.rendimento),
  { chiave: "mappaPrevisione", tipo: "pagine", titolo: "Previsione", misura: "previsione", introduzione: null, boxInEvidenza: 3 },
  tabella("previsione", TITOLI_REPORT.previsione),
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

describe("ConadcnoAgenziaLib: insight e report del volantino", () => {
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

  it("pesi della visibilita' e regole della previsione sono gli standard", () => {
    expect(insightVolantino?.pesiVisibilita).toEqual(PESI_VISIBILITA);
    expect(insightVolantino?.previsione).toEqual(REGOLE_PREVISIONE_STANDARD);
  });

  it("dopo sintesi e mappa vengono il confronto con l'edizione precedente e i prodotti entrati e usciti", () => {
    const sezioni = insightVolantino!.sezioniReport!(DATI, STANDARD);

    expect(sezioni.map(chiaveSezione)).toEqual([
      "sintesi", "mappa", "confronto", "entratiUsciti", "assortimento", "prezziMarche", "rendimento", "mappaPrevisione", "previsione", "metodo",
    ]);
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

describe("ConadcnoAgenziaLib: tracciato delle vendite", () => {
  const { importVendite } = new ConadcnoAgenziaLib(userService);

  it("e' il tracciato generico col nome del cliente", () => {
    expect(importVendite?.nome).toBe("CONAD CNO - tracciato generico");
    expect(importVendite?.colonne).toEqual(TRACCIATO_VENDITE_GENERICO.colonne);
    expect(importVendite?.leggiRiga).toBe(TRACCIATO_VENDITE_GENERICO.leggiRiga);
  });

  it("riconosce il punto vendita dall'id ANACAN, la chiave dell'import dei punti vendita", () => {
    expect(importVendite?.chiaveMetaPuntoVendita).toBe("id_anacan");
    expect(importVendite?.chiaveMetaPuntoVendita).toBe(importPuntiVenditaConadCno.chiaveMeta);
  });
});

describe("DefaultAgenziaLib: insight e vendite", () => {
  it("non dichiara regole del report ne' tracciato delle vendite: valgono gli standard e il tracciato generico", () => {
    const agenzia = new DefaultAgenziaLib(userService) as IAgenziaLib;

    expect(agenzia.insightVolantino).toBeUndefined();
    expect(agenzia.importVendite).toBeUndefined();
  });
});
