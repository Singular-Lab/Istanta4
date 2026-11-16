import { describe, expect, it } from "vitest";
import { canaleArea, codiciGdo, contaPer, filtraPuntiVendita, indirizzoCompleto, valoriFormPuntoVendita } from "./puntoVendita";

describe("codiciGdo", () => {
  it("rende leggibili i codici del sistema della GDO e salta quelli vuoti", () => {
    expect(codiciGdo({ id_anacan: "004512", vuoto: " ", nullo: null })).toEqual([
      { etichetta: "ID ANACAN", valore: "004512" },
    ]);
  });

  it("senza meta non ci sono codici", () => {
    expect(codiciGdo(undefined)).toEqual([]);
  });
});

describe("indirizzoCompleto", () => {
  it("unisce via, CAP, citta e provincia", () => {
    expect(indirizzoCompleto({ indirizzo: "Via Roma 1", cap: "55100", citta: "Lucca", provincia: "LU" }))
      .toBe("Via Roma 1 - 55100 Lucca (LU)");
  });

  it("salta le parti mancanti", () => {
    expect(indirizzoCompleto({ indirizzo: "Via Roma 1", cap: "55100", citta: "Lucca" })).toBe("Via Roma 1 - 55100 Lucca");
  });
});

describe("canaleArea", () => {
  it("mostra canale e area per nome", () => {
    expect(canaleArea({ nome_canale: "Conad City", nome_area: "Toscana", sigla_combinazione: "CCTO" })).toBe("Conad City · Toscana");
  });

  it("senza nomi ripiega sulla sigla", () => {
    expect(canaleArea({ sigla_combinazione: "CCTO" })).toBe("CCTO");
  });
});

const pv = (nome: string, citta: string, id_canale: string, id_area: string, extra: { meta?: Record<string, unknown> } = {}) => ({
  nome, citta, indirizzo: "Via Roma 1", cap: "55100", id_canale, id_area,
  nome_canale: id_canale === "cc" ? "Conad City" : "Conad Superstore",
  nome_area: id_area === "to" ? "Toscana" : "Liguria",
  ...extra,
});

const elenco = [
  pv("Conad City Lucca", "Lucca", "cc", "to", { meta: { id_anacan: "004512" } }),
  pv("Conad City Pisa", "Pisa", "cc", "to"),
  pv("Conad City Sarzana", "Sarzana", "cc", "li"),
  pv("Superstore Livorno", "Livorno", "ss", "to"),
];

describe("filtraPuntiVendita", () => {
  it("cerca senza maiuscole ne accenti, anche per codice GDO", () => {
    expect(filtraPuntiVendita(elenco, { testo: "conad city LUCCA" }).map(p => p.nome)).toEqual(["Conad City Lucca"]);
    expect(filtraPuntiVendita(elenco, { testo: "004512" }).map(p => p.nome)).toEqual(["Conad City Lucca"]);
  });

  it("filtra per canale e area insieme", () => {
    expect(filtraPuntiVendita(elenco, { idCanale: "cc", idArea: "to" }).map(p => p.nome)).toEqual(["Conad City Lucca", "Conad City Pisa"]);
  });

  it("senza filtri restituisce tutto", () => {
    expect(filtraPuntiVendita(elenco, {})).toHaveLength(4);
  });
});

describe("filtraPuntiVendita su un codice della GDO", () => {
  const conCodici = [
    pv("Conad 359", "Lucca", "cc", "to", { meta: { id_anacan: "359", id_muro: "12" } }),
    pv("Conad 3590", "Pisa", "cc", "to", { meta: { id_anacan: "3590" } }),
    pv("Conad 1359", "Massa", "cc", "to", { meta: { id_anacan: "1359" } }),
    pv("Conad zeri", "Sarzana", "cc", "li", { meta: { id_anacan: "004512", id_anacan_alternativi: ["50491", "50893"] } }),
    pv("Conad 35900", "Siena", "cc", "to"),
  ];
  const nomi = (filtri: Parameters<typeof filtraPuntiVendita>[1]) => filtraPuntiVendita(conCodici, filtri).map(p => p.nome);

  it("vuole il codice intero: \"359\" non trova 3590, 1359 né il nome o il CAP che lo contengono", () => {
    expect(nomi({ testo: "359", campo: "id_anacan" })).toEqual(["Conad 359"]);
  });

  it("su tutti i campi la ricerca resta per parte del testo", () => {
    expect(nomi({ testo: "359" })).toEqual(["Conad 359", "Conad 3590", "Conad 1359", "Conad 35900"]);
  });

  it("non conta gli zeri iniziali né gli spazi intorno", () => {
    expect(nomi({ testo: " 4512 ", campo: "id_anacan" })).toEqual(["Conad zeri"]);
    expect(nomi({ testo: "004512", campo: "id_anacan" })).toEqual(["Conad zeri"]);
  });

  it("un campo con più valori si trova da ciascuno", () => {
    expect(nomi({ testo: "50893", campo: "id_anacan_alternativi" })).toEqual(["Conad zeri"]);
    expect(nomi({ testo: "5089", campo: "id_anacan_alternativi" })).toEqual([]);
  });

  it("guarda solo il campo scelto, insieme ai filtri", () => {
    expect(nomi({ testo: "12", campo: "id_anacan" })).toEqual([]);
    expect(nomi({ testo: "12", campo: "id_muro" })).toEqual(["Conad 359"]);
    expect(nomi({ testo: "4512", campo: "id_anacan", idArea: "to" })).toEqual([]);
  });

  it("senza testo il campo scelto non filtra", () => {
    expect(nomi({ testo: "", campo: "id_anacan" })).toHaveLength(5);
  });
});

describe("contaPer", () => {
  it("conta le aree dentro il canale scelto", () => {
    expect(contaPer(filtraPuntiVendita(elenco, { idCanale: "cc" }), "area")).toEqual([
      { id: "li", nome: "Liguria", totale: 1 },
      { id: "to", nome: "Toscana", totale: 2 },
    ]);
  });

  it("salta i punti vendita senza la dimensione", () => {
    expect(contaPer([{ id_canale: undefined }], "canale")).toEqual([]);
  });
});

describe("valoriFormPuntoVendita", () => {
  it("i campi facoltativi a null diventano vuoti: il form non blocca il salvataggio con 'regione cannot be null'", () => {
    const valori = valoriFormPuntoVendita({
      nome: "Conad Lucca", citta: "Lucca", indirizzo: "Via Roma 1", cap: "55100", id_combinazione_canale_area: "k1",
      has_coordinate: false, coordinate: { lat: 0, lon: 0 },
      provincia: null, regione: null, telefono: null, ragionesociale: null,
    } as any);

    expect(valori).toMatchObject({ provincia: "", regione: "", telefono: "", ragioneSociale: "", lat: undefined, lon: undefined });
  });

  it("conserva i valori presenti e le coordinate", () => {
    const valori = valoriFormPuntoVendita({
      nome: "Conad Lucca", citta: "Lucca", indirizzo: "Via Roma 1", cap: "55100", id_combinazione_canale_area: "k1",
      has_coordinate: true, coordinate: { lat: 43.8, lon: 10.5 }, provincia: "LU", regione: "Toscana", telefono: "0583 1", ragionesociale: "Srl",
    } as any);

    expect(valori).toMatchObject({ canaleArea: "k1", provincia: "LU", regione: "Toscana", ragioneSociale: "Srl", lat: 43.8, lon: 10.5 });
  });
});
