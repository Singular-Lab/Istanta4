// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RouteErrorFallback } from ".";

// L'animazione decorativa scarica il proprio WASM da un CDN: nei test non deve partire
vi.mock("@lottiefiles/dotlottie-react", () => ({ DotLottieReact: () => null }));

function apriRottaCheFallisce(loader: () => never) {
  const router = createMemoryRouter([
    { path: "/", loader, element: null, errorElement: <RouteErrorFallback /> },
  ]);
  render(<RouterProvider router={router} />);
}

describe("RouteErrorFallback", () => {
  it.each([
    [404, "Pagina non trovata."],
    [500, "Impossibile caricare la pagina. Riprova."],
  ])("per una risposta di errore %i mostra %s", async (status, messaggio) => {
    apriRottaCheFallisce(() => {
      throw new Response(null, { status });
    });

    expect(await screen.findByRole("heading", { name: messaggio })).toBeInTheDocument();
  });

  it("mostra il messaggio di un errore lanciato dalla rotta", async () => {
    apriRottaCheFallisce(() => {
      throw new Error("Caricamento del modulo fallito");
    });

    expect(
      await screen.findByRole("heading", { name: "Caricamento del modulo fallito" })
    ).toBeInTheDocument();
  });
});
