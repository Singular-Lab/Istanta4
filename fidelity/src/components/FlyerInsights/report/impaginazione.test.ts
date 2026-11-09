import { describe, expect, it } from "vitest";
import type { GraficoSezione, SezioneReport } from "../../../../lib/insightVolantino/report";
import {
  altezzaRigaTabella,
  graficoGrande,
  gruppiGrafici,
  impaginaTabella,
  indicatoriPerRiga,
  larghezzeColonne,
  misuraNelRiquadro,
  righeTesto,
  spazioTabella,
} from "./impaginazione";
import { ALTEZZA_UTILE, LARGHEZZA_UTILE } from "./misure";

const barre = (titolo: string, voci: number): GraficoSezione => ({
  titolo,
  nota: null,
  grafico: {
    forma: "barre",
    unita: "percentuale",
    voci: Array.from({ length: voci }, (_, indice) => ({ etichetta: `V${indice}`, valore: indice, testo: `${indice}%`, colore: null })),
  },
});

const ciambella = (titolo: string): GraficoSezione => ({
  titolo,
  nota: null,
  grafico: { forma: "ciambella", centro: null, voci: [{ etichetta: "A", valore: 1, testo: "1", colore: null }] },
});

type Tabella = Extract<SezioneReport, { tipo: "tabella" }>;

const tabella = (righe: string[][], campi: Partial<Tabella> = {}): Tabella => ({
  tipo: "tabella",
  titolo: "Reparti",
  introduzione: null,
  colonne: [
    { titolo: "Reparto", allinea: "sinistra" },
    { titolo: "Box", allinea: "destra" },
    { titolo: "Spazio", allinea: "destra" },
  ],
  righe,
  nota: null,
  ...campi,
});

describe("testo che va a capo", () => {
  it("conta le righe andando a capo fra le parole", () => {
    // 100 pt a corpo 10: 18 caratteri per riga
    expect(righeTesto("breve", 100, 10)).toBe(1);
    expect(righeTesto("questa frase occupa piu' di una riga sola", 100, 10)).toBe(3);
    expect(righeTesto("prima\nseconda", 100, 10)).toBe(2);
  });

  it("una parola piu' lunga della riga ne occupa piu' d'una", () => {
    expect(righeTesto("x".repeat(40), 100, 10)).toBe(3);
  });
});

describe("tabelle", () => {
  it("le larghezze sommano alla larghezza utile e il testo lungo prende piu' spazio dei numeri", () => {
    const righe = [["Drogheria alimentare confezionata", "12", "18,4%"]];
    const larghezze = larghezzeColonne(tabella(righe).colonne, righe, LARGHEZZA_UTILE);
    expect(larghezze.reduce((a, b) => a + b, 0)).toBeCloseTo(LARGHEZZA_UTILE, 5);
    expect(larghezze[0]).toBeGreaterThan(larghezze[1] * 2);
  });

  it("una cella che va a capo alza la riga", () => {
    const larghezze = [80, 60];
    expect(altezzaRigaTabella(["Breve", "1"], larghezze)).toBeLessThan(altezzaRigaTabella(["Una descrizione molto lunga che va a capo", "1"], larghezze));
  });

  it("le righe si dividono in pagine secondo lo spazio, la prima pagina ne ha meno", () => {
    const altezze = Array.from({ length: 10 }, () => 20);
    expect(impaginaTabella(altezze, { primaPagina: 60, altrePagine: 100 })).toEqual([
      { inizio: 0, fine: 3 },
      { inizio: 3, fine: 8 },
      { inizio: 8, fine: 10 },
    ]);
  });

  it("una riga piu' alta della pagina sta da sola; senza righe c'e' una pagina vuota", () => {
    expect(impaginaTabella([500, 20], { primaPagina: 100, altrePagine: 100 })).toEqual([
      { inizio: 0, fine: 1 },
      { inizio: 1, fine: 2 },
    ]);
    expect(impaginaTabella([], { primaPagina: 100, altrePagine: 100 })).toEqual([{ inizio: 0, fine: 0 }]);
  });

  it("la prima pagina perde lo spazio dell'apertura della sezione e dell'introduzione", () => {
    const righe = [["Drogheria", "12", "18,4%"]];
    const larghezze = larghezzeColonne(tabella(righe).colonne, righe, LARGHEZZA_UTILE);
    const senza = spazioTabella(tabella(righe), larghezze, LARGHEZZA_UTILE);
    const con = spazioTabella(tabella(righe, { introduzione: "Quota di box e di spazio di ogni reparto nel volantino." }), larghezze, LARGHEZZA_UTILE);
    expect(senza.primaPagina).toBeLessThan(senza.altrePagine);
    expect(con.primaPagina).toBeLessThan(senza.primaPagina);
    expect(con.altrePagine).toBe(senza.altrePagine);
    expect(senza.altrePagine).toBeLessThan(ALTEZZA_UTILE);
  });

  it("100 righe di una riga sola stanno in piu' pagine, nessuna oltre lo spazio", () => {
    const righe = Array.from({ length: 100 }, (_, indice) => [`Reparto ${indice}`, String(indice), "1,0%"]);
    const larghezze = larghezzeColonne(tabella(righe).colonne, righe, LARGHEZZA_UTILE);
    const altezze = righe.map((riga) => altezzaRigaTabella(riga, larghezze));
    const spazio = spazioTabella(tabella(righe), larghezze, LARGHEZZA_UTILE);
    const pagine = impaginaTabella(altezze, spazio);
    expect(pagine.length).toBeGreaterThan(2);
    expect(pagine[pagine.length - 1].fine).toBe(100);
    pagine.forEach((pagina, indice) => {
      const occupato = altezze.slice(pagina.inizio, pagina.fine).reduce((a, b) => a + b, 0);
      expect(occupato).toBeLessThanOrEqual(indice === 0 ? spazio.primaPagina : spazio.altrePagine);
    });
  });
});

describe("grafici per pagina", () => {
  it("al massimo due grafici per pagina, nell'ordine ricevuto", () => {
    const grafici = [barre("A", 5), ciambella("B"), barre("C", 3)];
    expect(gruppiGrafici(grafici).map((gruppo) => gruppo.map((grafico) => grafico.titolo))).toEqual([["A", "B"], ["C"]]);
  });

  it("un grafico con molte voci sta da solo", () => {
    const grafici = [barre("A", 5), barre("B", 20), ciambella("C"), barre("D", 2)];
    expect(graficoGrande(grafici[1])).toBe(true);
    expect(gruppiGrafici(grafici).map((gruppo) => gruppo.map((grafico) => grafico.titolo))).toEqual([["A"], ["B"], ["C", "D"]]);
  });

  it("riquadri degli indicatori per riga", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(indicatoriPerRiga)).toEqual([1, 2, 3, 4, 3, 3, 4, 4]);
  });
});

describe("miniatura della prima pagina in copertina", () => {
  it("la pagina entra nel riquadro con le sue proporzioni", () => {
    expect(misuraNelRiquadro(0.5, 300, 400)).toEqual({ larghezza: 200, altezza: 400 });
    expect(misuraNelRiquadro(2, 300, 400)).toEqual({ larghezza: 300, altezza: 150 });
  });

  it("una proporzione non valida vale come un A4 verticale", () => {
    expect(misuraNelRiquadro(Number.NaN, 210, 400)).toEqual({ larghezza: 210, altezza: 297 });
    expect(misuraNelRiquadro(0, 210, 400)).toEqual(misuraNelRiquadro(210 / 297, 210, 400));
  });
});
