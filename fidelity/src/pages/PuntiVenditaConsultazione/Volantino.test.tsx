// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATO_PROMO } from "../../../lib/enums";
import type { BoxVolantino, DettaglioVolantinoPv, ReferenzaSintesi } from "../../../lib/puntiVendita/analisi";

// Un volantino nella storia del punto vendita (/punti-vendita/:id/volantini/:idKit): numeri, pagine,
// pagina con i box colorati per sconto, meccanica o reparto, referenze, spazio per meccanica e riga stampata

const finti = vi.hoisted(() => ({
  volantino: {} as Record<string, unknown>,
  richieste: [] as Array<[string, string]>,
}));

vi.mock("@/components/SessionChecker", () => ({ default: <P extends object>(Componente: ComponentType<P>) => Componente }));
vi.mock("@/query/query", () => ({
  useFetchVolantinoPuntoVendita: (idPv: string, idKit: string) => {
    finti.richieste.push([idPv, idKit]);
    return finti.volantino;
  },
  useFetchPuntoVenditaConsultazione: () => ({ data: { id: "pv1", nome: "Conad Lucca" }, isLoading: false, isError: false }),
  useFetchReteInsegne: () => ({ data: undefined }),
}));

import VolantinoPuntoVendita from "./Volantino";

const referenza = (chiave: string, nome: string, dati: Partial<ReferenzaSintesi> = {}): ReferenzaSintesi => ({
  chiave,
  nome,
  marca: "Granarolo",
  formato: "3 × 100 g",
  prezzo: 1.69,
  barrato: 2.95,
  sconto: 43,
  foto: null,
  ...dati,
});

const box = (id: string, dati: Partial<BoxVolantino>): BoxVolantino => ({
  id,
  x: 0,
  y: 0,
  w: 0.5,
  h: 0.4,
  spazio: 20,
  meccanica: "sconto",
  reparto: "Freschi",
  sconto: 43,
  referenze: [],
  ...dati,
});

const COPERTURA = { conCodice: 90, conReparto: 35, conPrezzo: 95, conMarca: 80 };

const VOLANTINO: DettaglioVolantinoPv = {
  kit: { id: "k2", titolo: "P2621_VOL_23-10-26" },
  promo: { id: "p2", nome: "Promo ottobre", stato: STATO_PROMO.VALIDA, validitaDal: "2026-10-23", validitaAl: "2026-11-05" },
  canale: { id: "c2", nome: "Conad Superstore" },
  area: { id: "a1", nome: "Toscana" },
  pdf: { idFile: "f1", idOlimpoCloud: "olimpo-2", nome: "Volantino ottobre", pagine: 3 },
  numeri: {
    pagine: 3,
    referenze: 4,
    daListino: 132,
    manuali: 16,
    scontoMedio: 31.2,
    scontoMedioPrecedente: 28.8,
    fidelity: 38,
    puntiVenditaInLista: 212,
    puntiVenditaAbbinati: 209,
  },
  pagine: [
    {
      numero: 1,
      proporzione: 210 / 297,
      boxes: [
        box("b-piccolo", { x: 0.5, spazio: 9, meccanica: "fidelity", reparto: "Drogheria", sconto: 10, referenze: [referenza("spaghetti", "Spaghetti n.5", { marca: "Barilla" })] }),
        box("b-grande", { spazio: 26, referenze: [referenza("mozzarella", "Mozzarella Alta Qualità"), referenza("ricotta", "Ricotta")] }),
        box("b-vuoto", { y: 0.5, spazio: 5, sconto: null, referenze: [] }),
      ],
    },
    { numero: 2, proporzione: 210 / 297, boxes: [box("b-p2", { referenze: [referenza("tonno", "Tonno all'olio", { marca: "Rio Mare" })] })] },
  ],
  meccaniche: [
    { meccanica: "fidelity", spazio: 29 },
    { meccanica: "sconto", spazio: 34 },
  ],
  rigaPuntoVendita: {
    riga: "LUCCA - Via Roma 1 - tel. 0583 123456",
    abbinamento: "telefono",
    regione: "TOSCANA",
    provincia: "LUCCA",
    vicine: [
      { riga: "CAPANNORI - Via Piave 2 - tel. 0583 111111", questo: false },
      { riga: "LUCCA - Via Roma 1 - tel. 0583 123456", questo: true },
      { riga: "LUCCA - Viale Europa 9 - tel. 0583 222222", questo: false },
    ],
  },
  precedente: { idKit: "k1", dal: "2026-10-09" },
  successivo: null,
  copertura: COPERTURA,
};

