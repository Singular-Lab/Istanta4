// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { QuotaSpazio, UsoSpazio as DatiUsoSpazio } from "../../../../lib/insightVolantino/tipi";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { sintesiDensita, UsoSpazio, vociSpazio } from "./UsoSpazio";

const quota = (chiave: string, quotaReferenze: number, quotaSpazio: number): QuotaSpazio => ({
  chiave,
  etichetta: chiave,
  referenze: Math.round(quotaReferenze),
  spazio: quotaSpazio,
  quotaReferenze,
  quotaSpazio,
});

const dati = (campi: Partial<DatiUsoSpazio> = {}): DatiUsoSpazio => ({
  perReparto: [quota("Latticini", 20, 30), quota("Ortofrutta", 40, 39), quota("Bevande", 40, 31)],
  perMeccanica: [],
  perMarca: [quota("Marca A", 10, 12)],
  perPagina: [
    { pagina: 2, box: 8, spazioOccupato: 70 },
    { pagina: 1, box: 3, spazioOccupato: 30 },
  ],
  ...campi,
});

/** Le righe della tabella delle quote: etichetta della voce. */
const vociTabella = (nome: string) =>
  within(screen.getByRole("table", { name: nome }))
    .getAllByRole("rowheader")
    .map(cella => cella.textContent);

describe("UsoSpazio", () => {
  it("per reparto affianca spazio e referenze, dal reparto con più spazio", () => {
    render(<UsoSpazio spazio={dati()} />);

    expect(screen.getByRole("heading", { name: "Spazio e referenze per reparto" })).toBeInTheDocument();
    expect(vociTabella("Spazio e referenze per reparto")).toEqual(["Ortofrutta", "Bevande", "Latticini"]);
    expect(screen.getByText("Quota di spazio", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByText("Quota di referenze", { selector: "li" })).toBeInTheDocument();
  });

  it("evidenzia chi ha più spazio che referenze, oltre i 2 punti di scarto", () => {
    render(<UsoSpazio spazio={dati()} />);

    const tabella = screen.getByRole("table", { name: "Spazio e referenze per reparto" });
    const latticini = within(tabella).getByRole("rowheader", { name: "Latticini" }).closest("tr")!;
    expect(latticini).toHaveAttribute("data-evidenziata", "true");
    expect(latticini).toHaveTextContent("+10 punti");
    expect(within(latticini).getByText(/più spazio che referenze/)).toHaveClass("sr-only");

    // Un punto sotto le referenze non è in evidenza
    const ortofrutta = within(tabella).getByRole("rowheader", { name: "Ortofrutta" }).closest("tr")!;
    expect(ortofrutta).not.toHaveAttribute("data-evidenziata");
    expect(ortofrutta).toHaveTextContent("−1 punti");
    expect(screen.getByText(/In evidenza: più spazio che referenze/)).toBeInTheDocument();
  });

  it("si raggruppa per marca o per meccanica; senza meccaniche riconosciute lo dice", () => {
    render(<UsoSpazio spazio={dati()} />);

    fireEvent.click(screen.getByRole("radio", { name: /Marca/ }));
    expect(vociTabella("Spazio e referenze per marca")).toEqual(["Marca A"]);

    fireEvent.click(screen.getByRole("radio", { name: /Meccanica/ }));
    expect(screen.getByText("Meccaniche non riconosciute")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /Spazio e referenze/ })).not.toBeInTheDocument();
  });

  it("la densità per pagina va in ordine di pagina con la sintesi della pagina più piena", () => {
    render(<UsoSpazio spazio={dati()} />);

    const tabella = screen.getByRole("table", { name: "Pagina coperta dai box" });
    expect(within(tabella).getAllByRole("rowheader").map(cella => cella.textContent)).toEqual(["Pagina 1", "Pagina 2"]);
    expect(within(tabella).getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("In media i box coprono il 50% della pagina; la più piena è la 2 (70%).")).toBeInTheDocument();
  });

  it("senza posizioni nelle pagine mostra uno stato vuoto e la nota sul dato parziale", () => {
    render(
      <UsoSpazio
        spazio={dati({ perReparto: [], perPagina: [] })}
        copertura={{ prezzo: 100, marca: 100, reparto: 0, geometria: 20 }}
      />
    );

    expect(screen.getByText("Reparti non disponibili")).toBeInTheDocument();
    expect(screen.getByText("Posizioni non disponibili")).toBeInTheDocument();
    expect(screen.getByText(/la posizione nella pagina è nota per il 20% dei box/)).toBeInTheDocument();
  });

  it("oltre dieci voci la tabella si allunga con Mostra tutte", () => {
    const marche = Array.from({ length: 12 }, (_, i) => quota(`Marca ${String(i).padStart(2, "0")}`, 5, 20 - i));
    render(<UsoSpazio spazio={dati({ perMarca: marche })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Marca/ }));

    expect(vociTabella("Spazio e referenze per marca")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Mostra tutte (12)" }));
    expect(vociTabella("Spazio e referenze per marca")).toHaveLength(12);
  });
});

describe("vociSpazio e sintesiDensita", () => {
  it("ordina per spazio, poi per referenze", () => {
    expect(vociSpazio([quota("A", 10, 5), quota("B", 20, 5), quota("C", 1, 9)]).map(v => v.id)).toEqual(["C", "B", "A"]);
  });

  it("senza pagine non c'è sintesi", () => {
    expect(sintesiDensita([])).toBeNull();
  });
});
