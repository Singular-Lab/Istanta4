// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: finti.get, post: vi.fn() } }));
vi.mock("../../components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("../../context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("../../hooks/useSocket", () => ({ useSocket: () => null }));

import OutboxWhatsapp from ".";

const campagna = {
  bulkId: "7b0c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d",
  titolo: "Promo autunno",
  total: 10,
  success: 4,
  failed: 0,
  pending: 6,
  processed: 4,
  percentuale: 40,
  status: "RUNNING",
};

const apri = () =>
  render(
    <MemoryRouter>
      <OutboxWhatsapp />
    </MemoryRouter>
  );

describe("Campagne WhatsApp", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    finti.get.mockReset();
  });

  it("se le campagne non arrivano mostra il motivo, non 'Nessuna campagna', e Riprova le ricarica", async () => {
    finti.get
      .mockRejectedValueOnce(new Error("Servizio WhatsApp non raggiungibile"))
      .mockResolvedValueOnce({ success: true, data: [campagna] });
    apri();

    const avviso = await screen.findByRole("alert");
    expect(avviso).toHaveTextContent("Servizio WhatsApp non raggiungibile");
    expect(screen.queryByText("Nessuna campagna")).not.toBeInTheDocument();

    await userEvent.click(within(avviso).getByRole("button", { name: "Riprova" }));

    expect(await screen.findByText("Promo autunno")).toBeInTheDocument();
    expect(finti.get).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lo stato della campagna si legge dal catalogo degli stati", async () => {
    finti.get.mockResolvedValue({ success: true, data: [campagna] });
    apri();

    expect(await screen.findByTitle("In corso")).toHaveAttribute("data-tono", "info");
  });

  it("senza campagne mostra lo stato vuoto", async () => {
    finti.get.mockResolvedValue({ success: true, data: [] });
    apri();

    expect(await screen.findByText("Nessuna campagna")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
