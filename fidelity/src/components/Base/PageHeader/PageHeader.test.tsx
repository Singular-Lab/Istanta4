// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PageHeader from ".";

const disegna = (elemento: React.ReactElement) => render(<MemoryRouter>{elemento}</MemoryRouter>);

describe("PageHeader", () => {
  it("senza i nuovi prop mostra titolo, descrizione e azioni come prima", () => {
    disegna(<PageHeader title="Punti vendita" description="Anagrafica" actions={<button>Nuovo</button>} />);

    expect(screen.getByRole("heading", { level: 1, name: "Punti vendita" })).toBeInTheDocument();
    expect(screen.getByText("Anagrafica")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuovo" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("indietro con un percorso è un link etichettato", () => {
    disegna(<PageHeader title="Dettaglio" indietro={{ to: "/promo", etichetta: "Torna alle promo" }} />);

    expect(screen.getByRole("link", { name: "Torna alle promo" })).toHaveAttribute("href", "/promo");
  });

  it("indietro con una funzione è un pulsante con etichetta predefinita", () => {
    const onClick = vi.fn();
    disegna(<PageHeader title="Dettaglio" indietro={{ onClick }} />);

    fireEvent.click(screen.getByRole("button", { name: "Indietro" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("mostra i badge accanto al titolo", () => {
    disegna(<PageHeader title="Promo 12" badges={<span>Valida</span>} />);

    expect(screen.getByText("Valida")).toBeInTheDocument();
  });
});
