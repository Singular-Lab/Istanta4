// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoxInsight, MenaboVolantino as Menabo } from "../../../../lib/insightVolantino/tipi";
import { coloreSezione, intervalliPagine, MenaboVolantino, pagineDelMenabo, sezioniDelMenabo, testoSuColore } from "./MenaboVolantino";

// Il menabò del volantino (spec insight-volantino, "Menabò del volantino"): un riquadro per pagina con
// la sezione delle sue referenze (per Conad CNO la mastro, col nome pulito) e il reparto con più box;
// lo stesso nome ha lo stesso colore, nomi diversi colori diversi; accanto le sezioni con le pagine.

const MENABO: Menabo = {
  pagine: [
    { pagina: 1, sezione: "COP-Copertina base", nome: "Copertina base" },
    { pagina: 3, sezione: "N1-NUMERI1", nome: "Numeri 1" },
    { pagina: 4, sezione: "Og-OFFERTE generiche", nome: "Offerte generiche" },
    { pagina: 5, sezione: "Og-OFFERTE generiche", nome: "Offerte generiche" },
    { pagina: 6, sezione: "FPC-FOCUS_PULIZIACASA", nome: "Focus puliziacasa" },
    { pagina: 7, sezione: "Og-OFFERTE generiche", nome: "Offerte generiche" },
  ],
};

type BoxDiProva = Pick<BoxInsight, "pagina" | "geometria" | "nome" | "marca" | "formato" | "reparto">;

let progressivo = 0;
const boxDi = (pagina: number, reparto: string | null, y = 0): BoxDiProva => ({
  pagina,
  nome: `Box ${++progressivo}`,
  marca: null,
  formato: null,
  geometria: { x: 0, y, w: 0.1, h: 0.1 },
  reparto: reparto ? { codice: reparto.slice(0, 2).toUpperCase(), descrizione: reparto } : null,
});

// Pagina 2 senza box; pagina 8 con box ma senza sezione (la pagina bianca)
const BOX: BoxDiProva[] = [
  boxDi(1, "Ortofrutta"),
  boxDi(3, "Drogheria"),
  boxDi(4, "Drogheria", 0),
  boxDi(4, "Ortofrutta", 0.1),
  boxDi(4, "Ortofrutta", 0.2),
  boxDi(5, "Latticini", 0),
  boxDi(5, "Carni", 0.1),
  boxDi(6, "Pulizia casa"),
  boxDi(7, "Bevande"),
  boxDi(8, "Drogheria"),
];

const elenco = () => screen.getByRole("list", { name: "Menabò: le pagine con la loro sezione" });

