// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STATO_ORDINI_STAMPA } from "../../../../lib/enums";
import ODSInCorsoSection from "./ODSInCorsoSection";

const ordine = (id: string, nomePromo: string, stato: string, data_di_conferma: string | null = "2026-09-03T10:30:00") =>
  ({ id: `${id}-0000-0000-0000-000000000000`, stato, data_di_conferma, nomePromo }) as any;

const disegna = (ordini: any[], searchQuery = "") =>
  render(
    <ODSInCorsoSection ordini={ordini} searchQuery={searchQuery} onSearchQueryChange={vi.fn()} onRevisioneClick={vi.fn()} />
  );

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

  it("il filtro Invio in corso mostra solo gli ordini in invio e risulta scelto", () => {
    disegna([
      ordine("a", "Volantino settembre", STATO_ORDINI_STAMPA.IN_REVISIONE),
      ordine("b", "Volantino ottobre", STATO_ORDINI_STAMPA.IN_INVIO),
    ]);

    const gruppo = screen.getByRole("radiogroup", { name: "Stato" });
    const tutti = within(gruppo).getByRole("radio", { name: "Tutti 2" });
    const inInvio = within(gruppo).getByRole("radio", { name: "Invio in corso 1" });
    expect(tutti).toHaveAttribute("aria-checked", "true");
    expect(inInvio).toHaveAttribute("aria-checked", "false");

    fireEvent.click(inInvio);

    expect(within(gruppo).getByRole("radio", { name: "Invio in corso 1" })).toHaveAttribute("aria-checked", "true");
    expect(within(gruppo).getByRole("radio", { name: "Tutti 2" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Volantino ottobre")).toBeInTheDocument();
    expect(screen.queryByText("Volantino settembre")).not.toBeInTheDocument();
  });

  it("le intestazioni ordinabili sono pulsanti e solo la colonna ordinata espone aria-sort", () => {
    disegna([
      ordine("a", "Beta", STATO_ORDINI_STAMPA.IN_REVISIONE),
      ordine("b", "Alfa", STATO_ORDINI_STAMPA.REVISIONATO),
    ]);

    // Di partenza ordina per giorni di attesa, dal più vecchio
    expect(intestazione("Giorni di attesa")).toHaveAttribute("aria-sort", "descending");
    expect(intestazione("Promozione")).not.toHaveAttribute("aria-sort");

    fireEvent.click(screen.getByRole("button", { name: "Promozione" }));
    fireEvent.click(screen.getByRole("button", { name: "Promozione" }));

    expect(intestazione("Promozione")).toHaveAttribute("aria-sort", "ascending");
    expect(intestazione("Giorni di attesa")).not.toHaveAttribute("aria-sort");
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

  it("i KPI stanno sopra la sezione e gli ordini oltre 30 giorni sono segnati In ritardo", () => {
    const vecchia = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    disegna([
      ordine("a", "Ordine vecchio", STATO_ORDINI_STAMPA.IN_REVISIONE, vecchia),
      ordine("b", "Ordine recente", STATO_ORDINI_STAMPA.IN_REVISIONE, new Date().toISOString()),
    ]);

    const sezione = screen.getByRole("region", { name: "Ordini in corso" });
    const kpi = screen.getByText("In ritardo", { selector: "dt" });
    expect(sezione).not.toContainElement(kpi);
    expect(kpi.closest("dl")).toHaveTextContent("1");

    const riga = (testo: string) => righeDati().find((r) => within(r).queryByText(testo))!;
    expect(within(riga("Ordine vecchio")).getByText("In ritardo")).toBeInTheDocument();
    expect(within(riga("Ordine recente")).queryByText("In ritardo")).not.toBeInTheDocument();
  });

  it("la ricerca sta dentro la sezione degli ordini e filtra per promozione", () => {
    disegna(
      [
        ordine("a", "Volantino settembre", STATO_ORDINI_STAMPA.IN_REVISIONE),
        ordine("b", "Volantino ottobre", STATO_ORDINI_STAMPA.IN_REVISIONE),
      ],
      "ottobre"
    );

    const sezione = screen.getByRole("region", { name: "Ordini in corso" });
    expect(within(sezione).getByRole("searchbox", { name: "Cerca ordini" })).toHaveValue("ottobre");
    expect(screen.getByText("Volantino ottobre")).toBeInTheDocument();
    expect(screen.queryByText("Volantino settembre")).not.toBeInTheDocument();
  });

  it("senza risultati lo stato vuoto occupa tutte le colonne della tabella", () => {
    disegna([ordine("a", "Volantino settembre", STATO_ORDINI_STAMPA.IN_REVISIONE)], "inesistente");

    const cella = screen.getByText("Nessun risultato trovato").closest("td")!;
    expect(cella).toHaveAttribute("colspan", "5");
  });
});
