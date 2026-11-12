// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { KitPromozioneConsultazione, MeccanichePerCanale, PresenzaReferenzaPromozione, ReferenzaPromozione } from "../../../lib/consultazione/tipi";

// La pagina colora le insegne solo con i canali della promo: la rete delle insegne non serve
vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import {
  ariaSort,
  celleConPiuKit,
  conValoreScelto,
  csvConfronto,
  descriviPresenze,
  etichettaFascia,
  filtraConfronto,
  fraseKit,
  chiaveCella,
  grigliaVolantini,
  idFiltro,
  meccanicheImpilate,
  nomeCasella,
  ORDINAMENTO_INIZIALE,
  ordinaConfronto,
  ordinaKit,
  ordineDaIndirizzo,
  prezziPerLuogo,
  prodottiConfronto,
  type ProdottoConfronto,
  prossimoOrdinamento,
  SENZA_REPARTO,
  sintesiConfronto,
  stessaVista,
  testoQuantoManca,
  testoValidita,
  tinteCanaliPromozione,
  type VistaConfronto,
  vistaDaIndirizzo,
  vistaInIndirizzo,
} from "./analisi";

const CITY = { id: "c1", nome: "City" };
const SUPERSTORE = { id: "c2", nome: "Superstore" };
const CONAD = { id: "c3", nome: "Conad" };
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

