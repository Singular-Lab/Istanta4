// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { KitPromozioneConsultazione, MeccanichePerCanale, PresenzaReferenzaPromozione, ReferenzaPromozione } from "../../../lib/consultazione/tipi";

// La pagina colora le insegne solo con i canali della promo: la rete delle insegne non serve
vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import {
  ariaSort,
  ariaSortElenco,
  celleConPiuKit,
  numeriNellaCella,
  conteggioRuolo,
  descrizioneRuolo,
  facceConfronto,
  lineeInVista,
  ordinaElenco,
  ordinamentoElencoDaIndirizzo,
  ordinamentoElencoInIndirizzo,
  prossimoOrdinamentoElenco,
  testoPercentuale,
  conValoreScelto,
  csvConfronto,
  descriviPresenze,
  etichettaFascia,
  filtraConfronto,
  fraseKit,
  chiaveCella,
  grigliaVolantini,
  idFiltro,
  LIMITE_IN_COMUNE,
  meccanicheImpilate,
  nomeCasella,
  ORDINAMENTO_INIZIALE,
  ordinaConfronto,
  ordinaKit,
  prezziPerLuogo,
  prodottiConfronto,
  prodottiInComune,
  type ProdottoConfronto,
  prossimoOrdinamento,
  percentualeDi,
  ruoliDelConfronto,
  ruoliDelProdotto,
  SENZA_FILTRI,
  SENZA_REPARTO,
  SENZA_RUOLO,
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

  it("i kit di un'insegna e un'area con più volantini sono numerati, gli altri no", () => {
    const numeri = numeriNellaCella([kit("k1"), kit("k2"), kit("k3", { area: LAZIO })]);
    expect(numeri.get("k1")).toEqual({ numero: 1, di: 2 });
    expect(numeri.get("k2")).toEqual({ numero: 2, di: 2 });
    expect(numeri.has("k3")).toBe(false);
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
      { prezzo: 6.79, luogo: "altrove", piuAlto: false, allEtto: false },
      { prezzo: 7.99, luogo: "Lazio", piuAlto: true, allEtto: false },
    ]);
    expect(vari).toMatchObject({ min: 6.79, max: 7.99, differenza: 1.2, percentuale: 18 });
    expect(prezziPerLuogo(prodotto("uguale", ["ct", "cl"]), griglia)).toEqual([{ prezzo: 1, luogo: "", piuAlto: false, allEtto: false }]);
    const senzaPrezzo = prodottiConfronto([referenza("y", [presenza("ct", null)])], griglia)[0] as ProdottoConfronto;
    expect(prezziPerLuogo(senzaPrezzo, griglia)).toEqual([]);
  });

  it("un prezzo stampato all'etto lo dice: il Gorgonzola a € 0,99 non è un prezzo al pezzo", () => {
    const gorgonzola = prodottiConfronto(
      [referenza("Gorgonzola", [presenza("ct", 0.99, { prezzoAllEtto: true }), presenza("cl", 1.29, { prezzoAllEtto: true }), presenza("ot", 1.29, { prezzoAllEtto: true })])],
      griglia
    )[0] as ProdottoConfronto;
    expect(prezziPerLuogo(gorgonzola, griglia).map(voce => [voce.prezzo, voce.allEtto])).toEqual([[0.99, true], [1.29, true]]);
  });

  it("i numeri: base comune, a marchio con le linee, Fidelity; ai margini della mappa una sola insegna e una sola area, un solo volantino", () => {
    const prodotti = prodottiConfronto(
      [
        referenza("tutti", ["ct", "cl", "ot", "ol", "st"].map(id => presenza(id)), { linea: "Conad", meccaniche: ["fidelity"] }),
        referenza("city", [presenza("ct", 1), presenza("cl", 2)], { linea: "Sapori & Dintorni", meccaniche: ["sconto", "fidelity"] }),
        referenza("toscana", ["ct", "ot", "st"].map(id => presenza(id)), { linea: "Conad" }),
        referenza("uno", [presenza("st")], { meccaniche: ["sconto"] }),
      ],
      griglia
    );
    const sintesi = sintesiConfronto(prodotti, griglia);
    expect(sintesi).toMatchObject({ totale: 4, base: 1, aMarchio: 3, fidelity: 2 });
    expect(sintesi.perLinea).toEqual([{ linea: "Conad", prodotti: 2 }, { linea: "Sapori & Dintorni", prodotti: 1 }]);
    expect(percentualeDi(sintesi.aMarchio, sintesi.totale)).toBe(75);
    expect(percentualeDi(sintesi.fidelity, sintesi.totale)).toBe(50);
    expect(sintesi.perInsegna.map(v => [v.insegna.nome, v.prodotti])).toEqual([["City", 1], ["Conad", 0], ["Superstore", 1]]);
    expect(sintesi.perArea.map(v => [v.area.nome, v.prodotti])).toEqual([["Lazio", 0], ["Toscana", 2]]);
    expect([...sintesi.perCasella]).toEqual([[5, 1]]);
  });

  it("senza prodotti le percentuali sono zero", () => {
    const sintesi = sintesiConfronto([], griglia);
    expect(sintesi).toMatchObject({ totale: 0, aMarchio: 0, fidelity: 0, perLinea: [] });
    expect(percentualeDi(sintesi.aMarchio, sintesi.totale)).toBe(0);
    expect(testoPercentuale(sintesi.aMarchio, sintesi.totale)).toBe("0%");
  });

  it("la percentuale scritta: intera; meno dell'1% quando la parte c'è ma arrotondata sarebbe 0%", () => {
    expect(testoPercentuale(115, 433)).toBe("27%");
    expect(testoPercentuale(1, 433)).toBe("meno dell'1%");
    expect(testoPercentuale(0, 433)).toBe("0%");
    expect(testoPercentuale(3, 3)).toBe("100%");
  });

  it("le linee in vista: le quattro con più prodotti, le altre insieme; con quattro o meno tutte", () => {
    const sette = [46, 30, 20, 12, 4, 2, 1].map((prodotti, i) => ({ linea: `Linea ${i + 1}`, prodotti }));
    const { linee, altre } = lineeInVista(sette);
    expect(linee.map(voce => voce.linea)).toEqual(["Linea 1", "Linea 2", "Linea 3", "Linea 4"]);
    expect(altre).toEqual({ linee: 3, prodotti: 7 });
    // Le percentuali delle linee sono sui soli prodotti a marchio: nessuna a 0%
    expect(testoPercentuale(46, 115)).toBe("40%");
    expect(testoPercentuale(7, 115)).toBe("6%");
    expect(lineeInVista(sette.slice(0, 4))).toEqual({ linee: sette.slice(0, 4), altre: null });
    expect(lineeInVista([])).toEqual({ linee: [], altre: null });
  });

  it("la vista nell'indirizzo, avanti e indietro; un valore storpiato, dei numeri tolti o di una casella senza volantino non è una vista", () => {
    const viste: VistaConfronto[] = [
      { tipo: "base" },
      { tipo: "marchio" },
      { tipo: "fidelity" },
      { tipo: "insegna", id: CITY.id },
      { tipo: "area", id: TOSCANA.id },
      { tipo: "casella", casella: 1 },
    ];
    for (const vista of viste) expect(vistaDaIndirizzo(vistaInIndirizzo(vista, griglia), griglia)).toEqual(vista);
    expect(vistaDaIndirizzo("tutto", griglia)).toBeNull();
    for (const tolta of ["prezzi", "insegne", "aree"]) expect(vistaDaIndirizzo(tolta, griglia)).toBeNull();
    expect(vistaDaIndirizzo(`casella:${SUPERSTORE.id}:${LAZIO.id}`, griglia)).toBeNull();
    expect(stessaVista({ tipo: "insegna", id: CITY.id }, { tipo: "insegna", id: CITY.id.toUpperCase() })).toBe(true);
    expect(stessaVista({ tipo: "casella", casella: 1 }, { tipo: "casella", casella: 2 })).toBe(false);
  });

  it("filtra per vista, punto di vista, ruolo, reparto e ricerca in nome, marca, codice ed EAN", () => {
    const LAT = { codice: "LAT", descrizione: "Latticini" };
    const prodotti = prodottiConfronto(
      [
        referenza("Latte", [presenza("ct", 1.19), presenza("cl", 1.29)], {
          marca: "Granarolo", reparto: LAT, codice: "0014823", ean: "8001234567890", ruoli: ["Star", "Base"], linea: "Conad",
        }),
        referenza("Pasta", ["ct", "cl", "ot", "ol", "st"].map(id => presenza(id)), { ruoli: ["Base"], meccaniche: ["fidelity"] }),
        referenza("Yogurt", [presenza("st")], { reparto: LAT }),
      ],
      griglia
    );
    const nomi = (filtro: Partial<Parameters<typeof filtraConfronto>[2]>) => filtraConfronto(prodotti, griglia, { ...SENZA_FILTRI, ...filtro }).map(p => p.referenza.nome);
    expect(nomi({ vista: { tipo: "insegna", id: CITY.id } })).toEqual(["Latte"]);
    // Lo yogurt c'è solo nel kit Superstore Toscana: è dell'area Toscana soltanto
    expect(nomi({ vista: { tipo: "area", id: TOSCANA.id } })).toEqual(["Yogurt"]);
    expect(nomi({ vista: { tipo: "base" } })).toEqual(["Pasta"]);
    expect(nomi({ vista: { tipo: "marchio" } })).toEqual(["Latte"]);
    expect(nomi({ vista: { tipo: "fidelity" } })).toEqual(["Pasta"]);
    expect(nomi({ vista: { tipo: "casella", casella: 5 } })).toEqual(["Yogurt"]);
    expect(nomi({ punto: SUPERSTORE.id })).toEqual(["Pasta", "Yogurt"]);
    expect(nomi({ ruoli: ["Star"] })).toEqual(["Latte"]);
    expect(nomi({ ruoli: ["Base"] })).toEqual(["Latte", "Pasta"]);
    expect(nomi({ ruoli: [SENZA_RUOLO] })).toEqual(["Yogurt"]);
    // Più ruoli valgono in alternativa, anche con i prodotti senza ruolo
    expect(nomi({ ruoli: ["Star", SENZA_RUOLO] })).toEqual(["Latte", "Yogurt"]);
    expect(nomi({ ruoli: [] })).toEqual(["Latte", "Pasta", "Yogurt"]);
    expect(nomi({ reparto: "LAT" })).toEqual(["Latte", "Yogurt"]);
    expect(nomi({ reparto: SENZA_REPARTO })).toEqual(["Pasta"]);
    expect(nomi({ cerca: "GRANAROLO" })).toEqual(["Latte"]);
    expect(nomi({ cerca: "0014823" })).toEqual(["Latte"]);
    expect(nomi({ cerca: "800123" })).toEqual(["Latte"]);
  });

  it("l'ordine di apertura: prima i prezzi diversi, dalla differenza più grande in %, poi gli altri per nome", () => {
    const prodotti = prodottiConfronto(
      [
        referenza("D", [presenza("st")]),
        referenza("B", [presenza("ct", 1), presenza("cl", 1.5)]),
        referenza("A", [presenza("ct", 1), presenza("cl", 1.1), presenza("ot", 1)]),
        referenza("C", [presenza("st")]),
      ],
      griglia
    );
    expect(ordinaConfronto(prodotti).map(p => p.referenza.nome)).toEqual(["B", "A", "C", "D"]);
    // Senza un ordine scelto l'elenco resta nell'ordine di apertura
    expect(ordinaElenco(prodotti, null).map(p => p.referenza.nome)).toEqual(["B", "A", "C", "D"]);
  });

  it("l'ordine scelto dalle intestazioni: nome, volantini, prezzo più basso, differenza; il prezzo mancante in fondo", () => {
    const prodotti = prodottiConfronto(
      [
        referenza("Dado", [presenza("st", 2.5)]),
        referenza("Burro", [presenza("ct", 1), presenza("cl", 1.5)]),
        referenza("Aceto", [presenza("ct", 1.2), presenza("cl", 1.3), presenza("ot", 1.2)]),
        referenza("Cacao", [presenza("st", null)]),
      ],
      griglia
    );
    const nomi = (ordinamento: Parameters<typeof ordinaElenco>[1]) => ordinaElenco(prodotti, ordinamento).map(p => p.referenza.nome);
    expect(nomi({ colonna: "prodotto", verso: "crescente" })).toEqual(["Aceto", "Burro", "Cacao", "Dado"]);
    expect(nomi({ colonna: "prodotto", verso: "decrescente" })).toEqual(["Dado", "Cacao", "Burro", "Aceto"]);
    expect(nomi({ colonna: "volantini", verso: "decrescente" })).toEqual(["Aceto", "Burro", "Cacao", "Dado"]);
    expect(nomi({ colonna: "prezzo", verso: "crescente" })).toEqual(["Burro", "Aceto", "Dado", "Cacao"]);
    expect(nomi({ colonna: "prezzo", verso: "decrescente" })).toEqual(["Dado", "Aceto", "Burro", "Cacao"]);
    expect(nomi({ colonna: "differenza", verso: "decrescente" })).toEqual(["Burro", "Aceto", "Cacao", "Dado"]);
  });

  it("l'ordine dell'elenco nell'indirizzo, la prossima scelta e aria-sort; un valore storpiato o di prima non è un ordine", () => {
    const prezzo = { colonna: "prezzo", verso: "crescente" } as const;
    expect(ordinamentoElencoInIndirizzo(prezzo)).toBe("prezzo:crescente");
    expect(ordinamentoElencoDaIndirizzo("prezzo:crescente")).toEqual(prezzo);
    for (const valore of [null, "", "nome", "prezzo", "prezzo:su", "colore:crescente"]) expect(ordinamentoElencoDaIndirizzo(valore)).toBeNull();
    expect(prossimoOrdinamentoElenco(null, "prezzo")).toEqual(prezzo);
    expect(prossimoOrdinamentoElenco(prezzo, "prezzo")).toEqual({ colonna: "prezzo", verso: "decrescente" });
    expect(prossimoOrdinamentoElenco(prezzo, "differenza")).toEqual({ colonna: "differenza", verso: "decrescente" });
    expect(prossimoOrdinamentoElenco(null, "prodotto")).toEqual({ colonna: "prodotto", verso: "crescente" });
    expect(ariaSortElenco(prezzo, "prezzo")).toBe("ascending");
    expect(ariaSortElenco(prezzo, "prodotto")).toBe("none");
    expect(ariaSortElenco(null, "prezzo")).toBe("none");
  });

  it("i ruoli: per nome con quanti prodotti ha ciascuno e quanti non ne hanno; per prodotto, quanti volantini ha ciascun ruolo", () => {
    const latte = referenza("Latte", [presenza("ct", 1, { ruolo: "Star" }), presenza("cl", 1, { ruolo: "Base" }), presenza("ot", 1, { ruolo: "Base" })], { ruoli: ["Base", "Star"] });
    const burro = referenza("Burro", [presenza("ct", 1, { ruolo: "Base" })], { ruoli: ["Base"] });
    const prodotti = prodottiConfronto([latte, burro, referenza("Pasta", [presenza("st")])], griglia);
    expect(ruoliDelConfronto(prodotti)).toEqual({ ruoli: [{ ruolo: "Base", prodotti: 2 }, { ruolo: "Star", prodotti: 1 }], senzaRuolo: 1 });
    expect(ruoliDelProdotto(latte)).toEqual([{ ruolo: "Base", volantini: 2, su: 3 }, { ruolo: "Star", volantini: 1, su: 3 }]);
    // Un server che manda i ruoli del prodotto ma non quelli per volantino
    expect(ruoliDelProdotto(referenza("Olio", [presenza("ct")], { ruoli: ["Vedette"] }))).toEqual([{ ruolo: "Vedette", volantini: null, su: 1 }]);
    // Un server che non manda i ruoli
    expect(ruoliDelProdotto(referenza("Sale", [presenza("ct")]))).toEqual([]);
  });

  it("il conteggio del ruolo in vista, come Star 1/3, solo con più ruoli; la frase intera per il suggerimento", () => {
    const latte = referenza("Latte", [presenza("ct", 1, { ruolo: "Star" }), presenza("cl", 1, { ruolo: "Base" }), presenza("ot", 1, { ruolo: "Base" })], { ruoli: ["Base", "Star"] });
    const [base, star] = ruoliDelProdotto(latte) as [ReturnType<typeof ruoliDelProdotto>[number], ReturnType<typeof ruoliDelProdotto>[number]];
    expect(conteggioRuolo(star, 2)).toBe("1/3");
    expect(conteggioRuolo(base, 2)).toBe("2/3");
    expect(descrizioneRuolo(star, 2)).toBe("Star in 1 dei 3 volantini in cui compare");
    // Con un ruolo solo il ruolo vale ovunque: niente conteggio
    expect(conteggioRuolo(base, 1)).toBeNull();
    expect(descrizioneRuolo(base, 1)).toBe("Base");
    // Senza il ruolo per volantino il conteggio non si sa
    expect(conteggioRuolo({ ruolo: "Vedette", volantini: null, su: 3 }, 2)).toBeNull();
  });

  it("i filtri a faccette: i reparti seguono ruoli e testo, i ruoli seguono reparto e testo", () => {
    const tutti = ["ct", "cl", "ot", "ol", "st"];
    const LAT = { codice: "LAT", descrizione: "Latticini" };
    const DRO = { codice: "DRO", descrizione: "Drogheria" };
    const prodotti = prodottiConfronto(
      [
        referenza("Latte", tutti.map(id => presenza(id)), { reparto: LAT, ruoli: ["Star"] }),
        referenza("Burro", tutti.map(id => presenza(id)), { reparto: LAT, ruoli: ["Base"] }),
        referenza("Pasta", tutti.map(id => presenza(id)), { reparto: DRO, ruoli: ["Base"] }),
        referenza("Sale", tutti.map(id => presenza(id)), { reparto: DRO }),
      ],
      griglia
    );
    const conStar = facceConfronto(prodotti, griglia, { ...SENZA_FILTRI, ruoli: ["Star"] });
    expect(conStar.reparti.map(voce => voce.nome)).toEqual(["Latticini"]);
    // I ruoli non seguono sé stessi: scelto Star si vedono ancora tutti, con i loro conteggi
    expect(conStar.ruoli).toEqual([{ ruolo: "Base", prodotti: 2 }, { ruolo: "Star", prodotti: 1 }]);
    expect(conStar.senzaRuolo).toBe(1);
    const drogheria = facceConfronto(prodotti, griglia, { ...SENZA_FILTRI, reparto: "DRO" });
    expect(drogheria.ruoli).toEqual([{ ruolo: "Base", prodotti: 1 }]);
    expect(drogheria.senzaRuolo).toBe(1);
    expect(drogheria.reparti.map(voce => voce.nome)).toEqual(["Drogheria", "Latticini"]);
    expect(facceConfronto(prodotti, griglia, { ...SENZA_FILTRI, cerca: "pasta" }).ruoli).toEqual([{ ruolo: "Base", prodotti: 1 }]);
  });

  it("i prodotti in comune: solo quelli in tutti i volantini, prima i prezzi diversi dalla differenza più grande, poi per nome", () => {
    const tutti = ["ct", "cl", "ot", "ol", "st"];
    const prodotti = prodottiConfronto(
      [
        referenza("Zucchero", tutti.map(id => presenza(id, 1))),
        referenza("Olio", tutti.map(id => presenza(id, id === "st" ? 5.5 : 5))),
        referenza("Burro", tutti.map(id => presenza(id, id === "cl" ? 2.4 : 2))),
        referenza("Aceto", tutti.map(id => presenza(id, 1.2))),
        // In 4 volantini su 5: non è in comune, anche se ha la differenza più grande
        referenza("Caffè", ["ct", "cl", "ot", "ol"].map(id => presenza(id, id === "ct" ? 3 : 6))),
      ],
      griglia
    );
    expect(prodottiInComune(prodotti, griglia).map(p => p.referenza.nome)).toEqual(["Burro", "Olio", "Aceto", "Zucchero"]);
    expect(LIMITE_IN_COMUNE).toBe(36);
  });

  it("i filtri dei prodotti in comune: testo, reparto e ruolo, sui soli prodotti in tutti i volantini", () => {
    const tutti = ["ct", "cl", "ot", "ol", "st"];
    const LAT = { codice: "LAT", descrizione: "Latticini" };
    const prodotti = prodottiConfronto(
      [
        referenza("Latte", tutti.map(id => presenza(id)), { reparto: LAT, marca: "Granarolo", ruoli: ["Star"] }),
        referenza("Burro", tutti.map(id => presenza(id)), { reparto: LAT, ruoli: ["Base"] }),
        referenza("Pasta", tutti.map(id => presenza(id))),
        // Star e dei Latticini, ma non in comune
        referenza("Yogurt", [presenza("st")], { reparto: LAT, ruoli: ["Star"] }),
      ],
      griglia
    );
    const nomi = (filtri: Parameters<typeof prodottiInComune>[2]) => prodottiInComune(prodotti, griglia, filtri).map(p => p.referenza.nome);
    expect(nomi({ cerca: "", reparto: "LAT", ruoli: [] })).toEqual(["Burro", "Latte"]);
    expect(nomi({ cerca: "", reparto: null, ruoli: ["Star"] })).toEqual(["Latte"]);
    expect(nomi({ cerca: "", reparto: null, ruoli: ["Star", "Base"] })).toEqual(["Burro", "Latte"]);
    expect(nomi({ cerca: "granarolo", reparto: null, ruoli: [] })).toEqual(["Latte"]);
    expect(nomi({ cerca: "", reparto: SENZA_REPARTO, ruoli: [SENZA_RUOLO] })).toEqual(["Pasta"]);
    expect(nomi({ cerca: "pasta", reparto: null, ruoli: ["Star"] })).toEqual([]);
  });

  it("con un solo volantino non ci sono prodotti in comune da confrontare", () => {
    const unico = grigliaVolantini([kit("ct")]);
    const prodotti = prodottiConfronto([referenza("Pasta", [presenza("ct")])], unico);
    expect(prodottiInComune(prodotti, unico)).toEqual([]);
  });

  it("il file per Excel: punto e virgola, BOM, una colonna di prezzo per ogni volantino con la virgola decimale", () => {
    const prodotti = prodottiConfronto(
      [referenza("Latte \"intero\"", [presenza("ct", 1.19), presenza("cl", 1.29)], { marca: "Granarolo", meccaniche: ["fidelity"], ruoli: ["Star", "Base"] })],
      griglia
    );
    const [testa, riga] = csvConfronto(prodotti, griglia).split("\r\n");
    expect(testa?.startsWith("\uFEFF")).toBe(true);
    expect(testa).toContain('"Prezzo City · Lazio";"Prezzo City · Toscana";"Prezzo Conad · Lazio";"Prezzo Conad · Toscana";"Prezzo Superstore · Toscana"');
    expect(testa).toContain('"Reparto";"Ruolo";"Meccanica";"Dove";"Unità del prezzo"');
    expect(riga).toBe('"Latte ""intero""";"Granarolo";"";"";"";"";"Star, Base";"Prezzo Fidelity";"Solo City";"";"1,29";"1,19";"";"";"";"0,10";"8"');
    const etto = prodottiConfronto([referenza("Speck", [presenza("ct", 2.49, { prezzoAllEtto: true })])], griglia);
    expect(csvConfronto(etto, griglia).split("\r\n")[1]).toContain(`"Solo City · Toscana";"all'etto";`);
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
