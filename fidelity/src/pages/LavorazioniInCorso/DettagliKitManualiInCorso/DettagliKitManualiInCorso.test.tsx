// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ superadmin: false }));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/context/PermissionContext", () => ({ usePermissionContext: () => ({ superadmin: finti.superadmin }) }));

import DettagliKitManualiInCorso from ".";

const PROMO = "11111111-2222-4333-8444-555555555555";
const KIT = "99999999-8888-4777-8666-555555555555";

const apri = (stato: string) => {
  const router = createMemoryRouter(
    [
      {
        path: "/promozioni/:sezione/dettagli/:idPromo/kits",
        Component: DettagliKitManualiInCorso,
        loader: () => ({
          datiLavorazione: { id: PROMO, nome: "Promo di Pasqua", stato },
          lavorazioniManuali: [
            { guidId: KIT, titolo: "Volantino SC", tipo: "MANUALE", nomeArea: "Toscana", nomeCanale: "SC", lavorazioneStarted: false },
          ],
        }),
      },
    ],
    { initialEntries: [`/promozioni/storico/dettagli/${PROMO}/kits`] }
  );
  return render(<RouterProvider router={router} />);
};

describe("Kit della promozione chiusa", () => {
  beforeEach(() => {
    finti.superadmin = false;
  });

  it("il Superadmin apre il kit di una promo archiviata restando nello storico", async () => {
    finti.superadmin = true;
    apri("ARCHIVIATA");

    const apriKit = await screen.findByRole("link", { name: "Apri il kit Volantino SC" });
    expect(apriKit).toHaveAttribute("href", `/promozioni/storico/dettagli/${PROMO}/kits/${KIT}`);
    expect(screen.queryByRole("button", { name: "Promozione chiusa: il kit non si modifica" })).not.toBeInTheDocument();
  });

  it("per gli altri utenti il kit di una promo archiviata resta bloccato", async () => {
    apri("ARCHIVIATA");

    expect(await screen.findByRole("button", { name: "Promozione chiusa: il kit non si modifica" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Apri il kit Volantino SC" })).not.toBeInTheDocument();
  });

  it("per gli altri utenti il kit di una promo in lavorazione si apre", async () => {
    apri("IN_LAVORAZIONE");

    expect(await screen.findByRole("link", { name: "Apri il kit Volantino SC" })).toBeInTheDocument();
  });
});
