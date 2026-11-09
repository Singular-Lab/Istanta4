// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { altezzaFoglio, tintaCategoria } from "@/components/Grafici";
import type { FlyerInsightsConfig } from "@/types/flyerInsights";
import { urlPaginaMateriale, urlPdfMateriale } from "@/utils/materiali";
import type { BoxInsight, TappaProdotto, ViaggioProdotto } from "../../../../lib/insightVolantino/tipi";
import { percorsoDettaglioVolantino } from "../../../../lib/materiali/periodi";
import { STATI_DIFFERENZA } from "../confronti/supporto";

// Il volantino sfogliabile degli insight: pagine del PDF con i riquadri dei box (kit di Istanta e
// dello storico), doppie pagine, colori, ingrandimento, scheda del box e viaggio del prodotto

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Slideover
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({
  viaggio: {} as Record<string, unknown>,
  richiesteViaggio: [] as Array<[string | undefined, string | null | undefined]>,
}));

// pdf.js non gira in jsdom: il documento e il disegno di ogni pagina li decide il test
const pdfFinto = vi.hoisted(() => ({
  documento: { stato: "errore" } as Record<string, unknown>,
  disegno: { stato: "pronta", misure: { larghezza: 216, altezza: 303 } } as Record<string, unknown>,
  aperti: [] as Array<string | null>,
  tentativi: [] as number[],
  disegnate: [] as number[],
}));

vi.mock("./pdfVolantino", () => ({
  useDocumentoPdf: (url: string | null, tentativo = 0) => {
    pdfFinto.aperti.push(url);
    pdfFinto.tentativi.push(tentativo);
    return url ? pdfFinto.documento : { stato: "assente" };
  },
  useDisegnoPdf: (documento: unknown, numero: number) => {
    if (!documento) return { stato: "caricamento" };
    pdfFinto.disegnate.push(numero);
    return pdfFinto.disegno;
  },
}));

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));
vi.mock("@/query/flyerInsights", () => ({
  useViaggioProdotto: (idKit: string | undefined, chiave: string | null | undefined) => {
    finti.richiesteViaggio.push([idKit, chiave]);
    return finti.viaggio;
  },
}));

import { paginaNellImmagine, stileImmagine, VolantinoSfogliabile, type VolantinoSfogliabileProps } from ".";

const A4 = 210 / 297;

const boxDi = (id: string, dati: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: `B${id}`,
  pagina: 1,
  geometria: { x: 0.1, y: 0.2, w: 0.5, h: 0.25 },
  spazio: 12.5,
  proporzionePagina: A4,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: null,
  formato: null,
  prezzo: null,
  barrato: null,
  sconto: null,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: null,
  meccanicaOriginale: null,
  reparto: null,
  foto: [],
  prodotti: 1,
  idReferenze: [`r-${id}`],
  ...dati,
});

const disegna = (props: Partial<VolantinoSfogliabileProps> = {}) =>
  render(
    <MemoryRouter>
      <VolantinoSfogliabile idKit="k1" pdf={null} box={[]} totalePagine={5} {...props} />
    </MemoryRouter>
  );

/** Il rettangolo del velo del box: porta posizione, misure e colore. */
const riquadro = (id: string) => screen.getByTestId(`box-${id}`).querySelector("[data-riquadro]") as SVGRectElement;
const attributo = (elemento: Element, nome: string) => Number(elemento.getAttribute(nome));
const pagina = (numero: number) => screen.getByRole("group", { name: `Pagina ${numero}` });

const caricato = (data: unknown) => ({ data, isLoading: false, isError: false, error: null, refetch: vi.fn() });

beforeEach(() => {
  finti.viaggio = caricato(undefined);
  finti.richiesteViaggio = [];
  // Di base il PDF non si legge: le immagini di Olimpo sono la riserva
  pdfFinto.documento = { stato: "errore" };
  pdfFinto.disegno = { stato: "pronta", misure: { larghezza: 216, altezza: 303 } };
  pdfFinto.aperti = [];
  pdfFinto.tentativi = [];
  pdfFinto.disegnate = [];
});

