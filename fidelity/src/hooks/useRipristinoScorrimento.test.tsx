// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chiaveScorrimento, useRipristinoScorrimento } from "./useRipristinoScorrimento";

// Tornando a una pagina con Indietro la pagina riprende dove l'utente l'aveva lasciata: la posizione si
// salva mentre si scorre, per voce della cronologia, e si ripristina una volta sola, a contenuto pronto.

function Pagina({ pronto }: { pronto: boolean }) {
  useRipristinoScorrimento(pronto);
  return <p>Promozione</p>;
}

const scorri = (y: number) => {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  window.dispatchEvent(new Event("scroll"));
};

let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionStorage.clear();
  scrollTo = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  // Un fotogramma subito: il salvataggio e il ripristino avvengono al fotogramma successivo
  vi.stubGlobal("requestAnimationFrame", (richiamo: FrameRequestCallback) => {
    richiamo(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});

const crea = (pronto = true) =>
  createMemoryRouter(
    [
      { path: "/promo", element: <Pagina pronto={pronto} /> },
      { path: "/kit", element: <p>Insight</p> },
    ],
    { initialEntries: ["/promo"] }
  );

describe("useRipristinoScorrimento", () => {
  it("salva la posizione mentre si scorre e la ripristina tornando indietro", async () => {
    const router = crea();
    render(<RouterProvider router={router} />);
    const chiave = router.state.location.key;

    scorri(4800);
    expect(sessionStorage.getItem(chiaveScorrimento(chiave))).toBe("4800");
    // All'arrivo con un collegamento la pagina non scorre
    expect(scrollTo).not.toHaveBeenCalled();

    await act(() => router.navigate("/kit"));
    await act(() => router.navigate(-1));

    expect(router.state.location.pathname).toBe("/promo");
    expect(scrollTo).toHaveBeenCalledWith(0, 4800);
  });

  it("aspetta il contenuto: senza pronto non ripristina", async () => {
    const router = crea(false);
    render(<RouterProvider router={router} />);
    scorri(900);

    await act(() => router.navigate("/kit"));
    await act(() => router.navigate(-1));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("senza sessionStorage la pagina resta in piedi e riparte dall'alto", async () => {
    // Navigazione privata o dati del sito bloccati: l'accesso stesso a sessionStorage fallisce
    const originale = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("bloccato");
      },
    });
    try {
      const router = crea();
      render(<RouterProvider router={router} />);
      scorri(1200);

      await act(() => router.navigate("/kit"));
      await act(() => router.navigate(-1));

      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      if (originale) Object.defineProperty(window, "sessionStorage", originale);
      else Reflect.deleteProperty(window, "sessionStorage");
    }
  });
});
