// @vitest-environment jsdom
import { tintaCategoria, TINTA_NEUTRA } from "@/components/Grafici";
import { describe, expect, it, vi } from "vitest";
import type { EdizioneTimeline } from "../../../lib/puntiVendita/analisi";
import type { PeriodoRecapito } from "../../../lib/puntiVendita/storia";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import {
  colonneTimeline,
  edizioneScelta,
  edizioniDelPeriodo,
  etichettaBox,
  eventiTimeline,
  fasceInsegne,
  formatDifferenzaPunti,
  formatEuro,
  formatPercentuale,
  identificativiGdo,
  infograficheConDati,
  percorsoReferenza,
  percorsoVolantino,
  periodoValidita,
  repartiImpilati,
  righeRecapiti,
  tintaBox,
  tinteCanali,
  tinteReparti,
} from "./analisi";

// Pagine del punto vendita costruite sulla timeline: formati, percorsi, colori e dati dei grafici

const rif = (id: string, nome = id) => ({ id, nome });

const edizione = (idKit: string, dal: string, canale = rif("city", "Conad City"), dati: Partial<EdizioneTimeline> = {}): EdizioneTimeline => ({
  idKit,
  dal,
  al: null,
  promo: { id: `p-${idKit}`, nome: `Promo ${idKit}` },
  canale,
  area: rif("lig", "Liguria"),
  numeroReferenze: 100,
  attivo: false,
  ...dati,
});

describe("formati", () => {
  it("percentuali, euro e differenze in punti all'italiana; N/D senza valore", () => {
    expect(formatPercentuale(27.84)).toBe("27,8%");
    expect(formatPercentuale(30)).toBe("30%");
    expect(formatPercentuale(null)).toBe("N/D");
    expect(formatEuro(1.69)).toBe("€ 1,69");
    expect(formatDifferenzaPunti(6.94)).toBe("+6,9 punti");
    expect(formatDifferenzaPunti(-2.4)).toBe("−2,4 punti");
    expect(formatDifferenzaPunti(0.02)).toBe("stabile");
  });

  it("validità in parole, con mese e anno una volta sola quando coincidono", () => {
    expect(periodoValidita("2026-10-23", "2026-11-05")).toBe("23 ottobre – 5 novembre 2026");
    expect(periodoValidita("2026-03-03", "2026-03-16")).toBe("3 – 16 marzo 2026");
    expect(periodoValidita("2025-12-29", "2026-01-11")).toBe("29 dicembre 2025 – 11 gennaio 2026");
    expect(periodoValidita("2026-03-03", null)).toBe("dal 3 marzo 2026");
  });
});

describe("percorsi", () => {
  it("volantino alla pagina con la referenza da evidenziare, e referenza", () => {
    expect(percorsoVolantino("pv 1", "k1")).toBe("/punti-vendita/pv%201/volantini/k1");
    expect(percorsoVolantino("pv1", "k1", 3, "mozzarella-granarolo")).toBe("/punti-vendita/pv1/volantini/k1?pagina=3&referenza=mozzarella-granarolo");
    expect(percorsoReferenza("pv1", "spaghetti-n5")).toBe("/punti-vendita/pv1/referenze/spaghetti-n5");
  });
});

describe("colori delle insegne", () => {
  it("il colore segue l'insegna per nome nella rete, qualunque insegne abbia la pagina", () => {
    const rete = [rif("c3", "Conad Superstore"), rif("c1", "Conad"), rif("c2", "Conad City")];
    const soloSuperstore = tinteCanali(rete, [rif("c3", "Conad Superstore")]);
    const tutte = tinteCanali(rete, [rif("c2", "Conad City"), rif("c3", "Conad Superstore")]);

    expect(soloSuperstore("c3")).toEqual(tintaCategoria(2));
    expect(tutte("c3")).toEqual(tintaCategoria(2));
    expect(tutte("c2")).toEqual(tintaCategoria(1));
  });

  it("con più insegne dei colori distinti si colorano solo quelle della pagina", () => {
    const rete = Array.from({ length: 10 }, (_, i) => rif(`c${i}`, `Insegna ${String.fromCharCode(65 + i)}`));
    const tinta = tinteCanali(rete, [rif("c9", "Insegna J"), rif("c8", "Insegna I")]);

    expect(tinta("c8")).toEqual(tintaCategoria(0));
    expect(tinta("c9")).toEqual(tintaCategoria(1));
    expect(tinta("altro")).toBe(TINTA_NEUTRA);
  });
});

