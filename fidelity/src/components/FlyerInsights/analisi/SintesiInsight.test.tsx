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
    expect(riquadro("Sconto medio")).toHaveTextContent("27,8%");
    expect(riquadro("Sconto medio")).toHaveTextContent("42 box scontati");
    expect(riquadro("Prezzo Fidelity")).toHaveTextContent("12,5%");
    // Senza i box il conteggio si ricava dalla quota: 12,5% di 80
    expect(riquadro("Prezzo Fidelity")).toHaveTextContent("10 box");
    expect(riquadro("Sottocosto")).toHaveTextContent("3");
    expect(riquadro("Marche")).toHaveTextContent("35");
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

  it("con le linee del distributore aggiunge il riquadro in evidenza dei suoi marchi e il dettaglio delle marche", () => {
    render(<SintesiInsight sintesi={sintesi()} lineeDistributore={LINEE} />);

    const marchi = riquadro("Marchi del distributore");
    expect(marchi).toHaveAttribute("data-evidenza", "true");
    expect(marchi).toHaveTextContent("18,4%");
    expect(marchi).toHaveTextContent("dello spazio, 12 box");
    expect(riquadro("Marche")).toHaveTextContent("di cui 2 linee del distributore");
  });

  it("senza linee del distributore il riquadro dei marchi non c'è", () => {
    render(<SintesiInsight sintesi={sintesi()} lineeDistributore={null} />);

    expect(screen.queryByText("Marchi del distributore")).not.toBeInTheDocument();
    expect(riquadro("Marche")).not.toHaveTextContent("di cui");
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

    expect(riquadro("Sconto medio")).toHaveTextContent("N/D");
    expect(riquadro("Pagine")).not.toHaveTextContent("a pagina");
    expect(screen.queryByText(/Dati parziali/)).not.toBeInTheDocument();
  });
});

describe("numeriSintesi e testoCoperturaParziale", () => {
  it("l'ordine dei riquadri: i marchi del distributore prima delle marche, solo se dichiarati", () => {
    expect(numeriSintesi(sintesi()).map(n => n.id)).toEqual(["referenze", "pagine", "scontoMedio", "fidelity", "sottocosto", "marche"]);
    expect(numeriSintesi(sintesi(), undefined, LINEE).map(n => n.id)).toEqual([
      "referenze",
      "pagine",
      "scontoMedio",
      "fidelity",
      "sottocosto",
      "distributore",
      "marche",
    ]);
  });

  it("al singolare con un box e una linea", () => {
    const numeri = numeriSintesi(sintesi({ box: 1, boxConSconto: 1 }), [{ meccanica: "fidelity" }], { ...LINEE, box: 1, linee: [LINEE.linee[0]] });
    const numero = (id: string) => numeri.find(n => n.id === id)!;

    expect(numero("referenze").sottotitolo).toBe("1 box");
    expect(numero("scontoMedio").sottotitolo).toBe("1 box scontato");
    expect(numero("distributore").sottotitolo).toBe("dello spazio, 1 box");
    expect(numero("marche").sottotitolo).toBe("di cui 1 linea del distributore");
  });

  it("solo i dati sotto il 60% entrano nella nota", () => {
    expect(testoCoperturaParziale({ prezzo: 100, marca: 59, reparto: 60, geometria: 10 })).toBe(
      "la marca nel 59% dei box, la posizione nella pagina nel 10%"
    );
    expect(testoCoperturaParziale({ prezzo: 60, marca: 100, reparto: 100, geometria: 100 })).toBeNull();
  });
});
