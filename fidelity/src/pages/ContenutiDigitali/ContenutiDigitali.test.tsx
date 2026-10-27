// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Popover
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

type Filtri = { nome: string; idArea: string };

const finti = vi.hoisted(() => ({
  query: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  chiamate: [] as { page: number; filters: Filtri }[],
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/query/query", () => ({
  useFetchAllContenutiDigitali: (page: number, _pageSize: number, filters: Filtri) => {
    finti.chiamate.push({ page, filters });
    return finti.query;
  },
  useFetchLavorazioni: () => ({ data: [] }),
  useFetchAree: () => ({ data: [{ id: "a1", nome: "Nord" }] }),
  useFetchCanali: () => ({ data: [] }),
  useFetchTipiExport: () => ({ data: [] }),
  useFetchFormati: () => ({ data: [] }),
}));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { getUrl: () => "" } }));

import ContenutiDigitali from ".";

const ultimaChiamata = () => finti.chiamate.at(-1)!;

// Come il servizio: totalItems conta i file, totalPages = totalItems / pageSize
const conPagine = (totalPages: number) => ({
  totalItems: totalPages * 10,
  totalPages,
  currentPage: 1,
  pageSize: 10,
  promos: [{ id: "p1", nome: "Promo", validita_dal: "", validita_al: "", stato: "VALIDA", kits: [{ id: "k1", nome: "Kit", files: [{ nome: "volantino.pdf" }] }] }],
});

describe("Contenuti digitali", () => {
  beforeEach(() => {
    finti.chiamate = [];
    finti.query = { data: conPagine(3), isLoading: false, isError: false, error: null, refetch: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("la ricerca filtra per nome dopo 300 ms dall'ultima battuta e torna alla prima pagina", () => {
    vi.useFakeTimers();
    render(<ContenutiDigitali />);

    fireEvent.click(screen.getByText("2"));
    expect(ultimaChiamata().page).toBe(2);

    fireEvent.change(screen.getByLabelText("Cerca contenuti"), { target: { value: "  volantino " } });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(ultimaChiamata().filters.nome).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(ultimaChiamata().filters.nome).toBe("volantino");
    expect(ultimaChiamata().page).toBe(1);
  });

  it("Reset svuota anche il testo della ricerca", async () => {
    render(<ContenutiDigitali />);
    const cerca = screen.getByLabelText("Cerca contenuti");

    fireEvent.change(cerca, { target: { value: "locandina" } });
    await vi.waitFor(() => expect(ultimaChiamata().filters.nome).toBe("locandina"));

    fireEvent.click(screen.getByRole("button", { name: /Filtra/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Reset/ }));

    expect(cerca).toHaveValue("");
    expect(ultimaChiamata().filters.nome).toBe("");
  });

  it("se il caricamento fallisce mostra il motivo e Riprova ricarica", () => {
    const refetch = vi.fn();
    finti.query = { data: undefined, isLoading: false, isError: true, error: new Error("Olimpo non raggiungibile"), refetch };
    render(<ContenutiDigitali />);

    expect(screen.getByRole("alert")).toHaveTextContent("Olimpo non raggiungibile");
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("i comandi di paginazione con sola icona hanno un nome", () => {
    render(<ContenutiDigitali />);

    for (const nome of ["Prima pagina", "Pagina precedente", "Pagina successiva", "Ultima pagina"]) {
      expect(screen.getByLabelText(nome)).toBeInTheDocument();
    }
  });

  it("non mostra il menu Scarica vuoto e il contatore dei filtri conta quelli scelti", async () => {
    render(<ContenutiDigitali />);

    expect(screen.queryByRole("button", { name: /^Scarica\b(?! volantino)/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtra" })).not.toHaveTextContent(/X|\d/);

    fireEvent.click(screen.getByRole("button", { name: "Filtra" }));
    fireEvent.change(await screen.findByLabelText("Area"), { target: { value: "a1" } });

    expect(ultimaChiamata().filters.idArea).toBe("a1");
    expect(screen.getByRole("button", { name: /^Filtra\s*1 filtri attivi$/ })).toBeInTheDocument();
  });

  it("i contenuti si scaricano con un comando che ne dice il nome", () => {
    render(<ContenutiDigitali />);

    expect(screen.getByRole("button", { name: "Scarica volantino.pdf" })).toBeInTheDocument();
    expect(screen.getByText("Mostrati 1–10 di 30")).toBeInTheDocument();
  });
});
