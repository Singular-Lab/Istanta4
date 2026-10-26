import type { DataFields } from "../../../../../lib/types";
import { describe, expect, it } from "vitest";
import { CoopfiAgenziaLib } from "../index";
import type { CellaConfronto, MatricePromo, PromoScoreboardInput } from "../../types";
import { TracciatoService } from "../../../services/TracciatoService.js";

const buildTracciato = (guidCanale: string, guidArea: string, records: DataFields[]) => ({
  guidCanale,
  guidArea,
  context: "ctx",
  records,
});

const buildConfronto = (
  primarioNome: string,
  secondarioNome: string,
  primarioTracciati: ReturnType<typeof buildTracciato>[],
  secondarioTracciati: ReturnType<typeof buildTracciato>[],
): PromoScoreboardInput[number] => ({
  primarioNome,
  secondarioNome,
  risultato: {
    primario: {
      guidId: `${primarioNome}-id`,
      nomeMomento: primarioNome,
      tracciati: primarioTracciati,
    },
    secondario: {
      guidId: `${secondarioNome}-id`,
      nomeMomento: secondarioNome,
      tracciati: secondarioTracciati,
    },
  },
});

const buildRecord = (codiceKey: string, codiceReferenza: string, reparto: string): DataFields => ({
  codiceKey,
  codice_referenza: codiceReferenza,
  scatto_codice: codiceReferenza,
  reparto,
});

const buildScoreCell = (
  repartoNome: string,
  piDopoEvento: number,
  confrontoIndex: number,
  codice = repartoNome,
): CellaConfronto => ({
  outerKey: `K_${codice}`,
  canaleArea: "C1::A1",
  repartoNome,
  confrontoIndex,
  labelPrimario: `M${confrontoIndex}`,
  labelSecondario: `M${confrontoIndex + 1}`,
  stato: piDopoEvento === 100 ? "inalterata" : "modifica",
  campiModificatiCumulativi: piDopoEvento === 100 ? [] : ["prezzo_promo"],
  campiDettaglio: {},
  campiStoria: {},
  piPrimaDellEvento: 100,
  contributo: 100 - piDopoEvento,
  piDopoEvento,
  hasTerremoto: false,
  totaleReferenzeNelGruppo: 1,
  scattoCodice: codice,
  codiceReferenza: codice,
});

