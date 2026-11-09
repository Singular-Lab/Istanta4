// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { KitPromozioneConsultazione, MeccanichePerCanale, PuntoVenditaPromozioneConsultazione } from "../../../lib/consultazione/tipi";

// La pagina colora le insegne solo con i canali della promo: la rete delle insegne non serve
vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import {
  ariaSort,
  CARTOGRAMMA,
  classiScalaRegioni,
  colonneMuro,
  contaPerRegione,
  etichettaFascia,
  filtraPuntiVendita,
  fraseKit,
  grigliaKit,
  chiaveCella,
  kitPerMuro,
  localitaConPiuPuntiVendita,
  meccanicheImpilate,
  ORDINAMENTO_INIZIALE,
  ordinaKit,
  passoRegione,
  prossimoOrdinamento,
  puntiSullaMappa,
  puntiVenditaPerCanale,
  testoQuantoManca,
  testoValidita,
} from "./analisi";

const CITY = { id: "c1", nome: "City" };
const SUPERSTORE = { id: "c2", nome: "Superstore" };
const TOSCANA = { id: "a1", nome: "Toscana" };
const LAZIO = { id: "a2", nome: "Lazio" };

const kit = (id: string, campi: Partial<KitPromozioneConsultazione> = {}): KitPromozioneConsultazione => ({
  id,
  titolo: `VOL ${id}`,
  canale: CITY,
  area: TOSCANA,
  numeroFile: 2,
  numeroPuntiVendita: 10,
  copertina: null,
  referenze: 100,
  box: 90,
  pagine: 12,
  scontoMedio: 25,
  quotaFidelity: 10,
  sottocosto: 2,
  ...campi,
});

const riga = (id: string, campi: Partial<PuntoVenditaPromozioneConsultazione> = {}): PuntoVenditaPromozioneConsultazione => ({
  id,
  idKit: ["k1"],
  riga: `RIGA ${id}`,
  localita: "Lucca",
  indirizzo: "Via Roma 1",
  regione: "TOS",
  puntoVendita: null,
  ...campi,
});

describe("testi della banda", () => {
  const promo = { validitaDal: "2026-11-05", validitaAl: "2026-11-18" };
  const adesso = new Date("2026-11-09T10:00:00+01:00");

  it("negli Attivi dice quanto manca alla fine, nei Prossimi all'inizio", () => {
    expect(testoQuantoManca("attivi", promo, adesso)).toBe("Scade tra 9 giorni");
    expect(testoQuantoManca("prossimi", { validitaDal: "2026-11-10", validitaAl: "2026-11-20" }, adesso)).toBe("Inizia domani");
  });

  it("nello Storico dice quando si è conclusa, con l'anno solo se non è quello di adesso", () => {
    expect(testoQuantoManca("storico", { validitaDal: "2026-10-22", validitaAl: "2026-11-04" }, adesso)).toBe("Conclusa il 4 novembre");
    expect(testoQuantoManca("storico", { validitaDal: "2025-12-18", validitaAl: "2025-12-31" }, adesso)).toBe("Conclusa il 31 dicembre 2025");
  });

  it("nei Prossimi una promo già cominciata non ha nulla da contare, come nelle schede", () => {
    expect(testoQuantoManca("prossimi", { validitaDal: "2026-11-01", validitaAl: "2026-11-20" }, adesso)).toBeNull();
  });

  it("senza la data che serve non c'è cartellino", () => {
    expect(testoQuantoManca("attivi", { validitaDal: "2026-11-05", validitaAl: null }, adesso)).toBeNull();
    expect(testoQuantoManca("prossimi", { validitaDal: null, validitaAl: "2026-11-30" }, adesso)).toBeNull();
    expect(testoQuantoManca("storico", { validitaDal: null, validitaAl: null }, adesso)).toBeNull();
  });

  it("la validità si legge in grande, e senza date lo dice", () => {
    expect(testoValidita(promo)).toBe("5 – 18 novembre 2026");
    expect(testoValidita({ validitaDal: null, validitaAl: null })).toBe("Validità non indicata");
  });

  it("conta volantini, insegne e aree al singolare e al plurale", () => {
    expect(fraseKit([kit("k1")])).toBe("1 volantino per 1 insegna in 1 area");
    expect(fraseKit([kit("k1"), kit("k2", { area: LAZIO }), kit("k3", { canale: SUPERSTORE })])).toBe("3 volantini per 2 insegne in 2 aree");
  });
});

