// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilePop, OpzioniFilePop, PaginaFilePop, PromoPop, RiepilogoPop } from "../../../lib/materiali/tipi";

const finti = vi.hoisted(() => ({
  permessi: [] as string[],
  notifica: vi.fn(),
  verifica: vi.fn(),
  promozioni: {} as Record<string, unknown>,
  riepilogo: {} as Record<string, unknown>,
  file: {} as Record<string, unknown>,
  opzioni: {} as Record<string, unknown>,
  periodiPromozioni: [] as unknown[],
  promoRiepilogo: [] as unknown[],
  filtriFile: [] as unknown[],
  richiesteOpzioni: [] as unknown[][],
  anteprime: [] as Array<{ totalPages: number }>,
  /** Schermo sotto sm: formati e file diventano schede. */
  stretto: false,
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/components/PreviewImmaginePdf", () => ({
  PreviewImmaginePdf: (props: { totalPages: number }) => {
    finti.anteprime.push(props);
    return null;
  },
}));
vi.mock("@/context/PermissionContext", () => ({ usePermission: (codice: string) => finti.permessi.includes(codice) }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.notifica }) }));
vi.mock("../../../lib/server_call", () => ({
  ServerCall: {
    getUrl: () => "/api",
    ensureCSRFToken: async () => "token-csrf",
    getCSRFToken: () => "token-csrf",
    post: finti.verifica,
  },
}));
vi.mock("@/components/PuntiVendita/useSchermoStretto", () => ({ useSchermoStretto: () => finti.stretto }));
vi.mock("@/query/query", () => ({
  useFetchPromozioniPop: (periodo: unknown) => {
    finti.periodiPromozioni.push(periodo);
    return finti.promozioni;
  },
  useFetchRiepilogoPop: (idPromo: unknown) => {
    finti.promoRiepilogo.push(idPromo);
    return finti.riepilogo;
  },
  useFetchFilePop: (_idPromo: unknown, filtri: unknown) => {
    finti.filtriFile.push(filtri);
    return finti.file;
  },
  useFetchOpzioniFilePop: (...argomenti: unknown[]) => {
    finti.richiesteOpzioni.push(argomenti);
    return finti.opzioni;
  },
}));

import PopMateriali from ".";

const ok = <T,>(data: T) => ({ data, isError: false, error: null, isPlaceholderData: false, refetch: vi.fn() });

const promozioni: PromoPop[] = [
  {
    id: "p1",
    nome: "Speciale Colazione",
    stato: "IN_LAVORAZIONE",
    validitaDal: "2026-10-16",
    validitaAl: "2026-10-29",
    numeroFile: 3828,
    numeroFormati: 2,
  } as PromoPop,
  {
    id: "p2",
    nome: "Pet Week",
    stato: "IN_LAVORAZIONE",
    validitaDal: "2026-10-23",
    validitaAl: "2026-11-05",
    numeroFile: 2410,
    numeroFormati: 1,
  } as PromoPop,
];

const riepilogo: RiepilogoPop = {
  promo: { id: "p1", nome: "Speciale Colazione", stato: "IN_LAVORAZIONE", validitaDal: "2026-10-16", validitaAl: "2026-10-29" } as RiepilogoPop["promo"],
  totali: { file: 3828, formati: 2, pubblicati: 0, inRevisione: 1700, conErrori: 90 },
  formati: [
    {
      id: "f1",
      nome: "Cartello prezzi A5",
      numeroFile: 1842,
      filePerStatoKit: { NON_AVVIATO: 0, IN_LAVORAZIONE: 1200, IN_LAVORAZIONE_CON_ERRORI: 90, IN_REVISIONE: 552, PUBBLICATO: 0 },
      kit: [
        { id: "k1", idDesign: "d1", titolo: "Cartello Nord", stato: "IN_LAVORAZIONE", area: { id: "a1", nome: "Nord" }, canale: { id: "c1", nome: "Supermercati" }, numeroFile: 1842 },
      ],
    },
    {
      id: "f2",
      nome: "Totem ingresso 70×200",
      numeroFile: 0,
      filePerStatoKit: { NON_AVVIATO: 0, IN_LAVORAZIONE: 0, IN_LAVORAZIONE_CON_ERRORI: 0, IN_REVISIONE: 0, PUBBLICATO: 0 },
      kit: [
        { id: null, idDesign: "d2", titolo: "Totem Sud", stato: "NON_AVVIATO", area: { id: "a2", nome: "Sud" }, canale: { id: "c2", nome: "Ipermercati" }, numeroFile: 0 },
      ],
    },
  ],
  avvisi: [],
} as RiepilogoPop;

