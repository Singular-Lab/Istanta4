// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { tintaCategoria, TINTA_NEUTRA } from "@/components/Grafici";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { DistribuzionePagine, distribuzionePagine } from "./DistribuzionePagine";

const LATTICINI = { codice: "24", descrizione: "Latticini" };
const DROGHERIA = { codice: "01", descrizione: "Drogheria" };

const box = (id: string, pagina: number | null, spazio: number, campi: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: id,
  pagina,
  geometria: spazio > 0 ? { x: 0, y: 0, w: 0.5, h: 0.5 } : null,
  spazio,
  proporzionePagina: 0.7,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: null,
  formato: null,
  prezzo: null,
  barrato: null,
  sconto: null,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: null,
  meccanicaOriginale: null,
  reparto: LATTICINI,
  foto: [],
  prodotti: 1,
  idReferenze: [id],
  ...campi,
});

const gruppo = (voce: Pick<BoxInsight, "reparto">) =>
  voce.reparto ? { id: voce.reparto.codice, etichetta: voce.reparto.descrizione, tinta: TINTA_NEUTRA } : { id: "senza", etichetta: "Reparto non noto", tinta: TINTA_NEUTRA };

const BOX = [
  box("a", 1, 30, { idReferenze: ["a1", "a2"] }),
  box("b", 1, 20, { reparto: DROGHERIA }),
  box("c", 2, 10, { reparto: DROGHERIA }),
  box("d", 2, 0, { reparto: null }),
  box("e", 3, 60),
  box("f", 3, 70, { reparto: DROGHERIA, idReferenze: ["f1", "f2", "f3"] }),
];

describe("distribuzionePagine", () => {
  it("una colonna per pagina, anche vuota, con box, referenze e spazio per reparto", () => {
    const colonne = distribuzionePagine(BOX, 4, gruppo);

    expect(colonne.map(c => c.pagina)).toEqual([1, 2, 3, 4]);
    expect(colonne.map(c => c.box)).toEqual([2, 2, 2, 0]);
    // Le referenze dei box, come nei numeri del volantino: il box "a" ne ha due
    expect(colonne.map(c => c.referenze)).toEqual([3, 2, 4, 0]);
    expect(colonne[0].occupato).toBe(50);
    expect(colonne[0].parti.map(p => [p.etichetta, p.referenze, p.spazio])).toEqual([
      ["Drogheria", 1, 20],
      ["Latticini", 2, 30],
    ]);
    expect(colonne[3].parti).toEqual([]);
  });

  it("i reparti stanno nello stesso ordine in ogni pagina, dal più grande nel volantino per referenze; i box senza reparto in cima", () => {
    const colonne = distribuzionePagine(BOX, 3, gruppo);

    // Drogheria 5 referenze nel volantino, Latticini 3
    expect(colonne[0].parti.map(p => p.id)).toEqual(["01", "24"]);
    expect(colonne[2].parti.map(p => p.id)).toEqual(["01", "24"]);
    expect(colonne[1].parti.map(p => p.id)).toEqual(["01", "senza"]);
  });

  it("riquadri sovrapposti oltre la pagina valgono al più il 100%; i box senza pagina non contano", () => {
    const colonne = distribuzionePagine([...BOX, box("g", null, 40)], 3, gruppo);

    expect(colonne[2].occupato).toBe(100);
    expect(colonne.reduce((somma, c) => somma + c.box, 0)).toBe(6);
    expect(colonne.reduce((somma, c) => somma + c.referenze, 0)).toBe(9);
  });
});

