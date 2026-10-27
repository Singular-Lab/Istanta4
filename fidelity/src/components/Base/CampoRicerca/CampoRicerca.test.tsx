// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import CampoRicerca from ".";

function RicercaControllata({ onCerca }: { onCerca: (valore: string) => void }) {
  const [testo, setTesto] = useState("");
  return (
    <CampoRicerca
      etichetta="Cerca ordini"
      value={testo}
      onChange={(valore) => {
        setTesto(valore);
        onCerca(valore);
      }}
    />
  );
}

describe("CampoRicerca", () => {
  it("è un campo di ricerca con il nome dato da etichetta", () => {
    render(<CampoRicerca etichetta="Cerca ordini" value="" onChange={() => undefined} placeholder="Promo o ID ordine" />);

    const campo = screen.getByRole("searchbox", { name: "Cerca ordini" });
    expect(campo).toHaveAttribute("placeholder", "Promo o ID ordine");
    expect(campo).toHaveClass("pl-9");
  });

  it("onChange riceve il testo scritto", () => {
    const onCerca = vi.fn();
    render(<RicercaControllata onCerca={onCerca} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Cerca ordini" }), { target: { value: "natale" } });

    expect(onCerca).toHaveBeenCalledWith("natale");
    expect(screen.getByRole("searchbox")).toHaveValue("natale");
  });

  it("senza placeholder mostra quello predefinito; className va al contenitore", () => {
    const { container } = render(<CampoRicerca etichetta="Cerca" value="" onChange={() => undefined} className="sm:w-96" />);

    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Cerca…");
    expect(container.firstElementChild).toHaveClass("relative", "w-full", "sm:w-96");
    expect(container.firstElementChild).not.toHaveClass("sm:w-72");
  });

  it("inoltra ref e attributi al campo", () => {
    const ref = createRef<HTMLInputElement>();
    render(<CampoRicerca ref={ref} id="ricerca" etichetta="Cerca" value="" onChange={() => undefined} disabled />);

    expect(ref.current).toBe(screen.getByRole("searchbox"));
    expect(ref.current).toHaveAttribute("id", "ricerca");
    expect(ref.current).toBeDisabled();
  });
});
