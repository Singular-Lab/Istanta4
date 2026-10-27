// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  file: {} as Record<string, unknown>,
}));

const vuota = vi.hoisted(() => () => ({ data: undefined, isLoading: false }));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/components/PreviewImmaginePdf", () => ({ PreviewImmaginePdf: () => null }));
vi.mock("@/hooks/usePromoName", () => ({ usePromoName: () => ({ data: "Volantino ottobre" }) }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { getUrl: () => "" } }));
vi.mock("@/query/query", () => ({
  useFetchAllFilesDocumentale: () => finti.file,
  useFetchAree: vuota,
  useFetchCanali: vuota,
  useFetchFilesFieldValues: () => ({ data: [], isLoading: false }),
  useFetchFilesMetadataFields: () => ({ data: [] }),
  useFetchFormati: vuota,
  useFetchLavorazioni: vuota,
  useFetchPromoFiltered: () => ({ data: { promos: [] } }),
  useFetchTipiExport: vuota,
}));

import MaterialiDocumentale from ".";

const promoConFile = {
  totalItems: 1,
  totalPages: 1,
  currentPage: 1,
  pageSize: 10000,
  promos: [
    {
      id: "p1",
      nome: "Volantino ottobre",
      validita_dal: "2026-10-01",
      validita_al: "2026-10-15",
      stato: "VALIDA",
      kits: [
        {
          id: "k1",
          nome: "Kit A4",
          files: [{ id: "f1", nome: "volantino.pdf", url: "https://anteprime.test/f1.png", pages: 2 }],
        },
      ],
    },
  ],
};

const apri = async (preselectedPromoId?: string) => {
  const router = createMemoryRouter(
    [
      {
        path: "/materiali-attivi",
        loader: () => ({ title: "Materiali attivi", description: "File delle promo valide", filterType: "attivi", preselectedPromoId }),
        element: <MaterialiDocumentale />,
      },
    ],
    { initialEntries: ["/materiali-attivi"] }
  );
  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1 });
};

describe("Materiali documentale", () => {
  beforeEach(() => {
    finti.file = { data: promoConFile, isLoading: false, isError: false, error: null, refetch: vi.fn() };
  });

  it("il cambio vista ha un nome e segnala la vista attiva", async () => {
    await apri();

    expect(screen.getByRole("button", { name: "Vista griglia" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Vista elenco" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Vista elenco" }));

    expect(screen.getByRole("button", { name: "Vista elenco" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Vista griglia" })).toHaveAttribute("aria-pressed", "false");
  });

  it("l'anteprima di un file è un pulsante con nome, in griglia e in elenco", async () => {
    await apri();

    expect(screen.getByRole("button", { name: "Anteprima volantino.pdf" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Vista elenco" }));

    expect(screen.getByRole("button", { name: "Anteprima volantino.pdf" })).toBeEnabled();
  });

  it("la promo mostra date DD/MM/YYYY e lo stato del catalogo", async () => {
    await apri();

    expect(screen.getByText(/01\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/15\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByTitle("Valida")).toHaveTextContent("Valida");
    expect(screen.queryByText("VALIDA")).not.toBeInTheDocument();
  });

  it("se i file non arrivano mostra il motivo e Riprova ricarica", async () => {
    const refetch = vi.fn();
    finti.file = { data: undefined, isLoading: false, isError: true, error: new Error("Servizio documentale non raggiungibile"), refetch };
    await apri();

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("Impossibile caricare i file");
    expect(avviso).toHaveTextContent("Servizio documentale non raggiungibile");
    expect(screen.queryByText("Nessun file trovato")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("solo con la promo preselezionata compare l'indietro verso la promo", async () => {
    await apri("p1");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Materiali: Volantino ottobre");
    expect(screen.getByRole("button", { name: "Torna alla promo" })).toBeInTheDocument();
  });

  it("senza promo preselezionata non c'è l'indietro", async () => {
    await apri();

    expect(screen.queryByRole("button", { name: "Torna alla promo" })).not.toBeInTheDocument();
  });

  it("ogni filtro ha un'etichetta collegata al proprio campo", async () => {
    await apri();

    expect(screen.getByLabelText("Promozione")).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText("Nome della promozione")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Campo metadata")).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText("Valore metadata")).toBeDisabled();
    expect(screen.getByLabelText("Area")).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText("Formato")).toBeInstanceOf(HTMLSelectElement);
  });
});
