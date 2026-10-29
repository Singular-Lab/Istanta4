// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilePop, PaginaFilePop, PromoPop, RiepilogoPop } from "../../../lib/materiali/tipi";

const finti = vi.hoisted(() => ({
  permessi: [] as string[],
  notifica: vi.fn(),
  promozioni: {} as Record<string, unknown>,
  riepilogo: {} as Record<string, unknown>,
  file: {} as Record<string, unknown>,
  promoRiepilogo: [] as unknown[],
  filtriFile: [] as unknown[],
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/components/PreviewImmaginePdf", () => ({ PreviewImmaginePdf: () => null }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: (codice: string) => finti.permessi.includes(codice) }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.notifica }) }));
vi.mock("../../../lib/server_call", () => ({
  ServerCall: { getUrl: () => "/api", ensureCSRFToken: async () => "token-csrf" },
}));
vi.mock("@/query/query", () => ({
  useFetchPromozioniPop: () => finti.promozioni,
  useFetchRiepilogoPop: (idPromo: unknown) => {
    finti.promoRiepilogo.push(idPromo);
    return finti.riepilogo;
  },
  useFetchFilePop: (_idPromo: unknown, filtri: unknown) => {
    finti.filtriFile.push(filtri);
    return finti.file;
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
  opzioni: { aree: [{ id: "a1", nome: "Nord" }], canali: [{ id: "c1", nome: "Supermercati" }], reparti: ["Colazione", "Freschi"] },
  ...modifiche,
});

const apri = async (indirizzo = "/pop/in-corso") => {
  const periodo = new URL(indirizzo, "http://localhost").pathname.split("/")[2];
  const router = createMemoryRouter(
    [{ path: "/pop/:periodo", loader: () => ({ periodo }), element: <PopMateriali /> }],
    { initialEntries: [indirizzo] }
  );
  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1 });
  return router;
};

const tabellaFile = () => within(screen.getByRole("region", { name: /File del formato/ })).getByRole("table");

describe("POP per periodo", () => {
  beforeEach(() => {
    finti.permessi = ["file.download", "promo.visualizza"];
    finti.notifica.mockReset();
    finti.promozioni = ok({ promozioni });
    finti.riepilogo = ok(riepilogo);
    finti.file = ok(paginaFile());
    finti.promoRiepilogo = [];
    finti.filtriFile = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("elenca le promozioni del periodo con i file e apre la prima, con i suoi totali", async () => {
    await apri();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("POP · In corso");
    const elenco = screen.getByRole("complementary", { name: "Promozioni" });
    const prima = within(elenco).getByRole("link", { name: /Speciale Colazione/ });
    expect(prima).toHaveAttribute("aria-current", "true");
    expect(prima).toHaveTextContent("3.828");
    expect(within(elenco).getByRole("link", { name: /Pet Week/ })).not.toHaveAttribute("aria-current");
    expect(finti.promoRiepilogo.at(-1)).toBe("p1");

    expect(screen.getByRole("heading", { level: 2, name: "Speciale Colazione" })).toBeInTheDocument();
    expect(screen.getByText("POP · In corso · validità 16/10 – 29/10/2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vai ai volantini/ })).toHaveAttribute("href", "/volantini/in-corso?promo=p1");
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

  it("?promo= sceglie la promozione e la cerca filtra l'elenco", async () => {
    await apri("/pop/in-corso?promo=p2");

    const elenco = screen.getByRole("complementary", { name: "Promozioni" });
    expect(within(elenco).getByRole("link", { name: /Pet Week/ })).toHaveAttribute("aria-current", "true");
    expect(finti.promoRiepilogo.at(-1)).toBe("p2");

    fireEvent.change(within(elenco).getByRole("searchbox", { name: "Cerca promozione" }), { target: { value: "colazione" } });
    expect(within(elenco).queryByRole("link", { name: /Pet Week/ })).not.toBeInTheDocument();
    expect(within(elenco).getByRole("link", { name: /Speciale Colazione/ })).toHaveAttribute("href", "/pop/in-corso?promo=p1");
  });

  it("la tabella dei formati mostra file, avanzamento, kit con Apri kit e lo ZIP del formato", async () => {
    await apri();

    const formati = within(screen.getByRole("region", { name: "File per formato" })).getByRole("table");
    const [, riga1, riga2] = within(formati).getAllByRole("row");

    expect(within(riga1).getByRole("link", { name: "Cartello prezzi A5" })).toHaveAttribute("aria-current", "true");
    expect(within(riga1).getByText("1.842")).toBeInTheDocument();
    expect(within(riga1).getByRole("img")).toHaveAccessibleName(
      "File per stato del kit: 1.200 in lavorazione, 90 con errori, 552 in revisione"
    );
    expect(within(riga1).getByText("Nord · Supermercati")).toBeInTheDocument();
    expect(within(riga1).getByRole("link", { name: "Apri kit Cartello Nord" })).toHaveAttribute(
      "href",
      "/promozioni/in-corso/dettagli/p1/kits/k1"
    );
    expect(within(riga1).getByRole("link", { name: "Scarica ZIP di Cartello prezzi A5" })).toHaveAttribute(
      "href",
      "/api/materiali/pop/promozioni/p1/zip?periodo=in-corso&idFormato=f1"
    );

    // Il kit non avviato si apre dai kit della promo; scegliere il formato resta sulla promo
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
    await apri();

    expect(screen.getByRole("heading", { level: 2, name: "File del formato Cartello prezzi A5 · 1.842 file" })).toBeInTheDocument();
    const righe = within(tabellaFile()).getAllByRole("row");
    expect(righe).toHaveLength(3);
    expect(within(righe[1]).getByText("Caffè Lavazza Qualità Oro 250 g")).toBeInTheDocument();
    expect(within(righe[1]).getByText("0014823 · Colazione")).toBeInTheDocument();
    expect(within(righe[1]).getByTitle("In revisione")).toBeInTheDocument();
    expect(within(righe[1]).getByText("v2")).toBeInTheDocument();
    expect(within(righe[1]).getByRole("link", { name: "Scarica CP_A5_PV031_0014823.pdf" })).toHaveAttribute(
      "href",
      "/api/downloadPDFVolantino/olimpo-fi1?fileName=CP_A5_PV031_0014823.pdf"
    );

    expect(screen.getByText("Mostrati 1–100 di 1.842")).toBeInTheDocument();
    const righePerPagina = screen.getByLabelText("Righe per pagina");
    expect(within(righePerPagina).getAllByRole("option").map((opzione) => opzione.textContent)).toEqual(["100", "250", "500"]);

    fireEvent.change(righePerPagina, { target: { value: "250" } });
    expect(finti.filtriFile.at(-1)).toMatchObject({ dimensione: 250, pagina: 1 });
  });

  it("un filtro dei file arriva alla richiesta e riparte dalla prima pagina", async () => {
    await apri();

    fireEvent.click(screen.getByRole("button", { name: "Pagina 2" }));
    expect(finti.filtriFile.at(-1)).toMatchObject({ pagina: 2 });

    fireEvent.change(screen.getByLabelText("Stato file"), { target: { value: "ERRORE" } });
    expect(finti.filtriFile.at(-1)).toMatchObject({ stato: "ERRORE", pagina: 1 });
    expect(within(screen.getByLabelText("Reparto")).getByRole("option", { name: "Freschi" })).toBeInTheDocument();
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
    expect(within(barra).getByRole("link", { name: "Scarica ZIP" })).toHaveAttribute(
      "href",
      "/api/materiali/pop/promozioni/p1/zip?periodo=in-corso&idFormato=f1"
    );
    expect(screen.getByRole("checkbox", { name: "Seleziona CP_A5_PV031_0021407.pdf" })).toBeDisabled();

    fireEvent.click(within(barra).getByRole("button", { name: "Annulla selezione" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("con i filtri, tutti i file trovati si scaricano con gli stessi filtri", async () => {
    await apri();

    fireEvent.change(screen.getByLabelText("Reparto"), { target: { value: "Colazione" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleziona la pagina" }));
    fireEvent.click(screen.getByRole("button", { name: "Seleziona tutti i 1.842 file trovati" }));

    expect(within(screen.getByRole("status")).getByRole("link", { name: "Scarica ZIP" })).toHaveAttribute(
      "href",
      "/api/materiali/pop/promozioni/p1/zip?periodo=in-corso&idFormato=f1&reparto=Colazione"
    );
  });

  it("Scarica selezionati chiede lo ZIP dei file scelti, con il token CSRF", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("zip", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    window.URL.createObjectURL = vi.fn(() => "blob:zip");
    window.URL.revokeObjectURL = vi.fn();
    await apri();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleziona CP_A5_PV031_0021407.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Scarica selezionati" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [indirizzo, richiesta] = fetch.mock.calls[0] as [string, RequestInit];
    expect(indirizzo).toBe("/api/materiali/pop/promozioni/p1/zip");
    expect(richiesta.method).toBe("POST");
    expect(richiesta.credentials).toBe("include");
    expect((richiesta.headers as Headers).get("x-csrf-token")).toBe("token-csrf");
    expect(JSON.parse(richiesta.body as string)).toEqual({ periodo: "in-corso", idFormato: "f1", idFile: ["fi2"] });
    // Il file arriva e si salva con il nome di promo e formato, senza errori
    await waitFor(() => expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1));
    expect(finti.notifica).not.toHaveBeenCalled();
  });

  it("se lo ZIP non arriva lo dice con il motivo del server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "File non appartenenti al formato" }), { status: 400 }))
    );
    await apri();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleziona CP_A5_PV031_0021407.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Scarica selezionati" }));

    await waitFor(() =>
      expect(finti.notifica).toHaveBeenCalledWith("File non appartenenti al formato", { variant: "error" })
    );
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

    expect(screen.queryByRole("link", { name: /Apri kit/ })).not.toBeInTheDocument();
  });

  it("senza promozioni con file POP mostra lo stato vuoto del periodo", async () => {
    finti.promozioni = ok({ promozioni: [] });
    finti.riepilogo = { data: undefined, isError: false, error: null, refetch: vi.fn() };
    await apri();

    expect(screen.getByRole("heading", { name: "Nessun kit POP nelle promozioni in corso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vai alle promozioni in corso" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Promozioni" })).not.toBeInTheDocument();
  });

  it("con i filtri senza file propone Azzera filtri e riassume i filtri usati", async () => {
    await apri();
    finti.file = ok(paginaFile({ file: [], totale: 0 }));

    fireEvent.change(screen.getByLabelText("Stato file"), { target: { value: "ERRORE" } });

    expect(screen.getByRole("heading", { name: "Nessun file corrisponde ai filtri" })).toBeInTheDocument();
    expect(screen.getByText("Stato «Errore»")).toBeInTheDocument();
    const azzera = screen.getAllByRole("button", { name: "Azzera filtri" });
    fireEvent.click(azzera[azzera.length - 1]);
    expect(screen.getByLabelText("Stato file")).toHaveValue("");
    expect((finti.filtriFile.at(-1) as { stato?: string }).stato).toBeUndefined();
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
});
