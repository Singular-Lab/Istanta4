// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MarcaInsight, MarcheVolantino as DatiMarche } from "../../../../lib/insightVolantino/tipi";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { MarcheVolantino, ordinaMarche } from "./MarcheVolantino";

const marca = (nome: string, campi: Partial<MarcaInsight> = {}): MarcaInsight => ({
  chiave: nome.toUpperCase(),
  nome,
  box: 1,
  referenze: 1,
  quotaSpazio: 1,
  scontoMedio: null,
  distributore: false,
  ...campi,
});

const ELENCO = [
  marca("Marca A", { box: 5, referenze: 7, quotaSpazio: 30, scontoMedio: 20, distributore: true }),
  marca("Marca B", { box: 9, referenze: 9, quotaSpazio: 20, scontoMedio: null }),
  marca("Marca C", { box: 2, referenze: 2, quotaSpazio: 10, scontoMedio: 40 }),
];

const dati = (campi: Partial<DatiMarche> = {}): DatiMarche => ({ elenco: ELENCO, quotaDistributore: null, ...campi });

const tabella = () => screen.getByRole("table", { name: "Marche nel volantino" });
const marcheInTabella = () =>
  within(tabella())
    .getAllByRole("row")
    .slice(1)
    .map(riga => within(riga).getAllByRole("cell")[0].textContent);

describe("MarcheVolantino", () => {
  it("elenca le marche dalla quota di spazio più alta, con box, referenze, spazio e sconto medio", () => {
    render(<MarcheVolantino marche={dati()} />);

    expect(marcheInTabella()).toEqual(["Marca A", "Marca B", "Marca C"]);
    const primaRiga = within(tabella()).getAllByRole("row")[1];
    expect(primaRiga).toHaveTextContent("5");
    expect(primaRiga).toHaveTextContent("7");
    expect(primaRiga).toHaveTextContent("30%");
    expect(primaRiga).toHaveTextContent("20%");
    // Lo sconto mancante resta un trattino
    expect(within(tabella()).getAllByRole("row")[2]).toHaveTextContent("—");
    expect(screen.getByRole("columnheader", { name: /Quota di spazio/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("si ordina cliccando le intestazioni; gli sconti mancanti restano in fondo in tutte e due le direzioni", () => {
    render(<MarcheVolantino marche={dati()} />);

    fireEvent.click(screen.getByRole("button", { name: /Sconto medio/ }));
    expect(marcheInTabella()).toEqual(["Marca C", "Marca A", "Marca B"]);
    expect(screen.getByRole("columnheader", { name: /Sconto medio/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: /Quota di spazio/ })).not.toHaveAttribute("aria-sort");

    fireEvent.click(screen.getByRole("button", { name: /Sconto medio/ }));
    expect(marcheInTabella()).toEqual(["Marca A", "Marca C", "Marca B"]);
    expect(screen.getByRole("columnheader", { name: /Sconto medio/ })).toHaveAttribute("aria-sort", "ascending");

    // Il nome, la prima volta, dalla A
    fireEvent.click(screen.getByRole("button", { name: /^Marca/ }));
    expect(marcheInTabella()).toEqual(["Marca A", "Marca B", "Marca C"]);
  });

  it("senza marche del distributore nella config non mostra badge né quota, anche se una marca lo sarebbe", () => {
    render(<MarcheVolantino marche={dati({ quotaDistributore: null })} />);

    expect(screen.queryByText("Marca del distributore")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Marche del distributore" })).not.toBeInTheDocument();
  });

  it("con le marche del distributore mostra il badge sulle sue marche e la sua quota di spazio e di box", () => {
    render(<MarcheVolantino marche={dati({ quotaDistributore: { quotaSpazio: 30, quotaBox: 31.3 } })} />);

    const righe = within(tabella()).getAllByRole("row");
    expect(within(righe[1]).getByText("Marca del distributore")).toBeInTheDocument();
    expect(within(righe[2]).queryByText("Marca del distributore")).not.toBeInTheDocument();

    const blocco = screen.getByRole("region", { name: "Marche del distributore" });
    expect(within(blocco).getByText("Quota di spazio", { selector: "dt" }).closest("[data-tono]")).toHaveTextContent("30%");
    expect(within(blocco).getByText("Quota di box", { selector: "dt" }).closest("[data-tono]")).toHaveTextContent("31,3%");
  });

  it("mostra le prime 15 marche e le altre con Mostra tutte", () => {
    const molte = Array.from({ length: 20 }, (_, i) => marca(`Marca ${String(i).padStart(2, "0")}`, { quotaSpazio: 40 - i }));
    render(<MarcheVolantino marche={dati({ elenco: molte })} />);

    expect(marcheInTabella()).toHaveLength(15);
    fireEvent.click(screen.getByRole("button", { name: "Mostra tutte (20)" }));
    expect(marcheInTabella()).toHaveLength(20);
    expect(screen.getByRole("button", { name: "Mostra le prime 15" })).toHaveAttribute("aria-expanded", "true");
  });

  it("senza marche mostra uno stato vuoto e, con la marca poco nota, la nota sul dato parziale", () => {
    const { rerender } = render(<MarcheVolantino marche={dati({ elenco: [] })} />);
    expect(screen.getByText("Nessuna marca riconosciuta")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    rerender(<MarcheVolantino marche={dati()} copertura={{ prezzo: 100, marca: 25, reparto: 100, geometria: 100 }} />);
    expect(screen.getByText(/la marca è nota per il 25% dei box/)).toBeInTheDocument();
  });
});

describe("ordinaMarche", () => {
  it("a parità di valore decide lo spazio, poi il nome", () => {
    const elenco = [marca("Bravo", { box: 2, quotaSpazio: 5 }), marca("Alfa", { box: 2, quotaSpazio: 5 }), marca("Delta", { box: 2, quotaSpazio: 9 })];
    expect(ordinaMarche(elenco, "box", "desc").map(m => m.nome)).toEqual(["Delta", "Alfa", "Bravo"]);
  });
});