describe("VolantinoSfogliabile: geometria dei kit di Istanta e dello storico", () => {
  it("il riquadro sta dove dice la geometria, già relativa alla pagina anche sulla pagina destra", () => {
    // Istanta a destra, storico (con l'origine) a sinistra: stessa geometria, stesso posto nella pagina
    disegna({
      box: [boxDi("istanta", { pagina: 3 }), boxDi("storico", { pagina: 2, origine: "fuori_listino" })],
      pagina: 3,
    });

    const altezza = altezzaFoglio(A4);
    for (const id of ["istanta", "storico"]) {
      const rettangolo = riquadro(id);
      expect(attributo(rettangolo, "x")).toBe(100);
      expect(attributo(rettangolo, "width")).toBe(500);
      expect(attributo(rettangolo, "y")).toBeCloseTo(0.2 * altezza, 1);
      expect(attributo(rettangolo, "height")).toBeCloseTo(0.25 * altezza, 1);
    }
    expect(within(pagina(3)).getByTestId("box-istanta")).toBeInTheDocument();
    expect(within(pagina(2)).getByTestId("box-storico")).toBeInTheDocument();
  });

  it("un box senza posizione non si disegna e la pagina lo dice", () => {
    disegna({ box: [boxDi("a"), boxDi("b", { geometria: null }), boxDi("c", { pagina: null })] });

    expect(screen.getByTestId("box-a")).toBeInTheDocument();
    expect(screen.queryByTestId("box-b")).not.toBeInTheDocument();
    expect(screen.getByText(/2 box non hanno la posizione nella pagina/)).toBeInTheDocument();
  });
});

