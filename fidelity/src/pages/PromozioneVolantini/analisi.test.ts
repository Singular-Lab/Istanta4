// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { KitPromozioneConsultazione, MeccanichePerCanale } from "../../../lib/consultazione/tipi";

// La pagina colora le insegne solo con i canali della promo: la rete delle insegne non serve
vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import {
  ariaSort,
  celleConPiuKit,
  conValoreScelto,
  etichettaFascia,
  fraseKit,
  chiaveCella,
  idFiltro,
  meccanicheImpilate,
  ORDINAMENTO_INIZIALE,
  ordinaKit,
  prossimoOrdinamento,
  testoQuantoManca,
  testoValidita,
  tinteCanaliPromozione,
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
