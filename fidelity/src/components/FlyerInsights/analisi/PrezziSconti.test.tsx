// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoxInsight, PrezziSconti as DatiPrezziSconti } from "../../../../lib/insightVolantino/tipi";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { PrezziSconti } from "./PrezziSconti";

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
  // TASK-26449b2d: nella sezione Meccaniche solo il sottocosto, niente sconti
  it("non mostra le fasce di sconto né lo sconto medio per meccanica o per reparto", () => {
    render(<PrezziSconti prezziSconti={dati()} box={BOX} />);

    expect(screen.queryByRole("heading", { name: "Fasce di sconto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Box per fascia di sconto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Sconto medio per meccanica" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Sconto medio per reparto" })).not.toBeInTheDocument();
    expect(screen.queryByText(/sconto/i)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Sottocosto" })).toBeInTheDocument();
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

  it("senza box in sottocosto lo dice, con un testo sobrio", () => {
    render(<PrezziSconti prezziSconti={dati({ fasce: fasce([]), perReparto: [], perMeccanica: [], sottocosto: [], conPrezzoAlKg: 0 })} box={BOX} />);

    expect(screen.getByText("Nessun box in sottocosto.")).toBeInTheDocument();
    expect(screen.queryByText("Nessuno sconto calcolabile")).not.toBeInTheDocument();
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
});
