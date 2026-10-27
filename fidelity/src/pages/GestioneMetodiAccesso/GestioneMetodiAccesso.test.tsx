// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ metodi: {} as Record<string, unknown>, refetch: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("@/components/Base/Tippy", () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/context/PermissionContext", () => ({ usePermissionContext: () => ({ hasPermission: () => true, loading: false }) }));
vi.mock("@/query/query", () => ({
  METODI_ACCESSO_QUERY_KEY: ["metodi-accesso"],
  useFetchAuthProvidersAdmin: () => finti.metodi,
}));
// Il dialogo di modifica non serve qui: resta chiuso
vi.mock("./components/MetodoFormDialog", () => ({ default: () => null }));

import GestioneMetodiAccesso from ".";

const metodo = (dati: Record<string, unknown>) => ({
  descrizione: null,
  icona: "KeyRound",
  ordine: 0,
  config_client: {},
  config_server: {},
  ruoli_ammessi: null,
  segreti: {},
  ...dati,
});

const metodi = [
  metodo({ id: "p1", codice: "entra_id", nome: "Entra ID", tipo: "oidc", attivo: true, segreti: { client_secret: "cifrato" } }),
  metodo({ id: "p2", codice: "adfs", nome: "ADFS", tipo: "saml", attivo: false, segreti: { sp_private_key: "in_chiaro" } }),
];

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GestioneMetodiAccesso />
    </QueryClientProvider>
  );

describe("Gestione metodi di accesso", () => {
  beforeEach(() => {
    finti.refetch.mockReset();
    finti.metodi = { data: metodi, isLoading: false, isError: false, refetch: finti.refetch };
  });

  it("il titolo compare una volta sola e i conteggi sono StatCard", () => {
    apri();

    expect(screen.getAllByRole("heading", { name: "Metodi di accesso" })).toHaveLength(1);
    const etichette = ["Metodi", "Attivi", "Segreti in chiaro"].map((etichetta) => screen.getByText(etichetta, { selector: "dt" }));
    expect(etichette.map((dt) => dt.nextElementSibling?.textContent)).toEqual(["2", "1", "1"]);
  });

  it("il filtro è un gruppo a scelta singola e nasconde i metodi esclusi", async () => {
    apri();

    const gruppo = screen.getByRole("radiogroup", { name: "Mostra" });
    expect(screen.getByRole("heading", { name: "ADFS" })).toBeInTheDocument();

    await userEvent.click(within(gruppo).getByRole("radio", { name: "Attivi" }));
    expect(within(gruppo).getByRole("radio", { name: "Attivi" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("heading", { name: "Entra ID" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ADFS" })).not.toBeInTheDocument();
  });

  it("stato del metodo e dei segreti sono badge di stato", () => {
    apri();

    expect(screen.getAllByTitle("Attivo").find((elemento) => elemento.hasAttribute("data-tono"))).toHaveAttribute("data-tono", "success");
    expect(screen.getAllByTitle(/in chiaro$/).find((elemento) => elemento.hasAttribute("data-tono"))).toHaveAttribute("data-tono", "warning");
  });

  it("se l'elenco non arriva mostra l'errore e Riprova ricarica", async () => {
    finti.metodi = { data: undefined, isLoading: false, isError: true, error: new Error("Servizio non raggiungibile"), refetch: finti.refetch };
    apri();

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("Servizio non raggiungibile");
    await userEvent.click(within(avviso).getByRole("button", { name: "Riprova" }));
    expect(finti.refetch).toHaveBeenCalledTimes(1);
  });
});
