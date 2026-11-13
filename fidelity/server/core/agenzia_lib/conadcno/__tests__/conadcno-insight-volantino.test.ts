import { describe, expect, it } from "vitest";
import { etichettaRuolo } from "../../../../../lib/insightVolantino/ruolo";
import { PALETTE_REPORT_STANDARD, type DatiReportVolantino, type SezioneReport } from "../../../../../lib/insightVolantino/report";
import type { IUserService } from "../../../interfaces/IUserService";
import { chiaveSezione, ORDINE_SEZIONI_STANDARD, TITOLI_REPORT } from "../../../utils/reportVolantino";
import { DefaultAgenziaLib } from "../../default/index.js";
import type { IAgenziaLib } from "../../types.js";
import { ConadcnoAgenziaLib } from "../index.js";
import { nomeMastro } from "../ruoli-menabo.js";

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

  it("dichiara solo palette, intestazione, sezioni, linee del distributore, descrizione del box, ruoli, temi e menabò: niente pesi della visibilita' ne' previsione", () => {
    expect(Object.keys(insightVolantino ?? {}).sort()).toEqual(["descrizioneBox", "intestazione", "lineeDistributore", "menabo", "palette", "ruoli", "sezioniReport", "temi"]);
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

describe("ConadcnoAgenziaLib: descrizione del box nella scheda", () => {
  // Spec insight-volantino, "Scheda del volantino adattata al cliente e alla GDO"
  it("nome, marca in evidenza, formato e varianti, come sul volantino CONAD", () => {
    const { insightVolantino } = new ConadcnoAgenziaLib(userService);

    expect(insightVolantino?.descrizioneBox?.({ nome: "Gelato", marca: "Nutella", formato: "230 g", varianti: ["Classico"] })).toEqual([
      { testo: "Gelato" },
      { testo: "Nutella", evidenza: true },
      { testo: "230 g" },
      { testo: "Classico" },
    ]);
  });
});

describe("ConadcnoAgenziaLib: ruoli e menabò", () => {
  // Spec insight-volantino, "Ruolo della referenza leggibile", "Tema della referenza leggibile" e "Menabò del volantino"
  const { insightVolantino } = new ConadcnoAgenziaLib(userService);

  it("le etichette dei ruoli dei volantini CONAD, con le sigle in maiuscolo", () => {
    const etichetta = (valore: string) => etichettaRuolo(valore, insightVolantino?.ruoli);

    expect(["base", "BASE", "star", "VEDETTE", "prima pagina", "co-marketing/artwork", "RICHIAMO B&F", "richiamo cvs"].map(etichetta)).toEqual([
      "Base",
      "Base",
      "Star",
      "Vedette",
      "Prima pagina",
      "Co-marketing / artwork",
      "Richiamo B&F",
      "Richiamo CVS",
    ]);
    expect(etichetta("PROMO TOP")).toBe("Promo top");
  });

  it("le etichette dei temi CONAD, comunque siano scritti; un tema non dichiarato con l'iniziale maiuscola", () => {
    const etichetta = (valore: string) => etichettaRuolo(valore, insightVolantino?.temi);

    expect(["tantealtreoff", "TANTEALTREOFF", "mnumeri1", "TTMINICOLL", "fpulizia casa", "RICHIAMOBF", "MDD S&D"].map(etichetta)).toEqual([
      "Tante altre offerte",
      "Tante altre offerte",
      "I numeri 1",
      "Minicollection",
      "Focus pulizia casa",
      "Richiamo B&F",
      "MDD Sapori & Dintorni",
    ]);
    expect(etichetta("FMONDORCHIDEE")).toBe("Fmondorchidee");
  });

  it("il menabò legge la mastro e la scrive senza sigla e senza le indicazioni di impaginazione, spazi al posto dei trattini bassi, maiuscole sensate", () => {
    const menabo = insightVolantino?.menabo;
    expect(menabo?.campo).toBe("mastro");
    const nome = (valore: string) => menabo?.nome?.(valore);

    expect(nome("N1-NUMERI1")).toBe("Numeri 1");
    expect(nome("Og-OFFERTE generiche")).toBe("Offerte generiche");
    expect(nome("OF-ORTOFRUTTA")).toBe("Ortofrutta");
    expect(nome("FC-FRESCHI di CONVENIENZA")).toBe("Freschi di convenienza");
    expect(nome("X-2025_SUPERMARCHE_FINO50_doppia")).toBe("Supermarche fino 50");
    expect(nome("SCSS-griglia SCSS 25 minicoll doppia")).toBe("Griglia SCSS 25 minicoll");
    expect(nome("COP-Copertina base")).toBe("Copertina base");
    expect(nome("COP-Copertina BASE")).toBe("Copertina base");
    expect(nome("GAdx-GASTRONOMIA dx")).toBe("Gastronomia");
    expect(nome("OFdx-ORTOFRUTTA DX")).toBe("Ortofrutta");
    expect(nome("DIS-DISPENSA_singola")).toBe("Dispensa");
    expect(nome("f-RILANCIO_doppia_2026")).toBe("Rilancio");
    expect(nome("BEL-BELLEZZAeIGIENE_doppia")).toBe("Bellezza e igiene");
    expect(nome("RICHIAMO B&F CVS")).toBe("Richiamo B&F CVS");
  });

  it("la mastro della pagina bianca non e' una sezione", () => {
    expect(nomeMastro("PB-Pagina bianca")).toBeNull();
    expect(nomeMastro("PB-PAGINA_BIANCA")).toBeNull();
  });

  it("una mastro senza sigla resta com'è, con l'iniziale maiuscola; una fatta solo di sigla resta intera", () => {
    expect(nomeMastro("Copertina")).toBe("Copertina");
    expect(nomeMastro("RETRO")).toBe("Retro");
    expect(nomeMastro("A-")).toBe("A-");
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
