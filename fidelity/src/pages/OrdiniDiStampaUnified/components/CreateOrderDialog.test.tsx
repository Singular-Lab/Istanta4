// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreateOrderDialog from "./CreateOrderDialog";

const promo = { id: "p1", nome: "Volantino ottobre", validita_dal: "2026-10-01", validita_al: "2026-10-15" } as any;

const apri = (isPending: boolean) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <CreateOrderDialog open selectedPromo={promo} onClose={onClose} onConfirm={onConfirm} isPending={isPending} />
  );
  return { onConfirm, onClose };
};

describe("CreateOrderDialog", () => {
  it("mostra il periodo di validità nel formato DD/MM/YYYY e Conferma crea l'ordine", async () => {
    const { onConfirm } = apri(false);

    const conferma = await screen.findByRole("button", { name: "Conferma" });
    expect(screen.getByText("01/10/2026")).toBeInTheDocument();
    expect(screen.getByText("15/10/2026")).toBeInTheDocument();
    expect(conferma).not.toHaveAttribute("aria-busy");

    fireEvent.click(conferma);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("durante la creazione Conferma resta con la sua etichetta, disattivato e occupato", async () => {
    const { onConfirm } = apri(true);

    const conferma = await screen.findByRole("button", { name: "Conferma" });
    expect(conferma).toBeDisabled();
    expect(conferma).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Creazione...")).not.toBeInTheDocument();

    fireEvent.click(conferma);

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
