// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: finti.get, post: finti.post } }));

import ResetPassword from ".";

const apri = (indirizzo: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[indirizzo]}>
        <ResetPassword />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("ResetPassword", () => {
  beforeEach(() => {
    finti.get.mockReset();
    finti.post.mockReset();
  });

  it("senza il parametro del link mostra l'errore di link non valido e le azioni per proseguire", () => {
    apri("/reset-password");

    expect(screen.getByRole("heading", { name: "Link non valido" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Il link di reset password non è valido.");
    expect(screen.getByRole("link", { name: "Richiedi nuovo link" })).toHaveAttribute("href", "/recupero-password");
    expect(screen.getByRole("link", { name: "Torna al Login" })).toHaveAttribute("href", "/login");
    expect(finti.get).not.toHaveBeenCalled();
  });

  it("con un link scaduto mostra il motivo restituito dalla verifica", async () => {
    finti.get.mockRejectedValue(new Error("Token scaduto"));
    apri("/reset-password?ctx=scaduto");

    expect(await screen.findByRole("heading", { name: "Link non valido" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Il link di reset password è scaduto o non è più valido.");
  });

  it("con un link valido i due pulsanti dell'occhio hanno un nome e mostrano la password", async () => {
    finti.get.mockResolvedValue({
      valid: true,
      user: { nome: "Anna", cognome: "Rossi", nome_completo: "Anna Rossi", email: "anna@example.test" },
    });
    apri("/reset-password?ctx=valido");

    expect(await screen.findByRole("heading", { name: "Reimposta Password" })).toBeInTheDocument();
    const occhi = screen.getAllByRole("button", { name: "Mostra password" });
    expect(occhi).toHaveLength(2);

    const nuova = screen.getByLabelText("Nuova Password");
    expect(nuova).toHaveAttribute("type", "password");
    await userEvent.click(occhi[0]);

    expect(nuova).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Nascondi password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Conferma Password")).toHaveAttribute("type", "password");
  });

  it("le password diverse mostrano l'errore sotto il campo di conferma, senza chiamare il servizio", async () => {
    finti.get.mockResolvedValue({
      valid: true,
      user: { nome: "Anna", cognome: "Rossi", nome_completo: "Anna Rossi", email: "anna@example.test" },
    });
    apri("/reset-password?ctx=valido");

    await userEvent.type(await screen.findByLabelText("Nuova Password"), "segreta1");
    await userEvent.type(screen.getByLabelText("Conferma Password"), "segreta2");
    await userEvent.click(screen.getByRole("button", { name: "Reimposta Password" }));

    const conferma = screen.getByLabelText("Conferma Password");
    expect(await screen.findByText("Le password non corrispondono")).toBeInTheDocument();
    expect(conferma).toHaveAttribute("aria-invalid", "true");
    expect(conferma).toHaveAccessibleDescription("Le password non corrispondono");
    expect(finti.post).not.toHaveBeenCalled();
  });
});
