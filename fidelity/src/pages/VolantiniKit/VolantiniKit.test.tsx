// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaginaKitVolantini, SchedaKitVolantino } from "../../../lib/materiali/tipi";

const finti = vi.hoisted(() => ({
  risultato: {} as Record<string, unknown>,
  filtri: [] as unknown[],
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/components/PreviewImmaginePdf", () => ({ PreviewImmaginePdf: () => null }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: () => true }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { getUrl: () => "" } }));
vi.mock("@/query/query", () => ({
  useFetchKitVolantini: (filtri: unknown) => {
    finti.filtri.push(filtri);
    return finti.risultato;
  },
}));

import VolantiniKit from ".";

const promo = {
  id: "p1",
  nome: "Speciale Colazione",
  stato: "IN_LAVORAZIONE",
  validitaDal: "2026-10-16",
  validitaAl: "2026-10-29",
} as SchedaKitVolantino["promo"];

const kit = (modifiche: Partial<SchedaKitVolantino> = {}): SchedaKitVolantino => ({
  id: "k1",
  idDesign: "d1",
  titolo: "Volantino 16 pagine",
  stato: "IN_LAVORAZIONE" as SchedaKitVolantino["stato"],
  tipo: null,
  promo,
  area: { id: "a1", nome: "Centro" },
  canale: { id: "c1", nome: "Supermercati" },
  formato: null,
  numeroFile: 3,
  copertina: null,
  ...modifiche,
});

const pagina = (modifiche: Partial<PaginaKitVolantini> = {}): PaginaKitVolantini => ({
  kit: [kit()],
  totale: 1,
  totaleSenzaFiltri: 1,
  pagina: 1,
  dimensione: 24,
  opzioni: {
    promozioni: [{ id: "p1", nome: "Speciale Colazione" }],
    aree: [{ id: "a1", nome: "Centro" }],
    canali: [{ id: "c1", nome: "Supermercati" }],
  },
  avvisi: [],
  ...modifiche,
});

const caricato = (dati: PaginaKitVolantini) => ({
  data: dati,
  isError: false,
  error: null,
  isPlaceholderData: false,
  refetch: vi.fn(),
});

const apri = async (indirizzo = "/volantini/in-corso") => {
  const periodo = new URL(indirizzo, "http://localhost").pathname.split("/")[2];
  const router = createMemoryRouter(
    [{ path: "/volantini/:periodo", loader: () => ({ periodo }), element: <VolantiniKit /> }],
    { initialEntries: [indirizzo] }
  );
  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1 });
  return router;
};

describe("Volantini per periodo", () => {
  beforeEach(() => {
    finti.risultato = caricato(pagina());
    finti.filtri = [];
  });

  it("titolo e descrizione dicono il periodo; la card mostra promo, area, canale e numero di file", async () => {
    await apri();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Volantini · In corso");
    expect(screen.getByText(/Kit volantino in lavorazione nelle promozioni in corso/)).toBeInTheDocument();
    const scheda = screen.getByRole("article");
    expect(within(scheda).getByRole("link", { name: "Volantino 16 pagine" })).toHaveAttribute(
      "href",
      "/promozioni/in-corso/dettagli/p1/kits/k1"
    );
    expect(within(scheda).getByRole("link", { name: "Promo: Speciale Colazione" })).toHaveAttribute(
      "href",
      "/promozioni/in-corso/dettagli/p1"
    );
    expect(within(scheda).getByText("Centro")).toBeInTheDocument();
    expect(within(scheda).getByText("Supermercati")).toBeInTheDocument();
    expect(within(scheda).getByText("3 file")).toBeInTheDocument();
    expect(within(scheda).getByTitle("In lavorazione")).toBeInTheDocument();
    expect(screen.getByText("1 kit · 1 promozione")).toBeInTheDocument();
  });

  it("il periodo arriva alla richiesta e Vai a POP porta allo stesso periodo", async () => {
    await apri("/volantini/attivi");

    expect(finti.filtri.at(-1)).toMatchObject({ periodo: "attivi", pagina: 1 });
    expect(screen.getByRole("link", { name: /Vai a POP · attivi/ })).toHaveAttribute("href", "/pop/attivi");
  });

  it("il filtro per stato c'è solo In corso, con Non avviato fra le scelte", async () => {
    await apri("/volantini/in-corso");
    const stato = screen.getByLabelText("Stato");
    expect(within(stato).getByRole("option", { name: "Non avviato" })).toBeInTheDocument();
  });

  it.each(["attivi", "storico"])("nel periodo %s non c'è il filtro per stato", async (periodo) => {
    await apri(`/volantini/${periodo}`);

    expect(screen.queryByLabelText("Stato")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Promozione")).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText("Area")).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText("Canale")).toBeInstanceOf(HTMLSelectElement);
  });

  it("uno stato nell'indirizzo fuori dal periodo In corso non filtra", async () => {
    await apri("/volantini/storico?stato=IN_REVISIONE");

    expect(finti.filtri.at(-1)).toMatchObject({ periodo: "storico" });
    expect((finti.filtri.at(-1) as { stato?: string }).stato).toBeUndefined();
  });

  it("?promo= preseleziona la promozione, filtra e resta nel link verso POP", async () => {
    await apri("/volantini/in-corso?promo=p1");

    expect(screen.getByLabelText("Promozione")).toHaveValue("p1");
    expect(finti.filtri.at(-1)).toMatchObject({ idPromo: "p1" });
    expect(screen.getByRole("link", { name: /Vai a POP · in corso/ })).toHaveAttribute("href", "/pop/in-corso?promo=p1");
  });

  it("scegliere un filtro aggiorna l'indirizzo e riparte dalla prima pagina", async () => {
    const router = await apri("/volantini/in-corso?pagina=3");

    fireEvent.change(screen.getByLabelText("Area"), { target: { value: "a1" } });

    await waitFor(() => expect(router.state.location.search).toBe("?area=a1"));
    await waitFor(() => expect(screen.getByLabelText("Area")).toHaveValue("a1"));
    expect(finti.filtri.at(-1)).toMatchObject({ idArea: "a1", pagina: 1 });
  });

  it("un kit non avviato porta ai kit della promo e dice che non ha file", async () => {
    finti.risultato = caricato(pagina({ kit: [kit({ id: null, stato: "NON_AVVIATO", numeroFile: 0 })] }));
    await apri();

    const scheda = screen.getByRole("article");
    expect(within(scheda).getByRole("link", { name: "Volantino 16 pagine" })).toHaveAttribute(
      "href",
      "/promozioni/in-corso/dettagli/p1/kits"
    );
    expect(within(scheda).getByTitle("Non avviato")).toBeInTheDocument();
    expect(within(scheda).getByText("Nessun file")).toBeInTheDocument();
  });

  it("i kit di una promo archiviata portano al suo dettaglio nello storico", async () => {
    finti.risultato = caricato(pagina({ kit: [kit({ stato: "PUBBLICATO" as SchedaKitVolantino["stato"], promo: { ...promo, stato: "ARCHIVIATA" } as SchedaKitVolantino["promo"] })] }));
    await apri("/volantini/storico");

    expect(screen.getByRole("link", { name: "Volantino 16 pagine" })).toHaveAttribute(
      "href",
      "/promozioni/storico/dettagli/p1/kits/k1"
    );
  });

  it("segnala la promo di cui non si sono potuti leggere i kit non avviati", async () => {
    finti.risultato = caricato(
      pagina({ avvisi: [{ promo: { id: "p1", nome: "Speciale Colazione" }, motivo: "Istanta non risponde" }] })
    );
    await apri();

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("Elenco incompleto");
    expect(avviso).toHaveTextContent("Speciale Colazione");
    expect(avviso).toHaveTextContent("Istanta non risponde");
  });

  it("senza kit nel periodo mostra lo stato vuoto del periodo, non quello dei filtri", async () => {
    finti.risultato = caricato(pagina({ kit: [], totale: 0, totaleSenzaFiltri: 0 }));
    await apri();

    expect(screen.getByRole("heading", { name: "Nessun kit volantino in lavorazione" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vai alle promozioni in corso" })).toBeInTheDocument();
    expect(screen.queryByText("Nessun kit corrisponde ai filtri")).not.toBeInTheDocument();
    expect(screen.getByText("0 kit")).toBeInTheDocument();
  });

  it("con i filtri senza risultati propone Azzera filtri, che toglie i filtri dall'indirizzo", async () => {
    finti.risultato = caricato(pagina({ kit: [], totale: 0, totaleSenzaFiltri: 6 }));
    const router = await apri("/volantini/in-corso?cerca=locandina&area=a1");

    expect(screen.getByRole("heading", { name: "Nessun kit corrisponde ai filtri" })).toBeInTheDocument();
    expect(screen.queryByText("Nessun kit volantino in lavorazione")).not.toBeInTheDocument();
    expect(screen.getByText("0 kit con i filtri attivi")).toBeInTheDocument();

    const azzera = screen.getAllByRole("button", { name: "Azzera filtri" });
    fireEvent.click(azzera[azzera.length - 1]);

    await waitFor(() => expect(router.state.location.search).toBe(""));
    await waitFor(() => expect(screen.getByLabelText("Area")).toHaveValue(""));
    expect(screen.getByRole("searchbox", { name: "Cerca" })).toHaveValue("");
  });

  it("se i kit non arrivano mostra il motivo e Riprova, mai lo stato vuoto", async () => {
    const refetch = vi.fn();
    finti.risultato = {
      data: undefined,
      isError: true,
      error: new Error("Servizio materiali non raggiungibile"),
      isPlaceholderData: false,
      refetch,
    };
    await apri();

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("Kit non caricati");
    expect(avviso).toHaveTextContent("Servizio materiali non raggiungibile");
    expect(screen.queryByText("Nessun kit volantino in lavorazione")).not.toBeInTheDocument();
    expect(screen.queryByText("Nessun kit corrisponde ai filtri")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("durante il primo caricamento mostra le schede segnaposto", async () => {
    finti.risultato = { data: undefined, isError: false, error: null, isPlaceholderData: false, refetch: vi.fn() };
    await apri();

    expect(screen.getByRole("list", { name: "Caricamento dei kit" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Caricamento dei kit…")).toBeInTheDocument();
  });
});
