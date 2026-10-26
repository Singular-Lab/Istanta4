// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import IconInput from "./IconInput";

describe("IconInput", () => {
  it("mostra l'anteprima dell'icona per impostazione predefinita, come in Gestione Hub", () => {
    render(<IconInput label="Icona" name="icona" value="Box" onChange={vi.fn()} />);

    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("non mostra l'anteprima quando la pagina ne ha una sua", () => {
    render(<IconInput label="Icona" name="icona" value="Box" mostraAnteprima={false} onChange={vi.fn()} />);

    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Icona")).toHaveValue("Box");
  });
});
