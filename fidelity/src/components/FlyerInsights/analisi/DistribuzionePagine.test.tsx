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
  box("a", 1, 30),
  box("b", 1, 20, { reparto: DROGHERIA }),
  box("c", 2, 10, { reparto: DROGHERIA }),
  box("d", 2, 0, { reparto: null }),
  box("e", 3, 60),
  box("f", 3, 70, { reparto: DROGHERIA }),
];

describe("distribuzionePagine", () => {
  it("una colonna per pagina, anche vuota, con box e spazio per reparto", () => {
    const colonne = distribuzionePagine(BOX, 4, gruppo);

    expect(colonne.map(c => c.pagina)).toEqual([1, 2, 3, 4]);
    expect(colonne.map(c => c.box)).toEqual([2, 2, 2, 0]);
    expect(colonne[0].occupato).toBe(50);
    expect(colonne[0].parti.map(p => [p.etichetta, p.spazio])).toEqual([
      ["Drogheria", 20],
      ["Latticini", 30],
    ]);
    expect(colonne[3].parti).toEqual([]);
  });

  it("i reparti stanno nello stesso ordine in ogni pagina, dal più grande nel volantino; i box senza reparto in cima", () => {
    const colonne = distribuzionePagine(BOX, 3, gruppo);

    // Drogheria 100 di spazio nel volantino, Latticini 90
    expect(colonne[2].parti.map(p => p.id)).toEqual(["01", "24"]);
    expect(colonne[1].parti.map(p => p.id)).toEqual(["01", "senza"]);
  });

  it("riquadri sovrapposti oltre la pagina valgono al più il 100%; i box senza pagina non contano", () => {
    const colonne = distribuzionePagine([...BOX, box("g", null, 40)], 3, gruppo);

    expect(colonne[2].occupato).toBe(100);
    expect(colonne.reduce((somma, c) => somma + c.box, 0)).toBe(6);
  });
});

describe("DistribuzionePagine", () => {
  it("ogni pagina è un pulsante con box e reparti; sceglierlo, col clic o con Invio, porta il volantino a quella pagina", () => {
    const onVaiAllaPagina = vi.fn();
    render(<DistribuzionePagine box={BOX} totalePagine={4} paginaCorrente={2} onVaiAllaPagina={onVaiAllaPagina} />);

    const grafico = screen.getByRole("group", { name: "Spazio delle pagine per reparto" });
    const colonne = within(grafico).getAllByRole("button");
    expect(colonne).toHaveLength(4);
    expect(colonne[0]).toHaveAccessibleName("Pagina 1: 2 box, 50% della pagina coperto; Drogheria 20%; Latticini 30%");
    expect(colonne[1]).toHaveAttribute("aria-current", "page");

    fireEvent.click(colonne[2]);
    expect(onVaiAllaPagina).toHaveBeenLastCalledWith(3);
    fireEvent.keyDown(colonne[3], { key: "Enter" });
    expect(onVaiAllaPagina).toHaveBeenLastCalledWith(4);
  });

  it("sotto ogni colonna il numero della pagina e i box", () => {
    const { container } = render(<DistribuzionePagine box={BOX} totalePagine={4} />);

    const quarta = container.querySelector("[data-pagina='4']")!;
    expect(quarta).toHaveTextContent("4");
    expect(quarta).toHaveTextContent("0 box");
    expect(container.querySelector("[data-pagina='1']")).toHaveTextContent("2 box");
    // Senza onVaiAllaPagina le colonne non sono pulsanti
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("i reparti prendono gli stessi colori del volantino, con la legenda dei nomi", () => {
    const { container } = render(
      <DistribuzionePagine box={[box("a", 1, 30, { reparto: { ...LATTICINI, colore: "#0ea5e9" } }), box("b", 1, 20, { reparto: DROGHERIA })]} totalePagine={1} />
    );

    expect(container.querySelector("[data-reparto='24']")).toHaveAttribute("fill", "#0ea5e9");
    expect(container.querySelector("[data-reparto='01']")).toHaveAttribute("fill", tintaCategoria(0).colore);
    const legenda = screen.getByRole("list", { name: "Reparto" });
    expect(within(legenda).getByText("Latticini")).toBeInTheDocument();
    expect(within(legenda).getByText("Drogheria")).toBeInTheDocument();
  });

  it("le pagine arrivano fino all'ultimo box anche oltre quelle dichiarate, e i dati sono anche in tabella", () => {
    render(<DistribuzionePagine box={[box("a", 6, 10)]} totalePagine={2} onVaiAllaPagina={() => {}} />);

    expect(screen.getAllByRole("button")).toHaveLength(6);
    const tabella = screen.getByRole("table", { name: "Spazio delle pagine per reparto" });
    expect(within(tabella).getAllByRole("row")).toHaveLength(7);
  });

  it("con molte pagine il grafico scorre in orizzontale invece di stringersi", () => {
    const molti = Array.from({ length: 40 }, (_, i) => box(`p${i}`, i + 1, 10));
    render(<DistribuzionePagine box={molti} totalePagine={40} />);

    const svg = screen.getByRole("group", { name: "Spazio delle pagine per reparto" });
    expect(Number(svg.getAttribute("width"))).toBeGreaterThanOrEqual(40 * 44);
    expect(screen.getByTestId("scorrimento-distribuzione")).toHaveClass("overflow-x-auto");
  });
});
