// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), navigate: vi.fn(), showNotification: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { post: finti.post, put: finti.put } }));
vi.mock("../../components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("../../context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.showNotification }) }));
vi.mock("react-router-dom", async (originale) => ({
  ...(await originale<typeof import("react-router-dom")>()),
  useNavigate: () => finti.navigate,
}));

import CreaTemplatesWhatsappSuperAdmin from ".";

const BASE = "/whatsapp/gestione-whatsapp-superadmin/templates";

const apri = (percorso = `${BASE}/crea?id=gdo-1`) =>
  render(
    <MemoryRouter initialEntries={[percorso]}>
      <CreaTemplatesWhatsappSuperAdmin />
    </MemoryRouter>
  );

// Compila un modello valido con un segnaposto e il suo esempio
const compila = async (nome = "promo_autunno") => {
  await userEvent.type(screen.getByRole("textbox", { name: /Nome template/ }), nome);
  await userEvent.type(screen.getByRole("textbox", { name: /Corpo del messaggio/ }), "Ciao {{{{1}}");
  await userEvent.type(await screen.findByRole("textbox", { name: /Esempio per \{\{1\}\}/ }), "Mario");
};

describe("Crea template WhatsApp", () => {
  beforeEach(() => {
    finti.post.mockReset().mockResolvedValue({ success: true, newTemplateId: "t-nuovo" });
    finti.put.mockReset().mockResolvedValue({ success: true, stato: "PENDING" });
    finti.navigate.mockReset();
    finti.showNotification.mockReset();
  });

  it("senza la GDO nell'indirizzo mostra l'errore e nessun form", () => {
    apri(`${BASE}/crea`);

    expect(screen.getByRole("alert")).toHaveTextContent("GDO non indicata");
    expect(screen.queryByRole("button", { name: "Salva bozza" })).not.toBeInTheDocument();
  });

  it("un nome non valido non arriva al server e resta segnato sul campo", async () => {
    apri();
    await compila("Promo-Autunno");

    await userEvent.click(screen.getByRole("button", { name: "Salva bozza" }));

    const nome = screen.getByRole("textbox", { name: /Nome template/ });
    expect(nome).toHaveAttribute("aria-invalid", "true");
    expect(nome).toHaveAccessibleDescription(/Usa solo minuscole\/numeri\/underscore/);
    expect(finti.post).not.toHaveBeenCalled();
  });

  it("Salva bozza invia il modello nel formato Meta e apre la bozza", async () => {
    apri();
    await compila();

    await userEvent.click(screen.getByRole("button", { name: "Salva bozza" }));

    await waitFor(() => expect(finti.navigate).toHaveBeenCalledWith(`${BASE}/nuova-versione?id=t-nuovo`));
    expect(finti.post).toHaveBeenCalledWith("/whatsapp/crea_template_whatsapp", {
      id_gdo: "gdo-1",
      json_meta: {
        name: "promo_autunno",
        language: { code: "it", policy: "deterministic" },
        category: "UTILITY",
        components: [{ type: "BODY", text: "Ciao {{1}}", example: { body_text: [["Mario"]] } }],
      },
    });
    expect(finti.put).not.toHaveBeenCalled();
  });

  it("durante il salvataggio entrambi i pulsanti sono disattivati e quello premuto è occupato", async () => {
    finti.post.mockReturnValue(new Promise(() => undefined));
    apri();
    await compila();

    await userEvent.click(screen.getByRole("button", { name: "Salva bozza" }));

    const bozza = screen.getByRole("button", { name: "Salva bozza" });
    expect(bozza).toHaveAttribute("aria-busy", "true");
    expect(bozza).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salva e invia a Meta" })).toBeDisabled();
  });

  it("Salva e invia a Meta crea la bozza, la invia e mostra lo stato reale", async () => {
    apri();
    await compila();

    await userEvent.click(screen.getByRole("button", { name: "Salva e invia a Meta" }));

    await waitFor(() => expect(finti.navigate).toHaveBeenCalledWith(`${BASE}?id=gdo-1`));
    expect(finti.put).toHaveBeenCalledWith("/whatsapp/send_modified_template_to_meta", { id_template: "t-nuovo" });
    expect(finti.showNotification).toHaveBeenCalledWith("Template inviato a Meta: In revisione Meta", { variant: "success" });
  });

  it("se il server rifiuta il modello mostra il suo motivo e resta sulla pagina", async () => {
    finti.post.mockRejectedValue(new Error('Esiste già un template "promo_autunno" in questa lingua (it)'));
    apri();
    await compila();

    await userEvent.click(screen.getByRole("button", { name: "Salva bozza" }));

    expect(await screen.findByRole("alert")).toHaveTextContent('Esiste già un template "promo_autunno" in questa lingua (it)');
    expect(finti.navigate).not.toHaveBeenCalled();
  });

  it("se Meta rifiuta l'invio riporta il motivo e apre la bozza già salvata", async () => {
    finti.put.mockRejectedValue(new Error("Errore API Meta: Invalid parameter"));
    apri();
    await compila();

    await userEvent.click(screen.getByRole("button", { name: "Salva e invia a Meta" }));

    await waitFor(() => expect(finti.navigate).toHaveBeenCalledWith(`${BASE}/nuova-versione?id=t-nuovo`));
    expect(finti.showNotification).toHaveBeenCalledWith(expect.stringContaining("Errore API Meta: Invalid parameter"), { variant: "error" });
  });
});
