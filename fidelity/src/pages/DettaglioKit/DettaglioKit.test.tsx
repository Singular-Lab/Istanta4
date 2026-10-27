// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Con il kit mancante la pagina si ferma prima del layout: bastano segnaposto
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/components/KitOverview", () => ({ KitOverviewLayout: () => null, KitPreStartView: () => null }));
vi.mock("./context/KitContext", () => ({ KitProvider: ({ children }: any) => <>{children}</>, useKit: () => ({}) }));
vi.mock("./hooks/useKitLogic", () => ({ default: () => ({}) }));
vi.mock("../DettaglioSingolaLavorazione/dialogs/DeleteProcessingDialog", () => ({ default: () => null }));
vi.mock("../DettaglioSingolaLavorazione/dialogs/PubblicaKitRuntimeDialog", () => ({ default: () => null }));
vi.mock("../DettaglioSingolaLavorazione/dialogs/RilavoraDialog", () => ({ default: () => null }));
vi.mock("../DettaglioSingolaLavorazione/dialogs/RiportaInLavorazioneDialog", () => ({ default: () => null }));
vi.mock("../DettaglioSingolaLavorazione/dialogs/StartProcessingDialog", () => ({ default: () => null }));
vi.mock("../DettaglioSingolaLavorazione/dialogs/StartRevisionDialog", () => ({ default: () => null }));
vi.mock("../DettaglioSingolaLavorazione/dialogs/UploadErroriDialog", () => ({ default: () => null }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn() } }));

import DettaglioKit from ".";

describe("Dettaglio kit", () => {
  it("se il kit non arriva mostra la pagina non caricata e Riprova rilancia il loader", async () => {
    const loader = vi.fn(() => ({ kit: null }));
    const router = createMemoryRouter(
      [{ path: "/promozioni/in-corso/dettagli/:idPromo/kits/:idKit", loader, element: <DettaglioKit /> }],
      { initialEntries: ["/promozioni/in-corso/dettagli/p1/kits/k1"] }
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Impossibile caricare la pagina" })).toBeInTheDocument();
    expect(screen.getByText("Kit non trovato o non caricato")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));

    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
  });
});