const unFile = (id: string, nome: string): FilePop =>
  ({
    id,
    nome,
    idOlimpoCloud: `olimpo-${id}`,
    mime: "application/pdf",
    pagine: 3,
    kit: { id: "k1", titolo: "Cartello Nord", stato: "IN_LAVORAZIONE" },
    area: { id: "a1", nome: "Nord" },
    canale: { id: "c1", nome: "Supermercati" },
    referenza: { codice: "0014823", descrizione: "Caffè Lavazza Qualità Oro 250 g" },
    reparto: "Colazione",
    stato: "IN_REVISIONE",
    versione: 2,
  }) as FilePop;

const paginaFile = (modifiche: Partial<PaginaFilePop> = {}): PaginaFilePop => ({
  file: [unFile("fi1", "CP_A5_PV031_0014823.pdf"), unFile("fi2", "CP_A5_PV031_0021407.pdf")],
  totale: 1842,
  pagina: 1,
  dimensione: 100,
  ...modifiche,
});

const opzioniFile: OpzioniFilePop = {
  aree: [{ id: "a1", nome: "Nord" }],
  canali: [{ id: "c1", nome: "Supermercati" }],
  reparti: ["Colazione", "Freschi"],
};

const apri = async (indirizzo = "/pop/in-corso") => {
  const router = createMemoryRouter(
    [{ path: "/pop/:periodo", loader: ({ params }) => ({ periodo: params.periodo }), element: <PopMateriali /> }],
    { initialEntries: [indirizzo] }
  );
  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1 });
  return router;
};

/** Parametri dell'indirizzo corrente, come oggetto. */
const parametri = (router: Awaited<ReturnType<typeof apri>>) => Object.fromEntries(new URLSearchParams(router.state.location.search));

const tabellaFile = () => within(screen.getByRole("region", { name: /File del formato/ })).getByRole("table");
const tabellaFormati = () => within(screen.getByRole("region", { name: "File per formato" })).getByRole("table");

/** Form inviati dalla pagina: lo ZIP dei file selezionati parte da un form nascosto. */
const moduliInviati: Array<{ metodo: string; azione: string | null; destinazione: string; campi: Record<string, FormDataEntryValue> }> = [];
/** Link cliccati dalla pagina: lo ZIP di un formato o dei file filtrati parte da un link con download. */
const linkCliccati: Array<{ indirizzo: string | null; download: string | null }> = [];

