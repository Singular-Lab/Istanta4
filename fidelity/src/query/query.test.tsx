// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock("../../lib/server_call", () => ({
  ServerCall: { get: finti.get, put: finti.put, post: vi.fn(), delete: vi.fn() },
}));

import {
  useFetchCombinazioneById,
  useFetchCombinazioneDesignById,
  useFetchPromoPerTimeline,
  useFetchTipiExport,
  useFetchTipiExportPOP,
  useGetCampiDaRaggruppamento,
} from "./query";

// Un solo QueryClient per test, con la staleTime dell'app: due hook con la stessa chiave si scambierebbero i dati
const nuovoClient = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};

// Il server finto risponde in base all'endpoint chiamato
const rispostaPer = async (url: string) => {
  if (url === "/get_all_tipi_export") return [{ id: "te-1", nome: "Tutti i tipi" }];
  if (url === "/get_all_tipi_export_POP") return [{ id: "te-pop", nome: "Solo POP" }];
  if (url.startsWith("/getRaccoglitoreKitById/")) return { origine: "raccoglitore", url };
  if (url.startsWith("/getCombinazioneDesignById/")) return { origine: "design", url };
  if (url.startsWith("/getAllPromoForTimeline")) return [{ url }];
  throw new Error(`Endpoint inatteso: ${url}`);
};

describe("query: chiavi distinte per dati distinti", () => {
  beforeEach(() => {
    finti.get.mockReset();
    finti.get.mockImplementation(rispostaPer);
    finti.put.mockReset();
    finti.put.mockImplementation(async (_url: string, corpo: { id: string; campoScelto: string }) => [`${corpo.id}:${corpo.campoScelto}`]);
  });

  it("i tipi di export e quelli POP chiamano ciascuno il proprio endpoint e non condividono i dati", async () => {
    const { wrapper } = nuovoClient();

    const { result } = renderHook(() => ({ tutti: useFetchTipiExport(), pop: useFetchTipiExportPOP() }), { wrapper });

    await waitFor(() => expect(result.current.tutti.isSuccess && result.current.pop.isSuccess).toBe(true));
    expect(result.current.tutti.data).toEqual([{ id: "te-1", nome: "Tutti i tipi" }]);
    expect(result.current.pop.data).toEqual([{ id: "te-pop", nome: "Solo POP" }]);
    expect(finti.get).toHaveBeenCalledWith("/get_all_tipi_export");
    expect(finti.get).toHaveBeenCalledWith("/get_all_tipi_export_POP");
  });

  it('invalidare ["tipiExport"] dopo una modifica ricarica sia i tipi di export sia quelli POP', async () => {
    const { client, wrapper } = nuovoClient();
    const { result } = renderHook(() => ({ tutti: useFetchTipiExport(), pop: useFetchTipiExportPOP() }), { wrapper });
    await waitFor(() => expect(result.current.tutti.isSuccess && result.current.pop.isSuccess).toBe(true));
    finti.get.mockClear();

    await act(() => client.invalidateQueries({ queryKey: ["tipiExport"] }));

    expect(finti.get).toHaveBeenCalledWith("/get_all_tipi_export");
    expect(finti.get).toHaveBeenCalledWith("/get_all_tipi_export_POP");
  });

  it("raccoglitore kit e combinazione design con lo stesso id non condividono i dati", async () => {
    const { wrapper } = nuovoClient();

    const { result } = renderHook(
      () => ({ raccoglitore: useFetchCombinazioneById("c-1"), design: useFetchCombinazioneDesignById("c-1") }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.raccoglitore.isSuccess && result.current.design.isSuccess).toBe(true));
    expect(result.current.raccoglitore.data).toEqual({ origine: "raccoglitore", url: "/getRaccoglitoreKitById/c-1" });
    expect(result.current.design.data).toEqual({ origine: "design", url: "/getCombinazioneDesignById/c-1" });
  });

  it("la timeline delle promo si ricarica quando cambiano area o canale", async () => {
    const { wrapper } = nuovoClient();
    const { result, rerender } = renderHook(
      ({ area, canale }: { area: string; canale: string }) => useFetchPromoPerTimeline(area, canale),
      { wrapper, initialProps: { area: "area-1", canale: "canale-1" } }
    );
    await waitFor(() => expect(result.current.data).toEqual([{ url: "/getAllPromoForTimeline?idArea=area-1&idCanale=canale-1" }]));

    rerender({ area: "area-2", canale: "canale-1" });
    await waitFor(() => expect(result.current.data).toEqual([{ url: "/getAllPromoForTimeline?idArea=area-2&idCanale=canale-1" }]));

    rerender({ area: "area-2", canale: "canale-2" });
    await waitFor(() => expect(result.current.data).toEqual([{ url: "/getAllPromoForTimeline?idArea=area-2&idCanale=canale-2" }]));
    expect(finti.get).toHaveBeenCalledTimes(3);
  });

  it("i campi da raggruppamento sono distinti per workspace e senza workspace non si chiedono", async () => {
    const { wrapper } = nuovoClient();

    const { result } = renderHook(
      () => ({
        primo: useGetCampiDaRaggruppamento("marca", "ws-1"),
        secondo: useGetCampiDaRaggruppamento("marca", "ws-2"),
        senzaWorkspace: useGetCampiDaRaggruppamento("marca", ""),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.primo.isSuccess && result.current.secondo.isSuccess).toBe(true));
    expect(result.current.primo.data).toEqual(["ws-1:marca"]);
    expect(result.current.secondo.data).toEqual(["ws-2:marca"]);
    expect(result.current.senzaWorkspace.fetchStatus).toBe("idle");
    expect(finti.put).toHaveBeenCalledTimes(2);
  });
});
