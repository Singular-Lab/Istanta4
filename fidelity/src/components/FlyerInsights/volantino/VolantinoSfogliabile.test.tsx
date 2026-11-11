// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { altezzaFoglio, tintaCategoria } from "@/components/Grafici";
import type { FlyerInsightsConfig } from "@/types/flyerInsights";
import { urlPaginaMateriale } from "@/utils/materiali";
import type { BoxInsight, ProdottoInsight, TappaProdotto, ViaggioProdotto } from "../../../../lib/insightVolantino/tipi";
import { percorsoDettaglioVolantino } from "../../../../lib/materiali/periodi";

// Il volantino degli insight da sfogliare come quello stampato: le pagine aperte con le immagini di
// Olimpo e i riquadri dei box (kit di Istanta e dello storico), giro di pagina, indice, colori,
// ingrandimento, analisi delle pagine aperte, ricerca e interrogazione dei box, scheda del box e
// viaggio del prodotto

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

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));
vi.mock("@/query/flyerInsights", () => ({
  useViaggioProdotto: (idKit: string | undefined, chiave: string | null | undefined) => {
    finti.richiesteViaggio.push([idKit, chiave]);
    return finti.viaggio;
  },
}));

import { misuraMiniatura, paginaNellImmagine, stileImmagine, VolantinoSfogliabile, type VolantinoSfogliabileProps } from ".";

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

