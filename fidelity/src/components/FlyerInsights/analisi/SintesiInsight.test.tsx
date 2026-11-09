// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConfrontoEdizione, SintesiVolantino, Variazione } from "../../../../lib/insightVolantino/tipi";

// analisi.ts dei punti vendita legge la rete delle insegne solo nei suoi hook, qui non usati
vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { CLASSE_VARIAZIONE_NEUTRA, NUMERI_SINTESI, SintesiInsight, testoCoperturaParziale, variazioneNumero } from "./SintesiInsight";

const sintesi = (campi: Partial<SintesiVolantino> = {}): SintesiVolantino => ({
  referenze: 120,
  box: 80,
  pagine: 16,
  scontoMedio: 27.84,
  boxConSconto: 42,
  quotaFidelity: 12.5,
  sottocosto: 3,
  marche: 35,
  copertura: { prezzo: 100, marca: 100, reparto: 100, geometria: 100 },
  ...campi,
});

const variazione = (attuale: number | null, precedente: number | null): Variazione => ({
  attuale,
  precedente,
  differenza: attuale !== null && precedente !== null ? attuale - precedente : null,
});

const confronto = (campi: Partial<ConfrontoEdizione["sintesi"]> = {}, storico = false): ConfrontoEdizione => ({
  edizione: {
    idKit: "k0",
    titolo: "Volantino di settembre",
    idPromo: "p0",
    nomePromo: null,
    area: "Nord",
    canale: "Super",
    validitaDal: "2026-09-03",
    validitaAl: "2026-09-16",
    storico,
  },
  sintesi: {
    referenze: variazione(120, 100),
    box: variazione(80, 80),
    pagine: variazione(16, 16),
    scontoMedio: variazione(27.84, 30.2),
    quotaFidelity: variazione(12.5, 9.5),
    sottocosto: variazione(3, 1),
    marche: variazione(35, 35),
    ...campi,
  },
  spazioPerReparto: [],
  prodottiEntrati: [],
  prodottiUsciti: [],
});

/** La StatCard (radice con data-tono) che ha questa etichetta. */
const card = (etichetta: string) => screen.getByText(etichetta, { selector: "dt" }).closest("[data-tono]") as HTMLElement;

