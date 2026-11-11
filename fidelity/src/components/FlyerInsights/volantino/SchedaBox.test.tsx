// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoxInsight, ProdottoInsight } from "../../../../lib/insightVolantino/tipi";
import { paginaNellImmagine, SchedaBox, stileImmagine, stileRitaglio, type SchedaBoxProps } from ".";

// La scheda del box del volantino: foto del prodotto grandi e intere, il box com'è stampato
// ritagliato dalla pagina, prezzi come stampati e dati in gruppi senza ripetizioni

const A4 = 210 / 297;
const PAGINA = "https://olimpo.example/pagina-1.webp";

const boxDi = (dati: Partial<BoxInsight> = {}): BoxInsight => ({
  id: "a",
  codiceBox: "B1",
  pagina: 1,
  geometria: { x: 0.1, y: 0.2, w: 0.5, h: 0.25 },
  spazio: 12.5,
  proporzionePagina: A4,
  chiave: "c-a",
  nome: "Mozzarella",
  marca: "Granarolo",
  formato: "125 g",
  prezzo: 1.69,
  barrato: 2.49,
  sconto: 32,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: "sconto",
  meccanicaOriginale: "TP_PERCENTO",
  reparto: { codice: "24", descrizione: "LATTICINI" },
  foto: [],
  prodotti: 1,
  idReferenze: ["r-a"],
  ...dati,
});

const prodotto = (dati: Partial<ProdottoInsight> = {}): ProdottoInsight => ({
  chiave: "c-p",
  nome: "Mozzarella",
  marca: "Granarolo",
  formato: "125 g",
  gusto: null,
  codice: "7332163",
  ean: ["8033281161575"],
  prezzo: null,
  settore: "Latticini",
  segmento: null,
  tema: null,
  ruolo: null,
  ...dati,
});

const disegna = (props: Partial<SchedaBoxProps> = {}) =>
  render(<SchedaBox box={boxDi()} totalePagine={8} immaginePagina={PAGINA} proporzionePagina={A4} onViaggio={vi.fn()} {...props} />);

const carica = (immagine: HTMLImageElement, larghezza: number, altezza: number) => {
  Object.defineProperty(immagine, "naturalWidth", { configurable: true, value: larghezza });
  Object.defineProperty(immagine, "naturalHeight", { configurable: true, value: altezza });
  fireEvent.load(immagine);
};

