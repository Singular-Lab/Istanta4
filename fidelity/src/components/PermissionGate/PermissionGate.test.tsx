// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const contesto = vi.hoisted(() => ({ permessi: new Set<string>(), loading: false }));
vi.mock("../../context/PermissionContext", () => ({
  usePermissionContext: () => ({
    hasPermission: (codice: string) => contesto.permessi.has(codice),
    loading: contesto.loading,
  }),
}));
// Il tooltip non serve al comportamento verificato
vi.mock("@/components/Base/Tippy", () => ({
  default: ({ children, content }: any) => <div data-tooltip={content}>{children}</div>,
}));

import PermissionGate, { testoPermessoMancante } from ".";

const pubblica = () => (
  <PermissionGate permission="kit_runtime.pubblica" mode="disable">
    <button type="button">Pubblica</button>
  </PermissionGate>
);

describe("PermissionGate", () => {
  it("con il permesso mostra il comando attivo", () => {
    contesto.permessi = new Set(["kit_runtime.pubblica"]);
    contesto.loading = false;
    render(pubblica());
    expect(screen.getByRole("button", { name: "Pubblica" }).closest("[inert]")).toBeNull();
  });

  it("senza permesso, in modalità disable, il comando è inerte: niente click, focus o tastiera", () => {
    contesto.permessi = new Set();
    contesto.loading = false;
    render(pubblica());
    const contenitore = screen.getByText("Pubblica").closest("[aria-disabled='true']");
    expect(contenitore).toHaveAttribute("inert");
    expect(contenitore?.parentElement).toHaveAttribute("data-tooltip", 'Serve il permesso "Pubblicare kit" (Kit e pubblicazione)');
  });

  it("senza permesso, in modalità hide, mostra il contenuto alternativo", () => {
    contesto.permessi = new Set();
    contesto.loading = false;
    render(
      <PermissionGate permission="promo.elimina" fallback={<span>Non consentito</span>}>
        <button type="button">Elimina</button>
      </PermissionGate>
    );
    expect(screen.queryByRole("button", { name: "Elimina" })).not.toBeInTheDocument();
    expect(screen.getByText("Non consentito")).toBeInTheDocument();
  });

  it("mentre i permessi si caricano non mostra comandi disattivati", () => {
    contesto.permessi = new Set();
    contesto.loading = true;
    render(pubblica());
    expect(screen.queryByText("Pubblica")).not.toBeInTheDocument();
  });

  it("il tooltip nomina il permesso come appare nella gestione accessi", () => {
    expect(testoPermessoMancante("promo.elimina")).toBe('Serve il permesso "Eliminare promozioni" (Promozioni)');
  });
});
