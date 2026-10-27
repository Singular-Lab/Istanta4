// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-redux", () => ({ useDispatch: () => vi.fn(), useSelector: () => "/gdo/dashboard" }));
vi.mock("../../stores/sideMenuSlice_istanta", () => ({
  fetchSideMenu: vi.fn(),
  selectSideMenuStartPage: vi.fn(),
}));

import NotFoundPage from ".";

describe("NotFoundPage", () => {
  it("ha il titolo di pagina e le azioni sono un pulsante e un link alla pagina iniziale", () => {
    const indietro = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Pagina non trovata" })).toHaveClass("title-page");

    fireEvent.click(screen.getByRole("button", { name: "Torna indietro" }));
    expect(indietro).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/gdo/dashboard");
    indietro.mockRestore();
  });
});
