// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Popover
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("../../../lib/server_call", () => ({ ServerCall: { post: vi.fn() } }));

import MaintenanceModal from ".";

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MaintenanceModal open onClose={vi.fn()} avvisoAttivo={null} />
    </QueryClientProvider>
  );

describe("MaintenanceModal", () => {
  it("sceglie la modalità con un gruppo di opzioni e mostra l'anteprima come avviso", async () => {
    apri();

    const gruppo = await screen.findByRole("radiogroup", { name: "Modalità dell'avviso" });
    expect(gruppo).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Orario programmato" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("radio", { name: "Tra X minuti" }));

    expect(screen.getByRole("radio", { name: "Tra X minuti" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Il sistema andrà offline per manutenzione tra 20 minuti");
  });

  it("nell'anteprima la data è nel formato comune e il piede ha Annulla prima della conferma", async () => {
    apri();
    await screen.findByRole("radiogroup", { name: "Modalità dell'avviso" });

    fireEvent.change(screen.getByLabelText("Giorno"), { target: { value: "2099-03-09" } });
    expect(screen.getByRole("alert")).toHaveTextContent("09/03/2099");

    const pulsanti = screen.getAllByRole("button").filter((b) => ["Annulla", "Attiva avviso"].includes(b.textContent?.trim() ?? ""));
    expect(pulsanti.map((b) => b.textContent?.trim())).toEqual(["Annulla", "Attiva avviso"]);
  });
});
