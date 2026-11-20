// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LineeDistributore, SintesiVolantino } from "../../../../lib/insightVolantino/tipi";

// analisi.ts dei punti vendita legge la rete delle insegne solo nei suoi hook, qui non usati
vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { numeriSintesi, SintesiInsight, testoCoperturaParziale } from "./SintesiInsight";

const sintesi = (campi: Partial<SintesiVolantino> = {}): SintesiVolantino => ({
  referenze: 120,
  box: 80,
  pagine: 16,
  scontoMedio: 27.84,
  boxConSconto: 42,
  quotaFidelity: 12.5,
  sottocosto: 3,
  marche: 35,
  copertura: { prezzo: 100, marca: 100, reparto: 100, geometria: 100 },
  ...campi,
});

const LINEE: LineeDistributore = {
  quotaSpazio: 18.4,
  quotaBox: 15,
  box: 12,
  linee: [
    { sigla: "SD", nome: "Sapori & Dintorni", colore: "#b45309", logo: null, box: 7, referenze: 9, quotaSpazio: 11.2, scontoMedio: 20 },
    { sigla: "VB", nome: "Verso Natura", colore: null, logo: null, box: 5, referenze: 5, quotaSpazio: 7.2, scontoMedio: null },
  ],
  bolli: [],
};

/** Il riquadro (dl con data-numero) che ha questa etichetta. */
const riquadro = (etichetta: string) => screen.getByText(etichetta, { selector: "dt span" }).closest("[data-numero]") as HTMLElement;

