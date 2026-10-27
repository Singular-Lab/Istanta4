// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STATO_ORDINI_STAMPA } from "../../../../lib/enums";
import ODSCompletatiSection from "./ODSCompletatiSection";

const ordine = (id: string, stato: string, data_di_conferma: string | null = "2026-09-03T10:30:00") =>
  ({ id: `${id}-0000-0000-0000-000000000000`, stato, data_di_conferma, nomePromo: `Promo ${id}` }) as any;

const disegna = (ordini: any[], onViewDetails = vi.fn()) => {
  render(<ODSCompletatiSection ordini={ordini} searchQuery="" onSearchQueryChange={vi.fn()} onViewDetails={onViewDetails} />);
  return onViewDetails;
};

const rigaDi = (testo: string) => screen.getAllByRole("row").find((riga) => within(riga).queryByText(testo))!;

describe("ODSCompletatiSection", () => {
  it("ogni stato dell'ordine si legge con l'etichetta del catalogo", () => {
    disegna([
      ordine("a", STATO_ORDINI_STAMPA.FINITO),
      ordine("b", STATO_ORDINI_STAMPA.IN_REVISIONE),
      ordine("c", STATO_ORDINI_STAMPA.REVISIONATO),
      ordine("d", STATO_ORDINI_STAMPA.IN_INVIO),
      ordine("e", STATO_ORDINI_STAMPA.ERRORE),
    ]);

    expect(within(rigaDi("Promo a")).getByText("Completato")).toBeInTheDocument();
    expect(within(rigaDi("Promo b")).getByText("In revisione")).toBeInTheDocument();
    expect(within(rigaDi("Promo c")).getByText("Revisionato")).toBeInTheDocument();
    expect(within(rigaDi("Promo d")).getByText("Invio in corso")).toBeInTheDocument();
    expect(within(rigaDi("Promo e")).getByText("Errore")).toBeInTheDocument();
  });

  it("uno stato fuori catalogo non viene mostrato col valore grezzo", () => {
    disegna([ordine("f", "annullato")]);

    expect(within(rigaDi("Promo f")).getByText("Stato sconosciuto")).toBeInTheDocument();
    expect(screen.queryByText("annullato")).not.toBeInTheDocument();
  });

  it("la data di conferma è nel formato DD/MM/YYYY HH:mm", () => {
    disegna([ordine("g", STATO_ORDINI_STAMPA.FINITO, "2026-09-03T10:30:00")]);

    expect(within(rigaDi("Promo g")).getByText("03/09/2026 10:30")).toBeInTheDocument();
  });

  it("senza data di conferma mostra N/D", () => {
    disegna([ordine("h", STATO_ORDINI_STAMPA.FINITO, null)]);

    expect(within(rigaDi("Promo h")).getByText("N/D")).toBeInTheDocument();
    expect(screen.queryByText("Data non disponibile")).not.toBeInTheDocument();
  });

  it("Visualizza apre il dettaglio dell'ordine della riga", () => {
    const voce = ordine("i", STATO_ORDINI_STAMPA.FINITO);
    const onViewDetails = disegna([ordine("l", STATO_ORDINI_STAMPA.FINITO), voce]);

    fireEvent.click(within(rigaDi("Promo i")).getByRole("button", { name: "Visualizza" }));

    expect(onViewDetails).toHaveBeenCalledTimes(1);
    expect(onViewDetails).toHaveBeenCalledWith(voce.id);
  });
});
