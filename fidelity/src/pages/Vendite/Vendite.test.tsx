// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_SCARTATE_ANTEPRIMA,
  PERCORSI_VENDITE,
  type AnteprimaImportVendite,
  type ImportVendite,
  type RiepilogoVendite,
} from "../../../lib/vendite/tipi";

// Pagina Vendite (/analisi/vendite): riepilogo, anteprima e import delle vendite del cliente,
// avanzamento e annullamento (spec vendite-volantino)

const finti = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  riepilogo: null as unknown,
  stato: null as unknown,
  /** "Vendite e previsioni" della GDO: accesa salvo i test che la spengono. */
  venditeAttive: true,
}));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: finti.get, post: finti.post, put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/components/SessionChecker", () => ({ default: <P extends object>(Componente: ComponentType<P>) => Componente }));
vi.mock("@/query/query", () => ({
  useFetchFunzionalita: () => ({
    data: { momenti: false, menabo: false, vendite: finti.venditeAttive },
    isLoading: false,
    isError: false,
  }),
}));

import Vendite from ".";
import { INTERVALLO_STATO_IMPORT_MS } from "@/query/vendite";

const importazione = (parziale: Partial<ImportVendite> = {}): ImportVendite => ({
  id: "imp-1",
  stato: "in_corso",
  nomeFile: "vendite-aprile.xlsx",
  righe: 100,
  elaborate: 40,
  scritte: 40,
  scartate: 0,
  errore: null,
  avviatoIl: "2026-11-09T10:00:00",
  terminatoIl: null,
  ...parziale,
});

const RIEPILOGO: RiepilogoVendite = {
  gdo: { id: "gdo-1", nome: "CONAD CENTRALE" },
  righe: 12500,
  prodotti: 340,
  puntiVendita: 85,
  dal: "2026-01-01",
  al: "2026-03-31",
  ultimoImport: importazione({
    id: "imp-0",
    stato: "completato",
    nomeFile: "sellout-q1.xlsx",
    righe: 12503,
    elaborate: 12503,
    scritte: 12500,
    scartate: 3,
    avviatoIl: "2026-04-02T08:00:00",
    terminatoIl: "2026-04-02T08:05:00",
  }),
};

const ANTEPRIMA: AnteprimaImportVendite = {
  tracciato: { nome: "Conad CNO", colonne: ["Cod. articolo", "PdV", "Data inizio", "Data fine", "Pezzi", "Valore"] },
  righe: 205,
  importabili: 3,
  scartate: 202,
  dettaglioScartate: Array.from({ length: MAX_SCARTATE_ANTEPRIMA }, (_, i) => ({
    riga: i + 2,
    motivo: i === 0 ? "Punto vendita sconosciuto: 9999" : "Pezzi non numerici",
  })),
  periodo: { dal: "2026-04-01", al: "2026-04-30" },
  prodotti: 2,
  puntiVendita: 1,
};

const xlsx = (nome: string) =>
  new File(["dati"], nome, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

const errore = (messaggio: string, httpStatus: number, details?: Record<string, unknown>) =>
  Object.assign(new Error(messaggio), { httpStatus, details });

const chiamateGet = (percorso: string) => finti.get.mock.calls.filter(([url]) => String(url).split("?")[0] === percorso).length;

const apri = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/analisi/vendite"]}>
        <Vendite />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return client;
};

/** Sceglie il file e aspetta l'anteprima. */
const caricaFile = async (nome = "vendite-aprile.xlsx") => {
  await userEvent.upload(await screen.findByLabelText("File delle vendite"), xlsx(nome));
  return screen.findByRole("region", { name: "Anteprima dell'import" });
};

