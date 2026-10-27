// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ dati: { kit: null as unknown }, revalidate: vi.fn() }));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("react-router-dom", async (originale) => ({
  ...(await originale<typeof import("react-router-dom")>()),
  useLoaderData: () => finti.dati,
  useRevalidator: () => ({ revalidate: finti.revalidate, state: "idle" }),
}));

import TuttiIVolantini from ".";

const file = (nome: string, nome_originale?: string) => ({
  nome,
  nome_originale,
  url: `/olimpo/miniatura/${nome}`,
  url_download: `/olimpo/pdf/${nome}`,
});

const apri = () =>
  render(
    <MemoryRouter>
      <TuttiIVolantini />
    </MemoryRouter>
  );

describe("Tutti i file del kit", () => {
  beforeEach(() => {
    finti.revalidate.mockReset();
    finti.dati = {
      kit: {
        titolo: "Volantino ottobre",
        files: [file("Volantino Roma"), file("Locandina", "poster_MILANO.pdf")],
      },
    };
  });

  it("la ricerca filtra i file per nome e per nome originale, senza distinguere maiuscole", () => {
    apri();
    const cerca = screen.getByLabelText("Cerca file");

    fireEvent.change(cerca, { target: { value: "roma" } });
    expect(screen.getByText("Volantino Roma")).toBeInTheDocument();
    expect(screen.queryByText("Locandina")).not.toBeInTheDocument();

    fireEvent.change(cerca, { target: { value: "milano" } });
    expect(screen.getByText("Locandina")).toBeInTheDocument();
    expect(screen.queryByText("Volantino Roma")).not.toBeInTheDocument();
  });

  it("senza corrispondenze dice quale ricerca non ha risultati", () => {
    apri();

    fireEvent.change(screen.getByLabelText("Cerca file"), { target: { value: "  napoli " } });

    expect(screen.getByText("Nessun file corrisponde a «napoli»")).toBeInTheDocument();
  });

  it("non mostra più il filtro finto, il badge Nuovo né le date inventate", () => {
    apri();

    expect(screen.getByRole("heading", { name: "Tutti i file per Volantino ottobre" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Filtra/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Nuovo")).not.toBeInTheDocument();
    expect(screen.queryByText(/agosto/)).not.toBeInTheDocument();
  });

  it("se il kit non arriva mostra la pagina non caricata e Riprova rilancia il caricamento", () => {
    finti.dati = { kit: null };
    apri();

    expect(screen.getByRole("alert")).toHaveTextContent("I file del kit non sono stati caricati");
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(finti.revalidate).toHaveBeenCalledTimes(1);
  });

  it("il pulsante indietro riporta ai volantini", () => {
    apri();

    expect(screen.getByRole("link", { name: "Torna ai volantini" })).toHaveAttribute("href", "/volantini");
  });
});
