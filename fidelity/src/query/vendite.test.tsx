// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERCORSI_VENDITE, type ImportVendite, type RiepilogoVendite } from "../../lib/vendite/tipi";

const finti = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../lib/server_call", () => ({
  ServerCall: { get: finti.get, post: finti.post, put: vi.fn(), delete: vi.fn() },
}));

import {
  chiaviVendite,
  eImportGiaInCorso,
  INTERVALLO_STATO_IMPORT_MS,
  intervalloStatoImport,
  useAnnullaImportVendite,
  useAnteprimaImportVendite,
  useAvviaImportVendite,
  useRiepilogoVendite,
  useStatoImportVendite,
} from "./vendite";

// Query della pagina Vendite: polling dello stato dell'import e invalidazioni (spec vendite-volantino)

const inCorso = (elaborate: number): ImportVendite => ({
  id: "imp-1",
  stato: "in_corso",
  nomeFile: "vendite.xlsx",
  righe: 100,
  elaborate,
  scritte: elaborate,
  scartate: 0,
  errore: null,
  avviatoIl: "2026-11-09T10:00:00Z",
  terminatoIl: null,
});

const COMPLETATO: ImportVendite = { ...inCorso(100), stato: "completato", terminatoIl: "2026-11-09T10:02:00Z" };

const RIEPILOGO: RiepilogoVendite = { gdo: { id: "g1", nome: "CONAD CENTRALE" }, righe: 100, prodotti: 10, puntiVendita: 5, dal: "2026-04-01", al: "2026-04-30", ultimoImport: null };

const nuovoClient = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};

const chiamate = (percorso: string) => finti.get.mock.calls.filter(([url]) => String(url).split("?")[0] === percorso).length;

