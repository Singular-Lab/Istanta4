// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DifferenzaProdotto,
  DifferenzeVarianti as DatiDifferenze,
  VolantinoDiRiferimento,
} from "../../../../lib/insightVolantino/tipi";
import type { FlyerInsights } from "@/types/flyerInsights";

const finti = vi.hoisted(() => ({
  richieste: [] as Array<{ idKit: string | undefined; idAltra: string | null | undefined }>,
  risposte: {} as Record<string, Record<string, unknown>>,
}));

vi.mock("@/query/flyerInsights", () => ({
  useDifferenzeVarianti: (idKit: string | undefined, idAltra: string | null | undefined) => {
    finti.richieste.push({ idKit, idAltra });
    return finti.risposte[idAltra ?? ""] ?? { data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() };
  },
}));
// Il visualizzatore ha i suoi test: qui conta che i due lati ricevano stati e la stessa pagina
vi.mock("@/components/FlyerInsights/volantino", () => ({
  VolantinoSfogliabile: ({
    idKit,
    titolo,
    pagina,
    totalePagine,
    statoBox,
    box,
    onCambiaPagina,
  }: {
    idKit: string;
    titolo?: string;
    pagina?: number;
    totalePagine: number;
    statoBox?: Record<string, string>;
    box: unknown[];
    onCambiaPagina?: (pagina: number) => void;
  }) => (
    <div>
      <p>
        {titolo}: kit {idKit}, pagina {pagina ?? "nessuna"} di {totalePagine}, {box.length} box, stati{" "}
        {Object.entries(statoBox ?? {})
          .map(([id, stato]) => `${id}=${stato}`)
          .join(" ")}
      </p>
      <button type="button" onClick={() => onCambiaPagina?.((pagina ?? 1) + 2)}>
        Avanti {idKit}
      </button>
    </div>
  ),
}));

import { DifferenzeVarianti } from "./DifferenzeVarianti";

const riferimento = (idKit: string, area: string, canale: string, titolo = "Volantino ottobre"): VolantinoDiRiferimento => ({
  idKit,
  titolo,
  idPromo: "p1",
  nomePromo: "Promo ottobre",
  area,
  canale,
  validitaDal: "2026-10-01",
  validitaAl: "2026-10-14",
  storico: false,
});

const insights = {
  guidIdKitRuntime: "k1",
  totalePagine: 8,
  pdf: { idOlimpoCloud: "olimpo-1", pagine: 8 },
  box: [{ id: "q1" }, { id: "q2" }],
} as unknown as FlyerInsights;

const differenza = (chiave: string, stato: DifferenzaProdotto["stato"], paginaQui: number | null, paginaAltra: number | null): DifferenzaProdotto => ({
  chiave,
  nome: `Prodotto ${chiave}`,
  marca: null,
  stato,
  qui: paginaQui === null ? null : { idBox: `q-${chiave}`, pagina: paginaQui, prezzo: 1.99, sconto: 20, spazio: 3 },
  altra: paginaAltra === null ? null : { idBox: `a-${chiave}`, pagina: paginaAltra, prezzo: stato === "prezzo-diverso" ? 2.49 : 1.99, sconto: null, spazio: 3 },
});

const dati = (altra: VolantinoDiRiferimento, differenze: DifferenzaProdotto[] = []): DatiDifferenze => ({
  qui: riferimento("k1", "Nord", "Super"),
  altra,
  pdfAltra: { idOlimpoCloud: `olimpo-${altra.idKit}`, pagine: 6 },
  boxAltra: [{ id: "a1" }] as unknown as DatiDifferenze["boxAltra"],
  statoBoxQui: { q1: "solo-qui", q2: "uguale" },
  statoBoxAltra: { a1: "solo-altra" },
  differenze,
  conteggi: {
    "solo-qui": differenze.filter((voce) => voce.stato === "solo-qui").length,
    "solo-altra": differenze.filter((voce) => voce.stato === "solo-altra").length,
    "prezzo-diverso": differenze.filter((voce) => voce.stato === "prezzo-diverso").length,
    uguale: 7,
  },
});

