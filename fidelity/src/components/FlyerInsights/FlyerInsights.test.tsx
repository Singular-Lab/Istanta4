// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
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

import FlyerInsights from "./FlyerInsights";

const sezioneConfig = (enabled?: boolean) => ({ title: "Sezione", enabled }) as unknown as FlyerInsightsConfig["reparti"];

const CONFIG = {
  dataMapping: { referenzaFields: {} },
  reparti: sezioneConfig(),
  meccaniche: sezioneConfig(),
  pagine: sezioneConfig(),
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

const titoliSezioni = () => screen.getAllByRole("heading", { level: 2 }).map(titolo => titolo.textContent);
const regione = (nome: string) => screen.getByRole("region", { name: nome });

describe("FlyerInsights", () => {
  beforeEach(() => {
    finti.config = { data: CONFIG, isError: false };
  });

  it("mostra le analisi come sezioni separate, senza schede: Reparti, Meccaniche e sconti, Marche", () => {
    render(<FlyerInsights insights={insights()} exportCodes={[EXPORT_DI_SISTEMA.VOL]} />);

    expect(titoliSezioni()).toEqual(["Reparti", "Meccaniche e sconti", "Marche"]);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /mappa|zone calde/i })).not.toBeInTheDocument();
  });

  it("ogni sezione ha il suo contenuto: spazio per reparto, sconti e sottocosto, tabella delle marche", () => {
    render(<FlyerInsights insights={insights()} />);

    const spazioReparti = within(regione("Reparti")).getByRole("table", { name: "Spazio e referenze per reparto" });
    // Drogheria compare anche nella tabella dello sconto medio per reparto: qui conta quella dello spazio
    expect(within(spazioReparti).getByRole("rowheader", { name: "Drogheria" })).toBeInTheDocument();
    expect(within(regione("Meccaniche e sconti")).getByRole("heading", { name: "Fasce di sconto" })).toBeInTheDocument();
    expect(within(regione("Meccaniche e sconti")).getByText("Zucchero")).toBeInTheDocument();
    expect(within(regione("Marche")).getByRole("table", { name: "Marche nel volantino" })).toBeInTheDocument();
  });

  it("i reparti hanno anche lo sconto medio per reparto, preso da prezzi e sconti", () => {
    render(<FlyerInsights insights={insights()} />);

    const tabella = within(regione("Reparti")).getByRole("table", { name: "Sconto medio per reparto" });
    expect(within(tabella).getByRole("rowheader", { name: "Drogheria" })).toBeInTheDocument();
    expect(within(regione("Meccaniche e sconti")).queryByRole("table", { name: "Sconto medio per reparto" })).not.toBeInTheDocument();
  });

  it("con le linee del distributore le marche non ripetono la quota del distributore per nome di marca", () => {
    const quotaDistributore = { quotaSpazio: 40, quotaBox: 50 };
    const conMarche = (campi: Partial<DatiFlyerInsights>) => insights({ marche: { ...insights().marche, quotaDistributore }, ...campi });
    const { unmount } = render(<FlyerInsights insights={conMarche({})} />);
    expect(within(regione("Marche")).getByRole("region", { name: "Marche del distributore" })).toBeInTheDocument();
    unmount();

    render(
      <FlyerInsights
        insights={conMarche({ lineeDistributore: { quotaSpazio: 10, quotaBox: 10, box: 1, linee: [], bolli: [] } })}
      />
    );
    expect(within(regione("Marche")).queryByRole("region", { name: "Marche del distributore" })).not.toBeInTheDocument();
  });

  it("reparti e meccaniche stanno affiancati sugli schermi larghi", () => {
    render(<FlyerInsights insights={insights()} />);

    expect(regione("Reparti").parentElement).toHaveClass("lg:grid-cols-2");
    expect(regione("Meccaniche e sconti").parentElement).toBe(regione("Reparti").parentElement);
  });

  it("la config della GDO può spegnere reparti e meccaniche; le marche restano", () => {
    finti.config = { data: { ...CONFIG, reparti: sezioneConfig(false) }, isError: false };
    const { unmount } = render(<FlyerInsights insights={insights()} />);
    expect(titoliSezioni()).toEqual(["Meccaniche e sconti", "Marche"]);
    expect(regione("Meccaniche e sconti").parentElement).not.toHaveClass("lg:grid-cols-2");
    unmount();

    finti.config = { data: { ...CONFIG, reparti: sezioneConfig(false), meccaniche: sezioneConfig(false) }, isError: false };
    render(<FlyerInsights insights={insights()} />);
    expect(titoliSezioni()).toEqual(["Marche"]);
  });

  it("senza config, o mentre si carica, le sezioni ci sono: i dati vengono dal server", () => {
    finti.config = { data: undefined, isError: true };
    const { unmount } = render(<FlyerInsights insights={insights()} />);
    expect(titoliSezioni()).toEqual(["Reparti", "Meccaniche e sconti", "Marche"]);
    unmount();

    finti.config = { data: { ...CONFIG, meccaniche: undefined }, isError: false };
    render(<FlyerInsights insights={insights()} />);
    expect(titoliSezioni()).toEqual(["Reparti", "Meccaniche e sconti", "Marche"]);
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

    expect(titoliSezioni()).toEqual(["Reparti", "Meccaniche e sconti", "Marche"]);
    expect(within(regione("Meccaniche e sconti")).getByText("Zucchero")).toBeInTheDocument();
  });

  it("una risposta senza le sezioni nuove mostra uno stato vuoto invece di rompersi", () => {
    const vecchia = insights({ prezziSconti: undefined, sintesi: undefined, box: undefined } as unknown as Partial<DatiFlyerInsights>);
    render(<FlyerInsights insights={vecchia} />);

    expect(within(regione("Meccaniche e sconti")).getByText("Analisi non disponibile")).toBeInTheDocument();
  });

  it("senza esportazione VOL o senza referenze mostra lo stato vuoto di sempre", () => {
    const { rerender } = render(<FlyerInsights insights={insights()} exportCodes={[]} />);
    expect(screen.getByText("Per questo kit non è presente il tipo di esportazione VOL")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Reparti" })).not.toBeInTheDocument();

    rerender(<FlyerInsights insights={insights({ totaleReferenze: 0 })} />);
    expect(screen.getByText("Nessuna referenza trovata")).toBeInTheDocument();
  });

  it("mentre gli insight caricano mostra lo scheletro", () => {
    render(<FlyerInsights insights={null} isLoading />);

    expect(screen.getByRole("heading", { level: 2, name: "Analisi del volantino" })).toBeInTheDocument();
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
  });
});
