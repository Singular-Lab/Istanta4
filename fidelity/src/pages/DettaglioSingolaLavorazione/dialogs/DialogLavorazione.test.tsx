// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura dei Dialog
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import DeleteProcessingDialog from "./DeleteProcessingDialog";
import StartProcessingDialog from "./StartProcessingDialog";

const lavorazione = { guidId: "kit-1", nomeArea: "Nord", nomeCanale: "Super" } as any;
const mutazione = () => ({ mutate: vi.fn(), isPending: false }) as any;

// Nel footer Annulla viene prima della conferma (STANDARD §6)
const pulsantiFooter = () => within(screen.getByRole("dialog")).getAllByRole("button").map((b) => b.textContent?.trim());

describe("Dialog della lavorazione", () => {
  it("Avvia lavorazione: Annulla e poi Avvia, la conferma avvia e chiude", async () => {
    const setDialogOpen = vi.fn();
    const avvio = mutazione();
    render(
      <StartProcessingDialog dialogOpen setDialogOpen={setDialogOpen} lavorazione={lavorazione} mutationStartLavorazione={avvio} idPromo="p1" isManuale />
    );

    expect(await screen.findByRole("dialog", { name: "Avvia lavorazione" })).toBeInTheDocument();
    expect(pulsantiFooter()).toEqual(["Annulla", "Avvia"]);

    fireEvent.click(screen.getByRole("button", { name: "Avvia" }));
    expect(avvio.mutate).toHaveBeenCalledWith({ idPromo: "p1" });
    expect(setDialogOpen).toHaveBeenCalledWith(false);
  });

  it("Elimina lavorazione: Annulla e poi Elimina, Annulla non elimina", async () => {
    const setDialogOpen = vi.fn();
    const eliminazione = mutazione();
    render(
      <DeleteProcessingDialog dialogOpen setDialogOpen={setDialogOpen} lavorazione={lavorazione} mutationEliminaLavorazione={eliminazione} />
    );

    expect(await screen.findByRole("dialog", { name: "Elimina lavorazione da promo" })).toBeInTheDocument();
    expect(pulsantiFooter()).toEqual(["Annulla", "Elimina"]);

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(eliminazione.mutate).not.toHaveBeenCalled();
    expect(setDialogOpen).toHaveBeenCalledWith(false);
  });
});
