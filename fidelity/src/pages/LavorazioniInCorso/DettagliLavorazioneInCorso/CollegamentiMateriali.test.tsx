// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ permessi: [] as string[] }));

vi.mock("@/context/PermissionContext", () => ({ usePermission: (codice: string) => finti.permessi.includes(codice) }));

import CollegamentiMateriali from "./CollegamentiMateriali";

const apri = (statoPromo: string | null | undefined) =>
  render(
    <MemoryRouter>
      <CollegamentiMateriali idPromo="p1" statoPromo={statoPromo} />
    </MemoryRouter>
  );

describe("collegamenti dal dettaglio della promo a Volantini e POP", () => {
  beforeEach(() => {
    finti.permessi = ["materiali.visualizza"];
  });

  it.each([
    ["IN_LAVORAZIONE", "prossimi"],
    ["PIANIFICATA", "prossimi"],
    ["IN_RITARDO", "prossimi"],
    ["VALIDA", "attivi"],
    ["VALIDA_CON_ERRORI", "attivi"],
    ["ARCHIVIATA", "storico"],
  ])("una promo %s porta alle viste %s filtrate su di lei", (stato, periodo) => {
    apri(stato);

    expect(screen.getByRole("heading", { name: "Materiali della promozione" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volantini" })).toHaveAttribute("href", `/volantini/${periodo}?promo=p1`);
    expect(screen.getByRole("link", { name: "POP" })).toHaveAttribute("href", `/pop/${periodo}?promo=p1`);
  });

  it("dice che le viste mostrano solo i materiali pubblicati, nel periodo della promo", () => {
    apri("IN_LAVORAZIONE");

    expect(screen.getByText("Volantini e file POP pubblicati della promozione, nelle viste Prossimi.")).toBeInTheDocument();
  });

  it.each(["ELIMINATA", "STATO_INVENTATO", null, undefined])("una promo senza periodo (%s) non ha i collegamenti", (stato) => {
    const { container } = apri(stato);

    expect(container).toBeEmptyDOMElement();
  });

  it("senza il permesso dei materiali i collegamenti non compaiono", () => {
    finti.permessi = [];
    const { container } = apri("VALIDA");

    expect(container).toBeEmptyDOMElement();
  });
});
