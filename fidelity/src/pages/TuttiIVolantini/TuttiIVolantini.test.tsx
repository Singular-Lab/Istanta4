// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  permessi: new Set<string>(),
  insights: {} as Record<string, unknown>,
  configurazione: {} as Record<string, unknown>,
  confronti: {} as Record<string, unknown>,
  rendimento: {} as Record<string, unknown>,
  previsione: {} as Record<string, unknown>,
  file: {} as Record<string, unknown>,
  richiestaFile: null as { idKit: string; abilitata?: boolean } | null,
  idKitRichiesti: [] as string[],
  idKitConfronti: [] as Array<string | undefined>,
  idKitRendimento: [] as Array<string | undefined>,
  idKitPrevisione: [] as Array<string | undefined>,
  /** "Vendite e previsioni" della GDO: accesa salvo i test che la spengono. */
  venditeAttive: true,
  scarica: vi.fn(),
}));

/** Una query disabilitata, come la restituisce TanStack Query quando enabled è false. */
const spenta = () => ({ data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() });

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: (permesso: string) => finti.permessi.has(permesso) }));
vi.mock("@/query/query", () => ({
  useFetchFlyerInsights: (idKit: string) => {
    finti.idKitRichiesti.push(idKit);
    return finti.insights;
  },
  useFetchFlyerInsightsConfig: () => finti.configurazione,
  useFetchFunzionalita: () => ({ data: { momenti: false, menabo: false, vendite: finti.venditeAttive }, isLoading: false, isError: false }),
}));
vi.mock("@/query/flyerInsights", () => ({
  useConfrontiVolantino: (idKit: string | undefined) => {
    finti.idKitConfronti.push(idKit);
    return finti.confronti;
  },
  useRendimentoVolantino: (idKit: string | undefined, attiva = true) => {
    finti.idKitRendimento.push(idKit);
    return attiva ? finti.rendimento : spenta();
  },
  usePrevisioneVolantino: (idKit: string | undefined, attiva = true) => {
    finti.idKitPrevisione.push(idKit);
    return attiva ? finti.previsione : spenta();
  },
}));
// Il report PDF lo disegna il suo componente (con i suoi test): qui conta dove sta e cosa riceve
vi.mock("@/components/FlyerInsights/report", () => ({
  ScaricaReportPdf: ({ idKit, titolo, disabled }: { idKit: string; titolo: string; disabled?: boolean }) => (
    <button type="button" disabled={disabled}>
      Report PDF di {idKit}: {titolo}
    </button>
  ),
}));
vi.mock("@/components/FlyerInsights/simulazione", () => ({
  SimulatoreProdotto: ({ idKit, box, totalePagine }: { idKit: string; box: unknown[]; totalePagine: number }) => (
    <p>
      Simulatore di {idKit} con {box.length} box su {totalePagine} pagine
    </p>
  ),
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
type StatoBlocco = { caricamento?: boolean; errore?: string | null; onRiprova?: () => void; box: unknown[] };

// Sintesi, rendimento, previsione, visualizzatore e confronti hanno i loro test: qui conta cosa la pagina passa loro
vi.mock("@/components/FlyerInsights/analisi", () => ({
  Rendimento: ({
    rendimento,
    caricamento,
    errore,
    onRiprova,
    box,
    percorsoVendite,
  }: StatoBlocco & { rendimento?: { puntiVendita: number } | null; percorsoVendite?: string }) => (
    <div>
      <p>
        Rendimento: {errore ?? (caricamento ? "in caricamento" : rendimento === null ? "nessuna vendita" : `${rendimento?.puntiVendita} punti vendita`)} su{" "}
        {box.length} box
      </p>
      <p>Pagina delle vendite: {percorsoVendite ?? "non accessibile"}</p>
      {errore && (
        <button type="button" onClick={onRiprova}>
          Riprova il rendimento
        </button>
      )}
    </div>
  ),
  Previsione: ({ previsione, caricamento, errore, onRiprova, box }: StatoBlocco & { previsione?: { tipo: string } | null }) => (
    <div>
      <p>
        Previsione: {errore ?? (caricamento ? "in caricamento" : (previsione?.tipo ?? "nessuna"))} su {box.length} box
      </p>
      {errore && (
        <button type="button" onClick={onRiprova}>
          Riprova la previsione
        </button>
      )}
    </div>
  ),
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
  VolantinoSfogliabile: ({
    idKit,
    pagina,
    idBoxIniziale,
    rendimento,
    previsione,
    pesi,
    box,
    onCambiaPagina,
  }: {
    idKit: string;
    pagina?: number;
    idBoxIniziale?: string | null;
    rendimento?: unknown;
    previsione?: unknown;
    pesi?: { altre: number };
    box: unknown[];
    onCambiaPagina?: (pagina: number) => void;
  }) => (
    <div>
      <p>
        Volantino {idKit} pagina {pagina ?? "nessuna"} box iniziale {idBoxIniziale ?? "nessuno"} box {box.length} vendite {rendimento ? "sì" : "no"}{" "}
        previsione {previsione ? "sì" : "no"} pesi {pesi ? `altre ${pesi.altre}` : "nessuno"}
      </p>
      <button type="button" onClick={() => onCambiaPagina?.((pagina ?? 1) + 2)}>
        Pagine successive
      </button>
    </div>
  ),
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
  visibilita: 50,
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
  zoneCalde: { calore: [], pesi: { copertina: 1, ultima: 0.8, primaDoppia: 0.7, altre: 0.4, alto: 1, basso: 0.6 } },
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
    finti.venditeAttive = true;
    finti.permessi = new Set(["materiali.visualizza"]);
    finti.insights = caricato(datiInsight);
    finti.configurazione = caricato({});
    finti.confronti = caricato(confrontiCompleti);
    // Di norma il cliente non ha importato vendite e la previsione è teorica
    finti.rendimento = caricato(null);
    finti.previsione = caricato({ tipo: "teorica" });
    finti.file = caricato({ id: "k1", titolo: "Volantino ottobre", file: [] });
    finti.richiestaFile = null;
    finti.idKitRichiesti = [];
    finti.idKitConfronti = [];
    finti.idKitRendimento = [];
    finti.idKitPrevisione = [];
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

  it("mette le sezioni nell'ordine: sintesi, volantino, rendimento e previsione, simulazione, insight, confronti, file", async () => {
    finti.permessi.add("materiali.scarica");
    apri();

    expect(await screen.findByText("Edizione precedente: Volantino settembre")).toBeInTheDocument();
    const titoli = screen.getAllByRole("heading", { level: 2 }).map((titolo) => titolo.textContent);
    expect(titoli).toEqual([
      "In sintesi",
      "Il volantino",
      "Rendimento e previsione",
      "Simulazione",
      "Insight del volantino",
      "Confronti",
      "File del volantino",
    ]);
  });

  it("passa al visualizzatore PDF, box, vendite, previsione, pesi, pagina di ?pagina e box di ?referenza cercato per id", () => {
    apri("/volantini/tutti_i_volantini?kit=k1&pagina=2&referenza=r7");

    expect(screen.getByText("Volantino k1 pagina 2 box iniziale b2 box 3 vendite no previsione sì pesi altre 0.4")).toBeInTheDocument();
  });

  it("senza ?pagina apre la pagina del box della referenza, cercata anche per nome stampato", () => {
    apri("/volantini/tutti_i_volantini?kit=k1&referenza=mozzarella%20%20granarolo");

    expect(screen.getByText(/^Volantino k1 pagina 5 box iniziale b3 box 3 /)).toBeInTheDocument();
  });

  it("con una referenza che non è in nessun box parte dalla prima pagina senza box aperto", () => {
    apri("/volantini/tutti_i_volantini?kit=k1&referenza=inesistente&pagina=abc");

    expect(screen.getByText(/^Volantino k1 pagina 1 box iniziale nessuno box 3 /)).toBeInTheDocument();
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
    expect(finti.idKitRendimento.at(-1)).toBeUndefined();
    expect(finti.idKitPrevisione.at(-1)).toBeUndefined();
    expect(screen.queryByRole("button", { name: /^Report PDF/ })).not.toBeInTheDocument();
  });
});

describe("Dettaglio insight del volantino: rendimento, previsione, simulazione e report", () => {
  beforeEach(() => {
    finti.venditeAttive = true;
    finti.permessi = new Set(["materiali.visualizza"]);
    finti.insights = caricato(datiInsight);
    finti.configurazione = caricato({});
    finti.confronti = caricato(confrontiCompleti);
    finti.rendimento = caricato({ puntiVendita: 42 });
    finti.previsione = caricato({ tipo: "vendite" });
    finti.file = caricato({ id: "k1", titolo: "Volantino ottobre", file: [] });
    finti.idKitRendimento = [];
    finti.idKitPrevisione = [];
  });

  it("chiede rendimento e previsione del kit e li passa al visualizzatore e ai loro blocchi", () => {
    apri();

    expect(finti.idKitRendimento.at(-1)).toBe("k1");
    expect(finti.idKitPrevisione.at(-1)).toBe("k1");
    expect(screen.getByText(/^Volantino k1 pagina 1 box iniziale nessuno box 3 vendite sì previsione sì/)).toBeInTheDocument();
    const sezione = screen.getByRole("region", { name: "Rendimento e previsione" });
    expect(within(sezione).getByText("Rendimento: 42 punti vendita su 3 box")).toBeInTheDocument();
    expect(within(sezione).getByText("Previsione: vendite su 3 box")).toBeInTheDocument();
  });

  it("senza vendite importate il blocco del rendimento riceve null; il rimando alla pagina Vendite solo a chi può importarle", () => {
    finti.rendimento = caricato(null);
    const { unmount } = apri();

    expect(screen.getByText("Rendimento: nessuna vendita su 3 box")).toBeInTheDocument();
    expect(screen.getByText(/ vendite no previsione sì/)).toBeInTheDocument();
    expect(screen.getByText("Pagina delle vendite: non accessibile")).toBeInTheDocument();
    unmount();

    finti.permessi.add("analisi.importa_vendite");
    apri();
    expect(screen.getByText("Pagina delle vendite: /analisi/vendite")).toBeInTheDocument();
  });

  it("mentre rendimento e previsione caricano il resto della pagina c'è già", () => {
    finti.rendimento = inCaricamento();
    finti.previsione = inCaricamento();
    apri();

    expect(screen.getByText("Rendimento: in caricamento su 3 box")).toBeInTheDocument();
    expect(screen.getByText("Previsione: in caricamento su 3 box")).toBeInTheDocument();
    expect(screen.getByText(/ vendite no previsione no/)).toBeInTheDocument();
    expect(screen.getByText("Sintesi di 3 referenze, confronto Volantino settembre")).toBeInTheDocument();
    expect(screen.getByText("Insight k1 pagina tutte")).toBeInTheDocument();
  });

  it("se rendimento o previsione falliscono lo dicono nel loro blocco, si può riprovare e il resto resta", () => {
    const rendimento = fallito("Vendite non raggiungibili");
    const previsione = fallito("");
    finti.rendimento = rendimento;
    finti.previsione = previsione;
    apri();

    expect(screen.getByText("Rendimento: Vendite non raggiungibili su 3 box")).toBeInTheDocument();
    // Senza un messaggio dal servizio, quello predefinito
    expect(screen.getByText("Previsione: Non è stato possibile caricare la previsione del volantino. su 3 box")).toBeInTheDocument();
    expect(screen.getByText(/^Volantino k1 pagina 1 /)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Riprova il rendimento" }));
    expect(rendimento.refetch).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Riprova la previsione" }));
    expect(previsione.refetch).toHaveBeenCalled();
  });

  it("il simulatore si carica a parte, con i box e le pagine del volantino", async () => {
    apri();

    const sezione = screen.getByRole("region", { name: "Simulazione" });
    expect(await within(sezione).findByText("Simulatore di k1 con 3 box su 8 pagine")).toBeInTheDocument();
  });

  it("senza previsione (null, per esempio nessun box con geometria) restano solo le vendite: niente previsione né simulazione", () => {
    finti.previsione = caricato(null);
    apri();

    const sezione = screen.getByRole("region", { name: "Rendimento" });
    expect(within(sezione).getByText(/^Rendimento: /)).toBeInTheDocument();
    expect(screen.queryByText(/^Previsione: /)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Rendimento e previsione" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Simulazione" })).not.toBeInTheDocument();
  });

  it("con Vendite e previsioni spenta per la GDO niente rendimento, previsione, simulazione né misure di vendita", () => {
    finti.venditeAttive = false;
    apri();

    expect(screen.queryByText(/^Rendimento: /)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Previsione: /)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /^Rendimento/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Simulazione" })).not.toBeInTheDocument();
    expect(screen.getByText(/ vendite no previsione no/)).toBeInTheDocument();
    expect(screen.getByText("Insight k1 pagina tutte")).toBeInTheDocument();
  });

  it("senza box non mostra rendimento, previsione né simulazione", () => {
    finti.insights = caricato({ ...datiInsight, box: [] });
    apri();

    expect(screen.queryByRole("heading", { level: 2, name: "Rendimento e previsione" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Simulazione" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Il volantino" })).toBeInTheDocument();
  });

  it("il report PDF sta nell'intestazione con kit e titolo; resta disabilitato finché gli insight non arrivano", () => {
    apri();
    expect(screen.getByRole("button", { name: "Report PDF di k1: Volantino ottobre" })).toBeEnabled();
  });

  it("mentre gli insight caricano il report non si può scaricare", () => {
    finti.insights = inCaricamento();
    apri();

    expect(screen.getByRole("button", { name: "Report PDF di k1: Dettaglio volantino" })).toBeDisabled();
    expect(screen.queryByRole("heading", { level: 2, name: "Rendimento e previsione" })).not.toBeInTheDocument();
  });

  it("se gli insight non arrivano non c'è il report", () => {
    finti.insights = fallito("Volantino non trovato");
    apri();

    expect(screen.queryByRole("button", { name: /^Report PDF/ })).not.toBeInTheDocument();
  });
});
