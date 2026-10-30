// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReferenzaPosizione } from "@/types/flyerInsights";
import FlyerPageMap, { geometriaBox, ingombroPercentuale } from "./FlyerPageMap";

// Un box a metà larghezza della pagina A4 (210 × 297), al 10% dal bordo sinistro della sua pagina
const referenza = (pag: number, x: number, percIngombro: number): ReferenzaPosizione => ({
  id: "r1",
  reparto: "LS",
  descrizione: "Mozzarella",
  posizione: { pag, x, y: 0, w: 105, h: 148.5, wPage: 210, hPage: 297, percIngombro, aspectRatio: 1 },
});

describe("FlyerPageMap: geometria dei kit di Istanta e dello storico", () => {
  it("Istanta: sulla pagina destra x è relativo allo spread, si toglie la pagina sinistra; l'ingombro è una frazione", () => {
    render(<FlyerPageMap referenze={[referenza(3, 231, 0.125)]} paginaCorrente={3} onChangePage={vi.fn()} totalePagine={5} />);

    const box = screen.getByTestId("box-r1");
    expect(box.style.left).toBe("10%");
    expect(box.style.width).toBe("50%");
    expect(box.style.height).toBe("50%");
    fireEvent.mouseEnter(box);
    expect(screen.getByText("Ingombro: 12.5%")).toBeInTheDocument();
  });

  it("storico: x è già relativo alla pagina anche a destra e l'ingombro è già una percentuale", () => {
    render(<FlyerPageMap referenze={[referenza(3, 21, 12.5)]} paginaCorrente={3} onChangePage={vi.fn()} totalePagine={5} origineStorico />);

    const box = screen.getByTestId("box-r1");
    expect(box.style.left).toBe("10%");
    expect(box.style.width).toBe("50%");
    fireEvent.mouseEnter(box);
    expect(screen.getByText("Ingombro: 12.5%")).toBeInTheDocument();
  });

  it("sulla pagina sinistra x resta com'è per tutti e due; sulla copertina solo Istanta toglie la pagina", () => {
    const posizione = referenza(2, 21, 0.1).posizione!;
    expect(geometriaBox(posizione, "left", false).left).toBe(10);
    expect(geometriaBox(posizione, "left", true).left).toBe(10);
    expect(geometriaBox({ ...posizione, pag: 1, x: 231 }, "single", false).left).toBe(10);
    expect(geometriaBox({ ...posizione, pag: 1 }, "single", true).left).toBe(10);
  });

  it("l'ingombro in percentuale: frazione per Istanta, già percentuale per lo storico", () => {
    expect(ingombroPercentuale(0.125, false)).toBe(12.5);
    expect(ingombroPercentuale(12.5, true)).toBe(12.5);
  });
});

// Volantino di 5 pagine: copertina (pag. 1), spread 2-3, spread 4-5
const disegna = (paginaCorrente: number) => {
  const onChangePage = vi.fn();
  render(
    <FlyerPageMap referenze={[]} paginaCorrente={paginaCorrente} onChangePage={onChangePage} totalePagine={5} />
  );
  return onChangePage;
};

describe("FlyerPageMap", () => {
  it("sulla copertina lo spread precedente è disattivato e il successivo porta a pagina 2", () => {
    const onChangePage = disegna(1);

    expect(screen.getByRole("button", { name: "Spread precedente" })).toBeDisabled();
    const successivo = screen.getByRole("button", { name: "Spread successivo" });
    expect(successivo).toBeEnabled();

    fireEvent.click(successivo);

    expect(onChangePage).toHaveBeenCalledWith(2);
  });

  it("sull'ultimo spread il successivo è disattivato e il precedente torna allo spread prima", () => {
    const onChangePage = disegna(5);

    expect(screen.getByRole("button", { name: "Spread successivo" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Spread precedente" }));

    expect(onChangePage).toHaveBeenCalledWith(3);
  });

  it("i numeri della mini navigazione hanno un nome e segnano lo spread corrente", () => {
    const onChangePage = disegna(2);

    const corrente = screen.getByRole("button", { name: "Vai allo spread 2" });
    expect(corrente).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Vai allo spread 1" })).not.toHaveAttribute("aria-current");

    fireEvent.click(screen.getByRole("button", { name: "Vai allo spread 3" }));

    expect(onChangePage).toHaveBeenCalledWith(4);
  });
});