const caricato = (valore: unknown) => ({ data: valore, isLoading: false, isError: false, error: null, refetch: vi.fn() });

const sud = riferimento("k2", "Sud", "Super");
const iper = riferimento("k3", "Nord", "Iper");

const differenzeSud = [
  differenza("x1", "solo-qui", 2, null),
  differenza("x2", "solo-altra", null, 3),
  differenza("x3", "prezzo-diverso", 4, 5),
];

const mostra = (varianti: VolantinoDiRiferimento[], caricamento = false) =>
  render(
    <MemoryRouter>
      <DifferenzeVarianti idKit="k1" insights={insights} varianti={varianti} caricamento={caricamento} />
    </MemoryRouter>
  );

describe("Differenze fra le varianti della promo", () => {
  beforeEach(() => {
    finti.richieste = [];
    finti.risposte = {
      k2: caricato(dati(sud, differenzeSud)),
      k3: caricato(dati(iper, [differenza("y1", "solo-qui", 1, null)])),
    };
  });

  it("senza altre varianti lo dice e non chiede differenze", () => {
    mostra([]);

    expect(screen.getByText("Questa promo non ha altre varianti area/canale")).toBeInTheDocument();
    expect(finti.richieste.every((richiesta) => !richiesta.idAltra)).toBe(true);
  });

  it("mentre le varianti caricano mostra l'attesa", () => {
    const { container } = mostra([], true);

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText("Questa promo non ha altre varianti area/canale")).not.toBeInTheDocument();
  });

  it("confronta subito con la prima variante e affianca i due volantini con i loro stati", () => {
    mostra([sud, iper]);

    expect(finti.richieste.at(-1)).toEqual({ idKit: "k1", idAltra: "k2" });
    expect(screen.getByRole("radio", { name: "Sud · Super" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Questo volantino · Nord · Super: kit k1, pagina 1 di 8, 2 box, stati q1=solo-qui q2=uguale")).toBeInTheDocument();
    expect(screen.getByText("Sud · Super: kit k2, pagina 1 di 6, 1 box, stati a1=solo-altra")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Apri gli insight di Sud · Super/ })).toHaveAttribute("href", "/volantini/tutti_i_volantini?kit=k2");
  });

  it("scegliendo un'altra variante chiede le sue differenze", () => {
    mostra([sud, iper]);

    fireEvent.click(screen.getByRole("radio", { name: "Nord · Iper" }));
    expect(finti.richieste.at(-1)).toEqual({ idKit: "k1", idAltra: "k3" });
    expect(screen.getByText(/^Nord · Iper: kit k3/)).toBeInTheDocument();
    expect(screen.getByText("Prodotto y1")).toBeInTheDocument();
  });

  it("con molte varianti la scelta è un elenco a discesa", () => {
    const varianti = ["A", "B", "C", "D", "E"].map((area, indice) => riferimento(`v${indice}`, area, "Super"));
    finti.risposte.v3 = caricato(dati(varianti[3]));
    mostra(varianti);

    const scelta = screen.getByRole("combobox", { name: "Variante da confrontare" });
    expect(scelta).toHaveValue("v0");
    fireEvent.change(scelta, { target: { value: "v3" } });
    expect(finti.richieste.at(-1)).toEqual({ idKit: "k1", idAltra: "v3" });
  });

  it("distingue due varianti con stessa area e canale aggiungendo il titolo", () => {
    mostra([riferimento("k2", "Sud", "Super", "Volantino A"), riferimento("k4", "Sud", "Super", "Volantino B")]);

    expect(screen.getByRole("radio", { name: "Sud · Super (Volantino A)" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Sud · Super (Volantino B)" })).toBeInTheDocument();
  });

  it("i due volantini sfogliano insieme", () => {
    mostra([sud]);

    fireEvent.click(screen.getByRole("button", { name: "Avanti k2" }));
    expect(screen.getByText(/^Questo volantino · Nord · Super: kit k1, pagina 3 di 8/)).toBeInTheDocument();
    expect(screen.getByText(/^Sud · Super: kit k2, pagina 3 di 6/)).toBeInTheDocument();
  });

  it("conta le differenze per tipo, le filtra e indica i prodotti uguali", () => {
    mostra([sud]);
    const tipi = screen.getByRole("radiogroup", { name: "Tipo di differenza" });

    expect(within(tipi).getByRole("radio", { name: "Tutte 3" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("7 prodotti uguali nelle due varianti")).toBeInTheDocument();
    const tabella = screen.getByRole("table", { name: "Prodotti diversi fra questo volantino e Sud · Super" });
    expect(within(tabella).getAllByRole("row")).toHaveLength(4);

    fireEvent.click(within(tipi).getByRole("radio", { name: "Solo nell'altra 1" }));
    expect(within(tabella).getAllByRole("row")).toHaveLength(2);
    expect(within(tabella).getByText("Prodotto x2")).toBeInTheDocument();
    expect(within(tabella).getByText("Solo nell'altra variante")).toBeInTheDocument();
    expect(within(tabella).getByText("Assente")).toBeInTheDocument();
  });

  it("mostra prezzi e sconti delle due varianti e porta i volantini alla pagina del prodotto", () => {
    mostra([sud]);
    const riga = screen.getByText("Prodotto x3").closest("tr") as HTMLElement;

    expect(within(riga).getByText("€ 1,99")).toBeInTheDocument();
    expect(within(riga).getByText("−20%")).toBeInTheDocument();
    expect(within(riga).getByText("€ 2,49")).toBeInTheDocument();

    fireEvent.click(within(riga).getByRole("button", { name: "Mostra la pagina 5 in Sud · Super" }));
    expect(screen.getByText(/^Questo volantino · Nord · Super: kit k1, pagina 5 di 8/)).toBeInTheDocument();
    expect(screen.getByText(/^Sud · Super: kit k2, pagina 5 di 6/)).toBeInTheDocument();
  });

  it("filtrando un tipo senza prodotti lo dice", () => {
    finti.risposte.k2 = caricato(dati(sud, [differenza("x1", "solo-qui", 2, null)]));
    mostra([sud]);

    fireEvent.click(screen.getByRole("radio", { name: "Prezzo diverso 0" }));
    expect(screen.getByText("Nessuna differenza di questo tipo.")).toBeInTheDocument();
  });

  it("se le varianti coincidono lo dice al posto dell'elenco", () => {
    finti.risposte.k2 = caricato(dati(sud, []));
    mostra([sud]);

    expect(screen.getByText("Nessuna differenza")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("oltre le prime 25 differenze le mostra tutte a richiesta", () => {
    const molte = Array.from({ length: 30 }, (_, indice) => differenza(`z${indice}`, "solo-qui", 1, null));
    finti.risposte.k2 = caricato(dati(sud, molte));
    mostra([sud]);
    const tabella = screen.getByRole("table");

    expect(within(tabella).getAllByRole("row")).toHaveLength(26);
    fireEvent.click(screen.getByRole("button", { name: "Mostra tutte (30)" }));
    expect(within(tabella).getAllByRole("row")).toHaveLength(31);
  });

  it("se le differenze non arrivano mostra il motivo e permette di riprovare", () => {
    const refetch = vi.fn();
    finti.risposte.k2 = { data: undefined, isLoading: false, isError: true, error: new Error("Variante non trovata"), refetch };
    mostra([sud]);

    expect(screen.getByRole("alert")).toHaveTextContent("Differenze non caricate");
    expect(screen.getByText("Variante non trovata")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Riprova/ }));
    expect(refetch).toHaveBeenCalled();
  });

  it("mentre le differenze caricano tiene la scelta della variante e mostra l'attesa", () => {
    finti.risposte.k2 = { data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() };
    const { container } = mostra([sud]);

    expect(screen.getByRole("radio", { name: "Sud · Super" })).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});
