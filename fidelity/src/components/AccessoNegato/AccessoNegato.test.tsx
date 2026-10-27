// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-redux", () => ({ useDispatch: () => vi.fn(), useSelector: () => "/gdo/dashboard" }));
vi.mock("../../stores/sideMenuSlice_istanta", () => ({
  fetchSideMenu: vi.fn(),
  selectSideMenuStartPage: vi.fn(),
}));

import AccessoNegato, { DentroLayoutContext } from ".";

describe("AccessoNegato", () => {
  it("porta alla pagina iniziale senza chiudere la sessione delle altre schede", async () => {
    localStorage.clear();
    const router = createMemoryRouter(
      [
        { path: "/gestione-permessi", element: <AccessoNegato /> },
        { path: "/gdo/dashboard", element: <div>Pagina iniziale</div> },
      ],
      { initialEntries: ["/gestione-permessi"] }
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("heading", { name: "Accesso negato" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Torna alla pagina iniziale/ }));

    expect(await screen.findByText("Pagina iniziale")).toBeInTheDocument();
    expect(localStorage.getItem("logout")).toBeNull();
  });

  it("ha il titolo di pagina e l'azione è un pulsante con nome", () => {
    const router = createMemoryRouter([{ path: "/", element: <AccessoNegato /> }]);
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("heading", { level: 1, name: "Accesso negato" })).toHaveClass("title-page");
    expect(screen.getByRole("button", { name: "Torna alla pagina iniziale" })).toHaveClass("rounded-full");
  });

  it("dentro il layout occupa solo l'area della pagina", () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <DentroLayoutContext.Provider value={true}>
            <AccessoNegato />
          </DentroLayoutContext.Provider>
        ),
      },
    ]);
    const { container } = render(<RouterProvider router={router} />);
    expect(container.querySelector(".fixed")).toBeNull();
  });
});
