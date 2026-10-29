// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../lib/server_call", () => ({ ServerCall: { get: finti.get } }));

import { useAreeGdo, useCanaliGdo, useQueryConLoader } from "./condivise";

// Stessa staleTime dell'app
const nuovoClient = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};

const CHIAVE = ["datiDiProva"];
const dalServizio = () => finti.get("/dati") as Promise<string>;

describe("useQueryConLoader", () => {
  beforeEach(() => {
    finti.get.mockReset();
    finti.get.mockResolvedValue("dal servizio");
  });

  it("al caricamento usa la risposta del loader senza ripetere la richiesta", async () => {
    const { wrapper } = nuovoClient();
    const promessa = Promise.resolve("dal loader");

    const { result } = renderHook(() => useQueryConLoader({ queryKey: CHIAVE, queryFn: dalServizio }, promessa), { wrapper });

    await waitFor(() => expect(result.current.data).toBe("dal loader"));
    expect(finti.get).not.toHaveBeenCalled();
  });

  it("un refetch successivo (invalidazione, Riprova) chiama il servizio, non rilegge la promessa", async () => {
    const { client, wrapper } = nuovoClient();
    const promessa = Promise.resolve("dal loader");
    const { result } = renderHook(() => useQueryConLoader({ queryKey: CHIAVE, queryFn: dalServizio }, promessa), { wrapper });
    await waitFor(() => expect(result.current.data).toBe("dal loader"));

    await act(() => client.invalidateQueries({ queryKey: CHIAVE }));

    expect(finti.get).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.data).toBe("dal servizio"));
  });

  it("una promessa comparsa senza un caricamento in corso (revalidazione) scade: il refetch dopo chiama il servizio", async () => {
    const { client, wrapper } = nuovoClient();
    const { result, rerender } = renderHook(
      ({ promessa }: { promessa?: Promise<string> }) => useQueryConLoader({ queryKey: CHIAVE, queryFn: dalServizio }, promessa),
      { wrapper, initialProps: { promessa: Promise.resolve("prima navigazione") } }
    );
    await waitFor(() => expect(result.current.data).toBe("prima navigazione"));

    // Il loader rigira (per esempio dopo una scrittura): la sua risposta ormai è vecchia
    rerender({ promessa: Promise.resolve("revalidazione") });
    finti.get.mockResolvedValue("dopo l'eliminazione");
    await act(() => client.invalidateQueries({ queryKey: CHIAVE }));

    expect(finti.get).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.data).toBe("dopo l'eliminazione"));
  });

  it("tornando sulla pagina con dati ancora freschi in cache, la risposta nuova del loader li aggiorna senza altre richieste", async () => {
    const { client, wrapper } = nuovoClient();
    client.setQueryData(CHIAVE, "in cache");
    const promessa = Promise.resolve("dal loader, più recente");

    const { result } = renderHook(() => useQueryConLoader({ queryKey: CHIAVE, queryFn: dalServizio }, promessa), { wrapper });

    expect(result.current.data).toBe("in cache");
    await waitFor(() => expect(result.current.data).toBe("dal loader, più recente"));
    expect(finti.get).not.toHaveBeenCalled();
  });

  it("se il loader è fallito l'errore arriva alla query e Riprova chiama il servizio", async () => {
    const { wrapper } = nuovoClient();
    const promessa = Promise.reject(new Error("loader fallito"));
    promessa.catch(() => undefined);

    const { result } = renderHook(() => useQueryConLoader({ queryKey: CHIAVE, queryFn: dalServizio }, promessa), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    await act(() => result.current.refetch());

    expect(finti.get).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.data).toBe("dal servizio"));
  });
});

describe("aree e canali della GDO", () => {
  beforeEach(() => {
    finti.get.mockReset();
    finti.get.mockImplementation(async (url: string) => [{ id: url, nome: url }]);
  });

  it("più consumatori condividono una richiesta per le aree e una per i canali", async () => {
    const { wrapper } = nuovoClient();

    const { result } = renderHook(
      () => ({ aree: [useAreeGdo(), useAreeGdo()], canali: [useCanaliGdo(), useCanaliGdo()] }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.aree[1].isSuccess && result.current.canali[1].isSuccess).toBe(true));
    expect(finti.get).toHaveBeenCalledTimes(2);
    expect(finti.get).toHaveBeenCalledWith("/allAreeForGDO");
    expect(finti.get).toHaveBeenCalledWith("/allCanaliForGDO");
  });

  it("usano la stessa chiave di PolicyDiVisualizzazione, così la cache è una sola", async () => {
    const { client, wrapper } = nuovoClient();
    client.setQueryData(["allAreeForGDO"], [{ id: "a1", nome: "Nord" }]);
    client.setQueryData(["allCanaliForGDO"], [{ id: "c1", nome: "Iper" }]);

    const { result } = renderHook(() => ({ aree: useAreeGdo(), canali: useCanaliGdo() }), { wrapper });

    expect(result.current.aree.data).toEqual([{ id: "a1", nome: "Nord" }]);
    expect(result.current.canali.data).toEqual([{ id: "c1", nome: "Iper" }]);
    expect(finti.get).not.toHaveBeenCalled();
  });
});
