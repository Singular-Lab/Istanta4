// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaginaPromozioniVolantiniConsultazione } from "../../lib/consultazione/tipi";

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../lib/server_call", () => ({ ServerCall: { get: finti.get } }));

import { DIMENSIONE_GRUPPO_PROMOZIONI_VOLANTINI, usePromozioniVolantiniConsultazione } from "./consultazione";

const nuovoWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const promo = (id: string) => ({
  promo: { id, nome: `Promo ${id}`, validitaDal: "2026-10-01", validitaAl: "2026-10-15" },
  copertina: null,
  numeroKit: 1,
  kit: [],
  numeroPuntiVendita: 0,
});

/** Un gruppo di risposta del server: `totale` e' quello di tutte le promozioni del periodo. */
const gruppo = (ids: string[], totale: number, vetrinaNome = "Vetrina"): PaginaPromozioniVolantiniConsultazione =>
  ({
    promozioni: ids.map(promo),
    totale,
    totaleSenzaFiltri: totale,
    totaleKit: totale,
    pagina: 1,
    dimensione: DIMENSIONE_GRUPPO_PROMOZIONI_VOLANTINI,
    vetrina: { nome: vetrinaNome },
    opzioni: { promozioni: [], aree: [], canali: [], anni: [] },
    riepilogo: { promozioni: totale, kit: totale, puntiVendita: 0 },
  }) as unknown as PaginaPromozioniVolantiniConsultazione;

const richiesta = (chiamata: number) => new URL(finti.get.mock.calls[chiamata][0] as string, "http://localhost").searchParams;

describe("usePromozioniVolantiniConsultazione", () => {
  beforeEach(() => finti.get.mockReset());

  it("chiede il primo gruppo e accoda i successivi, finche' ce ne sono", async () => {
    finti.get.mockResolvedValueOnce(gruppo(["a", "b"], 3)).mockResolvedValueOnce(gruppo(["c"], 3, "Altra vetrina"));
    const { result } = renderHook(() => usePromozioniVolantiniConsultazione({ periodo: "storico" }), { wrapper: nuovoWrapper() });

    await waitFor(() => expect(result.current.data?.promozioni).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(true);
    expect(richiesta(0).get("pagina")).toBe("1");
    expect(richiesta(0).get("dimensione")).toBe(String(DIMENSIONE_GRUPPO_PROMOZIONI_VOLANTINI));
    expect(richiesta(0).get("periodo")).toBe("storico");

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.promozioni.map((voce) => voce.promo.id)).toEqual(["a", "b", "c"]));
    expect(richiesta(1).get("pagina")).toBe("2");
    expect(result.current.hasNextPage).toBe(false);
    // Vetrina e opzioni restano quelle del primo gruppo
    expect((result.current.data?.vetrina as unknown as { nome: string }).nome).toBe("Vetrina");
  });

  it("una promozione che si ripete fra due gruppi, perche' l'elenco si e' spostato, compare una volta sola", async () => {
    finti.get.mockResolvedValueOnce(gruppo(["a", "b"], 4)).mockResolvedValueOnce(gruppo(["b", "c"], 4));
    const { result } = renderHook(() => usePromozioniVolantiniConsultazione({ periodo: "attivi" }), { wrapper: nuovoWrapper() });
    await waitFor(() => expect(result.current.data?.promozioni).toHaveLength(2));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.promozioni.map((voce) => voce.promo.id)).toEqual(["a", "b", "c"]));
  });

  it("senza altre promozioni non offre un gruppo successivo", async () => {
    finti.get.mockResolvedValueOnce(gruppo(["a", "b"], 2));
    const { result } = renderHook(() => usePromozioniVolantiniConsultazione({ periodo: "prossimi" }), { wrapper: nuovoWrapper() });

    await waitFor(() => expect(result.current.data?.promozioni).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("cambiando filtro riparte dal primo gruppo", async () => {
    finti.get.mockResolvedValue(gruppo(["a"], 1));
    const { result, rerender } = renderHook(
      ({ area }: { area?: string }) => usePromozioniVolantiniConsultazione({ periodo: "storico", idArea: area }),
      { wrapper: nuovoWrapper(), initialProps: {} as { area?: string } }
    );
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ area: "a1" });

    await waitFor(() => expect(finti.get).toHaveBeenCalledTimes(2));
    expect(richiesta(1).get("idArea")).toBe("a1");
    expect(richiesta(1).get("pagina")).toBe("1");
  });
});
