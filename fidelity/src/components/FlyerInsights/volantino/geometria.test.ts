import { describe, expect, it } from "vitest";
import { urlPaginaMateriale } from "@/utils/materiali";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import {
  altezzaAdattata,
  aperturaDi,
  aperturaVicina,
  aperture,
  boxPerPagina,
  paginaNellImmagine,
  paginaRichiesta,
  pagineDaPreparare,
  pagineDaSfogliare,
  proporzioneApertura,
  proporzioneDellaPagina,
  proporzioneDelVolantino,
  PROPORZIONE_PREDEFINITA,
  proporzioneRitaglio,
  puntoNelLibro,
  riquadroBox,
  scorrimentoPerPunto,
  stileImmagine,
  stileRitaglio,
  testoApertura,
  ZOOM_LIMITE,
  ZOOM_MASSIMO_MINIMO,
  zoomDallaRotella,
  zoomLimitato,
  zoomMassimo,
  zoomVicino,
} from "./geometria";

// Geometria del lettore del volantino: pagine aperte come nel volantino stampato, proporzioni, riquadri e abbondanza dell'immagine

const A4 = 210 / 297;

type BoxGeometria = Pick<BoxInsight, "pagina" | "geometria" | "proporzionePagina">;
const box = (pagina: number | null, dati: Partial<BoxGeometria> = {}): BoxGeometria => ({
  pagina,
  geometria: { x: 0.1, y: 0.2, w: 0.5, h: 0.25 },
  proporzionePagina: A4,
  ...dati,
});

