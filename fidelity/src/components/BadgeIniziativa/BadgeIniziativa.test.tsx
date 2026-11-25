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

  it("su fondo chiaro è pieno, a contrasto, con testo di dimensione normale", () => {
    render(<BadgeIniziativa codice="P2620" />);

    const classi = screen.getByTestId("badge-iniziativa").className;
    expect(classi).toContain("bg-primary");
    expect(classi).toContain("text-white");
    expect(classi).toContain("text-sm");
    expect(classi).not.toContain("text-3xs");
  });

  it("su fondo scuro è chiaro con testo scuro, a contrasto", () => {
    render(<BadgeIniziativa codice="P2620" suScuro />);

    const classi = screen.getByTestId("badge-iniziativa").className;
    expect(classi).toContain("bg-white");
    expect(classi).toContain("text-slate-900");
  });
});