describe("SchedaBox: foto del prodotto", () => {
  const FOTO = ["https://foto.example/1.jpg", "https://foto.example/2.jpg", "https://foto.example/3.jpg"];

  it("la prima foto è grande e intera; dalle miniature se ne sceglie un'altra", () => {
    disegna({ box: boxDi({ foto: FOTO }) });

    const grande = screen.getByRole("img", { name: "Foto di Mozzarella" });
    expect(grande).toHaveAttribute("src", FOTO[0]);
    expect(grande).toHaveClass("h-64", "w-full", "object-contain");

    const miniature = screen.getByRole("group", { name: "Foto del prodotto" });
    expect(within(miniature).getAllByRole("button")).toHaveLength(3);
    expect(within(miniature).getByRole("button", { name: "Foto 1 di 3" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(miniature).getByRole("button", { name: "Foto 2 di 3" }));

    expect(screen.getByRole("img", { name: "Foto di Mozzarella" })).toHaveAttribute("src", FOTO[1]);
    expect(within(miniature).getByRole("button", { name: "Foto 2 di 3" })).toHaveAttribute("aria-pressed", "true");
  });

  it("una foto che non si carica sparisce e al suo posto va la successiva, senza icone rotte", () => {
    disegna({ box: boxDi({ foto: FOTO.slice(0, 2) }) });

    fireEvent.error(screen.getByRole("img", { name: "Foto di Mozzarella" }));

    expect(screen.getByRole("img", { name: "Foto di Mozzarella" })).toHaveAttribute("src", FOTO[1]);
    // Con una foto sola non servono le miniature
    expect(screen.queryByRole("group", { name: "Foto del prodotto" })).not.toBeInTheDocument();
  });

  it("con le foto, accanto c'è il box com'è stampato", () => {
    disegna({ box: boxDi({ foto: FOTO.slice(0, 1) }) });

    expect(screen.getByRole("img", { name: "Foto di Mozzarella" })).toBeInTheDocument();
    expect(screen.getByTestId("box-stampato")).toBeInTheDocument();
  });
});

describe("SchedaBox: il box com'è stampato", () => {
  it("senza foto il box ritagliato dalla pagina prende il loro posto, con le misure del box", () => {
    disegna();

    expect(screen.queryByRole("img", { name: "Foto di Mozzarella" })).not.toBeInTheDocument();
    const ritaglio = screen.getByTestId("box-stampato");
    expect(ritaglio).toHaveAttribute("data-stato", "caricamento");
    // La proporzione del ritaglio (aspect-ratio, che jsdom non conosce) è verificata in geometria.test.ts
    // La pagina dentro il ritaglio è spostata perché resti visibile solo il box
    const atteso = stileRitaglio({ x: 0.1, y: 0.2, w: 0.5, h: 0.25 });
    const paginaNelRitaglio = ritaglio.querySelector("img")?.parentElement as HTMLElement;
    expect(paginaNelRitaglio.style.left).toBe(atteso.left);
    expect(paginaNelRitaglio.style.width).toBe(atteso.width);

    // Caricata, l'immagine compensa l'abbondanza come nel lettore
    const immagine = ritaglio.querySelector("img") as HTMLImageElement;
    expect(immagine).toHaveAttribute("src", PAGINA);
    carica(immagine, 216, 303);

    expect(ritaglio).toHaveAttribute("data-stato", "pronto");
    expect(immagine.style.width).toBe(stileImmagine(paginaNellImmagine(216, 303, A4)!).width);
    expect(screen.getByRole("img", { name: "Mozzarella com'è stampato nel volantino" })).toBe(immagine);
  });

  it("se Olimpo risponde con il segnaposto il ritaglio lo dice, senza un'immagine sbagliata", () => {
    disegna();

    carica(screen.getByTestId("box-stampato").querySelector("img") as HTMLImageElement, 400, 400);

    expect(screen.queryByTestId("box-stampato")).not.toBeInTheDocument();
    expect(screen.getByText(/L'immagine della pagina non è disponibile/)).toBeInTheDocument();
  });

  it("senza foto e senza immagine della pagina lo dice", () => {
    disegna({ immaginePagina: null });

    expect(screen.queryByTestId("box-stampato")).not.toBeInTheDocument();
    expect(screen.getByText(/non ci sono foto del prodotto né l'immagine della pagina/)).toBeInTheDocument();
  });

  it("un box senza posizione nella pagina non si ritaglia", () => {
    disegna({ box: boxDi({ geometria: null }) });

    expect(screen.queryByTestId("box-stampato")).not.toBeInTheDocument();
    expect(screen.getByText(/non ci sono foto del prodotto/)).toBeInTheDocument();
  });
});

describe("SchedaBox: dati senza ripetizioni", () => {
  it("raggruppa i dati del box e quelli del suo posto nel volantino", () => {
    disegna({ box: boxDi({ origine: "fuori_listino", linea: { sigla: "SD", nome: "Sapori & Dintorni" } }) });

    const dati = screen.getByLabelText("Dati del box");
    const delBox = within(dati).getByLabelText("Il box");
    expect(within(delBox).getByText("Sconto in %")).toBeInTheDocument();
    expect(within(delBox).getByText("LATTICINI (24)")).toBeInTheDocument();
    expect(within(delBox).getByText("Sapori & Dintorni")).toBeInTheDocument();
    const nelVolantino = within(dati).getByLabelText("Nel volantino");
    expect(within(nelVolantino).getByText("1 di 8")).toBeInTheDocument();
    expect(within(nelVolantino).getByText("Spazio nella pagina")).toBeInTheDocument();
    expect(within(nelVolantino).getByText("12,5% della pagina")).toBeInTheDocument();
    // Origine e codice box sono codici della fonte: nei dettagli tecnici
    expect(within(dati).queryByText("Fuori listino")).not.toBeInTheDocument();
    expect(within(dati).queryByText("B1")).not.toBeInTheDocument();
  });

  const CON_CODICI = boxDi({
    origine: "fuori_listino",
    dettaglioProdotti: [prodotto({ segmento: "0115001003", tema: "mnumeri1", ruolo: "base" })],
  });

  it("senza indicazioni della GDO: in vista tutti i dati dei prodotti, nei dettagli tecnici chiusi i codici della fonte", () => {
    disegna({ box: CON_CODICI });

    const dettagli = screen.getByTestId("dettagli-tecnici");
    expect(dettagli.tagName).toBe("DETAILS");
    expect(dettagli).not.toHaveAttribute("open");
    expect(within(dettagli).getByText("Dettagli tecnici")).toBeInTheDocument();
    for (const codice of ["TP_PERCENTO", "Fuori listino", "B1"]) expect(within(dettagli).getByText(codice)).toBeInTheDocument();
    const prodotti = screen.getByRole("region", { name: "Prodotti del box" });
    for (const dato of ["7332163", "8033281161575", "Latticini", "0115001003", "mnumeri1", "base"]) expect(within(prodotti).getByText(dato)).toBeInTheDocument();
    expect(within(dettagli).queryByText("mnumeri1")).not.toBeInTheDocument();
  });

  it("con la configurazione della GDO (Conad) segmento, tema e ruolo vanno nei dettagli tecnici", () => {
    disegna({
      box: CON_CODICI,
      datiProdotto: ["codice", "ean", "settore"],
      dettagliTecnici: ["meccanicaFonte", "origine", "codiceBox", "segmento", "tema", "ruolo"],
    });

    const prodotti = screen.getByRole("region", { name: "Prodotti del box" });
    expect(within(prodotti).getByText("7332163")).toBeInTheDocument();
    expect(within(prodotti).getByText("Latticini")).toBeInTheDocument();
    for (const codice of ["0115001003", "mnumeri1", "base"]) expect(within(prodotti).queryByText(codice)).not.toBeInTheDocument();
    const dettagli = screen.getByTestId("dettagli-tecnici");
    for (const codice of ["TP_PERCENTO", "Fuori listino", "B1", "0115001003", "mnumeri1", "base"]) expect(within(dettagli).getByText(codice)).toBeInTheDocument();
  });

  it("la configurazione decide anche l'ordine e cosa non si mostra affatto", () => {
    disegna({ box: CON_CODICI, datiProdotto: ["ean", "codice"], dettagliTecnici: ["codiceBox"] });

    const prodotti = screen.getByRole("region", { name: "Prodotti del box" });
    const etichette = within(prodotti).getAllByRole("term").map(voce => voce.textContent);
    expect(etichette).toEqual(["EAN", "Codice"]);
    // Né in vista né nei dettagli: settore, tema, meccanica della fonte e origine non compaiono
    for (const assente of ["Latticini", "mnumeri1", "TP_PERCENTO", "Fuori listino"]) expect(screen.queryByText(assente)).not.toBeInTheDocument();
    expect(within(screen.getByTestId("dettagli-tecnici")).getByText("B1")).toBeInTheDocument();
  });

  it("senza codici tecnici non c'è la sezione dei dettagli", () => {
    disegna({ box: boxDi({ meccanicaOriginale: null, codiceBox: "" }) });

    expect(screen.queryByTestId("dettagli-tecnici")).not.toBeInTheDocument();
  });

  it("compatta, nella colonna stretta della lettura, mette tutto in una colonna sola", () => {
    disegna({ box: boxDi({ foto: ["https://foto.example/1.jpg"] }), compatta: true });

    expect(screen.getByLabelText("Dati del box").className).not.toMatch(/sm:grid-cols-2/);
    expect(screen.getByTestId("box-stampato").closest(".grid")?.className).not.toMatch(/sm:grid-cols-2/);
  });

  it("marca e formato del box non si ripetono: stanno nella descrizione completa", () => {
    disegna({ box: boxDi({ dettaglioProdotti: [prodotto()] }) });

    expect(screen.queryByText("Granarolo · 125 g")).not.toBeInTheDocument();
    // Il prodotto unico, uguale al box, mostra solo i suoi codici e dati
    const prodotti = screen.getByRole("region", { name: "Prodotti del box" });
    expect(within(prodotti).queryByText("Mozzarella")).not.toBeInTheDocument();
    expect(within(prodotti).getByText("7332163")).toBeInTheDocument();
    expect(within(prodotti).getByText("8033281161575")).toBeInTheDocument();
  });

  it("il prezzo del prodotto compare solo se è diverso da quello del box", () => {
    const { unmount } = disegna({ box: boxDi({ dettaglioProdotti: [prodotto({ prezzo: 1.69 })] }) });
    expect(screen.queryByText("Prezzo del prodotto")).not.toBeInTheDocument();
    unmount();

    disegna({ box: boxDi({ dettaglioProdotti: [prodotto({ prezzo: 1.99 })] }) });
    const prodotti = screen.getByRole("region", { name: "Prodotti del box" });
    expect(within(prodotti).getByText("Prezzo del prodotto")).toBeInTheDocument();
    expect(within(prodotti).getByText("€ 1,99")).toBeInTheDocument();
  });

  it("con più prodotti ognuno ha il suo nome, marca e variante", () => {
    disegna({
      box: boxDi({
        prodotti: 2,
        dettaglioProdotti: [prodotto({ chiave: "c-1" }), prodotto({ chiave: "c-2", nome: "Mozzarella light", gusto: "Light", codice: "7332164" })],
      }),
    });

    const voci = within(screen.getByRole("region", { name: "Prodotti del box" })).getAllByRole("listitem");
    expect(voci).toHaveLength(2);
    expect(voci[0]).toHaveTextContent("Mozzarella");
    expect(voci[1]).toHaveTextContent("Mozzarella light");
    expect(voci[1]).toHaveTextContent("Granarolo · 125 g · Light");
  });
});

describe("SchedaBox: descrizione completa vicino al prezzo", () => {
  const cartellino = () => screen.getByRole("region", { name: "Descrizione e prezzo" });

  it("nome, marca in evidenza e formato insieme ai prezzi come stampati", () => {
    disegna({ box: boxDi({ nome: "Gelato", marca: "Nutella", formato: "230 g", prezzo: 3.39, barrato: 4.99, sconto: 32 }) });

    expect(within(cartellino()).getByTestId("descrizione-completa")).toHaveTextContent("Gelato Nutella 230 g");
    expect(within(cartellino()).getByTestId("marca-scheda")).toHaveTextContent("Nutella");
    expect(within(cartellino()).getByText("€ 3,39")).toBeInTheDocument();
    expect(within(cartellino()).getByText("€ 4,99")).toBeInTheDocument();
    expect(within(cartellino()).getByText("−32%")).toBeInTheDocument();
  });

  it("le varianti dei prodotti del box, senza doppioni", () => {
    disegna({
      box: boxDi({
        prodotti: 3,
        dettaglioProdotti: [prodotto({ chiave: "c-1" }), prodotto({ chiave: "c-2", gusto: "Light" }), prodotto({ chiave: "c-3", gusto: "LIGHT" })],
      }),
    });

    expect(within(cartellino()).getByTestId("descrizione-completa")).toHaveTextContent("Mozzarella Granarolo 125 g Light");
  });

  it("la descrizione composta dalla libreria agenzia del cliente si mostra com'è", () => {
    disegna({ box: boxDi({ descrizione: [{ testo: "GRANAROLO", evidenza: true }, { testo: "Mozzarella di latte fresco" }] }) });

    expect(within(cartellino()).getByTestId("descrizione-completa")).toHaveTextContent("GRANAROLO Mozzarella di latte fresco");
    expect(within(cartellino()).getByTestId("marca-scheda")).toHaveTextContent("GRANAROLO");
  });

  it("compatta, la descrizione sta sopra i prezzi", () => {
    disegna({ compatta: true });

    expect(cartellino()).toHaveClass("flex-col");
    expect(cartellino().className).not.toMatch(/sm:flex-row/);
  });
});
