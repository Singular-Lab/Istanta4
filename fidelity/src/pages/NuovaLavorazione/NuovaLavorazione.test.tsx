// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  contesto: { data: undefined as unknown[] | undefined, isLoading: false },
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/components/VisibilitaPromoFields", () => ({ default: () => null }));
vi.mock("@/components/ContestoLavorazioneFields", () => ({ default: () => <p>Campi del contesto</p> }));
vi.mock("@/components/Base/Litepicker", () => ({
  default: ({ options: _options, onChange: _onChange, ...props }: any) => <input {...props} />,
}));
vi.mock("../../query/query", () => ({ useContestoPerNuovaLavorazione: () => finti.contesto }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { post: vi.fn() } }));

import NuovaLavorazione from ".";

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <NuovaLavorazione />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("Nuova promozione", () => {
  beforeEach(() => {
    finti.contesto = { data: undefined, isLoading: false };
  });

  it("i campi hanno un'etichetta collegata", () => {
    apri();

    expect(screen.getByLabelText("Titolo promo")).toBeInTheDocument();
    expect(screen.getByLabelText("Data di scadenza")).toBeInTheDocument();
    expect(screen.getByLabelText("Offset visibilità")).toHaveAccessibleDescription("Giorni in cui i contenuti del WebPliant appaiono");
  });

  it("mentre il contesto si carica le specifiche sono in attesa e la creazione è bloccata", () => {
    finti.contesto = { data: undefined, isLoading: true };
    apri();

    expect(screen.getByRole("group", { name: "Specifiche di lavorazione" })).toHaveAttribute("aria-busy", "true");
    const crea = screen.getByRole("button", { name: /Caricamento dati/ });
    expect(crea).toBeDisabled();
    expect(crea).toHaveAttribute("aria-busy", "true");
  });

  it("a contesto caricato il pulsante Crea promozione è attivo", () => {
    apri();

    expect(screen.getByRole("button", { name: "Crea promozione" })).toBeEnabled();
    expect(screen.queryByRole("group", { name: "Specifiche di lavorazione" })).not.toBeInTheDocument();
  });
});
