// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { altezzaFoglio, tintaCategoria } from "@/components/Grafici";
import type { FlyerInsightsConfig } from "@/types/flyerInsights";
import { urlPaginaMateriale } from "@/utils/materiali";
import { legendaCalore, MISURE_CALORE } from "../../../../lib/insightVolantino/calore";
import type { PrevisioneVolantino, RendimentoVolantino } from "../../../../lib/insightVolantino/rendimento";
import { PESI_VISIBILITA, type BoxInsight, type TappaProdotto, type ViaggioProdotto } from "../../../../lib/insightVolantino/tipi";
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
  visibilita: 50,
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

/** Il contesto 2D finto di un canvas: jsdom non disegna, qui si registra cosa si disegna. */
interface ContestoFinto {
  canvas: HTMLCanvasElement;
  createImageData: Mock;
  putImageData: Mock;
  drawImage: Mock;
  clearRect: Mock;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: string;
}

let contesti: ContestoFinto[] = [];

beforeEach(() => {
  finti.viaggio = caricato(undefined);
  finti.richiesteViaggio = [];
  contesti = [];
  // Ripristinato dopo ogni test (vi.restoreAllMocks nel setup)
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    const contesto: ContestoFinto = {
      canvas: this,
      createImageData: vi.fn((larghezza: number, altezza: number) => ({ width: larghezza, height: altezza, data: new Uint8ClampedArray(larghezza * altezza * 4) })),
      putImageData: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
    };
    contesti.push(contesto);
    return contesto as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement["getContext"]);
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

describe("VolantinoSfogliabile: navigazione fra le doppie pagine", () => {
  it("la copertina sta da sola; la successiva porta alle pagine 2-3 e poi alle 4-5", () => {
    disegna();

    expect(pagina(1)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Pagina 2" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Doppia pagina precedente" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Doppia pagina successiva" }));
    expect(pagina(2)).toBeInTheDocument();
    expect(pagina(3)).toBeInTheDocument();
    expect(screen.getByText(/Pagine 2-3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Doppia pagina successiva" }));
    expect(pagina(4)).toBeInTheDocument();
    expect(pagina(5)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Doppia pagina successiva" })).toBeDisabled();
  });

  it("con la pagina controllata mostra la sua doppia pagina e avvisa il genitore dei cambi", () => {
    const onCambiaPagina = vi.fn();
    disegna({ pagina: 5, onCambiaPagina });

    expect(pagina(4)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Doppia pagina precedente" }));
    expect(onCambiaPagina).toHaveBeenLastCalledWith(2);
    // La pagina la decide il genitore: finché non cambia, si resta dove si è
    expect(pagina(5)).toBeInTheDocument();
  });

  it("la mini navigazione nomina le pagine e segna quelle correnti; l'ultima pagina pari sta da sola", () => {
    const onCambiaPagina = vi.fn();
    disegna({ totalePagine: 8, pagina: 2, onCambiaPagina });

    const navigazione = screen.getByRole("navigation", { name: "Pagine del volantino" });
    expect(within(navigazione).getByRole("button", { name: "Vai alle pagine 2-3" })).toHaveAttribute("aria-current", "true");
    expect(within(navigazione).getByRole("button", { name: "Vai alla copertina" })).not.toHaveAttribute("aria-current");

    fireEvent.click(within(navigazione).getByRole("button", { name: "Vai alla pagina 8" }));
    expect(onCambiaPagina).toHaveBeenLastCalledWith(8);
  });

  it("compatto non ha la mini navigazione", () => {
    disegna({ compatto: true });

    expect(screen.queryByRole("navigation", { name: "Pagine del volantino" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Doppia pagina successiva" })).toBeInTheDocument();
  });
});

describe("VolantinoSfogliabile: immagini delle pagine", () => {
  const PDF = { idOlimpoCloud: "olimpo-1", pagine: 5 };
  const immagineDi = (numero: number) => pagina(numero).querySelector("img") as HTMLImageElement;
  const misura = (immagine: HTMLImageElement, larghezza: number, altezza: number) => {
    Object.defineProperty(immagine, "naturalWidth", { configurable: true, value: larghezza });
    Object.defineProperty(immagine, "naturalHeight", { configurable: true, value: altezza });
  };

  it("ogni pagina chiede la sua immagine a Olimpo, solo quando serve; caricata, compensa l'abbondanza", () => {
    disegna({ pdf: PDF, box: [boxDi("a")] });

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

  it("\"Colora per\" cambia colori e legenda; la visibilità dichiara i pesi standard", () => {
    disegna({ box: [boxDi("a", { sconto: 55 })] });

    fireEvent.click(screen.getByRole("radio", { name: "Sconto" }));
    expect(within(screen.getByRole("list", { name: "Sconto" })).getByText("≥ 50%")).toBeInTheDocument();
    expect(screen.queryByText(/Visibilità stimata, uguale per tutti i volantini/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Visibilità" }));
    expect(screen.getByText(/Visibilità stimata, uguale per tutti i volantini/)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Visibilità stimata" })).getByText("80–100")).toBeInTheDocument();
    // La griglia a celle non c'è più: il calore è nella vista "Mappa di calore"
    expect(screen.queryByTestId("calore-1")).not.toBeInTheDocument();
  });

  it("con i pesi della libreria del cliente la visibilità lo dice e scrive i suoi pesi", () => {
    disegna({ box: [boxDi("a")], pesi: { ...PESI_VISIBILITA, altre: 0.4 } });

    fireEvent.click(screen.getByRole("radio", { name: "Visibilità" }));
    const spiegazione = screen.getByText(/Visibilità stimata, con i pesi del cliente/);
    expect(spiegazione).toHaveTextContent("altre 0,4");
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

// Due box con misure "opposte": il primo ha più spazio, il secondo più sconto
const BOX_CALORE = [
  boxDi("a", { nome: "Pasta", sconto: 10, spazio: 12.5 }),
  boxDi("b", { nome: "Caffè", sconto: 50, spazio: 4, geometria: { x: 0.1, y: 0.6, w: 0.2, h: 0.2 } }),
];

const RENDIMENTO: RendimentoVolantino = {
  periodo: { dal: "2026-10-01", al: "2026-10-14" },
  puntiVendita: 12,
  misura: "valore",
  totalePezzi: 300,
  totaleValore: 900,
  perBox: [
    { idBox: "a", pezzi: 100, valore: 250, quota: 27.8, quotaSpazio: 75.8, indiceSpazio: 0.37, prodotti: 1, prodottiSenzaVendite: 0 },
    { idBox: "b", pezzi: 200, valore: 650, quota: 72.2, quotaSpazio: 24.2, indiceSpazio: 2.98, prodotti: 2, prodottiSenzaVendite: 1 },
  ],
  prodotti: 3,
  prodottiSenzaVendite: 1,
  sopraSpazio: ["b"],
  sottoSpazio: ["a"],
};

const PREVISIONE: PrevisioneVolantino = {
  tipo: "vendite",
  unita: "pezzi",
  promoValida: true,
  edizioniStoriche: 8,
  perBox: [
    { idBox: "a", valore: 120, casiStorici: 10, affidabilita: "alta", reale: 100 },
    { idBox: "b", valore: 150, casiStorici: 2, affidabilita: "bassa", reale: 200 },
  ],
  scartoMedio: 25,
  nota: "Previsione dallo storico di 8 edizioni.",
};

/** I contesti dei canvas della mappa (quelli visibili, non quelli d'appoggio). */
const contestiMappa = () => contesti.filter(contesto => contesto.canvas.hasAttribute("data-testid"));
const disegni = () => contestiMappa().reduce((totale, contesto) => totale + contesto.drawImage.mock.calls.length, 0);
/** I pixel messi nell'ImageData piccolo, disegno dopo disegno. */
const pixelDisegnati = () =>
  contesti.flatMap(contesto => contesto.putImageData.mock.calls.map(([immagine]) => Array.from((immagine as { data: Uint8ClampedArray }).data)));
const misura = () => screen.getByRole("combobox", { name: "Misura della mappa di calore" }) as HTMLSelectElement;
const opzioniMisura = () => within(misura()).getAllByRole("option").map(opzione => opzione.textContent);
const accendiMappa = () => fireEvent.click(screen.getByRole("radio", { name: "Mappa di calore" }));

describe("VolantinoSfogliabile: mappa di calore continua", () => {
  it("senza vendite né previsione offre solo le misure del volantino", () => {
    disegna({ box: BOX_CALORE });

    expect(screen.getByRole("radio", { name: "Colori dei box" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("calore-1")).not.toBeInTheDocument();

    accendiMappa();
    expect(opzioniMisura()).toEqual(["Investimento promozionale", "Sconto", "Spazio", "Visibilità"]);
    expect(misura().value).toBe("investimento");
  });

  it("con rendimento e previsione aggiunge vendite, vendite per spazio e previsione, e parte dalle vendite in euro", () => {
    disegna({ box: BOX_CALORE, rendimento: RENDIMENTO, previsione: PREVISIONE });

    accendiMappa();
    expect(opzioniMisura()).toEqual([
      "Investimento promozionale",
      "Sconto",
      "Spazio",
      "Visibilità",
      "Vendite",
      "Vendite per spazio",
      "Previsione",
    ]);
    expect(misura().value).toBe("vendite");
    const legenda = screen.getByRole("figure", { name: "Legenda della mappa di calore: Vendite" });
    expect(within(legenda).getByText("in euro")).toBeInTheDocument();
    expect(within(legenda).getByRole("list", { name: "Scala di Vendite" })).toHaveTextContent("650 €");
    // Il periodo e i punti vendita delle vendite sotto la legenda
    expect(legenda).toHaveTextContent("in 12 punti vendita della stessa area e canale");
  });

  it("la legenda è continua, nell'unità della misura, con le tacche di legendaCalore e la descrizione", () => {
    disegna({ box: BOX_CALORE });
    accendiMappa();

    fireEvent.change(misura(), { target: { value: "sconto" } });

    const legenda = screen.getByRole("figure", { name: "Legenda della mappa di calore: Sconto" });
    const tacche = within(within(legenda).getByRole("list", { name: "Scala di Sconto" })).getAllByRole("listitem");
    expect(tacche.map(tacca => tacca.textContent)).toEqual(legendaCalore(50, "percentuale").map(voce => voce.testo));
    expect(within(legenda).getByText("in percentuale")).toBeInTheDocument();
    expect(legenda).toHaveTextContent(MISURE_CALORE.sconto.descrizione);
    expect(within(legenda).getByTestId("gradiente-calore")).toBeInTheDocument();
    // Al posto della legenda dei colori dei box
    expect(screen.queryByRole("list", { name: "Reparto" })).not.toBeInTheDocument();
  });

  it("disegna il calore in un canvas sopra la pagina, sfumato, e lo ridisegna al cambio di misura", () => {
    disegna({ box: BOX_CALORE });
    accendiMappa();

    const tela = within(pagina(1)).getByTestId("calore-1");
    expect(tela.tagName).toBe("CANVAS");
    expect(tela).toHaveAttribute("data-disegnata", "true");
    expect(disegni()).toBe(1);
    const [contesto] = contestiMappa();
    expect(contesto.imageSmoothingEnabled).toBe(true);
    expect(contesto.imageSmoothingQuality).toBe("high");
    // Una cella della griglia per pixel (96 colonne, righe dalla proporzione della pagina), poi ingrandita di 4
    const righe = Math.round(96 / A4);
    expect(contesti[0].createImageData).toHaveBeenCalledWith(96, righe);
    expect(contesto.drawImage.mock.calls[0].slice(1)).toEqual([0, 0, 96 * 4, righe * 4]);

    fireEvent.change(misura(), { target: { value: "sconto" } });
    expect(disegni()).toBe(2);
    fireEvent.change(misura(), { target: { value: "spazio" } });
    expect(disegni()).toBe(3);
    const [, sconto, spazio] = pixelDisegnati();
    // Lo sconto scalda il secondo box, lo spazio il primo: immagini diverse
    expect(sconto).not.toEqual(spazio);
  });

  it("i riquadri restano contorni cliccabili sopra il calore; tornando ai colori dei box il calore sparisce", () => {
    disegna({ box: BOX_CALORE });
    accendiMappa();

    expect(screen.queryByRole("radiogroup", { name: "Colora per" })).not.toBeInTheDocument();
    // Area attiva trasparente sopra il canvas, nello stesso posto del riquadro colorato
    expect(riquadro("a")).toHaveAttribute("fill", "transparent");
    expect(attributo(riquadro("a"), "width")).toBe(500);
    expect(screen.getByRole("button", { name: /^Caffè/ })).toBe(screen.getByTestId("box-b"));
    expect(within(pagina(1)).getByTestId("calore-1").compareDocumentPosition(screen.getByTestId("box-a")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Colori dei box" }));
    expect(screen.queryByTestId("calore-1")).not.toBeInTheDocument();
    expect(riquadro("a")).not.toHaveAttribute("fill", "transparent");
    expect(screen.getByRole("radiogroup", { name: "Colora per" })).toBeInTheDocument();
  });

  it("il tooltip e la scheda del box dicono il valore della misura accesa", async () => {
    disegna({ box: BOX_CALORE });
    accendiMappa();
    fireEvent.change(misura(), { target: { value: "sconto" } });

    fireEvent.mouseMove(screen.getByTestId("box-b"), { clientX: 10, clientY: 10 });
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Sconto");
    expect(tooltip).toHaveTextContent("50%");

    fireEvent.click(screen.getByTestId("box-b"));
    const dati = await screen.findByLabelText("Dati del box");
    expect(within(dati).getByText("Sconto (mappa di calore)")).toBeInTheDocument();
    expect(within(dati).getByText("50%")).toBeInTheDocument();
  });

  it("senza posizioni dei box, o nel confronto fra varianti, la mappa di calore non si offre", () => {
    const { unmount } = disegna({ box: [boxDi("a", { geometria: null, sconto: 30 })] });
    expect(screen.queryByRole("radiogroup", { name: "Vista del volantino" })).not.toBeInTheDocument();
    unmount();

    disegna({ box: BOX_CALORE, statoBox: { a: "solo-qui", b: "uguale" }, rendimento: RENDIMENTO });
    expect(screen.queryByRole("radiogroup", { name: "Vista del volantino" })).not.toBeInTheDocument();
  });

  it("se il browser non dà il contesto del canvas la pagina resta senza calore, senza errori", () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    disegna({ box: BOX_CALORE });
    accendiMappa();

    expect(screen.getByTestId("calore-1")).not.toHaveAttribute("data-disegnata");
    expect(screen.getByTestId("box-a")).toBeInTheDocument();
  });
});

describe("VolantinoSfogliabile: vendite e previsione nella scheda del box", () => {
  it("la scheda mostra vendite, quote, indice, previsione con affidabilità e scarto dal reale", async () => {
    disegna({ box: BOX_CALORE, rendimento: RENDIMENTO, previsione: PREVISIONE });

    fireEvent.click(screen.getByTestId("box-b"));

    const dati = await screen.findByLabelText("Vendite e previsione");
    expect(within(dati).getByText("€ 650,00 · 200 pezzi")).toBeInTheDocument();
    expect(within(dati).getByText("72,2%")).toBeInTheDocument();
    expect(within(dati).getByText("2,98: rende più dello spazio che occupa")).toBeInTheDocument();
    expect(within(dati).getByText("1 su 2")).toBeInTheDocument();
    expect(within(dati).getByText("150 pezzi")).toBeInTheDocument();
    expect(within(dati).getByText("Bassa")).toBeInTheDocument();
    expect(within(dati).getByText("2 casi storici")).toBeInTheDocument();
    expect(within(dati).getByText("200 pezzi")).toBeInTheDocument();
    expect(within(dati).getByText("+33%")).toBeInTheDocument();
  });

  it("con la stima teorica la previsione è un indice e lo dice; senza vendite non c'è il blocco delle vendite", async () => {
    const teorica: PrevisioneVolantino = {
      ...PREVISIONE,
      tipo: "teorica",
      unita: "indice",
      promoValida: false,
      perBox: [{ idBox: "a", valore: 64, casiStorici: 0, affidabilita: "bassa", reale: null }],
      scartoMedio: null,
      nota: "Stima teorica: nessuna vendita importata.",
    };
    disegna({ box: BOX_CALORE, previsione: teorica });

    fireEvent.click(screen.getByTestId("box-a"));

    const dati = await screen.findByLabelText("Vendite e previsione");
    expect(within(dati).getByText(/indice 64 su 100/)).toBeInTheDocument();
    expect(within(dati).getByText("(stima teorica)")).toBeInTheDocument();
    expect(within(dati).queryByText("Vendite nella promo")).not.toBeInTheDocument();
    expect(within(dati).queryByText("Reale")).not.toBeInTheDocument();
  });

  it("senza vendite né previsione la scheda resta quella di sempre", async () => {
    disegna({ box: BOX_CALORE });

    fireEvent.click(screen.getByTestId("box-a"));

    expect(await screen.findByLabelText("Dati del box")).toBeInTheDocument();
    expect(screen.queryByLabelText("Vendite e previsione")).not.toBeInTheDocument();
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
  visibilita: 64,
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
    expect(within(dati).getByText("64 su 100")).toBeInTheDocument();
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

describe("VolantinoSfogliabile: ingrandimento", () => {
  it("apre la doppia pagina a tutto schermo con gli stessi riquadri e tre livelli di zoom oltre il 100%", async () => {
    disegna({ box: [boxDi("a")] });

    fireEvent.click(screen.getByRole("button", { name: "Ingrandisci il volantino" }));

    const ingrandito = await screen.findByTestId("volantino-ingrandito");
    expect(within(ingrandito).getByRole("group", { name: "Pagina 1" })).toBeInTheDocument();
    expect(within(ingrandito).getByTestId("box-a")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riduci lo zoom" })).toBeDisabled();

    const aumenta = screen.getByRole("button", { name: "Aumenta lo zoom" });
    fireEvent.click(aumenta);
    fireEvent.click(aumenta);
    fireEvent.click(aumenta);
    expect(screen.getByText("300%")).toBeInTheDocument();
    expect(aumenta).toBeDisabled();
  });
});
