// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../lib/server_call";

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn() } }));
// chart.js non può disegnare in jsdom
vi.mock("@/components/Base/Chart", () => ({ default: () => <canvas /> }));

import DashboardMarketing from ".";

const scoreboard = (idPromo: string, totalScore: number) => ({
  idPromo,
  promoNome: `Promo ${idPromo}`,
  computedAt: "2026-10-20T10:00:00Z",
  report: {
    title: `Report ${idPromo}`,
    widgets: [{ type: "scoreboard", totalScore, rows: [{ reparto: "Freschi", score: totalScore, totale: 1200 }] }],
    viewsPerCanaleArea: [],
  },
});

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DashboardMarketing />
    </QueryClientProvider>
  );

describe("Dashboard Marketing", () => {
  beforeEach(() => {
    vi.mocked(ServerCall.get).mockReset();
  });

  it("la tabella si ordina dalle intestazioni e lo dichiara con aria-sort", async () => {
    vi.mocked(ServerCall.get).mockResolvedValue([scoreboard("p1", 40), scoreboard("p2", 80)]);
    apri();

    const tabella = await screen.findByRole("table");
    const scoreMedio = within(tabella).getByRole("columnheader", { name: /Score medio/ });
    expect(scoreMedio).toHaveAttribute("aria-sort", "descending");

    await userEvent.click(within(scoreMedio).getByRole("button"));
    expect(scoreMedio).toHaveAttribute("aria-sort", "ascending");

    const areaCanale = within(tabella).getByRole("columnheader", { name: /Area \/ Canale/ });
    expect(areaCanale).not.toHaveAttribute("aria-sort");
    // Le referenze della combinazione si sommano sulle due promo
    expect(within(tabella).getByText("2.400")).toBeInTheDocument();
  });

  it("senza scoreboard mostra lo stato vuoto e Aggiorna resta disponibile", async () => {
    vi.mocked(ServerCall.get).mockResolvedValue([]);
    apri();

    expect(await screen.findByText("Nessuno scoreboard calcolato")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aggiorna" })).toBeInTheDocument();
  });
});