describe("muro delle copertine", () => {
  it("alterna le insegne, senza perdere nessun kit", () => {
    const ordinati = kitPerMuro([kit("c1"), kit("c2"), kit("c3"), kit("s1", { canale: SUPERSTORE }), kit("s2", { canale: SUPERSTORE })]);
    expect(ordinati.map(k => k.id)).toEqual(["c1", "s1", "c2", "s2", "c3"]);
  });

  it("con molti kit usa più colonne, perché tutte le copertine stiano nella banda", () => {
    expect(colonneMuro(1)).toBe(2);
    expect(colonneMuro(3)).toBe(3);
    expect(colonneMuro(8)).toBe(4);
    expect(colonneMuro(15)).toBe(5);
    expect(colonneMuro(40)).toBe(8);
    expect(colonneMuro(500)).toBe(9);
  });
});

describe("griglia canali × aree", () => {
  /** n punti vendita stampati dai kit indicati. */
  const stampati = (n: number, idKit: string[]) => Array.from({ length: n }, (_, i) => riga(`${idKit.join("+")}-${i}`, { idKit }));

  it("canali e aree per nome, una cella per combinazione, i punti vendita per riga e colonna", () => {
    const griglia = grigliaKit(
      [
        kit("k1", { canale: SUPERSTORE, area: TOSCANA, numeroPuntiVendita: 13 }),
        kit("k2", { canale: CITY, area: TOSCANA, numeroPuntiVendita: 102 }),
        kit("k3", { canale: CITY, area: LAZIO, numeroPuntiVendita: 28 }),
      ],
      [...stampati(13, ["k1"]), ...stampati(102, ["k2"]), ...stampati(28, ["k3"])]
    );

    expect(griglia.canali.map(c => c.nome)).toEqual(["City", "Superstore"]);
    expect(griglia.aree.map(a => a.nome)).toEqual(["Lazio", "Toscana"]);
    expect(griglia.celle.get(chiaveCella("c2", "a2"))).toBeUndefined();
    expect(griglia.celle.get(chiaveCella("c1", "a1"))?.map(k => k.id)).toEqual(["k2"]);
    expect(griglia.totaleCanale.get("c1")).toBe(130);
    expect(griglia.totaleArea.get("a1")).toBe(115);
    expect(griglia.totale).toBe(143);
  });

  it("due kit dello stesso canale e area stanno nella stessa cella", () => {
    const griglia = grigliaKit([kit("k1"), kit("k2")], []);
    expect(griglia.celle.get(chiaveCella("c1", "a1"))?.map(k => k.id)).toEqual(["k1", "k2"]);
  });

  it("un punto vendita stampato da più kit conta una volta nei totali, non la somma delle celle", () => {
    // A2623: Emilia e Liguria (stesso canale, aree diverse) stampano gli stessi 38 punti vendita
    const EMILIA = { id: "a-em", nome: "Emilia" };
    const LIGURIA = { id: "a-li", nome: "Liguria" };
    const griglia = grigliaKit(
      [kit("em", { area: EMILIA, numeroPuntiVendita: 38 }), kit("li", { area: LIGURIA, numeroPuntiVendita: 38 })],
      stampati(38, ["em", "li"])
    );

    expect(griglia.totaleCanale.get(CITY.id)).toBe(38);
    expect(griglia.totaleArea.get(EMILIA.id)).toBe(38);
    expect(griglia.totaleArea.get(LIGURIA.id)).toBe(38);
    expect(griglia.totale).toBe(38);
  });
});

describe("regioni", () => {
  it("il cartogramma ha le 20 regioni, ognuna in una tessera sua", () => {
    expect(new Set(CARTOGRAMMA.map(t => t.codice)).size).toBe(20);
    expect(new Set(CARTOGRAMMA.map(t => `${t.colonna},${t.riga}`)).size).toBe(20);
  });

  it("conta le righe per regione e a parte quelle con la regione non indicata", () => {
    const conteggio = contaPerRegione([riga("1"), riga("2"), riga("3", { regione: "LIG" }), riga("4", { regione: null }), riga("5", { regione: null })]);

    expect(conteggio.perRegione.get("TOS")).toBe(2);
    expect(conteggio.perRegione.get("LIG")).toBe(1);
    expect(conteggio.perRegione.has("LAZ")).toBe(false);
    expect(conteggio.senzaRegione).toBe(2);
    expect(conteggio.massimo).toBe(2);
  });

  it("senza righe con la regione il massimo è 0 e la legenda è vuota", () => {
    expect(contaPerRegione([riga("1", { regione: null })]).massimo).toBe(0);
    expect(classiScalaRegioni(0)).toEqual([]);
  });

  it("la scala ha classi intere fino al massimo, e la regione più piena cade nell'ultima", () => {
    expect(classiScalaRegioni(100)).toEqual([
      { passo: 0, da: 1, a: 20 },
      { passo: 1, da: 21, a: 40 },
      { passo: 2, da: 41, a: 60 },
      { passo: 3, da: 61, a: 80 },
      { passo: 4, da: 81, a: 100 },
    ]);
    expect(classiScalaRegioni(3)).toEqual([
      { passo: 0, da: 1, a: 1 },
      { passo: 1, da: 2, a: 2 },
      { passo: 2, da: 3, a: 3 },
    ]);
    expect(passoRegione(0, 20)).toBe(-1);
    expect(passoRegione(20, 20)).toBe(0);
    expect(passoRegione(21, 20)).toBe(1);
    expect(passoRegione(100, 20)).toBe(4);
  });
});

