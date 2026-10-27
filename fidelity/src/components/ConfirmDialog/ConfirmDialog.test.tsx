// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from ".";

function apriDialog(loading = false) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Eliminare il kit?"
      description="Il kit verrà eliminato definitivamente."
      confirmLabel="Elimina"
      loading={loading}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
  return { onClose, onConfirm };
}

describe("ConfirmDialog", () => {
  it("chiama onConfirm, e non onClose, al click sul pulsante di conferma", async () => {
    const { onClose, onConfirm } = apriDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Elimina" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("chiama onClose, e non onConfirm, al click su Annulla", async () => {
    const { onClose, onConfirm } = apriDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Annulla" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("durante l'operazione in corso disattiva entrambi i pulsanti", async () => {
    const { onClose, onConfirm } = apriDialog(true);

    // Con loading il pulsante di conferma mostra lo spinner al posto dell'etichetta
    const pulsanti = within(await screen.findByRole("dialog")).getAllByRole("button");
    expect(pulsanti).toHaveLength(2);
    for (const pulsante of pulsanti) {
      expect(pulsante).toBeDisabled();
      await userEvent.click(pulsante);
    }

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("usa l'icona di pericolo solo per le conferme distruttive", async () => {
    const { unmount } = render(
      <ConfirmDialog open title="Eliminare?" description="" onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(await screen.findByTestId("icona-conferma")).toHaveClass("text-danger");
    unmount();

    render(
      <ConfirmDialog
        open
        title="Reinviare i messaggi?"
        description=""
        confirmVariant="primary"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const icona = await screen.findByTestId("icona-conferma");
    expect(icona).toHaveClass("text-primary");
    expect(icona).not.toHaveClass("text-danger");
  });

  it("il nome della finestra è il titolo, con la tipografia dei titoli di dialog", async () => {
    apriDialog();

    const finestra = await screen.findByRole("dialog", { name: "Eliminare il kit?" });
    expect(within(finestra).getByText("Eliminare il kit?")).toHaveClass("title-section");
    expect(within(finestra).getByText("Azione irreversibile")).toBeInTheDocument();
  });
});