describe("SintesiInsight", () => {
  it("mostra i numeri chiave in riquadri separati, con il dettaglio sotto ciascuno", () => {
    render(<SintesiInsight sintesi={sintesi()} />);

    expect(riquadro("Referenze")).toHaveTextContent("120");
    expect(riquadro("Referenze")).toHaveTextContent("80 box");
    expect(riquadro("Pagine")).toHaveTextContent("16");
    expect(riquadro("Pagine")).toHaveTextContent("5 box a pagina");
    expect(riquadro("Prezzo Fidelity")).toHaveTextContent("12,5%");
    // Senza i box il conteggio si ricava dalla quota: 12,5% di 80
    expect(riquadro("Prezzo Fidelity")).toHaveTextContent("10 box");
  });

  // Richiesta del 2026-11-19: niente indicatori dei sottocosto e delle marche; TASK-26449b2d: né lo sconto medio
  it("non mostra i riquadri Sconto medio, Sottocosto e Marche", () => {
    render(<SintesiInsight sintesi={sintesi()} lineeDistributore={LINEE} />);

    expect(screen.queryByText("Sconto medio", { selector: "dt span" })).not.toBeInTheDocument();
    expect(screen.queryByText("Sottocosto", { selector: "dt span" })).not.toBeInTheDocument();
    expect(screen.queryByText("Marche", { selector: "dt span" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-numero="scontoMedio"], [data-numero="sottocosto"], [data-numero="marche"]')).toBeNull();
    expect(screen.queryByText(/box scontat/)).not.toBeInTheDocument();
  });

  it("non confronta con altre edizioni: niente variazioni né \"prima\"", () => {
    render(<SintesiInsight sintesi={sintesi()} />);

    expect(document.querySelector("[data-direzione]")).toBeNull();
    expect(screen.queryByText(/prima /)).not.toBeInTheDocument();
    expect(screen.queryByText(/edizione precedente/)).not.toBeInTheDocument();
  });

  it("conta i box con il Prezzo Fidelity sui box, quando ci sono", () => {
    render(<SintesiInsight sintesi={sintesi()} box={[{ meccanica: "fidelity" }, { meccanica: "sconto" }, { meccanica: "fidelity" }]} />);

    expect(riquadro("Prezzo Fidelity")).toHaveTextContent("2 box");
  });

  // TASK-7b68e012: le linee del distributore si chiamano Private Labels; TASK-26449b2d: riquadro bianco come gli altri
  it("con le linee del distributore aggiunge il riquadro Private Labels, bianco come gli altri", () => {
    render(<SintesiInsight sintesi={sintesi()} lineeDistributore={LINEE} />);

    const marchi = riquadro("Private Labels");
    expect(marchi).not.toHaveAttribute("data-evidenza");
    expect(marchi.className).toBe(riquadro("Referenze").className);
    expect(marchi).toHaveClass("bg-white");
    expect(marchi).not.toHaveClass("bg-theme-1");
    expect(marchi).toHaveTextContent("18,4%");
    expect(marchi).toHaveTextContent("dello spazio, 12 box");
    expect(screen.queryByText(/Marchi del distributore|linee del distributore/)).not.toBeInTheDocument();
  });

  it("senza linee del distributore il riquadro dei marchi non c'è", () => {
    render(<SintesiInsight sintesi={sintesi()} lineeDistributore={null} />);

    expect(screen.queryByText("Private Labels")).not.toBeInTheDocument();
  });

  it("segnala i dati parziali sotto la soglia di copertura, e tace quando la copertura è buona", () => {
    const { rerender } = render(<SintesiInsight sintesi={sintesi({ copertura: { prezzo: 42, marca: 30, reparto: 80, geometria: 100 } })} />);

    expect(screen.getByText(/Dati parziali: il prezzo nel 42% dei box, la marca nel 30%/)).toBeInTheDocument();

    rerender(<SintesiInsight sintesi={sintesi()} />);
    expect(screen.queryByText(/Dati parziali/)).not.toBeInTheDocument();
  });

  it("un volantino senza box mostra zeri e N/D, senza la nota sulla copertura", () => {
    render(
      <SintesiInsight
        sintesi={sintesi({ referenze: 0, box: 0, pagine: 0, scontoMedio: null, boxConSconto: 0, quotaFidelity: 0, sottocosto: 0, marche: 0, copertura: { prezzo: 0, marca: 0, reparto: 0, geometria: 0 } })}
      />
    );

    expect(riquadro("Referenze")).toHaveTextContent("0");
    expect(riquadro("Prezzo Fidelity")).toHaveTextContent("0 box");
    expect(riquadro("Pagine")).not.toHaveTextContent("a pagina");
    expect(screen.queryByText(/Dati parziali/)).not.toBeInTheDocument();
  });
});

describe("numeriSintesi e testoCoperturaParziale", () => {
  it("l'ordine dei riquadri: le Private Labels in fondo, solo se dichiarate; niente sconto medio, sottocosto e marche", () => {
    expect(numeriSintesi(sintesi()).map(n => n.id)).toEqual(["referenze", "pagine", "fidelity"]);
    expect(numeriSintesi(sintesi(), undefined, LINEE).map(n => n.id)).toEqual(["referenze", "pagine", "fidelity", "distributore"]);
  });

  it("al singolare con un box e una linea", () => {
    const numeri = numeriSintesi(sintesi({ box: 1, boxConSconto: 1 }), [{ meccanica: "fidelity" }], { ...LINEE, box: 1, linee: [LINEE.linee[0]] });
    const numero = (id: string) => numeri.find(n => n.id === id)!;

    expect(numero("referenze").sottotitolo).toBe("1 box");
    expect(numero("fidelity").sottotitolo).toBe("1 box");
    expect(numero("distributore").sottotitolo).toBe("dello spazio, 1 box");
  });

  it("solo i dati sotto il 60% entrano nella nota", () => {
    expect(testoCoperturaParziale({ prezzo: 100, marca: 59, reparto: 60, geometria: 10 })).toBe(
      "la marca nel 59% dei box, la posizione nella pagina nel 10%"
    );
    expect(testoCoperturaParziale({ prezzo: 60, marca: 100, reparto: 100, geometria: 100 })).toBeNull();
  });
});
