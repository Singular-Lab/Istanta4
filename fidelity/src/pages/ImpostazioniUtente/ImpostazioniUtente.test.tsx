// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  put: vi.fn(),
  post: vi.fn(),
  setUser: vi.fn(),
  showNotification: vi.fn(),
  // Sempre lo stesso oggetto: la pagina ricarica i campi a ogni cambio di utente
  utente: {
    id: "u1",
    nome: "Anna",
    cognome: "Rossi",
    email: "anna.rossi@example.com",
    tipo: "Agenzia",
    stato: "ATTIVO",
    outsider: false,
    meta: {},
  },
}));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { put: finti.put, post: finti.post } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.showNotification }) }));
vi.mock("@/context/UserContext", () => ({ useUser: () => ({ user: finti.utente, setUser: finti.setUser }) }));
vi.mock("@/components/Base/Tippy", () => ({ default: ({ children }: any) => <>{children}</> }));
// Il calendario vero dipende da litepicker, che in jsdom non serve
vi.mock("@/components/Base/Litepicker", () => ({
  default: ({ options, getRef, ...props }: any) => <input {...props} />,
}));

import ImpostazioniUtente from ".";

const apri = (percorso: string) =>
  render(
    <MemoryRouter initialEntries={[percorso]}>
      <ImpostazioniUtente />
    </MemoryRouter>
  );

describe("Impostazioni account", () => {
  beforeEach(() => {
    finti.put.mockReset().mockResolvedValue({});
    finti.setUser.mockReset();
    finti.showNotification.mockReset();
  });

  it("le preferenze non offrono un salvataggio che non salva nulla", () => {
    apri("/profilo-utente?page=preferences");

    expect(screen.getByRole("heading", { name: "Preferenze" })).toBeInTheDocument();
    expect(screen.getByText(/non ancora disponibile/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salva Modifiche" })).not.toBeInTheDocument();
  });

  it("le notifiche spiegano che non sono configurabili, senza caselle né salvataggio", () => {
    apri("/profilo-utente?page=notification-profilo-utente");

    expect(screen.getByText(/non sono ancora configurabili/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salva Modifiche" })).not.toBeInTheDocument();
  });

  it("salvando il profilo invia il nome modificato a /update_profile", async () => {
    apri("/profilo-utente");

    const nome = screen.getByRole("textbox", { name: "Nome (obbligatorio)" });
    await userEvent.clear(nome);
    await userEvent.type(nome, "Maria");
    await userEvent.click(screen.getByRole("button", { name: "Salva Modifiche" }));

    expect(finti.put).toHaveBeenCalledWith(
      "/update_profile",
      expect.objectContaining({ id_utenti: "u1", nome_utenti: "Maria", cognome_utenti: "Rossi" })
    );
  });

  it("il genere è un gruppo di scelte con etichette proprie", () => {
    apri("/profilo-utente");

    const gruppo = screen.getByRole("group", { name: "Genere" });
    expect(gruppo).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Non binario" })).toHaveAttribute("id", "genere-non-binario");
  });

  it("nessuna sezione ha id duplicati", () => {
    for (const percorso of [
      "/profilo-utente",
      "/profilo-utente?page=security",
      "/profilo-utente?page=email-profilo-utente",
      "/profilo-utente?page=account-deactivation",
    ]) {
      const { container, unmount } = apri(percorso);
      const id = Array.from(container.querySelectorAll("[id]")).map((elemento) => elemento.id);
      expect(new Set(id).size).toBe(id.length);
      unmount();
    }
  });
});
