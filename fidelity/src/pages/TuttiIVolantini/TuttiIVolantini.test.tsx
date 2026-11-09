// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  permessi: new Set<string>(),
  insights: {} as Record<string, unknown>,
  configurazione: {} as Record<string, unknown>,
  confronti: {} as Record<string, unknown>,
  file: {} as Record<string, unknown>,
  richiestaFile: null as { idKit: string; abilitata?: boolean } | null,
  idKitRichiesti: [] as string[],
  idKitConfronti: [] as Array<string | undefined>,
  /** Le prop ricevute dal visualizzatore all'ultimo disegno. */
  propVolantino: [] as string[],
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
vi.mock("@/query/flyerInsights", () => ({
  useConfrontiVolantino: (idKit: string | undefined) => {
    finti.idKitConfronti.push(idKit);
    return finti.confronti;
  },
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
// Il report PDF lo disegna il suo componente (con i suoi test): qui conta dove sta e cosa riceve
vi.mock("@/components/FlyerInsights/report", () => ({
  ScaricaReportPdf: ({ idKit, titolo, disabled }: { idKit: string; titolo: string; disabled?: boolean }) => (
    <button type="button" disabled={disabled}>
      Report PDF di {idKit}: {titolo}
    </button>
  ),
}));
vi.mock("@/components/FlyerInsights", () => ({
  FlyerInsights: ({ insights, paginaSelezionata }: { insights: { guidIdKitRuntime: string } | null; paginaSelezionata?: number }) => (
    <div>Insight {insights?.guidIdKitRuntime ?? "vuoti"} pagina {paginaSelezionata ?? "tutte"}</div>
  ),
}));
// Sintesi, visualizzatore e confronti hanno i loro test: qui conta cosa la pagina passa loro
vi.mock("@/components/FlyerInsights/analisi", () => ({
  SintesiInsight: ({
    sintesi,
    confronto,
    caricamentoConfronto,
  }: {
    sintesi: { referenze: number };
    confronto?: { edizione: { titolo: string } } | null;
    caricamentoConfronto?: boolean;
  }) => (
    <p>
      Sintesi di {sintesi.referenze} referenze, confronto{" "}
      {caricamentoConfronto ? "in caricamento" : confronto === undefined ? "non richiesto" : (confronto?.edizione.titolo ?? "prima edizione")}
    </p>
  ),
}));
vi.mock("@/components/FlyerInsights/volantino", () => ({
  VolantinoSfogliabile: (props: {
    idKit: string;
    pagina?: number;
    idBoxIniziale?: string | null;
    box: unknown[];
    onCambiaPagina?: (pagina: number) => void;
  }) => {
    const { idKit, pagina, idBoxIniziale, box, onCambiaPagina } = props;
    finti.propVolantino = Object.keys(props);
    return (
      <div>
        <p>
          Volantino {idKit} pagina {pagina ?? "nessuna"} box iniziale {idBoxIniziale ?? "nessuno"} box {box.length}
        </p>
        <button type="button" onClick={() => onCambiaPagina?.((pagina ?? 1) + 2)}>
          Pagine successive
        </button>
      </div>
    );
  },
}));
vi.mock("@/components/FlyerInsights/confronti", async () => {
  // Il collegamento all'edizione precedente deve navigare davvero nel router del test
  const { Link } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ConfrontoEdizione: ({
      confronto,
      caricamento,
      errore,
      onRiprova,
    }: {
      confronto: { edizione: { idKit: string; titolo: string } } | null;
      caricamento?: boolean;
      errore?: string | null;
      onRiprova?: () => void;
    }) => (
      <div>
        <p>Edizione precedente: {errore ?? (caricamento ? "in caricamento" : (confronto?.edizione.titolo ?? "nessuna"))}</p>
        {confronto && <Link to={`/volantini/tutti_i_volantini?kit=${confronto.edizione.idKit}`}>Apri {confronto.edizione.titolo}</Link>}
        {errore && (
          <button type="button" onClick={onRiprova}>
            Riprova i confronti
          </button>
        )}
      </div>
    ),
    DifferenzeVarianti: ({ idKit, varianti, caricamento }: { idKit: string; varianti: Array<{ idKit: string }>; caricamento?: boolean }) => (
      <p>
        Varianti di {idKit}: {caricamento ? "in caricamento" : varianti.map((variante) => variante.idKit).join(", ") || "nessuna"}
      </p>
    ),
  };
});
vi.mock("@/components/ReferenzeInVolantinoBox", () => ({
  default: ({ ricercaIniziale }: { ricercaIniziale?: string }) => <div>Referenze: {ricercaIniziale || "tutte"}</div>,
}));

import TuttiIVolantini from ".";

const box = (id: string, pagina: number, nome: string, idReferenze: string[]) => ({
  id,
  codiceBox: id,
  pagina,
  geometria: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
  spazio: 4,
  proporzionePagina: 0.7,
  chiave: `c-${id}`,
  nome,
  marca: null,
  formato: null,
  prezzo: 1.99,
  barrato: null,
  sconto: null,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: null,
  meccanicaOriginale: null,
  reparto: null,
  foto: [],
  prodotti: idReferenze.length,
  idReferenze,
});

const datiInsight = {
  guidIdKitRuntime: "k1",
  contesto: { titolo: "Volantino ottobre", nomeArea: "Nord", nomeCanale: "Super", idPromo: "p1" },
  totaleReferenze: 3,
  totalePagine: 8,
  riepilogoPagine: [],
  riepilogoReparti: [{ sigla: "LS", descrizione: "Latticini", numeroReferenze: 1, pagine: [2] }],
  riepilogoMeccaniche: [],
  referenze: [{ id: "r1", reparto: "LS", descrizioneReparto: "Latticini", posizione: null }],
  pdf: { idOlimpoCloud: "olimpo-1", pagine: 8 },
  box: [box("b1", 1, "Latte intero", ["r1"]), box("b2", 2, "Yogurt bianco", ["r6", "r7"]), box("b3", 5, "Mozzarella Granarolo", ["r9"])],
  sintesi: { referenze: 3, box: 3, pagine: 8 },
};

const caricato = (data: unknown) => ({ data, isLoading: false, isError: false, error: null, refetch: vi.fn() });
const inCaricamento = () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() });
const fallito = (messaggio: string) => ({ data: undefined, isLoading: false, isError: true, error: new Error(messaggio), refetch: vi.fn() });

