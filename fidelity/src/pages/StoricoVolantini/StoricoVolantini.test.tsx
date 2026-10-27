// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: finti.get, getUrl: () => "" } }));
vi.mock("../../context/PermissionContext", () => ({ usePermission: () => true }));
// TomSelect monta un plugin DOM che in jsdom non serve
vi.mock("@/components/Base/TomSelect", () => ({
  default: ({ children, options: _options, getRef: _getRef, onOptionAdd: _onOptionAdd, ...props }: any) => <select {...props}>{children}</select>,
}));

import StoricoVolantini from ".";

const kit = {
  id: "k1",
  titolo: "Volantino Nord",
  nome_area: "Nord",
  nome_canale: "Super",
  stato_lavorazione: "PUBBLICATO",
  nome_promo: "Promo ottobre",
  id_promo: "p1",
  validita_dal: "2026-10-05",
  validita_al: "2026-10-20",
  files: [{ id: "f1", nome: "volantino.pdf", id_olimpo_cloud: "o1", pages: 8 }],
};

const apri = () =>
  render(
    <MemoryRouter>
      <StoricoVolantini />
    </MemoryRouter>
  );

describe("Storico volantini", () => {
  beforeEach(() => {
    finti.get.mockReset();
  });

  it("mostra i KPI sopra l'elenco e i volantini con le date nel formato DD/MM/YYYY", async () => {
    finti.get.mockImplementation((url: string) =>
      Promise.resolve(url.startsWith("/dashboard/storico-volantini") ? { totale: 1, kit: [kit] } : [])
    );
    apri();

    expect(await screen.findByRole("heading", { name: "Volantino Nord" })).toBeInTheDocument();
    expect(screen.getByText("Volantini totali")).toBeInTheDocument();
    expect(screen.getByText("05/10/2026 – 20/10/2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volantino Nord" })).toHaveAttribute("href", "/promozioni/in-corso/dettagli/p1/kits/k1");
  });

  it("se lo storico non arriva mostra il motivo e Riprova", async () => {
    finti.get.mockImplementation((url: string) =>
      url.startsWith("/dashboard/storico-volantini") ? Promise.reject(new Error("Servizio non raggiungibile")) : Promise.resolve([])
    );
    apri();

    expect(await screen.findByRole("alert")).toHaveTextContent("Servizio non raggiungibile");
    expect(screen.getByRole("button", { name: "Riprova" })).toBeInTheDocument();
  });
});
