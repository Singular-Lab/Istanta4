// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ get: vi.fn(), permessiNegati: new Set<string>() }));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: finti.get, getUrl: () => "" } }));
vi.mock("../../context/PermissionContext", () => ({ usePermission: (codice: string) => !finti.permessiNegati.has(codice) }));
// TomSelect monta un plugin DOM che in jsdom non serve
vi.mock("@/components/Base/TomSelect", () => ({
  default: ({ children, options: _options, getRef: _getRef, onOptionAdd: _onOptionAdd, ...props }: any) => <select {...props}>{children}</select>,
}));

import StoricoVolantini from ".";
import { areeECanaliDaCombinazioni } from "./filtriAreeCanali";

// Un volantino pubblicato dalle API di consultazione: niente stato del kit
const kit = {
  id: "k1",
  titolo: "Volantino Nord",
  promo: { id: "p1", nome: "Promo ottobre", validitaDal: "2026-10-05", validitaAl: "2026-10-20" },
  area: { id: "a-nord", nome: "Nord" },
  canale: { id: "ch-super", nome: "Super" },
  numeroFile: 1,
  copertina: { id: "f1", nome: "volantino.pdf", tipoExport: "VOL", mime: "application/pdf", pagine: 8, anteprima: "/olimpo/x?id=o1" },
};

const URL_STORICO = "/consultazione/volantini?periodo=storico";
const pagina = (kitDellaPagina: unknown[], totale = kitDellaPagina.length) => ({ kit: kitDellaPagina, totale, pagina: 1, dimensione: 20 });

const apri = () =>
  render(
    <MemoryRouter>
      <StoricoVolantini />
    </MemoryRouter>
  );

describe("Storico volantini", () => {
  beforeEach(() => {
    finti.get.mockReset();
    finti.permessiNegati = new Set();
  });

  it("mostra i KPI sopra l'elenco e i volantini con le date nel formato DD/MM/YYYY", async () => {
    finti.get.mockImplementation((url: string) =>
      Promise.resolve(url.startsWith(URL_STORICO) ? pagina([kit]) : [])
    );
    apri();

    expect(await screen.findByRole("heading", { name: "Volantino Nord" })).toBeInTheDocument();
    expect(screen.getByText("Volantini totali")).toBeInTheDocument();
    expect(screen.getByText("05/10/2026 – 20/10/2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volantino Nord" })).toHaveAttribute("href", "/volantini/tutti_i_volantini?kit=k1");
  });

  it("senza materiali.visualizza il titolo del volantino resta testo semplice", async () => {
    finti.permessiNegati = new Set(["materiali.visualizza"]);
    finti.get.mockImplementation((url: string) =>
      Promise.resolve(url.startsWith(URL_STORICO) ? pagina([kit]) : [])
    );
    apri();

    expect(await screen.findByRole("heading", { name: "Volantino Nord" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Volantino Nord" })).not.toBeInTheDocument();
  });

  it("se lo storico non arriva mostra il motivo e Riprova", async () => {
    finti.get.mockImplementation((url: string) =>
      url.startsWith(URL_STORICO) ? Promise.reject(new Error("Servizio non raggiungibile")) : Promise.resolve([])
    );
    apri();

    expect(await screen.findByRole("alert")).toHaveTextContent("Servizio non raggiungibile");
    expect(screen.getByRole("button", { name: "Riprova" })).toBeInTheDocument();
  });

  it("popola i filtri Area e Canale dalle combinazioni area/canale e filtra lo storico per l'area scelta", async () => {
    finti.get.mockImplementation((url: string) => {
      if (url.startsWith(URL_STORICO)) return Promise.resolve(pagina([kit]));
      if (url === "/get_all_combinazioni_canale_area") {
        return Promise.resolve([
          { id: "c1", id_area: "a-nord", id_canale: "ch-super", area_nome: "Nord", area_codice: "N", canale_nome: "Super", canale_codice: "S", stato: "ATTIVO" },
          { id: "c2", id_area: "a-nord", id_canale: "ch-iper", area_nome: "Nord", area_codice: "N", canale_nome: "Iper", canale_codice: "I", stato: "ATTIVO" },
          { id: "c3", id_area: "a-centro", id_canale: "ch-super", area_nome: "Centro", area_codice: "C", canale_nome: "Super", canale_codice: "S", stato: "DISATTIVO" },
        ]);
      }
      return Promise.reject(new Error(`rotta inattesa ${url}`));
    });
    apri();

    const area = await screen.findByRole("combobox", { name: "Area" });
    await vi.waitFor(() => expect(within(area).getAllByRole("option")).toHaveLength(3));
    expect(within(area).getAllByRole("option").map((o) => o.textContent)).toEqual(["Tutte le aree", "Centro", "Nord"]);
    const canale = screen.getByRole("combobox", { name: "Canale" });
    expect(within(canale).getAllByRole("option").map((o) => o.textContent)).toEqual(["Tutti i canali", "Iper", "Super"]);
    // Le vecchie rotte /aree e /canali non esistono
    expect(finti.get).not.toHaveBeenCalledWith("/aree");
    expect(finti.get).not.toHaveBeenCalledWith("/canali");

    fireEvent.change(area, { target: { value: "a-nord" } });

    await vi.waitFor(() => expect(finti.get).toHaveBeenCalledWith(`${URL_STORICO}&idArea=a-nord&pagina=1&dimensione=20`));
  });

  it("chiede al server una pagina alla volta", async () => {
    finti.get.mockImplementation((url: string) =>
      Promise.resolve(url.startsWith(URL_STORICO) ? pagina([kit], 45) : [])
    );
    apri();

    expect(await screen.findByRole("heading", { name: "Volantino Nord" })).toBeInTheDocument();
    expect(finti.get).toHaveBeenCalledWith(`${URL_STORICO}&pagina=1&dimensione=20`);
    // Solo volantini pubblicati: la scheda non mostra lo stato del kit
    expect(screen.queryByText("Pubblicato")).not.toBeInTheDocument();
  });
});

describe("areeECanaliDaCombinazioni", () => {
  it("senza nome usa il codice e poi l'id, e ignora le combinazioni senza area o canale", () => {
    const { aree, canali } = areeECanaliDaCombinazioni([
      { id: "c1", id_gdo: "g", id_area: "a1", id_canale: "ch1", area_codice: "ZONA1", stato: "ATTIVO", sigla: "", updatedat: new Date() },
      { id: "c2", id_gdo: "g", id_area: "", id_canale: "ch2", stato: "ATTIVO", sigla: "", updatedat: new Date() },
    ]);

    expect(aree).toEqual([{ id: "a1", nome: "ZONA1" }]);
    expect(canali).toEqual([{ id: "ch1", nome: "ch1" }, { id: "ch2", nome: "ch2" }]);
  });

  it("senza combinazioni i filtri restano vuoti", () => {
    expect(areeECanaliDaCombinazioni([])).toEqual({ aree: [], canali: [] });
  });
});