describe("coopfi promo scoreboard line chart", () => {
  const sut = new CoopfiAgenziaLib({} as any);

  async function runScoreboard(confrontiData: PromoScoreboardInput) {
    const matrice = TracciatoService._buildMatricePromo(confrontiData, sut);
    return sut.buildScoreboardReport(matrice, confrontiData);
  }

  it("adds line_chart in each canale/area view using confronti on X and one dataset per reparto", async () => {
    const recNoFood = buildRecord("K_NOFOOD", "RF1", "No Food");
    const recOrto = buildRecord("K_ORTO", "RF2", "Ortofrutta");

    const confrontiData: PromoScoreboardInput = [
      buildConfronto(
        "Momento 0",
        "Momento 1",
        [
          buildTracciato("C1", "A1", [recNoFood]),
          buildTracciato("C2", "A2", [recOrto]),
        ],
        [
          buildTracciato("C1", "A1", []),
          buildTracciato("C2", "A2", []),
        ],
      ),
      buildConfronto(
        "Momento 1",
        "Momento 2",
        [
          buildTracciato("C1", "A1", []),
          buildTracciato("C2", "A2", []),
        ],
        [
          buildTracciato("C1", "A1", [recNoFood]),
          buildTracciato("C2", "A2", [recOrto]),
        ],
      ),
    ];

    const report = await runScoreboard(confrontiData);
    expect(report.viewsPerCanaleArea).toBeDefined();
    expect(report.widgets.some((w) => w.type === "line_chart")).toBe(false);
    const expectedLabels = confrontiData.map(
      ({ primarioNome, secondarioNome }, index) => `${index + 1}. ${primarioNome} -> ${secondarioNome}`,
    );

    for (const view of report.viewsPerCanaleArea ?? []) {
      const scoreboardWidget = view.widgets.find((w) => w.type === "scoreboard");
      const lineWidget = view.widgets.find((w) => w.type === "line_chart");
      expect(scoreboardWidget).toBeDefined();
      expect(lineWidget).toBeDefined();
      if (!scoreboardWidget || scoreboardWidget.type !== "scoreboard") continue;
      if (!lineWidget || lineWidget.type !== "line_chart") continue;

      expect(lineWidget.labels).toEqual(expectedLabels);
      const repartiInRows = [...new Set(scoreboardWidget.rows.map((row) => row.reparto))].sort();
      const repartiInChart = [...new Set(lineWidget.datasets.map((d) => d.label))].sort();
      expect(repartiInChart).toEqual(repartiInRows);
      expect(lineWidget.datasets.length).toBe(repartiInRows.length);
      for (const dataset of lineWidget.datasets) {
        expect(dataset.data.length).toBe(expectedLabels.length);
        for (const value of dataset.data) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("falls back to global line_chart when viewsPerCanaleArea is not available", async () => {
    const recNoFood = buildRecord("K_NOFOOD", "RF1", "No Food");
    const recOrto = buildRecord("K_ORTO", "RF2", "Ortofrutta");
    const confrontiData: PromoScoreboardInput = [
      buildConfronto(
        "Momento 0",
        "Momento 1",
        [buildTracciato("C1", "A1", [recNoFood, recOrto])],
        [buildTracciato("C1", "A1", [])],
      ),
      buildConfronto(
        "Momento 1",
        "Momento 2",
        [buildTracciato("C1", "A1", [])],
        [buildTracciato("C1", "A1", [recNoFood, recOrto])],
      ),
    ];

    const report = await runScoreboard(confrontiData);
    expect(report.viewsPerCanaleArea).toBeUndefined();

    const lineWidget = report.widgets.find((w) => w.type === "line_chart");
    const scoreboardWidget = report.widgets.find((w) => w.type === "scoreboard");
    expect(scoreboardWidget).toBeDefined();
    expect(lineWidget).toBeDefined();
    if (!scoreboardWidget || scoreboardWidget.type !== "scoreboard") return;
    if (!lineWidget || lineWidget.type !== "line_chart") return;

    const expectedLabels = confrontiData.map(
      ({ primarioNome, secondarioNome }, index) => `${index + 1}. ${primarioNome} -> ${secondarioNome}`,
    );
    expect(lineWidget.labels).toEqual(expectedLabels);
    const repartiInRows = [...new Set(scoreboardWidget.rows.map((row) => row.reparto))].sort();
    const repartiInChart = [...new Set(lineWidget.datasets.map((d) => d.label))].sort();
    expect(repartiInChart).toEqual(repartiInRows);
    expect(lineWidget.datasets.length).toBe(2);
    for (const dataset of lineWidget.datasets) {
      expect(dataset.data.length).toBe(expectedLabels.length);
      for (const value of dataset.data) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it("uses the average of reparto scores as final scoreboard score, not the highest row", async () => {
    const stableRecord = buildRecord("K_STABLE", "RF_STABLE", "Stabile");
    const removedNoFood = buildRecord("K_NOFOOD", "RF_NOFOOD", "No Food");
    const confrontiData: PromoScoreboardInput = [
      buildConfronto(
        "Momento 0",
        "Momento 1",
        [buildTracciato("C1", "A1", [stableRecord, removedNoFood])],
        [buildTracciato("C1", "A1", [stableRecord])],
      ),
    ];

    const report = await runScoreboard(confrontiData);
    const scoreboardWidget = report.widgets.find((w) => w.type === "scoreboard");

    expect(scoreboardWidget).toBeDefined();
    if (!scoreboardWidget || scoreboardWidget.type !== "scoreboard") return;

    expect(scoreboardWidget.rows.map((row) => row.score)).toEqual([100, 0]);
    expect(scoreboardWidget.rows[0].score).toBe(100);
    expect(scoreboardWidget.totalScore).toBe(50);
    expect(scoreboardWidget.badge).toBe("Score 50/100");
    expect(report.subtitle).toContain("Score complessivo 50/100");
  });

  it("averages each reparto final score across all confronti instead of using the latest value", async () => {
    const confrontiData: PromoScoreboardInput = Array.from({ length: 4 }, (_, index) =>
      buildConfronto(
        `Momento ${index}`,
        `Momento ${index + 1}`,
        [buildTracciato("C1", "A1", [])],
        [buildTracciato("C1", "A1", [])],
      ),
    );
    const matrice: MatricePromo = [0, 0, 0, 94].map((score, index) => ({
      confrontoIndex: index,
      labelPrimario: `Momento ${index}`,
      labelSecondario: `Momento ${index + 1}`,
      celle: [buildScoreCell("Drogheria 1", score, index)],
    }));

    const report = await sut.buildScoreboardReport(matrice, confrontiData);
    const scoreboardWidget = report.widgets.find((w) => w.type === "scoreboard");

    expect(scoreboardWidget).toBeDefined();
    if (!scoreboardWidget || scoreboardWidget.type !== "scoreboard") return;

    expect(scoreboardWidget.rows).toHaveLength(1);
    expect(scoreboardWidget.rows[0].reparto).toBe("Drogheria 1");
    expect(scoreboardWidget.rows[0].score).toBe(24);
    expect(scoreboardWidget.totalScore).toBe(24);
    expect(scoreboardWidget.badge).toBe("Score 24/100");
  });

  it("averages expanded codice scores with the same timeline criteria as their reparto", async () => {
    const confrontiData: PromoScoreboardInput = Array.from({ length: 4 }, (_, index) =>
      buildConfronto(
        `Momento ${index}`,
        `Momento ${index + 1}`,
        [buildTracciato("C1", "A1", [])],
        [buildTracciato("C1", "A1", [])],
      ),
    );
    const matrice: MatricePromo = [0, 0, 0, 94].map((score, index) => ({
      confrontoIndex: index,
      labelPrimario: `Momento ${index}`,
      labelSecondario: `Momento ${index + 1}`,
      celle: [
        buildScoreCell("Drogheria 1", score, index, "54-01"),
        buildScoreCell("Drogheria 1", 100, index, "54-02"),
      ],
    }));

    const report = await sut.buildScoreboardReport(matrice, confrontiData);
    const scoreboardWidget = report.widgets.find((w) => w.type === "scoreboard");

    expect(scoreboardWidget).toBeDefined();
    if (!scoreboardWidget || scoreboardWidget.type !== "scoreboard") return;

    const row = scoreboardWidget.rows.find(item => item.reparto === "Drogheria 1");
    expect(row).toBeDefined();
    expect(row?.score).toBe(62);
    //buildScoreCell costruisce outerKey come `K_${codice}`: il report restituisce
    //la chiave cosi' com'e', senza rimuovere il prefisso del fixture.
    expect(row?.codici?.map(codice => [codice.codice, codice.score])).toEqual([
      ["K_54-01", 24],
      ["K_54-02", 100],
    ]);
  });
});
