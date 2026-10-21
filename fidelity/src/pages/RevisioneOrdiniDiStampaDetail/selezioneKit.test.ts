import { describe, expect, it } from "vitest";
import { contaSelezionati, selezioneDaInviare } from "./selezioneKit";

const disponibili = [{ guidId: "A" }, { guidId: "B" }, { guidId: "C" }];

describe("selezione dei kit da inviare", () => {
  it("comprende i kit selezionati nascosti dalla ricerca", () => {
    // la ricerca mostra solo A, ma B e C restano selezionati
    const selezione = selezioneDaInviare(disponibili, { A: true, B: true, C: true });

    expect(selezione).toEqual({ A: true, B: true, C: true });
    expect(contaSelezionati(selezione)).toBe(3);
  });

  it("non conta i kit già inviati, che non sono più disponibili", () => {
    // A è stato inviato: dopo la revalidate non è più fra i disponibili
    const selezione = selezioneDaInviare([{ guidId: "B" }, { guidId: "C" }], { A: true, B: true });

    expect(selezione).toEqual({ B: true, C: false });
    expect(contaSelezionati(selezione)).toBe(1);
  });

  it("senza selezione il conteggio è zero", () => {
    expect(contaSelezionati(selezioneDaInviare(disponibili, {}))).toBe(0);
  });
});
