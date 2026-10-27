// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EmptyState from ".";

// lucide-react mette il nome dell'icona fra le classi dell'svg (es. lucide-refresh-cw)
const classiIconaPulsante = () => screen.getByRole("button").querySelector("svg")?.getAttribute("class") ?? "";

describe("EmptyState", () => {
  it("senza buttonIcon il pulsante mostra l'icona di aggiornamento", () => {
    render(<EmptyState icon="Inbox" title="Errore" description="" buttonText="Riprova" />);

    expect(classiIconaPulsante()).toContain("refresh-cw");
  });

  it("con buttonIcon il pulsante mostra l'icona indicata", () => {
    render(<EmptyState icon="Inbox" title="Vuoto" description="" buttonText="Torna indietro" buttonIcon="ArrowLeft" />);

    expect(classiIconaPulsante()).toContain("arrow-left");
    expect(classiIconaPulsante()).not.toContain("refresh-cw");
  });

  it("il titolo è un h2 con la tipografia delle sezioni", () => {
    render(<EmptyState icon="Inbox" title="Nessun ordine" description="Non ci sono ordini in corso" />);

    expect(screen.getByRole("heading", { level: 2, name: "Nessun ordine" })).toHaveClass("title-section");
    expect(screen.getByText("Non ci sono ordini in corso")).toBeInTheDocument();
  });

  it("la variante compatta usa un h3, da mettere sotto il titolo della sezione", () => {
    render(<EmptyState compatta icon="SearchX" title="Nessun risultato" description="" buttonText="Azzera filtri" />);

    expect(screen.getByRole("heading", { level: 3, name: "Nessun risultato" })).toHaveClass("title-section");
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Azzera filtri" })).toBeInTheDocument();
  });

  it("senza descrizione non lascia un paragrafo vuoto", () => {
    const { container } = render(<EmptyState icon="Inbox" title="Vuoto" description="" />);

    expect(container.querySelector("p")).not.toBeInTheDocument();
  });
});