const confrontiCompleti = {
  edizionePrecedente: { edizione: { idKit: "k0", titolo: "Volantino settembre" } },
  varianti: [{ idKit: "k2" }, { idKit: "k3" }],
};

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
    finti.confronti = caricato(confrontiCompleti);
    finti.file = caricato({ id: "k1", titolo: "Volantino ottobre", file: [] });
    finti.richiestaFile = null;
    finti.idKitRichiesti = [];
    finti.idKitConfronti = [];
    finti.propVolantino = [];
    finti.scarica.mockReset();
  });

  it("usa il kit dell'indirizzo e mostra contesto, pagina e referenza negli insight condivisi", () => {
    apri("/volantini/tutti_i_volantini?kit=k1&pagina=2&referenza=Mozzarella+Granarolo");

    expect(finti.idKitRichiesti.at(-1)).toBe("k1");
    expect(finti.idKitConfronti.at(-1)).toBe("k1");
    expect(screen.getByRole("heading", { level: 1, name: "Volantino ottobre" })).toBeInTheDocument();
    expect(screen.getByText("Nord · Super")).toBeInTheDocument();
    expect(screen.getByText("Insight k1 pagina 2")).toBeInTheDocument();
    expect(screen.getByText("Referenze: Mozzarella Granarolo")).toBeInTheDocument();
  });

  it("mette le sezioni nell'ordine: sintesi, volantino, insight, confronti, file", async () => {
    finti.permessi.add("materiali.scarica");
    apri();

    expect(await screen.findByText("Edizione precedente: Volantino settembre")).toBeInTheDocument();
    const titoli = screen.getAllByRole("heading", { level: 2 }).map((titolo) => titolo.textContent);
    expect(titoli).toEqual(["In sintesi", "Il volantino", "Insight del volantino", "Confronti", "File del volantino"]);
  });

  it("passa al visualizzatore PDF, box, pagina di ?pagina e box di ?referenza cercato per id, senza mappa di calore né vendite", () => {
    apri("/volantini/tutti_i_volantini?kit=k1&pagina=2&referenza=r7");

    expect(screen.getByText("Volantino k1 pagina 2 box iniziale b2 box 3")).toBeInTheDocument();
    expect(finti.propVolantino).toContain("pdf");
    for (const tolta of ["calore", "rendimento", "previsione", "pesi"]) expect(finti.propVolantino).not.toContain(tolta);
  });

  it("senza ?pagina apre la pagina del box della referenza, cercata anche per nome stampato", () => {
    apri("/volantini/tutti_i_volantini?kit=k1&referenza=mozzarella%20%20granarolo");

    expect(screen.getByText("Volantino k1 pagina 5 box iniziale b3 box 3")).toBeInTheDocument();
  });

  it("con una referenza che non è in nessun box parte dalla prima pagina senza box aperto", () => {
    apri("/volantini/tutti_i_volantini?kit=k1&referenza=inesistente&pagina=abc");

    expect(screen.getByText("Volantino k1 pagina 1 box iniziale nessuno box 3")).toBeInTheDocument();
  });

  it("sfogliando il visualizzatore la pagina scelta vince su quella dell'indirizzo", () => {
    apri("/volantini/tutti_i_volantini?kit=k1&pagina=2");

    fireEvent.click(screen.getByRole("button", { name: "Pagine successive" }));
    expect(screen.getByText(/^Volantino k1 pagina 4 /)).toBeInTheDocument();
  });

  it("aprendo l'edizione precedente riparte dal suo kit e dalla prima pagina", async () => {
    apri("/volantini/tutti_i_volantini?kit=k1");

    fireEvent.click(screen.getByRole("button", { name: "Pagine successive" }));
    expect(screen.getByText(/^Volantino k1 pagina 3 /)).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("link", { name: "Apri Volantino settembre" }));
    expect(finti.idKitRichiesti.at(-1)).toBe("k0");
    expect(screen.getByText(/^Volantino k0 pagina 1 /)).toBeInTheDocument();
  });

  it("passa la sintesi con l'edizione precedente e le varianti ai confronti", async () => {
    apri();

    expect(screen.getByText("Sintesi di 3 referenze, confronto Volantino settembre")).toBeInTheDocument();
    expect(await screen.findByText("Edizione precedente: Volantino settembre")).toBeInTheDocument();
    expect(screen.getByText("Varianti di k1: k2, k3")).toBeInTheDocument();
  });

  it("per la prima edizione di area e canale la sintesi riceve null e i confronti nessuna edizione", async () => {
    finti.confronti = caricato({ edizionePrecedente: null, varianti: [] });
    apri();

    expect(screen.getByText("Sintesi di 3 referenze, confronto prima edizione")).toBeInTheDocument();
    expect(await screen.findByText("Edizione precedente: nessuna")).toBeInTheDocument();
    expect(screen.getByText("Varianti di k1: nessuna")).toBeInTheDocument();
  });

  it("mentre i confronti caricano mostra già sintesi e volantino", async () => {
    finti.confronti = inCaricamento();
    apri();

    expect(screen.getByText("Sintesi di 3 referenze, confronto in caricamento")).toBeInTheDocument();
    expect(screen.getByText(/^Volantino k1 pagina 1 /)).toBeInTheDocument();
    expect(await screen.findByText("Edizione precedente: in caricamento")).toBeInTheDocument();
    expect(screen.getByText("Varianti di k1: in caricamento")).toBeInTheDocument();
  });

  it("se i confronti falliscono lo dice nella loro sezione, permette di riprovare e lascia il resto della pagina", async () => {
    const confronti = fallito("Servizio non raggiungibile");
    finti.confronti = confronti;
    apri();

    expect(await screen.findByText("Edizione precedente: Servizio non raggiungibile")).toBeInTheDocument();
    expect(screen.queryByText(/^Varianti di/)).not.toBeInTheDocument();
    expect(screen.getByText("Sintesi di 3 referenze, confronto non richiesto")).toBeInTheDocument();
    expect(screen.getByText("Insight k1 pagina tutte")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Riprova i confronti" }));
    expect(confronti.refetch).toHaveBeenCalled();
  });

  it("se gli insight non arrivano mostra l'errore con Riprova e nessuna sezione", () => {
    const insights = fallito("Volantino non trovato");
    finti.insights = insights;
    apri();

    expect(screen.getByText("Insight non caricati")).toBeInTheDocument();
    expect(screen.getByText("Volantino non trovato")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Riprova/ }));
    expect(insights.refetch).toHaveBeenCalled();
  });

  it("mentre gli insight caricano non mostra sintesi, volantino né confronti", () => {
    finti.insights = inCaricamento();
    apri();

    expect(screen.queryByText(/^Sintesi di/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Volantino k1/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Confronti" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Insight del volantino" })).toBeInTheDocument();
  });

  it("senza PDF né box non mostra il visualizzatore ma tiene insight e confronti", async () => {
    finti.insights = caricato({ ...datiInsight, pdf: null, box: [] });
    apri();

    expect(screen.queryByRole("heading", { level: 2, name: "Il volantino" })).not.toBeInTheDocument();
    expect(screen.getByText("Insight k1 pagina tutte")).toBeInTheDocument();
    expect(await screen.findByText("Edizione precedente: Volantino settembre")).toBeInTheDocument();
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
    expect(finti.idKitConfronti.at(-1)).toBeUndefined();
    expect(screen.queryByRole("button", { name: /^Report PDF/ })).not.toBeInTheDocument();
  });
});

