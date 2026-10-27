// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/constants/permissions";

const contesto = vi.hoisted(() => ({ permessi: new Set<string>() }));
vi.mock("@/context/PermissionContext", () => ({
  usePermissionContext: () => ({
    hasPermission: (codice: string) => contesto.permessi.has(codice),
    loading: false,
  }),
}));

import AzioniVisteODS, { type VistaODS } from "./AzioniVisteODS";

const disegna = (vista: VistaODS) => {
  const onNaviga = vi.fn();
  render(<AzioniVisteODS vista={vista} onNaviga={onNaviga} />);
  return onNaviga;
};

describe("AzioniVisteODS", () => {
  beforeEach(() => {
    contesto.permessi = new Set([PERMISSIONS.ORDINI_STAMPA.VISUALIZZA, PERMISSIONS.ORDINI_STAMPA.CREA]);
  });

  it("negli ordini in corso porta ai completati e offre Nuovo ordine", () => {
    const onNaviga = disegna("in-corso");

    expect(screen.queryByRole("button", { name: "Ordini in corso" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ordini completati" }));
    fireEvent.click(screen.getByRole("button", { name: "Nuovo ordine" }));

    expect(onNaviga).toHaveBeenNthCalledWith(1, "/ods-completati");
    expect(onNaviga).toHaveBeenNthCalledWith(2, "/nuovo-ods");
  });

  it("negli ordini completati porta agli ordini in corso e la creazione è l'ultima azione", () => {
    disegna("completati");

    const pulsanti = screen.getAllByRole("button");
    expect(pulsanti.map((p) => p.textContent)).toEqual(["Ordini in corso", "Nuovo ordine"]);
  });

  it("nel nuovo ordine mostra solo le due viste sorelle", () => {
    const onNaviga = disegna("nuovo");

    expect(screen.queryByRole("button", { name: "Nuovo ordine" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ordini in corso" }));
    expect(onNaviga).toHaveBeenCalledWith("/ods-in-corso");
    expect(screen.getByRole("button", { name: "Ordini completati" })).toBeInTheDocument();
  });

  it("senza il permesso di creare non mostra Nuovo ordine", () => {
    contesto.permessi = new Set([PERMISSIONS.ORDINI_STAMPA.VISUALIZZA]);
    disegna("in-corso");

    expect(screen.queryByRole("button", { name: "Nuovo ordine" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ordini completati" })).toBeInTheDocument();
  });
});
