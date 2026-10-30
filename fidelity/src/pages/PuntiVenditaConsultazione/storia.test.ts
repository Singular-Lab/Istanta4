import { describe, expect, it } from "vitest";
import {
  chiaveEvento,
  descriviEvento,
  meseAnno,
  nomePdfVolantino,
  periodoMesi,
  testoRecapito,
  testoSintesi,
  urlPdfVolantino,
} from "./storia";

// Storia nella scheda del punto vendita: testi in italiano semplice (la timeline ha i suoi in analisi.test.ts)

const rif = (id: string, nome = id) => ({ id, nome });

describe("date della storia", () => {
  it("mese e anno in italiano", () => {
    expect(meseAnno("2024-03-15")).toBe("marzo 2024");
    expect(meseAnno("non-una-data")).toBe("non-una-data");
  });

  it("dal ... al ..., con l'apostrofo davanti ai mesi che iniziano per vocale", () => {
    expect(periodoMesi("2019-03-01", "2026-10-20")).toBe("dal marzo 2019 all'ottobre 2026");
    expect(periodoMesi("2019-04-01", "2026-08-20")).toBe("dall'aprile 2019 all'agosto 2026");
    expect(periodoMesi("2024-03-01", "2024-03-28")).toBe("a marzo 2024");
  });

  it("la sintesi dice da quando a quando compare nei volantini", () => {
    expect(testoSintesi({ primoVolantino: "2019-03-01", ultimoVolantino: "2026-10-20", numeroVolantini: 120, insegne: [] }))
      .toBe("Nei volantini dal marzo 2019 all'ottobre 2026");
  });
});

describe("eventi", () => {
  it("cambi di insegna, area, indirizzo e telefono in una frase, con la data", () => {
    expect(descriviEvento({ tipo: "cambio_insegna", data: "2023-05-04", da: rif("c1", "Conad City"), a: rif("c2", "Conad Superstore") }))
      .toMatchObject({ data: "04/05/2023", titolo: "Cambio di insegna", dettaglio: "Da Conad City a Conad Superstore." });
    expect(descriviEvento({ tipo: "cambio_area", data: "2022-01-10", da: rif("a1", "Toscana"), a: rif("a2", "Liguria") }))
      .toMatchObject({ titolo: "Cambio di area", dettaglio: "Da Toscana a Liguria." });
    expect(descriviEvento({ tipo: "cambio_indirizzo", data: "2021-06-01", da: "Via Roma 1", a: "Via Verdi 3" }).dettaglio)
      .toBe("Nei volantini era «Via Roma 1», poi «Via Verdi 3».");
    expect(descriviEvento({ tipo: "cambio_telefono", data: "2021-06-01", da: "0583 111", a: "0583 222" }).dettaglio)
      .toBe("Nei volantini era 0583 111, poi 0583 222.");
  });

  it("l'assenza dice da quando e in quanti volantini manca", () => {
    expect(descriviEvento({ tipo: "assente", dal: "2026-02-01", volantiniSenza: 4 })).toMatchObject({
      data: "01/02/2026",
      titolo: "Non compare più nei volantini",
      dettaglio: "Manca negli ultimi 4 volantini della sua insegna e della sua area, che invece continuano.",
    });
  });
});

describe("chiavi degli eventi", () => {
  it("tipo, data e posizione distinguono due eventi dello stesso giorno", () => {
    const evento = { tipo: "cambio_telefono" as const, data: "2021-06-01", da: "0583 111", a: "0583 222" };
    expect(chiaveEvento(evento, 0)).toBe("cambio_telefono-2021-06-01-0");
    expect(chiaveEvento(evento, 1)).not.toBe(chiaveEvento(evento, 0));
    expect(chiaveEvento({ tipo: "assente", dal: "2026-02-01", volantiniSenza: 4 }, 2)).toBe("assente-2026-02-01-2");
  });
});

describe("recapiti e PDF", () => {
  it("il recapito stampato in una riga", () => {
    expect(testoRecapito({ indirizzo: "Via Roma 1", localita: "Lucca", telefono: "0583 111" })).toBe("Via Roma 1, Lucca · tel. 0583 111");
    expect(testoRecapito({ indirizzo: null, localita: null, telefono: null })).toBe("Senza indirizzo né telefono");
  });

  it("il PDF passa dal proxy di Olimpo e si salva sempre come .pdf", () => {
    expect(urlPdfVolantino("abc 1")).toBe("/olimpo/materiali/getMaterialePDF?id=abc%201");
    expect(nomePdfVolantino("Volantino", "Promo")).toBe("Volantino.pdf");
    expect(nomePdfVolantino(null, "Promo ottobre")).toBe("Promo ottobre.pdf");
    expect(nomePdfVolantino("vol.PDF", "Promo")).toBe("vol.PDF");
  });
});
