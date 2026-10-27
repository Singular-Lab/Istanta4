// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatCard, { StatCardGrid } from ".";

describe("StatCard", () => {
  it("mostra etichetta e valore come termine e definizione", () => {
    render(<StatCard etichetta="Promozioni" valore="1.250" />);

    expect(screen.getByRole("term")).toHaveTextContent("Promozioni");
    expect(screen.getByRole("definition")).toHaveTextContent("1.250");
  });

  it("senza valore mostra N/D, ma lo zero resta un valore", () => {
    const { rerender } = render(<StatCard etichetta="Score medio" valore={null} />);
    expect(screen.getByRole("definition")).toHaveTextContent("N/D");

    rerender(<StatCard etichetta="Score medio" valore={undefined} />);
    expect(screen.getByRole("definition")).toHaveTextContent("N/D");

    rerender(<StatCard etichetta="Score medio" valore={0} />);
    expect(screen.getByRole("definition")).toHaveTextContent("0");
  });

  it("durante il caricamento è occupata e non mostra il valore", () => {
    const { container } = render(
      <StatCard etichetta="Eventi oggi" valore={42} sottotitolo="Ultime 24 ore" loading />
    );

    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("42")).not.toBeInTheDocument();
    expect(screen.queryByText("Ultime 24 ore")).not.toBeInTheDocument();
    expect(screen.getByText("Caricamento…")).toHaveClass("sr-only");
  });

  it("a caricamento concluso non è più occupata", () => {
    const { container } = render(<StatCard etichetta="Eventi oggi" valore={42} />);

    expect(container.firstElementChild).not.toHaveAttribute("aria-busy");
  });

  it("con un errore mostra il motivo e N/D al posto del valore", () => {
    render(<StatCard etichetta="Critici" valore={7} errore="Servizio non raggiungibile" />);

    expect(screen.queryByText("7")).not.toBeInTheDocument();
    expect(screen.getByText("N/D")).toBeInTheDocument();
    expect(screen.getByText("Servizio non raggiungibile")).toBeInTheDocument();
  });

  it("espone il tono, predefinito brand", () => {
    const { container, rerender } = render(<StatCard etichetta="Totale" valore={1} />);
    expect(container.firstElementChild).toHaveAttribute("data-tono", "brand");

    rerender(<StatCard etichetta="Totale" valore={1} tono="danger" />);
    expect(container.firstElementChild).toHaveAttribute("data-tono", "danger");
  });

  it("una variazione in aumento è positiva per default e annunciata agli screen reader", () => {
    render(<StatCard etichetta="Richieste" valore={120} variazione={{ valore: "+12%", direzione: "su" }} />);

    const variazione = screen.getByText("+12%").closest("dd");
    expect(variazione).toHaveClass("text-success");
    expect(variazione).toHaveAttribute("data-direzione", "su");
    expect(screen.getByText("In aumento:")).toHaveClass("sr-only");
  });

  it("con positivoSe giu una diminuzione è positiva e un aumento negativo", () => {
    const { rerender } = render(
      <StatCard etichetta="Errori" valore={3} variazione={{ valore: "-2", direzione: "giu", positivoSe: "giu" }} />
    );
    expect(screen.getByText("-2").closest("dd")).toHaveClass("text-success");
    expect(screen.getByText("In diminuzione:")).toHaveClass("sr-only");

    rerender(<StatCard etichetta="Errori" valore={3} variazione={{ valore: "+4", direzione: "su", positivoSe: "giu" }} />);
    expect(screen.getByText("+4").closest("dd")).toHaveClass("text-danger");
  });

  it("una variazione stabile resta neutra", () => {
    render(<StatCard etichetta="Richieste" valore={120} variazione={{ valore: "0%", direzione: "stabile" }} />);

    const variazione = screen.getByText("0%").closest("dd");
    expect(variazione).toHaveClass("text-slate-500");
    expect(variazione).not.toHaveClass("text-success");
    expect(variazione).not.toHaveClass("text-danger");
  });

  it("pulsa fa pulsare l'icona, che resta decorativa", () => {
    const { container } = render(<StatCard etichetta="Critici" valore={2} icona="OctagonAlert" tono="danger" pulsa />);

    const icona = container.querySelector("[aria-hidden='true'] svg")?.parentElement;
    expect(icona?.className).toContain("animate-pulse");
  });

  it("senza pulsa l'icona è ferma", () => {
    const { container } = render(<StatCard etichetta="Critici" valore={2} icona="OctagonAlert" />);

    expect(container.innerHTML).not.toContain("animate-pulse");
  });

  it("evidenzia colora bordo e valore con il tono", () => {
    const { container } = render(<StatCard etichetta="Critici" valore={2} tono="danger" evidenzia />);

    expect(container.firstElementChild).toHaveClass("border-red-200");
    expect(screen.getByText("2")).toHaveClass("text-red-700");
  });

  it("la densità compatta usa il contenitore con bordo invece della box", () => {
    const { container } = render(<StatCard etichetta="Totale" valore={1} densita="compatta" />);

    expect(container.firstElementChild).toHaveClass("rounded-control");
    expect(container.firstElementChild).not.toHaveClass("box");
  });
});

describe("StatCardGrid", () => {
  it("dispone le card su due colonne, quattro da desktop", () => {
    const { container } = render(
      <StatCardGrid>
        <StatCard etichetta="A" valore={1} />
      </StatCardGrid>
    );

    expect(container.firstElementChild).toHaveClass("grid", "grid-cols-2", "lg:grid-cols-4");
  });
});
