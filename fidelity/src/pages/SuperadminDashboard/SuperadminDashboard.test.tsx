// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../lib/server_call";

const finti = vi.hoisted(() => ({ loader: null as unknown }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn() } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
// chart.js non può disegnare in jsdom
vi.mock("@/components/Base/Chart", () => ({ default: () => <canvas data-testid="grafico" /> }));
vi.mock("../Dashboard3", () => ({ default: () => <div>Contenuto GDO</div> }));
vi.mock("../AuditLogDashboard", () => ({ default: () => <div>Contenuto audit</div> }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLoaderData: () => finti.loader,
}));

import SuperadminDashboard from ".";

const panoramica = (alerts: unknown[] = []) => ({
  database: {
    health: { status: "healthy", poolUtilization: 10, activeConnections: 2, waitingRequests: 0, responseTimeMs: 12, message: "OK" },
    metrics: {
      activeConnections: 2,
      idleConnections: 3,
      waitingRequests: 0,
      totalConnections: 5,
      utilizationPercent: 10,
      timestamp: "2026-10-27T10:00:00Z",
    },
    averages: { avgActiveConnections: 2, avgUtilization: 10, peakActiveConnections: 4, peakUtilization: 20 },
    history: [],
  },
  audit: {
    totalEvents: 1200,
    eventsByType: {},
    eventsBySeverity: { CRITICAL: 1, HIGH: 2 },
    failedLogins: 0,
    suspiciousActivities: 0,
    lastAuditTime: null,
  },
  onlineUsers: { activeSessions: 3, wsConnections: 1 },
  recentErrors: [],
  alerts,
});

const apri = (percorso = "/?tab=superadmin") =>
  render(
    <MemoryRouter initialEntries={[percorso]}>
      <SuperadminDashboard />
    </MemoryRouter>
  );

describe("Dashboard Superadmin", () => {
  beforeEach(() => {
    vi.mocked(ServerCall.get).mockReset();
    finti.loader = { overviewPromise: Promise.resolve(panoramica()) };
  });

  it("le sezioni della dashboard sono schede vere e la scheda scelta segue l'indirizzo", async () => {
    apri("/?tab=audit");

    const schede = await screen.findByRole("tablist", { name: "Sezioni della dashboard" });
    expect(within(schede).getAllByRole("tab")).toHaveLength(3);
    expect(within(schede).getByRole("tab", { name: "Registro Audit" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Contenuto audit")).toBeInTheDocument();

    await userEvent.click(within(schede).getByRole("tab", { name: "Dashboard GDO" }));
    expect(await screen.findByText("Contenuto GDO")).toBeInTheDocument();
    expect(within(schede).getByRole("tab", { name: "Dashboard GDO" })).toHaveAttribute("aria-selected", "true");
  });

  it("Aggiorna ricarica la panoramica senza ricaricare la pagina", async () => {
    vi.mocked(ServerCall.get).mockResolvedValue(panoramica());
    apri();

    await userEvent.click(await screen.findByRole("button", { name: "Aggiorna" }));

    expect(ServerCall.get).toHaveBeenCalledWith("/superadmin-dashboard/overview");
  });

  it("senza alert né errori recenti mostra stati vuoti espliciti; gli stati degli alert sono in italiano", async () => {
    const { unmount } = apri();

    expect(await screen.findByText("Nessun alert attivo")).toBeInTheDocument();
    expect(screen.getByText("Nessun errore recente")).toBeInTheDocument();
    unmount();

    finti.loader = {
      overviewPromise: Promise.resolve(
        panoramica([
          {
            id: "a1",
            title: "Pool quasi saturo",
            description: "Utilizzo sopra soglia",
            severity: "HIGH",
            status: "ACK",
            source: "DATABASE",
            createdAt: "2026-10-27T10:00:00Z",
            actions: [{ label: "Apri registro", href: "/superadmin?tab=audit", variant: "secondary" }],
          },
        ])
      ),
    };
    apri();

    expect(await screen.findByRole("heading", { level: 3, name: "Pool quasi saturo" })).toBeInTheDocument();
    expect(screen.getByTitle("Preso in carico")).toHaveAttribute("data-tono", "warning");
    expect(screen.getByRole("link", { name: "Apri registro" })).toHaveAttribute("href", "/superadmin?tab=audit");
  });
});
