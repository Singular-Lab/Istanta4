// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { RendimentoBox, RendimentoVolantino } from "../../../../lib/insightVolantino/rendimento";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { Rendimento, testoTotaleVendite, vociRendimentoReparto, type RendimentoProps } from "./Rendimento";

const box = (id: string, nome: string, reparto: string | null, pagina = 2): BoxInsight => ({
  id,
  codiceBox: id,
  pagina,
  geometria: { x: 0, y: 0, w: 0.5, h: 0.5 },
  spazio: 25,
  proporzionePagina: 0.7,
  chiave: `c-${id}`,
  nome,
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
  reparto: reparto ? { codice: reparto.slice(0, 2).toUpperCase(), descrizione: reparto } : null,
  foto: [],
  prodotti: 1,
  idReferenze: [],
  visibilita: 50,
});

const perBox = (idBox: string, dati: Partial<RendimentoBox>): RendimentoBox => ({
  idBox,
  pezzi: 10,
  valore: 20,
  quota: 25,
  quotaSpazio: 25,
  indiceSpazio: 1,
  prodotti: 1,
  prodottiSenzaVendite: 0,
  ...dati,
});

const BOX = [box("a", "Latte", "Latticini"), box("b", "Yogurt", "Latticini", 3), box("c", "Pasta", "Drogheria"), box("d", "Sacchetti", null)];

const RENDIMENTO: RendimentoVolantino = {
  periodo: { dal: "2026-10-01", al: "2026-10-14" },
  puntiVendita: 42,
  misura: "valore",
  totalePezzi: 1500,
  totaleValore: 12345.5,
  perBox: [
    perBox("a", { pezzi: 800, valore: 6000, quota: 48.6, quotaSpazio: 20, indiceSpazio: 2.43 }),
    perBox("b", { pezzi: 400, valore: 3000, quota: 24.3, quotaSpazio: 20, indiceSpazio: 1.2 }),
    perBox("c", { pezzi: 300, valore: 3345.5, quota: 27.1, quotaSpazio: 40, indiceSpazio: 0.66, prodotti: 3, prodottiSenzaVendite: 2 }),
    perBox("d", { pezzi: 0, valore: 0, quota: 0, quotaSpazio: 20, indiceSpazio: 0 }),
  ],
  prodotti: 6,
  prodottiSenzaVendite: 3,
  sopraSpazio: ["a"],
  sottoSpazio: ["d", "c"],
};

const disegna = (props: Partial<RendimentoProps> = {}) =>
  render(
    <MemoryRouter>
      <Rendimento rendimento={RENDIMENTO} box={BOX} {...props} />
    </MemoryRouter>
  );

describe("Rendimento", () => {
  it("dice totale, periodo, punti vendita, prodotti senza vendite e quanti box rendono più o meno dello spazio", () => {
    disegna();

    expect(screen.getByRole("heading", { name: "Rendimento dalle vendite" })).toBeInTheDocument();
    expect(screen.getByText(/Vendite 1 – 14 ottobre 2026 nei punti vendita della stessa area e canale/)).toBeInTheDocument();
    expect(screen.getByText("€ 12.345,50")).toBeInTheDocument();
    expect(screen.getByText("1.500 pezzi")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("su 6 prodotti")).toBeInTheDocument();
    expect(screen.getByText("box, 1 senza vendite")).toBeInTheDocument();
  });

  it("elenca i box sopra e sotto lo spazio, nell'ordine del server, con quote e indice", () => {
    disegna();

    const sopra = screen.getByRole("table", { name: "Box che rendono più dello spazio che occupano" });
    expect(within(sopra).getAllByRole("rowheader").map(cella => cella.textContent)).toEqual(["Lattepagina 2"]);
    expect(within(sopra).getByText("2,43×")).toBeInTheDocument();
    expect(within(sopra).getByText("€ 6.000,00")).toBeInTheDocument();

    const sotto = screen.getByRole("table", { name: "Box che rendono meno dello spazio che occupano" });
    expect(within(sotto).getAllByRole("rowheader").map(cella => cella.textContent)).toEqual(["Sacchettipagina 2", "Pastapagina 2"]);
    expect(within(sotto).getByText("0,66×")).toBeInTheDocument();
  });

  it("confronta quota delle vendite e quota dello spazio per reparto, dal reparto che vende di più", () => {
    disegna();

    const tabella = screen.getByRole("table", { name: "Vendite e spazio per reparto" });
    expect(within(tabella).getAllByRole("rowheader").map(cella => cella.textContent)).toEqual(["Latticini", "Drogheria", "Reparto non noto"]);
    const latticini = within(tabella).getByRole("rowheader", { name: "Latticini" }).closest("tr")!;
    expect(latticini).toHaveAttribute("data-evidenziata", "true");
    expect(latticini).toHaveTextContent("72,9%");
    expect(screen.getByText("Quota delle vendite", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByText("Quota dello spazio", { selector: "li" })).toBeInTheDocument();
  });

  it("senza vendite importate lo dice e rimanda alla pagina Vendite", () => {
    disegna({ rendimento: null, percorsoVendite: "/vendite" });

    expect(screen.getByRole("heading", { name: "Nessuna vendita importata per il periodo di questa promo" })).toBeInTheDocument();
    expect(screen.getByText(/dalla pagina Vendite/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vai alla pagina Vendite" })).toHaveAttribute("href", "/vendite");
    expect(screen.queryByRole("heading", { name: "Rendimento dalle vendite" })).not.toBeInTheDocument();
  });

  it("senza il percorso della pagina Vendite non mette il collegamento", () => {
    disegna({ rendimento: null });

    expect(screen.getByRole("heading", { name: "Nessuna vendita importata per il periodo di questa promo" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("in caricamento mostra lo scheletro; in errore il motivo e Riprova", () => {
    const { container, unmount } = disegna({ rendimento: undefined, caricamento: true });
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    unmount();

    const onRiprova = vi.fn();
    disegna({ rendimento: undefined, errore: "Servizio non raggiungibile", onRiprova });
    expect(screen.getByText("Rendimento non caricato")).toBeInTheDocument();
    expect(screen.getByText("Servizio non raggiungibile")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Riprova/ }));
    expect(onRiprova).toHaveBeenCalled();
  });

  it("con le sole quantità scrive i pezzi", () => {
    disegna({ rendimento: { ...RENDIMENTO, misura: "pezzi", totaleValore: null } });

    expect(screen.getAllByText("1.500 pezzi").length).toBeGreaterThan(0);
    expect(screen.getByText("in pezzi: il file non ha il valore")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Box che rendono più dello spazio che occupano" })).getByText("800 pz")).toBeInTheDocument();
  });
});

describe("vociRendimentoReparto e testoTotaleVendite", () => {
  it("somma le quote dei box per reparto", () => {
    const voci = vociRendimentoReparto(RENDIMENTO, BOX);
    expect(voci.map(voce => [voce.etichetta, voce.principale, voce.confronto])).toEqual([
      ["Latticini", 72.9, 40],
      ["Drogheria", 27.1, 40],
      ["Reparto non noto", 0, 20],
    ]);
  });

  it("totale in euro se c'è il valore, altrimenti in pezzi", () => {
    expect(testoTotaleVendite({ misura: "valore", totaleValore: 10, totalePezzi: 3 })).toBe("€ 10,00");
    expect(testoTotaleVendite({ misura: "pezzi", totaleValore: null, totalePezzi: 1 })).toBe("1 pezzo");
  });
});
