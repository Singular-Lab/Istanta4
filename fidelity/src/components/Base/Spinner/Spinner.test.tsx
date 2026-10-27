// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Spinner from ".";

describe("Spinner", () => {
  it("annuncia il caricamento agli screen reader", () => {
    render(<Spinner />);

    expect(screen.getByRole("status")).toHaveTextContent("Caricamento…");
  });

  it("accetta un'etichetta propria", () => {
    render(<Spinner etichetta="Caricamento ordini" />);

    expect(screen.getByRole("status")).toHaveTextContent("Caricamento ordini");
  });

  it("le misure cambiano la dimensione dell'icona", () => {
    const { container } = render(<Spinner size="lg" />);

    expect(container.querySelector("svg")).toHaveClass("h-10", "w-10", "animate-spin");
  });

  it("decorativo non annuncia nulla", () => {
    const { container } = render(<Spinner decorativo />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
