// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import SceltaRuoli, { ruoliDaIndirizzo, ruoliInIndirizzo, type VoceRuolo } from ".";

// Il filtro per ruolo a scelta multipla: una pillola per ruolo con il suo conteggio, più ruoli insieme
// valgono in alternativa, "Tutti i ruoli" toglie la scelta.

const VOCI: VoceRuolo[] = [
  { valore: "Base", etichetta: "Base", conteggio: 120 },
  { valore: "Prima pagina", etichetta: "Prima pagina", conteggio: 12 },
  { valore: "Star", etichetta: "Star", conteggio: 1 },
  { valore: "senza-ruolo", etichetta: "Senza ruolo", conteggio: 3 },
];

function Filtro({ iniziali = [], onCambia }: { iniziali?: string[]; onCambia: (scelti: string[]) => void }) {
  const [scelti, setScelti] = useState<string[]>(iniziali);
  return (
    <SceltaRuoli
      etichetta="Ruolo"
      voci={VOCI}
      scelti={scelti}
      unita={["prodotto", "prodotti"]}
      onCambia={prossimi => {
        setScelti(prossimi);
        onCambia(prossimi);
      }}
    />
  );
}

const pillola = (nome: RegExp | string) => within(screen.getByRole("group", { name: "Ruolo" })).getByRole("button", { name: nome });

describe("SceltaRuoli", () => {
  it("una pillola per ruolo con il conteggio in vista e nel suggerimento; all'inizio tutti i ruoli", () => {
    render(<Filtro onCambia={vi.fn()} />);

    expect(pillola("Tutti i ruoli")).toHaveAttribute("aria-pressed", "true");
    expect(pillola(/^Base/)).toHaveTextContent("Base120");
    expect(pillola(/^Base/)).toHaveAttribute("title", "Base: 120 prodotti");
    expect(pillola(/^Star/)).toHaveAttribute("title", "Star: 1 prodotto");
    expect(pillola(/^Base/)).toHaveAttribute("aria-pressed", "false");
  });

  it("più ruoli insieme: ogni pillola si accende e si spegne; Tutti i ruoli toglie la scelta", () => {
    const onCambia = vi.fn();
    render(<Filtro onCambia={onCambia} />);

    fireEvent.click(pillola(/^Prima pagina/));
    expect(onCambia).toHaveBeenLastCalledWith(["Prima pagina"]);
    fireEvent.click(pillola(/^Star/));
    expect(onCambia).toHaveBeenLastCalledWith(["Prima pagina", "Star"]);
    expect(pillola(/^Star/)).toHaveAttribute("aria-pressed", "true");
    expect(pillola("Tutti i ruoli")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(pillola(/^Prima pagina/));
    expect(onCambia).toHaveBeenLastCalledWith(["Star"]);
    fireEvent.click(pillola("Tutti i ruoli"));
    expect(onCambia).toHaveBeenLastCalledWith([]);
    expect(pillola("Tutti i ruoli")).toHaveAttribute("aria-pressed", "true");
  });

  it("un ruolo scelto che non è più fra le voci resta visibile con 0, da togliere", () => {
    const onCambia = vi.fn();
    render(<Filtro iniziali={["Vedette"]} onCambia={onCambia} />);

    expect(pillola(/^Vedette/)).toHaveTextContent("Vedette0");
    expect(pillola(/^Vedette/)).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(pillola(/^Vedette/));
    expect(onCambia).toHaveBeenLastCalledWith([]);
  });

  it("i ruoli nell'indirizzo: separati da virgola, senza doppioni né vuoti; nessuno toglie il parametro", () => {
    expect(ruoliDaIndirizzo("Star,Prima pagina")).toEqual(["Star", "Prima pagina"]);
    expect(ruoliDaIndirizzo(" Star , ,Star")).toEqual(["Star"]);
    // Un vecchio indirizzo con un solo ruolo vale ancora
    expect(ruoliDaIndirizzo("Vedette")).toEqual(["Vedette"]);
    expect(ruoliDaIndirizzo(null)).toEqual([]);
    expect(ruoliInIndirizzo(["Star", "Prima pagina"])).toBe("Star,Prima pagina");
    expect(ruoliInIndirizzo([])).toBeNull();
  });
});
