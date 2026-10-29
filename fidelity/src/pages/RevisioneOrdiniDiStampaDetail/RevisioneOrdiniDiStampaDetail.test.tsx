// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATO_ORDINI_STAMPA } from "../../../lib/enums";

vi.mock("socket.io-client", () => ({
  default: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }),
}));
const finti = vi.hoisted(() => ({ axiosPost: vi.fn(), axiosGet: vi.fn(), showNotification: vi.fn() }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.showNotification }) }));
// Nessuna chiamata deve partire senza l'id dell'ordine nell'indirizzo: le richieste restano in sospeso
vi.mock("../../../lib/server_call", () => ({
  ServerCall: {
    get: vi.fn(() => new Promise(() => {})),
    post: vi.fn(() => new Promise(() => {})),
    put: vi.fn(() => new Promise(() => {})),
    getUrl: () => "/api",
    ensureCSRFToken: vi.fn(async () => "token-csrf"),
  },
}));
vi.mock("axios", () => ({ default: { post: finti.axiosPost, get: finti.axiosGet } }));

import RevisioneOrdiniDiStampa from ".";

const apri = async (stato: string, dettagli: unknown[] = []) => {
  const router = createMemoryRouter(
    [
      {
        path: "/ods-in-corso/revisione",
        loader: () => ({
          dettagli,
          ordine: { id_ordinistampa: "o1", stato_ordinistampa: stato },
          promo: { id: "p1", nome: "Volantino ottobre" },
          ordiniInvii: [],
        }),
        element: <RevisioneOrdiniDiStampa />,
      },
    ],
    { initialEntries: ["/ods-in-corso/revisione"] }
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  await screen.findByRole("heading", { level: 1 });
};

describe("Revisione ordine di stampa", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_WS_URL", "http://localhost/api");
    finti.axiosPost.mockReset();
    finti.axiosGet.mockReset();
    finti.showNotification.mockReset();
  });

  it("senza kit mostra lo stato vuoto dentro la sezione dei kit, con la ricerca", async () => {
    await apri(STATO_ORDINI_STAMPA.IN_REVISIONE);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Revisione ordine di stampa");
    expect(screen.getByRole("link", { name: /Torna agli ordini/ })).toHaveAttribute("href", "/ods-in-corso");

    const sezione = screen.getByRole("region", { name: "Kit dell'ordine" });
    expect(within(sezione).getByRole("searchbox", { name: "Cerca per titolo, area, canale" })).toBeInTheDocument();
    expect(within(sezione).getByRole("heading", { name: "Nessun kit da revisionare" })).toBeInTheDocument();
    // Senza kit disponibili non c'è niente da inviare
    expect(screen.queryByRole("button", { name: /Manda file alla tipografia/ })).not.toBeInTheDocument();
  });

  it("un ordine completato si apre in sola lettura con gli invii e la loro ricerca", async () => {
    await apri(STATO_ORDINI_STAMPA.FINITO);

    expect(await screen.findByRole("heading", { level: 1, name: "Dettaglio ordine completato" })).toBeInTheDocument();

    const invii = screen.getByRole("region", { name: "Invii effettuati (0)" });
    expect(within(invii).getByRole("searchbox", { name: "Cerca nei kit inviati" })).toBeInTheDocument();
    expect(within(invii).getByRole("heading", { name: "Nessun invio trovato" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Kit dell'ordine" })).not.toBeInTheDocument();
  });

  it("Scarica ZIP chiede lo ZIP del kit a POST /downloadKitZip con i suoi file e il token CSRF", async () => {
    const files = [
      { id: "f1", nome: "pagina-1.pdf", id_olimpo_cloud: "olimpo-1" },
      { id: "f2", nome: "pagina-2.pdf", id_olimpo_cloud: "olimpo-2" },
    ];
    finti.axiosPost.mockResolvedValue({ status: 200, data: new Blob(["zip"]) });
    // jsdom non crea URL per i Blob: restano finti per tutto il file (l'URL si libera dopo un timer)
    URL.createObjectURL = vi.fn(() => "blob:zip");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await apri(STATO_ORDINI_STAMPA.IN_REVISIONE, [
      { guidId: "kit-1", titolo: "Volantino nord", files, stato_lavorazione: "PUBBLICATO" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Espandi kit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Scarica ZIP" }));

    await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
    // Il link temporaneo non resta nella pagina
    expect(document.querySelector("a[download]")).toBeNull();
    expect(finti.axiosPost).toHaveBeenCalledWith(
      "/api/downloadKitZip",
      { lavorazioneId: "kit-1", files },
      expect.objectContaining({ responseType: "blob", withCredentials: true, headers: { "x-csrf-token": "token-csrf" } })
    );
    // La vecchia rotta GET /getFileZipDownload non esiste
    expect(finti.axiosGet).not.toHaveBeenCalled();
    expect(finti.showNotification).not.toHaveBeenCalledWith("Download del file ZIP non riuscito.", expect.anything());
    click.mockRestore();
  });

  it("se il server non restituisce lo ZIP avvisa che il download non e' riuscito", async () => {
    finti.axiosPost.mockRejectedValue(new Error("Request failed with status code 500"));

    await apri(STATO_ORDINI_STAMPA.IN_REVISIONE, [
      { guidId: "kit-1", titolo: "Volantino nord", files: [{ id: "f1", nome: "pagina-1.pdf" }], stato_lavorazione: "PUBBLICATO" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Espandi kit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Scarica ZIP" }));

    await vi.waitFor(() => expect(finti.showNotification).toHaveBeenCalledWith("Download del file ZIP non riuscito.", { variant: "error" }));
  });
});
