// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BadgeIniziativa } from ".";

afterEach(cleanup);

describe("BadgeIniziativa (task 1f340bec)", () => {
  it("mostra il codice dell'iniziativa, con il suggerimento che lo spiega", () => {
    render(<BadgeIniziativa codice="P2620" />);

    const badge = screen.getByTestId("badge-iniziativa");
    expect(badge).toHaveTextContent("P2620");
    expect(badge).toHaveAttribute("title", "Codice iniziativa P2620");
  });

  it("per chi legge con lo screen reader dice che è l'iniziativa", () => {
    render(<BadgeIniziativa codice="P2620" />);

    expect(screen.getByTestId("badge-iniziativa")).toHaveTextContent("Iniziativa P2620");
  });

  it("senza codice, vuoto o con soli spazi non c'è niente", () => {
    const { rerender } = render(<BadgeIniziativa />);
    expect(screen.queryByTestId("badge-iniziativa")).not.toBeInTheDocument();
    rerender(<BadgeIniziativa codice={null} />);
    expect(screen.queryByTestId("badge-iniziativa")).not.toBeInTheDocument();
    rerender(<BadgeIniziativa codice="   " />);
    expect(screen.queryByTestId("badge-iniziativa")).not.toBeInTheDocument();
  });

  it("su fondo scuro usa i colori chiari", () => {
    render(<BadgeIniziativa codice="P2620" suScuro />);

    expect(screen.getByTestId("badge-iniziativa").className).toContain("text-white");
  });
});
