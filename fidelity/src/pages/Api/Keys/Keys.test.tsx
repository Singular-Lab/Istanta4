// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura del Dialog
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({ loader: null as unknown, post: vi.fn() }));

vi.mock("../../../../lib/server_call", () => ({
  ServerCall: { get: vi.fn(), post: finti.post, put: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/components/SessionChecker", () => ({ default: <T,>(Componente: T) => Componente }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/context/UserContext", () => ({ useUser: () => ({ user: { id: "u1" } }) }));
vi.mock("@/components/PermissionGate", () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLoaderData: () => finti.loader,
}));

import ApiKeysPage from ".";

// Forma delle chiavi emesse dal server: 160 caratteri esadecimali
const CHIAVE_NUOVA = "a1".repeat(80);

const apri = () =>
  render(
    <MemoryRouter>
      <ApiKeysPage />
    </MemoryRouter>
  );

describe("API Keys", () => {
  beforeEach(() => {
    finti.post.mockReset();
  });

  it("con una chiave configurata mostra solo quando è stata generata, mai la chiave", () => {
    finti.loader = { statoApiKey: { configurata: true, generataIl: "2026-10-01T08:30:00.000Z" } };
    apri();

    expect(screen.getAllByText(/Chiave configurata il 01\/10\/2026/).length).toBeGreaterThan(0);
    expect(screen.getByText(/la chiave non è più visualizzabile/)).toBeInTheDocument();
    // Gli esempi usano il placeholder
    expect(document.body.textContent).toContain("x-api-key: LA_TUA_API_KEY");
    expect(document.body.textContent).not.toMatch(/[0-9a-f]{64}/);
  });

  it("senza chiave invita a generarne una", () => {
    finti.loader = { statoApiKey: { configurata: false, generataIl: null } };
    apri();

    expect(screen.getAllByText("Nessuna API Key attiva").length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain("LA_TUA_API_KEY");
  });

  it("se lo stato non si può leggere la pagina resta usabile, senza chiave", () => {
    finti.loader = { statoApiKey: null };
    apri();

    expect(screen.getAllByText("Nessuna API Key attiva").length).toBeGreaterThan(0);
  });

  it("la chiave in chiaro compare solo dopo la generazione, con l'avviso che non sarà più mostrata", async () => {
    const utente = userEvent.setup();
    finti.loader = { statoApiKey: { configurata: true, generataIl: "2026-10-01T08:30:00.000Z" } };
    finti.post.mockResolvedValue({
      success: true,
      apiKey: { apiKey: CHIAVE_NUOVA, id_utente: "u1", id_ruolo: "r1", generated_at: "2026-10-28T09:00:00.000Z" },
    });
    apri();

    expect(screen.queryByText(CHIAVE_NUOVA)).not.toBeInTheDocument();

    await utente.click(screen.getByRole("button", { name: /Genera nuova API Key/ }));
    await utente.click(await screen.findByRole("button", { name: "Genera chiave" }));

    expect(finti.post).toHaveBeenCalledWith("/external/generate-api-key", {}, false);
    expect(await screen.findByText(CHIAVE_NUOVA)).toBeInTheDocument();
    expect(screen.getByText(/Per sicurezza la chiave non sarà più mostrata/)).toBeInTheDocument();
    // Ora gli esempi sono pronti da copiare con la chiave appena generata
    expect(document.body.textContent).toContain(`x-api-key: ${CHIAVE_NUOVA}`);
  });
});