describe("POP per periodo", () => {
  beforeEach(() => {
    finti.permessi = ["file.download", "promo.visualizza"];
    finti.notifica.mockReset();
    finti.verifica.mockReset();
    finti.verifica.mockResolvedValue({ file: 1, nomeFile: "Speciale Colazione - Cartello prezzi A5.zip" });
    finti.promozioni = ok({ promozioni, avvisi: [] });
    finti.riepilogo = ok(riepilogo);
    finti.file = ok(paginaFile());
    finti.opzioni = ok(opzioniFile);
    finti.periodiPromozioni = [];
    finti.promoRiepilogo = [];
    finti.filtriFile = [];
    finti.richiesteOpzioni = [];
    finti.anteprime = [];
    finti.stretto = false;
    moduliInviati.length = 0;
    linkCliccati.length = 0;
    vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(function (this: HTMLFormElement) {
      moduliInviati.push({
        metodo: this.method,
        azione: this.getAttribute("action"),
        destinazione: this.target,
        campi: Object.fromEntries(new FormData(this)),
      });
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      linkCliccati.push({ indirizzo: this.getAttribute("href"), download: this.getAttribute("download") });
    });
    // jsdom non scorre la pagina: basta sapere che la pagina lo chiede
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("elenca le promozioni del periodo con i file e apre la prima, con i suoi totali", async () => {
    await apri();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("POP · In corso");
    expect(finti.periodiPromozioni.at(-1)).toBe("in-corso");
    const elenco = screen.getByRole("complementary", { name: "Promozioni" });
    const prima = within(elenco).getByRole("link", { name: /Speciale Colazione/ });
    expect(prima).toHaveAttribute("aria-current", "true");
    expect(prima).toHaveTextContent("3.828");
    expect(within(elenco).getByRole("link", { name: /Pet Week/ })).not.toHaveAttribute("aria-current");
    expect(finti.promoRiepilogo.at(-1)).toBe("p1");

    expect(screen.getByRole("heading", { level: 2, name: "Speciale Colazione" })).toBeInTheDocument();
    expect(screen.getByText("POP · In corso · validità 16/10 – 29/10/2026")).toBeInTheDocument();
    for (const [etichetta, valore] of [
      ["File POP", "3.828"],
      ["Formati", "2"],
      ["Pubblicati", "0"],
      ["In revisione", "1.700"],
      ["Con errori", "90"],
    ]) {
      expect(screen.getByText(etichetta, { selector: "dt" }).nextElementSibling).toHaveTextContent(valore);
    }
  });

  it("in cima ci sono i periodi del POP, e nessun collegamento ai volantini", async () => {
    const router = await apri();

    const periodi = screen.getByRole("radiogroup", { name: "Periodo" });
    expect(within(periodi).getAllByRole("radio").map((scheda) => scheda.textContent)).toEqual(["In corso", "Attivi", "Storico"]);
    expect(within(periodi).getByRole("radio", { name: "In corso" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("link", { name: /volantin/i })).not.toBeInTheDocument();

    fireEvent.click(within(periodi).getByRole("radio", { name: "Storico" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/pop/storico"));
    expect(await screen.findByRole("heading", { level: 1, name: "POP · Storico" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("");
  });

  it.each([
    ["attivi", "POP · Attivi"],
    ["storico", "POP · Storico"],
  ])("%s: solo kit pubblicati, quindi niente file in revisione o con errori né stati di lavorazione", async (periodo, titolo) => {
    finti.riepilogo = ok({
      ...riepilogo,
      promo: { ...riepilogo.promo, stato: periodo === "storico" ? "ARCHIVIATA" : "VALIDA" },
      totali: { file: 1842, formati: 1, pubblicati: 1842, inRevisione: 0, conErrori: 0 },
      formati: [{ ...riepilogo.formati[0], filePerStatoKit: { ...riepilogo.formati[0].filePerStatoKit, IN_LAVORAZIONE: 0, IN_LAVORAZIONE_CON_ERRORI: 0, IN_REVISIONE: 0, PUBBLICATO: 1842 } }],
    });
    await apri(`/pop/${periodo}`);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(titolo);
    expect(finti.periodiPromozioni.at(-1)).toBe(periodo);
    expect(within(screen.getByRole("radiogroup", { name: "Periodo" })).getByRole("radio", { checked: true })).toHaveTextContent(
      periodo === "attivi" ? "Attivi" : "Storico"
    );
    expect(screen.getByText("Pubblicati", { selector: "dt" }).nextElementSibling).toHaveTextContent("1.842");
    expect(screen.queryByText("In revisione", { selector: "dt" })).not.toBeInTheDocument();
    expect(screen.queryByText("Con errori", { selector: "dt" })).not.toBeInTheDocument();
    const legenda = screen.getByRole("list", { name: "Legenda dell'avanzamento" });
    expect(within(legenda).getAllByRole("listitem").map((voce) => voce.textContent)).toEqual(["Pubblicati"]);
    expect(finti.filtriFile.at(-1)).toMatchObject({ periodo, idFormato: "f1" });
  });

  it("le promozioni di cui Istanta non ha dato i kit non avviati sono segnalate", async () => {
    finti.promozioni = ok({ promozioni, avvisi: [{ promo: { id: "p9", nome: "Back to school" }, motivo: "Istanta non ha risposto." }] });
    finti.riepilogo = ok({ ...riepilogo, avvisi: [{ promo: { id: "p9", nome: "Back to school" }, motivo: "Istanta non ha risposto." }] });
    await apri();

    const avviso = screen.getByText(/Back to school/).closest("li");
    expect(avviso).toHaveTextContent("I kit POP non ancora avviati di Back to school non sono disponibili: Istanta non ha risposto.");
    // Lo stesso avviso dall'elenco e dal riepilogo compare una volta sola
    expect(screen.getAllByText("Back to school")).toHaveLength(1);
  });

  it("?promo= sceglie la promozione e la cerca filtra l'elenco", async () => {
    await apri("/pop/in-corso?promo=p2");

    const elenco = screen.getByRole("complementary", { name: "Promozioni" });
    expect(within(elenco).getByRole("link", { name: /Pet Week/ })).toHaveAttribute("aria-current", "true");
    // Sotto lg la stessa scelta è una tendina
    expect(within(elenco).getByRole("combobox", { name: "Promozione" })).toHaveValue("p2");
    expect(finti.promoRiepilogo.at(-1)).toBe("p2");

    fireEvent.change(within(elenco).getByRole("searchbox", { name: "Cerca promozione" }), { target: { value: "colazione" } });
    expect(within(elenco).queryByRole("link", { name: /Pet Week/ })).not.toBeInTheDocument();
    expect(within(elenco).getByRole("link", { name: /Speciale Colazione/ })).toHaveAttribute("href", "/pop/in-corso?promo=p1");
  });

  it("la tabella dei formati mostra file, avanzamento, i kit a richiesta con Apri kit e lo ZIP del formato", async () => {
    await apri();

    const [, riga1, riga2] = within(tabellaFormati()).getAllByRole("row");

    expect(within(riga1).getByRole("link", { name: "Cartello prezzi A5" })).toHaveAttribute("aria-current", "true");
    expect(within(riga1).getByText("1.842")).toBeInTheDocument();
    expect(within(riga1).getByRole("img")).toHaveAccessibleName(
      "File per stato del kit: 1.200 in lavorazione, 90 con errori, 552 in revisione"
    );
    // I kit del formato si contano; l'elenco si apre a richiesta, così la riga resta bassa
    const kitRiga1 = within(riga1).getByRole("button", { name: "1 kit di Cartello prezzi A5" });
    expect(kitRiga1).toHaveAttribute("aria-expanded", "false");
    expect(within(riga1).queryByRole("link", { name: /Apri kit/ })).not.toBeInTheDocument();
    fireEvent.click(kitRiga1);
    expect(kitRiga1).toHaveAttribute("aria-expanded", "true");
    expect(within(riga1).getByText("Nord · Supermercati")).toBeInTheDocument();
    expect(within(riga1).getByRole("link", { name: "Apri kit Cartello Nord" })).toHaveAttribute(
      "href",
      "/promozioni/in-corso/dettagli/p1/kits/k1"
    );
    expect(within(riga1).getByRole("button", { name: "Scarica ZIP di Cartello prezzi A5" })).toBeEnabled();

    // Il kit non avviato si apre dai kit della promo; scegliere il formato resta sulla promo
    fireEvent.click(within(riga2).getByRole("button", { name: "1 kit di Totem ingresso 70×200" }));
    expect(within(riga2).getByTitle("Non avviato")).toBeInTheDocument();
    expect(within(riga2).getByRole("link", { name: "Apri kit Totem Sud" })).toHaveAttribute(
      "href",
      "/promozioni/in-corso/dettagli/p1/kits"
    );
    expect(within(riga2).getByRole("link", { name: "Totem ingresso 70×200" })).toHaveAttribute(
      "href",
      "/pop/in-corso?promo=p1&formato=f2"
    );
    expect(within(riga2).getByRole("img")).toHaveAccessibleName("Nessun file");
    // Un formato senza file non ha niente da scaricare: il comando è spento e dice perché
    const zipVuoto = within(riga2).getByRole("button", { name: "Scarica ZIP di Totem ingresso 70×200" });
    expect(zipVuoto).toBeDisabled();
    expect(zipVuoto).toHaveAttribute("title", "Il formato non ha file da scaricare");

    const legenda = screen.getByRole("list", { name: "Legenda dell'avanzamento" });
    expect(within(legenda).getAllByRole("listitem").map((voce) => voce.textContent)).toEqual([
      "Non avviati",
      "In lavorazione",
      "Con errori",
      "In revisione",
      "Pubblicati",
    ]);
  });

  it("?formato= apre i file di quel formato", async () => {
    finti.file = ok(paginaFile({ file: [], totale: 0 }));
    await apri("/pop/in-corso?promo=p1&formato=f2");

    expect(screen.getByRole("heading", { level: 2, name: "File del formato Totem ingresso 70×200 · 0 file" })).toBeInTheDocument();
    expect(finti.filtriFile.at(-1)).toMatchObject({ periodo: "in-corso", idFormato: "f2", pagina: 1, dimensione: 100 });
    expect(screen.getByRole("heading", { name: "Nessun file in questo formato" })).toBeInTheDocument();
  });

  it("i file del formato si sfogliano a pagine da 100, 250 o 500 righe", async () => {
    const router = await apri();

    expect(screen.getByRole("heading", { level: 2, name: "File del formato Cartello prezzi A5 · 1.842 file" })).toBeInTheDocument();
    const intestazioni = within(tabellaFile()).getAllByRole("columnheader").map((cella) => cella.textContent);
    expect(intestazioni).toEqual(["", "File", "Referenza", "Reparto", "Stato", "Ver.", "Azioni"]);
    const righe = within(tabellaFile()).getAllByRole("row");
    expect(righe).toHaveLength(3);
    const celle = within(righe[1]).getAllByRole("cell");
    expect(celle[2]).toHaveTextContent("Caffè Lavazza Qualità Oro 250 g0014823");
    // Il reparto ha la sua colonna, non sta più sotto il codice
    expect(celle[3]).toHaveTextContent("Colazione");
    expect(within(righe[1]).getByTitle("In revisione")).toBeInTheDocument();
    expect(within(righe[1]).getByText("v2")).toBeInTheDocument();
    expect(within(righe[1]).getByRole("link", { name: "Scarica CP_A5_PV031_0014823.pdf" })).toHaveAttribute(
      "href",
      "/api/downloadPDFVolantino/olimpo-fi1?fileName=CP_A5_PV031_0014823.pdf"
    );

    expect(screen.getByText("Mostrati 1–100 di 1.842 file")).toBeInTheDocument();
    const righePerPagina = screen.getByLabelText("Righe per pagina");
    expect(within(righePerPagina).getAllByRole("option").map((opzione) => opzione.textContent)).toEqual(["100", "250", "500"]);

    fireEvent.change(righePerPagina, { target: { value: "250" } });
    await waitFor(() => expect(finti.filtriFile.at(-1)).toMatchObject({ dimensione: 250, pagina: 1 }));
    expect(parametri(router)).toEqual({ promo: "p1", formato: "f1", dimensione: "250" });
  });

  it("l'anteprima mostra tutte le pagine del PDF", async () => {
    await apri();

    fireEvent.click(screen.getByRole("button", { name: "Anteprima CP_A5_PV031_0014823.pdf" }));

    expect(finti.anteprime.at(-1)).toMatchObject({ totalPages: 3 });
  });

  it("un filtro dei file arriva alla richiesta, resta nell'indirizzo e riparte dalla prima pagina", async () => {
    const router = await apri();

    fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));
    await waitFor(() => expect(finti.filtriFile.at(-1)).toMatchObject({ pagina: 2 }));
    expect(parametri(router)).toEqual({ promo: "p1", formato: "f1", pagina: "2" });
    // La pagina nuova si legge dall'inizio della tabella
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Stato file"), { target: { value: "ERRORE" } });
    await waitFor(() => expect(finti.filtriFile.at(-1)).toMatchObject({ stato: "ERRORE", pagina: 1 }));
    expect(parametri(router)).toEqual({ promo: "p1", formato: "f1", stato: "ERRORE" });
    expect(within(screen.getByLabelText("Reparto")).getByRole("option", { name: "Freschi" })).toBeInTheDocument();
  });

  it("le tendine dei file si chiedono una volta per formato, non a ogni pagina o filtro", async () => {
    await apri();

    fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));
    await waitFor(() => expect(finti.filtriFile.at(-1)).toMatchObject({ pagina: 2 }));
    fireEvent.change(screen.getByLabelText("Reparto"), { target: { value: "Freschi" } });
    await waitFor(() => expect(finti.filtriFile.at(-1)).toMatchObject({ reparto: "Freschi" }));

    // Stessa chiave a ogni richiesta: React Query non la ripete finché è fresca
    expect(new Set(finti.richiesteOpzioni.map((argomenti) => JSON.stringify(argomenti)))).toEqual(
      new Set([JSON.stringify(["p1", "in-corso", "f1"])])
    );
  });

  it("filtri, pagina e righe per pagina si leggono dall'indirizzo: ricaricando o tornando indietro restano", async () => {
    await apri("/pop/in-corso?promo=p1&formato=f1&cerca=caffe&stato=ERRORE&area=a1&canale=c1&reparto=Colazione&pagina=3&dimensione=250");

    expect(finti.filtriFile.at(-1)).toEqual({
      periodo: "in-corso",
      idFormato: "f1",
      cerca: "caffe",
      stato: "ERRORE",
      idArea: "a1",
      idCanale: "c1",
      reparto: "Colazione",
      pagina: 3,
      dimensione: 250,
    });
    expect(screen.getByRole("searchbox", { name: "Cerca" })).toHaveValue("caffe");
    expect(screen.getByLabelText("Stato file")).toHaveValue("ERRORE");
    expect(screen.getByLabelText("Area")).toHaveValue("a1");
    expect(screen.getByLabelText("Reparto")).toHaveValue("Colazione");
    expect(screen.getByLabelText("Righe per pagina")).toHaveValue("250");
  });

  it("il filtro per stato propone solo gli stati che un file POP può avere", async () => {
    await apri("/pop/in-corso?promo=p1&formato=f1&stato=CORREGGO_ERRORE");

    const stati = within(screen.getByLabelText("Stato file")).getAllByRole("option").map((opzione) => opzione.getAttribute("value"));
    expect(stati).toEqual(["", "IN_ATTESA", "IN_REVISIONE", "ACCETTATO", "ERRORE", "PUBBLICATO"]);
    // Uno stato di Correggo dall'indirizzo non filtra
    expect((finti.filtriFile.at(-1) as { stato?: string }).stato).toBeUndefined();
  });

  it("senza ?formato= si apre il primo formato che ha file, non il primo in ordine alfabetico", async () => {
    const [cartello, totem] = riepilogo.formati;
    finti.riepilogo = ok({ ...riepilogo, formati: [{ ...totem, id: "f0", nome: "Banner vuoto" }, cartello] });
    await apri();

    expect(finti.filtriFile.at(-1)).toMatchObject({ idFormato: "f1" });
    expect(within(tabellaFormati()).getByRole("link", { name: "Cartello prezzi A5" })).toHaveAttribute("aria-current", "true");
  });

  it("scegliendo un formato i suoi file vengono in vista e prendono il focus", async () => {
    const router = await apri();
    finti.file = ok(paginaFile({ file: [], totale: 0 }));

    fireEvent.click(within(tabellaFormati()).getByRole("link", { name: "Totem ingresso 70×200" }));

    await waitFor(() => expect(router.state.location.search).toBe("?promo=p1&formato=f2"));
    const sezione = await screen.findByRole("region", { name: "File del formato Totem ingresso 70×200 · 0 file" });
    await waitFor(() => expect(sezione).toHaveFocus());
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("mentre arrivano i file nuovi quelli di prima restano visibili ma non si possono scegliere", async () => {
    finti.file = { ...ok(paginaFile()), isPlaceholderData: true };
    await apri();

    expect(screen.getByRole("checkbox", { name: "Seleziona CP_A5_PV031_0014823.pdf" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Seleziona la pagina" })).toBeDisabled();
  });

  it("si selezionano file e pagina; Seleziona tutti passa a tutti i file del formato", async () => {
    await apri();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleziona CP_A5_PV031_0014823.pdf" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 file selezionato");
    expect(screen.getByRole("checkbox", { name: "Seleziona la pagina" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleziona la pagina" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 file selezionati");
    expect(screen.getByRole("checkbox", { name: "Seleziona la pagina" })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Seleziona tutti i 1.842 del formato" }));
    const barra = screen.getByRole("status");
    expect(barra).toHaveTextContent("Selezionati tutti i 1.842 file del formato");
    expect(within(barra).getByRole("button", { name: "Scarica ZIP" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Seleziona CP_A5_PV031_0021407.pdf" })).toBeDisabled();

    fireEvent.click(within(barra).getByRole("button", { name: "Annulla selezione" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("con i filtri, tutti i file trovati si scaricano con gli stessi filtri: prima la verifica, poi lo ZIP in streaming", async () => {
    finti.verifica.mockResolvedValue({ file: 1842, nomeFile: "Speciale Colazione - Cartello prezzi A5.zip" });
    await apri();

    fireEvent.change(screen.getByLabelText("Reparto"), { target: { value: "Colazione" } });
    await waitFor(() => expect(finti.filtriFile.at(-1)).toMatchObject({ reparto: "Colazione" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleziona la pagina" }));
    fireEvent.click(screen.getByRole("button", { name: "Seleziona tutti i 1.842 file trovati" }));
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Scarica ZIP" }));

    await waitFor(() => expect(linkCliccati).toHaveLength(1));
    expect(finti.verifica).toHaveBeenCalledWith("/materiali/pop/promozioni/p1/zip/verifica", {
      periodo: "in-corso",
      idFormato: "f1",
      filtri: { reparto: "Colazione" },
    });
    // Il browser scarica lo ZIP da un link con download: niente blob in memoria, niente iframe (la CSP li blocca)
    expect(linkCliccati[0]).toEqual({
      indirizzo: "/api/materiali/pop/promozioni/p1/zip?periodo=in-corso&idFormato=f1&reparto=Colazione",
      download: "",
    });
    expect(document.querySelector("iframe")).toBeNull();
    expect(finti.notifica).toHaveBeenCalledWith("Download avviato: 1.842 file nello ZIP", { variant: "info" });
  });

  it("Scarica ZIP del formato: verifica, poi il download di tutto il formato", async () => {
    await apri();

    fireEvent.click(within(tabellaFormati()).getByRole("button", { name: "Scarica ZIP di Cartello prezzi A5" }));

    await waitFor(() => expect(linkCliccati).toHaveLength(1));
    expect(finti.verifica).toHaveBeenCalledWith("/materiali/pop/promozioni/p1/zip/verifica", { periodo: "in-corso", idFormato: "f1" });
    expect(linkCliccati[0].indirizzo).toBe("/api/materiali/pop/promozioni/p1/zip?periodo=in-corso&idFormato=f1");
    // Il link temporaneo non resta nella pagina
    expect(document.querySelector('a[href$="idFormato=f1"]')).toBeNull();
  });

  it.each([
    ["sessione scaduta", "Sessione scaduta: accedi di nuovo"],
    ["promo fuori dal periodo", "Promozione non trovata tra quelle del periodo \"In corso\"."],
    ["errore del server", "Si è verificato un errore imprevisto"],
  ])("se la verifica dello ZIP del formato fallisce (%s) lo dice nella pagina e non scarica niente", async (_caso, motivo) => {
    finti.verifica.mockRejectedValue(new Error(motivo));
    await apri();

    fireEvent.click(within(tabellaFormati()).getByRole("button", { name: "Scarica ZIP di Cartello prezzi A5" }));

    await waitFor(() => expect(finti.notifica).toHaveBeenCalledWith(motivo, { variant: "error" }));
    // Nessun download: né un file JSON scaricato né una pagina JSON al posto di questa
    expect(linkCliccati).toEqual([]);
    expect(moduliInviati).toEqual([]);
    expect(within(tabellaFormati()).getByRole("button", { name: "Scarica ZIP di Cartello prezzi A5" })).toBeEnabled();
  });

  it("Scarica selezionati verifica con il token CSRF, poi manda un form nascosto e il browser riceve lo ZIP in streaming", async () => {
    await apri();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleziona CP_A5_PV031_0021407.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Scarica selezionati" }));

    await waitFor(() => expect(moduliInviati).toHaveLength(1));
    // La verifica passa da ServerCall.post, che manda il token CSRF e riprova se è scaduto
    expect(finti.verifica).toHaveBeenCalledWith("/materiali/pop/promozioni/p1/zip/verifica", {
      periodo: "in-corso",
      idFormato: "f1",
      idFile: ["fi2"],
    });
    const [modulo] = moduliInviati;
    // Nella pagina stessa: lo ZIP arriva come allegato, il browser lo scarica e la pagina resta
    expect(modulo).toMatchObject({ metodo: "post", azione: "/api/materiali/pop/promozioni/p1/zip", destinazione: "" });
    expect(modulo.campi._csrf).toBe("token-csrf");
    expect(JSON.parse(String(modulo.campi.richiesta))).toEqual({ periodo: "in-corso", idFormato: "f1", idFile: ["fi2"] });
    // Il form non resta nella pagina
    expect(document.querySelector('form[action$="/zip"]')).toBeNull();
    expect(finti.notifica).toHaveBeenCalledWith("Download avviato: 1 file nello ZIP", { variant: "info" });
  });

  it("se la verifica dei file selezionati fallisce lo dice con il motivo del server, senza mandare il form", async () => {
    finti.verifica.mockRejectedValue(new Error("Nessun file da scaricare per questa selezione."));
    await apri();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleziona CP_A5_PV031_0021407.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Scarica selezionati" }));

    await waitFor(() =>
      expect(finti.notifica).toHaveBeenCalledWith("Nessun file da scaricare per questa selezione.", { variant: "error" })
    );
    expect(moduliInviati).toEqual([]);
    expect(linkCliccati).toEqual([]);
  });

  it("senza il permesso file.download i download sono disattivati e il motivo è scritto", async () => {
    finti.permessi = ["promo.visualizza"];
    await apri();

    expect(screen.getAllByText("Manca il permesso di scaricare file").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Scarica ZIP/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scarica ZIP di Cartello prezzi A5" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Scarica CP_A5_PV031_0014823.pdf" })).toBeDisabled();
    // L'anteprima non è un download
    expect(screen.getByRole("button", { name: "Anteprima CP_A5_PV031_0014823.pdf" })).toBeEnabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleziona CP_A5_PV031_0014823.pdf" }));
    expect(within(screen.getByRole("status")).getByRole("button", { name: /Scarica selezionati/ })).toBeDisabled();
  });

  it("senza il permesso di vedere le promo i kit non hanno il link Apri kit", async () => {
    finti.permessi = ["file.download"];
    await apri();

    fireEvent.click(within(tabellaFormati()).getByRole("button", { name: "1 kit di Cartello prezzi A5" }));

    expect(within(tabellaFormati()).getByText("Nord · Supermercati")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Apri kit/ })).not.toBeInTheDocument();
  });

  it("senza promozioni con kit POP mostra lo stato vuoto del periodo, con le schede dei periodi", async () => {
    finti.promozioni = ok({ promozioni: [], avvisi: [] });
    finti.riepilogo = { data: undefined, isError: false, error: null, refetch: vi.fn() };
    await apri();

    expect(screen.getByRole("heading", { name: "Nessun kit POP nelle promozioni in corso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vai alle promozioni in corso" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Promozioni" })).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Periodo" })).toBeInTheDocument();
    // Nessuna promo da aprire: il riepilogo non si chiede
    expect(finti.promoRiepilogo.every((idPromo) => idPromo === undefined)).toBe(true);
  });

  it("una ?promo= che non è fra quelle del periodo lo dice e propone la prima, senza Riprova", async () => {
    const router = await apri("/pop/in-corso?promo=sconosciuta");

    expect(screen.getByRole("heading", { name: "Promozione non disponibile" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Riprova" })).not.toBeInTheDocument();
    expect(finti.promoRiepilogo.at(-1)).toBeUndefined();
    expect(within(screen.getByRole("complementary", { name: "Promozioni" })).getByRole("combobox", { name: "Promozione" })).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Apri la prima promozione" }));

    await waitFor(() => expect(router.state.location.search).toBe("?promo=p1"));
    await waitFor(() => expect(finti.promoRiepilogo.at(-1)).toBe("p1"));
    expect(screen.getByRole("heading", { level: 2, name: "Speciale Colazione" })).toBeInTheDocument();
  });

  it("con i filtri senza file propone Azzera filtri e riassume i filtri usati", async () => {
    const router = await apri();
    finti.file = ok(paginaFile({ file: [], totale: 0 }));

    fireEvent.change(screen.getByLabelText("Stato file"), { target: { value: "ERRORE" } });

    expect(await screen.findByRole("heading", { name: "Nessun file corrisponde ai filtri" })).toBeInTheDocument();
    expect(screen.getByText("Stato «Errore»")).toBeInTheDocument();
    const azzera = screen.getAllByRole("button", { name: "Azzera filtri" });
    fireEvent.click(azzera[azzera.length - 1]);
    await waitFor(() => expect(screen.getByLabelText("Stato file")).toHaveValue(""));
    expect((finti.filtriFile.at(-1) as { stato?: string }).stato).toBeUndefined();
    expect(parametri(router)).toEqual({ promo: "p1", formato: "f1" });
  });

  it("se le promozioni non arrivano mostra il motivo e Riprova, non lo stato vuoto", async () => {
    const refetch = vi.fn();
    finti.promozioni = { data: undefined, isError: true, error: new Error("Servizio non raggiungibile"), refetch };
    finti.riepilogo = { data: undefined, isError: false, error: null, refetch: vi.fn() };
    await apri();

    expect(screen.getByRole("alert")).toHaveTextContent("Servizio non raggiungibile");
    expect(screen.queryByText("Nessun kit POP nelle promozioni in corso")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("se i file del formato non arrivano l'errore resta nella loro sezione", async () => {
    finti.file = { data: undefined, isError: true, error: new Error("Timeout del servizio file"), isPlaceholderData: false, refetch: vi.fn() };
    await apri();

    const sezione = screen.getByRole("region", { name: /File del formato/ });
    expect(within(sezione).getByRole("alert")).toHaveTextContent("File non caricati");
    expect(within(sezione).getByRole("alert")).toHaveTextContent("Timeout del servizio file");
    expect(screen.queryByText("Nessun file in questo formato")).not.toBeInTheDocument();
    // Il resto della promo resta visibile
    expect(screen.getByRole("region", { name: "File per formato" })).toBeInTheDocument();
  });

  it("nessun file: lo stato vuoto sta fuori dalla tabella, che su mobile lo taglierebbe", async () => {
    finti.file = ok(paginaFile({ file: [], totale: 0 }));
    await apri();

    const sezione = screen.getByRole("region", { name: /File del formato/ });
    expect(within(sezione).getByRole("heading", { name: "Nessun file in questo formato" })).toBeInTheDocument();
    expect(within(sezione).queryByRole("table")).not.toBeInTheDocument();
    expect(within(sezione).queryByRole("checkbox", { name: "Seleziona la pagina" })).not.toBeInTheDocument();
  });

  it("i file in arrivo e l'errore stanno fuori dalla tabella", async () => {
    finti.file = { data: undefined, isError: false, error: null, isPlaceholderData: false, refetch: vi.fn() };
    await apri();

    const sezione = screen.getByRole("region", { name: /File del formato/ });
    expect(within(sezione).getByRole("status", { name: "Caricamento dei file" })).toBeInTheDocument();
    expect(within(sezione).queryByRole("table")).not.toBeInTheDocument();
  });

  it("su schermo stretto formati e file sono schede: niente tabelle tagliate, kit, ZIP e comandi restano", async () => {
    finti.stretto = true;
    await apri();

    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    const formati = within(screen.getByRole("region", { name: "File per formato" })).getByRole("list", { name: "Formati" });
    const [scheda1] = within(formati).getAllByRole("listitem");
    expect(within(scheda1).getByRole("link", { name: "Cartello prezzi A5" })).toHaveAttribute("aria-current", "true");
    expect(scheda1).toHaveTextContent("1.842 file");
    expect(within(scheda1).getByRole("img")).toHaveAccessibleName("File per stato del kit: 1.200 in lavorazione, 90 con errori, 552 in revisione");
    expect(within(scheda1).getByRole("button", { name: "Scarica ZIP di Cartello prezzi A5" })).toBeEnabled();
    fireEvent.click(within(scheda1).getByRole("button", { name: "1 kit di Cartello prezzi A5" }));
    expect(within(scheda1).getByRole("link", { name: "Apri kit Cartello Nord" })).toBeInTheDocument();

    const file = within(screen.getByRole("region", { name: /File del formato/ })).getByRole("list", { name: "File del formato" });
    const [primoFile] = within(file).getAllByRole("listitem");
    expect(primoFile).toHaveTextContent("CP_A5_PV031_0014823.pdf");
    expect(primoFile).toHaveTextContent("Caffè Lavazza Qualità Oro 250 g");
    expect(primoFile).toHaveTextContent("Colazione");
    expect(primoFile).toHaveTextContent("v2");
    fireEvent.click(within(primoFile).getByRole("checkbox", { name: "Seleziona CP_A5_PV031_0014823.pdf" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 file selezionato");
    expect(within(primoFile).getByRole("link", { name: "Scarica CP_A5_PV031_0014823.pdf" })).toHaveAttribute("download", "CP_A5_PV031_0014823.pdf");
    // La casella della pagina resta, sopra le schede
    expect(screen.getByRole("checkbox", { name: "Seleziona la pagina" })).toBeInTheDocument();
  });

  it("le promozioni sono un pannello solo: lo sticky sta sul contenitore, non sul riquadro", async () => {
    await apri();

    const elenco = screen.getByRole("complementary", { name: "Promozioni" });
    expect(elenco).not.toHaveClass("lg:sticky");
    expect(elenco.parentElement).toHaveClass("lg:sticky");
  });
});

