// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlyerInsights as DatiFlyerInsights, FlyerInsightsConfig } from "@/types/flyerInsights";
import type { BoxInsight } from "../../../lib/insightVolantino/tipi";
import { EXPORT_DI_SISTEMA } from "../../../lib/enums";

const finti = vi.hoisted(() => ({
  config: { data: undefined, isError: false } as { data: unknown; isError: boolean },
}));

vi.mock("@/query/query", () => ({
  useFetchFlyerInsightsConfig: () => finti.config,
  useFetchReteInsegne: () => ({ data: undefined }),
}));
// I riepiloghi di sempre disegnano con chart.js e la config: qui conta solo che ci siano
vi.mock("./RiepilogoReparti", () => ({ default: () => <div>Riepilogo reparti</div> }));
vi.mock("./RiepilogoMeccaniche", () => ({ default: () => <div>Riepilogo meccaniche</div> }));
vi.mock("./RiepilogoPagine", () => ({
  default: ({ selectedPage }: { selectedPage: number | null }) => <div>Riepilogo pagine {selectedPage ?? "tutte"}</div>,
}));

import FlyerInsights from "./FlyerInsights";

const sezione = (enabled?: boolean) => ({ title: "Sezione", enabled }) as unknown as FlyerInsightsConfig["reparti"];

const CONFIG = {
  dataMapping: { referenzaFields: {} },
  reparti: sezione(),
  meccaniche: sezione(),
  pagine: sezione(),
} as FlyerInsightsConfig;

const box = (id: string, campi: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: id,
  pagina: 2,
  geometria: { x: 0, y: 0, w: 0.5, h: 0.5 },
  spazio: 25,
  proporzionePagina: 0.7,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: "Marca A",
  formato: null,
  prezzo: 1.5,
  barrato: 2,
  sconto: 25,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: "sconto",
  meccanicaOriginale: null,
  reparto: { codice: "01", descrizione: "Drogheria" },
  foto: [],
  prodotti: 1,
  idReferenze: [id],
  ...campi,
});

const insights = (campi: Partial<DatiFlyerInsights> = {}): DatiFlyerInsights => ({
  guidIdKitRuntime: "k1",
  contesto: { titolo: "Volantino", nomeArea: "Nord", nomeCanale: "Super", idPromo: "p1" },
  totaleReferenze: 2,
  totalePagine: 8,
  riepilogoPagine: [{ pagina: 3, numeroReferenze: 1, ingombroTotalePerc: 10, reparti: [] }],
  riepilogoReparti: [{ sigla: "01", descrizione: "Drogheria", numeroReferenze: 2, pagine: [2] }],
  riepilogoMeccaniche: [],
  referenze: [],
  pdf: { idOlimpoCloud: "o1", pagine: 8 },
  box: [box("b1"), box("b2", { nome: "Zucchero", sottocosto: true, prezzo: 0.79 })],
  sintesi: {
    referenze: 2,
    box: 2,
    pagine: 8,
    scontoMedio: 25,
    boxConSconto: 2,
    quotaFidelity: 0,
    sottocosto: 1,
    marche: 1,
    copertura: { prezzo: 100, marca: 100, reparto: 100, geometria: 100 },
  },
  prezziSconti: {
    fasce: [0, 10, 20, 30, 40, 50].map(da => ({ da, a: da === 50 ? null : da + 10, box: da === 20 ? 2 : 0 })),
    perReparto: [{ chiave: "01", etichetta: "Drogheria", box: 2, scontoMedio: 25 }],
    perMeccanica: [{ chiave: "sconto", etichetta: "Sconto in %", box: 2, scontoMedio: 25 }],
    sottocosto: ["b2"],
    conPrezzoAlKg: 0,
  },
  spazio: {
    perReparto: [{ chiave: "01", etichetta: "Drogheria", referenze: 2, spazio: 50, quotaReferenze: 100, quotaSpazio: 100 }],
    perMeccanica: [],
    perMarca: [],
    perPagina: [{ pagina: 2, box: 2, spazioOccupato: 50 }],
  },
  marche: {
    elenco: [{ chiave: "MARCA A", nome: "Marca A", box: 2, referenze: 2, quotaSpazio: 100, scontoMedio: 25, distributore: false }],
    quotaDistributore: null,
  },
  ...campi,
});

const nomiSchede = () => screen.getAllByRole("tab").map(scheda => scheda.textContent);

