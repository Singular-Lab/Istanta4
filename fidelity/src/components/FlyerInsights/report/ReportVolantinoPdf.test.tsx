// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PALETTE_REPORT_STANDARD, type ReportVolantino, type SezioneReport } from "../../../../lib/insightVolantino/report";
import { reportDiProva } from "./datiDiProva";
import type { ImmaginiReport } from "./tipiReport";

type Figli = { children?: ReactNode };

// @react-pdf sostituito da elementi HTML semplici: si verifica cosa il documento mette e in che ordine.
// Il testo con render (numero di pagina) si rende come sulla pagina 2 di 9.
vi.mock("@react-pdf/renderer", () => ({
  Document: ({ children, title }: Figli & { title?: string }) => (
    <div data-pdf="documento" data-titolo={title}>
      {children}
    </div>
  ),
  Page: ({ children }: Figli) => <section data-pdf="pagina">{children}</section>,
  View: ({ children }: Figli) => <div>{children}</div>,
  Text: ({ children, render }: Figli & { render?: (pagina: { pageNumber: number; totalPages: number }) => ReactNode }) => (
    <span>{render ? render({ pageNumber: 2, totalPages: 9 }) : children}</span>
  ),
  Image: ({ src }: { src: string }) => <img src={src} alt="" />,
  Svg: ({ children }: Figli) => <svg>{children}</svg>,
  Path: ({ d, fill }: { d: string; fill?: string }) => <path d={d} fill={fill} />,
  Rect: ({ fill }: { fill?: string }) => <rect fill={fill} />,
  StyleSheet: { create: <T,>(stili: T) => stili },
  Font: { register: vi.fn() },
}));

import { paletteCompleta, ReportVolantinoPdf } from "./ReportVolantinoPdf";

const TITOLI = ["Sintesi del volantino", "Spazio e reparti", "Mappa dello sconto", "Dettaglio reparti", "Nota di metodo"];

const SEZIONI: SezioneReport[] = [
  {
    tipo: "sintesi",
    titolo: TITOLI[0],
    indicatori: [
      { etichetta: "Sconto medio", valore: "18,4%", dettaglio: "su 32 box", variazione: { testo: "+2,1 punti", verso: "su", positiva: true } },
      { etichetta: "Box", valore: "32", dettaglio: null, variazione: null },
    ],
    frasi: ["Il 42% dello spazio va alla Drogheria"],
  },
  {
    tipo: "grafici",
    titolo: TITOLI[1],
    introduzione: "Come si divide lo spazio del volantino.",
    grafici: [
      {
        titolo: "Spazio per reparto",
        nota: "Quota dello spazio di pagina.",
        grafico: {
          forma: "barre",
          unita: "percentuale",
          voci: [
            { etichetta: "Ortofrutta", valore: 31, testo: "31,0%", colore: null },
            { etichetta: "Freschi", valore: 12, testo: "12,0%", colore: null },
          ],
        },
      },
      {
        titolo: "Meccaniche",
        nota: null,
        grafico: {
          forma: "ciambella",
          centro: { valore: "48", etichetta: "box" },
          voci: [
            { etichetta: "Sconto", valore: 36, testo: "36 box", colore: null },
            { etichetta: "Fidelity", valore: 12, testo: "12 box", colore: null },
          ],
        },
      },
      {
        titolo: "Referenze e spazio",
        nota: null,
        grafico: {
          forma: "confronto",
          serie: ["Quota referenze", "Quota spazio"],
          unita: "percentuale",
          voci: [{ etichetta: "Ortofrutta", valori: [20, 31], testi: ["20%", "31%"] }],
        },
      },
    ],
  },
  { tipo: "pagine", titolo: TITOLI[2], misura: "sconto", introduzione: "Dove si concentra lo sconto.", boxInEvidenza: 3 },
  {
    tipo: "tabella",
    titolo: TITOLI[3],
    introduzione: null,
    colonne: [
      { titolo: "Reparto", allinea: "sinistra" },
      { titolo: "Box", allinea: "destra" },
    ],
    righe: Array.from({ length: 80 }, (_, indice) => [`Reparto ${indice}`, String(indice)]),
    nota: "Fonte: anagrafica dei reparti.",
  },
  { tipo: "metodo", titolo: TITOLI[4], paragrafi: ["Primo paragrafo del metodo.", "Secondo paragrafo del metodo."] },
];

