import { describe, expect, it } from "vitest";
import type { SezioneReport } from "../../../../lib/insightVolantino/report";
import { boxDiProva, reportDiProva } from "./datiDiProva";
import { datiSezionePagine, dettaglioBox, pagineDaCaricare, pagineDelReport } from "./pagineVolantino";

const sezionePagine: SezioneReport = { tipo: "pagine", titolo: "Mappa dello sconto", misura: "sconto", introduzione: null, boxInEvidenza: 5 };
const sintesi: SezioneReport = { tipo: "sintesi", titolo: "Sintesi", indicatori: [], frasi: [] };

describe("pagine del volantino nel report", () => {
  it("sono quelle dichiarate, o di piu' se un box sta oltre", () => {
    expect(pagineDelReport(reportDiProva())).toEqual([1, 2, 3]);
    expect(pagineDelReport(reportDiProva({ totalePagine: 2, box: [boxDiProva("b9", { pagina: 4 })] }))).toEqual([1, 2, 3, 4]);
  });

  it("si scaricano tutte le immagini se il report mostra le pagine, mai oltre quelle del PDF", () => {
    expect(pagineDaCaricare(reportDiProva({ sezioni: [sintesi, sezionePagine] }))).toEqual([1, 2, 3]);
    expect(pagineDaCaricare(reportDiProva({ sezioni: [sezionePagine], pdf: { idOlimpoCloud: "o1", pagine: 2 } }))).toEqual([1, 2]);
  });

  it("senza sezioni di pagine serve solo la prima, per la copertina; senza PDF nessuna", () => {
    expect(pagineDaCaricare(reportDiProva({ sezioni: [sintesi] }))).toEqual([1]);
    expect(pagineDaCaricare(reportDiProva({ sezioni: [sezionePagine], pdf: null }))).toEqual([]);
  });
});

describe("box in evidenza di una misura", () => {
  it("per ogni pagina i box con un valore, dal piu' alto, numerati da 1", () => {
    const dati = datiSezionePagine(reportDiProva(), "sconto", 5);
    expect(dati.unita).toBe("percentuale");
    expect(dati.massimo).toBe(30);
    expect(dati.migliore).toBe("b1");
    expect(dati.evidenza.get(1)?.map((voce) => [voce.numero, voce.box.id, voce.valore, voce.migliore])).toEqual([
      [1, "b1", 30, true],
      [2, "b2", 10, false],
    ]);
    expect(dati.evidenza.get(2)?.map((voce) => voce.box.id)).toEqual(["b3"]);
    // b4 non ha sconto: e' sulla pagina ma non in evidenza
    expect(dati.boxPerPagina.get(3)?.map((voce) => voce.id)).toEqual(["b4"]);
    expect(dati.evidenza.get(3)).toEqual([]);
  });

  it("al massimo boxInEvidenza per pagina; a parita' di valore prima il piu' visibile", () => {
    const report = reportDiProva({
      box: [
        boxDiProva("a", { sconto: 20, visibilita: 10 }),
        boxDiProva("b", { sconto: 20, visibilita: 90 }),
        boxDiProva("c", { sconto: 5 }),
      ],
    });
    expect(datiSezionePagine(report, "sconto", 2).evidenza.get(1)?.map((voce) => voce.box.id)).toEqual(["b", "a"]);
  });

  it("le vendite si leggono dal rendimento, nell'unita' del file", () => {
    const report = reportDiProva({
      rendimento: {
        periodo: { dal: "2026-11-03", al: "2026-11-16" },
        puntiVendita: 12,
        misura: "pezzi",
        totalePezzi: 300,
        totaleValore: null,
        perBox: [
          { idBox: "b1", pezzi: 200, valore: null, quota: 66, quotaSpazio: 30, indiceSpazio: 2.2, prodotti: 1, prodottiSenzaVendite: 0 },
          { idBox: "b3", pezzi: 100, valore: null, quota: 33, quotaSpazio: 30, indiceSpazio: 1.1, prodotti: 1, prodottiSenzaVendite: 0 },
        ],
        prodotti: 2,
        prodottiSenzaVendite: 0,
        sopraSpazio: ["b1"],
        sottoSpazio: [],
      },
    });
    const dati = datiSezionePagine(report, "vendite", 3);
    expect(dati.unita).toBe("pezzi");
    expect(dati.massimo).toBe(200);
    expect(dati.evidenza.get(2)?.map((voce) => voce.valore)).toEqual([100]);
  });

  it("senza valori positivi non c'e' un massimo ne' un migliore", () => {
    const dati = datiSezionePagine(reportDiProva({ box: [boxDiProva("x", { sconto: null })] }), "sconto", 3);
    expect(dati.massimo).toBe(0);
    expect(dati.migliore).toBeNull();
  });

  it("sotto il nome del box: marca e reparto, o il codice se mancano", () => {
    expect(dettaglioBox(boxDiProva("b1"))).toBe("Marca A · Drogheria");
    expect(dettaglioBox(boxDiProva("b1", { marca: null, reparto: null }))).toBe("Box B1");
  });
});
