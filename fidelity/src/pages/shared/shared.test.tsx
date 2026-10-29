// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/server_call", () => ({ ServerCall: { getUrl: () => "http://test" } }));

import CardVolantino from "./CardVolantino";
import IntestazioneOrdinabile from "./IntestazioneOrdinabile";
import SpecificheLavorazione from "./SpecificheLavorazione";

describe("IntestazioneOrdinabile", () => {
  it("è un pulsante con il nome della colonna e risponde al click", () => {
    const onClick = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <th>
              <IntestazioneOrdinabile direzione="asc" onClick={onClick}>
                Scadenza
              </IntestazioneOrdinabile>
            </th>
          </tr>
        </thead>
      </table>
    );

    fireEvent.click(screen.getByRole("button", { name: "Scadenza" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("SpecificheLavorazione", () => {
  it("raggruppa i campi sotto la legenda Specifiche di lavorazione", () => {
    render(
      <SpecificheLavorazione>
        <label htmlFor="campo">Formato</label>
        <input id="campo" />
      </SpecificheLavorazione>
    );

    const gruppo = screen.getByRole("group", { name: "Specifiche di lavorazione" });
    expect(within(gruppo).getByLabelText("Formato")).toBeInTheDocument();
  });

  it("durante il caricamento non mostra i campi e segnala l'attesa", () => {
    render(
      <SpecificheLavorazione caricamento>
        <input aria-label="Formato" />
      </SpecificheLavorazione>
    );

    expect(screen.getByRole("group", { name: "Specifiche di lavorazione" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByLabelText("Formato")).not.toBeInTheDocument();
  });
});

describe("CardVolantino", () => {
  const apri = (props: Partial<Parameters<typeof CardVolantino>[0]> = {}) =>
    render(
      <MemoryRouter>
        <CardVolantino titolo="Volantino Nord" stato="PUBBLICATO" {...props} />
      </MemoryRouter>
    );

  it("mostra il periodo di validità nel formato DD/MM/YYYY", () => {
    apri({ validitaDal: "2026-10-05", validitaAl: "2026-10-20" });

    expect(screen.getByText("05/10/2026 – 20/10/2026")).toBeInTheDocument();
  });

  it("il titolo porta alla scheda del kit e la promo alla sua pagina", () => {
    apri({ collegamento: "/promozioni/in-corso/dettagli/p1/kits/k1", promo: { nome: "Ottobre", collegamento: "/promozioni/in-corso/dettagli/p1" } });

    expect(screen.getByRole("link", { name: "Volantino Nord" })).toHaveAttribute("href", "/promozioni/in-corso/dettagli/p1/kits/k1");
    expect(screen.getByRole("link", { name: "Promo: Ottobre" })).toHaveAttribute("href", "/promozioni/in-corso/dettagli/p1");
  });

  it("senza file scaricabile né anteprima i comandi sono disattivati", () => {
    apri();

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scarica" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anteprima" })).toBeDisabled();
  });

  it("mostra quanti file ha il kit, Nessun file con zero", () => {
    const { unmount } = apri({ numeroFile: 1234 });
    expect(screen.getByText("1.234 file")).toBeInTheDocument();
    unmount();

    apri({ numeroFile: 0 });
    expect(screen.getByText("Nessun file")).toBeInTheDocument();
  });

  it("senza numero di file non mostra il conteggio, come nelle pagine che non lo conoscono", () => {
    apri();

    expect(screen.queryByText(/file$/)).not.toBeInTheDocument();
  });

  it("un kit non avviato senza copertina mostra il suo stato e porta comunque ai kit della promo", () => {
    const { container } = apri({ stato: "NON_AVVIATO", collegamento: "/promozioni/in-corso/dettagli/p1/kits", numeroFile: 0 });

    expect(screen.getByTitle("Non avviato")).toHaveTextContent("Non avviato");
    // Per le tecnologie assistive resta un solo link, quello del titolo
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Volantino Nord" })).toHaveAttribute("href", "/promozioni/in-corso/dettagli/p1/kits");
    // Il segnaposto della copertina porta alla stessa scheda
    const segnaposto = container.querySelector('a[aria-hidden="true"]');
    expect(segnaposto).toHaveAttribute("href", "/promozioni/in-corso/dettagli/p1/kits");
    expect(segnaposto).toHaveAttribute("tabindex", "-1");
  });

  it("con un file scaricabile Scarica è attivo", () => {
    apri({ file: { idOlimpoCloud: "olimpo-1", nome: "volantino.pdf", pagine: 8 } });

    expect(screen.getByRole("button", { name: "Scarica" })).toBeEnabled();
    expect(screen.getByText("8 pp")).toBeInTheDocument();
  });
});
