// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PaginazioneTabella from ".";

const disegna = (props: Partial<React.ComponentProps<typeof PaginazioneTabella>> = {}) => {
  const onCambiaPagina = vi.fn();
  const risultato = render(
    <PaginazioneTabella totale={120} pagina={1} dimensionePagina={25} onCambiaPagina={onCambiaPagina} {...props} />
  );
  return { ...risultato, onCambiaPagina };
};

const nomiPagine = () =>
  within(screen.getByRole("navigation", { name: "Paginazione" }))
    .getAllByRole("button")
    .map((pulsante) => pulsante.getAttribute("aria-label"));

describe("PaginazioneTabella", () => {
  it("dice quali righe sono mostrate, con le migliaia separate", () => {
    disegna({ totale: 1234, pagina: 2, dimensionePagina: 25 });

    expect(screen.getByText("Mostrati 26–50 di 1.234")).toBeInTheDocument();
  });

  it("con l'unità dice cosa sono le righe, dopo il totale", () => {
    disegna({ totale: 1842, pagina: 1, dimensionePagina: 100, unita: "file" });

    expect(screen.getByText("Mostrati 1–100 di 1.842 file")).toBeInTheDocument();
  });

  it("nell'ultima pagina l'intervallo si ferma al totale", () => {
    disegna({ totale: 120, pagina: 5, dimensionePagina: 25 });

    expect(screen.getByText("Mostrati 101–120 di 120")).toBeInTheDocument();
  });

  it("con totale 0 non mostra nulla", () => {
    const { container } = disegna({ totale: 0 });

    expect(container).toBeEmptyDOMElement();
  });

  it("con una sola pagina mostra il conteggio ma non la navigazione", () => {
    disegna({ totale: 6, dimensionePagina: 25 });

    expect(screen.getByText("Mostrati 1–6 di 6")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("prima, precedente, successiva e ultima portano alla pagina giusta", () => {
    const { onCambiaPagina } = disegna({ totale: 120, pagina: 3, dimensionePagina: 25 });

    fireEvent.click(screen.getByRole("button", { name: "Prima pagina" }));
    fireEvent.click(screen.getByRole("button", { name: "Pagina precedente" }));
    fireEvent.click(screen.getByRole("button", { name: "Pagina successiva" }));
    fireEvent.click(screen.getByRole("button", { name: "Ultima pagina" }));
    fireEvent.click(screen.getByRole("button", { name: "Pagina 4" }));

    expect(onCambiaPagina.mock.calls).toEqual([[1], [2], [4], [5], [4]]);
  });

  it("alla prima pagina indietro è disattivato e non cambia pagina", () => {
    const { onCambiaPagina } = disegna({ pagina: 1 });

    const precedente = screen.getByRole("button", { name: "Pagina precedente" });
    expect(precedente).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(precedente);
    fireEvent.click(screen.getByRole("button", { name: "Pagina 1" }));

    expect(onCambiaPagina).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pagina 1" })).toHaveAttribute("aria-current", "page");
  });

  it("i comandi si attivano anche da tastiera", () => {
    const { onCambiaPagina } = disegna({ pagina: 1 });

    fireEvent.keyDown(screen.getByRole("button", { name: "Pagina successiva" }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Pagina 3" }), { key: " " });

    expect(onCambiaPagina.mock.calls).toEqual([[2], [3]]);
  });

  it("con molte pagine abbrevia i numeri lontani dalla corrente", () => {
    disegna({ totale: 500, pagina: 10, dimensionePagina: 25 });

    expect(nomiPagine()).toEqual([
      "Prima pagina",
      "Pagina precedente",
      "Pagina 1",
      "Pagina 9",
      "Pagina 10",
      "Pagina 11",
      "Pagina 20",
      "Pagina successiva",
      "Ultima pagina",
    ]);
  });

  it("la scelta delle righe per pagina ha un'etichetta e riporta alla prima pagina", () => {
    const onCambiaDimensione = vi.fn();
    const { onCambiaPagina } = disegna({ pagina: 3, onCambiaDimensione, opzioniDimensione: [10, 25, 50] });

    fireEvent.change(screen.getByLabelText("Righe per pagina"), { target: { value: "50" } });

    expect(onCambiaDimensione).toHaveBeenCalledWith(50);
    expect(onCambiaPagina).toHaveBeenCalledWith(1);
  });

  it("senza onCambiaDimensione non mostra la scelta delle righe", () => {
    disegna();

    expect(screen.queryByLabelText("Righe per pagina")).not.toBeInTheDocument();
  });
});
