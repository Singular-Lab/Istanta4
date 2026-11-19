// @vitest-environment jsdom
import { tintaCategoria, TINTA_NEUTRA } from "@/components/Grafici";
import { describe, expect, it, vi } from "vitest";
import type { EdizioneTimeline } from "../../../lib/puntiVendita/analisi";
import type { PeriodoRecapito } from "../../../lib/puntiVendita/storia";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import {
  assenzeTimeline,
  barreTimeline,
  contestoPeriodo,
  edizioneScelta,
  edizioniDelPeriodo,
  etichettaBox,
  eventiTimeline,
  fasceInsegne,
  fineEdizione,
  formatDifferenza,
  formatDifferenzaPunti,
  formatEuro,
  formatPercentuale,
  giorniCoperti,
  identificativiGdo,
  infograficheConDati,
  intervalloPeriodo,
  notaDifferenza,
  percorsoReferenza,
  periodoAnalisi,
  periodoDaParametro,
  periodoPrecedente,
  periodoValidita,
  repartiInBarre,
  righeRecapiti,
  sintesiPeriodo,
  tintaBox,
  tintaMeccanica,
  tinteCanali,
  tinteReparti,
  tracceStoria,
  ULTIMI_12_MESI,
  ULTIMI_3_MESI,
  chiaveConfrontoIndirizzo,
  chiaveConfrontoTelefono,
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
  pagine: 16,
  scontoMedio: null,
  referenzeConSconto: 0,
  meccaniche: [],
  reparti: [],
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
  it("codifica la referenza nella scheda del punto vendita", () => {
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

  it("una barra per volantino, dal primo all'ultimo giorno, del gruppo del suo canale; le referenze stanno nelle corsie", () => {
    const barre = barreTimeline(timeline);
    expect(barre.map(b => [b.id, b.dal, b.al, b.gruppo])).toEqual([
      ["k1", "2024-03-04", "2024-03-17", "city"],
      ["k2", "2024-03-18", "2024-03-31", "city"],
      ["k3", "2025-04-08", "2025-04-21", "sup"],
    ]);
    expect(barre[2].sottotitolo).toBe("8 – 21 aprile 2025");
    expect(barre[2].dettagli).toEqual([{ etichetta: "Area", valore: "Liguria" }]);
  });

  it("senza la fine la barra è il primo giorno solo", () => {
    const [barra] = barreTimeline([edizione("k9", "2026-03-03")]);
    expect([barra.dal, barra.al, barra.sottotitolo]).toEqual(["2026-03-03", null, "dal 3 marzo 2026"]);
    expect(fineEdizione(edizione("k9", "2026-03-03"))).toBe("2026-03-03");
    expect(fineEdizione(edizione("k9", "2026-03-03", undefined, { al: "2026-03-16" }))).toBe("2026-03-16");
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
    const del2024 = edizioniDelPeriodo(timeline, periodoAnalisi(2024));
    expect(del2024.map(e => e.idKit)).toEqual(["k1", "k2"]);
    expect(edizioneScelta(del2024, "k1")?.idKit).toBe("k1");
    expect(edizioneScelta(del2024, "k3")?.idKit).toBe("k2");
    expect(edizioneScelta(timeline, null)?.idKit).toBe("k3");
    expect(edizioneScelta([], "k1")).toBeNull();
  });

  it("il periodo dall'indirizzo: un anno dei dati, gli ultimi 12 o 3 mesi, altrimenti tutto", () => {
    expect(periodoDaParametro("2024", [2024, 2025])).toBe(2024);
    expect(periodoDaParametro("2019", [2024, 2025])).toBeNull();
    expect(periodoDaParametro(ULTIMI_3_MESI, [2024, 2025])).toBe(ULTIMI_3_MESI);
    expect(periodoDaParametro(ULTIMI_12_MESI, [2024, 2025])).toBe(ULTIMI_12_MESI);
    expect(periodoDaParametro(null, [2024, 2025])).toBeNull();
    expect(periodoDaParametro("tutti", [2024, 2025])).toBeNull();
  });

  it("gli ultimi 3 mesi: i volantini iniziati da tre mesi fa in poi, attivi e in arrivo compresi", () => {
    const recenti = [
      edizione("vecchia", "2026-07-20", undefined, { al: "2026-08-02" }),
      // Iniziato prima dei 3 mesi: ogni volantino sta nel periodo in cui inizia, come sul server
      edizione("a-cavallo", "2026-08-03", undefined, { al: "2026-08-16" }),
      edizione("primo-giorno", "2026-08-10", undefined, { al: "2026-08-23" }),
      edizione("attiva", "2026-11-02", undefined, { al: "2026-11-15", attivo: true }),
      edizione("in-arrivo", "2026-11-23", undefined, { al: "2026-12-06" }),
    ];
    const oggi = "2026-11-10";

    expect(periodoAnalisi(ULTIMI_3_MESI, oggi)).toEqual({ dal: "2026-08-10", al: null });
    const edizioni = edizioniDelPeriodo(recenti, periodoAnalisi(ULTIMI_3_MESI, oggi));
    expect(edizioni.map(e => e.idKit)).toEqual(["primo-giorno", "attiva", "in-arrivo"]);
    // L'asse va da tre mesi fa fino all'ultimo volantino, almeno una settimana dopo oggi
    expect(intervalloPeriodo(ULTIMI_3_MESI, edizioni, oggi)).toEqual({ dal: "2026-08-10", al: "2026-12-06" });
    expect(intervalloPeriodo(ULTIMI_3_MESI, [], oggi)).toEqual({ dal: "2026-08-10", al: "2026-11-17" });
  });

  it("l'asse di un anno è l'anno intero; per tutto lo decide la timeline; 12 mesi da un anno fa", () => {
    expect(intervalloPeriodo(2025, timeline)).toEqual({ dal: "2025-01-01", al: "2025-12-31" });
    expect(intervalloPeriodo(null, timeline)).toBeUndefined();
    expect(intervalloPeriodo(ULTIMI_12_MESI, [], "2026-11-10")).toEqual({ dal: "2025-11-10", al: "2026-11-17" });
  });

  it("un volantino a cavallo dell'anno sta solo nell'anno in cui inizia", () => {
    const capodanno = [edizione("k-dic", "2024-12-28", undefined, { al: "2025-01-10" })];
    expect(edizioniDelPeriodo(capodanno, periodoAnalisi(2024)).map(e => e.idKit)).toEqual(["k-dic"]);
    expect(edizioniDelPeriodo(capodanno, periodoAnalisi(2025))).toEqual([]);
    expect(edizioniDelPeriodo(capodanno, null)).toHaveLength(1);
  });

  it("il periodo prima, della stessa durata, e i nomi nelle frasi; tutta la storia non ha confronto", () => {
    const oggi = "2026-11-10";
    expect(periodoPrecedente(2025, oggi)).toEqual({ dal: "2024-01-01", al: "2024-12-31" });
    expect(periodoPrecedente(ULTIMI_12_MESI, oggi)).toEqual({ dal: "2024-11-10", al: "2025-11-09" });
    expect(periodoPrecedente(ULTIMI_3_MESI, oggi)).toEqual({ dal: "2026-05-10", al: "2026-08-09" });
    expect(periodoPrecedente(null, oggi)).toBeNull();

    expect(contestoPeriodo(2025, "2021-01-07", oggi)).toMatchObject({ nome: "nel 2025", confronto: { nel: "nel 2024", rispetto: "rispetto al 2024" } });
    expect(contestoPeriodo(null, "2026-04-02", oggi)).toMatchObject({ nome: "dall'aprile 2026", confronto: null, precedente: null, giorni: null });
    expect(contestoPeriodo(null, "2021-03-04", oggi).nome).toBe("dal marzo 2021");
    expect(contestoPeriodo(ULTIMI_3_MESI, "2021-03-04", oggi)).toMatchObject({ nome: "negli ultimi 3 mesi", confronto: { rispetto: "rispetto ai 3 mesi prima" } });
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

  it("due scritture dello stesso recapito sono un tratto solo, uguale all'anagrafica", () => {
    // BARGA: "VIA CANIPAIA" e "Via Canipaia snc", "0583711452" e "0583 711452"
    const righe = righeRecapiti([
      recapito({ localita: "BARGA", indirizzo: "VIA CANIPAIA", telefono: "0583711452", dal: "2025-12-29", al: "2026-01-11", volantini: 1 }),
      recapito({ localita: "BARGA", indirizzo: "Via Canipaia snc", telefono: "0583 711452", dal: "2026-09-24", al: "2026-10-07", volantini: 1, diversoDallAttuale: true }),
    ]);

    const [indirizzo, telefono] = righe;
    expect(indirizzo.fasce.map(f => [f.etichetta, f.tono, f.dal, f.al])).toEqual([["VIA CANIPAIA, BARGA", "evidenza", "2025-12-29", "2026-10-07"]]);
    expect(telefono.fasce.map(f => [f.etichetta, f.tono])).toEqual([["tel. 0583711452", "evidenza"]]);
  });

  it("chiavi di confronto dei recapiti", () => {
    expect(chiaveConfrontoIndirizzo("Via Canipaia snc")).toBe(chiaveConfrontoIndirizzo("VIA CANIPAIA"));
    expect(chiaveConfrontoIndirizzo("Via Roma 3")).not.toBe(chiaveConfrontoIndirizzo("Via Roma 30"));
    expect(chiaveConfrontoTelefono("+39 0583 711452")).toBe(chiaveConfrontoTelefono("0583711452"));
    expect(chiaveConfrontoTelefono(null)).toBeNull();
  });
});

describe("il periodo in sintesi", () => {
  const conNumeri = [
    edizione("k1", "2025-01-09", undefined, {
      al: "2025-01-22",
      numeroReferenze: 100,
      scontoMedio: 20,
      referenzeConSconto: 30,
      meccaniche: [{ meccanica: "sconto", referenze: 60 }, { meccanica: "fidelity", referenze: 20 }],
      reparti: [{ reparto: "Drogheria", spazio: 300 }, { reparto: "Freschi", spazio: 100 }],
    }),
    edizione("k2", "2025-01-23", undefined, {
      al: "2025-02-05",
      numeroReferenze: 140,
      scontoMedio: 30,
      referenzeConSconto: 10,
      meccaniche: [{ meccanica: "fidelity", referenze: 20 }],
      reparti: [{ reparto: "Freschi", spazio: 100 }],
    }),
  ];

  it("referenze per volantino, sconto pesato sulle referenze col barrato, quote di meccaniche e reparti", () => {
    const sintesi = sintesiPeriodo(conNumeri);
    expect(sintesi.volantini).toBe(2);
    expect(sintesi.mediaReferenze).toBe(120);
    // (20 × 30 + 30 × 10) / 40
    expect(sintesi.scontoMedio).toBe(22.5);
    expect(sintesi.meccaniche.get("sconto")).toBe(60);
    expect(sintesi.meccaniche.get("fidelity")).toBe(40);
    expect(sintesi.reparti).toEqual([
      { reparto: "Drogheria", quota: 60 },
      { reparto: "Freschi", quota: 40 },
    ]);
  });

  it("quote con un decimale e sconto con due, come sul server: 1100 su 2000 è 55, non 55,00000000000001", () => {
    const sintesi = sintesiPeriodo([
      edizione("a", "2025-01-09", undefined, { reparti: [{ reparto: "Freschi", spazio: 1100 }, { reparto: "Drogheria", spazio: 900 }] }),
      edizione("b", "2025-01-23", undefined, { scontoMedio: 20, referenzeConSconto: 1, meccaniche: [{ meccanica: "sconto", referenze: 1 }, { meccanica: "punti", referenze: 2 }] }),
      edizione("c", "2025-02-06", undefined, { scontoMedio: 21, referenzeConSconto: 2 }),
    ]);
    expect(sintesi.reparti[0].quota).toBe(55);
    expect(formatPercentuale(sintesi.reparti[0].quota)).toBe("55%");
    expect(sintesi.meccaniche.get("sconto")).toBe(33.3);
    expect(sintesi.meccaniche.get("punti")).toBe(66.7);
    // (20 + 21 × 2) / 3 = 20,666…
    expect(sintesi.scontoMedio).toBe(20.67);
  });

  it("senza volantini, senza barrati o senza reparti i valori mancano, non sono zero", () => {
    expect(sintesiPeriodo([])).toMatchObject({ volantini: 0, mediaReferenze: null, scontoMedio: null, reparti: [] });
    expect(sintesiPeriodo([edizione("k9", "2025-03-03")]).scontoMedio).toBeNull();
  });

  it("giorni con un volantino valido: dal primo volantino a oggi, i volantini sovrapposti contano una volta", () => {
    const volantini = [
      edizione("a", "2026-10-01", undefined, { al: "2026-10-10" }),
      edizione("b", "2026-10-05", undefined, { al: "2026-10-12" }),
      edizione("c", "2026-10-16", undefined, { al: "2026-10-31" }),
    ];
    // Dal 1 al 20 ottobre: coperti 1–12 e 16–20, scoperti 13, 14 e 15
    expect(giorniCoperti(volantini, null, "2026-10-20")).toEqual({ quota: 85, giorni: 20, scoperti: 3 });
    // Un anno passato: fino alla fine del periodo, dal primo volantino
    expect(giorniCoperti(volantini, { dal: "2026-10-11", al: "2026-10-16" }, "2026-12-01")).toEqual({ quota: 50, giorni: 6, scoperti: 3 });
    // Un periodo tutto nel futuro non ha giorni da contare
    expect(giorniCoperti(volantini, { dal: "2027-01-01", al: "2027-12-31" }, "2026-12-01")).toBeNull();
    expect(giorniCoperti([], null, "2026-12-01")).toBeNull();
  });

  it("reparti a barre: fino a 8 tutti; oltre, i 7 più grandi e gli altri sommati in fondo, anche nel periodo prima", () => {
    const reparti = Array.from({ length: 10 }, (_, i) => ({ reparto: `R${i}`, quota: 20 - i }));
    expect(repartiInBarre(reparti.slice(0, 8), null).map(r => r.reparto)).toEqual(["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7"]);

    const prima = [{ reparto: "R0", quota: 30 }, { reparto: "R8", quota: 5 }, { reparto: "Nuovo", quota: 2 }];
    const barre = repartiInBarre(reparti, prima);
    expect(barre.map(r => r.reparto)).toEqual(["R0", "R1", "R2", "R3", "R4", "R5", "R6", "Altri reparti"]);
    // R7 (13) + R8 (12) + R9 (11)
    expect(barre[7]).toEqual({ reparto: "Altri reparti", quota: 36, prima: 7, altri: true });
    expect(barre[0]).toEqual({ reparto: "R0", quota: 20, prima: 30, altri: false });
    // Un reparto che prima non c'era vale 0, non manca
    expect(barre[1].prima).toBe(0);
    expect(repartiInBarre(reparti, null)[0].prima).toBeNull();
  });

  it("le infografiche del periodo senza dati non hanno un riquadro; la differenza in punti per la nota", () => {
    const vuota = { marche: [], prodottiRicorrenti: [] };
    expect(infograficheConDati(sintesiPeriodo([]), vuota)).toEqual({ meccaniche: false, reparti: false, marche: false, prodotti: false });
    expect(infograficheConDati(sintesiPeriodo(conNumeri), { ...vuota, marche: [{ marca: "Barilla", quota: 3, volantini: 2, linea: null }] })).toEqual({
      meccaniche: true,
      reparti: true,
      marche: true,
      prodotti: false,
    });
    expect(notaDifferenza(22, 18)).toBe("+4 punti");
    expect(notaDifferenza(22, null)).toBeUndefined();
    expect(formatDifferenza(4.6)).toBe("+5");
    expect(formatDifferenza(-12)).toBe("−12");
    expect(formatDifferenza(0.2)).toBe("±0");
  });
});

describe("corsie e assenze della timeline", () => {
  it("referenze, sconto e meccaniche per volantino; indirizzo e telefono stampati", () => {
    const volantini = [
      edizione("k1", "2025-01-09", undefined, { numeroReferenze: 110, scontoMedio: 25.5, referenzeConSconto: 40, meccaniche: [{ meccanica: "sconto", referenze: 30 }, { meccanica: "punti", referenze: 10 }] }),
      edizione("k2", "2025-01-23", undefined, { numeroReferenze: 90 }),
    ];
    const tracce = tracceStoria(volantini, [
      { localita: "Sanremo", indirizzo: "Via Roma 3", telefono: null, dal: "2025-01-09", al: "2025-01-23", volantini: 2, diversoDallAttuale: true },
    ]);

    expect(tracce.map(t => [t.tipo, t.etichetta])).toEqual([
      ["colonne", "Referenze"],
      ["linea", "Sconto medio"],
      ["impilate", "Meccaniche"],
      ["fasce", "Indirizzo stampato"],
    ]);
    const [referenze, sconto, meccaniche] = tracce;
    expect(referenze.tipo === "colonne" && referenze.valori).toEqual({ k1: 110, k2: 90 });
    expect(sconto.tipo === "linea" && sconto.valori).toEqual({ k1: 25.5, k2: null });
    expect(sconto.tipo === "linea" && sconto.formatta(25.5)).toBe("25,5%");
    if (meccaniche.tipo !== "impilate") throw new Error("corsia delle meccaniche attesa");
    // Solo le meccaniche presenti, col colore fisso della meccanica
    expect(meccaniche.categorie.map(c => c.id)).toEqual(["sconto", "punti"]);
    expect(meccaniche.categorie[1].tinta).toEqual(tintaMeccanica("punti"));
    expect(meccaniche.valori.k1).toEqual({ sconto: 75, punti: 25 });
    expect(meccaniche.valori.k2).toEqual({});
  });

  it("senza sconti né meccaniche restano le referenze", () => {
    expect(tracceStoria([edizione("k1", "2025-01-09")]).map(t => t.id)).toEqual(["referenze"]);
  });

  it("le assenze diventano contorni con il nome della promo", () => {
    expect(assenzeTimeline([{ idKit: "a1", dal: "2023-07-13", al: "2023-07-26", promo: { id: "p", nome: "P2314_VOL" } }])).toEqual([
      { id: "a1", dal: "2023-07-13", al: "2023-07-26", titolo: "P2314_VOL" },
    ]);
  });
});

describe("box", () => {
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

describe("scheda: testata", () => {
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
});
