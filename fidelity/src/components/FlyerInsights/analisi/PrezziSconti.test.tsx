// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoxInsight, PrezziSconti as DatiPrezziSconti } from "../../../../lib/insightVolantino/tipi";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { etichettaFascia, PrezziSconti, vociScontoMedio } from "./PrezziSconti";

const box = (id: string, campi: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: id,
  pagina: 1,
  geometria: { x: 0, y: 0, w: 0.5, h: 0.5 },
  spazio: 25,
  proporzionePagina: 0.7,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: null,
  formato: null,
  prezzo: 1.99,
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
  idReferenze: [id],
  visibilita: 50,
  ...campi,
});

const fasce = (conteggi: number[]) =>
  [0, 10, 20, 30, 40, 50].map((da, i) => ({ da, a: da === 50 ? null : da + 10, box: conteggi[i] ?? 0 }));

const dati = (campi: Partial<DatiPrezziSconti> = {}): DatiPrezziSconti => ({
  fasce: fasce([1, 2, 5, 3, 0, 1]),
  perReparto: [
    { chiave: "01", etichetta: "Ortofrutta", box: 3, scontoMedio: 20 },
    { chiave: "02", etichetta: "Latticini", box: 2, scontoMedio: 35 },
    { chiave: "03", etichetta: "Surgelati", box: 1, scontoMedio: null },
  ],
  perMeccanica: [{ chiave: "fidelity", etichetta: "Prezzo Fidelity", box: 4, scontoMedio: 25 }],
  sottocosto: ["b2"],
  conPrezzoAlKg: 3,
  ...campi,
});

const BOX = [
  box("b1"),
  box("b2", { nome: "Olio extravergine", marca: "Marca A", formato: "1 l", prezzo: 0.99, pagina: 3, sottocosto: true }),
  box("b3"),
  box("b4"),
];

describe("PrezziSconti", () => {
  it("le fasce di sconto diventano colonne con il conteggio dei box, anche in tabella", () => {
    render(<PrezziSconti prezziSconti={dati()} box={BOX} />);

    expect(screen.getByRole("img", { name: "Box per fascia di sconto" })).toBeInTheDocument();
    const tabella = screen.getByRole("table", { name: "Box per fascia di sconto" });
    expect(within(tabella).getByRole("rowheader", { name: "Sconto 20–30%" })).toBeInTheDocument();
    expect(within(tabella).getByRole("rowheader", { name: "Sconto ≥ 50%" })).toBeInTheDocument();
    expect(within(tabella).getAllByRole("row")).toHaveLength(7);
  });

  it("lo sconto medio per reparto va dal più alto e lascia fuori i reparti senza sconto", () => {
    render(<PrezziSconti prezziSconti={dati()} box={BOX} />);

    const tabella = screen.getByRole("table", { name: "Sconto medio per reparto" });
    const righe = within(tabella).getAllByRole("rowheader").map(cella => cella.textContent);
    expect(righe).toEqual(["Latticini", "Ortofrutta"]);
    expect(within(tabella).getByText("35%")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Sconto medio per meccanica" })).toHaveTextContent("Prezzo Fidelity");
  });

  it("elenca i box in sottocosto con marca, formato, prezzo e pagina", () => {
    render(<PrezziSconti prezziSconti={dati()} box={BOX} />);

    const blocco = screen.getByRole("region", { name: "Sottocosto" });
    expect(within(blocco).getByText("1 box venduto sotto il costo.")).toBeInTheDocument();
    expect(within(blocco).getByText("Olio extravergine")).toBeInTheDocument();
    expect(within(blocco).getByText("Marca A · 1 l")).toBeInTheDocument();
    expect(within(blocco).getByText("€ 0,99")).toBeInTheDocument();
    expect(within(blocco).getByText("pagina 3")).toBeInTheDocument();
  });

  it("dice quanti box hanno il prezzo al kg sul totale", () => {
    render(<PrezziSconti prezziSconti={dati()} box={BOX} />);

    const blocco = screen.getByRole("region", { name: "Prezzo al kg o al litro" });
    expect(blocco).toHaveTextContent("3 box su 4 (75%)");
  });

  it("senza sconti, sottocosto e reparti mostra stati vuoti sobri", () => {
    render(
      <PrezziSconti
        prezziSconti={dati({ fasce: fasce([]), perReparto: [], perMeccanica: [], sottocosto: [], conPrezzoAlKg: 0 })}
        box={BOX}
      />
    );

    expect(screen.getByText("Nessuno sconto calcolabile")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Box per fascia di sconto" })).not.toBeInTheDocument();
    expect(screen.getByText("Nessun reparto con uno sconto calcolabile.")).toBeInTheDocument();
    expect(screen.getByText("Nessuna meccanica con uno sconto calcolabile.")).toBeInTheDocument();
    expect(screen.getByText("Nessun box in sottocosto.")).toBeInTheDocument();
  });

  it("un id di sottocosto che non è fra i box non rompe l'elenco", () => {
    render(<PrezziSconti prezziSconti={dati({ sottocosto: ["inesistente"] })} box={BOX} />);

    expect(screen.getByText("Nessun box in sottocosto.")).toBeInTheDocument();
  });

  it("oltre le prime dieci righe il sottocosto si allunga con Mostra tutte", () => {
    const molti = Array.from({ length: 12 }, (_, i) => box(`s${i}`, { nome: `Sottocosto ${i}`, sottocosto: true }));
    render(<PrezziSconti prezziSconti={dati({ sottocosto: molti.map(b => b.id) })} box={molti} />);

    const blocco = screen.getByRole("region", { name: "Sottocosto" });
    expect(within(blocco).getAllByRole("listitem")).toHaveLength(10);
    const pulsante = within(blocco).getByRole("button", { name: "Mostra tutte (12)" });
    expect(pulsante).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(pulsante);
    expect(within(blocco).getAllByRole("listitem")).toHaveLength(12);
    expect(within(blocco).getByRole("button", { name: "Mostra le prime 10" })).toHaveAttribute("aria-expanded", "true");
  });

  it("con il prezzo sotto la soglia di copertura dice che il dato è parziale", () => {
    const { rerender } = render(<PrezziSconti prezziSconti={dati()} box={BOX} copertura={{ prezzo: 40, marca: 100, reparto: 100, geometria: 100 }} />);
    expect(screen.getByText(/Dato parziale: il prezzo c'è nel 40% dei box/)).toBeInTheDocument();

    rerender(<PrezziSconti prezziSconti={dati()} box={BOX} copertura={{ prezzo: 90, marca: 100, reparto: 100, geometria: 100 }} />);
    expect(screen.queryByText(/Dato parziale/)).not.toBeInTheDocument();
  });
});

describe("etichettaFascia e vociScontoMedio", () => {
  it("l'ultima fascia è aperta in alto", () => {
    expect(etichettaFascia({ da: 10, a: 20 })).toBe("10–20%");
    expect(etichettaFascia({ da: 50, a: null })).toBe("≥ 50%");
  });

  it("a parità di sconto decide il nome", () => {
    const voci = vociScontoMedio([
      { chiave: "b", etichetta: "Bevande", box: 1, scontoMedio: 10 },
      { chiave: "a", etichetta: "Alimentari", box: 1, scontoMedio: 10 },
    ]);
    expect(voci.map(v => v.id)).toEqual(["a", "b"]);
  });
});
