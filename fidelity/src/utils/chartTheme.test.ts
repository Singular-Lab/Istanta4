// @vitest-environment jsdom
import { Chart, type ChartOptions } from "chart.js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  applicaDefaultChart,
  coloreScore,
  coloreSemantico,
  COLORI_SEMANTICI,
  FONT_GRAFICO,
  LUNGHEZZA_PALETTE,
  opzioniAssi,
  opzioniBase,
  paletteCategorica,
  paletteColore,
  tonoScore,
  TOOLTIP,
} from "./chartTheme";

// getColor legge le variabili CSS del tema dal body
beforeAll(() => {
  document.body.style.setProperty("--color-theme-1", "3 4 94");
  document.body.style.setProperty("--color-theme-2", "12 74 110");
  document.body.style.setProperty("--color-success", "13 148 136");
  document.body.style.setProperty("--color-warning", "245 158 11");
  document.body.style.setProperty("--color-danger", "220 38 38");
});

describe("palette dei grafici", () => {
  it("inizia con il primo colore del tema, poi la serie fissa, e chiude con il secondo", () => {
    expect(paletteCategorica()).toEqual([
      "rgb(3 4 94 / 1)",
      "rgb(8 145 178 / 1)",
      "rgb(217 119 6 / 1)",
      "rgb(5 150 105 / 1)",
      "rgb(124 58 237 / 1)",
      "rgb(190 18 60 / 1)",
      "rgb(37 99 235 / 1)",
      "rgb(101 163 13 / 1)",
      "rgb(234 88 12 / 1)",
      "rgb(15 118 110 / 1)",
      "rgb(147 51 234 / 1)",
      "rgb(79 70 229 / 1)",
      "rgb(12 74 110 / 1)",
    ]);
    expect(LUNGHEZZA_PALETTE).toBe(13);
  });

  it("nessun colore si ripete prima che la palette ricominci", () => {
    expect(new Set(paletteCategorica()).size).toBe(LUNGHEZZA_PALETTE);
  });

  it("dopo l'ultimo colore ricomincia dal primo", () => {
    expect(paletteColore(LUNGHEZZA_PALETTE)).toBe(paletteColore(0));
    expect(paletteColore(LUNGHEZZA_PALETTE + 3)).toBe(paletteColore(3));
    expect(paletteColore(-1)).toBe(paletteColore(LUNGHEZZA_PALETTE - 1));
  });

  it("applica la trasparenza richiesta", () => {
    expect(paletteColore(0, 0.2)).toBe("rgb(3 4 94 / 0.2)");
    expect(paletteColore(2, 0.5)).toBe("rgb(217 119 6 / 0.5)");
    expect(paletteColore(LUNGHEZZA_PALETTE - 1, 0.5)).toBe("rgb(12 74 110 / 0.5)");
  });
});

describe("coloreScore", () => {
  it("sotto 40 è negativo, da 40 attenzione, da 70 positivo", () => {
    expect(coloreScore(39)).toBe(COLORI_SEMANTICI.negativo);
    expect(coloreScore(40)).toBe(COLORI_SEMANTICI.attenzione);
    expect(coloreScore(69)).toBe(COLORI_SEMANTICI.attenzione);
    expect(coloreScore(70)).toBe(COLORI_SEMANTICI.positivo);
    expect(COLORI_SEMANTICI.positivo).toBe("rgb(13 148 136 / 1)");
  });

  it("tonoScore usa le stesse soglie, per i badge e le card", () => {
    expect(tonoScore(39)).toBe("danger");
    expect(tonoScore(40)).toBe("warning");
    expect(tonoScore(69)).toBe("warning");
    expect(tonoScore(70)).toBe("success");
  });

  it("i colori semantici accettano la trasparenza", () => {
    expect(coloreSemantico("negativo", 0.3)).toBe("rgb(220 38 38 / 0.3)");
    expect(coloreSemantico("neutro")).toBe("rgb(148 163 184 / 1)");
  });
});

describe("opzioniBase", () => {
  it("unisce le opzioni del grafico senza perdere font, griglia e tooltip", () => {
    const opzioni = opzioniBase("bar", {
      indexAxis: "y",
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: () => "x" } } },
      scales: { x: { min: 0, max: 100 } },
    }) as ChartOptions<"bar"> & Record<string, any>;

    expect(opzioni.responsive).toBe(true);
    expect(opzioni.maintainAspectRatio).toBe(false);
    expect(opzioni.indexAxis).toBe("y");
    expect(opzioni.plugins?.legend?.display).toBe(false);
    expect(opzioni.plugins?.legend?.labels?.font).toMatchObject({ family: FONT_GRAFICO.family });
    expect(opzioni.plugins?.tooltip?.backgroundColor).toBe(TOOLTIP.backgroundColor);
    expect(opzioni.plugins?.tooltip?.padding).toBe(10);
    expect(typeof opzioni.plugins?.tooltip?.callbacks?.label).toBe("function");
    expect(opzioni.scales?.x?.min).toBe(0);
    expect(opzioni.scales?.x?.max).toBe(100);
    expect(opzioni.scales?.x?.grid?.color).toBeTruthy();
    expect(opzioni.scales?.x?.ticks?.font).toMatchObject({ family: FONT_GRAFICO.family, size: FONT_GRAFICO.size });
    expect(opzioni.scales?.y?.ticks?.font).toMatchObject({ family: FONT_GRAFICO.family });
  });

  it("le opzioni del grafico prevalgono su quelle comuni", () => {
    const opzioni = opzioniBase("line", {
      scales: { y: { grid: { color: "red" } } },
    }) as Record<string, any>;

    expect(opzioni.scales.y.grid.color).toBe("red");
    expect(opzioni.scales.y.ticks.font.family).toBe(FONT_GRAFICO.family);
  });

  it("dà lo stile anche agli assi aggiuntivi", () => {
    const opzioni = opzioniBase("line", { scales: { y1: { position: "right" } } }) as Record<string, any>;

    expect(opzioni.scales.y1.position).toBe("right");
    expect(opzioni.scales.y1.ticks.font.family).toBe(FONT_GRAFICO.family);
  });

  it("i grafici a ciambella non ricevono assi", () => {
    const opzioni = opzioniBase("doughnut", { cutout: "70%" }) as Record<string, any>;

    expect(opzioni.scales).toBeUndefined();
    expect(opzioni.cutout).toBe("70%");
  });

  it("non modifica l'oggetto passato", () => {
    const override = { plugins: { legend: { display: false } } };
    opzioniBase("bar", override);

    expect(override).toEqual({ plugins: { legend: { display: false } } });
  });
});

describe("opzioniAssi", () => {
  it("imposta solo i limiti richiesti", () => {
    expect(opzioniAssi({ xGriglia: false, yMin: 0, yMax: 100, stepSize: 20 })).toEqual({
      x: { grid: { display: false } },
      y: { min: 0, max: 100, ticks: { stepSize: 20 } },
    });
    expect(opzioniAssi()).toEqual({ x: { grid: { display: true } }, y: {} });
  });
});

describe("applicaDefaultChart", () => {
  it("imposta font e colore predefiniti ed è ripetibile", () => {
    applicaDefaultChart(Chart);
    const famiglia = Chart.defaults.font.family;
    const colore = Chart.defaults.color;

    applicaDefaultChart(Chart);

    expect(famiglia).toBe(FONT_GRAFICO.family);
    expect(Chart.defaults.font.family).toBe(famiglia);
    expect(Chart.defaults.color).toBe(colore);
    expect(colore).toBe("rgb(100 116 139 / 1)");
  });
});
