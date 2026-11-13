// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, MemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fileInOrdine, NESSUN_FILE, SERVE_IL_PERMESSO } from "./ScaricaVolantino";
import { REPORT_DISATTIVATO } from "./index";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura del menu dei file
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({
  permessi: new Set<string>(),
  insights: {} as Record<string, unknown>,
  configurazione: {} as Record<string, unknown>,
  file: {} as Record<string, unknown>,
  richiestaFile: null as { idKit: string; abilitata?: boolean } | null,
  idKitRichiesti: [] as string[],
  /** Le prop ricevute dal visualizzatore all'ultimo disegno. */
  propVolantino: [] as string[],
  propAnalisi: null as { isLoading?: boolean } | null,
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
  // analisi.ts dei punti vendita legge la rete delle insegne solo nei suoi hook, qui non usati
  useFetchReteInsegne: () => ({ data: undefined }),
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
// Il report PDF lo disegna il suo componente (con i suoi test): qui conta dove sta e che è disattivato
vi.mock("@/components/FlyerInsights/report", () => ({
  ScaricaReportPdf: ({ idKit, titolo, disabled, motivoDisattivato }: { idKit: string; titolo: string; disabled?: boolean; motivoDisattivato?: string }) => (
    <button type="button" disabled={disabled || Boolean(motivoDisattivato)} title={motivoDisattivato}>
      Report PDF di {idKit}: {titolo}
    </button>
  ),
}));
// Le sezioni Reparti e Meccaniche e sconti hanno i loro test
vi.mock("@/components/FlyerInsights", () => ({
  FlyerInsights: (props: { insights: { guidIdKitRuntime: string } | null; isLoading?: boolean }) => {
    finti.propAnalisi = props;
    return <div data-testid="analisi">Analisi {props.isLoading ? "in caricamento" : (props.insights?.guidIdKitRuntime ?? "vuote")}</div>;
  },
}));
// Il visualizzatore ha i suoi test: qui conta cosa la pagina gli passa
vi.mock("@/components/FlyerInsights/volantino", () => ({
  ATTRIBUTO_LETTORE: "data-lettore-volantino",
  VolantinoSfogliabile: (props: {
    idKit: string;
    pagina?: number;
    idBoxIniziale?: string | null;
    apriBox?: { id: string; volta: number } | null;
    box: unknown[];
    onCambiaPagina?: (pagina: number) => void;
  }) => {
    const { idKit, pagina, idBoxIniziale, apriBox, box, onCambiaPagina } = props;
    finti.propVolantino = Object.keys(props);
    return (
      <div>
        <div data-lettore-volantino="" data-testid="barra-lettore" />
        <p>
          Volantino {idKit} pagina {pagina ?? "nessuna"} box iniziale {idBoxIniziale ?? "nessuno"} box {box.length}
        </p>
        <p>
          Box chiesto {apriBox ? `${apriBox.id} volta ${apriBox.volta}` : "nessuno"}
        </p>
        <button type="button" onClick={() => onCambiaPagina?.((pagina ?? 1) + 2)}>
          Pagine successive
        </button>
      </div>
    );
  },
}));

import TuttiIVolantini from ".";

const LATTICINI = { codice: "LS", descrizione: "Latticini" };

const box = (id: string, pagina: number, nome: string, idReferenze: string[], campi: Record<string, unknown> = {}) => ({
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
  reparto: LATTICINI,
  foto: [],
  prodotti: idReferenze.length,
  idReferenze,
  ...campi,
});

const LINEE = {
  quotaSpazio: 33.3,
  quotaBox: 33.3,
  box: 1,
  linee: [{ sigla: "SD", nome: "Sapori & Dintorni", colore: "#b45309", logo: null, box: 1, referenze: 1, quotaSpazio: 33.3, scontoMedio: null }],
  bolli: [{ sigla: "DOP", nome: "DOP", logo: null, box: 1 }],
};

const datiInsight = {
  guidIdKitRuntime: "k1",
  // Una promo già finita: lo stato non dipende dal giorno in cui girano i test
  contesto: { titolo: "Volantino ottobre", nomeArea: "Nord", nomeCanale: "Super", idPromo: "p1", validitaDal: "2020-01-01", validitaAl: "2020-01-14" },
  totaleReferenze: 4,
  totalePagine: 8,
  riepilogoPagine: [],
  riepilogoReparti: [],
  riepilogoMeccaniche: [],
  referenze: [
    { id: "r1", posizione: null },
    { id: "r6", descrizione: "Yogurt bianco", posizione: null },
    { id: "r7", descrizione: "Yogurt alla fragola", codiceReferenza: "778", prezzo: "0,89", posizione: null },
  ],
  pdf: { idOlimpoCloud: "olimpo-1", pagine: 8 },
  box: [
    box("b1", 1, "Latte intero", ["r1"], { meccanica: "fidelity" }),
    box("b2", 2, "Yogurt bianco", ["r6", "r7"], { meccanica: "sconto", sconto: 30, barrato: 2.85 }),
    box("b3", 5, "Mozzarella Granarolo", ["r9"], { sottocosto: true, marca: "Granarolo", linea: { sigla: "SD", nome: "Sapori & Dintorni" } }),
  ],
  sintesi: {
    referenze: 4,
    box: 3,
    pagine: 8,
    scontoMedio: 30,
    boxConSconto: 1,
    quotaFidelity: 33.3,
    sottocosto: 1,
    marche: 2,
    copertura: { prezzo: 100, marca: 100, reparto: 100, geometria: 100 },
  },
};

const caricato = (data: unknown) => ({ data, isLoading: false, isError: false, error: null, refetch: vi.fn() });
const inCaricamento = () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() });
const fallito = (messaggio: string) => ({ data: undefined, isLoading: false, isError: true, error: new Error(messaggio), refetch: vi.fn() });

