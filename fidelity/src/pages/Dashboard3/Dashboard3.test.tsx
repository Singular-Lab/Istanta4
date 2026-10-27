// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../lib/server_call";

const finti = vi.hoisted(() => ({ showNotification: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), getUrl: vi.fn(() => "") } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.showNotification }) }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: () => true }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLoaderData: () => null,
}));

import Dashboard3, { type Dashboard3LoaderData } from ".";

// Il rifiuto ha già un gestore: allSettled lo legge comunque come "rejected"
const rifiutata = () => {
  const promessa = Promise.reject(new Error("Servizio non raggiungibile"));
  promessa.catch(() => undefined);
  return promessa;
};

const datiLoader = (inCorso: Promise<any>): Dashboard3LoaderData => ({
  volantiniInCorsoPromise: inCorso,
  volantiniInLavorazionePromise: Promise.resolve({ totale: 0, inAttesa: 0, kit: [] }),
  volantiniPubblicatiInLavorazionePromise: Promise.resolve({ totale: 0, kit: [] }),
  areePromise: Promise.resolve([]),
  canaliPromise: Promise.resolve([]),
});

const apri = (loader: Dashboard3LoaderData, embedded = true) =>
  render(
    <MemoryRouter>
      <Dashboard3 embedded={embedded} loaderDataOverride={loader} />
    </MemoryRouter>
  );

describe("Dashboard GDO", () => {
  beforeEach(() => {
    vi.mocked(ServerCall.get).mockReset();
    // Storico all'avvio
    vi.mocked(ServerCall.get).mockResolvedValue({ totale: 0, kit: [] });
  });

  it("se i volantini in validità non arrivano mostra l'errore nella card, non un elenco vuoto, e Riprova li ricarica", async () => {
    apri(datiLoader(rifiutata()));

    const card = await screen.findByRole("region", { name: "Volantini in validità" });
    expect(await within(card).findByRole("alert")).toHaveTextContent("Volantini non caricati");
    expect(within(card).queryByText("Nessun volantino attivo")).not.toBeInTheDocument();

    // Le altre card restano utilizzabili
    const lavorazione = screen.getByRole("region", { name: "Volantini in lavorazione" });
    expect(within(lavorazione).getByText("Nessun volantino in lavorazione")).toBeInTheDocument();

    vi.mocked(ServerCall.get).mockResolvedValueOnce({ totale: 0, inScadenza: 0, kit: [] });
    await userEvent.click(within(card).getByRole("button", { name: "Riprova" }));

    expect(ServerCall.get).toHaveBeenCalledWith("/dashboard/volantini-in-corso");
    expect(await within(card).findByText("Nessun volantino attivo")).toBeInTheDocument();
    expect(within(card).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("incorporata nella dashboard Superadmin non ha un'intestazione di pagina, da sola sì", async () => {
    const dati = datiLoader(Promise.resolve({ totale: 0, inScadenza: 0, kit: [] }));
    const { unmount } = apri(dati);
    await screen.findByRole("region", { name: "Volantini in validità" });
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    unmount();

    apri(dati, false);
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
  });

  it("i filtri rapidi sono un gruppo a scelta singola con i conteggi", async () => {
    apri(datiLoader(Promise.resolve({ totale: 0, inScadenza: 0, kit: [] })));

    const card = await screen.findByRole("region", { name: "Volantini in lavorazione" });
    const gruppo = within(card).getByRole("radiogroup", { name: "Stato processo" });
    expect(within(gruppo).getByRole("radio", { name: /Tutti/ })).toHaveAttribute("aria-checked", "true");
    expect(within(gruppo).getAllByRole("radio")).toHaveLength(3);
  });
});
