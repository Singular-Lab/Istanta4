// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DatabaseError, ForbiddenError } from "../../../lib/errors";
import ErrorPage from ".";

// L'animazione decorativa scarica il proprio WASM da un CDN: nei test non deve partire
vi.mock("@lottiefiles/dotlottie-react", () => ({ DotLottieReact: () => null }));
// La pagina iniziale arriva dallo store del menu: qui basta che ci sia
vi.mock("react-redux", () => ({ useDispatch: () => vi.fn(), useSelector: () => "/gdo/dashboard" }));
vi.mock("../../stores/sideMenuSlice_istanta", () => ({
  fetchSideMenu: vi.fn(),
  selectSideMenuStartPage: vi.fn(),
}));

function apriRottaCheFallisce(loader: () => never) {
  const router = createMemoryRouter([
    { path: "/", loader, element: null, errorElement: <ErrorPage /> },
  ]);
  render(<RouterProvider router={router} />);
}

describe("ErrorPage", () => {
  it("per un errore nel recupero dei dati mostra la pagina non caricata con il motivo, non l'accesso negato", async () => {
    apriRottaCheFallisce(() => {
      throw new DatabaseError({ message: "Errore durante il recupero degli ordini in corso" });
    });

    expect(await screen.findByRole("heading", { name: "Impossibile caricare la pagina" })).toBeInTheDocument();
    expect(screen.getByText("Errore durante il recupero degli ordini in corso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riprova" })).toBeInTheDocument();
    expect(screen.queryByText("Accesso negato")).not.toBeInTheDocument();
  });

  it("senza autorizzazione mostra l'accesso negato", async () => {
    apriRottaCheFallisce(() => {
      throw new ForbiddenError({ message: "Permesso negato" });
    });

    expect(await screen.findByRole("heading", { name: "Accesso negato" })).toBeInTheDocument();
    expect(screen.queryByText("Impossibile caricare la pagina")).not.toBeInTheDocument();
  });

  it("per una pagina inesistente mostra la pagina non trovata", async () => {
    apriRottaCheFallisce(() => {
      throw new Response(null, { status: 404 });
    });

    expect(await screen.findByRole("heading", { name: "Pagina non trovata" })).toBeInTheDocument();
    expect(screen.queryByText("Accesso negato")).not.toBeInTheDocument();
  });
});
