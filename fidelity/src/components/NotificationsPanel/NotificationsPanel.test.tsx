// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Popover
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({
  attivita: { isLoading: false, isError: false, error: null as unknown, data: [] as unknown[], refetch: vi.fn() },
}));

vi.mock("@/query/query", () => ({
  useFetchAttivita: () => finti.attivita,
  useFetchAttivitaCount: () => ({ data: { totale: 0, per_categoria: {} } }),
}));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { put: vi.fn() } }));

import NotificationPanel from ".";

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationPanel notificationsPanel setNotificationsPanel={vi.fn()} />
    </QueryClientProvider>
  );

describe("NotificationsPanel", () => {
  beforeEach(() => {
    finti.attivita = { isLoading: false, isError: false, error: null, data: [], refetch: vi.fn() };
  });

  it("ha il titolo con la classe comune e la vista si sceglie con un gruppo di opzioni", async () => {
    apri();

    expect(await screen.findByRole("heading", { name: "Notifiche" })).toHaveClass("title-section");
    expect(screen.getByRole("radiogroup", { name: "Visualizzazione" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tutte" })).toHaveAttribute("aria-pressed", "true");
  });

  it("senza notifiche mostra lo stato vuoto invece di una lista bianca", async () => {
    apri();

    expect(await screen.findByRole("heading", { name: "Nessuna notifica" })).toBeInTheDocument();
  });

  it("con un filtro senza risultati lo dice e permette di tornare a tutte", async () => {
    apri();

    fireEvent.click(await screen.findByRole("button", { name: "Account" }));

    expect(screen.getByRole("heading", { name: "Nessuna notifica in questa categoria" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostra tutte" }));
    expect(screen.getByRole("button", { name: "Tutte" })).toHaveAttribute("aria-pressed", "true");
  });

  it("se il caricamento fallisce mostra l'errore con Riprova, non una lista vuota", async () => {
    finti.attivita = { isLoading: false, isError: true, error: new Error("Servizio non raggiungibile"), data: [], refetch: vi.fn() };
    apri();

    expect(await screen.findByRole("alert")).toHaveTextContent("Servizio non raggiungibile");
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(finti.attivita.refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "Nessuna notifica" })).not.toBeInTheDocument();
  });

  it("durante il caricamento mostra lo spinner comune", async () => {
    finti.attivita = { isLoading: true, isError: false, error: null, data: [], refetch: vi.fn() };
    apri();

    expect(await screen.findByRole("status")).toHaveTextContent("Caricamento notifiche");
  });
});
