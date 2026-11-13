// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TINTA_NEUTRA } from "@/components/Grafici";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { AnalisiPagina, type AnalisiPaginaProps } from "./AnalisiPagina";
import type { GruppoBox } from "./colori";

// Il pannello accanto al lettore (spec insight-volantino, "Analisi della pagina guardata"): numeri
// delle pagine aperte, insieme o una alla volta, ripartizione secondo "Colora per", elenco dei box
// dal più grande

const boxDi = (id: string, dati: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: `B${id}`,
  pagina: 3,
  geometria: { x: 0.1, y: 0.2, w: 0.5, h: 0.25 },
  spazio: 10,
  proporzionePagina: null,
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
  reparto: null,
  foto: [],
  prodotti: 1,
  idReferenze: [`r-${id}`],
  ...dati,
});

const perReparto = (voce: BoxInsight): GruppoBox =>
  voce.reparto
    ? { id: voce.reparto.codice, etichetta: voce.reparto.descrizione, tinta: { colore: "#f97316", classeTesto: "" } }
    : { id: "senza", etichetta: "Reparto non noto", tinta: TINTA_NEUTRA };

const CARNI = { codice: "10", descrizione: "CARNI" };
const ORTOFRUTTA = { codice: "20", descrizione: "ORTOFRUTTA" };

const BOX = [
  boxDi("piccolo", { nome: "Zucchine", reparto: ORTOFRUTTA, spazio: 8, prezzo: 1.2 }),
  boxDi("grande", { nome: "Bistecca", marca: "Coop", formato: "500 g", reparto: CARNI, spazio: 40, prezzo: 9.9, sconto: 30, meccanica: "fidelity" }),
  boxDi("medio", { nome: "Salsiccia", reparto: CARNI, spazio: 20, sconto: 20, sottocosto: true }),
  boxDi("nascosto", { nome: "Insalata", reparto: ORTOFRUTTA, spazio: 0, geometria: null }),
];

const disegna = (props: Partial<AnalisiPaginaProps> = {}) => {
  const onRilievo = vi.fn();
  const onApri = vi.fn();
  render(
    <AnalisiPagina
      pagine={[3]}
      totale={24}
      box={BOX}
      gruppo={perReparto}
      titoloRipartizione="Reparto"
      selezionato={null}
      trovati={null}
      onRilievo={onRilievo}
      onApri={onApri}
      {...props}
    />
  );
  return { onRilievo, onApri, pannello: screen.getByRole("complementary", { name: "Analisi della pagina" }) };
};

const numero = (pannello: HTMLElement, etichetta: string) => within(pannello).getByText(etichetta).closest("div");

