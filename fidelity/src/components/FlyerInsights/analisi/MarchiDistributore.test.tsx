// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LineeDistributore } from "../../../../lib/insightVolantino/tipi";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { iniziali, MarchiDistributore, testoSuColore } from "./MarchiDistributore";

const LINEE: LineeDistributore = {
  quotaSpazio: 18.4,
  quotaBox: 15,
  box: 12,
  linee: [
    { sigla: "SD", nome: "Sapori & Dintorni", colore: "#b45309", logo: "/olimpo/logo-sd.png", box: 7, referenze: 9, quotaSpazio: 11.2, scontoMedio: 20 },
    { sigla: "VN", nome: "Verso Natura", colore: null, logo: null, box: 5, referenze: 5, quotaSpazio: 5.6, scontoMedio: null },
  ],
  bolli: [
    { sigla: "DOP", nome: "DOP", logo: "/olimpo/dop.png", box: 3 },
    { sigla: "FC", nome: "Filiera controllata", logo: null, box: 1 },
  ],
};

describe("MarchiDistributore", () => {
  it("dice la quota dello spazio dei marchi del distributore contro le altre marche", () => {
    render(<MarchiDistributore linee={LINEE} />);

    expect(screen.getByText(/dello spazio del volantino, 12 box \(15% dei box\)/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Marchi del distributore 18,4% dello spazio, altre marche 81,6%" })).toBeInTheDocument();
    const legenda = screen.getByRole("list", { name: "Legenda" });
    expect(within(legenda).getByText("Marchi del distributore 18,4%")).toBeInTheDocument();
    expect(within(legenda).getByText("Altre marche 81,6%")).toBeInTheDocument();
  });

  it("una scheda per linea con logo, box e spazio; senza logo le iniziali nel colore della linea", () => {
    const { container } = render(<MarchiDistributore linee={LINEE} />);

    const linee = within(screen.getByRole("list", { name: "Linee del distributore" })).getAllByRole("listitem");
    expect(linee).toHaveLength(2);
    expect(linee[0]).toHaveTextContent("Sapori & Dintorni");
    expect(linee[0]).toHaveTextContent("7 box · 11,2% dello spazio");
    expect(linee[0].querySelector("img")).toHaveAttribute("src", "/olimpo/logo-sd.png");
    expect(linee[1]).toHaveTextContent("Verso Natura");
    expect(linee[1].querySelector("img")).toBeNull();
    expect(linee[1].querySelector("[data-monogramma]")).toHaveTextContent("VN");
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

  it("un logo che non si carica lascia il posto alle iniziali", () => {
    render(<MarchiDistributore linee={LINEE} />);

    const prima = within(screen.getByRole("list", { name: "Linee del distributore" })).getAllByRole("listitem")[0];
    fireEvent.error(prima.querySelector("img")!);
    expect(prima.querySelector("img")).toBeNull();
    const monogramma = prima.querySelector("[data-monogramma]") as HTMLElement;
    expect(monogramma).toHaveTextContent("SD");
    expect(monogramma.style.backgroundColor).toBe("rgb(180, 83, 9)");
  });

  it("i bolli del volantino come pastiglie con logo o iniziali, nome e box", () => {
    render(<MarchiDistributore linee={LINEE} />);

    const bolli = within(screen.getByRole("list", { name: "Bolli nel volantino" })).getAllByRole("listitem");
    expect(bolli.map(bollo => bollo.textContent)).toEqual(["DOP3 box", "FCFiliera controllata1 box"]);
  });

  it("senza bolli non c'è il loro blocco; senza linee presenti lo dice", () => {
    render(<MarchiDistributore linee={{ ...LINEE, quotaSpazio: 0, quotaBox: 0, box: 0, linee: [], bolli: [] }} />);

    expect(screen.queryByRole("list", { name: "Bolli nel volantino" })).not.toBeInTheDocument();
    expect(screen.getByText("Nessun prodotto delle linee del distributore in questo volantino.")).toBeInTheDocument();
  });
});

describe("iniziali e testoSuColore", () => {
  it("le iniziali saltano le parole vuote e la punteggiatura", () => {
    expect(iniziali("Sapori & Dintorni")).toBe("SD");
    expect(iniziali("Il Viaggiator Goloso")).toBe("VG");
    expect(iniziali("Bio")).toBe("BI");
    expect(iniziali("&", "x")).toBe("X");
  });

  it("testo chiaro sui colori scuri, scuro sui chiari; null senza un colore valido", () => {
    expect(testoSuColore("#1e3a8a")).toBe("text-white");
    expect(testoSuColore("#fde68a")).toBe("text-slate-900");
    expect(testoSuColore("#fff")).toBe("text-slate-900");
    expect(testoSuColore("blu")).toBeNull();
    expect(testoSuColore(null)).toBeNull();
  });
});
