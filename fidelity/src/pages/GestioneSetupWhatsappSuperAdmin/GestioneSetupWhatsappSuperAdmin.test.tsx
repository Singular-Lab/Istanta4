// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  put: vi.fn(),
  revalidate: vi.fn(),
  showNotification: vi.fn(),
  datiLoader: {} as Record<string, unknown>,
}));

vi.mock("../../../lib/server_call", () => ({
  ServerCall: { put: finti.put, getUrl: () => "https://fidelity.example.test" },
}));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("../../context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.showNotification }) }));
vi.mock("react-router-dom", async (originale) => ({
  ...(await originale<typeof import("react-router-dom")>()),
  useLoaderData: () => finti.datiLoader,
  useRevalidator: () => ({ revalidate: finti.revalidate }),
}));

import GestioneSetupWhatsappSuperAdmin from ".";

const configurato = {
  id: "n1",
  id_gdo: "gdo-1",
  nome: "GDO Uno",
  id_numero_whatsapp: "phone-id-finto",
  display_name: "Negozio Uno",
  stato: "VERIFIED",
  provider: "META",
  whatsapp_business_account_id: "waba-finto",
  access_token_configurato: true,
  verify_token_configurato: true,
};

const apri = (dati: Record<string, unknown>) => {
  finti.datiLoader = dati;
  return render(
    <MemoryRouter>
      <GestioneSetupWhatsappSuperAdmin />
    </MemoryRouter>
  );
};

describe("Setup del canale WhatsApp", () => {
  beforeEach(() => {
    finti.put.mockReset().mockResolvedValue({ success: true });
    finti.revalidate.mockReset();
    finti.showNotification.mockReset();
  });

  it("i token non compaiono mai nella pagina: si vede solo che sono configurati", () => {
    // Anche se una risposta vecchia contenesse ancora il token, la pagina non lo usa
    apri({ idGDO: "gdo-1", dettagliGDO: { ...configurato, access_token: "segreto-finto" }, errore: null });

    const accessToken = screen.getByLabelText(/Access Token/);
    expect(accessToken).toHaveAttribute("type", "password");
    expect(accessToken).toHaveValue("");
    expect(accessToken).toHaveAccessibleDescription(/Configurato/);
    expect(document.body.innerHTML).not.toContain("segreto-finto");
  });

  it("Salva non invia i token lasciati vuoti", async () => {
    apri({ idGDO: "gdo-1", dettagliGDO: configurato, errore: null });

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Stato" }), "PAUSED");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(finti.revalidate).toHaveBeenCalled());
    expect(finti.put).toHaveBeenCalledWith("/whatsapp/setup_gdo_whatsapp", {
      id_gdo: "gdo-1",
      display_name: "Negozio Uno",
      id_numero_whatsapp: "phone-id-finto",
      whatsapp_business_account_id: "waba-finto",
      stato: "PAUSED",
    });
  });

  it("un token riscritto viene inviato e poi il campo torna vuoto", async () => {
    apri({ idGDO: "gdo-1", dettagliGDO: configurato, errore: null });

    await userEvent.type(screen.getByLabelText(/Access Token/), "nuovo-token-finto");
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(finti.put).toHaveBeenCalledWith("/whatsapp/setup_gdo_whatsapp", expect.objectContaining({ access_token: "nuovo-token-finto" })));
    expect(finti.put.mock.calls[0][1]).not.toHaveProperty("verify_token");
    await waitFor(() => expect(screen.getByLabelText(/Access Token/)).toHaveValue(""));
  });

  it("un canale non ancora configurato si crea per la GDO dell'indirizzo", async () => {
    apri({ idGDO: "gdo-2", dettagliGDO: null, errore: null });

    expect(screen.getByTitle("Non configurato")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(finti.put).toHaveBeenCalledWith("/whatsapp/setup_gdo_whatsapp", expect.objectContaining({ id_gdo: "gdo-2", stato: "PENDING" })));
  });

  it("se il server rifiuta il salvataggio ne mostra il motivo", async () => {
    finti.put.mockRejectedValue(new Error("Per configurare il canale servono access token e verify token"));
    apri({ idGDO: "gdo-2", dettagliGDO: null, errore: null });

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() =>
      expect(finti.showNotification).toHaveBeenCalledWith("Per configurare il canale servono access token e verify token", { variant: "error" })
    );
    expect(finti.revalidate).not.toHaveBeenCalled();
  });

  it("se la configurazione non arriva mostra l'errore con Riprova", async () => {
    apri({ idGDO: "gdo-1", dettagliGDO: null, errore: "GDO non trovata" });

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("GDO non trovata");
    await userEvent.click(within(avviso).getByRole("button", { name: "Riprova" }));
    expect(finti.revalidate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Salva" })).not.toBeInTheDocument();
  });
});
