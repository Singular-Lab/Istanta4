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

import DashboardCategory from ".";

const risposte: Record<string, () => Promise<unknown>> = {};

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DashboardCategory />
    </QueryClientProvider>
  );

describe("Dashboard Category", () => {
  beforeEach(() => {
    risposte["/utenti/me/global-filters"] = () => Promise.resolve({ ruolo: "Category", settoriNomi: ["Freschi"] });
    risposte["/scoreboard/category-timeline"] = () => Promise.resolve({ promos: [], series: [], canaleAreaSeries: [] });
    risposte["/dashboard/volantini-in-corso"] = () => Promise.resolve({ totale: 0, inScadenza: 0, kit: [] });
    risposte["/promo/in-corso"] = () => Promise.resolve([]);
    vi.mocked(ServerCall.get).mockReset();
    vi.mocked(ServerCall.get).mockImplementation(((url: string) => risposte[url]()) as typeof ServerCall.get);
  });

  it("se i volantini non arrivano lo dice nella loro sezione, non mostra \"nessun volantino\", e Riprova li ricarica", async () => {
    risposte["/dashboard/volantini-in-corso"] = () => Promise.reject(new Error("Servizio non raggiungibile"));
    apri();

    const sezione = await screen.findByRole("region", { name: "Volantini in corso" });
    expect(await within(sezione).findByRole("alert")).toHaveTextContent("Volantini non caricati");
    expect(within(sezione).queryByText("Nessun volantino in corso")).not.toBeInTheDocument();

    risposte["/dashboard/volantini-in-corso"] = () => Promise.resolve({ totale: 0, inScadenza: 0, kit: [] });
    await userEvent.click(within(sezione).getByRole("button", { name: "Riprova" }));
    expect(await within(sezione).findByText("Nessun volantino in corso")).toBeInTheDocument();
  });

  it("i periodi rapidi sono un gruppo a scelta singola e Azzera torna senza filtro", async () => {
    apri();

    const periodo = await screen.findByRole("radiogroup", { name: "Periodo rapido" });
    await userEvent.click(within(periodo).getByRole("radio", { name: "30 giorni" }));

    expect(within(periodo).getByRole("radio", { name: "30 giorni" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Da")).not.toHaveValue("");
    expect(screen.getByText(/Filtro attivo/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Azzera" }));
    expect(screen.getByLabelText("Da")).toHaveValue("");
    expect(within(periodo).getByRole("radio", { name: "30 giorni" })).toHaveAttribute("aria-checked", "false");
  });

  it("tra le promozioni in corso non mostra le promo eliminate", async () => {
    risposte["/promo/in-corso"] = () => Promise.resolve([
      { id: "p1", nome: "Promo autunno", stato: "VALIDA", validita_dal: "2026-10-01", validita_al: "2026-10-31" },
      { id: "p2", nome: "Promo cancellata", stato: "ELIMINATA", validita_dal: "2026-10-01", validita_al: "2026-10-31" },
      { id: "p3", nome: "Promo in lavorazione", stato: "IN_LAVORAZIONE", validita_dal: "2026-11-01", validita_al: "2026-11-15" },
    ]);
    apri();

    const sezione = await screen.findByRole("region", { name: "Promozioni in corso" });
    expect(await within(sezione).findByText("Promo autunno")).toBeInTheDocument();
    expect(within(sezione).getByText("Promo in lavorazione")).toBeInTheDocument();
    expect(within(sezione).queryByText("Promo cancellata")).not.toBeInTheDocument();
    expect(within(sezione).getByText("2")).toBeInTheDocument();
  });

  it("se tutte le promo in corso sono eliminate mostra che non ce ne sono", async () => {
    risposte["/promo/in-corso"] = () => Promise.resolve([
      { id: "p2", nome: "Promo cancellata", stato: "ELIMINATA", validita_dal: "2026-10-01", validita_al: "2026-10-31" },
    ]);
    apri();

    const sezione = await screen.findByRole("region", { name: "Promozioni in corso" });
    expect(await within(sezione).findByText("Nessuna promozione in corso")).toBeInTheDocument();
    expect(within(sezione).queryByText("Promo cancellata")).not.toBeInTheDocument();
  });
});
