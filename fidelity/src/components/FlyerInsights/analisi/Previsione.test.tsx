// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PrevisioneBox, PrevisioneVolantino } from "../../../../lib/insightVolantino/rendimento";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { boxPiuScostati, conteggioAffidabilita, Previsione, type PrevisioneProps } from "./Previsione";

const box = (id: string, nome: string): BoxInsight => ({
  id,
  codiceBox: id,
  pagina: 1,
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
  reparto: null,
  foto: [],
  prodotti: 1,
  idReferenze: [],
  visibilita: 50,
});

const previsto = (idBox: string, dati: Partial<PrevisioneBox>): PrevisioneBox => ({
  idBox,
  valore: 100,
  casiStorici: 10,
  affidabilita: "alta",
  reale: null,
  ...dati,
});

const BOX = [box("a", "Latte"), box("b", "Yogurt"), box("c", "Pasta")];

const DALLE_VENDITE: PrevisioneVolantino = {
  tipo: "vendite",
  unita: "pezzi",
  promoValida: true,
  edizioniStoriche: 12,
  perBox: [
    previsto("a", { valore: 100, reale: 110 }),
    previsto("b", { valore: 200, reale: 100, affidabilita: "media", casiStorici: 4 }),
    previsto("c", { valore: 50, reale: null, affidabilita: "bassa", casiStorici: 1 }),
  ],
  scartoMedio: 30,
  nota: "Previsione dallo storico delle vendite di 12 edizioni.",
};

const disegna = (props: Partial<PrevisioneProps> = {}) => render(<Previsione previsione={DALLE_VENDITE} box={BOX} {...props} />);

describe("Previsione", () => {
  it("dice com'è fatta, su quante edizioni, quanti pezzi, l'affidabilità e lo scarto dal reale", () => {
    disegna();

    expect(screen.getByRole("heading", { name: "Previsione" })).toBeInTheDocument();
    expect(screen.getByText("Dallo storico delle vendite")).toBeInTheDocument();
    expect(screen.getByText("350 pezzi")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("1 box")).toBeInTheDocument();
    expect(screen.getByText("1 media · 1 bassa")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText(/Previsione dallo storico delle vendite di 12 edizioni\./)).toBeInTheDocument();
    expect(screen.getByText(/serve al confronto con le vendite reali/)).toBeInTheDocument();
  });

  it("mette per primi i box più lontani dal previsto", () => {
    disegna();

    const tabella = screen.getByRole("table", { name: "Dove il reale si è scostato di più dal previsto" });
    expect(within(tabella).getAllByRole("rowheader").map(cella => cella.textContent)).toEqual(["Yogurt", "Latte"]);
    expect(within(tabella).getByText("−50%")).toBeInTheDocument();
    expect(within(tabella).getByText("+10%")).toBeInTheDocument();
  });

  it("la stima teorica lo dichiara, è un indice e non ha scarti", () => {
    disegna({
      previsione: {
        ...DALLE_VENDITE,
        tipo: "teorica",
        unita: "indice",
        promoValida: false,
        perBox: [previsto("a", { valore: 64, affidabilita: "bassa", casiStorici: 0 })],
        scartoMedio: null,
        nota: "Stima teorica: nessuna vendita importata.",
      },
    });

    expect(screen.getByText("Stima teorica")).toBeInTheDocument();
    expect(screen.getByText("indice da 0 a 100 per box")).toBeInTheDocument();
    expect(screen.getByText(/Stima teorica: nessuna vendita importata\./)).toBeInTheDocument();
    expect(screen.queryByText("Scarto dal reale")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("senza box con la posizione lo dice; in errore si può riprovare", () => {
    const { unmount } = disegna({ previsione: null });
    expect(screen.getByRole("heading", { name: "Previsione non disponibile" })).toBeInTheDocument();
    unmount();

    const onRiprova = vi.fn();
    disegna({ previsione: undefined, errore: "Timeout", onRiprova });
    expect(screen.getByText("Previsione non caricata")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Riprova/ }));
    expect(onRiprova).toHaveBeenCalled();
  });
});

describe("conteggioAffidabilita e boxPiuScostati", () => {
  it("conta i box per affidabilità e ordina gli scarti in valore assoluto, senza i box senza reale", () => {
    expect(conteggioAffidabilita(DALLE_VENDITE.perBox)).toEqual({ alta: 1, media: 1, bassa: 1 });
    expect(boxPiuScostati(DALLE_VENDITE.perBox).map(voce => [voce.idBox, Math.round(voce.scarto)])).toEqual([
      ["b", -50],
      ["a", 10],
    ]);
    expect(boxPiuScostati(DALLE_VENDITE.perBox, 1)).toHaveLength(1);
  });
});
