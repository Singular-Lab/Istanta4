// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ put: vi.fn() }));

vi.mock("../../lib/server_call", () => ({ ServerCall: { put: finti.put, get: vi.fn() } }));

import { useSessionWishlistIdWebpliant, useWebpliantParams, WebpliantParamsProvider } from "./webpliantParamsStore";

const conProvider = ({ children }: { children: ReactNode }) => <WebpliantParamsProvider>{children}</WebpliantParamsProvider>;

const chiamateSessione = () => finti.put.mock.calls.filter(([percorso]) => percorso === "/generaNuovaSessioneWebpliant");

/** Promessa che il test risolve quando vuole: la PUT di sessione resta in corso fino ad allora. */
function rispostaInSospeso() {
  let risolvi: (valore: string) => void = () => undefined;
  const promessa = new Promise<string>((resolve) => {
    risolvi = resolve;
  });
  return { promessa, risolvi };
}

beforeEach(() => {
  localStorage.clear();
  finti.put.mockReset();
});

// Le card del volantino si montano prima che finisca la PUT di sessione del layout: ognuna chiedeva
// la sua sessione e il server ne creava una per card
describe("ensureSessionExists con una creazione gia in corso", () => {
  it("chi chiede la sessione nel frattempo aspetta la stessa PUT invece di farne un'altra", async () => {
    const risposta = rispostaInSospeso();
    finti.put.mockReturnValueOnce(risposta.promessa);
    const { result } = renderHook(() => useWebpliantParams(), { wrapper: conProvider });

    let sessioni: Promise<string[]> = Promise.resolve([]);
    act(() => {
      const ensure = result.current.ensureSessionExists;
      sessioni = Promise.all([ensure(), ensure(), ensure(), ensure()]);
    });
    await act(async () => {
      risposta.risolvi("sessione-1");
      await sessioni;
    });

    await expect(sessioni).resolves.toEqual(["sessione-1", "sessione-1", "sessione-1", "sessione-1"]);
    expect(chiamateSessione()).toHaveLength(1);
    expect(result.current.sessionIdWebpliant).toBe("sessione-1");
  });

  it("a sessione creata non la richiede, anche da chi ha ancora lo stato precedente", async () => {
    finti.put.mockResolvedValueOnce("sessione-1");
    const { result } = renderHook(() => useWebpliantParams(), { wrapper: conProvider });
    const ensurePrimaDellaSessione = result.current.ensureSessionExists;

    await act(async () => {
      await ensurePrimaDellaSessione();
    });

    await expect(ensurePrimaDellaSessione()).resolves.toBe("sessione-1");
    await expect(result.current.ensureSessionExists()).resolves.toBe("sessione-1");
    expect(chiamateSessione()).toHaveLength(1);
  });

  it("se la PUT fallisce tutti ricevono lo stesso id locale di riserva e si riprova dopo un reset", async () => {
    const errore = rispostaInSospeso();
    finti.put.mockReturnValueOnce(errore.promessa.then(() => Promise.reject(new Error("non autenticato"))));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { result } = renderHook(() => useWebpliantParams(), { wrapper: conProvider });

    let sessioni: Promise<string[]> = Promise.resolve([]);
    act(() => {
      sessioni = Promise.all([result.current.ensureSessionExists(), result.current.ensureSessionExists()]);
    });
    await act(async () => {
      errore.risolvi("");
      await sessioni;
    });

    const [prima, seconda] = await sessioni;
    expect(prima).toMatch(/^local_session_/);
    expect(seconda).toBe(prima);
    expect(chiamateSessione()).toHaveLength(1);

    finti.put.mockResolvedValueOnce("sessione-2");
    act(() => result.current.reset());
    await act(async () => {
      await expect(result.current.ensureSessionExists()).resolves.toBe("sessione-2");
    });
    expect(chiamateSessione()).toHaveLength(2);
  });
});

describe("useSessionWishlistIdWebpliant", () => {
  it("legge l'id della wishlist dello store", async () => {
    const { result } = renderHook(
      () => ({ wishlist: useSessionWishlistIdWebpliant(), parametri: useWebpliantParams() }),
      { wrapper: conProvider }
    );
    expect(result.current.wishlist).toBeUndefined();

    act(() => result.current.parametri.setParams({ sessionWishlistId: "wl-1" }));

    await waitFor(() => expect(result.current.wishlist).toBe("wl-1"));
  });
});