const prodotto = (dati: Partial<ProdottoInsight> = {}): ProdottoInsight => ({
  chiave: "c-p",
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
/** Le pagine sul palco, in ordine. */
const pagineSulPalco = (contenitore: HTMLElement = screen.getByTestId("libro")) =>
  within(contenitore)
    .getAllByRole("group")
    .map(gruppo => gruppo.getAttribute("aria-label"))
    .filter(nome => /^Pagina \d+$/.test(nome ?? ""));
const aperte = () => screen.getByTestId("pagine-aperte");
const vaiA = () => screen.getByRole("textbox", { name: "Vai alla pagina" });
const avanti = () => fireEvent.click(screen.getByRole("button", { name: "Gira avanti" }));

const caricato = (data: unknown) => ({ data, isLoading: false, isError: false, error: null, refetch: vi.fn() });

beforeEach(() => {
  finti.viaggio = caricato(undefined);
  finti.richiesteViaggio = [];
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

describe("VolantinoSfogliabile: sfogliare come il volantino stampato", () => {
  it("apre la copertina da sola, poi le pagine a due a due; i comandi si fermano ai bordi", () => {
    disegna({ totalePagine: 5 });

    expect(pagineSulPalco()).toEqual(["Pagina 1"]);
    expect(aperte()).toHaveTextContent("Pagina 1 di 5");
    expect(screen.getByRole("button", { name: "Gira indietro" })).toBeDisabled();

    avanti();
    expect(pagineSulPalco()).toEqual(["Pagina 2", "Pagina 3"]);
    expect(aperte()).toHaveTextContent("Pagine 2-3 di 5");

    avanti();
    expect(pagineSulPalco()).toEqual(["Pagina 4", "Pagina 5"]);
    expect(screen.getByRole("button", { name: "Gira avanti" })).toBeDisabled();
    // Niente più pagine una sotto l'altra
    expect(screen.queryByTestId("colonna-pagine")).not.toBeInTheDocument();
  });

  it("l'ultima pagina pari senza compagna sta da sola", () => {
    disegna({ totalePagine: 6, pagina: 6 });

    expect(pagineSulPalco()).toEqual(["Pagina 6"]);
    expect(aperte()).toHaveTextContent("Pagina 6 di 6");
  });

  it("le frecce della tastiera, gli angoli delle pagine e le frecce ai lati girano pagina; Home e Fine vanno ai bordi", () => {
    disegna({ totalePagine: 8 });
    const palco = screen.getByTestId("lettore-pagine");

    fireEvent.keyDown(palco, { key: "ArrowRight" });
    expect(aperte()).toHaveTextContent("Pagine 2-3");
    fireEvent.click(screen.getByTestId("angolo-avanti"));
    expect(aperte()).toHaveTextContent("Pagine 4-5");
    fireEvent.click(screen.getByTestId("freccia-avanti"));
    expect(aperte()).toHaveTextContent("Pagine 6-7");
    fireEvent.keyDown(palco, { key: "ArrowLeft" });
    expect(aperte()).toHaveTextContent("Pagine 4-5");
    fireEvent.click(screen.getByTestId("angolo-indietro"));
    expect(aperte()).toHaveTextContent("Pagine 2-3");
    fireEvent.keyDown(palco, { key: "End" });
    expect(aperte()).toHaveTextContent("Pagina 8");
    fireEvent.keyDown(palco, { key: "Home" });
    expect(aperte()).toHaveTextContent("Pagina 1");
    // In copertina non c'è un angolo per girare indietro
    expect(screen.queryByTestId("angolo-indietro")).not.toBeInTheDocument();
  });

  it("trascinando in orizzontale si gira pagina, e il trascinamento non apre il box sotto il puntatore", () => {
    disegna({ totalePagine: 5, box: [boxDi("a")] });
    const palco = screen.getByTestId("lettore-pagine");

    fireEvent.pointerDown(palco, { button: 0, clientX: 400, clientY: 200, pointerType: "touch" });
    fireEvent.pointerMove(palco, { clientX: 250, clientY: 205, pointerType: "touch" });
    fireEvent.pointerUp(palco, { clientX: 250, clientY: 205, pointerType: "touch" });
    expect(aperte()).toHaveTextContent("Pagine 2-3");

    fireEvent.pointerDown(palco, { button: 0, clientX: 200, clientY: 200, pointerType: "touch" });
    fireEvent.pointerMove(palco, { clientX: 320, clientY: 200, pointerType: "touch" });
    fireEvent.pointerUp(palco, { clientX: 320, clientY: 200, pointerType: "touch" });
    expect(aperte()).toHaveTextContent("Pagina 1");

    // Un trascinamento che finisce su un box non lo apre
    fireEvent.pointerDown(screen.getByTestId("box-a"), { button: 0, clientX: 100, clientY: 100, pointerType: "mouse" });
    fireEvent.pointerMove(palco, { clientX: 100, clientY: 160, pointerType: "mouse" });
    fireEvent.pointerUp(screen.getByTestId("box-a"), { clientX: 100, clientY: 160, pointerType: "mouse" });
    fireEvent.click(screen.getByTestId("box-a"));
    expect(screen.queryByRole("heading", { name: "Prodotto a" })).not.toBeInTheDocument();
  });

  it("l'indice raggruppa le pagine come si aprono, segna quelle aperte e apre la pagina scelta", () => {
    disegna({ totalePagine: 5, box: [boxDi("a", { pagina: 3 }), boxDi("b", { pagina: 3 }), boxDi("c", { pagina: 1, geometria: null })] });

    const indice = screen.getByRole("navigation", { name: "Indice delle pagine" });
    expect(within(indice).getAllByRole("listitem").map(voce => voce.getAttribute("aria-label"))).toEqual(["Pagina 1", "Pagine 2-3", "Pagine 4-5"]);
    expect(within(indice).getAllByRole("button")).toHaveLength(5);
    // Il box senza posizione non è disegnato e non conta
    expect(within(indice).getByRole("button", { name: "Pagina 1, 0 box" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(indice).getByRole("button", { name: "Pagina 3, 2 box" }));

    expect(within(indice).getByRole("button", { name: "Pagina 3, 2 box" })).toHaveAttribute("aria-current", "page");
    expect(within(indice).getByRole("button", { name: "Pagina 2, 0 box" })).toHaveAttribute("aria-current", "page");
    expect(within(indice).getByRole("button", { name: "Pagina 1, 0 box" })).not.toHaveAttribute("aria-current");
    expect(aperte()).toHaveTextContent("Pagine 2-3");
  });

  it("scrivendo un numero si aprono le pagine che lo contengono; oltre l'ultima ci si ferma all'ultima, un testo non sposta", () => {
    const onCambiaPagina = vi.fn();
    disegna({ totalePagine: 24, onCambiaPagina });

    fireEvent.change(vaiA(), { target: { value: "17" } });
    fireEvent.keyDown(vaiA(), { key: "Enter" });
    expect(onCambiaPagina).toHaveBeenLastCalledWith(17);
    expect(aperte()).toHaveTextContent("Pagine 16-17 di 24");
    expect(vaiA()).toHaveValue("");

    fireEvent.change(vaiA(), { target: { value: "99" } });
    fireEvent.blur(vaiA());
    expect(onCambiaPagina).toHaveBeenLastCalledWith(24);
    expect(aperte()).toHaveTextContent("Pagina 24 di 24");
    expect(screen.getByRole("button", { name: "Gira avanti" })).toBeDisabled();

    fireEvent.change(vaiA(), { target: { value: "copertina" } });
    fireEvent.keyDown(vaiA(), { key: "Enter" });
    expect(aperte()).toHaveTextContent("Pagina 24 di 24");
  });

  it("con la pagina controllata la segue e avvisa il genitore dei giri, senza girare da sola", () => {
    const onCambiaPagina = vi.fn();
    const { rerender } = disegna({ pagina: 5, onCambiaPagina, totalePagine: 8 });

    expect(aperte()).toHaveTextContent("Pagine 4-5");
    fireEvent.click(screen.getByRole("button", { name: "Gira indietro" }));
    expect(onCambiaPagina).toHaveBeenLastCalledWith(2);
    // La pagina la decide il genitore: finché non cambia, si resta dove si è
    expect(aperte()).toHaveTextContent("Pagine 4-5");

    rerender(
      <MemoryRouter>
        <VolantinoSfogliabile idKit="k1" pdf={null} box={[]} totalePagine={8} pagina={7} onCambiaPagina={onCambiaPagina} />
      </MemoryRouter>
    );
    expect(aperte()).toHaveTextContent("Pagine 6-7");
  });

  it("su uno schermo stretto una pagina alla volta", () => {
    const originale = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      disegna({ totalePagine: 5 });

      expect(pagineSulPalco()).toEqual(["Pagina 1"]);
      avanti();
      // La pagina 2 da sola, non accanto alla 3
      expect(pagineSulPalco()).toEqual(["Pagina 2"]);
      avanti();
      expect(pagineSulPalco()).toEqual(["Pagina 3"]);
      expect(aperte()).toHaveTextContent("Pagina 3 di 5");
    } finally {
      window.matchMedia = originale;
    }
  });

  it("il palco non è più alto di due terzi dello schermo, con l'indice sotto e lo schermo intero", () => {
    disegna();

    expect(screen.getByTestId("lettore-pagine").parentElement).toHaveClass("h-[min(66vh,44rem)]", "min-h-[24rem]");
    expect(screen.getByRole("navigation", { name: "Indice delle pagine" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schermo intero" })).toBeInTheDocument();
  });
});

describe("VolantinoSfogliabile: pagine dalle immagini di Olimpo", () => {
  const PDF = { idOlimpoCloud: "olimpo-1", pagine: 5 };
  const immagineDi = (numero: number) => pagina(numero).querySelector("img") as HTMLImageElement;
  const misura = (immagine: HTMLImageElement, larghezza: number, altezza: number) => {
    Object.defineProperty(immagine, "naturalWidth", { configurable: true, value: larghezza });
    Object.defineProperty(immagine, "naturalHeight", { configurable: true, value: altezza });
  };

  it("ogni pagina chiede la sua immagine a Olimpo, solo quando serve; caricata, compensa l'abbondanza", () => {
    const { container } = disegna({ pdf: PDF, box: [boxDi("a")] });

    const immagine = immagineDi(1);
    expect(immagine).toHaveAttribute("src", urlPaginaMateriale("olimpo-1", 1));
    expect(immagine).toHaveAttribute("loading", "lazy");
    expect(pagina(1)).toHaveAttribute("data-immagine", "caricamento");
    // Nessun PDF scaricato né disegnato: solo immagini
    expect(container.querySelector("canvas")).toBeNull();
    expect([...container.querySelectorAll("img")].some(img => img.getAttribute("src")?.includes("getMaterialePDF"))).toBe(false);

    // A4 con 3 mm di abbondanza per lato
    misura(immagine, 216, 303);
    fireEvent.load(immagine);

    expect(pagina(1)).toHaveAttribute("data-immagine", "pronta");
    const atteso = stileImmagine(paginaNellImmagine(216, 303, A4)!);
    expect(immagine.style.width).toBe(atteso.width);
    expect(immagine.style.left).toBe(atteso.left);
    expect(immagine.style.top).toBe(atteso.top);
    expect(screen.getByRole("img", { name: "Pagina 1 del volantino" })).toBe(immagine);
    expect(screen.getByTestId("box-a")).toBeInTheDocument();
    expect(screen.queryByText(/Il PDF del volantino/)).not.toBeInTheDocument();
  });

  it("l'indice chiede a Olimpo le miniature già ridotte, non l'immagine intera", () => {
    disegna({ pdf: PDF, box: [boxDi("a")] });

    const indice = screen.getByRole("navigation", { name: "Indice delle pagine" });
    const miniatura = indice.querySelector("img");
    expect(miniatura).toHaveAttribute("src", urlPaginaMateriale("olimpo-1", 1, misuraMiniatura(A4)));
    expect(miniatura?.getAttribute("src")).toMatch(/&width=104&height=\d+$/);
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

  it("sul palco solo le pagine aperte; si preparano le immagini delle pagine subito prima e subito dopo, non le lontane", () => {
    disegna({ pdf: { idOlimpoCloud: "olimpo-1", pagine: 12 }, totalePagine: 12, pagina: 5 });

    expect(pagineSulPalco()).toEqual(["Pagina 4", "Pagina 5"]);
    const pronte = [...screen.getByTestId("pagine-pronte").querySelectorAll("img")].map(img => img.getAttribute("src"));
    expect(pronte).toEqual([2, 3, 6, 7].map(numero => urlPaginaMateriale("olimpo-1", numero)));
    expect(screen.queryByRole("group", { name: "Pagina 9" })).not.toBeInTheDocument();
  });

  it("le pagine oltre quelle del PDF non chiedono un'immagine", () => {
    disegna({ pdf: { idOlimpoCloud: "olimpo-1", pagine: 1 }, pagina: 2 });

    expect(immagineDi(2)).toBeNull();
    expect(pagina(2)).toHaveAttribute("data-immagine", "assente");
  });

  it("senza PDF le pagine sono bianche con i riquadri al loro posto, e la pagina lo dice", () => {
    const { container } = disegna({ box: [boxDi("a")] });

    expect(container.querySelector("img")).toBeNull();
    expect(pagina(1)).toHaveAttribute("data-immagine", "assente");
    expect(screen.getByTestId("box-a")).toBeInTheDocument();
    expect(screen.getByText(/Il PDF del volantino non è disponibile/)).toBeInTheDocument();
  });

  it("a schermo intero le pagine sono le stesse immagini", async () => {
    disegna({ pdf: PDF, box: [boxDi("a")] });

    fireEvent.click(screen.getByRole("button", { name: "Schermo intero" }));

    const grande = await screen.findByTestId("volantino-schermo-intero");
    expect(within(grande).getByRole("group", { name: "Pagina 1" }).querySelector("img")).toHaveAttribute("src", urlPaginaMateriale("olimpo-1", 1));
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

  it("un reparto con il colore per il marketing della GDO colora il riquadro con quello e la legenda dice il suo nome", () => {
    disegna({ box: [boxDi("a", { reparto: { codice: "24", descrizione: "Freschissimi", colore: "#0ea5e9" } })] });

    expect(riquadro("a")).toHaveAttribute("fill", "#0ea5e9");
    expect(within(screen.getByRole("list", { name: "Reparto" })).getByText("Freschissimi")).toBeInTheDocument();
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
    // Il prezzo è anche nell'elenco dell'analisi della pagina: qui conta quello della scheda
    expect(within(screen.getByRole("dialog")).getByText("€ 1,69")).toBeInTheDocument();
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

  it("un box chiesto da fuori apre la sua scheda e porta alla sua pagina, a ogni nuova richiesta", async () => {
    const onCambiaPagina = vi.fn();
    const props = { idKit: "k1", pdf: null, totalePagine: 5, box: [boxDi("x"), { ...MOZZARELLA, pagina: 3 }], onCambiaPagina };
    const { rerender } = render(
      <MemoryRouter>
        <VolantinoSfogliabile {...props} apriBox={{ id: "a", volta: 1 }} />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Mozzarella" })).toBeInTheDocument();
    expect(onCambiaPagina).toHaveBeenLastCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: "Chiudi la scheda" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Mozzarella" })).not.toBeInTheDocument());
    onCambiaPagina.mockClear();

    // Lo stesso box chiesto di nuovo si riapre
    rerender(
      <MemoryRouter>
        <VolantinoSfogliabile {...props} apriBox={{ id: "a", volta: 2 }} />
      </MemoryRouter>
    );
    expect(await screen.findByRole("heading", { name: "Mozzarella" })).toBeInTheDocument();
    expect(onCambiaPagina).toHaveBeenLastCalledWith(3);
  });

  it("la scheda mostra la linea del distributore quando il box ne ha una", async () => {
    disegna({ box: [{ ...MOZZARELLA, linea: { sigla: "SD", nome: "Sapori & Dintorni" } }] });

    fireEvent.click(screen.getByTestId("box-a"));
    const dati = await screen.findByLabelText("Dati del box");
    expect(within(dati).getByText("Linea")).toBeInTheDocument();
    expect(within(dati).getByText("Sapori & Dintorni")).toBeInTheDocument();
  });

  it("la scheda elenca i prodotti del box con codice, EAN, settore, tema e ruolo", async () => {
    disegna({
      box: [
        {
          ...MOZZARELLA,
          dettaglioProdotti: [
            prodotto({ chiave: "c-1", nome: "Mozzarella", codice: "7332163", ean: ["8033281161575", "8033281162091"], settore: "Latticini", tema: "MBIS", ruolo: "Star" }),
            prodotto({ chiave: "c-2", nome: "Mozzarella light", gusto: "Light", codice: "7332164" }),
          ],
        },
      ],
    });

    fireEvent.click(screen.getByTestId("box-a"));
    const prodotti = await screen.findByRole("region", { name: "Prodotti del box" });
    const voci = within(prodotti).getAllByRole("listitem");
    expect(voci).toHaveLength(2);
    expect(voci[0]).toHaveTextContent("7332163");
    expect(voci[0]).toHaveTextContent("8033281161575");
    expect(voci[0]).toHaveTextContent("8033281162091");
    expect(voci[0]).toHaveTextContent("Latticini");
    expect(voci[0]).toHaveTextContent("MBIS");
    expect(voci[0]).toHaveTextContent("Star");
    expect(voci[1]).toHaveTextContent("Light");
    expect(within(voci[1]).queryByText("EAN")).not.toBeInTheDocument();
  });

  it("senza i prodotti del box (server non aggiornato) la scheda non ha la sezione dei prodotti", async () => {
    disegna({ box: [MOZZARELLA] });

    fireEvent.click(screen.getByTestId("box-a"));
    await screen.findByLabelText("Dati del box");
    expect(screen.queryByRole("region", { name: "Prodotti del box" })).not.toBeInTheDocument();
  });

  it("senza linea la scheda non ha la riga della linea", async () => {
    disegna({ box: [MOZZARELLA] });

    fireEvent.click(screen.getByTestId("box-a"));
    expect(within(await screen.findByLabelText("Dati del box")).queryByText("Linea")).not.toBeInTheDocument();
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
  it("ingrandisce e riduce le pagine a passi, e Adatta torna allo spazio del palco", () => {
    disegna({ box: [boxDi("a")] });
    const libro = () => screen.getByTestId("libro");

    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adatta allo spazio" })).toHaveAttribute("aria-pressed", "true");
    expect(libro()).toHaveAttribute("data-zoom", "1");

    fireEvent.click(screen.getByRole("button", { name: "Ingrandisci" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
    expect(libro()).toHaveAttribute("data-zoom", "1.25");
    expect(screen.getByRole("button", { name: "Adatta allo spazio" })).toHaveAttribute("aria-pressed", "false");

    // Le immagini di Olimpo sono a 150 dpi: lo zoom si ferma al 200%
    for (let volta = 0; volta < 5; volta++) fireEvent.click(screen.getByRole("button", { name: "Ingrandisci" }));
    expect(screen.getByText("200%")).toBeInTheDocument();
    expect(screen.queryByText("300%")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingrandisci" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Adatta allo spazio" }));
    expect(libro()).toHaveAttribute("data-zoom", "1");
    fireEvent.click(screen.getByRole("button", { name: "Riduci" }));
    fireEvent.click(screen.getByRole("button", { name: "Riduci" }));
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riduci" })).toBeDisabled();
    // I riquadri restano sulle pagine a ogni ingrandimento
    expect(screen.getByTestId("box-a")).toBeInTheDocument();
  });

  it("con le pagine ingrandite il trascinamento sposta la vista e non gira pagina", () => {
    disegna({ totalePagine: 5 });
    fireEvent.click(screen.getByRole("button", { name: "Ingrandisci" }));
    const palco = screen.getByTestId("lettore-pagine");

    fireEvent.pointerDown(palco, { button: 0, clientX: 400, clientY: 200, pointerType: "mouse" });
    fireEvent.pointerMove(palco, { clientX: 250, clientY: 200, pointerType: "mouse" });
    fireEvent.pointerUp(palco, { clientX: 250, clientY: 200, pointerType: "mouse" });

    expect(aperte()).toHaveTextContent("Pagina 1");
  });

  it("lo schermo intero apre lo stesso lettore, con indice e riquadri, e si chiude", async () => {
    disegna({ box: [boxDi("a")], totalePagine: 3 });

    fireEvent.click(screen.getByRole("button", { name: "Schermo intero" }));

    const grande = await screen.findByTestId("volantino-schermo-intero");
    expect(within(grande).getByRole("navigation", { name: "Indice delle pagine" })).toBeInTheDocument();
    expect(within(grande).getByTestId("box-a")).toBeInTheDocument();
    expect(pagineSulPalco(within(grande).getByTestId("libro"))).toEqual(["Pagina 1"]);

    fireEvent.click(within(grande).getByRole("button", { name: "Gira avanti" }));
    fireEvent.click(screen.getByRole("button", { name: "Esci dallo schermo intero" }));
    await waitFor(() => expect(screen.queryByTestId("volantino-schermo-intero")).not.toBeInTheDocument());
    // Si torna al lettore della pagina sulle stesse pagine
    expect(aperte()).toHaveTextContent("Pagine 2-3");
  });
});

describe("VolantinoSfogliabile: analisi delle pagine aperte", () => {
  const LATTICINI = { codice: "24", descrizione: "LATTICINI" };
  const CARNI = { codice: "10", descrizione: "CARNI" };
  const BOX = [
    boxDi("a", { nome: "Mozzarella", reparto: LATTICINI, spazio: 30, sconto: 20, meccanica: "fidelity" }),
    boxDi("b", { nome: "Yogurt", reparto: LATTICINI, spazio: 20, sconto: 40, sottocosto: true, geometria: { x: 0.1, y: 0.6, w: 0.4, h: 0.2 } }),
    boxDi("c", { nome: "Bistecca", reparto: CARNI, pagina: 2, spazio: 45 }),
  ];
  const pannello = () => screen.getByRole("complementary", { name: "Analisi della pagina" });
  const numero = (etichetta: string) => within(pannello()).getByText(etichetta).closest("div");

  it("segue le pagine aperte: numeri ed elenco dei box dal più grande", () => {
    disegna({ box: BOX, totalePagine: 3 });

    expect(within(pannello()).getByRole("heading", { name: "Pagina 1" })).toBeInTheDocument();
    expect(numero("Box")).toHaveTextContent("2");
    expect(numero("Spazio")).toHaveTextContent("50%");
    expect(numero("Sconto medio")).toHaveTextContent("30%");
    expect(numero("Fidelity")).toHaveTextContent("1");
    expect(numero("Sottocosto")).toHaveTextContent("1");
    const righe = within(within(pannello()).getByRole("region", { name: "Box della pagina" })).getAllByRole("button");
    expect(righe.map(riga => riga.getAttribute("data-testid"))).toEqual(["riga-box-a", "riga-box-b"]);

    avanti();

    expect(within(pannello()).getByRole("heading", { name: "Pagine 2-3" })).toBeInTheDocument();
    expect(numero("Box")).toHaveTextContent("1");
    expect(within(pannello()).getByTestId("riga-box-c")).toHaveTextContent("Bistecca");
  });

  it("la ripartizione segue \"Colora per\"", () => {
    disegna({ box: BOX });

    expect(within(pannello()).getByRole("region", { name: "Per reparto" })).toHaveTextContent("LATTICINI2 box50%");
    fireEvent.click(screen.getByRole("radio", { name: "Meccanica" }));

    const perMeccanica = within(pannello()).getByRole("region", { name: "Per meccanica" });
    expect(within(perMeccanica).getByTestId("gruppo-fidelity")).toHaveTextContent("Prezzo Fidelity1 box30%");
    expect(within(perMeccanica).getByTestId("gruppo-senza")).toHaveTextContent("Non riconosciuta1 box20%");
  });

  it("passando su un box dell'elenco il suo riquadro è in rilievo; scegliendolo si apre la scheda", async () => {
    disegna({ box: BOX });

    fireEvent.mouseEnter(screen.getByTestId("riga-box-b"));
    expect(screen.getByTestId("box-b")).toHaveAttribute("data-rilievo");
    expect(screen.getByTestId("box-a")).not.toHaveAttribute("data-rilievo");
    fireEvent.mouseLeave(screen.getByTestId("riga-box-b"));
    expect(screen.getByTestId("box-b")).not.toHaveAttribute("data-rilievo");

    fireEvent.click(screen.getByTestId("riga-box-b"));
    expect(await screen.findByRole("heading", { name: "Yogurt" })).toBeInTheDocument();
    expect(screen.getByTestId("box-b")).toHaveAttribute("aria-pressed", "true");
  });

  it("una pagina senza box lo dice", () => {
    disegna({ box: BOX, totalePagine: 4, pagina: 4 });

    expect(within(pannello()).getByText("Nessun box in questa pagina.")).toBeInTheDocument();
  });

});

describe("VolantinoSfogliabile: ricerca dei box", () => {
  const BOX = [
    boxDi("latte", { nome: "Latte intero", marca: "Granarolo", pagina: 2 }),
    boxDi("mozzarella", { nome: "Mozzarella", marca: "GRANAROLO", formato: "125 g", pagina: 4 }),
    boxDi("yogurt", { nome: "Yogurt", marca: "Granarolo", pagina: 4, geometria: { x: 0.1, y: 0.6, w: 0.4, h: 0.2 } }),
    boxDi("caffe", { nome: "Caffè macinato", marca: "Lavazza", pagina: 1 }),
    boxDi("pasta", { nome: "Pasta", marca: "Barilla", pagina: 2, geometria: { x: 0.1, y: 0.6, w: 0.4, h: 0.2 } }),
  ];
  const campo = () => screen.getByRole("searchbox", { name: "Cerca prodotto, marca, EAN o codice" });
  const esito = () => screen.getByTestId("esito-ricerca");
  const cerca = (testo: string) => fireEvent.change(campo(), { target: { value: testo } });

  it("conta i box trovati e le pagine, evidenzia i trovati e attenua gli altri, segna le pagine nell'indice", async () => {
    disegna({ box: BOX, totalePagine: 5 });

    cerca("granarolo");

    await waitFor(() => expect(esito()).toHaveTextContent("3 box in 2 pagine"));
    // In copertina il caffè non è fra i trovati
    expect(screen.getByTestId("box-caffe")).toHaveAttribute("data-attenuato");
    expect(riquadro("caffe")).toHaveClass("opacity-0");

    const indice = screen.getByRole("navigation", { name: "Indice delle pagine" });
    expect(within(indice).getByTestId("trovati-pagina-2")).toHaveTextContent("1");
    expect(within(indice).getByTestId("trovati-pagina-4")).toHaveTextContent("2");
    expect(within(indice).queryByTestId("trovati-pagina-1")).not.toBeInTheDocument();
    expect(within(indice).getByRole("button", { name: "Pagina 4, 2 box, 2 trovati" })).toBeInTheDocument();
    expect(within(indice).getByRole("button", { name: "Pagina 3, 0 box" })).toHaveClass("opacity-40");

    avanti();
    expect(screen.getByTestId("box-latte")).toHaveAttribute("data-trovato");
    expect(screen.getByTestId("box-pasta")).toHaveAttribute("data-attenuato");
  });

  it("successivo e precedente aprono le pagine del box trovato e lo mettono in rilievo; Invio e Maiusc+Invio fanno lo stesso", async () => {
    disegna({ box: BOX, totalePagine: 5 });
    cerca("granarolo");
    await waitFor(() => expect(esito()).toHaveTextContent("3 box in 2 pagine"));

    fireEvent.click(screen.getByRole("button", { name: "Box trovato successivo" }));
    expect(aperte()).toHaveTextContent("Pagine 2-3");
    expect(screen.getByTestId("box-latte")).toHaveAttribute("data-rilievo");
    expect(esito()).toHaveTextContent("1 di 3 · pagina 2");

    fireEvent.keyDown(campo(), { key: "Enter" });
    expect(aperte()).toHaveTextContent("Pagine 4-5");
    expect(screen.getByTestId("box-mozzarella")).toHaveAttribute("data-rilievo");

    fireEvent.keyDown(campo(), { key: "Enter", shiftKey: true });
    expect(aperte()).toHaveTextContent("Pagine 2-3");
    fireEvent.click(screen.getByRole("button", { name: "Box trovato precedente" }));
    // Dal primo si gira all'ultimo
    expect(aperte()).toHaveTextContent("Pagine 4-5");
    expect(screen.getByTestId("box-yogurt")).toHaveAttribute("data-rilievo");
  });

  it("non distingue maiuscole e accenti", async () => {
    disegna({ box: BOX });
    cerca("CAFFE");

    await waitFor(() => expect(esito()).toHaveTextContent("1 box in 1 pagina"));
    expect(screen.getByTestId("box-caffe")).toHaveAttribute("data-trovato");
  });

  it("trova un box dall'EAN, anche parziale, o dal codice di un prodotto del gruppo", async () => {
    const conProdotti = [
      boxDi("caffe", { nome: "Caffè", pagina: 1, dettaglioProdotti: [prodotto({ codice: "7332163", ean: ["8001420012484"] })] }),
      boxDi("te", { nome: "Tè", pagina: 1, geometria: { x: 0.1, y: 0.6, w: 0.4, h: 0.2 }, dettaglioProdotti: [prodotto({ ean: ["8000000000001"] })] }),
    ];
    disegna({ box: conProdotti });

    cerca("12484");
    await waitFor(() => expect(esito()).toHaveTextContent("1 box in 1 pagina"));
    expect(screen.getByTestId("box-caffe")).toHaveAttribute("data-trovato");
    expect(screen.getByTestId("box-te")).toHaveAttribute("data-attenuato");

    cerca("7332163");
    await waitFor(() => expect(screen.getByTestId("box-caffe")).toHaveAttribute("data-trovato"));
  });

  it("senza risultati lo dice e i riquadri restano come prima", async () => {
    disegna({ box: BOX, totalePagine: 5 });
    cerca("biscotti");

    await waitFor(() => expect(esito()).toHaveTextContent("Nessun box per «biscotti»"));
    expect(document.querySelector("[data-attenuato]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Box trovato successivo" })).not.toBeInTheDocument();
    expect(screen.queryByTestId(/^trovati-pagina-/)).not.toBeInTheDocument();
  });

  it("Esc cancella la ricerca e tutti i riquadri tornano come prima", async () => {
    disegna({ box: BOX, totalePagine: 5 });
    cerca("granarolo");
    await waitFor(() => expect(document.querySelector("[data-attenuato]")).not.toBeNull());

    fireEvent.keyDown(campo(), { key: "Escape" });

    expect(campo()).toHaveValue("");
    await waitFor(() => expect(document.querySelector("[data-attenuato]")).toBeNull());
    expect(esito()).toHaveTextContent("");
  });

  it("una lettera sola non cerca", () => {
    disegna({ box: BOX });
    cerca("g");

    expect(esito()).toHaveTextContent("");
    expect(document.querySelector("[data-attenuato]")).toBeNull();
  });
});

describe("VolantinoSfogliabile: interrogazione dei box", () => {
  const CARNI = { codice: "10", descrizione: "CARNI" };
  const ORTO = { codice: "33", descrizione: "ORTOFRUTTA" };
  const BOX = [
    boxDi("bistecca", { nome: "Bistecca", reparto: CARNI, pagina: 1, sconto: 35, prezzo: 9.9, meccanica: "fidelity" }),
    boxDi("pollo", { nome: "Pollo", reparto: CARNI, pagina: 2, sconto: 30, prezzo: 4.5, meccanica: "sconto" }),
    boxDi("salsiccia", { nome: "Salsiccia", reparto: CARNI, pagina: 3, sconto: 10, prezzo: 3.2, meccanica: "fidelity" }),
    boxDi("mele", { nome: "Mele", reparto: ORTO, pagina: 3, sconto: 40, prezzo: 1.5, meccanica: "sconto", geometria: { x: 0.1, y: 0.6, w: 0.4, h: 0.2 } }),
  ];
  /** Apre la scheda Interroga e tutte le condizioni a tendina, come farebbe l'utente. */
  const apriInterroga = () => {
    fireEvent.click(screen.getByRole("tab", { name: /Interroga/ }));
    for (const dettagli of screen.getAllByTestId(/^condizione-/)) (dettagli as HTMLDetailsElement).open = true;
  };
  const valore = (condizione: string, nome: RegExp) => within(screen.getByRole("group", { name: condizione })).getByRole("checkbox", { name: nome });
  const esito = () => screen.getByTestId("esito-ricerca");

  it("combina reparto e sconto: evidenzia i box, conta box e pagine, segna l'indice e riassume i risultati", async () => {
    disegna({ box: BOX, totalePagine: 4 });
    apriInterroga();

    fireEvent.click(valore("Reparto", /^CARNI/));
    await waitFor(() => expect(esito()).toHaveTextContent("3 box in 3 pagine"));
    expect(screen.getByRole("tab", { name: /Interroga/ })).toHaveTextContent("1");

    fireEvent.change(screen.getByRole("textbox", { name: "Sconto da" }), { target: { value: "30" } });
    await waitFor(() => expect(esito()).toHaveTextContent("2 box in 2 pagine"));

    expect(screen.getByTestId("box-bistecca")).toHaveAttribute("data-trovato");
    const indice = screen.getByRole("navigation", { name: "Indice delle pagine" });
    expect(within(indice).getByTestId("trovati-pagina-1")).toHaveTextContent("1");
    expect(within(indice).getByTestId("trovati-pagina-2")).toHaveTextContent("1");
    expect(within(indice).queryByTestId("trovati-pagina-3")).not.toBeInTheDocument();

    const sintesi = screen.getByRole("region", { name: "Sintesi dei risultati" });
    expect(within(sintesi).getByText("Box").closest("div")).toHaveTextContent("2");
    expect(within(sintesi).getByText("Sconto medio").closest("div")).toHaveTextContent("33%");
    expect(sintesi).toHaveTextContent("Prezzi da € 4,50 a € 9,90");
    expect(within(screen.getByRole("list", { name: "Condizioni attive" })).getByText("Reparto: CARNI")).toBeInTheDocument();
  });

  it("accanto ai valori quanti box hanno con le altre condizioni; i valori senza box non si scelgono", async () => {
    disegna({ box: BOX, totalePagine: 4 });
    apriInterroga();

    fireEvent.click(valore("Meccanica", /^Prezzo Fidelity/));

    await waitFor(() => expect(valore("Reparto", /^ORTOFRUTTA/)).toBeDisabled());
    expect(valore("Reparto", /^CARNI/).closest("label")).toHaveTextContent("CARNI2");
  });

  it("dai box trovati si aprono le pagine e la scheda del box", async () => {
    disegna({ box: BOX, totalePagine: 4 });
    apriInterroga();
    fireEvent.click(valore("Reparto", /^ORTOFRUTTA/));

    fireEvent.click(await screen.findByTestId("risultato-mele"));

    expect(aperte()).toHaveTextContent("Pagine 2-3");
    expect(await screen.findByRole("heading", { name: "Mele" })).toBeInTheDocument();
  });

  it("condizioni che nessun box soddisfa lo dicono e i riquadri restano come prima; Togli tutte riparte da capo", async () => {
    disegna({ box: BOX, totalePagine: 4 });
    apriInterroga();

    fireEvent.change(screen.getByRole("textbox", { name: "Prezzo da" }), { target: { value: "100" } });

    await waitFor(() => expect(esito()).toHaveTextContent("Nessun box corrisponde"));
    expect(screen.getByRole("region", { name: "Sintesi dei risultati" })).toHaveTextContent("Nessun box corrisponde");
    expect(document.querySelector("[data-attenuato]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Togli tutte" }));
    await waitFor(() => expect(esito()).toHaveTextContent(""));
    expect(screen.getByRole("textbox", { name: "Prezzo da" })).toHaveValue("");
  });

  it("ricerca e condizioni valgono insieme", async () => {
    disegna({ box: BOX, totalePagine: 4 });
    apriInterroga();
    fireEvent.click(valore("Meccanica", /^Prezzo Fidelity/));
    fireEvent.change(screen.getByRole("searchbox", { name: "Cerca prodotto, marca, EAN o codice" }), { target: { value: "salsiccia" } });

    await waitFor(() => expect(esito()).toHaveTextContent("1 box in 1 pagina"));
  });

  it("propone solo le condizioni con dati nel volantino, mai vendite, previsioni, calore o visibilità", () => {
    disegna({ box: BOX, totalePagine: 4 });
    apriInterroga();

    const condizioni = screen.getByRole("region", { name: "Condizioni" });
    expect(within(condizioni).queryByRole("group", { name: "Settore" })).not.toBeInTheDocument();
    expect(within(condizioni).queryByRole("group", { name: "Linea del distributore" })).not.toBeInTheDocument();
    expect(screen.getByTestId("interroga-volantino")).not.toHaveTextContent(/vendit|prevision|calore|visibilit/i);
  });
});