describe("filtri del dettaglio", () => {
  const ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";

  it("dall'indirizzo arrivano al server solo gli UUID", () => {
    expect(idFiltro(ID)).toBe(ID);
    expect(idFiltro(ID.toUpperCase())).toBe(ID.toUpperCase());
    expect(idFiltro("toscana")).toBeUndefined();
    expect(idFiltro("")).toBeUndefined();
    expect(idFiltro(null)).toBeUndefined();
  });

  it("il valore scelto resta fra le opzioni: se manca va in coda con un nome generico", () => {
    expect(conValoreScelto([TOSCANA, LAZIO], undefined, "Area scelta")).toEqual([TOSCANA, LAZIO]);
    expect(conValoreScelto([TOSCANA, LAZIO], "A2", "Area scelta")).toEqual([TOSCANA, LAZIO]);
    expect(conValoreScelto([TOSCANA], "a9", "Area scelta")).toEqual([TOSCANA, { id: "a9", nome: "Area scelta" }]);
  });

  it("le miniature dicono il titolo solo dove insegna e area hanno più di un volantino", () => {
    const celle = celleConPiuKit([kit("k1"), kit("k2"), kit("k3", { area: LAZIO }), kit("k4", { canale: SUPERSTORE })]);
    expect([...celle]).toEqual([chiaveCella(CITY.id, TOSCANA.id)]);
  });

  it("i colori delle insegne si calcolano su tutte le insegne della promo, non sui kit filtrati", () => {
    const tutte = tinteCanaliPromozione([SUPERSTORE, CITY]);
    const soloSuperstore = tinteCanaliPromozione([SUPERSTORE]);
    // Per nome: City prima di Superstore, qualunque sia l'ordine ricevuto
    expect(tutte(CITY.id)).toEqual(tinteCanaliPromozione([CITY, SUPERSTORE])(CITY.id));
    expect(tutte(SUPERSTORE.id)).not.toEqual(soloSuperstore(SUPERSTORE.id));
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

describe("assortimento a confronto", () => {
  // 3 insegne × 2 aree, senza il volantino Superstore · Lazio: 5 volantini
  const kitPromo = [
    kit("ct", { canale: CITY, area: TOSCANA }),
    kit("cl", { canale: CITY, area: LAZIO }),
    kit("ot", { canale: CONAD, area: TOSCANA }),
    kit("ol", { canale: CONAD, area: LAZIO }),
    kit("st", { canale: SUPERSTORE, area: TOSCANA }),
  ];
  const griglia = grigliaVolantini(kitPromo);
  const presenza = (idKit: string, prezzo: number | null = 1, campi: Partial<PresenzaReferenzaPromozione> = {}): PresenzaReferenzaPromozione => ({
    idKit,
    pagina: 2,
    prezzo,
    sconto: null,
    barrato: null,
    idReferenza: null,
    ...campi,
  });
  const referenza = (nome: string, presenze: PresenzaReferenzaPromozione[], campi: Partial<ReferenzaPromozione> = {}): ReferenzaPromozione => ({
    chiave: nome,
    nome,
    marca: null,
    formato: null,
    reparto: null,
    foto: null,
    codice: null,
    ean: null,
    meccaniche: [],
    prezzoAlKg: null,
    linea: null,
    sottocosto: false,
    presenze,
    ...campi,
  });
  const prodotto = (nome: string, idKit: string[], campi: Partial<ReferenzaPromozione> = {}) =>
    prodottiConfronto([referenza(nome, idKit.map(id => presenza(id)), campi)], griglia)[0] as ProdottoConfronto;
  const dove = (idKit: string[]) => descriviPresenze(prodotto("x", idKit), griglia).testo;

  it("la griglia: insegne e aree per nome, una casella per kit, e la casella senza volantino", () => {
    expect(griglia.insegne.map(i => i.nome)).toEqual(["City", "Conad", "Superstore"]);
    expect(griglia.aree.map(a => a.nome)).toEqual(["Lazio", "Toscana"]);
    expect(griglia.casellaDelKit.get("st")).toBe(5);
    expect([...griglia.esistenti].sort()).toEqual([0, 1, 2, 3, 5]);
    expect(nomeCasella(griglia, 1)).toBe("City · Toscana");
  });

  it("dove c'è, nella forma più breve", () => {
    expect(dove(["ct", "cl", "ot", "ol", "st"])).toBe("In tutti i 5 volantini");
    expect(dove(["ct", "cl"])).toBe("Solo City");
    expect(dove(["ct", "cl", "ot", "ol"])).toBe("Solo City e Conad");
    expect(dove(["ct", "ot", "st"])).toBe("Solo Toscana");
    expect(dove(["cl"])).toBe("Solo City · Lazio");
    expect(dove(["cl", "ol", "ot", "st"])).toBe("Manca in City · Toscana");
    expect(descriviPresenze(prodotto("x", ["ct", "cl", "ot", "ol", "st"]), griglia).eccezione).toBe(false);
  });

  it("prezzi per luogo: dal più basso, con il prezzo più diffuso detto altrove; uno solo quando è uguale ovunque", () => {
    const vari = prodottiConfronto(
      [referenza("Napisan", [presenza("ct", 6.79), presenza("ot", 6.79), presenza("st", 6.79), presenza("cl", 7.99), presenza("ol", 7.99)])],
      griglia
    )[0] as ProdottoConfronto;
    expect(prezziPerLuogo(vari, griglia)).toEqual([
      { prezzo: 6.79, luogo: "altrove", piuAlto: false },
      { prezzo: 7.99, luogo: "Lazio", piuAlto: true },
    ]);
    expect(vari).toMatchObject({ min: 6.79, max: 7.99, differenza: 1.2, percentuale: 18 });
    expect(prezziPerLuogo(prodotto("uguale", ["ct", "cl"]), griglia)).toEqual([{ prezzo: 1, luogo: "", piuAlto: false }]);
    const senzaPrezzo = prodottiConfronto([referenza("y", [presenza("ct", null)])], griglia)[0] as ProdottoConfronto;
    expect(prezziPerLuogo(senzaPrezzo, griglia)).toEqual([]);
  });

  it("i numeri: base comune, prezzi diversi, una sola insegna e una sola area, un solo volantino", () => {
    const prodotti = prodottiConfronto(
      [
        referenza("tutti", ["ct", "cl", "ot", "ol", "st"].map(id => presenza(id))),
        referenza("city", [presenza("ct", 1), presenza("cl", 2)]),
        referenza("toscana", ["ct", "ot", "st"].map(id => presenza(id))),
        referenza("uno", [presenza("st")]),
      ],
      griglia
    );
    const sintesi = sintesiConfronto(prodotti, griglia);
    expect(sintesi).toMatchObject({ totale: 4, base: 1, prezziDiversi: 1 });
    expect(sintesi.perInsegna.map(v => [v.insegna.nome, v.prodotti])).toEqual([["City", 1], ["Conad", 0], ["Superstore", 1]]);
    expect(sintesi.perArea.map(v => [v.area.nome, v.prodotti])).toEqual([["Lazio", 0], ["Toscana", 2]]);
    expect([...sintesi.perCasella]).toEqual([[5, 1]]);
    expect(sintesi.piuDistante?.referenza.nome).toBe("city");
  });

  it("la vista nell'indirizzo, avanti e indietro; un valore storpiato o di una casella senza volantino non è una vista", () => {
    const viste: VistaConfronto[] = [{ tipo: "base" }, { tipo: "prezzi" }, { tipo: "insegna", id: CITY.id }, { tipo: "area", id: TOSCANA.id }, { tipo: "casella", casella: 1 }];
    for (const vista of viste) expect(vistaDaIndirizzo(vistaInIndirizzo(vista, griglia), griglia)).toEqual(vista);
    expect(vistaDaIndirizzo("tutto", griglia)).toBeNull();
    expect(vistaDaIndirizzo(`casella:${SUPERSTORE.id}:${LAZIO.id}`, griglia)).toBeNull();
    expect(stessaVista({ tipo: "insegna", id: CITY.id }, { tipo: "insegna", id: CITY.id.toUpperCase() })).toBe(true);
    expect(stessaVista({ tipo: "casella", casella: 1 }, { tipo: "casella", casella: 2 })).toBe(false);
  });

  it("filtra per vista, punto di vista, prezzi diversi, reparto e ricerca in nome, marca, codice ed EAN", () => {
    const LAT = { codice: "LAT", descrizione: "Latticini" };
    const prodotti = prodottiConfronto(
      [
        referenza("Latte", [presenza("ct", 1.19), presenza("cl", 1.29)], { marca: "Granarolo", reparto: LAT, codice: "0014823", ean: "8001234567890" }),
        referenza("Pasta", ["ct", "cl", "ot", "ol", "st"].map(id => presenza(id))),
        referenza("Yogurt", [presenza("st")], { reparto: LAT }),
      ],
      griglia
    );
    const nomi = (filtro: Partial<Parameters<typeof filtraConfronto>[2]>) =>
      filtraConfronto(prodotti, griglia, { vista: null, punto: null, cerca: "", reparto: null, soloDiversi: false, ...filtro }).map(p => p.referenza.nome);
    expect(nomi({ vista: { tipo: "insegna", id: CITY.id } })).toEqual(["Latte"]);
    expect(nomi({ vista: { tipo: "base" } })).toEqual(["Pasta"]);
    expect(nomi({ vista: { tipo: "casella", casella: 5 } })).toEqual(["Yogurt"]);
    expect(nomi({ punto: SUPERSTORE.id })).toEqual(["Pasta", "Yogurt"]);
    expect(nomi({ soloDiversi: true })).toEqual(["Latte"]);
    expect(nomi({ reparto: "LAT" })).toEqual(["Latte", "Yogurt"]);
    expect(nomi({ reparto: SENZA_REPARTO })).toEqual(["Pasta"]);
    expect(nomi({ cerca: "GRANAROLO" })).toEqual(["Latte"]);
    expect(nomi({ cerca: "0014823" })).toEqual(["Latte"]);
    expect(nomi({ cerca: "800123" })).toEqual(["Latte"]);
  });

  it("ordina per differenza in %, per nome o per numero di volantini; a parità per nome", () => {
    const prodotti = prodottiConfronto(
      [
        referenza("B", [presenza("ct", 1), presenza("cl", 1.5)]),
        referenza("A", [presenza("ct", 1), presenza("cl", 1.1), presenza("ot", 1)]),
        referenza("C", [presenza("st")]),
      ],
      griglia
    );
    const nomi = (ordine: Parameters<typeof ordinaConfronto>[1]) => ordinaConfronto(prodotti, ordine).map(p => p.referenza.nome);
    expect(nomi("differenza")).toEqual(["B", "A", "C"]);
    expect(nomi("nome")).toEqual(["A", "B", "C"]);
    expect(nomi("volantini")).toEqual(["A", "B", "C"]);
    expect(ordineDaIndirizzo("storpiato")).toBe("differenza");
  });

  it("il file per Excel: punto e virgola, BOM, una colonna di prezzo per ogni volantino con la virgola decimale", () => {
    const prodotti = prodottiConfronto([referenza("Latte \"intero\"", [presenza("ct", 1.19), presenza("cl", 1.29)], { marca: "Granarolo", meccaniche: ["fidelity"] })], griglia);
    const [testa, riga] = csvConfronto(prodotti, griglia).split("\r\n");
    expect(testa?.startsWith("\uFEFF")).toBe(true);
    expect(testa).toContain('"Prezzo City · Lazio";"Prezzo City · Toscana";"Prezzo Conad · Lazio";"Prezzo Conad · Toscana";"Prezzo Superstore · Toscana"');
    expect(riga).toBe('"Latte ""intero""";"Granarolo";"";"";"";"";"Prezzo Fidelity";"Solo City";"1,29";"1,19";"";"";"";"0,10";"8"');
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
