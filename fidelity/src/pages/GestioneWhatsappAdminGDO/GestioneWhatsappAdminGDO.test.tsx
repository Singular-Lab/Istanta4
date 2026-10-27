// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));

import GestioneWhatsappAdminGDO from ".";

describe("Gestione WhatsApp della GDO", () => {
  it("non resta vuota: dice che la funzionalità non è ancora disponibile", () => {
    render(
      <MemoryRouter>
        <GestioneWhatsappAdminGDO />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Gestione WhatsApp" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Funzionalità non ancora disponibile" })).toBeInTheDocument();
    expect(screen.getByText(/non è ancora disponibile/)).toBeInTheDocument();
  });
});
