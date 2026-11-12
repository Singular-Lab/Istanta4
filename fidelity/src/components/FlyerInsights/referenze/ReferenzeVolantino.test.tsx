// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReferenzaPosizione } from "@/types/flyerInsights";
import type { BoxInsight, LineeDistributore } from "../../../../lib/insightVolantino/tipi";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { ReferenzeVolantino, RIGHE_PER_VOLTA } from "./ReferenzeVolantino";
import { filtraRighe, FILTRI_VUOTI, nomeReferenza, ordinaRighe, ricercaUtile, righeReferenze } from "./tabella";

const box = (id: string, campi: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: `B${id}`,
  pagina: 1,
  geometria: { x: 0, y: 0, w: 0.5, h: 0.5 },
  spazio: 10,
  proporzionePagina: 0.7,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: null,
  formato: null,
  prezzo: 1,
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
  ...campi,
});

const LATTE = box("latte", {
  nome: "Latte intero",
  marca: "Granarolo",
  formato: "1 l",
  pagina: 3,
  prezzo: 1.29,
  barrato: 1.59,
  sconto: 19,
  meccanica: "sconto",
  reparto: { codice: "24", descrizione: "Latticini" },
  foto: ["/foto/latte.jpg"],
});
const PASTA = box("pasta", {
  nome: "Spaghetti",
  marca: "Conad",
  pagina: 1,
  prezzo: 0.89,
  spazio: 25,
  meccanica: "fidelity",
  reparto: { codice: "01", descrizione: "Drogheria" },
  linea: { sigla: "SD", nome: "Sapori & Dintorni" },
  prodotti: 3,
  idReferenze: ["r-p1", "r-p2", "r-p3"],
});
const OLIO = box("olio", { nome: "Olio extravergine", marca: "Carapelli", pagina: 2, prezzo: 4.99, sottocosto: true, sconto: 40, geometria: null, spazio: 0 });

const REFERENZE = [
  { id: "r-p1", descrizione: "Spaghetti", posizione: null },
  { id: "r-p2", descrizione: "Penne", descrizioneDue: "rigate$br500 g", codiceReferenza: "PN500", prezzo: "0,99", posizione: null },
  { id: "r-p3", descrizione: "Fusilli", codiceReferenza: 7781, posizione: null },
] as ReferenzaPosizione[];

const LINEE: LineeDistributore = {
  quotaSpazio: 20,
  quotaBox: 33,
  box: 1,
  linee: [{ sigla: "SD", nome: "Sapori & Dintorni", colore: "#b45309", logo: null, box: 1, referenze: 3, quotaSpazio: 20, scontoMedio: null }],
  bolli: [],
};

const disegna = (props: Partial<Parameters<typeof ReferenzeVolantino>[0]> = {}) => {
  const onApriBox = vi.fn();
  render(<ReferenzeVolantino box={[LATTE, PASTA, OLIO]} referenze={REFERENZE} onApriBox={onApriBox} {...props} />);
  return onApriBox;
};

const tabella = () => screen.getByRole("table", { name: "Referenze in volantino" });
/** I nomi dei prodotti nelle righe, nell'ordine della tabella. */
const prodotti = () =>
  within(tabella())
    .getAllByRole("rowheader")
    .map(cella => cella.querySelector("span")?.textContent);

