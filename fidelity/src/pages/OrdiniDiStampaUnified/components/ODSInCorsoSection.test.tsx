// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STATO_ORDINI_STAMPA } from "../../../../lib/enums";
import ODSInCorsoSection from "./ODSInCorsoSection";

const ordine = (id: string, nomePromo: string, stato: string, data_di_conferma: string | null = "2026-09-03T10:30:00") =>
  ({ id: `${id}-0000-0000-0000-000000000000`, stato, data_di_conferma, nomePromo }) as any;

const disegna = (ordini: any[]) =>
  render(<ODSInCorsoSection ordini={ordini} searchQuery="" onRevisioneClick={vi.fn()} />);

const righeDati = () => screen.getAllByRole("row").slice(1);

const intestazione = (nome: string) => screen.getByRole("button", { name: nome }).closest("th")!;

describe("ODSInCorsoSection", () => {
  it("lo stato dell'ordine si legge con l'etichetta del catalogo", () => {
    disegna([
      ordine("a", "Volantino settembre", STATO_ORDINI_STAMPA.IN_REVISIONE),
      ordine("b", "Volantino ottobre", STATO_ORDINI_STAMPA.IN_INVIO),
    ]);

    const riga = (testo: string) => righeDati().find((r) => within(r).queryByText(testo))!;
    expect(within(riga("Volantino settembre")).getByText("In revisione")).toBeInTheDocument();
    expect(within(riga("Volantino ottobre")).getByText("Invio in corso")).toBeInTheDocument();
    expect(screen.queryByText("In invio")).not.toBeInTheDocument();
  });

  it("il filtro Invio in corso mostra solo gli ordini in invio e risulta premuto", () => {
    disegna([
      ordine("a", "Volantino settembre", STATO_ORDINI_STAMPA.IN_REVISIONE),
      ordine("b", "Volantino ottobre", STATO_ORDINI_STAMPA.IN_INVIO),
    ]);

    const tutti = screen.getByRole("button", { name: "Tutti (2)" });
    const inInvio = screen.getByRole("button", { name: "Invio in corso (1)" });
    expect(tutti).toHaveAttribute("aria-pressed", "true");
    expect(inInvio).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(inInvio);

    expect(screen.getByRole("button", { name: "Invio in corso (1)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tutti (2)" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Volantino ottobre")).toBeInTheDocument();
    expect(screen.queryByText("Volantino settembre")).not.toBeInTheDocument();
  });

  it("le intestazioni ordinabili sono pulsanti e solo la colonna ordinata espone aria-sort", () => {
    disegna([
      ordine("a", "Beta", STATO_ORDINI_STAMPA.IN_REVISIONE),
      ordine("b", "Alfa", STATO_ORDINI_STAMPA.REVISIONATO),
    ]);

    // Di partenza ordina per giorni di attesa, dal più vecchio
    expect(intestazione("Giorni Attesa")).toHaveAttribute("aria-sort", "descending");
    expect(intestazione("Promozione")).not.toHaveAttribute("aria-sort");

    fireEvent.click(screen.getByRole("button", { name: "Promozione" }));
    fireEvent.click(screen.getByRole("button", { name: "Promozione" }));

    expect(intestazione("Promozione")).toHaveAttribute("aria-sort", "ascending");
    expect(intestazione("Giorni Attesa")).not.toHaveAttribute("aria-sort");
    expect(within(righeDati()[0]).getByText("Alfa")).toBeInTheDocument();
    expect(within(righeDati()[1]).getByText("Beta")).toBeInTheDocument();
  });

  it("la data di conferma è nel formato DD/MM/YYYY e senza data resta In attesa", () => {
    disegna([
      ordine("a", "Con data", STATO_ORDINI_STAMPA.IN_REVISIONE, "2026-09-03T10:30:00"),
      ordine("b", "Senza data", STATO_ORDINI_STAMPA.IN_REVISIONE, null),
    ]);

    const riga = (testo: string) => righeDati().find((r) => within(r).queryByText(testo))!;
    expect(within(riga("Con data")).getByText("03/09/2026")).toBeInTheDocument();
    expect(within(riga("Senza data")).getByText("In attesa")).toBeInTheDocument();
  });
});
