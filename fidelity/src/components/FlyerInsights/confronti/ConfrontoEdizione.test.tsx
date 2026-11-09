// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ConfrontoEdizione as DatiConfrontoEdizione, ProdottoConfronto } from "../../../../lib/insightVolantino/tipi";
import { ConfrontoEdizione } from "./ConfrontoEdizione";

const variazione = (attuale: number | null, precedente: number | null) => ({
  attuale,
  precedente,
  differenza: attuale !== null && precedente !== null ? attuale - precedente : null,
});

const prodotto = (indice: number): ProdottoConfronto => ({
  chiave: `c-${indice}`,
  nome: `Prodotto ${indice}`,
  marca: indice % 2 === 0 ? "Marca pari" : null,
  prezzo: 1 + indice / 10,
  sconto: indice % 3 === 0 ? 30 : null,
});

const confronto = (modifiche: Partial<DatiConfrontoEdizione> = {}): DatiConfrontoEdizione => ({
  edizione: {
    idKit: "k0",
    titolo: "Volantino settembre",
    idPromo: "p0",
    nomePromo: "Promo settembre",
    area: "Nord",
    canale: "Super",
    validitaDal: "2026-09-03",
    validitaAl: "2026-09-16",
    storico: false,
  },
  sintesi: {
    referenze: variazione(120, 108),
    box: variazione(80, 80),
    pagine: variazione(16, 12),
    scontoMedio: variazione(27.5, 25),
    quotaFidelity: variazione(40, null),
    sottocosto: variazione(3, 5),
    marche: variazione(45, 41),
  },
  spazioPerReparto: [
    { chiave: "LS", etichetta: "Latticini", attuale: 12.5, precedente: 10 },
    { chiave: "OR", etichetta: "Ortofrutta", attuale: 20, precedente: 22.5 },
  ],
  prodottiEntrati: [prodotto(1), prodotto(2)],
  prodottiUsciti: [prodotto(3)],
  ...modifiche,
});

const mostra = (props: Parameters<typeof ConfrontoEdizione>[0]) =>
  render(
    <MemoryRouter>
      <ConfrontoEdizione {...props} />
    </MemoryRouter>
  );

