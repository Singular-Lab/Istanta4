// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RichiestaSimulazione, SimulazioneProdotto } from "../../../../lib/insightVolantino/rendimento";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { percorsoDettaglioVolantino } from "../../../../lib/materiali/periodi";
import { urlPaginaMateriale } from "@/utils/materiali";

// Il simulatore di un prodotto: scelta di prodotto, pagina, zona, spazio e sconto, validazione,
// richiesta al server solo con "Simula" e risultato (dallo storico o stima teorica)

const finti = vi.hoisted(() => ({
  simulazione: {} as Record<string, unknown>,
  richieste: [] as Array<[string | undefined, RichiestaSimulazione | null]>,
}));

vi.mock("@/query/flyerInsights", () => ({
  useSimulazioneProdotto: (idKit: string | undefined, richiesta: RichiestaSimulazione | null) => {
    finti.richieste.push([idKit, richiesta]);
    return finti.simulazione;
  },
}));

import { SimulatoreProdotto } from ".";

const box = (id: string, dati: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: id,
  pagina: 2,
  geometria: { x: 0.2, y: 0.1, w: 0.4, h: 0.2 },
  spazio: 8,
  proporzionePagina: 210 / 297,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: null,
  formato: null,
  prezzo: null,
  barrato: null,
  sconto: 25,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: null,
  meccanicaOriginale: null,
  reparto: null,
  foto: [],
  prodotti: 1,
  idReferenze: [],
  visibilita: 50,
  ...dati,
});

const BOX = [
  box("m", { nome: "Mozzarella", marca: "Granarolo" }),
  box("p", { nome: "Pasta", pagina: 5, sconto: null, spazio: 4, geometria: { x: 0.5, y: 0.5, w: 0.2, h: 0.2 } }),
];

const DALLO_STORICO: SimulazioneProdotto = {
  tipo: "vendite",
  unita: "pezzi",
  valore: 1234.4,
  indicePosizione: 1.25,
  casiStorici: 4,
  affidabilita: "media",
  casiSimili: [{ idKit: "k0", titolo: "Volantino settembre", data: "2026-09-01", pagina: 4, sconto: 30, spazio: 10, valore: 980 }],
  nota: "Stima dallo storico di 4 casi simili nella stessa area e canale.",
};

const stato = (dati: Partial<{ data: unknown; isLoading: boolean; isFetching: boolean; isError: boolean; error: Error | null }>) => ({
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  ...dati,
});

const disegna = (pdf: { idOlimpoCloud: string; pagine: number } | null = null) =>
  render(
    <MemoryRouter>
      <SimulatoreProdotto idKit="k1" box={BOX} pdf={pdf} totalePagine={8} />
    </MemoryRouter>
  );

const prodotto = () => screen.getByRole("combobox", { name: /^Prodotto/ }) as HTMLSelectElement;
const pagina = () => screen.getByRole("combobox", { name: "Pagina" }) as HTMLSelectElement;
const spazio = () => screen.getByRole("spinbutton", { name: "Spazio (% della pagina)" }) as HTMLInputElement;
const sconto = () => screen.getByRole("spinbutton", { name: "Sconto (%)" }) as HTMLInputElement;
const simula = () => fireEvent.click(screen.getByRole("button", { name: "Simula" }));
const ultimaRichiesta = () => finti.richieste.at(-1)?.[1] ?? null;

beforeEach(() => {
  finti.simulazione = stato({});
  finti.richieste = [];
});

