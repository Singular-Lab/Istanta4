import { describe, expect, it } from "vitest";
import { TINTA_NEUTRA } from "@/components/Grafici";
import type { BoxInsight, ProdottoInsight } from "../../../../lib/insightVolantino/tipi";
import {
  cercaBox,
  normalizzaRicerca,
  ordineLettura,
  perSpazio,
  ripartizionePagina,
  risultatoVicino,
  sintesiPagina,
} from "./analisiPagina";
import type { GruppoBox } from "./colori";

// L'analisi delle pagine aperte e la ricerca dei box (spec insight-volantino, "Analisi della pagina
// guardata" e "Ricerca dei box nel volantino"): solo dai box già restituiti, niente calore né vendite

type Box = Pick<BoxInsight, "id" | "nome" | "marca" | "formato" | "pagina" | "geometria" | "spazio" | "sconto" | "meccanica" | "sottocosto" | "reparto"> &
  Partial<Pick<BoxInsight, "codiceBox" | "dettaglioProdotti">>;

const prodotto = (dati: Partial<ProdottoInsight> = {}): ProdottoInsight => ({
  chiave: "c-1",
  nome: "Prodotto",
  marca: null,
  formato: null,
  gusto: null,
  codice: null,
  ean: [],
  prezzo: null,
  settore: null,
  segmento: null,
  tema: null,
  ruolo: null,
  ...dati,
});

const box = (id: string, dati: Partial<Box> = {}): Box => ({
  id,
  nome: `Prodotto ${id}`,
  marca: null,
  formato: null,
  pagina: 1,
  geometria: { x: 0.1, y: 0.1, w: 0.3, h: 0.2 },
  spazio: 10,
  sconto: null,
  meccanica: null,
  sottocosto: false,
  reparto: null,
  ...dati,
});

describe("sintesiPagina", () => {
  it("conta box, spazio occupato, sconto medio, fidelity e sottocosto della pagina", () => {
    const sintesi = sintesiPagina([
      box("a", { spazio: 30, sconto: 20, meccanica: "fidelity" }),
      box("b", { spazio: 20, sconto: 40, sottocosto: true, meccanica: "sottocosto" }),
      box("c", { spazio: 28 }),
    ]);

    expect(sintesi).toEqual({ box: 3, spazio: 78, scontoMedio: 30, fidelity: 1, sottocosto: 1 });
  });

  it("lo spazio non supera il 100% anche con riquadri sovrapposti; senza sconti lo sconto medio non c'è", () => {
    const sintesi = sintesiPagina([box("a", { spazio: 70 }), box("b", { spazio: 60 }), box("c", { spazio: Number.NaN })]);

    expect(sintesi.spazio).toBe(100);
    expect(sintesi.scontoMedio).toBeNull();
  });

  it("una pagina senza box ha tutto a zero", () => {
    expect(sintesiPagina([])).toEqual({ box: 0, spazio: 0, scontoMedio: null, fidelity: 0, sottocosto: 0 });
  });
});

describe("ripartizionePagina", () => {
  const tinta = { colore: "#000", classeTesto: "" };
  const perReparto = (voce: Box): GruppoBox =>
    voce.reparto ? { id: voce.reparto.codice, etichetta: voce.reparto.descrizione, tinta } : { id: "senza", etichetta: "Reparto non noto", tinta: TINTA_NEUTRA };

  it("raggruppa box e spazio per gruppo, dal gruppo con più spazio; i box senza il dato in fondo", () => {
    const carni = { codice: "10", descrizione: "CARNI" };
    const ortofrutta = { codice: "20", descrizione: "ORTOFRUTTA" };
    const gruppi = ripartizionePagina(
      [
        box("a", { reparto: ortofrutta, spazio: 5 }),
        box("b", { reparto: carni, spazio: 10 }),
        box("c", { spazio: 40 }),
        box("d", { reparto: carni, spazio: 12 }),
        box("e", { reparto: ortofrutta, spazio: 6 }),
        box("f", { reparto: carni, spazio: 2 }),
      ],
      perReparto
    );

    expect(gruppi.map(({ id, box: quanti, spazio }) => [id, quanti, spazio])).toEqual([
      ["10", 3, 24],
      ["20", 2, 11],
      ["senza", 1, 40],
    ]);
    expect(gruppi[0].etichetta).toBe("CARNI");
  });

  it("a parità di spazio viene prima il gruppo con più box", () => {
    const gruppi = ripartizionePagina(
      [box("a", { reparto: { codice: "1", descrizione: "A" }, spazio: 10 }), box("b", { reparto: { codice: "2", descrizione: "B" }, spazio: 5 }), box("c", { reparto: { codice: "2", descrizione: "B" }, spazio: 5 })],
      perReparto
    );

    expect(gruppi.map(gruppo => gruppo.id)).toEqual(["2", "1"]);
  });
});

describe("perSpazio", () => {
  it("dal box più grande; a parità di spazio per nome", () => {
    const ordinati = perSpazio([box("a", { spazio: 5, nome: "Zucchine" }), box("b", { spazio: 20 }), box("c", { spazio: 5, nome: "Arance" })]);

    expect(ordinati.map(voce => voce.id)).toEqual(["b", "c", "a"]);
  });
});

