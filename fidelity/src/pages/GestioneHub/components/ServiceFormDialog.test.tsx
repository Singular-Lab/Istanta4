// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TIPO_UTENTI } from "../../../../lib/enums";
import type { HubServiceDTO } from "../../../../lib/types";
import type { HubServiceGroup, ServiceMutationPayload } from "../types";
import ServiceFormDialog from "./ServiceFormDialog";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura del Dialog
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const CALCOLATO = "https://correggo.esempio.it/OAuthLanded.ashx";

const variante = (tipo_utente: string, override: Partial<HubServiceDTO> = {}): HubServiceDTO => ({
  id: `correggo-${tipo_utente}`,
  codice: "correggo",
  nome: "Correggo",
  descrizione: "Correzione dei volantini",
  icona: "PencilRuler",
  colore: "primary",
  url: CALCOLATO,
  tipo_url: "external_fico",
  attivo: true,
  in_manutenzione: false,
  in_evidenza: false,
  ordine: 20,
  tipo_utente,
  ruolo_gdo: null,
  gestito: "correggo",
  url_non_configurato: false,
  indirizzo_manuale: false,
  url_calcolato: CALCOLATO,
  documents: [],
  videos: [],
  ...override,
});

const gruppo = (override: Partial<HubServiceDTO> = {}): HubServiceGroup => {
  const variants = [TIPO_UTENTI.SUPERADMIN, TIPO_UTENTI.AGENZIA, TIPO_UTENTI.CATEGORY].map((t) => variante(t, override));
  return {
    codice: "correggo",
    nome: "Correggo",
    descrizione: "Correzione dei volantini",
    icona: "PencilRuler",
    colore: "primary",
    documents: [],
    videos: [],
    variants,
  };
};

function apri(group: HubServiceGroup) {
  const onSubmit = vi.fn<(payload: ServiceMutationPayload) => void>();
  render(
    <ServiceFormDialog open mode="edit-group" group={group} gdoRoleOptions={[]} onClose={vi.fn()} onSubmit={onSubmit} />
  );
  return { onSubmit, utente: userEvent.setup() };
}

const salva = (utente: ReturnType<typeof userEvent.setup>) => utente.click(screen.getByRole("button", { name: "Salva gruppo" }));

describe("ServiceFormDialog: il Superadmin modifica tutto dei servizi gestiti", () => {
  it("con l indirizzo calcolato mostra quello della configurazione in sola lettura", () => {
    apri(gruppo());

    const url = screen.getByLabelText("URL");
    expect(url).toHaveValue(CALCOLATO);
    expect(url).toHaveAttribute("readonly");
    expect(screen.getByText(/Calcolato da Fidelity dalla configurazione dell'installazione/)).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo URL")).toBeDisabled();
  });

  it("con l indirizzo manuale il Superadmin cambia indirizzo e tipo, e li salva", async () => {
    const { onSubmit, utente } = apri(gruppo());

    await utente.click(screen.getByLabelText("Indirizzo manuale"));
    const url = screen.getByLabelText("URL");
    expect(url).not.toHaveAttribute("readonly");
    expect(url).toHaveValue(CALCOLATO);
    await utente.clear(url);
    await utente.type(url, "https://nuovo.esempio.it/correggo/OAuthLanded.ashx");
    expect(screen.getByLabelText("Tipo URL")).toBeEnabled();
    await salva(utente);

    const { values } = onSubmit.mock.calls[0][0];
    expect(values.indirizzo_manuale).toBe(true);
    expect(values.url).toBe("https://nuovo.esempio.it/correggo/OAuthLanded.ashx");
    expect(values.tipo_url).toBe("external_fico");
  });

  it("avvisa se l indirizzo manuale non porta all ingresso con l accesso automatico", async () => {
    const { utente } = apri(gruppo());

    await utente.click(screen.getByLabelText("Indirizzo manuale"));
    await utente.clear(screen.getByLabelText("URL"));
    await utente.type(screen.getByLabelText("URL"), "https://nuovo.esempio.it/");

    expect(screen.getByText(/di solito termina con/)).toBeInTheDocument();
  });

  it("torna all indirizzo calcolato", async () => {
    const { onSubmit, utente } = apri(gruppo({ indirizzo_manuale: true, url: "https://altrove.it/OAuthLanded.ashx" }));

    expect(screen.getByLabelText("URL")).toHaveValue("https://altrove.it/OAuthLanded.ashx");
    await utente.click(screen.getByRole("button", { name: "Torna all'indirizzo calcolato" }));
    expect(screen.getByLabelText("URL")).toHaveValue(CALCOLATO);
    await salva(utente);

    const { values } = onSubmit.mock.calls[0][0];
    expect(values.indirizzo_manuale).toBe(false);
    expect(values.url).toBe(CALCOLATO);
    expect(values.tipo_url).toBe("external_fico");
  });

  it("il Superadmin toglie un destinatario del servizio gestito", async () => {
    const { onSubmit, utente } = apri(gruppo());

    const category = screen.getByRole("heading", { name: TIPO_UTENTI.CATEGORY }).closest("section")!;
    // Senza ruoli GDO ogni tipo ha una sola casella, "Nessun ruolo specifico" (l'etichetta non e' collegata).
    const [casella] = within(category).getAllByRole("checkbox");
    expect(casella).toBeEnabled();
    await utente.click(casella);
    await salva(utente);

    const { variantsToDelete, targets } = onSubmit.mock.calls[0][0];
    expect(variantsToDelete?.map((v) => v.tipo_utente)).toEqual([TIPO_UTENTI.CATEGORY]);
    expect(targets.map((t) => t.tipo_utente)).not.toContain(TIPO_UTENTI.CATEGORY);
  });

  it("il codice resta in sola lettura", () => {
    apri(gruppo());

    expect(screen.getByLabelText("Codice")).toHaveAttribute("readonly");
  });
});