describe("località e punti vendita", () => {
  const righe = [
    riga("1", { localita: "LUCCA" }),
    riga("2", { localita: "Lucca " }),
    riga("3", { localita: "lucca" }),
    riga("4", { localita: "Pisa" }),
    riga("5", { localita: "Arezzo" }),
    riga("6", { localita: "Pisa" }),
    riga("7", { localita: "Genova", regione: "LIG" }),
    riga("8", { localita: null }),
    riga("9", { localita: "Forlì", regione: null }),
  ];

  it("la stessa località scritta diversa si conta una volta, dalla più presente; senza località non conta", () => {
    expect(localitaConPiuPuntiVendita(righe, null)).toEqual([
      { chiave: "lucca", nome: "LUCCA", puntiVendita: 3 },
      { chiave: "pisa", nome: "Pisa", puntiVendita: 2 },
      { chiave: "arezzo", nome: "Arezzo", puntiVendita: 1 },
      { chiave: "forli", nome: "Forlì", puntiVendita: 1 },
      { chiave: "genova", nome: "Genova", puntiVendita: 1 },
    ]);
  });

  it("segue la regione scelta e si ferma al numero chiesto", () => {
    expect(localitaConPiuPuntiVendita(righe, "LIG").map(l => l.nome)).toEqual(["Genova"]);
    expect(localitaConPiuPuntiVendita(righe, "TOS", 2).map(l => l.nome)).toEqual(["LUCCA", "Pisa"]);
  });

  it("filtra per regione, lasciando fuori le righe senza regione", () => {
    const filtrate = filtraPuntiVendita(righe, { regione: "TOS", cerca: "" });
    expect(filtrate.map(r => r.id)).toEqual(["1", "2", "3", "4", "5", "6", "8"]);
    expect(filtraPuntiVendita(righe, { regione: null, cerca: "" })).toHaveLength(righe.length);
  });

  it("cerca in località e indirizzo senza badare a maiuscole e accenti", () => {
    const conIndirizzi = [
      riga("1", { localita: "Forlì", indirizzo: "Viale Bologna 3" }),
      riga("2", { localita: "Cesena", indirizzo: "Via Emilia 120" }),
      riga("3", { localita: null, indirizzo: null, riga: "CESENATICO - PIAZZA ANDREA COSTA" }),
    ];
    expect(filtraPuntiVendita(conIndirizzi, { regione: null, cerca: "FORLI" }).map(r => r.id)).toEqual(["1"]);
    expect(filtraPuntiVendita(conIndirizzi, { regione: null, cerca: "via  emilia" }).map(r => r.id)).toEqual(["2"]);
    expect(filtraPuntiVendita(conIndirizzi, { regione: null, cerca: "cesena" }).map(r => r.id)).toEqual(["2", "3"]);
  });

  it("conta i punti vendita per insegna dai kit che stampano ciascuno", () => {
    const kitPromo = [kit("k1"), kit("k2", { canale: SUPERSTORE })];
    const perCanale = puntiVenditaPerCanale(kitPromo, [riga("1"), riga("2", { idKit: ["k2"] }), riga("3", { idKit: ["k2"] }), riga("4", { idKit: ["altro"] })]);
    expect(perCanale).toEqual([
      { canale: SUPERSTORE, puntiVendita: 2 },
      { canale: CITY, puntiVendita: 1 },
    ]);
  });

  it("un punto vendita stampato da due kit della stessa insegna conta una volta, da due insegne una volta per ciascuna", () => {
    const kitPromo = [kit("em"), kit("li"), kit("ss", { canale: SUPERSTORE })];
    const perCanale = puntiVenditaPerCanale(kitPromo, [riga("1", { idKit: ["em", "li"] }), riga("2", { idKit: ["li", "ss"] })]);
    expect(perCanale).toEqual([
      { canale: CITY, puntiVendita: 2 },
      { canale: SUPERSTORE, puntiVendita: 1 },
    ]);
  });

  it("sulla mappa solo i riconosciuti con le coordinate, una volta anche se li stampano più kit", () => {
    const pv = (id: string, coordinate: { lat: number; lon: number } | null) => ({ id, nome: `PV ${id}`, coordinate });
    const { punti, fuoriMappa } = puntiSullaMappa([
      riga("1", { idKit: ["k1", "k3"], puntoVendita: pv("p1", { lat: 43.8, lon: 10.5 }) }),
      riga("2", { idKit: ["k2", "k1"], puntoVendita: pv("p1", { lat: 43.8, lon: 10.5 }) }),
      riga("3", { puntoVendita: pv("p2", null) }),
      riga("4", { puntoVendita: null }),
    ]);
    expect(punti).toEqual([{ id: "p1", nome: "PV p1", lat: 43.8, lon: 10.5, idKit: ["k1", "k3", "k2"] }]);
    expect(fuoriMappa).toBe(2);
  });
});