describe("timeline della scheda", () => {
  const timeline = [
    edizione("k1", "2024-03-04", rif("city", "Conad City"), { al: "2024-03-17" }),
    edizione("k2", "2024-03-18", rif("city", "Conad City"), { al: "2024-03-31" }),
    edizione("k3", "2025-04-08", rif("sup", "Conad Superstore"), { al: "2025-04-21", numeroReferenze: 148 }),
  ];

  it("una colonna per volantino, alta quanto le referenze e del gruppo del suo canale", () => {
    expect(colonneTimeline(timeline).map(c => [c.id, c.data, c.valore, c.gruppo])).toEqual([
      ["k1", "2024-03-04", 100, "city"],
      ["k2", "2024-03-18", 100, "city"],
      ["k3", "2025-04-08", 148, "sup"],
    ]);
  });

  it("la fascia delle insegne unisce i volantini consecutivi con la stessa insegna e area", () => {
    const fasce = fasceInsegne(timeline);
    expect(fasce.map(f => [f.gruppo, f.dal, f.al, f.etichetta])).toEqual([
      ["city", "2024-03-04", "2024-03-31", "Conad City · Liguria"],
      ["sup", "2025-04-08", "2025-04-21", "Conad Superstore · Liguria"],
    ]);
    expect(fasce[0].dettagli).toEqual([{ etichetta: "Volantini", valore: "2" }]);
  });

  it("il periodo filtra per anno; il volantino richiesto vale solo se è nel periodo, altrimenti il più recente", () => {
    const del2024 = edizioniDelPeriodo(timeline, 2024);
    expect(del2024.map(e => e.idKit)).toEqual(["k1", "k2"]);
    expect(edizioneScelta(del2024, "k1")?.idKit).toBe("k1");
    expect(edizioneScelta(del2024, "k3")?.idKit).toBe("k2");
    expect(edizioneScelta(timeline, null)?.idKit).toBe("k3");
    expect(edizioneScelta([], "k1")).toBeNull();
  });

  it("gli eventi diventano marcatori con forma per tipo ed etichetta breve", () => {
    const eventi = eventiTimeline([
      { tipo: "cambio_insegna", data: "2025-04-08", da: rif("city", "Conad City"), a: rif("sup", "Conad Superstore") },
      { tipo: "cambio_indirizzo", data: "2022-09-12", da: "Via Roma 3", a: "C.so Nazario Sauro 44" },
      { tipo: "assente", dal: "2026-02-01", volantiniSenza: 4 },
    ]);
    expect(eventi.map(e => [e.forma, e.data, e.etichetta])).toEqual([
      ["cerchio", "2025-04-08", "Diventa Conad Superstore"],
      ["rombo", "2022-09-12", "Nuovo indirizzo"],
      ["croce", "2026-02-01", "Non compare più"],
    ]);
  });
});

describe("indirizzo e telefono stampati", () => {
  const recapito = (dati: Partial<PeriodoRecapito>): PeriodoRecapito => ({
    localita: "Sanremo",
    indirizzo: "C.so Nazario Sauro 44",
    telefono: "0184 555 0143",
    dal: "2022-09-12",
    al: "2026-10-23",
    volantini: 150,
    diversoDallAttuale: false,
    ...dati,
  });

  it("un tratto per valore; diverso dall'anagrafica solo il campo che cambia", () => {
    const righe = righeRecapiti([
      recapito({}),
      recapito({ indirizzo: "Via Roma 3", dal: "2021-01-04", al: "2022-09-05", volantini: 60, diversoDallAttuale: true }),
    ]);

    const [indirizzo, telefono] = righe;
    expect(indirizzo.fasce.map(f => [f.etichetta, f.tono])).toEqual([
      ["Via Roma 3, Sanremo", "attenzione"],
      ["C.so Nazario Sauro 44, Sanremo", "evidenza"],
    ]);
    // Lo stesso telefono in tutti e due i periodi: un tratto solo, uguale all'anagrafica
    expect(telefono.fasce.map(f => [f.etichetta, f.tono, f.dal, f.al])).toEqual([["tel. 0184 555 0143", "evidenza", "2021-01-04", "2026-10-23"]]);
  });

  it("una riga senza nessun valore stampato non si mostra", () => {
    expect(righeRecapiti([recapito({ telefono: null })]).map(r => r.id)).toEqual(["indirizzo"]);
  });
});