describe("DistribuzionePagine", () => {
  const grafico = () => screen.getByRole("group", { name: "Referenze delle pagine per reparto" });

  it("ogni colonna è un pulsante con referenze, box, ingombro e reparti; sceglierla, col clic o con Invio, porta il volantino a quella pagina", () => {
    const onVaiAllaPagina = vi.fn();
    render(<DistribuzionePagine box={BOX} totalePagine={4} paginaCorrente={2} onVaiAllaPagina={onVaiAllaPagina} />);

    const colonne = within(grafico()).getAllByRole("button");
    expect(colonne).toHaveLength(4);
    expect(colonne[0]).toHaveAccessibleName("Pagina 1: 3 referenze, 2 box, 50% della pagina coperto; Drogheria 1 referenza; Latticini 2 referenze");
    expect(colonne[1]).toHaveAttribute("aria-current", "page");

    fireEvent.click(colonne[2]);
    expect(onVaiAllaPagina).toHaveBeenLastCalledWith(3);
    fireEvent.keyDown(colonne[3], { key: "Enter" });
    expect(onVaiAllaPagina).toHaveBeenLastCalledWith(4);
  });

  it("le colonne sono alte quanto le referenze, divise per reparto; la linea dell'ingombro passa per la parte coperta di ogni pagina", () => {
    const { container } = render(<DistribuzionePagine box={BOX} totalePagine={4} />);

    const altezza = (pagina: number, reparto: string) =>
      Number(container.querySelector(`[data-pagina='${pagina}'] [data-reparto='${reparto}']`)?.getAttribute("height"));
    // Pagina 3: 3 referenze di Drogheria e 1 di Latticini
    expect(altezza(3, "01")).toBeCloseTo(altezza(3, "24") * 3, 5);
    // Pagina 1: Latticini (2 referenze) doppio di Drogheria (1)
    expect(altezza(1, "24")).toBeCloseTo(altezza(1, "01") * 2, 5);
    expect(container.querySelector("[data-pagina='4'] [data-reparto]")).toBeNull();

    const yIngombro = (pagina: number) => Number(container.querySelector(`[data-ingombro='${pagina}']`)?.getAttribute("cy"));
    // Più ingombro, punto più in alto: pagina 3 al 100%, pagina 1 al 50%, pagina 4 a zero
    expect(yIngombro(3)).toBeLessThan(yIngombro(1));
    expect(yIngombro(1)).toBeLessThan(yIngombro(4));
    expect(screen.getByTestId("linea-ingombro").querySelector("polyline")).not.toBeNull();
    // Senza onVaiAllaPagina colonne e riquadri non sono pulsanti
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sotto il grafico un riquadro per pagina con referenze e pagina coperta, a parole intere; sceglierlo porta il volantino a quella pagina", () => {
    const onVaiAllaPagina = vi.fn();
    render(<DistribuzionePagine box={BOX} totalePagine={4} paginaCorrente={3} onVaiAllaPagina={onVaiAllaPagina} />);

    const riquadri = within(screen.getByRole("list", { name: "Pagine del volantino" })).getAllByRole("button");
    expect(riquadri).toHaveLength(4);
    expect(riquadri[0]).toHaveTextContent("13 referenze50% della pagina");
    expect(riquadri[0]).not.toHaveTextContent(/ref\.|ing\./);
    expect(riquadri[0]).toHaveAccessibleName("Pagina 1: 3 referenze, 50% della pagina coperta dai box");
    expect(riquadri[2]).toHaveAttribute("aria-current", "page");
    expect(riquadri[3]).toHaveTextContent("40 referenze0% della pagina");

    fireEvent.click(riquadri[1]);
    expect(onVaiAllaPagina).toHaveBeenLastCalledWith(2);
  });

  it("i reparti prendono gli stessi colori del volantino, con la legenda dei nomi e dell'ingombro", () => {
    const { container } = render(
      <DistribuzionePagine box={[box("a", 1, 30, { reparto: { ...LATTICINI, colore: "#0ea5e9" } }), box("b", 1, 20, { reparto: DROGHERIA })]} totalePagine={1} />
    );

    expect(container.querySelector("[data-reparto='24']")).toHaveAttribute("fill", "#0ea5e9");
    expect(container.querySelector("[data-reparto='01']")).toHaveAttribute("fill", tintaCategoria(0).colore);
    const legenda = screen.getByRole("list", { name: "Reparto" });
    expect(within(legenda).getByText("Latticini")).toBeInTheDocument();
    expect(within(legenda).getByText("Drogheria")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Legenda" })).getByText("Ingombro della pagina")).toBeInTheDocument();
  });

  it("le pagine arrivano fino all'ultimo box anche oltre quelle dichiarate, e i dati sono anche in tabella", () => {
    render(<DistribuzionePagine box={[box("a", 6, 10)]} totalePagine={2} onVaiAllaPagina={() => {}} />);

    expect(within(grafico()).getAllByRole("button")).toHaveLength(6);
    const tabella = screen.getByRole("table", { name: "Referenze delle pagine per reparto" });
    expect(within(tabella).getAllByRole("row")).toHaveLength(7);
    expect(within(tabella).getByRole("row", { name: /^6 1 1 10%/ })).toBeInTheDocument();
  });

  it("con molte pagine il grafico scorre in orizzontale invece di stringersi", () => {
    const molti = Array.from({ length: 40 }, (_, i) => box(`p${i}`, i + 1, 10));
    render(<DistribuzionePagine box={molti} totalePagine={40} />);

    expect(Number(grafico().getAttribute("width"))).toBeGreaterThanOrEqual(40 * 40);
    expect(screen.getByTestId("scorrimento-distribuzione")).toHaveClass("overflow-x-auto");
  });
});
