// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Pagina from ".";

const disegna = (elemento: React.ReactElement) => render(<MemoryRouter>{elemento}</MemoryRouter>);

describe("Pagina", () => {
  it("mostra intestazione e contenuto", () => {
    disegna(
      <Pagina titolo="Ordini in corso" descrizione="Ordini avviati" azioni={<button>Nuovo ordine</button>}>
        <section>Elenco ordini</section>
      </Pagina>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Ordini in corso" })).toBeInTheDocument();
    expect(screen.getByText("Ordini avviati")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuovo ordine" })).toBeInTheDocument();
    expect(screen.getByText("Elenco ordini")).toBeInTheDocument();
  });

  it("distanzia le sezioni con gap-6 e toglie il margine proprio dell'intestazione", () => {
    const { container } = disegna(
      <Pagina titolo="Ordini in corso">
        <section>Prima</section>
        <section>Seconda</section>
      </Pagina>
    );
    const pagina = container.firstElementChild as HTMLElement;
    const intestazione = pagina.firstElementChild as HTMLElement;

    expect(pagina).toHaveClass("flex", "flex-col", "gap-6");
    expect(intestazione).toHaveClass("mb-0");
    expect(intestazione).not.toHaveClass("mb-5");
    expect(pagina.children).toHaveLength(3);
  });

  it("passa indietro e badges all'intestazione", () => {
    disegna(
      <Pagina titolo="Ordine 12" indietro={{ to: "/ordini", etichetta: "Torna agli ordini" }} badges={<span>In revisione</span>} />
    );

    expect(screen.getByRole("link", { name: "Torna agli ordini" })).toHaveAttribute("href", "/ordini");
    expect(screen.getByText("In revisione")).toBeInTheDocument();
  });
});