describe("AnalisiPagina", () => {
  it("mostra i numeri della pagina: box, spazio occupato, sconto medio, fidelity e sottocosto", () => {
    const { pannello } = disegna();

    expect(within(pannello).getByRole("heading", { name: "Pagina 3" })).toBeInTheDocument();
    expect(within(pannello).getByText("di 24")).toBeInTheDocument();
    expect(numero(pannello, "Box")).toHaveTextContent("4");
    expect(numero(pannello, "Spazio")).toHaveTextContent("68%");
    expect(numero(pannello, "Sconto medio")).toHaveTextContent("25%");
    expect(numero(pannello, "Fidelity")).toHaveTextContent("1");
    expect(numero(pannello, "Sottocosto")).toHaveTextContent("1");
    // Niente calore, visibilità o vendite
    expect(pannello).not.toHaveTextContent(/visibilit|calore|vendit|previs/i);
  });

  it("ripartisce box e spazio secondo la colorazione scelta, dal gruppo con più spazio", () => {
    const { pannello } = disegna();

    const gruppi = within(within(pannello).getByRole("region", { name: "Per reparto" })).getAllByRole("listitem");
    expect(gruppi.map(gruppo => gruppo.textContent)).toEqual(["CARNI2 box60%", "ORTOFRUTTA2 box8%"]);
  });

  it("elenca i box dal più grande, con prezzo, sconto e spazio, e segna quelli senza posizione", () => {
    const { pannello } = disegna();

    const righe = within(within(pannello).getByRole("region", { name: "Box della pagina" })).getAllByRole("button");
    expect(righe.map(riga => riga.getAttribute("data-testid"))).toEqual(["riga-box-grande", "riga-box-medio", "riga-box-piccolo", "riga-box-nascosto"]);
    expect(righe[0]).toHaveTextContent("Bistecca");
    expect(righe[0]).toHaveTextContent("Coop · 500 g");
    expect(righe[0]).toHaveTextContent("€ 9,90");
    expect(righe[0]).toHaveTextContent("−30% · 40%");
    expect(righe[3]).toHaveTextContent("senza posizione");
  });

  it("nella riga il ruolo ha la parola davanti, perché non sembri una marca; il prezzo all'etto lo dice", () => {
    const prodotto = (ruolo: string) => ({
      chiave: `c-${ruolo}`,
      nome: "Gorgonzola",
      marca: null,
      formato: null,
      gusto: null,
      codice: null,
      ean: [],
      prezzo: null,
      settore: null,
      segmento: null,
      tema: null,
      ruolo,
    });
    const { pannello } = disegna({
      box: [boxDi("etto", { nome: "Gorgonzola", marca: "Sapori & Dintorni", prezzo: 0.99, prezzoAllEtto: true, dettaglioProdotti: [prodotto("Star"), prodotto("Base")] })],
    });

    const riga = within(within(pannello).getByRole("region", { name: "Box della pagina" })).getByRole("button");
    expect(riga).toHaveTextContent("Sapori & Dintorni · Ruolo Star, Base");
    expect(riga).toHaveTextContent("€ 0,99 all'etto");
  });

  it("passando su un box lo mette in rilievo, uscendo lo toglie; scegliendolo apre la scheda", () => {
    const { onRilievo, onApri } = disegna();
    const riga = screen.getByTestId("riga-box-medio");

    fireEvent.mouseEnter(riga);
    expect(onRilievo).toHaveBeenLastCalledWith("medio");
    fireEvent.mouseLeave(riga);
    expect(onRilievo).toHaveBeenLastCalledWith(null);
    fireEvent.focus(riga);
    expect(onRilievo).toHaveBeenLastCalledWith("medio");

    fireEvent.click(riga);
    expect(onApri).toHaveBeenCalledWith(expect.objectContaining({ id: "medio" }));
  });

  it("segna il box scelto e quelli trovati dalla ricerca", () => {
    disegna({ selezionato: "grande", trovati: new Set(["piccolo"]) });

    expect(screen.getByTestId("riga-box-grande")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("riga-box-piccolo")).toHaveAttribute("data-trovato");
    expect(screen.getByTestId("riga-box-medio")).not.toHaveAttribute("data-trovato");
  });

  it("con due pagine aperte le analizza insieme, lo spazio sulle due pagine, o una alla volta", () => {
    const pagina2 = [boxDi("p2", { nome: "Pane", pagina: 2, spazio: 30, reparto: CARNI })];
    const { pannello } = disegna({ pagine: [2, 3], box: [...pagina2, ...BOX] });

    expect(within(pannello).getByRole("heading", { name: "Pagine 2-3" })).toBeInTheDocument();
    expect(numero(pannello, "Box")).toHaveTextContent("5");
    // 30% della pagina 2 e 68% della pagina 3: il 49% delle due pagine
    expect(numero(pannello, "Spazio")).toHaveTextContent("49%");
    const righe = within(within(pannello).getByRole("region", { name: "Box delle pagine" })).getAllByRole("button");
    expect(righe[0]).toHaveTextContent("pag. 3");

    fireEvent.click(within(pannello).getByRole("radio", { name: "Pag. 3" }));

    expect(within(pannello).getByRole("heading", { name: "Pagina 3" })).toBeInTheDocument();
    expect(numero(pannello, "Box")).toHaveTextContent("4");
    expect(numero(pannello, "Spazio")).toHaveTextContent("68%");
    expect(within(pannello).getByRole("region", { name: "Box della pagina" })).toBeInTheDocument();
  });

  it("una pagina senza box lo dice", () => {
    const { pannello } = disegna({ box: [] });

    expect(within(pannello).getByText("Nessun box in questa pagina.")).toBeInTheDocument();
    expect(within(pannello).queryByRole("region", { name: "Box della pagina" })).not.toBeInTheDocument();
  });
});