describe("reparti e box", () => {
  it("reparti per anno al 100%: dal più recente, colori per nome, il resto in 'Altri reparti'", () => {
    const reparti = Array.from({ length: 9 }, (_, i) => ({ reparto: `R${i}`, quota: 20 - i }));
    const { righe, categorie, valori } = repartiImpilati([
      { anno: 2025, reparti },
      { anno: 2026, reparti: reparti.slice(0, 2) },
      { anno: 2024, reparti: [] },
    ]);

    expect(righe.map(r => r.etichetta)).toEqual(["2026", "2025"]);
    expect(categorie.map(c => c.etichetta)).toEqual(["R0", "R1", "R2", "R3", "R4", "R5", "R6", "Altri reparti"]);
    expect(categorie[7].tinta).toBe(TINTA_NEUTRA);
    // R7 (13) e R8 (12) finiscono negli altri
    expect(valori[1][7]).toBe(25);
  });

  it("il colore del box dipende dal modo: sconto in classi da 8 punti, meccanica in ordine fisso, reparto per nome", () => {
    const box = { sconto: 43, meccanica: "fidelity" as const, reparto: "Freschi" };
    const reparti = tinteReparti([{ reparto: "Freschi", spazio: 30 }, { reparto: "Bevande", spazio: 50 }]);

    expect(tintaBox(box, "sconto", reparti).classe).toContain("fill-theme-1/80");
    expect(tintaBox(box, "meccanica", reparti)).toEqual(tintaCategoria(1));
    expect(tintaBox(box, "reparto", reparti)).toEqual(tintaCategoria(1));
    expect(tintaBox({ sconto: null, meccanica: null, reparto: null }, "sconto", reparti)).toBe(TINTA_NEUTRA);
    expect(etichettaBox(box, "sconto")).toBe("−43%");
    expect(etichettaBox(box, "meccanica")).toBe("Prezzo Fidelity");
  });
});

describe("scheda: testata e infografiche", () => {
  it("nella testata solo gli identificativi GDO: l'insegna dei meta ripeterebbe il badge", () => {
    const codici = [
      { etichetta: "ID MURO", valore: "317" },
      { etichetta: "INSEGNA", valore: "Spazio Conad" },
      { etichetta: "ID ANACAN", valore: "3418" },
      { etichetta: "CODICE PV", valore: "A12" },
      { etichetta: "IDEALE", valore: "no" },
    ];

    expect(identificativiGdo(codici).map(c => c.etichetta)).toEqual(["ID MURO", "ID ANACAN", "CODICE PV"]);
    expect(identificativiGdo([])).toEqual([]);
  });

  it("dice quali infografiche hanno dati: le altre non diventano un riquadro vuoto", () => {
    const vuota = { meccaniche: [], anni: [], scontoPerAnno: [{ anno: 2026, sconto: null }], marche: [], prodottiRicorrenti: [], reparti: [{ anno: 2026, reparti: [] }] };

    expect(infograficheConDati(vuota)).toEqual({ meccaniche: false, sconto: false, marche: false, prodotti: false, reparti: false });
    expect(
      infograficheConDati({
        ...vuota,
        meccaniche: [{ meccanica: "sconto", anni: [{ anno: 2026, quota: 40 }] }],
        anni: [2026],
        scontoPerAnno: [{ anno: 2026, sconto: 27.5 }],
        marche: [{ marca: "Barilla", quota: 3 }],
      })
    ).toEqual({ meccaniche: true, sconto: true, marche: true, prodotti: false, reparti: false });
    // Le meccaniche senza anni non hanno colonne da disegnare
    expect(infograficheConDati({ ...vuota, meccaniche: [{ meccanica: "sconto", anni: [] }] }).meccaniche).toBe(false);
  });
});
