import { describe, expect, it } from "vitest";
import { urlPaginaMateriale } from "@/utils/materiali";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import {
  boxPerPagina,
  LINEA_PAGINA_CORRENTE,
  MARGINE_DISEGNO,
  paginaNellImmagine,
  paginaRichiesta,
  pagineDaSfogliare,
  pagineInVista,
  proporzioneDellaPagina,
  proporzioneDelVolantino,
  PROPORZIONE_PREDEFINITA,
  riquadroBox,
  stileImmagine,
  type PosizionePagina,
} from "./geometria";

// Geometria del lettore del volantino: pagine in scorrimento, proporzioni, riquadri e abbondanza dell'immagine

const A4 = 210 / 297;

type BoxGeometria = Pick<BoxInsight, "pagina" | "geometria" | "proporzionePagina">;
const box = (pagina: number | null, dati: Partial<BoxGeometria> = {}): BoxGeometria => ({
  pagina,
  geometria: { x: 0.1, y: 0.2, w: 0.5, h: 0.25 },
  proporzionePagina: A4,
  ...dati,
});

describe("pagine in scorrimento", () => {
  /** n pagine alte 1000 px con 16 px fra l'una e l'altra, come nel lettore. */
  const colonna = (n: number): PosizionePagina[] =>
    Array.from({ length: n }, (_, indice) => ({ numero: indice + 1, inizio: indice * 1016, fine: indice * 1016 + 1000 }));

  it("la pagina corrente è quella che attraversa la linea a un terzo dall'alto del lettore", () => {
    expect(LINEA_PAGINA_CORRENTE).toBeCloseTo(0.35);
    expect(pagineInVista(colonna(24), 0, 800).corrente).toBe(1);
    // Scorrendo di 1016 px la pagina 2 è in cima
    expect(pagineInVista(colonna(24), 1016, 800).corrente).toBe(2);
    // La pagina 2 finisce a 2016: con la linea oltre, la corrente è la 3
    expect(pagineInVista(colonna(24), 2016 - 800 * LINEA_PAGINA_CORRENTE + 1, 800).corrente).toBe(3);
  });

  it("fra due pagine conta la successiva; oltre l'ultima resta l'ultima", () => {
    // Linea nello spazio fra la pagina 1 (fine 1000) e la 2 (inizio 1016)
    expect(pagineInVista(colonna(3), 1008 - 800 * LINEA_PAGINA_CORRENTE, 800).corrente).toBe(2);
    expect(pagineInVista(colonna(3), 100_000, 800).corrente).toBe(3);
  });

  it("si disegnano solo le pagine vicine alla parte visibile, non tutte", () => {
    const { vicine } = pagineInVista(colonna(24), 10 * 1016, 800);
    // Visibili da 10160 a 10960, più 1,5 altezze (1200 px) sopra e sotto: da 8960 a 12160
    expect(MARGINE_DISEGNO).toBe(1.5);
    expect([...(vicine ?? [])]).toEqual([9, 10, 11, 12]);
  });

  it("un lettore non ancora misurato (nessuna altezza) disegna tutte le pagine e non cambia la corrente", () => {
    const vuote = colonna(3).map(posizione => ({ ...posizione, inizio: 0, fine: 0 }));
    expect(pagineInVista(vuote, 0, 0)).toEqual({ corrente: null, vicine: null });
    expect(pagineInVista(colonna(3), 0, 0)).toEqual({ corrente: null, vicine: null });
  });

  it("il numero scritto per andare a una pagina resta dentro il volantino", () => {
    expect(paginaRichiesta("17", 24)).toBe(17);
    expect(paginaRichiesta(" 3 ", 24)).toBe(3);
    expect(paginaRichiesta("99", 24)).toBe(24);
    expect(paginaRichiesta("0", 24)).toBe(1);
    expect(paginaRichiesta("pagina", 24)).toBeNull();
  });

  it("le pagine da sfogliare sono quelle dichiarate, o di più se un box sta oltre", () => {
    expect(pagineDaSfogliare(8, [box(2), box(null)])).toBe(8);
    expect(pagineDaSfogliare(8, [box(10)])).toBe(10);
    expect(pagineDaSfogliare(0, [])).toBe(1);
  });
});

