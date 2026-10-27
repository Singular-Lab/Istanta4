// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FileManagement from ".";

describe("FilesKit", () => {
  it("senza file mostra lo stato vuoto e Aggiungi file crea una riga", () => {
    const setFiles = vi.fn();
    const setNameToPreview = vi.fn();
    render(<FileManagement files={[]} setFiles={setFiles} setNameToPreview={setNameToPreview} />);

    expect(screen.getByText("Nessun file aggiunto")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi file" }));
    expect(setFiles).toHaveBeenCalledTimes(1);
    expect(setNameToPreview).toHaveBeenCalledTimes(1);
  });

  it("ogni file ha campi con nome accessibile e il comando per rimuoverlo", () => {
    const file = { id: "f1", nome: "copertina.pdf", direttive: "", isOptional: false } as any;
    render(<FileManagement files={[file]} setFiles={vi.fn()} setNameToPreview={vi.fn()} />);

    expect(screen.getByLabelText("Nome del file 1")).toHaveValue("copertina.pdf");
    expect(screen.getByLabelText("Direttive del file 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rimuovi copertina.pdf" })).toBeInTheDocument();
  });
});