describe("pagina Vendite", () => {
  beforeEach(() => {
    finti.venditeAttive = true;
    finti.riepilogo = RIEPILOGO;
    finti.stato = RIEPILOGO.ultimoImport;
    finti.get.mockReset();
    finti.get.mockImplementation(async (url: string) => {
      const percorso = url.split("?")[0];
      if (percorso === PERCORSI_VENDITE.riepilogo) return finti.riepilogo;
      if (percorso === PERCORSI_VENDITE.stato) return finti.stato;
      throw new Error(`Endpoint inatteso: ${url}`);
    });
    finti.post.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mostra righe, prodotti, punti vendita, periodo coperto e l'ultimo import", async () => {
    apri();

    const riepilogo = await screen.findByRole("region", { name: "Riepilogo delle vendite" });
    expect(await within(riepilogo).findByText("12.500")).toBeInTheDocument();
    expect(within(riepilogo).getByText("340")).toBeInTheDocument();
    expect(within(riepilogo).getByText("85")).toBeInTheDocument();
    expect(within(riepilogo).getByText("dal 01/01/2026 al 31/03/2026")).toBeInTheDocument();
    expect(within(riepilogo).getByText("sellout-q1.xlsx")).toBeInTheDocument();
    expect(within(riepilogo).getByText("Completato")).toBeInTheDocument();
    expect(within(riepilogo).getByText("12.500 righe scritte · 3 scartate")).toBeInTheDocument();
    expect(within(riepilogo).getByText("terminato il 02/04/2026 08:05")).toBeInTheDocument();
    // La GDO della sessione: nessun ?gdo= e nessuna scelta della GDO
    expect(finti.get).toHaveBeenCalledWith(PERCORSI_VENDITE.riepilogo);
    expect(screen.queryByLabelText("GDO")).not.toBeInTheDocument();
    // Un import finito prima di aprire la pagina sta nel riepilogo, non nell'avanzamento
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("senza vendite lo dice, e spiega tracciato e sostituzione prima della scelta del file", async () => {
    finti.riepilogo = { gdo: { id: "gdo-1", nome: "CONAD CENTRALE" }, righe: 0, prodotti: 0, puntiVendita: 0, dal: null, al: null, ultimoImport: null };
    finti.stato = null;
    apri();

    expect(await screen.findByText("Nessun import: le vendite della GDO non sono ancora state caricate.")).toBeInTheDocument();
    expect(screen.getByText("punto_vendita")).toBeInTheDocument();
    expect(screen.getByText("Reimportare lo stesso prodotto, punto vendita e periodo sostituisce i dati già presenti.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scegli il file" })).toBeEnabled();
  });

  it("legge il file in anteprima: tracciato, conteggi e righe scartate, con la nota se sono troncate", async () => {
    finti.post.mockResolvedValue(ANTEPRIMA);
    apri();

    const anteprima = await caricaFile();

    const [url, dati, multipart] = finti.post.mock.calls[0];
    expect(url).toBe(PERCORSI_VENDITE.anteprima);
    expect(((dati as FormData).get("file") as File).name).toBe("vendite-aprile.xlsx");
    expect(multipart).toBe(true);

    expect(within(anteprima).getByText("Conad CNO")).toBeInTheDocument();
    expect(within(anteprima).getByText("Cod. articolo")).toBeInTheDocument();
    expect(within(anteprima).getByText("205")).toBeInTheDocument();
    expect(within(anteprima).getByText("202")).toBeInTheDocument();
    expect(within(anteprima).getByText("dal 01/04/2026 al 30/04/2026")).toBeInTheDocument();

    const tabella = within(anteprima).getByRole("table", { name: "Righe scartate" });
    // Intestazione più le righe elencate
    expect(within(tabella).getAllByRole("row")).toHaveLength(MAX_SCARTATE_ANTEPRIMA + 1);
    expect(within(tabella).getByText("Punto vendita sconosciuto: 9999")).toBeInTheDocument();
    expect(within(anteprima).getByText(/al massimo 200 righe scartate: qui ne vedi 200 su 202 scartate/)).toBeInTheDocument();

    expect(within(anteprima).getByRole("button", { name: "Conferma import" })).toBeEnabled();
  });

  it("un file senza le colonne attese non ha righe importabili: la conferma resta disabilitata", async () => {
    finti.post.mockResolvedValue({
      ...ANTEPRIMA,
      tracciato: { nome: "Tracciato generico", colonne: ["codice", "punto_vendita", "dal", "al", "pezzi", "valore"] },
      righe: 2,
      importabili: 0,
      scartate: 2,
      dettaglioScartate: [
        { riga: 2, motivo: "Colonne mancanti nel file: codice, pezzi" },
        { riga: 3, motivo: "Colonne mancanti nel file: codice, pezzi" },
      ],
    });
    apri();

    const anteprima = await caricaFile();

    expect(within(anteprima).getByRole("button", { name: "Conferma import" })).toBeDisabled();
    expect(within(anteprima).getByText("Nessuna riga importabile")).toBeInTheDocument();
    expect(
      within(anteprima).getByText(
        "Controlla che il file abbia le colonne del tracciato Tracciato generico (codice, punto_vendita, dal, al, pezzi, valore), correggilo e caricalo di nuovo."
      )
    ).toBeInTheDocument();
    expect(within(anteprima).getAllByText("Colonne mancanti nel file: codice, pezzi")).toHaveLength(2);
    expect(within(anteprima).queryByText(/al massimo/)).not.toBeInTheDocument();
  });

  it("conferma l'import del file in anteprima e ne mostra l'avanzamento", async () => {
    finti.post.mockImplementation(async (url: string) => {
      if (url === PERCORSI_VENDITE.anteprima) return ANTEPRIMA;
      if (url === PERCORSI_VENDITE.importa) {
        finti.stato = importazione({ elaborate: 0, scritte: 0 });
        return finti.stato;
      }
      throw new Error(`Endpoint inatteso: ${url}`);
    });
    apri();
    const anteprima = await caricaFile();

    await userEvent.click(within(anteprima).getByRole("button", { name: "Conferma import" }));

    const avanzamento = await screen.findByRole("region", { name: "Import in corso" });
    expect(within(avanzamento).getByRole("progressbar", { name: "Avanzamento dell'import delle vendite" })).toHaveAttribute("aria-valuenow", "0");
    expect(within(avanzamento).getByText("0 di 100 righe · 0 scritte · 0 scartate")).toBeInTheDocument();
    const [url, dati, multipart] = finti.post.mock.calls[1];
    expect(url).toBe(PERCORSI_VENDITE.importa);
    expect(((dati as FormData).get("file") as File).name).toBe("vendite-aprile.xlsx");
    expect(multipart).toBe(true);
    // Il file e' partito: l'anteprima si chiude
    expect(screen.queryByRole("region", { name: "Anteprima dell'import" })).not.toBeInTheDocument();
  });

  it("riaprendo la pagina ritrova l'import in corso, lo segue con il polling e alla fine mostra l'esito", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    finti.stato = importazione({ elaborate: 40, scritte: 40 });
    apri();

    const avanzamento = await screen.findByRole("region", { name: "Import in corso" });
    expect(await within(avanzamento).findByText("40 di 100 righe · 40 scritte · 0 scartate")).toBeInTheDocument();
    expect(within(avanzamento).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    const riepiloghi = chiamateGet(PERCORSI_VENDITE.riepilogo);

    finti.stato = importazione({ elaborate: 70, scritte: 69, scartate: 1 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALLO_STATO_IMPORT_MS);
    });
    expect(await screen.findByText("70 di 100 righe · 69 scritte · 1 scartata")).toBeInTheDocument();

    finti.stato = importazione({ stato: "completato", elaborate: 100, scritte: 98, scartate: 2, terminatoIl: "2026-11-09T10:03:00" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALLO_STATO_IMPORT_MS);
    });

    expect(await screen.findByText("Import completato: 98 righe scritte, 2 scartate.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Annulla import" })).not.toBeInTheDocument();
    // Finito l'import il riepilogo si rilegge, e il polling si ferma
    await waitFor(() => expect(chiamateGet(PERCORSI_VENDITE.riepilogo)).toBe(riepiloghi + 1));
    const stati = chiamateGet(PERCORSI_VENDITE.stato);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALLO_STATO_IMPORT_MS * 3);
    });
    expect(chiamateGet(PERCORSI_VENDITE.stato)).toBe(stati);

    // L'esito si chiude; il riepilogo resta
    fireEvent.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(screen.queryByText("Import completato: 98 righe scritte, 2 scartate.")).not.toBeInTheDocument();
  });

  it("annulla l'import in corso solo dopo la conferma costruita nella pagina", async () => {
    const confermaDelBrowser = vi.spyOn(window, "confirm");
    finti.stato = importazione({ elaborate: 40, scritte: 40 });
    finti.post.mockImplementation(async (url: string) => {
      if (url !== PERCORSI_VENDITE.annulla) throw new Error(`Endpoint inatteso: ${url}`);
      finti.stato = importazione({ stato: "annullato", terminatoIl: "2026-11-09T10:01:00" });
      return finti.stato;
    });
    apri();

    await userEvent.click(await screen.findByRole("button", { name: "Annulla import" }));
    const conferma = screen.getByRole("group", { name: "Conferma annullamento" });
    expect(within(conferma).getByText(/Le righe già scritte restano/)).toBeInTheDocument();
    expect(finti.post).not.toHaveBeenCalled();

    // Ci si puo' ripensare
    await userEvent.click(within(conferma).getByRole("button", { name: "No, continua" }));
    expect(screen.queryByRole("group", { name: "Conferma annullamento" })).not.toBeInTheDocument();
    expect(finti.post).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Annulla import" }));
    await userEvent.click(screen.getByRole("button", { name: "Sì, annulla l'import" }));

    expect(finti.post).toHaveBeenCalledWith(PERCORSI_VENDITE.annulla, {});
    expect(await screen.findByText(/^Import annullato\. Righe scritte prima dell'annullamento: 40/)).toBeInTheDocument();
    expect(confermaDelBrowser).not.toHaveBeenCalled();
    confermaDelBrowser.mockRestore();
  });

  it("con un import gia' in corso (409) mostra quello e lascia il file in anteprima", async () => {
    finti.stato = null;
    finti.post.mockImplementation(async (url: string) => {
      if (url === PERCORSI_VENDITE.anteprima) return ANTEPRIMA;
      if (url === PERCORSI_VENDITE.importa) {
        // Un collega l'ha avviato nel frattempo
        finti.stato = importazione({ id: "imp-altro", nomeFile: "vendite-collega.xlsx", elaborate: 10, scritte: 10 });
        throw errore("Un import delle vendite è già in corso per questa GDO", 409);
      }
      throw new Error(`Endpoint inatteso: ${url}`);
    });
    apri();
    const anteprima = await caricaFile();

    await userEvent.click(within(anteprima).getByRole("button", { name: "Conferma import" }));

    const avanzamento = await screen.findByRole("region", { name: "Import in corso" });
    expect(within(avanzamento).getByText(/era già in corso per questa GDO: la pagina segue quello/)).toBeInTheDocument();
    expect(within(avanzamento).getByText("10 di 100 righe · 10 scritte · 0 scartate")).toBeInTheDocument();
    // Il file resta, da confermare a import finito
    const ancora = screen.getByRole("region", { name: "Anteprima dell'import" });
    expect(within(ancora).getByRole("button", { name: "Conferma import" })).toBeDisabled();
    expect(within(ancora).getByText(/potrai confermare questo file quando sarà terminato/)).toBeInTheDocument();
    expect(screen.queryByText(/Import non avviato/)).not.toBeInTheDocument();
  });

  it("un file non riconosciuto mostra il motivo e le colonne attese", async () => {
    finti.post.mockRejectedValue(
      errore("Il file non ha le colonne del tracciato Conad CNO", 400, { colonneAttese: ["Cod. articolo", "PdV", "Pezzi"] })
    );
    apri();

    await userEvent.upload(await screen.findByLabelText("File delle vendite"), xlsx("export-sbagliato.xlsx"));

    expect(await screen.findByText("File non riconosciuto")).toBeInTheDocument();
    expect(screen.getByText("Il file non ha le colonne del tracciato Conad CNO")).toBeInTheDocument();
    expect(screen.getByText("Colonne attese: Cod. articolo, PdV, Pezzi.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Anteprima dell'import" })).not.toBeInTheDocument();
  });

  it("un file che non e' Excel ne' CSV non parte nemmeno per l'anteprima", async () => {
    apri();
    await screen.findByRole("region", { name: "Riepilogo delle vendite" });

    fireEvent.drop(screen.getByTestId("area-file-vendite"), {
      dataTransfer: { files: [new File(["png"], "foto.png", { type: "image/png" })] },
    });

    expect(await screen.findByText("foto.png non è un file Excel o CSV: scegli un file .xlsx, .xls o .csv.")).toBeInTheDocument();
    expect(finti.post).not.toHaveBeenCalled();
  });

  it("lavora sulla GDO operativa della sessione e ne mostra il nome nel titolo, senza sceglierne un'altra", async () => {
    apri();

    expect(await screen.findByRole("heading", { level: 1, name: "Vendite · CONAD CENTRALE" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Scegli la GDO" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("GDO")).not.toBeInTheDocument();
    expect(finti.get).toHaveBeenCalledWith(PERCORSI_VENDITE.riepilogo);
    expect(finti.get).toHaveBeenCalledWith(PERCORSI_VENDITE.stato);
  });

  it("con Vendite e previsioni spenta per la GDO lo dice e non chiede nulla alle API delle vendite", async () => {
    finti.venditeAttive = false;
    apri();

    expect(await screen.findByText("Vendite e previsioni non è attiva per questa GDO")).toBeInTheDocument();
    expect(screen.getByText(/Si attiva in Impostazioni di produzione, Funzionalità/)).toBeInTheDocument();
    expect(screen.queryByLabelText("File delle vendite")).not.toBeInTheDocument();
    expect(finti.get).not.toHaveBeenCalled();
  });

  it("una sessione senza GDO operativa vede il motivo dal server", async () => {
    finti.get.mockImplementation(async () => {
      throw Object.assign(new Error("La sessione non ha una GDO operativa: scegli una GDO per lavorare sulle sue vendite"), { httpStatus: 403 });
    });
    apri();

    expect(await screen.findByText(/La sessione non ha una GDO operativa/)).toBeInTheDocument();
  });
});
