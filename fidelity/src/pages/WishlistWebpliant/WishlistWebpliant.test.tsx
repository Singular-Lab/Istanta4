// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  get: vi.fn(),
  parametri: {
    idArea: "a",
    idCanale: "c",
    idGDO: "g",
    idPV: undefined,
    idWorkspace: "w",
    idPagina: "p",
    sessionWishlistId: "wl-123" as string | undefined,
    isCondivisa: false,
    isLoading: false,
    error: null as string | null,
    isReady: true,
    buildUrlWithCurrentParams: (percorso: string) => percorso,
  },
}));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: finti.get, post: vi.fn() } }));
vi.mock("@/context/GestioneHeaderWebpliant", () => ({
  useGestioneHeaderWebpliant: () => ({ oggettoHeaderWebpliant: {}, setOggettoHeaderWebpliant: vi.fn() }),
}));
vi.mock("@/hooks/useWebpliantParamsManager", () => ({ useWebpliantParamsManager: () => finti.parametri }));
vi.mock("@/utils/wishlistEvents", () => ({
  useWishlistEvents: () => ({ events: { on: () => () => {} }, notifyItemRemoved: vi.fn() }),
}));

import WishlistWebpliant from ".";

const apri = () =>
  render(
    <MemoryRouter>
      <WishlistWebpliant />
    </MemoryRouter>
  );

describe("WishlistWebpliant", () => {
  beforeEach(() => {
    finti.get.mockReset();
    finti.parametri.sessionWishlistId = "wl-123";
    finti.parametri.error = null;
  });

  it("una wishlist vuota mostra lo stato vuoto pubblico senza l'identificativo di debug", async () => {
    finti.get.mockResolvedValue([]);
    apri();

    expect(await screen.findByText("Nessun prodotto nella wishlist")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "La mia wishlist" })).toBeInTheDocument();
    expect(screen.queryByText(/WishlistId/)).not.toBeInTheDocument();
    expect(screen.queryByText(/wl-123/)).not.toBeInTheDocument();
  });

  it("se il caricamento fallisce mostra l'errore pubblico con il pulsante per ricaricare", async () => {
    finti.get.mockRejectedValue(new Error("Wishlist non trovata"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    apri();

    const errore = await screen.findByRole("alert");
    expect(errore).toHaveTextContent("Impossibile caricare la wishlist");
    expect(errore).toHaveTextContent("Wishlist non trovata");
    expect(screen.getByRole("button", { name: "Ricarica la pagina" })).toBeInTheDocument();
  });

  it("senza wishlist non resta in caricamento", () => {
    finti.parametri.sessionWishlistId = undefined;
    apri();

    expect(screen.getByText("Nessun prodotto nella wishlist")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(finti.get).not.toHaveBeenCalled();
  });
});
