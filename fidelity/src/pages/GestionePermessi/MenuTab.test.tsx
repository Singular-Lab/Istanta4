// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../lib/server_call";
import type { MenuItemDTO } from "./menu/modelloMenu";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura dei Dialog
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));

import MenuTab from "./MenuTab";

const voce = (ordinamento: number, titolo: string, pathname: string): MenuItemDTO => ({
  id_menu_item: `m${ordinamento}`,
  tipo_utente: "Superadmin",
  tipo: "item",
  titolo,
  icona: "Circle",
  pathname,
  ordinamento,
});
const separatore = (ordinamento: number, titolo: string): MenuItemDTO => ({
  id_menu_item: `m${ordinamento}`,
  tipo_utente: "Superadmin",
  tipo: "separator",
  titolo,
  ordinamento,
});

const MENU: MenuItemDTO[] = [separatore(0, "CONSULTA"), voce(1, "Volantini attivi", "/volantini/attivi"), voce(2, "POP attivi", "/pop/attivi")];

/** Permessi di un ruolo come li restituisce GET /permessi/configurazione: solo i codici abilitati. */
const configurazione = (codici: string[]) => ({
  ambito: { tipo: "Agenzia", idRuoloGdo: null, idGdo: null },
  eredita: false,
  permessi: codici.map((codice) => ({ codice, abilitato: true, impostato: true, ereditato: false, efficace: true })),
});

const rispondi = (menu: MenuItemDTO[], permessi = configurazione([])) =>
  vi.mocked(ServerCall.get).mockReset().mockImplementation(((url: string) =>
    url.startsWith("/menu/")
      ? Promise.resolve(menu)
      : url.startsWith("/permessi/configurazione")
        ? Promise.resolve(permessi)
        : Promise.resolve([])) as never);

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MenuTab />
    </QueryClientProvider>
  );

const struttura = () => screen.getByRole("region", { name: "Struttura del menu" });
const catalogo = () => screen.getByRole("region", { name: "Pagine" });
const anteprima = () => screen.getByRole("region", { name: "Anteprima" });
/** Le voci della struttura nell'ordine in cui compaiono, dalle loro maniglie. */
const vociInStruttura = () =>
  within(struttura())
    .getAllByRole("button", { name: /^Sposta / })
    .map((presa) => presa.getAttribute("aria-label")?.replace(/^Sposta (.*): frecce.*$/, "$1"));