describe("pagineDelMenabo", () => {
  it("tutte le pagine, anche senza sezione; lo stesso nome ha lo stesso colore, nomi diversi colori diversi", () => {
    const pagine = pagineDelMenabo(MENABO, 8);

    expect(pagine.map(p => p.pagina)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(pagine[1]).toEqual({ pagina: 2, sezione: null, nome: null, colore: null, reparto: null, conProdotti: true });
    expect(pagine[7]?.sezione).toBeNull();
    const colore = (pagina: number) => pagine[pagina - 1]?.colore;
    expect(colore(4)).toBe(colore(5));
    expect(colore(4)).toBe(colore(7));
    expect(new Set([colore(1), colore(3), colore(4), colore(6)]).size).toBe(4);
  });

  it("con pagine nel menabò oltre il totale le mostra tutte", () => {
    expect(pagineDelMenabo(MENABO, 0)).toHaveLength(7);
  });

  it("due mastro con lo stesso nome pulito (dispensa doppia e singola) sono una sezione sola, con un colore", () => {
    const pagine = pagineDelMenabo(
      {
        pagine: [
          { pagina: 1, sezione: "DIS-DISPENSA_doppia", nome: "Dispensa" },
          { pagina: 2, sezione: "DIS-DISPENSA_singola", nome: "Dispensa" },
          { pagina: 3, sezione: "GAdx-GASTRONOMIA dx", nome: "Gastronomia" },
        ],
      },
      3
    );

    expect(pagine[0]?.colore).toBe(pagine[1]?.colore);
    expect(pagine[2]?.colore).not.toBe(pagine[0]?.colore);
    expect(sezioniDelMenabo(pagine).map(s => [s.nome, s.pagine])).toEqual([
      ["Dispensa", [1, 2]],
      ["Gastronomia", [3]],
    ]);
  });

  it("con i box: il reparto con più box della pagina, a parità il primo letto; le pagine senza box sono senza prodotti", () => {
    const pagine = pagineDelMenabo(MENABO, 8, BOX);

    expect(pagine[3]?.reparto).toBe("Ortofrutta");
    // Latticini e Carni hanno un box ciascuno: vince Latticini, più in alto nella pagina
    expect(pagine[4]?.reparto).toBe("Latticini");
    expect(pagine[1]?.conProdotti).toBe(false);
    expect(pagine[7]).toMatchObject({ sezione: null, conProdotti: true, reparto: "Drogheria" });
  });
});

describe("colori delle sezioni", () => {
  it("undici sezioni hanno undici colori diversi, e anche oltre i sedici della palette", () => {
    expect(new Set(Array.from({ length: 11 }, (_, i) => coloreSezione(i))).size).toBe(11);
    expect(new Set(Array.from({ length: 24 }, (_, i) => coloreSezione(i))).size).toBe(24);
  });

  it("il numero è bianco sui colori scuri e scuro sui colori chiari, con classi di testo HTML", () => {
    expect(testoSuColore("#2563eb")).toBe("text-white");
    expect(testoSuColore("#84cc16")).toBe("text-slate-900");
    expect(testoSuColore("#f59e0b")).toBe("text-slate-900");
    expect(testoSuColore(coloreSezione(20))).toMatch(/^text-/);
  });
});

describe("intervalliPagine", () => {
  it("raggruppa le pagine di fila in intervalli, senza ripetizioni", () => {
    expect(intervalliPagine([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 24, 25, 26])).toBe("12–21, 24–26");
    expect(intervalliPagine([3])).toBe("3");
    expect(intervalliPagine([7, 3, 4, 4, 9])).toBe("3–4, 7, 9");
    expect(intervalliPagine([])).toBe("");
  });
});

describe("MenaboVolantino", () => {
  it("un riquadro per pagina con numero, sezione e reparto; senza box 'Nessun prodotto'; con box e senza sezione un trattino spiegato", () => {
    render(<MenaboVolantino menabo={MENABO} totalePagine={8} pdf={null} box={BOX} onVaiAllaPagina={vi.fn()} />);

    const voci = within(elenco()).getAllByRole("listitem");
    expect(voci.map(voce => voce.textContent)).toEqual([
      "1Copertina baseOrtofrutta",
      "2Nessun prodotto",
      "3Numeri 1Drogheria",
      "4Offerte genericheOrtofrutta",
      "5Offerte genericheLatticini",
      "6Focus puliziacasaPulizia casa",
      "7Offerte genericheBevande",
      "8—Drogheria",
    ]);
    expect(within(elenco()).getByRole("button", { name: "Pagina 3: Numeri 1, reparto Drogheria" })).toHaveAttribute("title", "N1-NUMERI1");
    expect(within(elenco()).getByRole("button", { name: "Pagina 2: nessun prodotto" })).not.toHaveAttribute("title");
    expect(within(elenco()).getByRole("button", { name: "Pagina 8: nessuna sezione, reparto Drogheria" })).toBeInTheDocument();
    expect(screen.getByText(/pagina con prodotti ma senza sezione/)).toBeInTheDocument();
    expect(screen.getByText(/8 pagine/)).toHaveTextContent("8 pagine4 sezioni");
  });

  it("accanto ai riquadri le sezioni con il loro colore e le pagine a intervalli", () => {
    render(<MenaboVolantino menabo={MENABO} totalePagine={8} pdf={null} box={BOX} />);

    const sezioni = screen.getByRole("list", { name: "Le sezioni del volantino e le loro pagine" });
    expect(within(sezioni).getAllByRole("listitem").map(voce => voce.textContent)).toEqual([
      "Copertina base: 1",
      "Numeri 1: 3",
      "Offerte generiche: 4–5, 7",
      "Focus puliziacasa: 6",
    ]);
  });

  it("senza i box del volantino una pagina senza sezione mostra il trattino", () => {
    render(<MenaboVolantino menabo={MENABO} totalePagine={8} pdf={null} onVaiAllaPagina={vi.fn()} />);

    // Non si sa se la pagina 2 ha prodotti: niente "Nessun prodotto"
    expect(within(elenco()).getByRole("button", { name: "Pagina 2: nessuna sezione" })).toHaveTextContent("2—");
    expect(within(elenco()).getByRole("button", { name: "Pagina 3: Numeri 1" })).toHaveTextContent("3Numeri 1");
  });

  it("scegliendo una pagina, o la copertina, apre quella pagina; la pagina guardata è evidenziata", () => {
    const vai = vi.fn();
    render(<MenaboVolantino menabo={MENABO} totalePagine={8} pdf={null} paginaCorrente={4} onVaiAllaPagina={vai} />);

    expect(within(elenco()).getByRole("button", { name: "Pagina 4: Offerte generiche" })).toHaveAttribute("aria-current", "page");
    expect(within(elenco()).getByRole("button", { name: "Pagina 5: Offerte generiche" })).not.toHaveAttribute("aria-current");

    fireEvent.click(within(elenco()).getByRole("button", { name: "Pagina 6: Focus puliziacasa" }));
    expect(vai).toHaveBeenLastCalledWith(6);
    fireEvent.click(screen.getByRole("button", { name: "Apri la copertina nel volantino" }));
    expect(vai).toHaveBeenLastCalledWith(1);
  });

  it("il numero della pagina ha il colore della sezione e il testo leggibile sopra", () => {
    render(<MenaboVolantino menabo={MENABO} totalePagine={8} pdf={null} />);

    const numero = within(elenco()).getAllByRole("listitem")[0]?.querySelector("span[aria-hidden='true']") as HTMLElement;
    expect(numero.style.backgroundColor).not.toBe("");
    expect(numero.className).toMatch(/text-(white|slate-900)/);
    expect(numero.className).not.toMatch(/fill-/);
  });

  it("la copertina è la prima pagina del PDF da Olimpo, ridotta; pulsa finché arriva; se non si carica resta il foglio", () => {
    const { container } = render(<MenaboVolantino menabo={MENABO} totalePagine={8} pdf={{ idOlimpoCloud: "olimpo-1", pagine: 8 }} proporzione={0.5} />);

    const copertina = container.querySelector("img") as HTMLImageElement;
    expect(copertina.getAttribute("src")).toContain("olimpo-1");
    expect(copertina.getAttribute("src")).toContain("page=1");
    expect(copertina.parentElement).toHaveClass("animate-pulse");
    fireEvent.load(copertina);
    expect(copertina.parentElement).not.toHaveClass("animate-pulse");
    fireEvent.error(copertina);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Copertina")).toBeInTheDocument();
    // Senza comando i riquadri non sono pulsanti
    expect(within(elenco()).queryAllByRole("button")).toHaveLength(0);
  });
});