const avanza = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("query delle vendite", () => {
  beforeEach(() => {
    finti.get.mockReset();
    finti.post.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sempre la GDO della sessione: chiavi e percorsi senza GDO", () => {
    expect(chiaviVendite.riepilogo).toEqual(["vendite", "riepilogo"]);
    expect(chiaviVendite.stato).toEqual(["vendite", "stato"]);
  });

  it("il polling dura finche' l'import e' in corso", () => {
    expect(intervalloStatoImport(inCorso(10))).toBe(INTERVALLO_STATO_IMPORT_MS);
    expect(INTERVALLO_STATO_IMPORT_MS).toBe(2000);
    expect(intervalloStatoImport(COMPLETATO)).toBe(false);
    expect(intervalloStatoImport(null)).toBe(false);
    expect(intervalloStatoImport(undefined)).toBe(false);
  });

  it("riconosce il 409 dell'import gia' in corso", () => {
    expect(eImportGiaInCorso({ httpStatus: 409 })).toBe(true);
    expect(eImportGiaInCorso({ httpStatus: 500 })).toBe(false);
    expect(eImportGiaInCorso(null)).toBe(false);
  });

  it("rilegge lo stato ogni 2 s mentre l'import e' in corso, poi si ferma e ricarica il riepilogo", async () => {
    vi.useFakeTimers();
    const risposte = [inCorso(10), inCorso(60), COMPLETATO];
    finti.get.mockImplementation(async (url: string) => {
      if (url === PERCORSI_VENDITE.stato) return risposte.length > 1 ? risposte.shift() : risposte[0];
      if (url === PERCORSI_VENDITE.riepilogo) return RIEPILOGO;
      throw new Error(`Endpoint inatteso: ${url}`);
    });
    const { client, wrapper } = nuovoClient();
    // Un'analisi del volantino che legge le vendite: va riletta anche lei, a import finito
    client.setQueryData(["flyerInsights", "kit-1", "vendite"], null);
    client.setQueryData(["flyerInsights", "kit-1", "confronti"], null);

    const { result } = renderHook(() => ({ stato: useStatoImportVendite(), riepilogo: useRiepilogoVendite() }), { wrapper });
    await avanza(10);
    expect(result.current.stato.data?.elaborate).toBe(10);
    expect(chiamate(PERCORSI_VENDITE.stato)).toBe(1);
    expect(chiamate(PERCORSI_VENDITE.riepilogo)).toBe(1);

    await avanza(INTERVALLO_STATO_IMPORT_MS);
    expect(chiamate(PERCORSI_VENDITE.stato)).toBe(2);
    expect(result.current.stato.data?.elaborate).toBe(60);

    await avanza(INTERVALLO_STATO_IMPORT_MS);
    expect(chiamate(PERCORSI_VENDITE.stato)).toBe(3);
    expect(result.current.stato.data?.stato).toBe("completato");
    // Finito l'import: il riepilogo si rilegge e le analisi del volantino dalle vendite sono da rifare
    await avanza(10);
    expect(chiamate(PERCORSI_VENDITE.riepilogo)).toBe(2);
    expect(client.getQueryState(["flyerInsights", "kit-1", "vendite"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["flyerInsights", "kit-1", "confronti"])?.isInvalidated).toBe(false);

    // Niente piu' polling
    await avanza(INTERVALLO_STATO_IMPORT_MS * 5);
    expect(chiamate(PERCORSI_VENDITE.stato)).toBe(3);
  });

  it("senza import o con un import gia' finito non fa polling", async () => {
    vi.useFakeTimers();
    finti.get.mockResolvedValue(null);
    const { wrapper } = nuovoClient();

    const { result } = renderHook(() => useStatoImportVendite(), { wrapper });
    await avanza(10);
    expect(result.current.isSuccess).toBe(true);
    await avanza(INTERVALLO_STATO_IMPORT_MS * 3);

    expect(finti.get).toHaveBeenCalledTimes(1);
  });

  it("riepilogo e stato si chiedono senza ?gdo=: vale la GDO operativa della sessione", async () => {
    finti.get.mockImplementation(async (url: string) => (url === PERCORSI_VENDITE.riepilogo ? RIEPILOGO : null));
    const { wrapper } = nuovoClient();
    const { result } = renderHook(() => ({ stato: useStatoImportVendite(), riepilogo: useRiepilogoVendite() }), { wrapper });
    await waitFor(() => expect(result.current.riepilogo.isSuccess).toBe(true));
    expect(finti.get.mock.calls.map(([url]) => url).sort()).toEqual(["/vendite/import/stato", "/vendite/riepilogo"]);
  });

  it("l'anteprima invia il file nel campo 'file' come multipart, senza toccare lo stato", async () => {
    const anteprima = { tracciato: { nome: "Generico", colonne: ["codice"] }, righe: 1, importabili: 1, scartate: 0, dettaglioScartate: [], periodo: null, prodotti: 1, puntiVendita: 1 };
    finti.post.mockResolvedValue(anteprima);
    const { client, wrapper } = nuovoClient();
    const invalida = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAnteprimaImportVendite(), { wrapper });

    const file = new File(["codice;pezzi"], "vendite.csv", { type: "text/csv" });
    await act(async () => {
      await result.current.mutateAsync(file);
    });

    const [url, dati, multipart] = finti.post.mock.calls[0];
    expect(url).toBe("/vendite/import/anteprima");
    expect(((dati as FormData).get("file") as File).name).toBe("vendite.csv");
    expect(multipart).toBe(true);
    // Lo stato della mutation si aggiorna dopo la promessa: si aspetta il render successivo
    await waitFor(() => expect(result.current.data).toEqual(anteprima));
    expect(invalida).not.toHaveBeenCalled();
  });

  it("l'avvio mette lo stato in corso, e il polling parte da li'", async () => {
    finti.post.mockResolvedValue(inCorso(0));
    const { client, wrapper } = nuovoClient();
    const { result } = renderHook(() => useAvviaImportVendite(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(new File(["x"], "vendite.xlsx"));
    });

    expect(finti.post.mock.calls[0][0]).toBe(PERCORSI_VENDITE.importa);
    expect(finti.post.mock.calls[0][2]).toBe(true);
    expect(client.getQueryData(chiaviVendite.stato)).toEqual(inCorso(0));
  });

  it("con un import gia' in corso (409) rilegge lo stato, cosi' la pagina segue quello", async () => {
    finti.get.mockResolvedValue(inCorso(30));
    finti.post.mockRejectedValue(Object.assign(new Error("Un import delle vendite e' gia' in corso"), { httpStatus: 409 }));
    const { wrapper } = nuovoClient();
    const { result } = renderHook(() => ({ stato: useStatoImportVendite(), avvia: useAvviaImportVendite() }), { wrapper });
    await waitFor(() => expect(result.current.stato.isSuccess).toBe(true));
    expect(chiamate(PERCORSI_VENDITE.stato)).toBe(1);

    await act(async () => {
      await result.current.avvia.mutateAsync(new File(["x"], "vendite.xlsx")).catch(() => undefined);
    });

    await waitFor(() => expect(chiamate(PERCORSI_VENDITE.stato)).toBe(2));
    expect(eImportGiaInCorso(result.current.avvia.error)).toBe(true);
  });

  it("l'annullamento aggiorna lo stato e ricarica il riepilogo: le righe scritte restano", async () => {
    const annullato: ImportVendite = { ...inCorso(40), stato: "annullato", terminatoIl: "2026-11-09T10:01:00Z" };
    finti.get.mockImplementation(async (url: string) => (url === PERCORSI_VENDITE.riepilogo ? RIEPILOGO : annullato));
    finti.post.mockResolvedValue(annullato);
    const { wrapper } = nuovoClient();
    const { result } = renderHook(
      () => ({ riepilogo: useRiepilogoVendite(), annulla: useAnnullaImportVendite() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.riepilogo.isSuccess).toBe(true));

    await act(async () => {
      await result.current.annulla.mutateAsync();
    });

    expect(finti.post).toHaveBeenCalledWith("/vendite/import/annulla", {});
    await waitFor(() => expect(chiamate(PERCORSI_VENDITE.riepilogo)).toBe(2));
  });
});
