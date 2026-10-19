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
});
