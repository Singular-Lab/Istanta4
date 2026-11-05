// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  permessi: new Set<string>(),
  insights: {} as Record<string, unknown>,
  configurazione: {} as Record<string, unknown>,
  file: {} as Record<string, unknown>,
  opzioniFile: null as Record<string, unknown> | null,
  idKitRichiesti: [] as string[],
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: (permesso: string) => finti.permessi.has(permesso) }));
vi.mock("@/query/query", () => ({
  useFetchFlyerInsights: (idKit: string) => {
    finti.idKitRichiesti.push(idKit);
    return finti.insights;
  },
  useFetchFlyerInsightsConfig: () => finti.configurazione,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (opzioni: Record<string, unknown>) => {
    finti.opzioniFile = opzioni;
    return finti.file;
  },
}));
vi.mock("@/components/FlyerInsights", () => ({
  FlyerInsights: ({ insights, paginaSelezionata }: { insights: { guidIdKitRuntime: string } | null; paginaSelezionata?: number }) => (
    <div>Insight {insights?.guidIdKitRuntime ?? "vuoti"} pagina {paginaSelezionata ?? "tutte"}</div>
  ),
}));
vi.mock("@/components/ReferenzeInVolantinoBox", () => ({
  default: ({ ricercaIniziale }: { ricercaIniziale?: string }) => <div>Referenze: {ricercaIniziale || "tutte"}</div>,
}));

import TuttiIVolantini from ".";

const datiInsight = {
  guidIdKitRuntime: "k1",
  contesto: { titolo: "Volantino ottobre", nomeArea: "Nord", nomeCanale: "Super", idPromo: "p1" },
  totaleReferenze: 1,
  totalePagine: 8,
  riepilogoPagine: [],
  riepilogoReparti: [{ sigla: "LS", descrizione: "Latticini", numeroReferenze: 1, pagine: [2] }],
  riepilogoMeccaniche: [],
  referenze: [{ id: "r1", reparto: "LS", descrizioneReparto: "Latticini", posizione: null }],
};

const caricato = (data: unknown) => ({ data, isLoading: false, isError: false, error: null, refetch: vi.fn() });

const apri = (indirizzo = "/volantini/tutti_i_volantini?kit=k1") =>
  render(
    <MemoryRouter initialEntries={[indirizzo]}>
      <TuttiIVolantini />
    </MemoryRouter>
  );

describe("Dettaglio insight del volantino", () => {
  beforeEach(() => {
    finti.permessi = new Set(["materiali.visualizza"]);
    finti.insights = caricato(datiInsight);
    finti.configurazione = caricato({});
    finti.file = caricato({ titolo: "Volantino ottobre", files: [] });
    finti.opzioniFile = null;
    finti.idKitRichiesti = [];
  });

  it("usa il kit dell'indirizzo e mostra contesto, pagina e referenza negli insight condivisi", () => {
    apri("/volantini/tutti_i_volantini?kit=k1&pagina=2&referenza=Mozzarella+Granarolo");

    expect(finti.idKitRichiesti.at(-1)).toBe("k1");
    expect(screen.getByRole("heading", { level: 1, name: "Volantino ottobre" })).toBeInTheDocument();
    expect(screen.getByText("Nord · Super")).toBeInTheDocument();
    expect(screen.getByText("Insight k1 pagina 2")).toBeInTheDocument();
    expect(screen.getByText("Referenze: Mozzarella Granarolo")).toBeInTheDocument();
  });

  it("senza materiali.scarica lascia consultare gli insight e non abilita la richiesta dei file", () => {
    apri();

    expect(finti.opzioniFile).toMatchObject({ enabled: false });
    expect(screen.getByText(/Per scaricare i file serve il permesso di scaricare volantini e POP/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "File del volantino" })).not.toBeInTheDocument();
  });

  it("con materiali.scarica mostra e filtra i file pubblicati", () => {
    finti.permessi.add("materiali.scarica");
    finti.file = caricato({
      titolo: "Volantino ottobre",
      files: [
        { nome: "Roma.pdf", url: "/mini/roma", url_download: "/pdf/roma" },
        { nome: "Locandina.pdf", nome_originale: "MILANO.pdf", url: "/mini/milano", url_download: "/pdf/milano" },
      ],
    });
    apri();

    expect(finti.opzioniFile).toMatchObject({ enabled: true });
    fireEvent.change(screen.getByRole("searchbox", { name: "Cerca file" }), { target: { value: "milano" } });
    expect(screen.getByText("Locandina.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Roma.pdf")).not.toBeInTheDocument();
  });

  it("senza parametro kit segnala l'indirizzo incompleto", () => {
    apri("/volantini/tutti_i_volantini");

    expect(screen.getByText("Volantino non indicato")).toBeInTheDocument();
  });
});