describe("SintesiInsight", () => {
  it("mostra i numeri chiave del volantino senza variazioni quando il confronto non c'è", () => {
    render(<SintesiInsight sintesi={sintesi()} />);

    expect(card("Referenze")).toHaveTextContent("120");
    expect(card("Box")).toHaveTextContent("80");
    expect(card("Pagine")).toHaveTextContent("16");
    expect(card("Sconto medio")).toHaveTextContent("27,8%");
    expect(card("Sconto medio")).toHaveTextContent("su 42 box");
    expect(card("Quota fidelity")).toHaveTextContent("12,5%");
    expect(card("Sottocosto")).toHaveTextContent("3");
    expect(card("Marche")).toHaveTextContent("35");
    expect(document.querySelector("[data-direzione]")).toBeNull();
    expect(screen.queryByText(/edizione precedente/)).not.toBeInTheDocument();
  });

  it("con l'edizione precedente mostra la variazione: neutra per lo sconto medio, positiva se sale la quota fidelity", () => {
    render(<SintesiInsight sintesi={sintesi()} confronto={confronto()} />);

    const referenze = card("Referenze");
    expect(referenze).toHaveTextContent("+20");
    expect(referenze).toHaveTextContent("prima 100");
    expect(referenze.querySelector("[data-direzione]")).toHaveAttribute("data-direzione", "su");
    expect(referenze).toHaveClass(CLASSE_VARIAZIONE_NEUTRA);

    // Uno sconto medio più basso non è un peggioramento: la card lo riporta al grigio
    const sconto = card("Sconto medio");
    expect(sconto).toHaveTextContent("−2,4 punti");
    expect(sconto.querySelector("[data-direzione]")).toHaveAttribute("data-direzione", "giu");
    expect(sconto).toHaveClass(CLASSE_VARIAZIONE_NEUTRA);
    expect(sconto).toHaveTextContent("su 42 box · prima 30,2%");

    const fidelity = card("Quota fidelity");
    expect(fidelity).toHaveTextContent("+3 punti");
    expect(fidelity.querySelector("[data-direzione]")).toHaveClass("text-success");
    expect(fidelity).not.toHaveClass(CLASSE_VARIAZIONE_NEUTRA);

    expect(screen.getByText("Volantino di settembre")).toBeInTheDocument();
    expect(screen.getByText(/rispetto all'edizione precedente della stessa area e canale/)).toBeInTheDocument();
  });

  it("una differenza nulla è stabile; senza uno dei due valori la variazione non c'è", () => {
    render(<SintesiInsight sintesi={sintesi()} confronto={confronto({ scontoMedio: variazione(27.84, null) })} />);

    const marche = card("Marche");
    expect(marche).toHaveTextContent("stabile");
    expect(marche.querySelector("[data-direzione]")).toHaveAttribute("data-direzione", "stabile");
    expect(card("Sconto medio").querySelector("[data-direzione]")).toBeNull();
    expect(card("Sconto medio")).not.toHaveTextContent("prima");
  });

  it("l'edizione precedente dello storico è dichiarata", () => {
    render(<SintesiInsight sintesi={sintesi()} confronto={confronto({}, true)} />);

    expect(screen.getByText(/dallo storico/)).toBeInTheDocument();
  });

  it("alla prima edizione dell'area e del canale dice che non c'è confronto", () => {
    render(<SintesiInsight sintesi={sintesi()} confronto={null} />);

    expect(screen.getByText(/Nessuna edizione precedente per la stessa area e lo stesso canale/)).toBeInTheDocument();
    expect(document.querySelector("[data-direzione]")).toBeNull();
  });

  it("mentre il confronto si carica lo annuncia senza variazioni", () => {
    render(<SintesiInsight sintesi={sintesi()} caricamentoConfronto />);

    expect(screen.getByText(/in caricamento/)).toHaveAttribute("aria-busy", "true");
    expect(document.querySelector("[data-direzione]")).toBeNull();
  });

  it("segnala i dati parziali sotto la soglia di copertura, e tace quando la copertura è buona", () => {
    const { rerender } = render(<SintesiInsight sintesi={sintesi({ copertura: { prezzo: 42, marca: 30, reparto: 80, geometria: 100 } })} />);

    expect(screen.getByText(/Dati parziali: il prezzo nel 42% dei box, la marca nel 30%/)).toBeInTheDocument();

    rerender(<SintesiInsight sintesi={sintesi()} />);
    expect(screen.queryByText(/Dati parziali/)).not.toBeInTheDocument();
  });

  it("un volantino senza box mostra zeri e N/D, senza la nota sulla copertura", () => {
    render(
      <SintesiInsight
        sintesi={sintesi({ referenze: 0, box: 0, scontoMedio: null, boxConSconto: 0, quotaFidelity: 0, sottocosto: 0, marche: 0, copertura: { prezzo: 0, marca: 0, reparto: 0, geometria: 0 } })}
      />
    );

    expect(card("Sconto medio")).toHaveTextContent("N/D");
    expect(screen.queryByText(/Dati parziali/)).not.toBeInTheDocument();
  });
});

describe("variazioneNumero e testoCoperturaParziale", () => {
  const numero = (chiave: string) => NUMERI_SINTESI.find(n => n.chiave === chiave)!;

  it("le quote si confrontano in punti a un decimale, i conteggi in unità", () => {
    expect(variazioneNumero(numero("scontoMedio"), variazione(30, 29.96))).toEqual({ valore: "stabile", direzione: "stabile", positivoSe: "su" });
    expect(variazioneNumero(numero("referenze"), variazione(90, 100))).toEqual({ valore: "−10", direzione: "giu", positivoSe: "su" });
    expect(variazioneNumero(numero("referenze"), variazione(90, null))).toBeUndefined();
    expect(variazioneNumero(numero("referenze"), undefined)).toBeUndefined();
  });

  it("solo i dati sotto il 60% entrano nella nota", () => {
    expect(testoCoperturaParziale({ prezzo: 100, marca: 59, reparto: 60, geometria: 10 })).toBe(
      "la marca nel 59% dei box, la posizione nella pagina nel 10%"
    );
    expect(testoCoperturaParziale({ prezzo: 60, marca: 100, reparto: 100, geometria: 100 })).toBeNull();
  });
});