const caricato = <T,>(data: T) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });

function Indirizzo() {
  const posizione = useLocation();
  return <output data-testid="indirizzo">{posizione.pathname + posizione.search}</output>;
}

function PaginaReferenza() {
  const { chiave } = useParams();
  return <div>Scheda della referenza {chiave}</div>;
}

const apri = (percorso = "/punti-vendita/pv1/volantini/k2") =>
  render(
    <MemoryRouter initialEntries={[percorso]}>
      <Routes>
        <Route
          path="/punti-vendita/:id/volantini/:idKit"
          element={
            <>
              <VolantinoPuntoVendita />
              <Indirizzo />
            </>
          }
        />
        <Route path="/punti-vendita/:id/referenze/:chiave" element={<PaginaReferenza />} />
        <Route path="/punti-vendita/:id" element={<div>Scheda del punto vendita</div>} />
      </Routes>
    </MemoryRouter>
  );

const sezione = (titolo: string | RegExp) => screen.getByRole("region", { name: titolo });
const indirizzo = () => screen.getByTestId("indirizzo").textContent;

describe("Volantino nella storia del punto vendita", () => {
  beforeEach(() => {
    finti.volantino = caricato(VOLANTINO);
    finti.richieste = [];
  });

  it("chiede il volantino del punto vendita; il percorso è solo nel breadcrumb della barra, non nella pagina", () => {
    apri();

    expect(finti.richieste.at(-1)).toEqual(["pv1", "k2"]);
    expect(screen.queryByRole("navigation", { name: "Percorso" })).not.toBeInTheDocument();
    // Tornando alla scheda il volantino resta quello scelto nella timeline
    expect(screen.getByRole("link", { name: "Torna al punto vendita" })).toHaveAttribute("href", "/punti-vendita/pv1?volantino=k2");
  });

  it("intestazione: insegna, area, validità; precedente, successivo e PDF", () => {
    apri();

    expect(screen.getByRole("heading", { level: 1, name: "Promo ottobre" })).toBeInTheDocument();
    const testata = screen.getByRole("heading", { level: 1 }).parentElement!.parentElement!;
    expect(testata).toHaveTextContent("Conad Superstore");
    expect(testata).toHaveTextContent("Toscana");
    expect(testata).toHaveTextContent("Validità: 23 ottobre – 5 novembre 2026");
    expect(testata).toHaveTextContent("P2621_VOL_23-10-26");
    expect(screen.getByRole("link", { name: /Precedente/ })).toHaveAttribute("href", "/punti-vendita/pv1/volantini/k1");
    expect(screen.getByRole("button", { name: /Successivo/ })).toBeDisabled();
    const pdf = screen.getByRole("link", { name: /Scarica PDF/ });
    expect(pdf).toHaveAttribute("href", "/olimpo/materiali/getMaterialePDF?id=olimpo-2");
    expect(pdf).toHaveAttribute("download", "Volantino ottobre.pdf");
  });

  it("numeri: referenze da listino e a mano, sconto sul precedente, punti vendita riconosciuti", () => {
    apri();

    const numeri = screen.getByLabelText("Il volantino in numeri");
    expect(numeri).toHaveTextContent("132 dal listino DB1, 16 compilate a mano");
    expect(numeri).toHaveTextContent("31,2%");
    expect(numeri).toHaveTextContent("+2,4 punti sul precedente");
    expect(numeri).toHaveTextContent("209 riconosciuti in anagrafica");
  });

  it("numeri: senza referenze compilate a mano dice che vengono tutte dal listino, non \"0 compilate a mano\"", () => {
    finti.volantino = caricato({ ...VOLANTINO, numeri: { ...VOLANTINO.numeri, daListino: 4, manuali: 0 } });
    apri();

    const numeri = screen.getByLabelText("Il volantino in numeri");
    expect(numeri).toHaveTextContent("tutte dal listino DB1");
    expect(numeri).not.toHaveTextContent("compilate a mano");
  });

  it("un volantino arrivato senza le pagine: un riquadro lo dice, niente pagina vuota, miniature né \"0 pagine\"", () => {
    finti.volantino = caricato({ ...VOLANTINO, numeri: { ...VOLANTINO.numeri, pagine: 0 }, pagine: [], meccaniche: [] });
    apri();

    expect(sezione("Pagine del volantino")).toHaveTextContent("Pagine non disponibili");
    expect(screen.queryByRole("navigation", { name: "Pagine del volantino" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^Pagina \d/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Referenze per pagina" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Spazio per meccanica" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Il volantino in numeri")).not.toHaveTextContent("pagine");
    // La riga del punto vendita nella lista resta
    expect(sezione("Il punto vendita in questo volantino")).toBeInTheDocument();
  });

  it("il colore dei box si sceglie sopra la pagina, non accanto al titolo", () => {
    apri();

    const pagina = sezione("Pagina 1");
    const segmenti = within(pagina).getByRole("radiogroup", { name: "Colore dei box" });
    expect(segmenti.closest(".sezione-intestazione")).toBeNull();
  });

  it("senza pagina nell'indirizzo mostra la prima con i box; cambiando pagina la pagina va nell'indirizzo", async () => {
    apri();

    const pagine = screen.getByRole("navigation", { name: "Pagine del volantino" });
    expect(within(pagine).getAllByRole("button")).toHaveLength(3);
    expect(within(pagine).getByRole("button", { name: "Pagina 1, 3 referenze" })).toHaveAttribute("aria-current", "page");
    expect(sezione("Pagina 1")).toBeInTheDocument();

    await userEvent.click(within(pagine).getByRole("button", { name: "Pagina 2, 1 referenza" }));

    expect(indirizzo()).toBe("/punti-vendita/pv1/volantini/k2?pagina=2");
    expect(within(pagine).getByRole("button", { name: "Pagina 2, 1 referenza" })).toHaveAttribute("aria-current", "page");
    expect(within(sezione("Referenze della pagina")).getByRole("link", { name: /Tonno all'olio/ })).toBeInTheDocument();
  });

  it("la pagina arriva dall'indirizzo; una pagina senza box lo dice", () => {
    apri("/punti-vendita/pv1/volantini/k2?pagina=3");

    expect(sezione("Pagina 3")).toHaveTextContent("Nessun box in questa pagina");
    expect(sezione("Referenze della pagina")).toHaveTextContent("Nessuna referenza");
  });

  it("le colonne delle referenze per pagina aprono la pagina", () => {
    apri();

    const colonne = sezione("Referenze per pagina");
    expect(within(colonne).getByRole("button", { name: "Pagina 1: 3" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(colonne).getByRole("button", { name: "Pagina 2: 1" }));

    expect(indirizzo()).toBe("/punti-vendita/pv1/volantini/k2?pagina=2");
  });

  it("i box sono al loro posto con lo sconto scritto dentro; colore per sconto con la legenda delle classi", () => {
    apri();

    const pagina = sezione("Pagina 1");
    expect(within(pagina).getAllByRole("button", { name: /della pagina/ })).toHaveLength(2);
    expect(within(pagina).getByRole("img", { name: /Box senza referenze/ })).toBeInTheDocument();
    expect(within(pagina).getByText("−43%")).toBeInTheDocument();
    const legenda = within(pagina).getByRole("list", { name: "Sconto del box" });
    expect(legenda).toHaveTextContent("≥ 48%");
    expect(legenda).toHaveTextContent("senza sconto");
  });

  it("colore per meccanica e per reparto: cambiano legenda ed etichette; il reparto parziale lo dice", async () => {
    apri();

    const pagina = sezione("Pagina 1");
    await userEvent.click(within(pagina).getByRole("radio", { name: "Meccanica" }));
    expect(within(pagina).getByRole("list", { name: "Meccanica" })).toHaveTextContent("Prezzo Fidelity");
    expect(pagina).toHaveTextContent("colorati per meccanica");

    await userEvent.click(within(pagina).getByRole("radio", { name: "Reparto" }));
    const legenda = within(pagina).getByRole("list", { name: "Reparto" });
    expect(within(legenda).getAllByRole("listitem").map(v => v.textContent)).toEqual(["Drogheria", "Freschi", "reparto non noto"]);
    expect(pagina).toHaveTextContent("Dato parziale: il reparto arriva da DB1 o da Istanta ed è noto per il 35% delle referenze.");
  });

  it("clic su un box apre la referenza pilota del box", () => {
    apri();

    fireEvent.click(within(sezione("Pagina 1")).getByRole("button", { name: /^Mozzarella Alta Qualità/ }));

    expect(screen.getByText("Scheda della referenza mozzarella")).toBeInTheDocument();
  });

  it("la referenza indicata nell'indirizzo ha il suo box contornato", () => {
    apri("/punti-vendita/pv1/volantini/k2?pagina=1&referenza=ricotta");

    expect(within(sezione("Pagina 1")).getByRole("button", { name: /^Mozzarella Alta Qualità/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(sezione("Pagina 1")).getByRole("button", { name: /^Spaghetti/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("referenze della pagina dal box più grande, ognuna apre la sua scheda", () => {
    apri();

    const voci = within(within(sezione("Referenze della pagina")).getByRole("list")).getAllByRole("link");
    expect(voci.map(v => v.textContent?.split("Granarolo")[0].split("Barilla")[0])).toEqual(["Mozzarella Alta Qualità", "Ricotta", "Spaghetti n.5"]);
    expect(voci[0]).toHaveAttribute("href", "/punti-vendita/pv1/referenze/mozzarella");
    expect(voci[0]).toHaveTextContent("26% della pagina");
    expect(voci[0]).toHaveTextContent("€ 1,69");
  });

  it("spazio per meccanica dalla più grande", () => {
    apri();

    const grafico = within(sezione("Spazio per meccanica")).getByRole("img", { name: "Spazio per meccanica" });
    expect(within(grafico).getAllByText(/^(Sconto in %|Prezzo Fidelity)$/).map(t => t.textContent)).toEqual(["Sconto in %", "Prezzo Fidelity"]);
  });

  it("il punto vendita nella lista stampata: la sua riga evidenziata, con il tipo di abbinamento", () => {
    apri();

    const riquadro = sezione("Il punto vendita in questo volantino");
    expect(riquadro).toHaveTextContent("TOSCANA · Provincia di LUCCA");
    const righe = within(within(riquadro).getByRole("list", { name: "Lista dei punti vendita stampata" })).getAllByRole("listitem");
    expect(righe).toHaveLength(3);
    expect(righe[1]).toHaveAttribute("aria-current", "true");
    expect(righe[1]).toHaveTextContent("Questo punto vendita · per telefono");
    expect(righe[0]).not.toHaveAttribute("aria-current");
    expect(righe[0]).not.toHaveTextContent("Questo punto vendita");
  });

  it("un volantino che non è nella storia del punto vendita: \"Volantino non trovato\" e ritorno alla scheda", async () => {
    finti.volantino = { data: undefined, isLoading: false, isError: true, error: Object.assign(new Error("Non trovato"), { httpStatus: 404 }), refetch: vi.fn() };
    apri();

    expect(screen.getByText("Volantino non trovato")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Torna al punto vendita/ }));
    expect(screen.getByText("Scheda del punto vendita")).toBeInTheDocument();
  });

  it("se il volantino non arriva per un altro motivo: l'errore con \"Riprova\"", async () => {
    const refetch = vi.fn();
    finti.volantino = { data: undefined, isLoading: false, isError: true, error: new Error("Timeout"), refetch };
    apri();

    expect(screen.getByRole("alert")).toHaveTextContent("Volantino non caricato");
    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalled();
  });
});
