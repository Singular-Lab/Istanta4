// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Button from ".";

describe("Button", () => {
  it("senza loading funziona come un normale pulsante", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salva</Button>);

    const pulsante = screen.getByRole("button", { name: "Salva" });
    fireEvent.click(pulsante);

    expect(pulsante).toBeEnabled();
    expect(pulsante).not.toHaveAttribute("aria-busy");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("durante il caricamento tiene l'etichetta, è disattivato e non ripete l'azione", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Salva
      </Button>
    );

    const pulsante = screen.getByRole("button", { name: "Salva" });
    fireEvent.click(pulsante);
    fireEvent.click(pulsante);

    expect(pulsante).toBeDisabled();
    expect(pulsante).toHaveAttribute("aria-busy", "true");
    expect(pulsante.querySelector("svg.animate-spin")).toBeInTheDocument();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading prevale su disabled={false}", () => {
    render(
      <Button loading disabled={false}>
        Invia
      </Button>
    );

    expect(screen.getByRole("button", { name: "Invia" })).toBeDisabled();
  });

  it("un link in caricamento è segnato come non disponibile", () => {
    render(
      <Button as="a" href="/export" loading>
        Esporta
      </Button>
    );

    const link = screen.getByRole("link", { name: "Esporta" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("aria-busy", "true");
    expect(link).not.toHaveAttribute("disabled");
  });

  it("il prop icon viene mostrato ma non finisce negli attributi HTML", () => {
    render(<Button icon={<span data-testid="icona" />}>Apri</Button>);

    const pulsante = screen.getByRole("button", { name: "Apri" });
    expect(screen.getByTestId("icona")).toBeInTheDocument();
    expect(pulsante).not.toHaveAttribute("icon");
  });
});
