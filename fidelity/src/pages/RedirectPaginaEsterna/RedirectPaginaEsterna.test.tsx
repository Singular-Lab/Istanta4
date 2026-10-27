// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import RedirectPaginaEsterna from ".";

describe("RedirectPaginaEsterna", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("usa la schermata di stato comune con il collegamento esterno e lo apre dopo l'attesa", () => {
    vi.useFakeTimers();
    const apri = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render(
      <MemoryRouter initialEntries={["/redirect?url=https%3A%2F%2Fesempio.test%2Fbeta"]}>
        <RedirectPaginaEsterna />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Entra nella beta di Competitor Analyzer" })).toHaveClass("title-page");
    expect(screen.getByRole("link", { name: "Apri ora" })).toHaveAttribute("href", "https://esempio.test/beta");
    expect(container.firstElementChild).toHaveClass("box", "box--stacked");
    expect(container.querySelector(".p-6")).toBeNull();

    vi.advanceTimersByTime(2000);
    expect(apri).toHaveBeenCalledWith("https://esempio.test/beta", "_blank", "noopener,noreferrer");
  });

  it("senza indirizzo non mostra il pulsante", () => {
    render(
      <MemoryRouter initialEntries={["/redirect"]}>
        <RedirectPaginaEsterna />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: "Apri ora" })).not.toBeInTheDocument();
  });
});
