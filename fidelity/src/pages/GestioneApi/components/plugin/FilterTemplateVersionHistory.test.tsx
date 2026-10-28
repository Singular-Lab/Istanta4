// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura del Dialog
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../../../lib/server_call", () => ({
  ServerCall: { get: finti.get, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import FilterTemplateVersionHistory from "./FilterTemplateVersionHistory";

const versione = (numero: number, extra: Record<string, unknown> = {}) => ({
  id_filter_template: `id-v${numero}`,
  version: numero,
  nome: "Vetrina",
  is_active: true,
  is_latest: numero === 2,
  deleted_at: null,
  createdat: "2026-10-01T10:00:00Z",
  ...extra,
});

describe("Cronologia versioni del Filter Template", () => {
  it("legge cronologia e anteprima con la sessione, senza inviare la chiave API", async () => {
    finti.get.mockImplementation(async (url: string) =>
      url.endsWith("/versions")
        ? { success: true, data: { slug: "vetrina", total_versions: 2, current_version: {}, versions: [versione(2), versione(1, { is_active: false })] } }
        : { success: true, data: { id_filter_template: "id-v1", nome: "Vetrina", slug: "vetrina", version: 1 } }
    );
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FilterTemplateVersionHistory slug="vetrina" isOpen onClose={vi.fn()} onRestore={vi.fn()} isRestoring={false} />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Versione v1")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Visualizza" })[1]);

    // Anche una versione inattiva si legge per id: la rotta per slug è quella del plugin
    await vi.waitFor(() => expect(finti.get).toHaveBeenCalledWith("/external/filter-templates/id-v1"));
    expect(finti.get).toHaveBeenCalledWith("/external/filter-templates/slug/vetrina/versions");
    // Solo l'URL: nessun header personalizzato (prima c'era x-api-key)
    for (const argomenti of finti.get.mock.calls) {
      expect(argomenti).toHaveLength(1);
    }
  });
});