const PUBBLICATO = { id: "k1", titolo: "Volantino ottobre", promo: { id: "p1", nome: "Ottobre", validitaDal: "2020-01-01", validitaAl: "2020-01-14" }, file: [] };

const apri = (indirizzo = "/volantini/tutti_i_volantini?kit=k1") =>
  render(
    <MemoryRouter initialEntries={[indirizzo]}>
      <TuttiIVolantini />
    </MemoryRouter>
  );

const titoliSezioni = () => screen.getAllByRole("heading", { level: 2 }).map((titolo) => titolo.textContent);
const numeri = () => screen.getByRole("region", { name: "Numeri del volantino" });
const numero = (etichetta: string) => within(numeri()).getByText(etichetta, { selector: "dt span" }).closest("[data-numero]") as HTMLElement;

describe("Dettaglio del volantino", () => {
  beforeEach(() => {
    finti.permessi = new Set(["materiali.visualizza"]);
    finti.insights = caricato(datiInsight);
    finti.configurazione = caricato({});
    finti.file = caricato(PUBBLICATO);
    finti.richiestaFile = null;
    finti.idKitRichiesti = [];
    finti.propVolantino = [];
    finti.propAnalisi = null;
    finti.scarica.mockReset();
  });

  it("intestazione compatta: insegna e area come titolo, periodo e stato del volantino dagli insight, con il report PDF disattivato e Scarica il volantino", () => {
    // Le date vengono dagli insight, non dalla consultazione
    finti.file = caricato(undefined);
    apri();

    expect(finti.idKitRichiesti.at(-1)).toBe("k1");
    // Il titolo tecnico del kit ("Volantino ottobre" nei dati di prova) non compare: insegna · area
    const titolo = screen.getByRole("heading", { level: 1, name: "Super · Nord" });
    expect(titolo).not.toHaveClass("title-page");
    expect(screen.queryByText("Volantino ottobre")).not.toBeInTheDocument();
    expect(screen.getByTitle("1 – 14 gennaio 2020")).toBeInTheDocument();
    expect(screen.getByTitle("Concluso")).toHaveAttribute("data-tono", "neutral");
    const report = screen.getByRole("button", { name: "Report PDF di k1: Super · Nord" });
    expect(report).toBeDisabled();
    expect(report).toHaveAttribute("title", REPORT_DISATTIVATO);
    // Accanto al report si scarica il PDF del volantino
    const scarica = screen.getByRole("button", { name: /Scarica il volantino/ });
    expect(report.parentElement).toContainElement(scarica);
  });

  it("senza le date negli insight (server non aggiornato) non c'è periodo né stato, ma il resto dell'intestazione sì", () => {
    finti.insights = caricato({ ...datiInsight, contesto: { titolo: "Volantino ottobre", nomeArea: "Nord", nomeCanale: "Super", idPromo: "p1" } });
    apri();

    expect(screen.getByRole("heading", { level: 1, name: "Super · Nord" })).toBeInTheDocument();
    expect(screen.queryByTitle(/gennaio/)).not.toBeInTheDocument();
    expect(screen.queryByTitle("Concluso")).not.toBeInTheDocument();
  });

  it("senza area il titolo è l'insegna; senza insegna né area non è mai il titolo tecnico del kit", () => {
    finti.insights = caricato({ ...datiInsight, contesto: { titolo: "VOLANTINO_SSCNCY_SSLI_VOL_SSCNCY", nomeCanale: "Superstore", idPromo: "p1" } });
    const { unmount } = apri();
    expect(screen.getByRole("heading", { level: 1, name: "Superstore" })).toBeInTheDocument();
    unmount();

    // Senza insegna né area, il nome della promozione
    finti.insights = caricato({ ...datiInsight, contesto: { titolo: "VOLANTINO_SSCNCY_SSLI_VOL_SSCNCY", idPromo: "p1", nomePromo: "Promo di novembre" } });
    const secondo = apri();
    expect(screen.getByRole("heading", { level: 1, name: "Promo di novembre" })).toBeInTheDocument();
    secondo.unmount();

    finti.insights = caricato({ ...datiInsight, contesto: { titolo: "VOLANTINO_SSCNCY_SSLI_VOL_SSCNCY", idPromo: "p1" } });
    apri();
    expect(screen.getByRole("heading", { level: 1, name: "Dettaglio volantino" })).toBeInTheDocument();
    expect(screen.queryByText(/VOLANTINO_SSCNCY/)).not.toBeInTheDocument();
  });

  it("con le date null nemmeno; con la sola fine passata il volantino è concluso", () => {
    finti.insights = caricato({ ...datiInsight, contesto: { ...datiInsight.contesto, validitaDal: null, validitaAl: null } });
    const { unmount } = apri();
    expect(screen.queryByTitle("Concluso")).not.toBeInTheDocument();
    unmount();

    finti.insights = caricato({ ...datiInsight, contesto: { ...datiInsight.contesto, validitaDal: null, validitaAl: "2020-01-14" } });
    apri();
    expect(screen.getByTitle("fino al 14 gennaio 2020")).toBeInTheDocument();
    expect(screen.getByTitle("Concluso")).toBeInTheDocument();
  });

  it("mette le sezioni nell'ordine: numeri, volantino, distribuzione, marchi del distributore, analisi, referenze; niente file in fondo", () => {
    finti.permessi.add("materiali.scarica");
    finti.insights = caricato({ ...datiInsight, lineeDistributore: LINEE });
    apri();

    expect(titoliSezioni()).toEqual(["Il volantino", "Distribuzione nelle pagine", "Marchi del distributore", "Referenze in volantino · 4"]);
    // I numeri stanno prima del volantino, le analisi fra i marchi e le referenze
    const volantino = screen.getByRole("heading", { level: 2, name: "Il volantino" });
    expect(numeri().compareDocumentPosition(volantino) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("region", { name: "File del volantino" })).not.toBeInTheDocument();
    const analisi = screen.getByTestId("analisi");
    const marchi = screen.getByRole("heading", { level: 2, name: "Marchi del distributore" });
    const referenze = screen.getByRole("heading", { level: 2, name: "Referenze in volantino · 4" });
    expect(marchi.compareDocumentPosition(analisi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(analisi.compareDocumentPosition(referenze) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("con il menabò della libreria agenzia la sezione Menabò viene subito dopo il volantino; una pagina scelta apre il volantino lì", () => {
    finti.insights = caricato({
      ...datiInsight,
      menabo: {
        pagine: [
          { pagina: 1, sezione: "COP-Copertina base", nome: "Copertina base" },
          { pagina: 2, sezione: "N1-NUMERI1", nome: "Numeri1" },
          { pagina: 5, sezione: "Og-OFFERTE generiche", nome: "Offerte generiche" },
        ],
      },
    });
    apri();

    expect(titoliSezioni()).toEqual(["Il volantino", "Menabò", "Distribuzione nelle pagine", "Referenze in volantino · 4"]);
    const menabo = screen.getByRole("region", { name: "Menabò" });
    const pagine = within(menabo).getByRole("list", { name: "Menabò: le pagine con la loro sezione" });
    // Tutte le 8 pagine del volantino, anche quelle senza sezione
    expect(within(pagine).getAllByRole("listitem")).toHaveLength(8);
    // Solo la sezione, senza reparto; una pagina senza sezione dice "Non trovata"
    const offerte = within(pagine).getByRole("button", { name: "Pagina 5: Offerte generiche" });
    expect(offerte).toHaveAttribute("title", "Og-OFFERTE generiche");
    expect(offerte).toHaveTextContent("5Offerte generiche");
    expect(within(pagine).getByRole("button", { name: "Pagina 3: sezione non trovata" })).toHaveTextContent("3Non trovata");

    // La pagina scelta porta in vista le pagine del volantino (la barra del lettore), non l'inizio della sezione
    const scorri = vi.fn();
    const originale = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scorri;
    try {
      fireEvent.click(offerte);
    } finally {
      Element.prototype.scrollIntoView = originale;
    }
    expect(screen.getByText(/^Volantino k1 pagina 5 /)).toBeInTheDocument();
    expect(offerte).toHaveAttribute("aria-current", "page");
    expect(scorri).toHaveBeenCalledTimes(1);
    expect(scorri.mock.contexts[0]).toBe(screen.getByTestId("barra-lettore"));
  });

  it("senza menabò, o con un menabò vuoto, la sezione non c'è", () => {
    finti.insights = caricato({ ...datiInsight, menabo: null });
    const { unmount } = apri();
    expect(screen.queryByRole("heading", { level: 2, name: "Menabò" })).not.toBeInTheDocument();
    unmount();

    finti.insights = caricato({ ...datiInsight, menabo: { pagine: [] } });
    apri();
    expect(screen.queryByRole("heading", { level: 2, name: "Menabò" })).not.toBeInTheDocument();
  });

  it("non confronta con altre edizioni o varianti: niente sezione Confronti", () => {
    apri();

    expect(screen.queryByRole("heading", { name: /Confronti/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/edizione precedente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Varianti/)).not.toBeInTheDocument();
    expect(document.querySelector("[data-direzione]")).toBeNull();
  });

  it("i numeri chiave in riquadri: referenze, pagine, sconto, Prezzo Fidelity, sottocosto e marche", () => {
    apri();

    expect(numero("Referenze")).toHaveTextContent("4");
    expect(numero("Referenze")).toHaveTextContent("3 box");
    expect(numero("Pagine")).toHaveTextContent("8");
    expect(numero("Sconto medio")).toHaveTextContent("30%");
    expect(numero("Prezzo Fidelity")).toHaveTextContent("33,3%");
    expect(numero("Prezzo Fidelity")).toHaveTextContent("1 box");
    expect(numero("Sottocosto")).toHaveTextContent("1");
    expect(numero("Marche")).toHaveTextContent("2");
    expect(within(numeri()).queryByText("Marchi del distributore")).not.toBeInTheDocument();
  });

  it("con le linee del distributore mostra il riquadro e la sezione dei suoi marchi; senza, nessuno dei due", () => {
    finti.insights = caricato({ ...datiInsight, lineeDistributore: LINEE });
    const { unmount } = apri();

    expect(numero("Marchi del distributore")).toHaveTextContent("33,3%");
    const sezione = screen.getByRole("region", { name: "Marchi del distributore" });
    expect(within(sezione).getByText("Sapori & Dintorni")).toBeInTheDocument();
    expect(within(sezione).getByRole("list", { name: "Bolli nel volantino" })).toHaveTextContent("DOP");
    unmount();

    finti.insights = caricato({ ...datiInsight, lineeDistributore: null });
    apri();
    expect(screen.queryByRole("region", { name: "Marchi del distributore" })).not.toBeInTheDocument();
  });

  it("scegliendo una pagina nella distribuzione, dalla colonna o dal riquadro, il volantino va a quella pagina, anche da tastiera", () => {
    apri();

    const distribuzione = screen.getByRole("region", { name: "Distribuzione nelle pagine" });
    const colonne = within(distribuzione).getByRole("group", { name: "Referenze delle pagine per reparto" });
    const riquadri = within(distribuzione).getByRole("list", { name: "Pagine del volantino" });
    fireEvent.click(within(colonne).getByRole("button", { name: /^Pagina 5:/ }));
    expect(screen.getByText(/^Volantino k1 pagina 5 /)).toBeInTheDocument();
    expect(within(colonne).getByRole("button", { name: /^Pagina 5:/ })).toHaveAttribute("aria-current", "page");
    expect(within(riquadri).getByRole("button", { name: /^Pagina 5:/ })).toHaveAttribute("aria-current", "page");

    fireEvent.keyDown(within(colonne).getByRole("button", { name: /^Pagina 2:/ }), { key: "Enter" });
    expect(screen.getByText(/^Volantino k1 pagina 2 /)).toBeInTheDocument();

    fireEvent.click(within(riquadri).getByRole("button", { name: /^Pagina 3:/ }));
    expect(screen.getByText(/^Volantino k1 pagina 3 /)).toBeInTheDocument();
  });

  it("la config della GDO può spegnere la distribuzione nelle pagine", () => {
    finti.configurazione = caricato({ pagine: { enabled: false } });
    apri();

    expect(screen.queryByRole("heading", { level: 2, name: "Distribuzione nelle pagine" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Il volantino" })).toBeInTheDocument();
  });

  it("dalla tabella delle referenze \"p. N\" apre il box nel volantino, ogni volta che si sceglie", () => {
    apri();

    const tabella = screen.getByRole("table", { name: "Referenze in volantino" });
    expect(screen.getByText("Box chiesto nessuno")).toBeInTheDocument();
    fireEvent.click(within(tabella).getByRole("button", { name: "Apri nel volantino Mozzarella Granarolo, pagina 5" }));
    expect(screen.getByText("Box chiesto b3 volta 1")).toBeInTheDocument();

    fireEvent.click(within(tabella).getByRole("button", { name: "Apri nel volantino Mozzarella Granarolo, pagina 5" }));
    expect(screen.getByText("Box chiesto b3 volta 2")).toBeInTheDocument();
  });

  it("la tabella delle referenze ha la colonna Linea solo con le linee del distributore", () => {
    finti.insights = caricato({ ...datiInsight, lineeDistributore: LINEE });
    const { unmount } = apri();
    expect(within(screen.getByRole("table", { name: "Referenze in volantino" })).getByRole("columnheader", { name: "Linea" })).toBeInTheDocument();
    unmount();

    // Senza linee del distributore negli insight
    finti.insights = caricato({ ...datiInsight, lineeDistributore: null });
    apri();
    expect(within(screen.getByRole("table", { name: "Referenze in volantino" })).queryByRole("columnheader", { name: "Linea" })).not.toBeInTheDocument();
  });

  it("?referenza con il nome di un prodotto cerca nella tabella; un id di referenza no", () => {
    const { unmount } = apri("/volantini/tutti_i_volantini?kit=k1&referenza=Mozzarella+Granarolo");
    expect(screen.getByRole("searchbox", { name: "Cerca referenza" })).toHaveValue("Mozzarella Granarolo");
    unmount();

    apri("/volantini/tutti_i_volantini?kit=k1&referenza=r7");
    expect(screen.getByRole("searchbox", { name: "Cerca referenza" })).toHaveValue("");
  });

  it("passa al visualizzatore PDF, box, pagina di ?pagina e box di ?referenza cercato per id, senza mappa di calore né vendite", () => {
    apri("/volantini/tutti_i_volantini?kit=k1&pagina=2&referenza=r7");

    expect(screen.getByText("Volantino k1 pagina 2 box iniziale b2 box 3")).toBeInTheDocument();
    expect(finti.propVolantino).toContain("pdf");
    expect(finti.propVolantino).toContain("apriBox");
    for (const tolta of ["calore", "rendimento", "previsione", "pesi", "statoBox", "compatto"]) expect(finti.propVolantino).not.toContain(tolta);
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

  it("mentre gli insight caricano non mostra numeri, distribuzione, volantino né referenze", () => {
    finti.insights = inCaricamento();
    apri();

    expect(screen.queryByRole("region", { name: "Numeri del volantino" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Volantino k1/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Distribuzione nelle pagine" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Referenze in volantino" })).not.toBeInTheDocument();
    expect(finti.propAnalisi?.isLoading).toBe(true);
  });

  it("senza PDF né box non mostra distribuzione, volantino e referenze ma tiene le analisi", () => {
    finti.insights = caricato({ ...datiInsight, pdf: null, box: [] });
    apri();

    expect(screen.queryByRole("heading", { level: 2, name: "Il volantino" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Distribuzione nelle pagine" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Referenze in volantino" })).not.toBeInTheDocument();
    expect(screen.getByText("Analisi k1")).toBeInTheDocument();
  });

  it("senza materiali.scarica lascia consultare gli insight; Scarica il volantino è disattivato e dice che manca il permesso", () => {
    apri();

    expect(finti.richiestaFile).toEqual({ idKit: "k1", abilitata: false });
    const pulsante = screen.getByRole("button", { name: /Scarica il volantino/ });
    expect(pulsante).toBeDisabled();
    expect(pulsante).toHaveAttribute("title", SERVE_IL_PERMESSO);
    expect(screen.queryByRole("region", { name: "File del volantino" })).not.toBeInTheDocument();
  });


  it("senza parametro kit segnala l'indirizzo incompleto", () => {
    apri("/volantini/tutti_i_volantini");

    expect(screen.getByText("Volantino non indicato")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Report PDF/ })).not.toBeInTheDocument();
  });
});

/** L'indirizzo corrente, per vedere dove porta il ritorno. */
function Indirizzo() {
  const { pathname, search } = useLocation();
  return <output aria-label="Indirizzo">{`${pathname}${search}`}</output>;
}

/** La pagina del volantino dentro un router con le pagine da cui si apre: `cronologia` finisce sul volantino. */
const apriDa = (cronologia: string[]) => {
  const router = createMemoryRouter(
    [
      { path: "/volantini/tutti_i_volantini", element: <TuttiIVolantini /> },
      { path: "*", element: <Indirizzo /> },
    ],
    { initialEntries: cronologia, initialIndex: cronologia.length - 1 }
  );
  render(<RouterProvider router={router} />);
  return router;
};

const indirizzo = () => screen.getByRole("status", { name: "Indirizzo" }).textContent;

describe("Dettaglio del volantino: ritorno", () => {
  beforeEach(() => {
    finti.permessi = new Set(["materiali.visualizza"]);
    finti.insights = caricato(datiInsight);
    finti.configurazione = caricato({});
    finti.file = caricato(PUBBLICATO);
  });

  it("aperto dallo Storico volantini torna lì, con la stessa pagina e gli stessi filtri, non ai volantini attivi", async () => {
    apriDa(["/storico-volantini?area=a-nord&pagina=3", "/volantini/tutti_i_volantini?kit=k1"]);

    expect(screen.queryByRole("link", { name: "Torna ai volantini attivi" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Torna indietro" }));

    expect(await screen.findByRole("status", { name: "Indirizzo" })).toBeInTheDocument();
    expect(indirizzo()).toBe("/storico-volantini?area=a-nord&pagina=3");
  });

  it("aperto dal dettaglio di una promozione archiviata torna al dettaglio, con i suoi filtri", async () => {
    apriDa(["/volantini/storico", "/volantini/promozioni/p1?area=a-toscana", "/volantini/tutti_i_volantini?kit=k1"]);

    fireEvent.click(screen.getByRole("button", { name: "Torna indietro" }));

    expect(await screen.findByRole("status", { name: "Indirizzo" })).toBeInTheDocument();
    expect(indirizzo()).toBe("/volantini/promozioni/p1?area=a-toscana");
  });

  it("aperto direttamente, senza una pagina prima, porta al dettaglio della sua promozione", async () => {
    apriDa(["/volantini/tutti_i_volantini?kit=k1"]);

    const ritorno = screen.getByRole("link", { name: "Torna alla promozione" });
    expect(ritorno).toHaveAttribute("href", "/volantini/promozioni/p1");
    fireEvent.click(ritorno);

    expect(await screen.findByRole("status", { name: "Indirizzo" })).toBeInTheDocument();
    expect(indirizzo()).toBe("/volantini/promozioni/p1");
  });

  it("aperto direttamente prima che si sappia la promozione porta ai volantini attivi", () => {
    // Senza kit nell'indirizzo gli insight non partono; con il kit, finché non arrivano
    finti.insights = inCaricamento();
    apriDa(["/volantini/tutti_i_volantini"]);
    expect(screen.getByRole("link", { name: "Torna ai volantini attivi" })).toHaveAttribute("href", "/volantini/attivi");
  });

  it("anche quando gli insight non si caricano il ritorno segue la pagina di prima", () => {
    finti.insights = fallito("Servizio non raggiungibile");
    apriDa(["/volantini/storico", "/volantini/tutti_i_volantini?kit=k1"]);

    expect(screen.getByText("Insight non caricati")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Torna indietro" })).toBeInTheDocument();
  });
});

describe("Dettaglio del volantino: report PDF disattivato", () => {
  beforeEach(() => {
    finti.permessi = new Set(["materiali.visualizza"]);
    finti.insights = caricato(datiInsight);
    finti.configurazione = caricato({});
    finti.file = caricato(PUBBLICATO);
  });

  it("il report PDF si vede ma è sempre disattivato: mentre gli insight caricano e dopo", () => {
    finti.insights = inCaricamento();
    const { unmount } = apri();
    expect(screen.getByRole("button", { name: /^Report PDF/ })).toBeDisabled();
    unmount();

    finti.insights = caricato(datiInsight);
    apri();
    const report = screen.getByRole("button", { name: /^Report PDF/ });
    expect(report).toBeDisabled();
    expect(report).toHaveAttribute("title", REPORT_DISATTIVATO);
  });

  it("niente rendimento, previsione né simulazione", () => {
    apri();

    expect(screen.queryByRole("heading", { level: 2, name: /Rendimento|Previsione|Simulazione/ })).not.toBeInTheDocument();
  });
});

describe("Dettaglio del volantino: Scarica il volantino", () => {
  const VOL = { id: "f1", nome: "Roma.pdf", tipoExport: "VOL", mime: "application/pdf", pagine: 8, anteprima: "/mini/roma" };
  const VOL_MILANO = { id: "f2", nome: "MILANO.pdf", tipoExport: "VOL", mime: "application/pdf", pagine: 8, anteprima: null };
  const WEB = { id: "f3", nome: "Banner web.zip", tipoExport: "WEB", mime: "application/zip", pagine: null, anteprima: null };
  const pulsante = () => screen.getByRole("button", { name: /Scarica il volantino/ });

  beforeEach(() => {
    finti.permessi = new Set(["materiali.visualizza", "materiali.scarica"]);
    finti.insights = caricato(datiInsight);
    finti.configurazione = caricato({});
    finti.scarica.mockReset();
  });

  it("con un solo file il pulsante in alto lo scarica con il suo nome", () => {
    finti.file = caricato({ ...PUBBLICATO, file: [VOL] });
    apri();

    expect(finti.richiestaFile).toEqual({ idKit: "k1", abilitata: true });
    expect(pulsante()).toBeEnabled();
    fireEvent.click(pulsante());
    expect(finti.scarica).toHaveBeenCalledWith("f1", "Roma.pdf");
  });

  it("con più file apre l'elenco, il PDF del volantino per primo, e scarica quello scelto", async () => {
    finti.file = caricato({ ...PUBBLICATO, file: [WEB, VOL, VOL_MILANO] });
    apri();

    fireEvent.click(pulsante());
    const voci = await screen.findAllByRole("menuitem");
    expect(voci.map(voce => voce.textContent)).toEqual(["MILANO.pdf", "Roma.pdf", "Banner web.zip"]);

    fireEvent.click(screen.getByRole("menuitem", { name: "Roma.pdf" }));
    expect(finti.scarica).toHaveBeenCalledWith("f1", "Roma.pdf");
  });

  it("senza file pubblicati, mentre arrivano o se non arrivano il pulsante è disattivato e dice perché", () => {
    finti.file = caricato({ ...PUBBLICATO, file: [] });
    const { unmount } = apri();
    expect(pulsante()).toBeDisabled();
    expect(pulsante()).toHaveAttribute("title", NESSUN_FILE);
    unmount();

    finti.file = inCaricamento();
    const secondo = apri();
    expect(pulsante()).toBeDisabled();
    secondo.unmount();

    finti.file = fallito("Volantino non disponibile: non è pubblicato o non è della tua GDO.");
    apri();
    expect(pulsante()).toBeDisabled();
    expect(pulsante()).toHaveAttribute("title", "Volantino non disponibile: non è pubblicato o non è della tua GDO.");
  });

  it("l'ordine dei file: il PDF dell'export volantino, poi gli altri del volantino, gli altri PDF e il resto", () => {
    const ALTRO_PDF = { ...WEB, id: "f4", nome: "Locandina.pdf", tipoExport: "POP", mime: "application/pdf" };
    const VOL_ZIP = { ...WEB, id: "f5", nome: "Sorgenti.zip", tipoExport: "VOL" };
    expect(fileInOrdine([WEB, ALTRO_PDF, VOL_ZIP, VOL]).map(voce => voce.nome)).toEqual(["Roma.pdf", "Sorgenti.zip", "Locandina.pdf", "Banner web.zip"]);
  });
});