describe("pagine aperte come nel volantino stampato", () => {
  it("a doppia pagina: la copertina da sola a destra, poi le pagine a due a due, l'ultima pari da sola a sinistra", () => {
    expect(aperture(6, true).map(voce => [voce.sinistra, voce.destra])).toEqual([
      [null, 1],
      [2, 3],
      [4, 5],
      [6, null],
    ]);
    // Con un numero dispari di pagine l'ultima ha la sua compagna
    expect(aperture(5, true).map(voce => voce.pagine)).toEqual([[1], [2, 3], [4, 5]]);
  });

  it("l'apertura di una pagina è quella che la contiene, dentro il volantino", () => {
    expect(aperturaDi(17, 24, true).pagine).toEqual([16, 17]);
    expect(aperturaDi(16, 24, true).pagine).toEqual([16, 17]);
    expect(aperturaDi(1, 24, true)).toEqual({ chiave: 1, sinistra: null, destra: 1, pagine: [1] });
    expect(aperturaDi(99, 24, true).pagine).toEqual([24]);
    expect(aperturaDi(0, 24, true).pagine).toEqual([1]);
  });

  it("a pagina singola (schermi stretti) una pagina alla volta, senza lato", () => {
    expect(aperturaDi(3, 24, false)).toEqual({ chiave: 3, sinistra: null, destra: null, pagine: [3] });
    expect(aperture(3, false).map(voce => voce.pagine)).toEqual([[1], [2], [3]]);
  });

  it("l'apertura prima e dopo: girando pagina dalla copertina si apre 2-3, oltre i bordi nulla", () => {
    expect(aperturaVicina(1, 24, true, 1)?.pagine).toEqual([2, 3]);
    expect(aperturaVicina(5, 24, true, -1)?.pagine).toEqual([2, 3]);
    expect(aperturaVicina(2, 24, true, -1)?.pagine).toEqual([1]);
    expect(aperturaVicina(1, 24, true, -1)).toBeNull();
    expect(aperturaVicina(24, 24, true, 1)).toBeNull();
    expect(aperturaVicina(2, 3, false, 1)?.pagine).toEqual([3]);
  });

  it("si preparano solo le immagini delle aperture vicine, non quelle lontane", () => {
    expect(pagineDaPreparare(1, 24, true)).toEqual([2, 3]);
    expect(pagineDaPreparare(5, 24, true)).toEqual([2, 3, 6, 7]);
    expect(pagineDaPreparare(24, 24, true)).toEqual([22, 23]);
    expect(pagineDaPreparare(2, 3, false)).toEqual([1, 3]);
  });

  it("l'indicatore dice la pagina o le pagine aperte", () => {
    expect(testoApertura([1])).toBe("Pagina 1");
    expect(testoApertura([4, 5])).toBe("Pagine 4-5");
  });

  it("l'apertura tiene il posto della pagina che manca: la copertina occupa la metà destra", () => {
    const proporzione = () => A4;
    expect(proporzioneApertura(aperturaDi(1, 24, true), proporzione)).toEqual({ totale: A4 + A4, sinistra: A4 });
    expect(proporzioneApertura(aperturaDi(2, 24, true), pagina => (pagina === 2 ? 0.5 : 0.75))).toEqual({ totale: 1.25, sinistra: 0.5 });
    expect(proporzioneApertura(aperturaDi(2, 24, false), proporzione)).toEqual({ totale: A4, sinistra: 0 });
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

  it("con una misura Olimpo restituisce la pagina già ridotta, in pixel interi e mai a zero", () => {
    expect(urlPaginaMateriale("abc", 2, { larghezza: 144, altezza: 203.6 })).toBe(
      "/olimpo/materiali/getThumbnailMaterialePdfs?id=abc&page=2&width=144&height=204"
    );
    expect(urlPaginaMateriale("abc", 1, { larghezza: 0, altezza: 0.2 })).toMatch(/&width=1&height=1$/);
  });
});

describe("geometria: zoom fino alla risoluzione reale", () => {
  it("la pagina adattata al palco: il libro aperto sta nella larghezza o nell'altezza, tolti i margini", () => {
    // Palco largo e basso: comanda l'altezza (800 - 24 px), libro di due pagine A4
    expect(altezzaAdattata(1600, 800, 2 * A4)).toBeCloseTo(776, 6);
    // Palco stretto: comanda la larghezza (600 - 96 px)
    expect(altezzaAdattata(600, 800, 2 * A4)).toBeCloseTo(504 / (2 * A4), 6);
    // Senza misure (palco non ancora disegnato) nessuna altezza
    expect(altezzaAdattata(0, 0, 2 * A4)).toBe(0);
  });

  it("il massimo è quello a cui un pixel dell'immagine diventa un pixel dello schermo", () => {
    // Lo schermo dell'utente: pagina di 648 px CSS, densità 1,25, immagine di Olimpo alta 1890 pixel
    expect(zoomMassimo(1890, 648, 1.25)).toBe(2.33);
    // Un portatile a densità 1 con la pagina alta 450 px
    expect(zoomMassimo(1890, 450, 1)).toBe(4.2);
  });

  it("mai sotto il 200%, anche senza misure o con immagini piccole; mai oltre l'800%", () => {
    expect(zoomMassimo(null, 648, 1)).toBe(ZOOM_MASSIMO_MINIMO);
    expect(zoomMassimo(1890, 0, 1)).toBe(ZOOM_MASSIMO_MINIMO);
    expect(zoomMassimo(600, 648, 1)).toBe(ZOOM_MASSIMO_MINIMO);
    expect(zoomMassimo(20000, 300, 1)).toBe(ZOOM_LIMITE);
  });

  it("i passi di Ingrandisci si fermano al massimo, anche fra due livelli; Riduci torna ai livelli", () => {
    expect(zoomVicino(1, 1, 4.52)).toBe(1.25);
    expect(zoomVicino(4, 1, 4.52)).toBe(4.52);
    expect(zoomVicino(4.52, 1, 4.52)).toBe(4.52);
    expect(zoomVicino(4.52, -1, 4.52)).toBe(4);
    expect(zoomVicino(1.22, -1, 4.52)).toBe(1);
    expect(zoomVicino(0.5, -1, 4.52)).toBe(0.5);
  });

  it("Ctrl + rotella: verso l'alto ingrandisce, verso il basso riduce, sempre dentro i limiti", () => {
    expect(zoomDallaRotella(1, -100, 0, 2)).toBe(1.22);
    expect(zoomDallaRotella(1, 100, 0, 2)).toBe(0.82);
    // Le righe di Firefox valgono come 16 px
    expect(zoomDallaRotella(1, -3, 1, 2)).toBe(zoomDallaRotella(1, -48, 0, 2));
    expect(zoomDallaRotella(1.9, -200, 0, 2)).toBe(2);
    expect(zoomDallaRotella(0.6, 200, 0, 2)).toBe(0.5);
    expect(zoomLimitato(Number.NaN, 2)).toBe(1);
  });

  it("lo zoom tiene fermo il punto sotto il cursore: si scorre di quanto quel punto si è spostato", () => {
    const prima = { left: 100, top: 50, width: 800, height: 400 };
    const punto = puntoNelLibro(prima, 300, 150);
    expect(punto).toEqual({ rx: 0.25, ry: 0.25 });
    // Raddoppiato il libro (stesso angolo in alto a sinistra) il punto andrebbe a 500, 250
    const dopo = { left: 100, top: 50, width: 1600, height: 800 };
    expect(scorrimentoPerPunto(dopo, punto, 300, 150)).toEqual({ dx: 200, dy: 100 });
  });
});

describe("geometria: il box com'è stampato", () => {
  it("il ritaglio ha la proporzione del box stampato", () => {
    expect(proporzioneRitaglio({ x: 0.1, y: 0.2, w: 0.5, h: 0.25 }, A4)).toBeCloseTo((0.5 * A4) / 0.25, 6);
    // Un box che sborda si taglia al bordo della pagina
    expect(proporzioneRitaglio({ x: 0.8, y: 0, w: 0.4, h: 0.5 }, A4)).toBeCloseTo((0.2 * A4) / 0.5, 6);
    expect(proporzioneRitaglio(null, A4)).toBeNull();
    expect(proporzioneRitaglio({ x: 0, y: 0, w: 0, h: 0.5 }, A4)).toBeNull();
  });

  it("nel ritaglio la pagina è più grande e spostata: resta visibile solo il box", () => {
    expect(stileRitaglio({ x: 0.1, y: 0.2, w: 0.5, h: 0.25 })).toEqual({ left: "-20%", top: "-80%", width: "200%", height: "400%" });
  });
});
