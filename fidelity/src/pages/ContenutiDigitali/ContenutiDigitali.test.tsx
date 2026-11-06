// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FiltriContenutiDigitali } from "../../../lib/consultazione/tipi";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Popover
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({
  query: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  chiamate: [] as FiltriContenutiDigitali[],
  permessiNegati: new Set<string>(),
  scarica: vi.fn(),
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { getUrl: () => "" } }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: (codice: string) => !finti.permessiNegati.has(codice) }));
// Elenco e filtri dalle API di consultazione: niente endpoint di gestione né "file.download"
vi.mock("@/query/consultazione", () => ({
  useContenutiDigitali: (filtri: FiltriContenutiDigitali) => {
    finti.chiamate.push(filtri);
    return finti.query;
  },
  useOpzioniContenutiDigitali: () => ({
    data: { promozioni: [], tipiExport: [], formati: [], aree: [{ id: "a1", nome: "Nord" }], canali: [] },
  }),
}));
vi.mock("@/utils/scaricaFileConsultazione", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/scaricaFileConsultazione")>()),
  useScaricaFileConsultazione: () => ({ inCorso: null, scarica: finti.scarica }),
}));

import ContenutiDigitali from ".";

const ultimaChiamata = () => finti.chiamate.at(-1)!;

const contenuto = {
  id: "f1",
  nome: "volantino.pdf",
  tipoExport: "PDF",
  mime: "application/pdf",
  pagine: 2,
  anteprima: null,
  kit: { id: "k1", titolo: "Kit" },
  promo: { id: "p1", nome: "Promo", validitaDal: null, validitaAl: null },
  area: { id: "a1", nome: "Nord" },
  canale: { id: "c1", nome: "Super" },
  formato: { id: "fo1", nome: "Cartello" },
};

// Come il servizio: una pagina di file e il totale dei file che corrispondono
const conTotale = (totale: number) => ({ file: [contenuto], totale, pagina: 1, dimensione: 10 });

describe("Contenuti digitali", () => {
  beforeEach(() => {
    finti.chiamate = [];
    finti.permessiNegati = new Set();
    finti.scarica.mockReset();
    finti.query = { data: conTotale(30), isLoading: false, isError: false, error: null, refetch: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("la ricerca parte dopo 300 ms dall'ultima battuta e torna alla prima pagina", () => {
    vi.useFakeTimers();
    render(<ContenutiDigitali />);

    fireEvent.click(screen.getByText("2"));
    expect(ultimaChiamata().pagina).toBe(2);

    fireEvent.change(screen.getByLabelText("Cerca contenuti"), { target: { value: "  volantino " } });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(ultimaChiamata().cerca).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(ultimaChiamata().cerca).toBe("volantino");
    expect(ultimaChiamata().pagina).toBe(1);
  });

  it("Reset svuota anche il testo della ricerca", async () => {
    render(<ContenutiDigitali />);
    const cerca = screen.getByLabelText("Cerca contenuti");

    fireEvent.change(cerca, { target: { value: "locandina" } });
    await vi.waitFor(() => expect(ultimaChiamata().cerca).toBe("locandina"));

    fireEvent.click(screen.getByRole("button", { name: /Filtra/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Reset/ }));

    expect(cerca).toHaveValue("");
    expect(ultimaChiamata().cerca).toBe("");
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

  it("i filtri propongono i valori dei contenuti consultabili e il contatore conta quelli scelti", async () => {
    render(<ContenutiDigitali />);

    expect(screen.getByRole("button", { name: "Filtra" })).not.toHaveTextContent(/X|\d/);

    fireEvent.click(screen.getByRole("button", { name: "Filtra" }));
    fireEvent.change(await screen.findByLabelText("Area"), { target: { value: "a1" } });

    expect(ultimaChiamata().idArea).toBe("a1");
    expect(ultimaChiamata().pagina).toBe(1);
    expect(screen.getByRole("button", { name: /^Filtra\s*1 filtri attivi$/ })).toBeInTheDocument();
  });

  it("i contenuti si scaricano dalla consultazione con un comando che ne dice il nome", () => {
    render(<ContenutiDigitali />);

    fireEvent.click(screen.getByRole("button", { name: "Scarica volantino.pdf" }));
    expect(finti.scarica).toHaveBeenCalledWith("f1", "volantino.pdf");
    expect(screen.getByText("Mostrati 1–10 di 30")).toBeInTheDocument();
  });

  it("senza materiali.scarica il download è disattivato e dice perché", () => {
    finti.permessiNegati = new Set(["materiali.scarica"]);
    render(<ContenutiDigitali />);

    const scarica = screen.getByRole("button", { name: "Scarica volantino.pdf" });
    expect(scarica).toBeDisabled();
    expect(scarica).toHaveAttribute("title", "Manca il permesso di scaricare volantini e POP");
  });
});
