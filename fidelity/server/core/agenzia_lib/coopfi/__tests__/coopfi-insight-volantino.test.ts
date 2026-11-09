import { describe, expect, it } from "vitest";
import { REGOLE_PREVISIONE_STANDARD } from "../../../../../lib/insightVolantino/rendimento";
import { PALETTE_REPORT_STANDARD, type DatiReportVolantino, type SezioneReport } from "../../../../../lib/insightVolantino/report";
import { PESI_VISIBILITA } from "../../../../../lib/insightVolantino/tipi";
import type { IUserService } from "../../../interfaces/IUserService";
import { chiaveSezione, ORDINE_SEZIONI_STANDARD, TITOLI_REPORT } from "../../../utils/reportVolantino";
import { TRACCIATO_VENDITE_GENERICO } from "../../../vendite/tracciatoGenerico";
import { ConadcnoAgenziaLib } from "../../conadcno/index.js";
import type { IAgenziaLib } from "../../types.js";
import { CoopfiAgenziaLib } from "../index.js";

// Spec insight-volantino e vendite-volantino: regole del report PDF e tracciato delle vendite di
// Coop Firenze.

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

describe("CoopfiAgenziaLib: insight e report del volantino", () => {
  const { insightVolantino } = new CoopfiAgenziaLib(userService);

  it("palette sobria propria per primario e accento, diversa da quella di CONAD CNO; il resto dagli standard", () => {
    const conad = new ConadcnoAgenziaLib(userService).insightVolantino;

    expect(insightVolantino?.palette).toEqual({ primario: expect.stringMatching(/^#[0-9a-f]{6}$/i), accento: expect.stringMatching(/^#[0-9a-f]{6}$/i) });
    expect(insightVolantino?.palette?.primario).not.toBe(PALETTE_REPORT_STANDARD.primario);
    expect(insightVolantino?.palette).not.toEqual(conad?.palette);
  });

  it("intestazione col nome del cliente e la riservatezza, senza logo", () => {
    expect(insightVolantino?.intestazione).toEqual({ cliente: "Coop Firenze", riservatezza: "Riservato - uso interno" });
    expect(insightVolantino?.intestazione).not.toHaveProperty("logo");
  });

  it("pesi della visibilita' e regole della previsione sono gli standard", () => {
    expect(insightVolantino?.pesiVisibilita).toEqual(PESI_VISIBILITA);
    expect(insightVolantino?.previsione).toEqual(REGOLE_PREVISIONE_STANDARD);
  });

  it("il rendimento dalle vendite viene subito dopo sintesi e mappa, prima dei grafici", () => {
    const sezioni = insightVolantino!.sezioniReport!(DATI, STANDARD);

    expect(sezioni.map(chiaveSezione)).toEqual([
      "sintesi", "mappa", "rendimento", "assortimento", "prezziMarche", "mappaPrevisione", "previsione", "confronto", "entratiUsciti", "metodo",
    ]);
    expect(new Set(sezioni)).toEqual(new Set(STANDARD));
  });

  it("riconosce le sezioni dalla chiave anche con i titoli cambiati; senza chiave, dal titolo", () => {
    const attese = insightVolantino!.sezioniReport!(DATI, STANDARD).map(chiaveSezione);

    expect(insightVolantino!.sezioniReport!(DATI, CON_ALTRI_TITOLI).map(chiaveSezione)).toEqual(attese);
    expect(insightVolantino!.sezioniReport!(DATI, SENZA_CHIAVE).map(chiaveSezione)).toEqual(attese);
  });

  it("senza vendite importate (nessun rendimento) l'ordine e' lo standard", () => {
    const senzaRendimento = STANDARD.filter(sezione => chiaveSezione(sezione) !== "rendimento");

    const sezioni = insightVolantino!.sezioniReport!(DATI, senzaRendimento);

    expect(sezioni).toEqual(senzaRendimento);
    expect(sezioni.map(chiaveSezione)).toEqual(ORDINE_SEZIONI_STANDARD.filter(chiave => chiave !== "rendimento"));
  });
});

describe("CoopfiAgenziaLib: tracciato delle vendite", () => {
  const agenzia = new CoopfiAgenziaLib(userService);

  it("e' il tracciato generico col nome del cliente", () => {
    expect(agenzia.importVendite.nome).toBe("Coop Firenze - tracciato generico");
    expect(agenzia.importVendite.colonne).toEqual(TRACCIATO_VENDITE_GENERICO.colonne);
    expect(agenzia.importVendite.leggiRiga).toBe(TRACCIATO_VENDITE_GENERICO.leggiRiga);
  });

  it("senza un import dei punti vendita proprio non dichiara una chiave: il punto vendita si riconosce dal nome", () => {
    expect((agenzia as IAgenziaLib).importPuntiVendita).toBeUndefined();
    expect(agenzia.importVendite.chiaveMetaPuntoVendita).toBeUndefined();
  });
});
