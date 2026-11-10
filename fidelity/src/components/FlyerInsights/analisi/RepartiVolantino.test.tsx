// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { QuotaSpazio } from "../../../../lib/insightVolantino/tipi";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { RepartiVolantino, vociSpazio } from "./RepartiVolantino";

const quota = (chiave: string, quotaReferenze: number, quotaSpazio: number): QuotaSpazio => ({
  chiave,
  etichetta: chiave,
  referenze: Math.round(quotaReferenze),
  spazio: quotaSpazio,
  quotaReferenze,
  quotaSpazio,
});

const REPARTI = [quota("Latticini", 20, 30), quota("Ortofrutta", 40, 39), quota("Bevande", 40, 31)];

/** Le righe della tabella delle quote: etichetta della voce. */
const vociTabella = () =>
  within(screen.getByRole("table", { name: "Spazio e referenze per reparto" }))
    .getAllByRole("rowheader")
    .map(cella => cella.textContent);

describe("RepartiVolantino", () => {
  it("affianca spazio e referenze di ogni reparto, dal reparto con più spazio, con i nomi dati dal server", () => {
    render(<RepartiVolantino perReparto={[...REPARTI, { ...quota("02", 5, 5), etichetta: "Freschissimi" }]} />);

    expect(vociTabella()).toEqual(["Ortofrutta", "Bevande", "Latticini", "Freschissimi"]);
    expect(screen.getByText("Quota di spazio", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByText("Quota di referenze", { selector: "li" })).toBeInTheDocument();
    // Solo i reparti: niente scelta fra meccanica e marca, niente densità per pagina
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByText(/Densità per pagina/)).not.toBeInTheDocument();
  });

  it("evidenzia chi ha più spazio che referenze, oltre i 2 punti di scarto", () => {
    render(<RepartiVolantino perReparto={REPARTI} />);

    const tabella = screen.getByRole("table", { name: "Spazio e referenze per reparto" });
    const latticini = within(tabella).getByRole("rowheader", { name: "Latticini" }).closest("tr")!;
    expect(latticini).toHaveAttribute("data-evidenziata", "true");
    expect(latticini).toHaveTextContent("+10 punti");

    const ortofrutta = within(tabella).getByRole("rowheader", { name: "Ortofrutta" }).closest("tr")!;
    expect(ortofrutta).not.toHaveAttribute("data-evidenziata");
    expect(screen.getByText(/In evidenza: più spazio che referenze/)).toBeInTheDocument();
  });

  it("senza reparti mostra uno stato vuoto e le note sui dati parziali", () => {
    render(<RepartiVolantino perReparto={[]} copertura={{ prezzo: 100, marca: 100, reparto: 30, geometria: 20 }} />);

    expect(screen.getByText("Reparti non disponibili")).toBeInTheDocument();
    expect(screen.getByText(/il reparto è noto per il 30% dei box/)).toBeInTheDocument();
    expect(screen.getByText(/la posizione nella pagina è nota per il 20% dei box/)).toBeInTheDocument();
  });

  it("oltre dieci reparti la tabella si allunga con Mostra tutte", () => {
    const molti = Array.from({ length: 12 }, (_, i) => quota(`Reparto ${String(i).padStart(2, "0")}`, 5, 20 - i));
    render(<RepartiVolantino perReparto={molti} />);

    expect(vociTabella()).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Mostra tutte (12)" }));
    expect(vociTabella()).toHaveLength(12);
  });
});

describe("RepartiVolantino: sconto medio per reparto", () => {
  it("mostra lo sconto medio di ogni reparto, dal più alto, senza i reparti senza sconto", () => {
    render(
      <RepartiVolantino
        perReparto={REPARTI}
        scontoPerReparto={[
          { chiave: "01", etichetta: "Ortofrutta", box: 3, scontoMedio: 20 },
          { chiave: "02", etichetta: "Latticini", box: 2, scontoMedio: 35 },
          { chiave: "03", etichetta: "Surgelati", box: 1, scontoMedio: null },
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Sconto medio per reparto" })).toBeInTheDocument();
    const tabella = screen.getByRole("table", { name: "Sconto medio per reparto" });
    expect(within(tabella).getAllByRole("rowheader").map(cella => cella.textContent)).toEqual(["Latticini", "Ortofrutta"]);
    expect(within(tabella).getByText("35%")).toBeInTheDocument();
  });

  it("senza reparti con uno sconto lo dice; senza il dato dal server il blocco non c'è", () => {
    const { unmount } = render(<RepartiVolantino perReparto={REPARTI} scontoPerReparto={[]} />);
    expect(screen.getByText("Nessun reparto con uno sconto calcolabile.")).toBeInTheDocument();
    unmount();

    render(<RepartiVolantino perReparto={REPARTI} />);
    expect(screen.queryByRole("heading", { name: "Sconto medio per reparto" })).not.toBeInTheDocument();
  });
});

describe("vociSpazio", () => {
  it("ordina per spazio, poi per referenze", () => {
    expect(vociSpazio([quota("A", 10, 5), quota("B", 20, 5), quota("C", 1, 9)]).map(v => v.id)).toEqual(["C", "B", "A"]);
  });
});