describe("SimulatoreProdotto: scelta e validazione", () => {
  it("senza prodotto non simula e lo dice accanto al campo", () => {
    disegna();

    simula();

    expect(screen.getByText("Scegli il prodotto da simulare.")).toBeInTheDocument();
    expect(prodotto()).toHaveAttribute("aria-invalid", "true");
    expect(finti.richieste.every(([, richiesta]) => richiesta === null)).toBe(true);
    expect(screen.getByText(/poi premi Simula/)).toBeInTheDocument();
  });

  it("scelto un prodotto parte dalla sua pagina, posizione, spazio e sconto attuali", () => {
    disegna({ idOlimpoCloud: "olimpo-1", pagine: 8 });

    fireEvent.change(prodotto(), { target: { value: "c-m" } });

    expect(pagina().value).toBe("2");
    expect(spazio().value).toBe("8");
    expect(sconto().value).toBe("25");
    expect(screen.getByRole("button", { name: "Posizione attuale" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("riquadro-attuale")).toBeInTheDocument();
    expect(screen.getByTestId("riquadro-simulato")).toBeInTheDocument();
    // L'anteprima è la pagina scelta del PDF
    expect(screen.getByRole("group", { name: "Zona della pagina 2" }).querySelector("img")).toHaveAttribute("src", urlPaginaMateriale("olimpo-1", 2));
  });

  it("con spazio o sconto non validi non simula e dice perché", () => {
    disegna();
    fireEvent.change(prodotto(), { target: { value: "c-m" } });

    fireEvent.change(spazio(), { target: { value: "0" } });
    fireEvent.change(sconto(), { target: { value: "120" } });
    simula();

    expect(screen.getByText(/più di 0, al massimo 100/)).toBeInTheDocument();
    expect(screen.getByText(/da 0 a 99%/)).toBeInTheDocument();
    expect(ultimaRichiesta()).toBeNull();
  });

  it("in un'altra pagina la posizione attuale non c'è e si sceglie una zona della griglia", () => {
    disegna();
    fireEvent.change(prodotto(), { target: { value: "c-m" } });

    fireEvent.change(pagina(), { target: { value: "3" } });

    expect(screen.queryByRole("button", { name: "Posizione attuale" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("riquadro-attuale")).not.toBeInTheDocument();
    const griglia = screen.getByRole("group", { name: "Zona della pagina 3" });
    fireEvent.click(within(griglia).getByRole("button", { name: "In basso a sinistra" }));
    expect(within(griglia).getByRole("button", { name: "In basso a sinistra" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("In basso a sinistra", { selector: "span" })).toBeInTheDocument();
  });

  it("la ricerca restringe i prodotti per nome o marca", () => {
    disegna();

    fireEvent.change(screen.getByRole("searchbox", { name: "Cerca il prodotto" }), { target: { value: "granarolo" } });

    const opzioni = within(prodotto()).getAllByRole("option").map(opzione => opzione.textContent);
    expect(opzioni).toEqual(["Scegli un prodotto…", "Mozzarella · Granarolo · pagina 2"]);
  });
});

describe("SimulatoreProdotto: richiesta e risultato", () => {
  it("con Simula chiede la stima per prodotto, pagina, zona, spazio e sconto, e mostra il risultato", () => {
    finti.simulazione = stato({ data: DALLO_STORICO });
    disegna();
    fireEvent.change(prodotto(), { target: { value: "c-m" } });
    fireEvent.click(screen.getByRole("button", { name: "In alto a destra" }));
    // Il campo numerico del browser dà sempre il punto, anche se l'utente scrive la virgola
    fireEvent.change(spazio(), { target: { value: "12.5" } });

    simula();

    expect(ultimaRichiesta()).toEqual({ chiave: "c-m", pagina: 2, x: 0.8333, y: 0.1667, spazio: 12.5, sconto: 25 });
    expect(finti.richieste.at(-1)?.[0]).toBe("k1");
    const risultato = screen.getByRole("region", { name: "Risultato della simulazione" });
    expect(within(risultato).getByText("Dallo storico delle vendite")).toBeInTheDocument();
    expect(within(risultato).getByText("1.234 pezzi")).toBeInTheDocument();
    expect(within(risultato).getByText("1,25")).toBeInTheDocument();
    expect(within(risultato).getByText(/meglio della media delle posizioni del volantino/)).toBeInTheDocument();
    expect(within(risultato).getByText("Media")).toBeInTheDocument();
    expect(within(risultato).getByText("4 casi storici")).toBeInTheDocument();
    expect(within(risultato).getByText(DALLO_STORICO.nota)).toBeInTheDocument();
    const casi = within(risultato).getByRole("table", { name: "Casi simili nello storico" });
    expect(within(casi).getByRole("link", { name: "Volantino settembre" })).toHaveAttribute("href", percorsoDettaglioVolantino("k0", 4));
    expect(within(casi).getByText("980")).toBeInTheDocument();
  });

  it("la stima teorica lo dichiara e dà un indice di visibilità", () => {
    finti.simulazione = stato({
      data: {
        ...DALLO_STORICO,
        tipo: "teorica",
        unita: "indice",
        valore: 64,
        indicePosizione: 0.8,
        casiStorici: 0,
        affidabilita: "bassa",
        casiSimili: [],
        nota: "Stima teorica: nessuna vendita importata.",
      } satisfies SimulazioneProdotto,
    });
    disegna();
    fireEvent.change(prodotto(), { target: { value: "c-p" } });

    simula();

    expect(ultimaRichiesta()).toMatchObject({ chiave: "c-p", pagina: 5, sconto: null, spazio: 4 });
    const risultato = screen.getByRole("region", { name: "Risultato della simulazione" });
    expect(within(risultato).getByText("Stima teorica")).toBeInTheDocument();
    expect(within(risultato).getByText("Visibilità stimata")).toBeInTheDocument();
    expect(within(risultato).getByText("indice 64 su 100")).toBeInTheDocument();
    expect(within(risultato).getByText(/peggio della media/)).toBeInTheDocument();
    expect(within(risultato).getByText("Bassa")).toBeInTheDocument();
    expect(within(risultato).getByText(/Nessun caso simile nello storico/)).toBeInTheDocument();
    expect(within(risultato).getByText("Stima teorica: nessuna vendita importata.")).toBeInTheDocument();
  });

  it("cambiati i valori dopo una simulazione, avvisa che il risultato è quello di prima", () => {
    finti.simulazione = stato({ data: DALLO_STORICO });
    disegna();
    fireEvent.change(prodotto(), { target: { value: "c-m" } });
    simula();
    expect(screen.queryByText(/Hai cambiato i valori/)).not.toBeInTheDocument();

    fireEvent.change(sconto(), { target: { value: "40" } });

    expect(screen.getByText(/Hai cambiato i valori: premi Simula/)).toBeInTheDocument();
    simula();
    expect(ultimaRichiesta()).toMatchObject({ sconto: 40 });
    expect(screen.queryByText(/Hai cambiato i valori/)).not.toBeInTheDocument();
  });

  it("in caricamento lo dice; in errore mostra il motivo e permette di riprovare", () => {
    finti.simulazione = stato({ isLoading: true, isFetching: true });
    const { unmount } = disegna();
    fireEvent.change(prodotto(), { target: { value: "c-m" } });
    simula();
    expect(screen.getByRole("status")).toHaveTextContent("Simulazione in corso…");
    unmount();

    const errore = stato({ isError: true, error: new Error("Parametri non validi") });
    finti.simulazione = errore;
    disegna();
    fireEvent.change(prodotto(), { target: { value: "c-m" } });
    simula();
    expect(screen.getByText("Simulazione non riuscita")).toBeInTheDocument();
    expect(screen.getByText("Parametri non validi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Riprova/ }));
    expect(errore.refetch).toHaveBeenCalled();
  });
});
