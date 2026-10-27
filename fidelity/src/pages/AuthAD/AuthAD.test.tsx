// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// L'animazione decorativa scarica il proprio WASM da un CDN: nei test non deve partire
vi.mock("@lottiefiles/dotlottie-react", () => ({ DotLottieReact: () => null }));

import Auth from "../Auth";
import AuthAD from ".";

function apri(elemento: React.ReactElement, dati: unknown) {
  const router = createMemoryRouter([{ path: "/", loader: () => dati, element: elemento }]);
  render(<RouterProvider router={router} />);
}

describe("schermate di autenticazione fallita", () => {
  it("AuthAD mostra il caso d'errore ricevuto nella schermata comune, con il ritorno al login", async () => {
    apri(<AuthAD />, { auth: { isError: true, errorCode: "token_expired" } });

    const titolo = await screen.findByRole("heading", { level: 1, name: "Token scaduto" });
    expect(titolo).toHaveClass("title-page");
    expect(screen.getByRole("alert")).toHaveTextContent("Il token di autenticazione è scaduto.");
    expect(screen.getByRole("button", { name: "Torna al Login" })).toBeInTheDocument();
  });

  it("Auth usa la stessa schermata con il motivo ricevuto dal caricamento", async () => {
    apri(<Auth />, { auth: null, errore: "Chiave non valida" });

    expect(await screen.findByRole("heading", { level: 1, name: "Autenticazione fallita" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Chiave non valida");
    expect(screen.getByRole("button", { name: "Torna al Login" })).toBeInTheDocument();
  });
});
