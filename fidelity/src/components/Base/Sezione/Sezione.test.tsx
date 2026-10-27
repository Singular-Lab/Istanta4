// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Sezione, { CLASSE_INTESTAZIONE_SEZIONE } from ".";

describe("Sezione", () => {
  it("è una regione con il nome del suo titolo h2", () => {
    render(
      <Sezione titolo="Ordini in corso" descrizione="Dal più vecchio" azioni={<button>Esporta</button>}>
        <p>Contenuto</p>
      </Sezione>
    );

    const regione = screen.getByRole("region", { name: "Ordini in corso" });
    expect(regione.tagName).toBe("SECTION");
    expect(screen.getByRole("heading", { level: 2, name: "Ordini in corso" })).toHaveClass("title-section");
    expect(screen.getByText("Dal più vecchio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esporta" })).toBeInTheDocument();
    expect(screen.getByText("Contenuto")).toBeInTheDocument();
  });

  it("ha l'aspetto box--stacked con padding e intestazione separata da una linea tratteggiata", () => {
    const { container } = render(<Sezione titolo="Dati">x</Sezione>);
    const sezione = container.firstElementChild as HTMLElement;
    const intestazione = sezione.querySelector(`.${CLASSE_INTESTAZIONE_SEZIONE}`);

    expect(sezione).toHaveClass("box", "box--stacked", "p-5");
    expect(intestazione).toHaveClass("border-b", "border-dashed", "mb-5");
  });

  it("compatta riduce il padding", () => {
    const { container } = render(<Sezione compatta titolo="Dati">x</Sezione>);

    expect(container.firstElementChild).toHaveClass("p-4");
    expect(container.firstElementChild).not.toHaveClass("p-5");
  });

  it("senzaPadding lascia il contenuto a filo e tiene il padding solo nell'intestazione", () => {
    const { container } = render(
      <Sezione senzaPadding titolo="Ordini">
        <table />
      </Sezione>
    );
    const sezione = container.firstElementChild as HTMLElement;
    const intestazione = sezione.querySelector(`.${CLASSE_INTESTAZIONE_SEZIONE}`);

    expect(sezione).not.toHaveClass("p-5");
    expect(intestazione).toHaveClass("p-5");
    expect(intestazione).not.toHaveClass("border-dashed");
  });

  it("senza titolo, descrizione né azioni non mostra l'intestazione", () => {
    const { container } = render(<Sezione>Solo contenuto</Sezione>);

    expect(container.querySelector(`.${CLASSE_INTESTAZIONE_SEZIONE}`)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("as cambia l'elemento e le altre prop arrivano al DOM", () => {
    const { container } = render(
      <Sezione as="div" id="riepilogo" titolo="Riepilogo" className="xl:col-span-4">
        x
      </Sezione>
    );
    const sezione = container.firstElementChild as HTMLElement;

    expect(sezione.tagName).toBe("DIV");
    expect(sezione).toHaveAttribute("id", "riepilogo");
    expect(sezione).toHaveClass("xl:col-span-4");
    expect(sezione).not.toHaveAttribute("aria-labelledby");
  });
});
