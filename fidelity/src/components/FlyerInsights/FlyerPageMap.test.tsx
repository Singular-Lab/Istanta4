// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FlyerPageMap from "./FlyerPageMap";

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
