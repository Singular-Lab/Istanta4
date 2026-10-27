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
    [404, "Pagina non trovata", "L'indirizzo richiesto non esiste o non è più disponibile."],
    [500, "Impossibile caricare la pagina", "Si è verificato un errore durante il caricamento. Ricarica la pagina per riprovare."],
  ])("per una risposta di errore %i mostra il titolo %s e la spiegazione", async (status, titolo, spiegazione) => {
    apriRottaCheFallisce(() => {
      throw new Response(null, { status });
    });

    expect(await screen.findByRole("heading", { level: 1, name: titolo })).toHaveClass("title-page");
    expect(screen.getByText(spiegazione)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ricarica la pagina" })).toBeInTheDocument();
  });

  it("mostra il messaggio di un errore lanciato dalla rotta sotto un titolo fisso", async () => {
    apriRottaCheFallisce(() => {
      throw new Error("Caricamento del modulo fallito");
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Errore imprevisto" })).toBeInTheDocument();
    expect(screen.getByText("Caricamento del modulo fallito").tagName).toBe("P");
    expect(screen.queryByRole("heading", { name: "Caricamento del modulo fallito" })).not.toBeInTheDocument();
  });
});