describe("ReferenzeVolantino", () => {
  it("è una tabella con un box per riga, dalla prima pagina, con il numero delle referenze nel titolo", () => {
    disegna();

    expect(screen.getByRole("heading", { level: 2, name: "Referenze in volantino · 5" })).toBeInTheDocument();
    expect(prodotti()).toEqual(["Spaghetti", "Olio extravergine", "Latte intero"]);
    expect(within(tabella()).getByRole("columnheader", { name: /Pagina/ })).toHaveAttribute("aria-sort", "ascending");
    const latte = within(tabella()).getByRole("rowheader", { name: /Latte intero/ }).closest("tr")!;
    expect(latte).toHaveTextContent("Granarolo · 1 l");
    expect(latte).toHaveTextContent("Latticini");
    expect(latte).toHaveTextContent("Sconto in %");
    expect(latte).toHaveTextContent("€ 1,29");
    expect(latte).toHaveTextContent("€ 1,59");
    expect(latte).toHaveTextContent("−19%");
    expect(latte).toHaveTextContent("10%");
    expect(latte.querySelector("img")).toHaveAttribute("src", "/foto/latte.jpg");
    // Il box senza posizione non ha lo spazio
    expect(within(tabella()).getByRole("rowheader", { name: /Olio/ }).closest("tr")).toHaveTextContent("Sottocosto");
  });

  it("il prezzo non stampato ma calcolato dal barrato e dallo sconto si scrive com'è e lo spiega il titolo", () => {
    const calcolato = box("frantolio", { nome: "Olio Il Frantolio", pagina: 1, prezzo: 2.59, prezzoCalcolato: true, barrato: 5.39, sconto: 51.95, sottocosto: true });
    disegna({ box: [calcolato, LATTE] });

    const riga = within(tabella()).getByRole("rowheader", { name: /Olio Il Frantolio/ }).closest("tr")!;
    const prezzo = within(riga).getByText("€ 2,59");
    expect(prezzo).toHaveAttribute("title", expect.stringMatching(/Calcolato dal prezzo barrato e dallo sconto/));
    expect(riga).toHaveTextContent("calcolato dal barrato e dallo sconto");
    expect(riga).not.toHaveTextContent("≈");
    expect(riga).toHaveTextContent("€ 5,39");
    // Il prezzo stampato non ha il titolo del calcolo
    const latte = within(tabella()).getByRole("rowheader", { name: /Latte intero/ }).closest("tr")!;
    expect(within(latte).getByText("€ 1,29")).not.toHaveAttribute("title");
  });

  it("la colonna Linea c'è solo con le linee del distributore: pastiglia, Industria o trattino", () => {
    const { unmount } = render(<ReferenzeVolantino box={[LATTE, PASTA]} onApriBox={() => {}} />);
    expect(within(tabella()).queryByRole("columnheader", { name: "Linea" })).not.toBeInTheDocument();
    unmount();

    disegna({ lineeDistributore: LINEE, box: [LATTE, PASTA, box("senza", { nome: "Senza marca", pagina: 4 })] });
    expect(within(tabella()).getByRole("columnheader", { name: "Linea" })).toBeInTheDocument();
    const riga = (nome: RegExp) => within(tabella()).getByRole("rowheader", { name: nome }).closest("tr")!;
    expect(riga(/Spaghetti/)).toHaveTextContent("Sapori & Dintorni");
    expect(riga(/Latte intero/)).toHaveTextContent("Industria");
    expect(riga(/Senza marca/)).not.toHaveTextContent("Industria");
  });

  it("cerca per nome, marca, formato e codice, senza badare ad accenti e maiuscole", () => {
    disegna();

    const ricerca = screen.getByRole("searchbox", { name: "Cerca referenza" });
    fireEvent.change(ricerca, { target: { value: "granarolo" } });
    expect(prodotti()).toEqual(["Latte intero"]);

    // Il codice di un prodotto del box trova il box
    fireEvent.change(ricerca, { target: { value: "pn500" } });
    expect(prodotti()).toEqual(["Spaghetti"]);

    fireEvent.change(ricerca, { target: { value: "inesistente" } });
    expect(screen.getByText("Nessun risultato")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Azzera filtri/ }));
    expect(prodotti()).toHaveLength(3);
  });

  it("i filtri rapidi: linee del distributore, Prezzo Fidelity e sottocosto, con i conteggi", () => {
    disegna({ lineeDistributore: LINEE });

    const filtri = screen.getByRole("radiogroup", { name: "Mostra" });
    expect(within(filtri).getAllByRole("radio").map(r => r.textContent)).toEqual(["Tutte 3", "Linee del distributore 1", "Prezzo Fidelity 1", "Sottocosto 1"]);

    fireEvent.click(within(filtri).getByRole("radio", { name: /Sottocosto/ }));
    expect(prodotti()).toEqual(["Olio extravergine"]);
    fireEvent.click(within(filtri).getByRole("radio", { name: /Prezzo Fidelity/ }));
    expect(prodotti()).toEqual(["Spaghetti"]);
  });

  it("senza linee del distributore il filtro rapido delle linee non c'è", () => {
    disegna();

    expect(within(screen.getByRole("radiogroup", { name: "Mostra" })).queryByRole("radio", { name: /Linee/ })).not.toBeInTheDocument();
  });

  it("filtra per reparto, meccanica e pagina", () => {
    disegna();

    fireEvent.change(screen.getByRole("combobox", { name: "Reparto" }), { target: { value: "24" } });
    expect(prodotti()).toEqual(["Latte intero"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Reparto" }), { target: { value: "senza" } });
    expect(prodotti()).toEqual(["Olio extravergine"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Reparto" }), { target: { value: "" } });

    fireEvent.change(screen.getByRole("combobox", { name: "Meccanica" }), { target: { value: "fidelity" } });
    expect(prodotti()).toEqual(["Spaghetti"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Meccanica" }), { target: { value: "" } });

    fireEvent.change(screen.getByRole("combobox", { name: "Pagina" }), { target: { value: "3" } });
    expect(prodotti()).toEqual(["Latte intero"]);
  });

  it("si ordina per prezzo, sconto e spazio; i valori mancanti restano in fondo", () => {
    disegna();

    fireEvent.click(within(tabella()).getByRole("button", { name: /Prezzo/ }));
    expect(prodotti()).toEqual(["Spaghetti", "Latte intero", "Olio extravergine"]);
    fireEvent.click(within(tabella()).getByRole("button", { name: /Prezzo/ }));
    expect(prodotti()).toEqual(["Olio extravergine", "Latte intero", "Spaghetti"]);

    // Lo sconto parte dal più alto; Spaghetti non ha sconto e resta in fondo
    fireEvent.click(within(tabella()).getByRole("button", { name: /Sconto/ }));
    expect(within(tabella()).getByRole("columnheader", { name: /Sconto/ })).toHaveAttribute("aria-sort", "descending");
    expect(prodotti()).toEqual(["Olio extravergine", "Latte intero", "Spaghetti"]);

    fireEvent.click(within(tabella()).getByRole("button", { name: /Spazio/ }));
    expect(prodotti()).toEqual(["Spaghetti", "Latte intero", "Olio extravergine"]);
  });

  it("\"p. N\" apre il box nel volantino", () => {
    const onApriBox = disegna();

    fireEvent.click(screen.getByRole("button", { name: "Apri nel volantino Latte intero, pagina 3" }));
    expect(onApriBox).toHaveBeenCalledWith(LATTE);
  });

  it("un box con più prodotti si apre per elencare gli altri, letti dalle referenze", () => {
    disegna();

    const pulsante = screen.getByRole("button", { name: "3 prodotti" });
    expect(pulsante).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(pulsante);
    expect(pulsante).toHaveAttribute("aria-expanded", "true");

    const altri = screen.getByRole("list", { name: "Altri prodotti di Spaghetti" });
    const voci = within(altri).getAllByRole("listitem");
    expect(voci).toHaveLength(2);
    expect(voci[0]).toHaveTextContent("Penne rigate 500 g");
    expect(voci[0]).toHaveTextContent("PN500");
    expect(voci[0]).toHaveTextContent("€ 0,99");
    expect(voci[1]).toHaveTextContent("Fusilli");
    expect(voci[1]).toHaveTextContent("7781");
  });

  it("senza le referenze dei prodotti lo dice invece di un elenco vuoto", () => {
    disegna({ referenze: [] });

    fireEvent.click(screen.getByRole("button", { name: "3 prodotti" }));
    expect(screen.getByText("I dettagli degli altri prodotti del box non sono disponibili.")).toBeInTheDocument();
  });

  it(`mostra le prime ${RIGHE_PER_VOLTA} righe e le altre con Mostra altre`, () => {
    const molti = Array.from({ length: 60 }, (_, i) => box(`m${i}`, { pagina: i + 1 }));
    disegna({ box: molti });

    expect(prodotti()).toHaveLength(RIGHE_PER_VOLTA);
    expect(screen.getByRole("status")).toHaveTextContent("50 di 60 box");
    fireEvent.click(screen.getByRole("button", { name: /Mostra altre 10/ }));
    expect(prodotti()).toHaveLength(60);
    expect(screen.queryByRole("button", { name: /Mostra altre/ })).not.toBeInTheDocument();
  });

  it("le intestazioni restano ferme mentre la tabella scorre, e la tabella non allunga la pagina", () => {
    disegna();

    // Posizionato: il testo nascosto delle righe (sr-only, assoluto) resta nel riquadro che scorre
    // invece di allungare la pagina fino al fondo della tabella intera
    expect(screen.getByTestId("scorrimento-referenze")).toHaveClass("overflow-auto", "relative");
    expect(within(tabella()).getByRole("columnheader", { name: "Prodotto" })).toHaveClass("sticky", "top-0");
  });

  it("la ricerca iniziale vale solo se trova qualcosa", () => {
    const { unmount } = render(<ReferenzeVolantino box={[LATTE, PASTA]} ricercaIniziale="latte" onApriBox={() => {}} />);
    expect(screen.getByRole("searchbox", { name: "Cerca referenza" })).toHaveValue("latte");
    unmount();

    render(<ReferenzeVolantino box={[LATTE, PASTA]} ricercaIniziale="r-latte" onApriBox={() => {}} />);
    expect(screen.getByRole("searchbox", { name: "Cerca referenza" })).toHaveValue("");
  });
});

describe("righe della tabella", () => {
  it("il nome della referenza unisce le righe di descrizione senza gli a capo", () => {
    expect(nomeReferenza({ id: "x", descrizione: "Penne", descrizioneDue: "rigate$br500 g", posizione: null })).toBe("Penne rigate 500 g");
    expect(nomeReferenza({ id: "x", posizione: null })).toBe("");
  });

  it("a parità di valore decide l'ordine di lettura del volantino", () => {
    const righe = righeReferenze([box("b", { pagina: 2, prezzo: 1 }), box("a", { pagina: 1, prezzo: 1 })]);
    expect(ordinaRighe(righe, { colonna: "prezzo", direzione: "asc" }).map(r => r.box.id)).toEqual(["a", "b"]);
  });

  it("i filtri si combinano, e la ricerca vuole tutte le parole", () => {
    const righe = righeReferenze([LATTE, PASTA, OLIO], REFERENZE);
    expect(filtraRighe(righe, { ...FILTRI_VUOTI, testo: "latte granarolo" }).map(r => r.box.id)).toEqual(["latte"]);
    expect(filtraRighe(righe, { ...FILTRI_VUOTI, testo: "latte conad" })).toEqual([]);
    expect(filtraRighe(righe, { ...FILTRI_VUOTI, rapido: "sottocosto", pagina: "1" })).toEqual([]);
    expect(ricercaUtile(righe, "  fusilli ")).toBe("fusilli");
    expect(ricercaUtile(righe, "r-p2")).toBe("");
  });
});