describe("VolantinoSfogliabile: lettore con tutte le pagine", () => {
  const vaiA = () => screen.getByRole("textbox", { name: "Vai alla pagina" });

  it("mostra tutte le pagine una sotto l'altra, dalla copertina all'ultima, senza doppie pagine", () => {
    disegna({ totalePagine: 5 });

    const colonna = screen.getByTestId("colonna-pagine");
    expect(within(colonna).getAllByRole("group").map(pagina => pagina.getAttribute("aria-label"))).toEqual([
      "Pagina 1",
      "Pagina 2",
      "Pagina 3",
      "Pagina 4",
      "Pagina 5",
    ]);
    expect(screen.queryByText(/Pagine 2-3|Copertina/)).not.toBeInTheDocument();
    expect(vaiA()).toHaveValue("1");
    expect(screen.getByText("di 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagina precedente" })).toBeDisabled();
  });

  it("l'indice elenca le pagine con il numero dei box, segna la corrente e porta alla pagina scelta", () => {
    disegna({ totalePagine: 5, box: [boxDi("a", { pagina: 3 }), boxDi("b", { pagina: 3 }), boxDi("c", { pagina: 1, geometria: null })] });

    const indice = screen.getByRole("navigation", { name: "Indice delle pagine" });
    expect(within(indice).getAllByRole("button")).toHaveLength(5);
    // Il box senza posizione non è disegnato e non conta
    expect(within(indice).getByRole("button", { name: "Pagina 1, 0 box" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(indice).getByRole("button", { name: "Pagina 3, 2 box" }));

    expect(within(indice).getByRole("button", { name: "Pagina 3, 2 box" })).toHaveAttribute("aria-current", "page");
    expect(vaiA()).toHaveValue("3");
  });

  it("scrivendo un numero si va alla pagina; oltre l'ultima ci si ferma all'ultima, un testo non sposta", () => {
    const onCambiaPagina = vi.fn();
    disegna({ totalePagine: 24, onCambiaPagina });

    fireEvent.change(vaiA(), { target: { value: "17" } });
    fireEvent.keyDown(vaiA(), { key: "Enter" });
    expect(onCambiaPagina).toHaveBeenLastCalledWith(17);
    expect(vaiA()).toHaveValue("17");

    fireEvent.change(vaiA(), { target: { value: "99" } });
    fireEvent.blur(vaiA());
    expect(onCambiaPagina).toHaveBeenLastCalledWith(24);
    expect(screen.getByRole("button", { name: "Pagina successiva" })).toBeDisabled();

    fireEvent.change(vaiA(), { target: { value: "copertina" } });
    fireEvent.keyDown(vaiA(), { key: "Enter" });
    expect(vaiA()).toHaveValue("24");
  });

  it("precedente e successiva scorrono di una pagina", () => {
    disegna({ totalePagine: 3 });

    fireEvent.click(screen.getByRole("button", { name: "Pagina successiva" }));
    fireEvent.click(screen.getByRole("button", { name: "Pagina successiva" }));
    expect(vaiA()).toHaveValue("3");
    fireEvent.click(screen.getByRole("button", { name: "Pagina precedente" }));
    expect(vaiA()).toHaveValue("2");
  });

  it("con la pagina controllata la segue e avvisa il genitore dei cambi, senza cambiare da sola", () => {
    const onCambiaPagina = vi.fn();
    const { rerender } = disegna({ pagina: 5, onCambiaPagina, totalePagine: 8 });

    expect(vaiA()).toHaveValue("5");
    fireEvent.click(screen.getByRole("button", { name: "Pagina precedente" }));
    expect(onCambiaPagina).toHaveBeenLastCalledWith(4);
    // La pagina la decide il genitore: finché non cambia, si resta dove si è
    expect(vaiA()).toHaveValue("5");

    rerender(
      <MemoryRouter>
        <VolantinoSfogliabile idKit="k1" pdf={null} box={[]} totalePagine={8} pagina={7} onCambiaPagina={onCambiaPagina} />
      </MemoryRouter>
    );
    expect(vaiA()).toHaveValue("7");
  });

  it("compatto non ha l'indice né lo schermo intero, ma ha la pagina e lo zoom", () => {
    disegna({ compatto: true });

    expect(screen.queryByRole("navigation", { name: "Indice delle pagine" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schermo intero" })).not.toBeInTheDocument();
    expect(vaiA()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingrandisci" })).toBeInTheDocument();
  });
});

describe("VolantinoSfogliabile: pagine dal PDF", () => {
  const PDF = { idOlimpoCloud: "olimpo-1", pagine: 5 };
  const pronto = (numPages = 5) => ({ stato: "pronto", documento: { numPages } });

  it("apre il PDF dal proxy e disegna ogni pagina dal PDF, allineata come la pagina rifilata, senza chiedere immagini", () => {
    pdfFinto.documento = pronto();
    disegna({ pdf: PDF, box: [boxDi("a")] });

    expect(pdfFinto.aperti).toContain(urlPdfMateriale("olimpo-1"));
    expect(pdfFinto.disegnate).toContain(1);
    expect(pagina(1)).toHaveAttribute("data-sorgente", "pdf");
    expect(pagina(1)).toHaveAttribute("data-immagine", "pronta");
    expect(pagina(1).querySelector("img")).toBeNull();
    const canvas = screen.getByRole("img", { name: "Pagina 1 del volantino" });
    expect(canvas.tagName).toBe("CANVAS");
    // A4 con 3 mm di abbondanza per lato: la stessa compensazione delle immagini
    const atteso = stileImmagine(paginaNellImmagine(216, 303, A4)!);
    expect(canvas.style.width).toBe(atteso.width);
    expect(canvas.style.left).toBe(atteso.left);
    expect(canvas.style.top).toBe(atteso.top);
    expect(screen.getByTestId("box-a")).toBeInTheDocument();
    expect(screen.queryByText(/Il PDF del volantino/)).not.toBeInTheDocument();
  });

  it("mentre il PDF si apre la pagina aspetta, con i riquadri già al loro posto e senza chiedere immagini", () => {
    pdfFinto.documento = { stato: "caricamento" };
    disegna({ pdf: PDF, box: [boxDi("a")] });

    expect(pagina(1)).toHaveAttribute("data-immagine", "caricamento");
    expect(pagina(1)).toHaveAttribute("data-sorgente", "nessuna");
    expect(pagina(1).querySelector("img, canvas")).toBeNull();
    expect(screen.getByTestId("box-a")).toBeInTheDocument();
  });

  it("una pagina del PDF che non si disegna usa la sua immagine di Olimpo", () => {
    pdfFinto.documento = pronto();
    pdfFinto.disegno = { stato: "errore" };
    disegna({ pdf: PDF });

    expect(pagina(1)).toHaveAttribute("data-sorgente", "immagine");
    expect(pagina(1).querySelector("img")).toHaveAttribute("src", urlPaginaMateriale("olimpo-1", 1));
  });

  it("se il browser non può far girare pdf.js le pagine e l'indice sono le miniature di Olimpo, senza Riprova", () => {
    pdfFinto.documento = { stato: "nonSupportato" };
    disegna({ pdf: PDF, box: [boxDi("a")] });

    expect(pagina(1)).toHaveAttribute("data-sorgente", "immagine");
    expect(pagina(1).querySelector("img")).toHaveAttribute("src", urlPaginaMateriale("olimpo-1", 1));
    const indice = screen.getByRole("navigation", { name: "Indice delle pagine" });
    expect(indice.querySelector("img")).toHaveAttribute("src", urlPaginaMateriale("olimpo-1", 1));
    expect(screen.getByText(/Questo browser non può disegnare il PDF del volantino/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Riprova con il PDF" })).not.toBeInTheDocument();
    expect(screen.getByTestId("box-a")).toBeInTheDocument();
  });

  it("se il PDF non si apre si può riprovare, e intanto si vedono le miniature", () => {
    pdfFinto.documento = { stato: "errore" };
    disegna({ pdf: PDF });

    expect(pagina(1)).toHaveAttribute("data-sorgente", "immagine");
    fireEvent.click(screen.getByRole("button", { name: "Riprova con il PDF" }));

    expect(pdfFinto.tentativi.at(-1)).toBe(1);
  });

  it("mentre il PDF si apre la barra lo dice", () => {
    pdfFinto.documento = { stato: "caricamento" };
    disegna({ pdf: PDF });

    expect(screen.getByRole("status")).toHaveTextContent("Apertura del PDF…");
  });

  it("le pagine oltre quelle del PDF restano bianche", () => {
    pdfFinto.documento = pronto(1);
    disegna({ pdf: { idOlimpoCloud: "olimpo-1", pagine: 1 }, pagina: 2 });

    expect(pagina(2)).toHaveAttribute("data-sorgente", "nessuna");
    expect(pagina(2)).toHaveAttribute("data-immagine", "assente");
    expect(pdfFinto.disegnate).not.toContain(2);
  });

  it("a schermo intero le pagine si disegnano anche loro dal PDF, e l'indice ha le miniature dal PDF", async () => {
    pdfFinto.documento = pronto();
    disegna({ pdf: PDF, box: [boxDi("a")] });

    fireEvent.click(screen.getByRole("button", { name: "Schermo intero" }));

    const grande = await screen.findByTestId("volantino-schermo-intero");
    expect(within(grande).getByRole("group", { name: "Pagina 1" })).toHaveAttribute("data-sorgente", "pdf");
    // Pagine e miniature dell'indice: tutte chiedono il disegno al PDF
    expect(pdfFinto.disegnate.filter(numero => numero === 5).length).toBeGreaterThanOrEqual(2);
  });
});

describe("VolantinoSfogliabile: immagini delle pagine se il PDF non si legge", () => {
  const PDF = { idOlimpoCloud: "olimpo-1", pagine: 5 };
  const immagineDi = (numero: number) => pagina(numero).querySelector("img") as HTMLImageElement;
  const misura = (immagine: HTMLImageElement, larghezza: number, altezza: number) => {
    Object.defineProperty(immagine, "naturalWidth", { configurable: true, value: larghezza });
    Object.defineProperty(immagine, "naturalHeight", { configurable: true, value: altezza });
  };

  it("ogni pagina chiede la sua immagine a Olimpo, solo quando serve; caricata, compensa l'abbondanza; la pagina lo dice", () => {
    disegna({ pdf: PDF, box: [boxDi("a")] });
    expect(screen.getByText(/Il PDF del volantino non si è potuto leggere: le pagine sono le immagini di Olimpo/)).toBeInTheDocument();

    const immagine = immagineDi(1);
    expect(immagine).toHaveAttribute("src", urlPaginaMateriale("olimpo-1", 1));
    expect(immagine).toHaveAttribute("loading", "lazy");
    expect(pagina(1)).toHaveAttribute("data-immagine", "caricamento");

    // A4 con 3 mm di abbondanza per lato
    misura(immagine, 216, 303);
    fireEvent.load(immagine);

    expect(pagina(1)).toHaveAttribute("data-immagine", "pronta");
    const atteso = stileImmagine(paginaNellImmagine(216, 303, A4)!);
    expect(immagine.style.width).toBe(atteso.width);
    expect(immagine.style.left).toBe(atteso.left);
    expect(immagine.style.top).toBe(atteso.top);
    expect(screen.getByRole("img", { name: "Pagina 1 del volantino" })).toBe(immagine);
  });

  it("se Olimpo risponde con il segnaposto quadrato, o l'immagine non arriva, la pagina resta bianca", () => {
    disegna({ pdf: PDF, pagina: 2 });

    misura(immagineDi(2), 400, 400);
    fireEvent.load(immagineDi(2));
    fireEvent.error(immagineDi(3));

    expect(pagina(2)).toHaveAttribute("data-immagine", "bianca");
    expect(pagina(3)).toHaveAttribute("data-immagine", "bianca");
    expect(immagineDi(2)).toHaveAttribute("aria-hidden", "true");
  });

  it("le pagine oltre quelle del PDF non chiedono un'immagine", () => {
    disegna({ pdf: { idOlimpoCloud: "olimpo-1", pagine: 1 }, pagina: 2 });

    expect(immagineDi(2)).toBeNull();
    expect(pagina(2)).toHaveAttribute("data-immagine", "assente");
  });

  it("senza PDF le pagine sono bianche con i riquadri al loro posto, e la pagina lo dice", () => {
    const { container } = disegna({ box: [boxDi("a")] });
    expect(pdfFinto.aperti.every(url => url === null)).toBe(true);

    expect(container.querySelector("img")).toBeNull();
    expect(pagina(1)).toHaveAttribute("data-immagine", "assente");
    expect(screen.getByTestId("box-a")).toBeInTheDocument();
    expect(screen.getByText(/Il PDF del volantino non è disponibile/)).toBeInTheDocument();
  });
});

// Mappa della config dell'installazione: un colore per codice reparto, con il nome in legenda.
// Il server riconduce già ogni referenza al codice dell'anagrafica ("1" dello storico diventa "01").
const MAPPA = {
  mappa: {
    title: "Mappa visiva",
    colorField: "reparto",
    colorStrategy: {
      type: "static",
      map: { "01": { hex: "#f97316", label: "Drogheria alimentare" } },
      default: { hex: "#64748b", label: "Altro" },
    },
    emptyState: { icon: "MapPinOff", message: "Nessuna referenza" },
  },
} as unknown as FlyerInsightsConfig;

describe("VolantinoSfogliabile: colori dei riquadri", () => {
  it("per reparto dalla config: il reparto fuori mappa prende il predefinito, la legenda dice il nome", () => {
    disegna({
      configurazione: MAPPA,
      box: [
        boxDi("r1", { reparto: { codice: "01", descrizione: "DROGHERIA ALIMENTARE" } }),
        boxDi("r2", { reparto: { codice: "99", descrizione: "VARIE" }, geometria: { x: 0.1, y: 0.6, w: 0.4, h: 0.2 } }),
      ],
    });

    expect(riquadro("r1")).toHaveAttribute("fill", "#f97316");
    expect(riquadro("r2")).toHaveAttribute("fill", "#64748b");
    const legenda = screen.getByRole("list", { name: "Reparto" });
    expect(within(legenda).getByText("Drogheria alimentare")).toBeInTheDocument();
    expect(within(legenda).getByText("Altro")).toBeInTheDocument();
    expect(within(legenda).queryByText("Latticini")).not.toBeInTheDocument();
  });

  it("per reparto senza config: palette automatica per nome", () => {
    disegna({
      box: [
        boxDi("a", { reparto: { codice: "24", descrizione: "LATTICINI" } }),
        boxDi("b", { reparto: { codice: "01", descrizione: "DROGHERIA ALIMENTARE" }, geometria: { x: 0.1, y: 0.6, w: 0.4, h: 0.2 } }),
      ],
    });

    expect(riquadro("b")).toHaveAttribute("fill", tintaCategoria(0).colore);
    expect(riquadro("a")).toHaveAttribute("fill", tintaCategoria(1).colore);
  });

  it("\"Colora per\" cambia colori e legenda: reparto, meccanica e sconto, senza visibilità né mappa di calore", () => {
    disegna({ box: [boxDi("a", { sconto: 55 })] });

    const opzioni = within(screen.getByRole("radiogroup", { name: "Colora per" })).getAllByRole("radio");
    expect(opzioni.map(opzione => opzione.textContent)).toEqual(["Reparto", "Meccanica", "Sconto"]);

    fireEvent.click(screen.getByRole("radio", { name: "Sconto" }));
    expect(within(screen.getByRole("list", { name: "Sconto" })).getByText("≥ 50%")).toBeInTheDocument();

    expect(screen.queryByRole("radio", { name: "Visibilità" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Visibilità stimata/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("calore-1")).not.toBeInTheDocument();
    expect(screen.queryByText(/Mappa di calore/)).not.toBeInTheDocument();
  });

  it("con statoBox i riquadri sono colorati per differenza e \"Colora per\" non c'è", () => {
    disegna({
      box: [boxDi("a"), boxDi("b", { geometria: { x: 0.1, y: 0.6, w: 0.4, h: 0.2 } })],
      statoBox: { a: "solo-qui", b: "uguale" },
    });

    expect(screen.queryByRole("radiogroup", { name: "Colora per" })).not.toBeInTheDocument();
    expect(riquadro("a")).toHaveClass(...(STATI_DIFFERENZA["solo-qui"].tinta.classe ?? "").split(" "));
    expect(riquadro("a")).toHaveClass("opacity-35");
    // Gli uguali restano attenuati
    expect(riquadro("b")).toHaveClass("opacity-10");
    expect(riquadro("b")).not.toHaveClass("opacity-35");
    const legenda = screen.getByRole("list", { name: "Differenze" });
    expect(within(legenda).getByText(STATI_DIFFERENZA["solo-qui"].etichetta)).toBeInTheDocument();
    expect(within(legenda).getByText(STATI_DIFFERENZA.uguale.etichetta)).toBeInTheDocument();
    expect(within(legenda).queryByText(STATI_DIFFERENZA["solo-altra"].etichetta)).not.toBeInTheDocument();
  });
});

const MOZZARELLA = boxDi("a", {
  nome: "Mozzarella",
  marca: "Granarolo",
  formato: "125 g",
  prezzo: 1.69,
  barrato: 2.49,
  sconto: 32,
  meccanica: "sconto",
  meccanicaOriginale: "TP_PERCENTO",
  reparto: { codice: "24", descrizione: "LATTICINI" },
  prodotti: 3,
});

const tappa = (idKit: string, dati: Partial<TappaProdotto> = {}): TappaProdotto => ({
  idKit,
  titolo: `Volantino ${idKit}`,
  data: "2026-10-01",
  area: "Nord",
  canale: "Super",
  prezzo: 1.69,
  barrato: 2.49,
  sconto: 32,
  sottocosto: false,
  meccanica: "sconto",
  pagina: 2,
  spazio: 12,
  questoVolantino: false,
  ...dati,
});

const viaggio = (tappe: TappaProdotto[]): ViaggioProdotto => ({ chiave: "c-a", nome: "Mozzarella", marca: "Granarolo", formato: "125 g", foto: [], tappe });

describe("VolantinoSfogliabile: scheda del box", () => {
  it("il clic su un riquadro apre la scheda con i dati del box", async () => {
    disegna({ box: [MOZZARELLA] });

    const pulsante = screen.getByRole("button", { name: "Mozzarella, Granarolo, € 1,69, sconto 32%" });
    fireEvent.click(pulsante);

    expect(await screen.findByRole("heading", { name: "Mozzarella" })).toBeInTheDocument();
    expect(pulsante).toHaveAttribute("aria-pressed", "true");
    const dati = screen.getByLabelText("Dati del box");
    expect(within(dati).getByText("Sconto in %")).toBeInTheDocument();
    expect(within(dati).getByText("TP_PERCENTO")).toBeInTheDocument();
    expect(within(dati).getByText("LATTICINI (24)")).toBeInTheDocument();
    expect(within(dati).getByText("1 di 5")).toBeInTheDocument();
    // Lo spazio arriva già in percentuale della pagina, per Istanta e per lo storico
    expect(within(dati).getByText("12,5% della pagina")).toBeInTheDocument();
    // Niente indici di visibilità stimata, vendite o previsioni
    expect(within(dati).queryByText("Visibilità stimata")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Vendite e previsione")).not.toBeInTheDocument();
    expect(screen.getByText("€ 1,69")).toBeInTheDocument();
  });

  it("Invio su un riquadro apre la scheda, come il clic", async () => {
    disegna({ box: [MOZZARELLA] });

    fireEvent.keyDown(screen.getByTestId("box-a"), { key: "Enter" });

    expect(await screen.findByRole("heading", { name: "Mozzarella" })).toBeInTheDocument();
  });

  it("il box indicato all'avvio apre la scheda e porta alla sua pagina", async () => {
    const onCambiaPagina = vi.fn();
    disegna({ box: [boxDi("x"), { ...MOZZARELLA, pagina: 4 }], idBoxIniziale: "r-a", onCambiaPagina });

    expect(await screen.findByRole("heading", { name: "Mozzarella" })).toBeInTheDocument();
    expect(onCambiaPagina).toHaveBeenCalledWith(4);
    expect(pagina(4)).toBeInTheDocument();
  });

  it("un box indicato all'avvio che non c'è non apre nulla", () => {
    disegna({ box: [MOZZARELLA], idBoxIniziale: "inesistente" });

    expect(screen.queryByRole("heading", { name: "Mozzarella" })).not.toBeInTheDocument();
    expect(pagina(1)).toBeInTheDocument();
  });
});

describe("VolantinoSfogliabile: viaggio del prodotto", () => {
  const apriViaggio = async () => {
    disegna({ box: [MOZZARELLA] });
    fireEvent.click(screen.getByTestId("box-a"));
    fireEvent.click(await screen.findByRole("button", { name: "Viaggio del prodotto" }));
  };

  it("mostra le tappe nei volantini della GDO, con il collegamento agli insight di ognuna", async () => {
    finti.viaggio = caricato(viaggio([tappa("k1", { questoVolantino: true }), tappa("k0", { data: "2026-09-01", pagina: 4, prezzo: 1.99 })]));
    await apriViaggio();

    expect(await screen.findByRole("heading", { name: "Viaggio del prodotto" })).toBeInTheDocument();
    expect(finti.richiesteViaggio).toContainEqual(["k1", "c-a"]);
    const tabella = screen.getByRole("table", { name: "Volantini in cui compare il prodotto" });
    expect(within(tabella).getAllByRole("row")).toHaveLength(3);
    expect(within(tabella).getByRole("link", { name: "Volantino k0" })).toHaveAttribute("href", percorsoDettaglioVolantino("k0", 4, "Mozzarella"));
    // Il volantino da cui si è partiti non rimanda a sé stesso
    expect(within(tabella).queryByRole("link", { name: "Volantino k1" })).not.toBeInTheDocument();
    expect(within(tabella).getByText("Questo volantino")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Prezzo del prodotto nei volantini" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Torna alla scheda" }));
    expect(await screen.findByRole("heading", { name: "Mozzarella" })).toBeInTheDocument();
  });

  it("un prodotto che compare solo in questo volantino lo dice", async () => {
    finti.viaggio = caricato(viaggio([tappa("k1", { questoVolantino: true })]));
    await apriViaggio();

    expect(await screen.findByRole("heading", { name: "Compare solo in questo volantino" })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Volantini in cui compare il prodotto" })).not.toBeInTheDocument();
  });

  it("durante il caricamento il viaggio lo dice", async () => {
    finti.viaggio = { data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() };
    await apriViaggio();
    expect(await screen.findByRole("status", { name: "Caricamento del viaggio del prodotto" })).toBeInTheDocument();
  });

  it("in errore si può riprovare", async () => {
    const refetch = vi.fn();
    finti.viaggio = { data: undefined, isLoading: false, isError: true, error: new Error("Servizio non raggiungibile"), refetch };
    await apriViaggio();

    expect(await screen.findByText("Viaggio del prodotto non caricato")).toBeInTheDocument();
    expect(screen.getByText("Servizio non raggiungibile")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Riprova/ }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe("VolantinoSfogliabile: zoom e schermo intero", () => {
  it("ingrandisce e riduce le pagine a passi, e Adatta torna alla larghezza del lettore", () => {
    disegna({ box: [boxDi("a")] });
    const colonna = screen.getByTestId("colonna-pagine");
    const larghezza = () => colonna.style.width;

    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adatta alla larghezza" })).toHaveAttribute("aria-pressed", "true");
    const adattata = larghezza();

    fireEvent.click(screen.getByRole("button", { name: "Ingrandisci" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
    // jsdom riscrive il calc senza lo spazio dopo il segno: conta il fattore
    expect(larghezza()).toMatch(/\*\s?1\.25\)$/);
    expect(screen.getByRole("button", { name: "Adatta alla larghezza" })).toHaveAttribute("aria-pressed", "false");

    for (let volta = 0; volta < 5; volta++) fireEvent.click(screen.getByRole("button", { name: "Ingrandisci" }));
    expect(screen.getByText("300%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingrandisci" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Adatta alla larghezza" }));
    expect(larghezza()).toBe(adattata);
    fireEvent.click(screen.getByRole("button", { name: "Riduci" }));
    fireEvent.click(screen.getByRole("button", { name: "Riduci" }));
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riduci" })).toBeDisabled();
    // I riquadri restano sulle pagine a ogni ingrandimento
    expect(screen.getByTestId("box-a")).toBeInTheDocument();
  });

  it("lo schermo intero apre lo stesso lettore, con indice e riquadri, e si chiude", async () => {
    disegna({ box: [boxDi("a")], totalePagine: 3 });

    fireEvent.click(screen.getByRole("button", { name: "Schermo intero" }));

    const grande = await screen.findByTestId("volantino-schermo-intero");
    expect(within(grande).getByRole("navigation", { name: "Indice delle pagine" })).toBeInTheDocument();
    expect(within(grande).getByTestId("box-a")).toBeInTheDocument();
    expect(within(grande).getAllByRole("group").filter(pagina => /^Pagina \d+$/.test(pagina.getAttribute("aria-label") ?? ""))).toHaveLength(3);

    fireEvent.click(within(grande).getByRole("button", { name: "Pagina successiva" }));
    fireEvent.click(screen.getByRole("button", { name: "Esci dallo schermo intero" }));
    await waitFor(() => expect(screen.queryByTestId("volantino-schermo-intero")).not.toBeInTheDocument());
    // Si torna al lettore della pagina sulla stessa pagina
    expect(screen.getByRole("textbox", { name: "Vai alla pagina" })).toHaveValue("2");
  });
});
