// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("../../components/Base/QRCodeViewer", () => ({ default: () => null }));

import WebPliantDisponibili from ".";

const apri = (allData: unknown[]) => {
  const router = createMemoryRouter([{ path: "/", loader: () => ({ allData }), element: <WebPliantDisponibili /> }]);
  return render(<RouterProvider router={router} />);
};

describe("WebPliantDisponibili", () => {
  it("ha l'intestazione di pagina comune e senza dati mostra lo stato vuoto", async () => {
    const { container } = apri([]);

    expect(await screen.findByRole("heading", { level: 1, name: "Webpliant disponibili" })).toHaveClass("title-page");
    expect(screen.getByRole("heading", { name: "Nessuna Webpliant disponibile" })).toBeInTheDocument();
    expect(container.querySelector(".p-6")).toBeNull();
    expect(container.querySelector(".line-h")).toBeNull();
  });

  it("mostra il periodo della promo nel formato comune e il canale senza workspace come avviso", async () => {
    apri([
      {
        idKit: "k1",
        nomeCanale: "Volantino",
        nomeArea: "Nord",
        data_inizio_promo_corrente: "2026-03-09T00:00:00",
        data_fine_promo_corrente: "2026-03-22T00:00:00",
        disattivo_mancanza_workspace: true,
        messaggio: "Nessun workspace configurato",
      },
    ]);

    expect(await screen.findByRole("heading", { level: 3, name: "Volantino - Nord" })).toHaveClass("title-card");
    expect(screen.getByText(/09\/03\/2026/)).toHaveTextContent("al");
    expect(screen.getByRole("alert")).toHaveTextContent("Nessun workspace configurato");
    expect(screen.getByRole("link", { name: "Crea workspace" })).toHaveAttribute("href", "/webliant/impostazioni-webpliant");
  });
});
