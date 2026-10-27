// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SchermataStato from ".";

describe("SchermataStato", () => {
  it("nell'area della pagina ha l'aspetto di PageError: box, tessera, titolo di pagina e azioni", () => {
    const { container } = render(
      <SchermataStato
        icona="ShieldX"
        tono="warning"
        titolo="Accesso negato"
        descrizione="Chiedi all'amministratore"
        azioni={<button type="button">Torna alla pagina iniziale</button>}
        nota="Suggerimento"
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Accesso negato" })).toHaveClass("title-page");
    expect(screen.getByText("Chiedi all'amministratore")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Torna alla pagina iniziale" })).toBeInTheDocument();
    expect(screen.getByText("Suggerimento")).toHaveClass("text-xs");
    expect(container.firstElementChild).toHaveClass("box", "box--stacked");
    expect(container.querySelector(".fixed")).toBeNull();
    expect(container.querySelector(".rounded-card.bg-warning\\/10")).not.toBeNull();
  });

  it("a schermo intero copre la finestra e mette la box al centro", () => {
    const { container } = render(<SchermataStato icona="ShieldX" titolo="Accesso negato" aSchermoIntero />);

    expect(container.firstElementChild).toHaveClass("fixed", "inset-0");
    expect(container.querySelector(".fixed .box.box--stacked")).not.toBeNull();
  });

  it("mostra un simbolo al posto dell'icona, senza descrizione né azioni se mancano", () => {
    render(<SchermataStato simbolo={<span>404</span>} titolo="Pagina non trovata" />);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
