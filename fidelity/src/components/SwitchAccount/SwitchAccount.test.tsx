// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Popover
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { post: finti.post } }));
vi.mock("@/query/query", () => ({
  useFetchAllAccount: () => ({
    data: [
      { id: "u2", nome: "Anna", cognome: "Rossi", email: "anna@example.test" },
      { id: "u1", nome: "Marco", cognome: "Bianchi", email: "marco@example.test" },
    ],
  }),
}));

import SwitchAccount from ".";

describe("SwitchAccount", () => {
  it("il piede ha Chiudi prima del login e, con la password sbagliata, l'errore resta nella finestra", async () => {
    finti.post.mockRejectedValue(new Error("Password non valida"));
    render(<SwitchAccount switchAccount setSwitchAccount={vi.fn()} currentUserId="u1" />);

    const pulsanti = (await screen.findAllByRole("button")).map((b) => b.textContent?.trim());
    expect(pulsanti.indexOf("Chiudi")).toBeLessThan(pulsanti.indexOf("Esegui il login con questo account"));

    fireEvent.click(screen.getByRole("button", { name: "Esegui il login con questo account" }));
    fireEvent.change(await screen.findByLabelText("Inserisci la tua password"), { target: { value: "sbagliata" } });
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));

    expect(await screen.findByText("Password non valida")).toBeInTheDocument();
    expect(finti.post).toHaveBeenCalledWith("/login_user", { email: "anna@example.test", password: "sbagliata" });
    expect(screen.getByRole("button", { name: "Conferma" })).not.toBeDisabled();
  });

  it("con l'account già in uso lo dice al posto del pulsante di login", async () => {
    render(<SwitchAccount switchAccount setSwitchAccount={vi.fn()} currentUserId="u2" />);

    expect(await screen.findByText("Account attualmente in uso")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Esegui il login con questo account" })).not.toBeInTheDocument();
  });
});
