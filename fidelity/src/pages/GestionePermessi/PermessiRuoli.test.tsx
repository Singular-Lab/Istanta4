// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMESSI, TUTTI_I_PERMESSI } from "../../../lib/accessi/catalogo";

const finti = vi.hoisted(() => ({ mutate: vi.fn(), configurazioni: {} as Record<string, any> }));

vi.mock("./api", () => ({
  useRuoliGestibili: () => ({
    data: { tipi: ["Agenzia", "GDO"], ruoliGdo: [], gdo: [] },
    isLoading: false,
  }),
  useConfigurazione: (ambito: { tipo: string }) => ({
    data: finti.configurazioni[ambito.tipo],
    isLoading: false,
    isError: false,
  }),
  useConfronto: () => ({ data: { colonne: [] } }),
  useSalvaConfigurazione: () => ({ mutate: finti.mutate, isPending: false }),
  useRipristinaOverride: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/components/Base/Tippy", () => ({ default: ({ children }: any) => <>{children}</> }));

import PermessiRuoli from "./PermessiRuoli";

const configurazione = (tipo: string, abilitati: string[]) => ({
  ambito: { tipo },
  eredita: false,
  permessi: TUTTI_I_PERMESSI.map((p) => ({
    codice: p.codice,
    abilitato: abilitati.indexOf(p.codice) >= 0,
    impostato: abilitati.indexOf(p.codice) >= 0,
    ereditato: false,
    efficace: abilitati.indexOf(p.codice) >= 0,
  })),
});

const apriArea = async (nome: string) => {
  await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${nome}`) }));
};

describe("Gestione accessi: permessi dei ruoli", () => {
  beforeEach(() => {
    finti.mutate.mockReset();
    finti.configurazioni = {
      GDO: configurazione("GDO", [PERMESSI.PROMO.VISUALIZZA]),
      Agenzia: configurazione("Agenzia", [PERMESSI.PROMO.VISUALIZZA, PERMESSI.PROMO.ELIMINA]),
    };
  });

  it("riabilitare un permesso appena disabilitato non lascia nulla da salvare", async () => {
    render(<PermessiRuoli />);
    await apriArea("Promozioni");
    const consultare = screen.getByLabelText("Consultare le promozioni");

    await userEvent.click(consultare);
    expect(screen.getByRole("button", { name: /Rivedi e salva/ })).toBeInTheDocument();

    await userEvent.click(consultare);
    expect(screen.queryByRole("button", { name: /Rivedi e salva/ })).not.toBeInTheDocument();
  });

  it("cambiando ruolo con modifiche in sospeso chiede se scartarle, e annullando le tiene", async () => {
    render(<PermessiRuoli />);
    await apriArea("Promozioni");
    await userEvent.click(screen.getByLabelText("Eliminare promozioni"));

    await userEvent.click(screen.getByRole("button", { name: /^Agenzia/ }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Scartare le modifiche?")).toBeInTheDocument();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Annulla" }));
    expect(screen.getByLabelText("Eliminare promozioni")).toBeChecked();
    expect(screen.getByRole("button", { name: /Rivedi e salva/ })).toBeInTheDocument();
  });

  it("prima di salvare mostra il riepilogo e salva solo dopo la conferma", async () => {
    render(<PermessiRuoli />);
    await apriArea("Promozioni");
    await userEvent.click(screen.getByLabelText("Eliminare promozioni"));
    await userEvent.click(screen.getByRole("button", { name: /Rivedi e salva/ }));

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Si abilitano (1)")).toBeInTheDocument();
    expect(within(dialogo).getByText("Eliminare promozioni")).toBeInTheDocument();
    expect(finti.mutate).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: /Conferma e salva/ }));
    expect(finti.mutate).toHaveBeenCalledWith(
      {
        ambito: { tipo: "GDO", idRuoloGdo: null, idGdo: null },
        modifiche: [{ codice: PERMESSI.PROMO.ELIMINA, abilitato: true }],
      },
      expect.anything()
    );
  });

  it("l'interruttore d'area distingue parziale, tutto e niente", async () => {
    finti.configurazioni.Agenzia = configurazione("Agenzia", [
      PERMESSI.PROMO.VISUALIZZA, PERMESSI.PROMO.CREA, PERMESSI.PROMO.MODIFICA, PERMESSI.PROMO.ELIMINA,
    ]);
    render(<PermessiRuoli />);

    // GDO: solo "Consultare le promozioni" su 4 permessi dell'area
    const parziale = screen.getByRole("switch", { name: "Tutta l'area Promozioni" });
    expect(parziale).toHaveAttribute("aria-checked", "mixed");
    expect(parziale).toHaveAttribute("title", "Parziale: 1 di 4");
    expect(screen.getByRole("switch", { name: "Tutta l'area Materiali" })).toHaveAttribute("aria-checked", "false");

    await userEvent.click(screen.getByRole("button", { name: /^Agenzia/ }));
    expect(screen.getByRole("switch", { name: "Tutta l'area Promozioni" })).toHaveAttribute("aria-checked", "true");
  });

  it("togliere l'accesso a un'area con azioni attive chiede conferma", async () => {
    finti.configurazioni.GDO = configurazione("GDO", [PERMESSI.PROMO.VISUALIZZA, PERMESSI.PROMO.CREA]);
    render(<PermessiRuoli />);
    await apriArea("Promozioni");
    await userEvent.click(screen.getByLabelText("Consultare le promozioni"));

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Togliere l'accesso all'area?")).toBeInTheDocument();
    expect(within(dialogo).getByText("Creare promozioni")).toBeInTheDocument();
  });
});