describe("Gestione accessi: menu", () => {
  beforeEach(() => {
    rispondi(MENU);
    vi.mocked(ServerCall.post).mockReset().mockResolvedValue({});
    vi.mocked(ServerCall.put).mockReset().mockResolvedValue({});
  });

  it("il tipo di utente si sceglie da un gruppo a scelta singola", async () => {
    apri();

    const gruppo = screen.getByRole("radiogroup", { name: "Tipo di utente" });
    expect(within(gruppo).getByRole("radio", { name: "Superadmin" })).toHaveAttribute("aria-checked", "true");

    await userEvent.click(within(gruppo).getByRole("radio", { name: "Agenzia" }));
    expect(within(gruppo).getByRole("radio", { name: "Agenzia" })).toHaveAttribute("aria-checked", "true");
    expect(ServerCall.get).toHaveBeenCalledWith("/menu/Agenzia");
  });

  it("il ripristino del menu predefinito chiede conferma con Annulla prima di Ripristina", async () => {
    apri();

    await userEvent.click(await screen.findByRole("button", { name: /Ripristina menu predefinito/ }));
    const dialogo = await screen.findByRole("dialog", { name: "Ripristina menu predefinito" });
    expect(within(dialogo).getAllByRole("button").map((pulsante) => pulsante.textContent)).toEqual(["Annulla", "Ripristina"]);
    expect(ServerCall.post).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Ripristina" }));
    await waitFor(() => expect(ServerCall.post).toHaveBeenCalledWith("/menu/ripristina-predefiniti", {}));
  });

  it("se il menu non arriva mostra l'errore con Riprova, non un menu vuoto", async () => {
    vi.mocked(ServerCall.get).mockReset().mockRejectedValue(new Error("Servizio non raggiungibile"));
    apri();

    const avviso = await screen.findByRole("alert");
    expect(avviso).toHaveTextContent("Servizio non raggiungibile");
    expect(screen.queryByText(/Il menu è vuoto/)).not.toBeInTheDocument();
    expect(within(avviso).getByRole("button", { name: "Riprova" })).toBeInTheDocument();
  });

  it("ogni voce sta nell'area della pagina che apre, qualunque sia il gruppo salvato", async () => {
    rispondi([separatore(0, "LAVORO"), voce(1, "Volantini attivi", "/volantini/attivi"), voce(2, "Nuova promozione", "/promozioni/nuova")]);
    apri();

    const produzione = await within(await screen.findByRole("region", { name: "Struttura del menu" })).findByRole("region", {
      name: "Area Produzione",
    });
    const visualizzazione = within(struttura()).getByRole("region", { name: "Area Visualizzazione" });
    expect(within(produzione).getByRole("button", { name: /^Sposta Nuova promozione/ })).toBeInTheDocument();
    expect(within(visualizzazione).getByRole("button", { name: /^Sposta Volantini attivi/ })).toBeInTheDocument();
    // Il gruppo diviso fra le due aree tiene il suo titolo in entrambe
    expect(within(produzione).getByRole("textbox", { name: "Titolo del gruppo" })).toHaveValue("LAVORO");
    expect(within(visualizzazione).getByRole("textbox", { name: "Titolo del gruppo" })).toHaveValue("LAVORO");
  });

  it("il + aggiunge la pagina in fondo alla sua area e l'anteprima la mostra", async () => {
    apri();
    await screen.findByRole("region", { name: "Struttura del menu" });
    expect(within(anteprima()).queryByText("Volantini storico")).not.toBeInTheDocument();

    await userEvent.click(within(catalogo()).getByRole("button", { name: "Aggiungi Volantini storico al menu" }));

    expect(vociInStruttura()).toEqual(["Volantini attivi", "POP attivi", "Volantini storico"]);
    expect(within(anteprima()).getByText("Volantini storico")).toBeInTheDocument();
    // Nel catalogo la pagina è ora "Nel menu" e non si aggiunge una seconda volta
    expect(within(catalogo()).queryByRole("button", { name: "Aggiungi Volantini storico al menu" })).not.toBeInTheDocument();
    expect(screen.getByText("1 modifica non salvata")).toBeInTheDocument();
  });

  it("una pagina che il ruolo non può aprire è segnalata e non compare nell'anteprima", async () => {
    rispondi([voce(0, "Volantini attivi", "/volantini/attivi")], configurazione(["materiali.visualizza"]));
    apri();
    await userEvent.click(screen.getByRole("radio", { name: "Agenzia" }));
    await waitFor(() => expect(ServerCall.get).toHaveBeenCalledWith("/permessi/configurazione?tipo=Agenzia"));

    const aggiungi = await within(await screen.findByRole("region", { name: "Pagine" })).findByRole("button", {
      name: "Aggiungi Nuova promozione al menu",
    });
    expect(await within(aggiungi.closest("li")!).findByText("Senza permesso")).toBeInTheDocument();

    await userEvent.click(aggiungi);

    const riga = within(struttura()).getByRole("button", { name: /^Sposta Nuova promozione/ }).closest("[data-voce]") as HTMLElement;
    expect(within(riga).getByText("Senza permesso")).toBeInTheDocument();
    expect(within(anteprima()).queryByText("Nuova promozione")).not.toBeInTheDocument();
    expect(within(anteprima()).getByText("Volantini attivi")).toBeInTheDocument();
    expect(within(anteprima()).getByText("1 voce nascosta: il ruolo non può aprirla")).toBeInTheDocument();
  });

  it("con il focus sulla maniglia, freccia giù sposta la voce e il focus resta sulla maniglia", async () => {
    apri();
    const presa = await within(await screen.findByRole("region", { name: "Struttura del menu" })).findByRole("button", {
      name: /^Sposta Volantini attivi/,
    });

    presa.focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(vociInStruttura()).toEqual(["POP attivi", "Volantini attivi"]);
    expect(within(struttura()).getByRole("button", { name: /^Sposta Volantini attivi/ })).toHaveFocus();
  });

  it("cambiare tipo di utente con modifiche non salvate chiede conferma, e annullando si resta", async () => {
    apri();
    await screen.findByRole("region", { name: "Struttura del menu" });
    await userEvent.click(within(catalogo()).getByRole("button", { name: "Aggiungi Volantini storico al menu" }));

    const gruppo = screen.getByRole("radiogroup", { name: "Tipo di utente" });
    await userEvent.click(within(gruppo).getByRole("radio", { name: "Agenzia" }));
    const dialogo = await screen.findByRole("dialog", { name: "Modifiche non salvate" });
    expect(ServerCall.get).not.toHaveBeenCalledWith("/menu/Agenzia");

    await userEvent.click(within(dialogo).getByRole("button", { name: "Annulla" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(gruppo).getByRole("radio", { name: "Superadmin" })).toHaveAttribute("aria-checked", "true");
    expect(vociInStruttura()).toContain("Volantini storico");

    await userEvent.click(within(gruppo).getByRole("radio", { name: "Agenzia" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Modifiche non salvate" })).getByRole("button", { name: "Scarta e cambia menu" }));
    expect(within(gruppo).getByRole("radio", { name: "Agenzia" })).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(ServerCall.get).toHaveBeenCalledWith("/menu/Agenzia"));
  });

  it("Salva invia il menu area per area, con i gruppi e l'ordinamento progressivo", async () => {
    rispondi([separatore(0, "LAVORO"), voce(1, "Volantini attivi", "/volantini/attivi"), voce(2, "Nuova promozione", "/promozioni/nuova")]);
    apri();
    await screen.findByRole("region", { name: "Struttura del menu" });
    await userEvent.click(within(catalogo()).getByRole("button", { name: "Aggiungi POP attivi al menu" }));

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(ServerCall.put).toHaveBeenCalledTimes(1));
    const [url, corpo] = vi.mocked(ServerCall.put).mock.calls[0] as [string, { items: MenuItemDTO[] }];
    expect(url).toBe("/menu/Superadmin");
    expect(corpo.items.map((v) => [v.tipo, v.titolo, v.pathname ?? null, v.ordinamento])).toEqual([
      ["separator", "LAVORO", null, 0],
      ["item", "Nuova promozione", "/promozioni/nuova", 1],
      ["separator", "LAVORO", null, 2],
      ["item", "Volantini attivi", "/volantini/attivi", 3],
      ["item", "POP attivi", "/pop/attivi", 4],
    ]);
  });

  it("una voce salvata che non apre una pagina è avvisata e non viene inviata", async () => {
    rispondi([voce(0, "Volantini attivi", "/volantini/attivi"), voce(1, "Pagine Singular", "/gestione-pagine-singular")]);
    apri();

    expect(await screen.findByText("1 voce non apre una pagina e verrà tolta al salvataggio")).toBeInTheDocument();
    expect(within(struttura()).getByText("/gestione-pagine-singular")).toBeInTheDocument();
    expect(within(struttura()).queryByRole("button", { name: /^Sposta Pagine Singular/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(ServerCall.put).toHaveBeenCalledTimes(1));
    const [, corpo] = vi.mocked(ServerCall.put).mock.calls[0] as [string, { items: MenuItemDTO[] }];
    expect(corpo.items.map((v) => v.pathname)).toEqual(["/volantini/attivi"]);
  });
});
