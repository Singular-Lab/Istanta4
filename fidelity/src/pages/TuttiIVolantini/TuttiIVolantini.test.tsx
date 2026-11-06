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
  richiestaFile: null as { idKit: string; abilitata?: boolean } | null,
  idKitRichiesti: [] as string[],
  scarica: vi.fn(),
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
// I file arrivano dalle API di consultazione: solo quelli del kit pubblicato della GDO
vi.mock("@/query/consultazione", () => ({
  useVolantinoConsultazione: (idKit: string, abilitata?: boolean) => {
    finti.richiestaFile = { idKit, abilitata };
    return finti.file;
  },
}));
vi.mock("@/utils/scaricaFileConsultazione", () => ({
  useScaricaFileConsultazione: () => ({ inCorso: null, scarica: finti.scarica }),
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
    finti.file = caricato({ id: "k1", titolo: "Volantino ottobre", file: [] });
    finti.richiestaFile = null;
    finti.idKitRichiesti = [];
    finti.scarica.mockReset();
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

    expect(finti.richiestaFile).toEqual({ idKit: "k1", abilitata: false });
    expect(screen.getByText(/Per scaricare i file serve il permesso di scaricare volantini e POP/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "File del volantino" })).not.toBeInTheDocument();
  });

  it("con materiali.scarica mostra, filtra e scarica dalla consultazione i file pubblicati", () => {
    finti.permessi.add("materiali.scarica");
    finti.file = caricato({
      id: "k1",
      titolo: "Volantino ottobre",
      file: [
        { id: "f1", nome: "Roma.pdf", tipoExport: "VOL", mime: "application/pdf", pagine: 8, anteprima: "/mini/roma" },
        { id: "f2", nome: "MILANO.pdf", tipoExport: "VOL", mime: "application/pdf", pagine: 8, anteprima: null },
      ],
    });
    apri();

    expect(finti.richiestaFile).toEqual({ idKit: "k1", abilitata: true });
    fireEvent.change(screen.getByRole("searchbox", { name: "Cerca file" }), { target: { value: "milano" } });
    expect(screen.getByText("MILANO.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Roma.pdf")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Scarica PDF" }));
    expect(finti.scarica).toHaveBeenCalledWith("f2", "MILANO.pdf");
  });

  it("senza parametro kit segnala l'indirizzo incompleto", () => {
    apri("/volantini/tutti_i_volantini");

    expect(screen.getByText("Volantino non indicato")).toBeInTheDocument();
  });
});
