// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ permessi: new Set<string>() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/context/PermissionContext", () => ({
  usePermissionContext: () => ({ hasPermission: (codice: string) => finti.permessi.has(codice), loading: false }),
}));

import WorkspaceWebpliant from ".";

const DATI = {
  aree: [{ id: "a1", nome: "Toscana" }],
  canali: [{ id: "c1", nome: "Conad City" }],
  puntiVendita: [],
  workspaces: [
    { idWorkspace: "ws-1", nomeWorkspace: "Volantino Toscana", idArea: "a1", idCanale: "c1", idGDO: "g1", nomeArea: "Toscana", nomeCanale: "Conad City", webpliant: [], sitemap: [] },
  ],
};

const apri = () => {
  const router = createMemoryRouter([{ path: "/webliant/workspace", loader: () => DATI, element: <WorkspaceWebpliant /> }], {
    initialEntries: ["/webliant/workspace"],
  });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

describe("Workspace WebPliant", () => {
  beforeEach(() => {
    finti.permessi = new Set(["webpliant.visualizza", "webpliant.configura"]);
  });

  it("elenca i workspace e apre l'editor al nuovo indirizzo, in una nuova scheda", async () => {
    apri();

    expect(await screen.findByRole("heading", { level: 1, name: "Workspace WebPliant" })).toBeInTheDocument();
    const scheda = screen.getByRole("link", { name: /Volantino Toscana/ });
    expect(scheda).toHaveAttribute("href", "/webliant/workspace/editor?id=ws-1");
    expect(scheda).toHaveAttribute("target", "_blank");
  });

  it("senza il permesso delle impostazioni generali non porta all'aspetto del sito web", async () => {
    apri();

    await screen.findByRole("heading", { level: 1, name: "Workspace WebPliant" });
    expect(screen.queryByRole("link", { name: "Aspetto del sito web" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crea workspace" })).toBeInTheDocument();
  });

  it("con il permesso delle impostazioni generali porta alla sezione Aspetto del sito web delle Impostazioni GDO", async () => {
    finti.permessi.add("impostazioni.modifica_generali");
    apri();

    expect(await screen.findByRole("link", { name: "Aspetto del sito web" })).toHaveAttribute(
      "href",
      "/impostazioni-gdo?sezione=aspetto-sito-web"
    );
  });
});
