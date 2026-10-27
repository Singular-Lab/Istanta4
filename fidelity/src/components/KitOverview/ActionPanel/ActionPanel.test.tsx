// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STATO_LAVORAZIONE_KIT_RUNTIME, TIPO_KIT_DESIGN } from "../../../../lib/enums";
import { PERMISSIONS } from "@/constants/permissions";

const contesto = vi.hoisted(() => ({ permessi: new Set<string>() }));
vi.mock("../../../context/PermissionContext", () => ({
  usePermissionContext: () => ({
    hasPermission: (codice: string) => contesto.permessi.has(codice),
    loading: false,
  }),
}));
vi.mock("@/components/Base/Tippy", () => ({ default: ({ children }: any) => <div>{children}</div> }));

import ActionPanel from ".";

const apri = (stato: STATO_LAVORAZIONE_KIT_RUNTIME) =>
  render(
    <ActionPanel
      stato={stato}
      tipoKit={TIPO_KIT_DESIGN.AUTOMATICO}
      lavorazione={{} as any}
      canProceed
      hasAccepted={false}
      hasRejected={false}
      filesCount={1}
      acceptedCount={0}
      rejectedCount={0}
      onStartRevision={vi.fn()}
      onPublish={vi.fn()}
      onRejectAndRework={vi.fn()}
      onDelete={vi.fn()}
      onRework={vi.fn()}
      onDownloadZip={vi.fn()}
    />
  );

const inerte = (testo: RegExp) => screen.getByRole("button", { name: testo }).closest("[inert]") !== null;

describe("ActionPanel, rilavorazione", () => {
  it("un kit pubblicato si scarica ma non si rilavora", () => {
    contesto.permessi = new Set<string>([...Object.values(PERMISSIONS.KIT_RUNTIME), PERMISSIONS.FILE.DOWNLOAD]);
    apri(STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO);

    expect(screen.getByRole("button", { name: /Scarica ZIP/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rilavora/ })).toBeNull();
  });

  it("in revisione Rilavora richiede il permesso di eliminare il kit", () => {
    contesto.permessi = new Set([PERMISSIONS.KIT_RUNTIME.RIPORTA_IN_LAVORAZIONE]);
    const { unmount } = apri(STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE);
    expect(inerte(/^Rilavora$/)).toBe(true);
    unmount();

    contesto.permessi = new Set([PERMISSIONS.KIT_RUNTIME.ELIMINA]);
    apri(STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE);
    expect(inerte(/^Rilavora$/)).toBe(false);
  });
});

describe("ActionPanel, aspetto", () => {
  it("ha un titolo e durante la pubblicazione il comando è in attesa e non ripetibile", () => {
    contesto.permessi = new Set<string>(Object.values(PERMISSIONS.KIT_RUNTIME));
    render(
      <ActionPanel
        stato={STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE}
        tipoKit={TIPO_KIT_DESIGN.MANUALE}
        lavorazione={{} as any}
        canProceed
        hasAccepted
        hasRejected={false}
        filesCount={1}
        acceptedCount={1}
        rejectedCount={0}
        onStartRevision={vi.fn()}
        onPublish={vi.fn()}
        onRejectAndRework={vi.fn()}
        onDelete={vi.fn()}
        onRework={vi.fn()}
        isProcessing
      />
    );

    expect(screen.getByRole("heading", { name: "Azioni" })).toBeInTheDocument();
    const pubblica = screen.getByRole("button", { name: /Pubblicazione/ });
    expect(pubblica).toHaveAttribute("aria-busy", "true");
    expect(pubblica).toBeDisabled();
  });
});
