// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  logs: {} as Record<string, unknown>,
  refetchLogs: vi.fn(),
  showNotification: vi.fn(),
}));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { getUrl: vi.fn(() => ""), getCSRFToken: vi.fn() } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.showNotification }) }));
vi.mock("@/query/query", () => ({
  useFetchAuditLogs: () => finti.logs,
  useFetchAuditSummary: () => ({
    data: { totalEvents: 1234, totalToday: 5, criticalCount: 0, highCount: 0 },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useFetchAuditEventTypes: () => ({ data: [], refetch: vi.fn() }),
  useFetchAuditSeverities: () => ({ data: [], refetch: vi.fn() }),
}));

import AuditLogDashboard from ".";

const apri = () =>
  render(
    <MemoryRouter>
      <AuditLogDashboard />
    </MemoryRouter>
  );

describe("Registro audit", () => {
  beforeEach(() => {
    finti.refetchLogs.mockReset();
    finti.logs = {
      data: { items: [], totalItems: 0, totalPages: 0 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: finti.refetchLogs,
    };
  });

  it("se il registro non arriva mostra l'errore, non \"nessun evento\", e Riprova lo ricarica", async () => {
    finti.logs = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Servizio audit non raggiungibile"),
      refetch: finti.refetchLogs,
    };
    apri();

    expect(screen.getByRole("alert")).toHaveTextContent("Servizio audit non raggiungibile");
    expect(screen.queryByText("Nessun evento registrato")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(finti.refetchLogs).toHaveBeenCalled();
  });

  it("senza eventi né filtri dice che il registro è vuoto", () => {
    apri();

    expect(screen.getByText("Nessun evento registrato")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("i riepiloghi sono StatCard con i numeri formattati", () => {
    apri();

    expect(screen.getByText("Totale eventi")).toBeInTheDocument();
    expect(screen.getByText("1.234")).toBeInTheDocument();
  });
});