describe("Confronto con l'edizione precedente", () => {
  it("presenta l'edizione precedente con area, canale, validità e il collegamento ai suoi insight", () => {
    mostra({ confronto: confronto() });

    expect(screen.getByRole("group", { name: "Rispetto all'edizione precedente" })).toBeInTheDocument();
    expect(screen.getByText("Volantino settembre")).toBeInTheDocument();
    expect(screen.getByText(/Nord · Super/)).toBeInTheDocument();
    expect(screen.getByText("3 – 16 settembre 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Apri i suoi insight" })).toHaveAttribute("href", "/volantini/tutti_i_volantini?kit=k0");
    expect(screen.queryByText("Dallo storico")).not.toBeInTheDocument();
  });

  it("segnala un'edizione precedente recuperata dallo storico", () => {
    const base = confronto();
    mostra({ confronto: { ...base, edizione: { ...base.edizione, storico: true } } });

    expect(screen.getByText("Dallo storico")).toBeInTheDocument();
  });

  it("mostra le variazioni dei numeri chiave: conteggi col segno, percentuali in punti, dato mancante", () => {
    mostra({ confronto: confronto() });
    const tabella = screen.getByRole("table", { name: "Numeri chiave rispetto all'edizione precedente" });

    const riga = (etichetta: string) => within(tabella).getByText(etichetta).closest("tr") as HTMLElement;
    expect(within(riga("Referenze")).getByText("+12")).toBeInTheDocument();
    expect(within(riga("Box")).getByText("stabile")).toBeInTheDocument();
    expect(within(riga("Sottocosto")).getByText("−2")).toBeInTheDocument();
    expect(within(riga("Sconto medio")).getByText("27,5%")).toBeInTheDocument();
    expect(within(riga("Sconto medio")).getByText("+2,5 punti")).toBeInTheDocument();
    // Senza il valore precedente la differenza non si calcola
    expect(within(riga("Quota fidelity")).getByText("N/D")).toBeInTheDocument();
    expect(within(riga("Quota fidelity")).getByText("—")).toBeInTheDocument();
  });

  it("affianca lo spazio di ogni reparto nelle due edizioni, dal reparto più grande", () => {
    mostra({ confronto: confronto() });
    const elenco = screen.getByRole("list", { name: "Spazio per reparto nelle due edizioni" });
    const reparti = within(elenco).getAllByRole("listitem");

    expect(reparti.map((voce) => voce.querySelector("span")?.textContent)).toEqual(["Ortofrutta", "Latticini"]);
    expect(reparti[0]).toHaveTextContent("Questa edizione: 20%");
    expect(reparti[0]).toHaveTextContent("Edizione precedente: 22,5%");
    expect(screen.getByRole("list", { name: "Legenda" })).toHaveTextContent("Questa edizioneEdizione precedente");
  });

  it("elenca prodotti entrati e usciti con prezzo e sconto", () => {
    mostra({ confronto: confronto() });

    const entrati = screen.getByRole("list", { name: "Prodotti entrati" });
    expect(within(entrati).getAllByRole("listitem")).toHaveLength(2);
    expect(within(entrati).getByText("Prodotto 2")).toBeInTheDocument();
    expect(within(entrati).getByText("Marca pari")).toBeInTheDocument();
    expect(within(entrati).getByText("€ 1,20")).toBeInTheDocument();

    const usciti = screen.getByRole("list", { name: "Prodotti usciti" });
    expect(within(usciti).getByText("Prodotto 3")).toBeInTheDocument();
    expect(within(usciti).getByText("−30%")).toBeInTheDocument();
  });

  it("oltre i primi prodotti li mostra tutti a richiesta e poi li richiude", () => {
    const molti = Array.from({ length: 12 }, (_, indice) => prodotto(indice + 1));
    mostra({ confronto: confronto({ prodottiEntrati: molti }) });
    const entrati = () => screen.getByRole("list", { name: "Prodotti entrati" });

    expect(within(entrati()).getAllByRole("listitem")).toHaveLength(8);
    const pulsante = screen.getByRole("button", { name: "Mostra tutti (12)" });
    expect(pulsante).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(pulsante);
    expect(within(entrati()).getAllByRole("listitem")).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Mostra meno" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Mostra meno" }));
    expect(within(entrati()).getAllByRole("listitem")).toHaveLength(8);
  });

  it("senza prodotti entrati né usciti e senza reparti lo dice al posto degli elenchi", () => {
    mostra({ confronto: confronto({ prodottiEntrati: [], prodottiUsciti: [], spazioPerReparto: [] }) });

    expect(screen.getByText("Nessun prodotto nuovo rispetto all'edizione precedente.")).toBeInTheDocument();
    expect(screen.getByText("Tutti i prodotti dell'edizione precedente sono anche in questa.")).toBeInTheDocument();
    expect(screen.getByText("Nessun reparto riconosciuto nelle due edizioni.")).toBeInTheDocument();
  });

  it("per la prima edizione di area e canale dice che non c'è un'edizione precedente", () => {
    mostra({ confronto: null });

    expect(screen.getByText("Nessuna edizione precedente per questa area e canale")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("durante il caricamento mostra l'attesa e non il messaggio di prima edizione", () => {
    const { container } = mostra({ confronto: null, caricamento: true });

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText("Nessuna edizione precedente per questa area e canale")).not.toBeInTheDocument();
  });

  it("se i confronti non arrivano mostra il motivo e permette di riprovare", () => {
    const onRiprova = vi.fn();
    mostra({ confronto: null, errore: "Servizio non raggiungibile", onRiprova });

    expect(screen.getByRole("alert")).toHaveTextContent("Confronto non caricato");
    expect(screen.getByText("Servizio non raggiungibile")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Riprova/ }));
    expect(onRiprova).toHaveBeenCalled();
  });
});
