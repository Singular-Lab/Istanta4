// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionExpiredBanner from "./SessionExpiredBanner";

describe("SessionExpiredBanner", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("senza motivo non mostra nulla", () => {
    const { container } = render(<SessionExpiredBanner reason={null} onDismiss={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("la sessione scaduta è un avviso che si chiude con un pulsante con nome", () => {
    const onDismiss = vi.fn();
    render(<SessionExpiredBanner reason="session_expired" onDismiss={onDismiss} />);

    expect(screen.getByRole("alert")).toHaveTextContent("La tua sessione è scaduta. Effettua nuovamente il login.");
    fireEvent.click(screen.getByRole("button", { name: "Chiudi" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("un esito SAML usa il caso OIDC e il messaggio dell'indirizzo", () => {
    window.history.replaceState({}, "", "/login?reason=saml_access_denied&message=Ruolo%20non%20abilitato");
    render(<SessionExpiredBanner reason="saml_access_denied" onDismiss={vi.fn()} />);

    const avviso = screen.getByRole("alert");
    expect(within(avviso).getByText("Accesso negato")).toHaveClass("font-medium");
    expect(avviso).toHaveTextContent("Ruolo non abilitato");
  });

  it("senza messaggio nell'indirizzo usa quello predefinito", () => {
    render(<SessionExpiredBanner reason="oidc_rate_limited" onDismiss={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Troppi tentativi di accesso. Riprova tra qualche minuto");
  });

  it("l'accesso tramite Istanta è un avviso con titolo e il pulsante per andare su Istanta", () => {
    render(<SessionExpiredBanner reason="istanta_required" onDismiss={vi.fn()} />);

    const avviso = screen.getByRole("alert");
    expect(within(avviso).getByText("Accesso tramite Istanta richiesto")).toBeInTheDocument();
    expect(within(avviso).getByRole("button", { name: "Vai su Istanta" })).toBeInTheDocument();
    expect(within(avviso).queryByRole("button", { name: "Chiudi" })).not.toBeInTheDocument();
  });

  it("un motivo sconosciuto non mostra nulla", () => {
    const { container } = render(<SessionExpiredBanner reason="motivo_ignoto" onDismiss={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
