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

  it("il titolo usa la tipografia title-page", () => {
    disegna(<PageHeader title="Punti vendita" />);

    expect(screen.getByRole("heading", { level: 1, name: "Punti vendita" })).toHaveClass("title-page");
  });

  it("un titolo senza spazi (il codice di una promo) può andare a capo invece di uscire dallo schermo", () => {
    disegna(<PageHeader title="PE2623_24_MIPREMIO_05-11-26" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("[overflow-wrap:anywhere]", "min-w-0");
  });

  it("sulla fascia scura della testata i badge stanno su una superficie chiara, fuori dalla fascia restano come prima", () => {
    disegna(<PageHeader title="Promo 12" badges={<span>Valida</span>} />);

    const contenitore = screen.getByText("Valida").parentElement!;
    expect(contenitore).toHaveClass("group-[.mode--light]:bg-white/95", "dark:group-[.mode--light]:bg-darkmode-600/95");
    // Le classi del fondo valgono solo dentro .mode--light: senza variante il contenitore non ha fondo
    expect([...contenitore.classList].filter(classe => classe.startsWith("bg-"))).toEqual([]);
  });

  it("className può togliere il margine inferiore predefinito", () => {
    const { container } = disegna(<PageHeader title="Punti vendita" className="mb-0" />);
    const intestazione = container.firstElementChild;

    expect(intestazione).toHaveClass("mb-0");
    expect(intestazione).not.toHaveClass("mb-5");
  });
});
