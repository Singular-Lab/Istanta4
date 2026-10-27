// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BarraFiltri from ".";

describe("BarraFiltri", () => {
  it("mette i filtri a sinistra e le azioni a destra", () => {
    render(
      <BarraFiltri destra={<button>Esporta</button>}>
        <input aria-label="Cerca" />
      </BarraFiltri>
    );

    const ricerca = screen.getByRole("textbox", { name: "Cerca" });
    const azione = screen.getByRole("button", { name: "Esporta" });
    expect(ricerca.compareDocumentPosition(azione) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(azione.parentElement).toHaveClass("sm:ml-auto");
  });

  it("di default è la barra a filo della sezione, separata da una linea tratteggiata", () => {
    const { container } = render(<BarraFiltri>filtri</BarraFiltri>);

    expect(container.firstElementChild).toHaveClass("p-5", "border-b", "border-dashed", "border-slate-200");
  });

  it("interna e libera cambiano spaziature e bordo", () => {
    const { container, rerender } = render(<BarraFiltri variante="interna">filtri</BarraFiltri>);
    expect(container.firstElementChild).toHaveClass("pb-5", "mb-5", "border-dashed");
    expect(container.firstElementChild).not.toHaveClass("p-5");

    rerender(<BarraFiltri variante="libera">filtri</BarraFiltri>);
    for (const classe of ["p-5", "pb-5", "border-b"]) {
      expect(container.firstElementChild).not.toHaveClass(classe);
    }
  });

  it("senza contenuto a sinistra non lascia un contenitore vuoto", () => {
    const { container } = render(<BarraFiltri destra={<button>Nuovo</button>} />);

    expect(container.firstElementChild?.children).toHaveLength(1);
  });
});
