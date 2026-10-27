// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ loader: null as unknown }));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("../../../query/query", () => ({
  useFetchFieldOptions: () => ({ data: [] }),
  useFetchTipiExport: () => ({ data: [] }),
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLoaderData: () => finti.loader,
}));

import PluginPage from ".";

const apri = () =>
  render(
    <MemoryRouter>
      <PluginPage />
    </MemoryRouter>
  );

describe("Plugin", () => {
  it("senza Filter Template mostra un solo stato vuoto, con il comando per crearne uno", () => {
    finti.loader = { apiKey: "chiave", template: [], template_filters: { success: true, data: [], timestamp: new Date() } };
    apri();

    expect(screen.getByRole("heading", { level: 1, name: "Plugin" })).toBeInTheDocument();
    expect(screen.getAllByText(/Nessun template/)).toHaveLength(1);
    expect(screen.getByText("Nessun template disponibile")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crea nuovo template" })).toBeInTheDocument();
  });

  it("con dei template e nessuno selezionato invita a sceglierne uno", () => {
    finti.loader = {
      apiKey: "chiave",
      template: [],
      template_filters: {
        success: true,
        data: [{ id_filter_template: "t1", nome: "Vetrina", slug: "vetrina", is_active: true, endpoint_type: "refs", render_type: "grid", template_ids: [], export_codes: [], filters: [] }],
        timestamp: new Date(),
      },
    };
    apri();

    expect(screen.getByText("Nessun template selezionato")).toBeInTheDocument();
    expect(screen.queryByText("Nessun template disponibile")).not.toBeInTheDocument();
  });
});
