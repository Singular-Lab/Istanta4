// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Segmenti, { type OpzioneSegmento } from ".";

const STATI: OpzioneSegmento[] = [
  { valore: "tutti", etichetta: "Tutti", conteggio: 1234 },
  { valore: "revisione", etichetta: "In revisione", conteggio: 3 },
  { valore: "invio", etichetta: "Invio in corso" },
];

function FiltroStato({ onChange }: { onChange: (valore: string) => void }) {
  const [stato, setStato] = useState("tutti");
  return (
    <Segmenti
      etichetta="Stato"
      opzioni={STATI}
      valore={stato}
      onChange={(valore) => {
        setStato(valore);
        onChange(valore);
      }}
    />
  );
}

describe("Segmenti", () => {
  it("è un gruppo di radio con nome, e segna l'opzione scelta", () => {
    render(<Segmenti etichetta="Stato" opzioni={STATI} valore="revisione" onChange={() => undefined} />);

    expect(screen.getByRole("radiogroup", { name: "Stato" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "In revisione 3" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Tutti 1.234" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "Invio in corso" })).toBeInTheDocument();
  });

  it("solo l'opzione scelta entra nell'ordine di tabulazione", () => {
    render(<Segmenti etichetta="Stato" opzioni={STATI} valore="invio" onChange={() => undefined} />);

    const [tutti, revisione, invio] = screen.getAllByRole("radio");
    expect(invio).toHaveAttribute("tabindex", "0");
    expect(tutti).toHaveAttribute("tabindex", "-1");
    expect(revisione).toHaveAttribute("tabindex", "-1");
  });

  it("il click sceglie l'opzione; cliccare quella già scelta non richiama onChange", () => {
    const onChange = vi.fn();
    render(<FiltroStato onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Tutti/ }));
    fireEvent.click(screen.getByRole("radio", { name: /In revisione/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("revisione");
    expect(screen.getByRole("radio", { name: /In revisione/ })).toHaveAttribute("aria-checked", "true");
  });

  it("le frecce spostano scelta e focus, ricominciando dall'altro capo", () => {
    const onChange = vi.fn();
    render(<FiltroStato onChange={onChange} />);
    const [tutti, revisione, invio] = screen.getAllByRole("radio");

    fireEvent.keyDown(tutti, { key: "ArrowRight" });
    expect(revisione).toHaveFocus();
    expect(revisione).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(revisione, { key: "End" });
    expect(invio).toHaveFocus();

    fireEvent.keyDown(invio, { key: "ArrowDown" });
    expect(tutti).toHaveFocus();

    fireEvent.keyDown(tutti, { key: "ArrowLeft" });
    expect(invio).toHaveFocus();

    expect(onChange.mock.calls).toEqual([["revisione"], ["invio"], ["tutti"], ["invio"]]);
  });

  it("se il valore non corrisponde a nessuna opzione la prima resta raggiungibile", () => {
    render(<Segmenti etichetta="Stato" opzioni={STATI} valore="sconosciuto" onChange={() => undefined} />);

    const radio = screen.getAllByRole("radio");
    expect(radio[0]).toHaveAttribute("tabindex", "0");
    radio.forEach((opzione) => expect(opzione).toHaveAttribute("aria-checked", "false"));
  });
});