describe("ricerca dei box", () => {
  it("normalizza maiuscole, accenti e spazi", () => {
    expect(normalizzaRicerca("  Caffè   ESPRESSO ")).toBe("caffe espresso");
  });

  it("trova le parole cercate fra nome, marca e formato, senza badare a maiuscole e accenti", () => {
    const elenco = [
      box("a", { nome: "Caffè macinato", marca: "Lavazza", formato: "250 g" }),
      box("b", { nome: "Latte", marca: "Granarolo" }),
      box("c", { nome: "Mozzarella", marca: "GRANAROLO", formato: "125 g" }),
    ];

    expect(cercaBox(elenco, "CAFFE")?.map(voce => voce.id)).toEqual(["a"]);
    expect(cercaBox(elenco, "granarolo")?.map(voce => voce.id)).toEqual(["b", "c"]);
    expect(cercaBox(elenco, "granarolo 125")?.map(voce => voce.id)).toEqual(["c"]);
    expect(cercaBox(elenco, "biscotti")).toEqual([]);
  });

  it("trova un box dall'EAN di un suo prodotto, anche del gruppo e anche da una parte delle cifre", () => {
    const elenco = [
      box("a", { nome: "Completo letto", dettaglioProdotti: [prodotto({ ean: ["8033281161575", "8033281162091"] })] }),
      box("b", {
        nome: "Yogurt",
        dettaglioProdotti: [prodotto({ nome: "Yogurt bianco", ean: ["8000000000001"] }), prodotto({ nome: "Yogurt fragola", gusto: "Fragola", ean: ["8001420012484"] })],
      }),
    ];

    expect(cercaBox(elenco, "8033281162091")?.map(voce => voce.id)).toEqual(["a"]);
    expect(cercaBox(elenco, "12484")?.map(voce => voce.id)).toEqual(["b"]);
    expect(cercaBox(elenco, "fragola")?.map(voce => voce.id)).toEqual(["b"]);
  });

  it("trova un box dal codice referenza di un suo prodotto o dal codice box", () => {
    const elenco = [
      box("a", { codiceBox: "B-77", dettaglioProdotti: [prodotto({ codice: "7332163" })] }),
      box("b", { codiceBox: "B-12", dettaglioProdotti: [prodotto({ codice: "1234567" })] }),
    ];

    expect(cercaBox(elenco, "7332163")?.map(voce => voce.id)).toEqual(["a"]);
    expect(cercaBox(elenco, "b-12")?.map(voce => voce.id)).toEqual(["b"]);
  });

  it("sotto le due lettere non cerca", () => {
    expect(cercaBox([box("a")], " p ")).toBeNull();
    expect(cercaBox([box("a")], "")).toBeNull();
  });

  it("i box trovati sono in ordine di lettura e quelli senza pagina restano fuori", () => {
    const elenco = [
      box("basso", { nome: "Pasta", pagina: 2, geometria: { x: 0.1, y: 0.7, w: 0.2, h: 0.2 } }),
      box("destra", { nome: "Pasta", pagina: 2, geometria: { x: 0.6, y: 0.1, w: 0.2, h: 0.2 } }),
      box("sinistra", { nome: "Pasta", pagina: 2, geometria: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }),
      box("copertina", { nome: "Pasta", pagina: 1 }),
      box("senzaPosizione", { nome: "Pasta", pagina: 2, geometria: null }),
      box("senzaPagina", { nome: "Pasta", pagina: null }),
    ];

    expect(cercaBox(elenco, "pasta")?.map(voce => voce.id)).toEqual(["copertina", "sinistra", "destra", "basso", "senzaPosizione"]);
  });

  it("ordineLettura mette in fondo i box senza pagina", () => {
    expect([box("x", { pagina: null }), box("y", { pagina: 3 })].sort(ordineLettura).map(voce => voce.id)).toEqual(["y", "x"]);
  });
});

describe("risultatoVicino", () => {
  const risultati = [{ pagina: 2 }, { pagina: 4 }, { pagina: 4 }, { pagina: 9 }];

  it("senza un risultato attuale, il successivo è il primo dalla pagina guardata in avanti", () => {
    expect(risultatoVicino(risultati, -1, 1, 1)).toBe(0);
    expect(risultatoVicino(risultati, -1, 1, 4)).toBe(1);
    // Oltre l'ultimo si riparte dal primo
    expect(risultatoVicino(risultati, -1, 1, 10)).toBe(0);
  });

  it("senza un risultato attuale, il precedente è l'ultimo dalla pagina guardata indietro", () => {
    expect(risultatoVicino(risultati, -1, -1, 5)).toBe(2);
    expect(risultatoVicino(risultati, -1, -1, 1)).toBe(3);
  });

  it("da un risultato si passa al vicino, girando in tondo", () => {
    expect(risultatoVicino(risultati, 1, 1, 4)).toBe(2);
    expect(risultatoVicino(risultati, 3, 1, 9)).toBe(0);
    expect(risultatoVicino(risultati, 0, -1, 2)).toBe(3);
  });

  it("senza risultati non c'è dove andare", () => {
    expect(risultatoVicino([], -1, 1, 1)).toBe(-1);
  });
});
