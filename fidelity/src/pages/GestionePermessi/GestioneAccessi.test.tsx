// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("./PermessiRuoli", () => ({ default: () => <div>Pannello permessi</div> }));
vi.mock("./ConfrontoRuoli", () => ({ default: () => <div>Pannello confronto</div> }));
vi.mock("./MenuTab", () => ({ default: () => <div>Pannello menu</div> }));

import GestioneAccessi from ".";

describe("Gestione accessi: scelta della sezione", () => {
  it("le tre sezioni sono un gruppo a scelta singola e i permessi restano montati cambiando sezione", async () => {
    render(<GestioneAccessi />);

    expect(screen.getByRole("heading", { level: 1, name: "Gestione accessi" })).toBeInTheDocument();
    const gruppo = screen.getByRole("radiogroup", { name: "Sezioni della gestione accessi" });
    expect(within(gruppo).getAllByRole("radio")).toHaveLength(3);
    expect(within(gruppo).getByRole("radio", { name: "Permessi dei ruoli" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Pannello permessi")).toBeVisible();
    // Il confronto si monta solo quando serve
    expect(screen.queryByText("Pannello confronto")).not.toBeInTheDocument();

    await userEvent.click(within(gruppo).getByRole("radio", { name: "Menu" }));
    expect(within(gruppo).getByRole("radio", { name: "Menu" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Pannello menu")).toBeVisible();
    // Nascosto ma ancora montato: le modifiche in sospeso non si perdono
    expect(screen.getByText("Pannello permessi")).not.toBeVisible();

    await userEvent.click(within(gruppo).getByRole("radio", { name: "Confronta ruoli" }));
    expect(screen.getByText("Pannello confronto")).toBeVisible();
  });
});