describe("FlyerInsights", () => {
  beforeEach(() => {
    finti.config = { data: CONFIG, isError: false };
  });

  it("mette le analisi nuove prima dei riepiloghi di sempre, in sentence case, senza la mappa visiva né le zone calde", () => {
    render(<FlyerInsights insights={insights()} exportCodes={[EXPORT_DI_SISTEMA.VOL]} />);

    expect(nomiSchede()).toEqual(["Prezzi e sconti", "Spazio", "Marche", "Reparti", "Meccaniche", "Pagine"]);
    expect(screen.queryByRole("tab", { name: /mappa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /zone calde/i })).not.toBeInTheDocument();
  });

  it("si apre su Prezzi e sconti, senza la riga di StatCard che ora è della sintesi nella pagina", () => {
    const { container } = render(<FlyerInsights insights={insights()} />);

    expect(screen.getByRole("tab", { name: "Prezzi e sconti" })).toHaveAttribute("aria-selected", "true");
    const pannello = screen.getByRole("tabpanel");
    expect(within(pannello).getByRole("heading", { name: "Fasce di sconto" })).toBeInTheDocument();
    expect(within(pannello).getByText("Zucchero")).toBeInTheDocument();
    expect(container.querySelector("[data-tono]")).toBeNull();
  });

  it("passa da una scheda all'altra: marche, spazio e reparti", async () => {
    render(<FlyerInsights insights={insights()} />);

    await userEvent.click(screen.getByRole("tab", { name: "Marche" }));
    expect(screen.getByRole("table", { name: "Marche nel volantino" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Spazio" }));
    expect(screen.getByRole("table", { name: "Spazio e referenze per reparto" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Reparti" }));
    expect(screen.getByText("Riepilogo reparti")).toBeInTheDocument();
  });

  it("con una pagina nell'indirizzo si apre sul riepilogo per pagina", () => {
    render(<FlyerInsights insights={insights()} paginaSelezionata={3} />);

    expect(screen.getByRole("tab", { name: "Pagine" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Riepilogo pagine 3")).toBeInTheDocument();
  });

  it("senza config dell'installazione restano le analisi e spariscono i riepiloghi", () => {
    finti.config = { data: undefined, isError: true };
    render(<FlyerInsights insights={insights()} paginaSelezionata={3} />);

    expect(nomiSchede()).toEqual(["Prezzi e sconti", "Spazio", "Marche"]);
    // La pagina chiesta non ha la sua scheda: si apre la prima analisi
    expect(screen.getByRole("tab", { name: "Prezzi e sconti" })).toHaveAttribute("aria-selected", "true");
  });

  it("la config può spegnere un riepilogo, e una sezione che non ha non diventa una scheda", () => {
    finti.config = { data: { ...CONFIG, reparti: sezione(false), meccaniche: undefined }, isError: false };
    render(<FlyerInsights insights={insights()} />);

    expect(nomiSchede()).toEqual(["Prezzi e sconti", "Spazio", "Marche", "Pagine"]);
  });

  it("mentre la config si carica i riepiloghi ci sono, con lo spinner", async () => {
    finti.config = { data: undefined, isError: false };
    render(<FlyerInsights insights={insights()} />);

    await userEvent.click(screen.getByRole("tab", { name: "Meccaniche" }));
    expect(within(screen.getByRole("tabpanel")).getByRole("status")).toHaveTextContent("Caricamento…");
  });

  it("un kit dello storico ha le stesse analisi", () => {
    render(
      <FlyerInsights
        insights={insights({
          origineStorico: { codice: "s1" } as unknown as DatiFlyerInsights["origineStorico"],
          box: [box("b1", { origine: "listino" }), box("b2", { nome: "Zucchero", sottocosto: true, origine: "fuori_listino" })],
        })}
      />
    );

    expect(nomiSchede()).toHaveLength(6); // come un kit normale: senza la scheda Zone calde
    expect(within(screen.getByRole("tabpanel")).getByText("Zucchero")).toBeInTheDocument();
  });

  it("una risposta senza le sezioni nuove mostra uno stato vuoto invece di rompersi", () => {
    const vecchia = insights({ prezziSconti: undefined, sintesi: undefined, box: undefined } as unknown as Partial<DatiFlyerInsights>);
    render(<FlyerInsights insights={vecchia} />);

    expect(within(screen.getByRole("tabpanel")).getByText("Analisi non disponibile")).toBeInTheDocument();
  });

  it("senza esportazione VOL o senza referenze mostra lo stato vuoto di sempre", () => {
    const { rerender } = render(<FlyerInsights insights={insights()} exportCodes={[]} />);
    expect(screen.getByText("Per questo kit non è presente il tipo di esportazione VOL")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();

    rerender(<FlyerInsights insights={insights({ totaleReferenze: 0 })} />);
    expect(screen.getByText("Nessuna referenza trovata")).toBeInTheDocument();
  });
});