const IMMAGINI: ImmaginiReport = {
  pagine: new Map([
    [1, "data:image/jpeg;base64,pagina1"],
    [2, null],
  ]),
  calore: new Map([[2, new Map([[1, "data:image/png;base64,calore1"]])]]),
};

const report = (campi: Partial<ReportVolantino> = {}) =>
  reportDiProva({
    intestazione: { cliente: "Conad", sottotitolo: "Ufficio marketing", logo: null, riservatezza: "Riservato - uso interno" },
    sezioni: SEZIONI,
    ...campi,
  });

const pagineDelDocumento = (contenitore: HTMLElement) => [...contenitore.querySelectorAll<HTMLElement>('[data-pdf="pagina"]')];

/** Le pagine di una sezione: hanno il suo titolo nella testata (la copertina li ha tutti nell'indice). */
const pagineDellaSezione = (contenitore: HTMLElement, titolo: string) =>
  pagineDelDocumento(contenitore)
    .slice(1)
    .filter((pagina) => pagina.textContent?.includes(titolo));

describe("documento del report PDF", () => {
  it("copertina con titolo, sottotitolo, cliente, data, prima pagina, indice e riservatezza, senza testata", () => {
    const { container } = render(<ReportVolantinoPdf report={report()} immagini={IMMAGINI} />);
    const copertina = pagineDelDocumento(container)[0];

    expect(copertina).toHaveTextContent("Volantino di novembre");
    expect(copertina).toHaveTextContent("Toscana · Conad City · dal 3 al 16 novembre 2026");
    expect(copertina).toHaveTextContent("Conad");
    expect(copertina).toHaveTextContent("Ufficio marketing");
    expect(copertina).toHaveTextContent("Generato il 9 novembre 2026");
    expect(copertina).toHaveTextContent("Riservato - uso interno");
    for (const titolo of TITOLI) expect(copertina).toHaveTextContent(titolo);
    expect(copertina.querySelector('img[src="data:image/jpeg;base64,pagina1"]')).not.toBeNull();
    expect(copertina).not.toHaveTextContent("Pagina 2 di 9");
    expect(container.querySelector('[data-pdf="documento"]')).toHaveAttribute("data-titolo", "Report volantino - Volantino di novembre");
  });

  it("con il logo la copertina mostra l'immagine del cliente", () => {
    const { container } = render(
      <ReportVolantinoPdf
        report={report({ intestazione: { cliente: "Conad", sottotitolo: null, logo: "data:image/png;base64,logo", riservatezza: "Riservato" } })}
        immagini={IMMAGINI}
      />
    );
    expect(pagineDelDocumento(container)[0].querySelector('img[src="data:image/png;base64,logo"]')).not.toBeNull();
  });

  it("le sezioni seguono l'ordine ricevuto, con testata e piè di pagina su ogni pagina", () => {
    const { container } = render(<ReportVolantinoPdf report={report()} immagini={IMMAGINI} />);
    const pagine = pagineDelDocumento(container).slice(1);

    const sequenza = pagine.map((pagina) => TITOLI.find((titolo) => pagina.textContent?.includes(titolo)));
    expect(sequenza.filter((titolo, indice) => titolo !== sequenza[indice - 1])).toEqual(TITOLI);
    for (const pagina of pagine) {
      expect(pagina).toHaveTextContent("Conad");
      expect(pagina).toHaveTextContent("· Volantino di novembre");
      expect(pagina).toHaveTextContent("Riservato - uso interno");
      expect(pagina).toHaveTextContent("Pagina 2 di 9");
    }
  });

  it("sintesi: indicatori con la variazione e frasi chiave con i numeri in grassetto", () => {
    const { container } = render(<ReportVolantinoPdf report={report()} immagini={IMMAGINI} />);
    const sintesi = pagineDelDocumento(container)[1];
    expect(sintesi).toHaveTextContent("01");
    expect(sintesi).toHaveTextContent("Sconto medio");
    expect(sintesi).toHaveTextContent("18,4%");
    expect(sintesi).toHaveTextContent("+2,1 punti");
    // Il numero e' un testo a se', con lo stile del grassetto
    expect(within(sintesi).getByText("42%").tagName).toBe("SPAN");
    expect(sintesi).toHaveTextContent("Il 42% dello spazio va alla Drogheria");
  });

  it("grafici: al massimo due per pagina, con valori, legende e note", () => {
    const { container } = render(<ReportVolantinoPdf report={report()} immagini={IMMAGINI} />);
    const grafici = pagineDellaSezione(container, TITOLI[1]);
    expect(grafici).toHaveLength(2);
    expect(grafici[0]).toHaveTextContent("Spazio per reparto");
    expect(grafici[0]).toHaveTextContent("31,0%");
    expect(grafici[0]).toHaveTextContent("Quota dello spazio di pagina.");
    expect(grafici[0]).toHaveTextContent("Meccaniche");
    expect(grafici[0]).toHaveTextContent("75%");
    expect(grafici[1]).toHaveTextContent("(segue)");
    expect(grafici[1]).toHaveTextContent("Quota referenze");
    expect(grafici[1]).toHaveTextContent("Quota spazio");
  });

  it("pagine del volantino: una per pagina, con immagine, calore, box in evidenza e scala", () => {
    const { container } = render(<ReportVolantinoPdf report={report()} immagini={IMMAGINI} />);
    const pagine = pagineDellaSezione(container, TITOLI[2]);
    expect(pagine).toHaveLength(3);

    const [prima, seconda, terza] = pagine;
    expect(prima).toHaveTextContent("Dove si concentra lo sconto.");
    expect(prima.querySelector('img[src="data:image/jpeg;base64,pagina1"]')).not.toBeNull();
    expect(prima.querySelector('img[src="data:image/png;base64,calore1"]')).not.toBeNull();
    expect(prima).toHaveTextContent("Prodotto b1");
    expect(prima).toHaveTextContent("Prodotto b2");
    expect(prima).toHaveTextContent("30%");
    expect(prima).toHaveTextContent("Il valore più alto del volantino");
    expect(prima).toHaveTextContent("Valori in percentuale; scala comune a tutte le pagine.");

    expect(seconda).toHaveTextContent("Immagine della pagina non disponibile");
    expect(seconda).toHaveTextContent("Prodotto b3");
    expect(seconda).not.toHaveTextContent("Il valore più alto del volantino");
    expect(terza).toHaveTextContent("Nessun box con un valore in questa pagina.");
  });

  it("tabella: l'intestazione si ripete su ogni pagina e la nota chiude l'ultima", () => {
    const { container } = render(<ReportVolantinoPdf report={report()} immagini={IMMAGINI} />);
    const pagine = pagineDellaSezione(container, TITOLI[3]);
    expect(pagine.length).toBeGreaterThanOrEqual(2);
    pagine.forEach((pagina, indice) => {
      expect(within(pagina).getByText("Reparto")).toBeInTheDocument();
      if (indice < pagine.length - 1) expect(pagina).toHaveTextContent("Continua nella pagina seguente");
    });
    const ultima = pagine[pagine.length - 1];
    expect(ultima).toHaveTextContent("Fonte: anagrafica dei reparti.");
    expect(ultima).toHaveTextContent("Reparto 79");
    // Ogni riga una volta sola
    const righe = pagine.flatMap((pagina) => within(pagina).queryAllByText(/^Reparto \d+$/));
    expect(righe).toHaveLength(80);
  });

  it("metodo: i paragrafi in una colonna", () => {
    const { container } = render(<ReportVolantinoPdf report={report()} immagini={IMMAGINI} />);
    const metodo = pagineDelDocumento(container).at(-1)!;
    expect(metodo).toHaveTextContent("Nota di metodo");
    expect(metodo).toHaveTextContent("Primo paragrafo del metodo.");
    expect(metodo).toHaveTextContent("Secondo paragrafo del metodo.");
  });

  it("una sezione di un tipo sconosciuto si salta", () => {
    const sezioni = [{ tipo: "futura", titolo: "Sezione futura" } as unknown as SezioneReport, SEZIONI[4]];
    const { container } = render(<ReportVolantinoPdf report={report({ sezioni })} immagini={IMMAGINI} />);
    const pagine = pagineDelDocumento(container);
    expect(pagine).toHaveLength(2);
    expect(pagine[1]).toHaveTextContent("Nota di metodo");
  });
});

describe("palette del report", () => {
  it("completa i colori mancanti con quelli standard", () => {
    const palette = paletteCompleta({ primario: "#004b87", accento: "", categorie: [], calore: ["#ffffff"] });
    expect(palette.primario).toBe("#004b87");
    expect(palette.accento).toBe(PALETTE_REPORT_STANDARD.accento);
    expect(palette.categorie).toEqual(PALETTE_REPORT_STANDARD.categorie);
    expect(palette.calore).toEqual(PALETTE_REPORT_STANDARD.calore);
    expect(paletteCompleta(null)).toEqual(PALETTE_REPORT_STANDARD);
  });
});
