// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PERMESSI } from "../../../lib/accessi/catalogo";

vi.mock("./api", () => ({
  useRuoliGestibili: () => ({
    data: { tipi: ["Agenzia", "GDO"], ruoliGdo: [{ id: "r1", nome: "GDO_ADMIN" }], gdo: [] },
    isLoading: false,
  }),
  useConfronto: () => ({
    data: {
      colonne: [
        { chiave: "Agenzia", tipo: "Agenzia", idRuoloGdo: null, etichetta: "Agenzia", permessi: [PERMESSI.PROMO.VISUALIZZA, PERMESSI.PROMO.ELIMINA] },
        { chiave: "GDO:r1", tipo: "GDO", idRuoloGdo: "r1", etichetta: "GDO_ADMIN", permessi: [PERMESSI.PROMO.VISUALIZZA] },
      ],
    },
    isLoading: false,
  }),
}));
vi.mock("@/components/Base/Tippy", () => ({ default: ({ children }: any) => <>{children}</> }));

import ConfrontoRuoli from "./ConfrontoRuoli";

describe("Gestione accessi: confronto ruoli", () => {
  it("l'etichetta di un'area sta nella prima cella, quella che resta fissa scorrendo in orizzontale", () => {
    render(<ConfrontoRuoli />);

    const riga = screen.getByText("Promozioni").closest("tr")!;
    const celle = within(riga).getAllByRole("cell");
    expect(celle[0]).toHaveTextContent("Promozioni");
    expect(celle[0]).not.toHaveAttribute("colspan");
    expect(celle).toHaveLength(2);
    expect(celle[1]).toHaveAttribute("colspan", "2");
  });

  it("la colonna di un sotto-ruolo indica il tipo utente nell'intestazione", () => {
    render(<ConfrontoRuoli />);

    const intestazione = screen.getByRole("columnheader", { name: /Admin/ });
    expect(intestazione).toHaveTextContent(/GDO/);
    expect(screen.getByRole("columnheader", { name: /^Agenzia$/ })).toBeInTheDocument();
  });
});
