// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PageError from ".";

describe("PageError", () => {
  it("mostra titolo e motivo come avviso", () => {
    render(<PageError motivo="Errore durante il recupero degli ordini in corso" />);

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("Impossibile caricare la pagina");
    expect(avviso).toHaveTextContent("Errore durante il recupero degli ordini in corso");
  });

  it("Riprova richiama il caricamento", () => {
    const onRiprova = vi.fn();
    render(<PageError motivo="Servizio non raggiungibile" onRiprova={onRiprova} />);

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));

    expect(onRiprova).toHaveBeenCalledTimes(1);
  });

  it("senza onRiprova non mostra il pulsante", () => {
    render(<PageError motivo="Servizio non raggiungibile" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("la variante compatta ha titolo proprio e niente intestazione di pagina", () => {
    render(<PageError compatta titolo="Statistiche non caricate" motivo="Timeout" onRiprova={() => undefined} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Statistiche non caricate");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riprova" })).toBeInTheDocument();
  });
});
