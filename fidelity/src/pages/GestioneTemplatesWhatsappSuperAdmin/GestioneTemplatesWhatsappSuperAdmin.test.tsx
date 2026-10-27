// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  navigate: vi.fn(),
  revalidate: vi.fn(),
  datiLoader: {} as Record<string, unknown>,
}));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/components/PermissionGate", () => ({ PermissionGate: ({ children }: any) => <>{children}</> }));
vi.mock("../../context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("react-router-dom", async (originale) => ({
  ...(await originale<typeof import("react-router-dom")>()),
  useLoaderData: () => finti.datiLoader,
  useNavigate: () => finti.navigate,
  useRevalidator: () => ({ revalidate: finti.revalidate }),
}));

import GestioneTemplatesWhatsappSuperAdmin from ".";

const dettagliGDO = { id: "n1", id_gdo: "gdo-1", nome: "GDO Uno", stato: "VERIFIED", access_token_configurato: true, verify_token_configurato: true };

const bozza = {
  id_gdowhatsapptemplate: "t1",
  id_gdo_gdowhatsapptemplate: "gdo-1",
  nome_template_gdowhatsapptemplate: "promo_autunno",
  lingua_template_gdowhatsapptemplate: "it",
  categoria_template_gdowhatsapptemplate: "MARKETING",
  stato_meta_gdowhatsapptemplate: "CREATED_BUT_NOT_SYNCED",
  json_meta_gdowhatsapptemplate: { name: "promo_autunno" },
  preset_count: 0,
};

const apri = (dati: Record<string, unknown>) => {
  finti.datiLoader = dati;
  return render(
    <MemoryRouter>
      <GestioneTemplatesWhatsappSuperAdmin />
    </MemoryRouter>
  );
};

describe("Template WhatsApp di una GDO", () => {
  beforeEach(() => {
    finti.navigate.mockReset();
    finti.revalidate.mockReset();
  });

  it("Crea nuovo template apre la creazione per la GDO della pagina", async () => {
    apri({ idGDO: "gdo-1", templatesWhatsapp: [], dettagliGDO, errore: null });

    await userEvent.click(screen.getByRole("button", { name: "Crea nuovo template" }));

    expect(finti.navigate).toHaveBeenCalledWith("crea?id=gdo-1");
  });

  it("lo stato di un template mai inviato a Meta si legge Bozza locale", () => {
    apri({ idGDO: "gdo-1", templatesWhatsapp: [bozza], dettagliGDO, errore: null });

    expect(screen.getByTitle("Bozza locale")).toHaveAttribute("data-tono", "warning");
  });

  it("se i dati non arrivano mostra l'errore con Riprova", async () => {
    apri({ idGDO: "gdo-2", templatesWhatsapp: [], dettagliGDO: null, errore: "GDO non trovata" });

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("GDO non trovata");
    await userEvent.click(within(avviso).getByRole("button", { name: "Riprova" }));
    expect(finti.revalidate).toHaveBeenCalledTimes(1);
  });

  it("senza canale configurato propone il setup invece di un errore", async () => {
    apri({ idGDO: "gdo-3", templatesWhatsapp: [], dettagliGDO: null, errore: null });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Configura il canale/ }));
    expect(finti.navigate).toHaveBeenCalledWith("/whatsapp/gestione-whatsapp-superadmin/setup?id=gdo-3");
  });
});
