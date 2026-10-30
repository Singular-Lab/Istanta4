// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EsitoImportExport } from "../../../lib/puntiVendita/storia";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura del Dialog
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: finti.post, put: vi.fn(), delete: vi.fn() } }));

import { fileInOrdine, ImportStoricoVolantini } from "./ImportStoricoVolantini";

const ESITO: EsitoImportExport = {
  file: [
    {
      nomeFile: "VOL_TOSCANA.json",
      esito: "registrato",
      promo: { id: "p1", nome: "Promo ottobre" },
      kit: { id: "k1", nome: "Volantino Toscana" },
      righe: 42,
      abbinate: 40,
    },
    { nomeFile: "appunti.json", esito: "scartato", motivo: "Non è un export del Plugin", righe: 0, abbinate: 0 },
  ],
  registrati: 1,
  scartati: 1,
  righe: 42,
  abbinate: 40,
};

const json = (nome: string) => new File(['{"pv":""}'], nome, { type: "application/json" });

const apri = () => {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalida = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <ImportStoricoVolantini open onClose={onClose} />
    </QueryClientProvider>
  );
  return { onClose, invalida };
};

describe("Importa storico dai volantini", () => {
  beforeEach(() => {
    finti.post.mockReset();
  });

  it("spiega quali file scegliere e che l'anagrafica non viene modificata", async () => {
    apri();

    expect(await screen.findByText(/cartella/)).toHaveTextContent("EXPORT di ogni promozione");
    expect(screen.getByText("L'anagrafica dei punti vendita non viene modificata.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importa" })).toBeDisabled();
  });

  it("invia tutti i file scelti nel campo file e mostra l'esito di ognuno con i totali", async () => {
    finti.post.mockResolvedValue(ESITO);
    const { invalida } = apri();

    await userEvent.upload(await screen.findByLabelText("File JSON degli export"), [json("VOL_TOSCANA.json"), json("appunti.json")]);
    await userEvent.click(screen.getByRole("button", { name: "Importa 2 file" }));

    const [url, corpo, upload] = finti.post.mock.calls[0];
    expect(url).toBe("/punti-vendita/storia/import-export");
    expect(upload).toBe(true);
    expect((corpo as FormData).getAll("file").map(f => (f as File).name)).toEqual(["VOL_TOSCANA.json", "appunti.json"]);

    const esito = await screen.findByRole("status", { name: "Esito dell'importazione" });
    expect(esito).toHaveTextContent("1 registrato");
    expect(esito).toHaveTextContent("1 scartato");
    expect(esito).toHaveTextContent("42 righe");
    expect(esito).toHaveTextContent("40 abbinate (95%)");
    // Gli scartati in cima, con il motivo: sono quelli su cui intervenire
    const righe = within(esito).getAllByRole("row");
    expect(righe[1]).toHaveTextContent("appunti.json");
    expect(righe[1]).toHaveTextContent("Scartato");
    expect(righe[1]).toHaveTextContent("Non è un export del Plugin");
    expect(righe[2]).toHaveTextContent("VOL_TOSCANA.json");
    expect(righe[2]).toHaveTextContent("Registrato");
    expect(righe[2]).toHaveTextContent("Volantino Toscana · Promo ottobre");
    // La storia delle schede già aperte si ricarica, con l'elenco e la gestione
    expect(invalida).toHaveBeenCalledWith({ queryKey: ["puntiVendita", "storia"] });
    expect(invalida).toHaveBeenCalledWith({ queryKey: ["puntiVendita", "consultazione"] });
    expect(invalida).toHaveBeenCalledWith({ queryKey: ["puntiVendita", "gestione"] });
  });

  it("gli scartati vengono prima dei registrati qualunque sia l'ordine del server", () => {
    const registrato = ESITO.file[0];
    const scartato = ESITO.file[1];
    expect(fileInOrdine([registrato, scartato, registrato]).map(f => f.esito)).toEqual(["scartato", "registrato", "registrato"]);
    expect(fileInOrdine([])).toEqual([]);
  });

  it("i file si possono trascinare nell'area: quelli che non sono .json vengono ignorati e lo dice", async () => {
    apri();

    const area = (await screen.findByText("Trascina qui i file .json")).closest("div")!.parentElement!;
    fireEvent.drop(area, { dataTransfer: { files: [json("VOL.json"), new File(["x"], "note.txt", { type: "text/plain" })] } });

    expect(screen.getByText("1 file ignorato: non è un .json.")).toBeInTheDocument();
    expect(screen.getByText("VOL.json")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importa" })).toBeEnabled();
  });

  it("oltre il limite del server non parte e dice quanti file sono troppi", async () => {
    apri();

    const area = (await screen.findByText("Trascina qui i file .json")).closest("div")!.parentElement!;
    fireEvent.drop(area, { dataTransfer: { files: Array.from({ length: 301 }, (_, i) => json(`VOL_${i}.json`)) } });

    expect(screen.getByText(/Al massimo 300 file per volta: ne hai scelti 301/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importa 301 file" })).toBeDisabled();
    expect(finti.post).not.toHaveBeenCalled();
  });

  it("dopo l'esito si possono importare altri file: l'esito precedente sparisce", async () => {
    finti.post.mockResolvedValue(ESITO);
    apri();

    await userEvent.upload(await screen.findByLabelText("File JSON degli export"), [json("VOL_TOSCANA.json")]);
    await userEvent.click(screen.getByRole("button", { name: "Importa" }));
    await screen.findByRole("status", { name: "Esito dell'importazione" });

    await userEvent.click(screen.getByRole("button", { name: /Importa altri file/ }));

    expect(screen.queryByRole("status", { name: "Esito dell'importazione" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importa" })).toBeDisabled();
  });

  it("se il server rifiuta l'import lo dice nel modale, senza esito", async () => {
    finti.post.mockRejectedValue(new Error("Serve il permesso di gestire i punti vendita"));
    apri();

    await userEvent.upload(await screen.findByLabelText("File JSON degli export"), [json("VOL.json")]);
    await userEvent.click(screen.getByRole("button", { name: "Importa" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Importazione non riuscita: Serve il permesso di gestire i punti vendita");
    expect(screen.queryByRole("status", { name: "Esito dell'importazione" })).not.toBeInTheDocument();
  });
});