describe("proporzioni e riquadri dei box", () => {
  it("la proporzione del volantino è quella del primo box che la dice, altrimenti A4", () => {
    expect(proporzioneDelVolantino([box(1, { proporzionePagina: null }), box(2, { proporzionePagina: 0.75 })])).toBe(0.75);
    expect(proporzioneDelVolantino([box(1, { proporzionePagina: null })])).toBe(PROPORZIONE_PREDEFINITA);
    // Una proporzione assurda (pagina larga 0) non vale
    expect(proporzioneDelVolantino([box(1, { proporzionePagina: 0 })])).toBe(PROPORZIONE_PREDEFINITA);
  });

  it("ogni pagina prende la proporzione dei suoi box, altrimenti quella del volantino", () => {
    const voci = [box(1, { proporzionePagina: 0.7 }), box(2, { proporzionePagina: 1.4 })];
    expect(proporzioneDellaPagina(voci, 2, 0.7)).toBe(1.4);
    expect(proporzioneDellaPagina(voci, 3, 0.7)).toBe(0.7);
  });

  it("la geometria è già relativa alla pagina (Istanta e storico): il riquadro resta quello", () => {
    expect(riquadroBox({ x: 0.1, y: 0.2, w: 0.5, h: 0.25 })).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.25 });
  });

  it("un box che sborda dalla pagina si taglia al bordo; uno senza misure non si disegna", () => {
    const tagliato = riquadroBox({ x: -0.1, y: 0.9, w: 0.5, h: 0.3 })!;
    expect(tagliato.x).toBe(0);
    expect(tagliato.w).toBeCloseTo(0.4);
    expect(tagliato.y).toBe(0.9);
    expect(tagliato.h).toBeCloseTo(0.1);
    expect(riquadroBox(null)).toBeNull();
    expect(riquadroBox({ x: 0.1, y: 0.1, w: 0, h: 0.2 })).toBeNull();
    expect(riquadroBox({ x: 1.2, y: 0.1, w: 0.2, h: 0.2 })).toBeNull();
    expect(riquadroBox({ x: Number.NaN, y: 0.1, w: 0.2, h: 0.2 })).toBeNull();
  });

  it("i box si raggruppano per pagina, senza quelli che non hanno pagina o geometria", () => {
    const pagine = boxPerPagina([box(1), box(3), box(3), box(null), box(2, { geometria: null })]);
    expect([...pagine.keys()]).toEqual([1, 3]);
    expect(pagine.get(3)).toHaveLength(2);
  });
});

describe("compensazione dell'abbondanza dell'immagine della pagina", () => {
  it("immagine e pagina con la stessa proporzione: la pagina è l'immagine intera", () => {
    expect(paginaNellImmagine(1240, 1754, 1240 / 1754)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("A4 con 3 mm di abbondanza su ogni lato: la pagina rifilata sta 3 mm dentro da tutte le parti", () => {
    const pagina = paginaNellImmagine(216, 303, A4)!;
    expect(pagina.x).toBeCloseTo(3 / 216, 4);
    expect(pagina.y).toBeCloseTo(3 / 303, 4);
    expect(pagina.w).toBeCloseTo(210 / 216, 4);
    expect(pagina.h).toBeCloseTo(297 / 303, 4);
  });

  it("vale anche per una pagina orizzontale", () => {
    const pagina = paginaNellImmagine(303, 216, 297 / 210)!;
    expect(pagina.x).toBeCloseTo(3 / 303, 4);
    expect(pagina.y).toBeCloseTo(3 / 216, 4);
  });

  it("pagina quadrata e immagine più larga: margini solo ai lati, simmetrici", () => {
    const pagina = paginaNellImmagine(110, 100, 1)!;
    expect(pagina.w).toBeCloseTo(100 / 110, 6);
    expect(pagina.x).toBeCloseTo((1 - 100 / 110) / 2, 6);
    expect(pagina).toMatchObject({ y: 0, h: 1 });
  });

  it("immagine più alta della pagina in proporzione: margini solo sopra e sotto", () => {
    const pagina = paginaNellImmagine(210, 310, A4)!;
    expect(pagina).toMatchObject({ x: 0, w: 1 });
    expect(pagina.h).toBeCloseTo(210 / 310 / A4, 6);
    expect(pagina.y).toBeCloseTo((1 - 210 / 310 / A4) / 2, 6);
  });

  it("il segnaposto quadrato di Olimpo non è la pagina: pagina bianca", () => {
    expect(paginaNellImmagine(400, 400, A4)).toBeNull();
  });

  it("senza misure dell'immagine o della pagina non si allinea nulla", () => {
    expect(paginaNellImmagine(0, 300, A4)).toBeNull();
    expect(paginaNellImmagine(200, Number.NaN, A4)).toBeNull();
    expect(paginaNellImmagine(210, 297, 0)).toBeNull();
  });

  it("l'immagine si allarga e si sposta perché l'abbondanza resti fuori dalla pagina", () => {
    expect(stileImmagine({ x: 0.1, y: 0, w: 0.8, h: 1 })).toEqual({ left: "-12.5%", top: "0%", width: "125%", height: "100%" });
    expect(stileImmagine({ x: 0, y: 0, w: 1, h: 1 })).toEqual({ left: "0%", top: "0%", width: "100%", height: "100%" });
  });

  it("l'immagine di una pagina si chiede al proxy di Olimpo, pagine contate da 1", () => {
    expect(urlPaginaMateriale("abc 1", 3)).toBe("/olimpo/materiali/getThumbnailMaterialePdfs?id=abc%201&page=3");
  });
});
