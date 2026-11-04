// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/server_call", () => ({
  ServerCall: { get: vi.fn().mockResolvedValue({ stato: "Terminata", error: "", esito: true }), put: vi.fn(), post: vi.fn() },
}));
vi.mock("../../../context/PermissionContext", () => ({ usePermissionContext: () => ({ hasPermission: () => true }) }));

import { ServerCall } from "../../../../lib/server_call";
import type { TracciatiResponseDTO } from "../../../../server/core/dto";
import TracciatoCard from "./TracciatoCard";

const PROMO = "11111111-2222-4333-8444-555555555555";

// Scartato: l'unico stato in cui il tracciato si può eliminare
const tracciato = { id: "t1", nome: "ufi.xlsx", stato: "Scartato", id_promo: PROMO } as unknown as TracciatiResponseDTO;

const apri = (props: { promoStorico: boolean; azioniBloccate?: boolean }, scheda_: TracciatiResponseDTO = tracciato) => {
  const scheda = (
    <TracciatoCard
      tracciato={scheda_}
      getFileSize={() => "0.10"}
      handleDownload={vi.fn()}
      expandedErrorTracciatoId={null}
      setExpandedErrorTracciatoId={vi.fn()}
      formatDate={() => "01/04/2025"}
      getShortError={(errore) => errore}
      onDeleteTracciato={vi.fn()}
      {...props}
    />
  );
  const router = createMemoryRouter(
    [
      { path: "/", element: scheda },
      { path: "/promozioni/storico/dettagli/:idPromo/anteprima-tracciato/:idTracciato", element: <p>Anteprima dallo storico</p> },
      { path: "/promozioni/in-corso/dettagli/:idPromo/anteprima-tracciato/:idTracciato", element: <p>Anteprima dalle promo in corso</p> },
    ],
    { initialEntries: ["/"] }
  );
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

describe("TracciatoCard: azioni su una promo chiusa", () => {
  it("su una promo chiusa senza blocco (Superadmin) rinomina ed eliminazione restano disponibili", () => {
    apri({ promoStorico: true, azioniBloccate: false });

    expect(screen.getByRole("button", { name: "Rinomina tracciato" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elimina tracciato" })).toBeInTheDocument();
  });

  it("con le azioni bloccate restano solo anteprima e download", () => {
    apri({ promoStorico: true, azioniBloccate: true });

    expect(screen.queryByRole("button", { name: "Rinomina tracciato" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elimina tracciato" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anteprima tracciato" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scarica file" })).toBeInTheDocument();
  });

  it("senza indicazione esplicita una promo dello storico resta in sola lettura", () => {
    apri({ promoStorico: true });

    expect(screen.queryByRole("button", { name: "Rinomina tracciato" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elimina tracciato" })).not.toBeInTheDocument();
  });

  it("anche quando il Superadmin può agire, l'anteprima di una promo chiusa si apre dallo storico", async () => {
    apri({ promoStorico: true, azioniBloccate: false });

    await userEvent.click(screen.getByRole("button", { name: "Anteprima tracciato" }));
    expect(await screen.findByText("Anteprima dallo storico")).toBeInTheDocument();
  });
});

// TASK-3dfe3302: un tracciato salvato in FP che Istanta non ha ancora accettato
const inAttesa = {
  id: "t2",
  nome: "lista.xlsx",
  id_promo: PROMO,
  // Come lo salva l'upload: il campo con le sue opzioni (vuote per un testo libero) e il valore scelto
  context: [{ nome_field: "idLabel", titolo_field: "Etichetta", valore: [], user_value: "main" }],
  istanta: { stato: "errore", errore: "label non valida", tentativi: 2 },
} as unknown as TracciatiResponseDTO;

describe("TracciatoCard: tracciato non ancora in Istanta", () => {
  it("mostra lo stato e il motivo, non chiede a Istanta lo stato dell'importazione", async () => {
    vi.mocked(ServerCall.get).mockClear();
    apri({ promoStorico: false, azioniBloccate: false }, inAttesa);

    expect(screen.getByText("Non accettato da Istanta")).toBeInTheDocument();
    expect(screen.getByText(/label non valida/)).toBeInTheDocument();
    expect(ServerCall.get).not.toHaveBeenCalledWith(expect.stringContaining("getStatusImportazione"));
    // Si puo' anche eliminare, come uno scartato
    expect(screen.getByRole("button", { name: "Elimina tracciato" })).toBeInTheDocument();
  });

  it("Rimanda a Istanta invia subito e mostra l'esito", async () => {
    vi.mocked(ServerCall.post).mockResolvedValue({ esito: "inviata" });
    apri({ promoStorico: false, azioniBloccate: false }, inAttesa);

    await userEvent.click(screen.getByRole("button", { name: "Rimanda a Istanta" }));

    expect(ServerCall.post).toHaveBeenCalledWith("/tracciati/t2/rimanda-istanta", {});
    expect(await screen.findByText("Istanta ha accettato il tracciato.")).toBeInTheDocument();
  });

  it("il contesto si corregge prima del rinvio", async () => {
    vi.mocked(ServerCall.put).mockResolvedValue({ esito: "aggiornato" });
    apri({ promoStorico: false, azioniBloccate: false }, inAttesa);

    await userEvent.click(screen.getByRole("button", { name: "Modifica contesto" }));
    const etichetta = await screen.findByRole("textbox", { name: "Etichetta" });
    await userEvent.clear(etichetta);
    await userEvent.type(etichetta, "tecnica");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    expect(ServerCall.put).toHaveBeenCalledWith("/tracciati/t2/contesto", {
      context: [{ nome_field: "idLabel", titolo_field: "Etichetta", valore: [], user_value: "tecnica" }],
    });
  });

  it("con le azioni bloccate non si rimanda ne' si modifica", () => {
    apri({ promoStorico: true, azioniBloccate: true }, inAttesa);

    expect(screen.getByText("Non accettato da Istanta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rimanda a Istanta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Modifica contesto" })).not.toBeInTheDocument();
  });
});
