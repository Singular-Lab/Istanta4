// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../lib/server_call";

const permessi = vi.hoisted(() => ({ concessi: new Set<string>() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn() } }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: (codice: string) => permessi.concessi.has(codice) }));
// chart.js non può disegnare in jsdom
vi.mock("@/components/Base/Chart", () => ({ default: () => <canvas /> }));

import DashboardCategory from ".";

const risposte: Record<string, () => Promise<unknown>> = {};

// I volantini in validità della GDO dalle API di consultazione: solo pubblicati, senza stato
const URL_VOLANTINI = "/consultazione/volantini?periodo=attivi&dimensione=200";
const pagina = (kit: unknown[] = []) => ({ totale: kit.length, pagina: 1, dimensione: 200, kit });
const volantino = (validita: { validitaDal?: string; validitaAl?: string } = {}) => ({
  id: "k1",
  titolo: "Volantino ottobre",
  promo: { id: "p1", nome: "Promo ottobre", validitaDal: validita.validitaDal ?? null, validitaAl: validita.validitaAl ?? null },
  area: { id: "a1", nome: "Nord" },
  canale: { id: "c1", nome: "Super" },
  numeroFile: 1,
  copertina: null,
});

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <DashboardCategory />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("Dashboard Category", () => {
  beforeEach(() => {
    permessi.concessi = new Set(["materiali.visualizza"]);
    risposte["/utenti/me/global-filters"] = () => Promise.resolve({ ruolo: "Category", settoriNomi: ["Freschi"] });
    risposte["/scoreboard/category-timeline"] = () => Promise.resolve({ promos: [], series: [], canaleAreaSeries: [] });
    risposte[URL_VOLANTINI] = () => Promise.resolve(pagina());
    risposte["/promo/in-corso"] = () => Promise.resolve([]);
    vi.mocked(ServerCall.get).mockReset();
    vi.mocked(ServerCall.get).mockImplementation(((url: string) => risposte[url]()) as typeof ServerCall.get);
  });

  it("se i volantini non arrivano lo dice nella loro sezione, non mostra \"nessun volantino\", e Riprova li ricarica", async () => {
    risposte[URL_VOLANTINI] = () => Promise.reject(new Error("Servizio non raggiungibile"));
    apri();

    const sezione = await screen.findByRole("region", { name: "Volantini in corso" });
    expect(await within(sezione).findByRole("alert")).toHaveTextContent("Volantini non caricati");
    expect(within(sezione).queryByText("Nessun volantino in corso")).not.toBeInTheDocument();

    risposte[URL_VOLANTINI] = () => Promise.resolve(pagina());
    await userEvent.click(within(sezione).getByRole("button", { name: "Riprova" }));
    expect(await within(sezione).findByText("Nessun volantino in corso")).toBeInTheDocument();
  });

  it("un volantino in corso apre la sua consultazione, non la lavorazione del kit", async () => {
    risposte[URL_VOLANTINI] = () => Promise.resolve(pagina([volantino()]));
    apri();

    const sezione = await screen.findByRole("region", { name: "Volantini in corso" });
    expect(await within(sezione).findByRole("link", { name: "Volantino ottobre" })).toHaveAttribute("href", "/volantini/tutti_i_volantini?kit=k1");
    expect(within(sezione).getByText("Nord / Super")).toBeInTheDocument();
    // Solo volantini pubblicati: lo stato del kit non si mostra
    expect(within(sezione).queryByText("Pubblicato")).not.toBeInTheDocument();
  });

  it("senza materiali.visualizza il volantino in corso resta testo semplice", async () => {
    permessi.concessi = new Set();
    risposte[URL_VOLANTINI] = () => Promise.resolve(pagina([volantino()]));
    apri();

    const sezione = await screen.findByRole("region", { name: "Volantini in corso" });
    expect(await within(sezione).findByText("Volantino ottobre")).toBeInTheDocument();
    expect(within(sezione).queryByRole("link", { name: "Volantino ottobre" })).not.toBeInTheDocument();
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
    permessi.concessi = new Set(["materiali.visualizza", "promo.visualizza"]);
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
    permessi.concessi = new Set(["materiali.visualizza", "promo.visualizza"]);
    risposte["/promo/in-corso"] = () => Promise.resolve([
      { id: "p2", nome: "Promo cancellata", stato: "ELIMINATA", validita_dal: "2026-10-01", validita_al: "2026-10-31" },
    ]);
    apri();

    const sezione = await screen.findByRole("region", { name: "Promozioni in corso" });
    expect(await within(sezione).findByText("Nessuna promozione in corso")).toBeInTheDocument();
    expect(within(sezione).queryByText("Promo cancellata")).not.toBeInTheDocument();
  });

  it("senza promo.visualizza non chiede né mostra le promozioni in corso, e i volantini restano", async () => {
    risposte[URL_VOLANTINI] = () => Promise.resolve(pagina([volantino({ validitaDal: "2026-10-01", validitaAl: "2026-10-31" })]));
    apri();

    const volantini = await screen.findByRole("region", { name: "Volantini in corso" });
    expect(await within(volantini).findByText("Volantino ottobre")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Promozioni in corso" })).not.toBeInTheDocument();
    expect(screen.queryByText("Promozioni non caricate")).not.toBeInTheDocument();
    expect(vi.mocked(ServerCall.get).mock.calls.map(([url]) => url)).not.toContain("/promo/in-corso");
  });
});