describe("Dettaglio insight del volantino: report PDF", () => {
  beforeEach(() => {
    finti.permessi = new Set(["materiali.visualizza"]);
    finti.insights = caricato(datiInsight);
    finti.configurazione = caricato({});
    finti.confronti = caricato(confrontiCompleti);
    finti.file = caricato({ id: "k1", titolo: "Volantino ottobre", file: [] });
  });

  it("il report PDF sta nell'intestazione con kit e titolo; resta disabilitato finché gli insight non arrivano", () => {
    apri();
    expect(screen.getByRole("button", { name: "Report PDF di k1: Volantino ottobre" })).toBeEnabled();
  });

  it("mentre gli insight caricano il report non si può scaricare", () => {
    finti.insights = inCaricamento();
    apri();

    expect(screen.getByRole("button", { name: "Report PDF di k1: Dettaglio volantino" })).toBeDisabled();
  });

  it("se gli insight non arrivano non c'è il report", () => {
    finti.insights = fallito("Volantino non trovato");
    apri();

    expect(screen.queryByRole("button", { name: /^Report PDF/ })).not.toBeInTheDocument();
  });

  it("accanto al report niente rendimento, previsione né simulazione", () => {
    apri();

    expect(screen.getByRole("button", { name: /^Report PDF/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /Rendimento|Previsione|Simulazione/ })).not.toBeInTheDocument();
  });
});
