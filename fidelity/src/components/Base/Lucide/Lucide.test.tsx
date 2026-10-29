// @vitest-environment jsdom
import { act, render, waitFor } from "@testing-library/react";
import { icons } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as iconeUsate from "./iconeUsate";

type ModuloLucide = typeof import("./index");
type ModuloRisolutore = typeof import("./risolviIconaLucide");

// La mappa completa resta in memoria nel modulo: ogni test riparte da moduli nuovi
let Lucide: ModuloLucide["default"];
let risolutore: ModuloRisolutore;
beforeEach(async () => {
  vi.resetModules();
  risolutore = await import("./risolviIconaLucide");
  Lucide = (await import("./index")).default;
});

const iconaUsata = "ChevronDown";
// Un'icona vera che il codice non nomina come stringa (es. una scelta dal menu nel DB)
const iconaNonUsata = Object.keys(icons).find(
  (nome) => !Object.prototype.hasOwnProperty.call(iconeUsate, nome)
) as string;

describe("<Lucide>", () => {
  it("disegna subito un'icona nominata nel codice, senza caricare la mappa completa", () => {
    expect(Object.prototype.hasOwnProperty.call(iconeUsate, iconaUsata)).toBe(true);

    const { container } = render(<Lucide icon={iconaUsata} className="h-4 w-4" />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("class")).toContain("lucide-chevron-down");
    expect(risolutore.mappaCompletaCaricata()).toBe(false);
  });

  it("disegna un'icona non usata nel codice dopo aver caricato la mappa completa", async () => {
    const { container } = render(<Lucide icon={iconaNonUsata} />);
    expect(container.querySelector("svg")).toBeNull();

    await waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull();
    });
    expect(risolutore.mappaCompletaCaricata()).toBe(true);
  });

  it("per un nome inesistente non disegna nulla, come prima", async () => {
    const { container } = render(<Lucide icon="IconaCheNonEsiste" />);

    await waitFor(() => {
      expect(risolutore.mappaCompletaCaricata()).toBe(true);
    });
    expect(container.querySelector("svg")).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("non scarica la mappa completa per un nome che non può essere un'icona", async () => {
    const { container } = render(<Lucide icon={undefined as unknown as string} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.innerHTML).toBe("");
    expect(risolutore.mappaCompletaCaricata()).toBe(false);
  });
});
