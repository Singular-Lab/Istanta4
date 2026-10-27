// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));

import Volantini from ".";

const file = (nome: string) => ({
  nome_file: `${nome}.pdf`,
  id_olimpo_cloud: nome,
  tipo_export: "VOL",
  codice_tipiexport: "VOL",
  idPromo: "p1",
  url: `https://cdn.example/${nome}.jpg`,
  url_download: `https://cdn.example/${nome}.pdf`,
});

const gruppi = [
  { idKit: "k1", idArea: "a1", idCanale: "c1", nomeArea: "Nord", nomeCanale: "Super", files_field: [file("ottobre-nord")] },
  { idKit: "k2", idArea: "a2", idCanale: "c2", nomeArea: "Sud", nomeCanale: "Market", files_field: [file("ottobre-sud")] },
];

const apri = (files: unknown[] | null) => {
  const router = createMemoryRouter([{ path: "/volantini", loader: () => ({ files }), element: <Volantini /> }], {
    initialEntries: ["/volantini"],
  });
  render(<RouterProvider router={router} />);
};

describe("Volantini", () => {
  it("mostra i volantini senza date fisse né collegamenti finti", async () => {
    apri(gruppi);

    expect(await screen.findByRole("heading", { name: "Nord · Super" })).toBeInTheDocument();
    expect(screen.queryByText(/dal 10 al 21 agosto/)).not.toBeInTheDocument();
    expect(screen.queryByText("Nuovo")).not.toBeInTheDocument();
    expect(document.querySelector('a[href="#"]')).toBeNull();
    expect(screen.getByRole("link", { name: "Scarica il PDF ottobre-nord.pdf" })).toHaveAttribute("href", "https://cdn.example/ottobre-nord.pdf");
  });

  it("la ricerca e il filtro per area usano i dati caricati", async () => {
    apri(gruppi);

    fireEvent.change(await screen.findByRole("searchbox", { name: "Cerca volantini" }), { target: { value: "sud" } });
    expect(screen.queryByRole("heading", { name: "Nord · Super" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sud · Market" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Cerca volantini" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Area" }), { target: { value: "Nord" } });
    expect(screen.getByRole("heading", { name: "Nord · Super" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sud · Market" })).not.toBeInTheDocument();
  });

  it("senza volantini mostra lo stato vuoto", async () => {
    apri(null);

    expect(await screen.findByText("Nessun volantino disponibile")).toBeInTheDocument();
  });
});