describe("assortimento", () => {
  it("scrive le fasce di sconto come negli insight", () => {
    expect(etichettaFascia({ da: 10, a: 20 })).toBe("10–20%");
    expect(etichettaFascia({ da: 50, a: null })).toBe("≥ 50%");
  });

  it("impila le meccaniche per canale, con quella non riconosciuta in fondo e 0 dove il canale non ce l'ha", () => {
    const perCanale: MeccanichePerCanale[] = [
      {
        canale: CITY,
        box: 10,
        quote: [
          { meccanica: "sconto", etichetta: "Sconto in %", box: 6, quota: 60 },
          { meccanica: null, etichetta: "Non riconosciuta", box: 4, quota: 40 },
        ],
      },
      {
        canale: SUPERSTORE,
        box: 4,
        quote: [
          { meccanica: "sconto", etichetta: "Sconto in %", box: 1, quota: 25 },
          { meccanica: "sottocosto", etichetta: "Sottocosto", box: 3, quota: 75 },
        ],
      },
    ];
    const { righe, categorie, valori } = meccanicheImpilate(perCanale);

    expect(righe).toEqual([{ id: "c1", etichetta: "City" }, { id: "c2", etichetta: "Superstore" }]);
    expect(categorie.map(c => c.id)).toEqual(["sconto", "sottocosto", "non_riconosciuta"]);
    expect(valori).toEqual([
      [60, 0, 40],
      [25, 75, 0],
    ]);
  });
});

describe("confronto fra i kit", () => {
  const kitPromo = [
    kit("k1", { canale: CITY, area: TOSCANA, numeroPuntiVendita: 102, referenze: 109, scontoMedio: 30 }),
    kit("k2", { canale: SUPERSTORE, area: TOSCANA, numeroPuntiVendita: 13, referenze: 266, scontoMedio: null }),
    kit("k3", { canale: CITY, area: LAZIO, numeroPuntiVendita: 28, referenze: 109, scontoMedio: 22 }),
  ];
  const ids = (ordinati: KitPromozioneConsultazione[]) => ordinati.map(k => k.id);

  it("all'apertura i kit con più punti vendita stanno in cima", () => {
    expect(ids(ordinaKit(kitPromo, ORDINAMENTO_INIZIALE))).toEqual(["k1", "k3", "k2"]);
  });

  it("per nome ordina per canale e poi per area", () => {
    expect(ids(ordinaKit(kitPromo, { colonna: "volantino", verso: "crescente" }))).toEqual(["k3", "k1", "k2"]);
    expect(ids(ordinaKit(kitPromo, { colonna: "volantino", verso: "decrescente" }))).toEqual(["k2", "k1", "k3"]);
  });

  it("a parità di valore decide il nome", () => {
    expect(ids(ordinaKit(kitPromo, { colonna: "referenze", verso: "crescente" }))).toEqual(["k3", "k1", "k2"]);
  });

  it("lo sconto medio mancante resta in fondo in entrambi i versi", () => {
    expect(ids(ordinaKit(kitPromo, { colonna: "scontoMedio", verso: "decrescente" }))).toEqual(["k1", "k3", "k2"]);
    expect(ids(ordinaKit(kitPromo, { colonna: "scontoMedio", verso: "crescente" }))).toEqual(["k3", "k1", "k2"]);
  });

  it("sulla stessa colonna inverte il verso, su un'altra parte dal verso naturale", () => {
    const perPv = prossimoOrdinamento(ORDINAMENTO_INIZIALE, "puntiVendita");
    expect(perPv).toEqual({ colonna: "puntiVendita", verso: "crescente" });
    expect(prossimoOrdinamento(perPv, "volantino")).toEqual({ colonna: "volantino", verso: "crescente" });
    expect(prossimoOrdinamento(perPv, "referenze")).toEqual({ colonna: "referenze", verso: "decrescente" });
  });

  it("aria-sort solo sulla colonna ordinata", () => {
    expect(ariaSort(ORDINAMENTO_INIZIALE, "puntiVendita")).toBe("descending");
    expect(ariaSort({ colonna: "volantino", verso: "crescente" }, "volantino")).toBe("ascending");
    expect(ariaSort(ORDINAMENTO_INIZIALE, "referenze")).toBe("none");
  });
});
