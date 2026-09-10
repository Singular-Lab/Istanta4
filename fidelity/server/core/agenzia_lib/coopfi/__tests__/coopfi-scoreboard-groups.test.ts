import type { DataFields, TracciatoReportWidget, TracciatoWidgetScoreboardCodiceRow, TracciatoWidgetScoreboardRow } from "../../../../../lib/types";
import { describe, expect, it, vi } from "vitest";
import { TracciatoService } from "../../../services/TracciatoService.js";
import { CoopfiAgenziaLib } from "../index.js";
import type { CellaConfronto, IAgenziaLib, MatricePromo, PromoScoreboardInput } from "../../types.js";

const makeAgenziaLib = (
  computeContributo: IAgenziaLib["computeContributo"],
  getChangedFields: IAgenziaLib["getChangedFields"] = () => [],
): IAgenziaLib => ({
  computeContributo,
  getChangedFields,
  getScoreboardConfig: () => null,
  normalizzaDatoConfrontoPerScore: async (data) => data,
  buildScoreboardReport: async () => ({ title: "", subtitle: "", generatedAt: "", widgets: [] }),
  elaboraDatoPerAgenzia: async () => ({ title: "", subtitle: "", generatedAt: "", widgets: [] }),
  parseUtenteOIDC: async () => ({ id: "", email: "", tipo_utente: "" as any }),
});

const applyPercentDrops = (scoreIniziale: number, dropsPercentuali: number[]): number =>
  Math.max(
    0,
    Math.round(
      dropsPercentuali.reduce(
        (scoreCorrente, dropPercentuale) => scoreCorrente - ((dropPercentuale / 100) * scoreCorrente),
        scoreIniziale,
      ),
    ),
  );

const createConfronto = (
  primarioRecords: DataFields[],
  secondarioRecords: DataFields[],
  primarioNome = "Primario",
  secondarioNome = "Secondario",
): PromoScoreboardInput[number] => ({
  primarioNome,
  secondarioNome,
  risultato: {
    primario: {
      guidId: "primario-guid",
      nomeMomento: primarioNome,
      tracciati: [
        {
          guidCanale: "canale-1",
          guidArea: "area-1",
          context: "ctx",
          records: primarioRecords,
        },
      ],
    },
    secondario: {
      guidId: "secondario-guid",
      nomeMomento: secondarioNome,
      tracciati: [
        {
          guidCanale: "canale-1",
          guidArea: "area-1",
          context: "ctx",
          records: secondarioRecords,
        },
      ],
    },
  },
});

const createCellaTerremoto = (overrides: Partial<CellaConfronto>): CellaConfronto => ({
  outerKey: "K1",
  canaleArea: "canale-1::area-1",
  repartoNome: "Test",
  confrontoIndex: 0,
  labelPrimario: "M0",
  labelSecondario: "M1",
  stato: "modifica",
  campiModificatiCumulativi: [],
  campiDettaglio: {},
  campiStoria: {},
  piPrimaDellEvento: 100,
  contributo: 0,
  piDopoEvento: 100,
  hasTerremoto: false,
  totaleReferenzeNelGruppo: 1,
  scattoCodice: "A",
  codiceReferenza: "A",
  ...overrides,
});

describe("coopfi promo scoreboard matrix group split", () => {
  it("splits group uscita impact by group size (4 members => quarter impact)", () => {
    const lib = makeAgenziaLib(() => ({ contributoRaw: 50, hasTerremoto: false }));
    const matrice = TracciatoService._buildMatricePromo([
      createConfronto(
        [{ codiceKey: "K1", codice_referenza: "A", scatto_codice: "A,B,C,D", reparto: "Test", tipo: "gruppo" }],
        [],
      ),
    ], lib);

    const cella = matrice[0].celle[0];
    expect(cella.contributo).toBeCloseTo(12.5, 8);
    expect(Math.round(cella.piDopoEvento)).toBe(88);
  });

  it("applies group split also on modifica", () => {
    const lib = makeAgenziaLib(
      () => ({ contributoRaw: 10, hasTerremoto: false }),
      (a, b) => a.prezzo !== b.prezzo ? [{ campo: "prezzo_promo", valoreA: a.prezzo, valoreB: b.prezzo }] : [],
    );
    const matriceGruppo = TracciatoService._buildMatricePromo([
      createConfronto(
        [{ codiceKey: "K1", codice_referenza: "A", scatto_codice: "A,B,C,D", reparto: "Test", prezzo: 1 }],
        [{ codiceKey: "K1", codice_referenza: "A", scatto_codice: "A,B,C,D", reparto: "Test", prezzo: 2 }],
      ),
    ], lib);
    const matriceSingolo = TracciatoService._buildMatricePromo([
      createConfronto(
        [{ codiceKey: "K1", codice_referenza: "A", scatto_codice: "A", reparto: "Test", prezzo: 1 }],
        [{ codiceKey: "K1", codice_referenza: "A", scatto_codice: "A", reparto: "Test", prezzo: 2 }],
      ),
    ], lib);

    expect(matriceSingolo[0].celle[0].contributo).toBeGreaterThan(0);
    expect(matriceGruppo[0].celle[0].contributo).toBeCloseTo(matriceSingolo[0].celle[0].contributo / 4, 8);
  });

  it("parses group size with trim + dedup", () => {
    const lib = makeAgenziaLib(() => ({ contributoRaw: 50, hasTerremoto: false }));
    const size = TracciatoService.resolveGroupSizeFromScattoCodice("A, B, A", "A");
    const matrice = TracciatoService._buildMatricePromo([
      createConfronto(
        [{ codiceKey: "K1", codice_referenza: "A", scatto_codice: "A, B, A", reparto: "Test", tipo: "gruppo" }],
        [],
      ),
    ], lib);

    expect(size).toBe(2);
    expect(matrice[0].celle[0].contributo).toBeCloseTo(25, 8);
    expect(Math.round(matrice[0].celle[0].piDopoEvento)).toBe(75);
  });

  it("keeps singolo impact unchanged while splitting gruppo in mixed outer-key scenarios", () => {
    const lib = makeAgenziaLib(() => ({ contributoRaw: 50, hasTerremoto: false }));
    const matrice = TracciatoService._buildMatricePromo([
      createConfronto(
        [
          { codiceKey: "K1", codice_referenza: "A", scatto_codice: "A,B,C,D", reparto: "Test", tipo: "gruppo" },
          { codiceKey: "K1", codice_referenza: "S1", scatto_codice: "S1", reparto: "Test", tipo: "singolo" },
        ],
        [],
      ),
    ], lib);
    const expected = applyPercentDrops(100, [6.25, 25]);

    expect(Math.round(matrice[0].celle[0].piDopoEvento)).toBe(expected);
  });

  it("applies event degrado as percentage of current PI", () => {
    const lib = makeAgenziaLib(() => ({ contributoRaw: 50, hasTerremoto: false }));
    const matrice = TracciatoService._buildMatricePromo([
      createConfronto(
        [
          { codiceKey: "K1", codice_referenza: "A", scatto_codice: "A", reparto: "Test" },
          { codiceKey: "K1", codice_referenza: "B", scatto_codice: "B", reparto: "Test" },
        ],
        [],
      ),
    ], lib);

    expect(matrice[0].celle[0].piDopoEvento).toBeCloseTo(56.25, 8);
  });

  it("applies terremoto as code-controlled cascade on the next comparison", () => {
    const lib = makeAgenziaLib((_tipo, _reparto, _campi, opts) => {
      if (opts?.prevEvent === "uscita") return { contributoRaw: 80, hasTerremoto: true };
      return { contributoRaw: 40, hasTerremoto: true };
    });
    const matrice = TracciatoService._buildMatricePromo([
      createConfronto(
        [{ codiceKey: "K1", codice_referenza: "A", scatto_codice: "A", reparto: "Test" }],
        [],
        "M0",
        "M1",
      ),
      createConfronto(
        [],
        [{ codiceKey: "K1", codice_referenza: "A", scatto_codice: "A", reparto: "Test" }],
        "M1",
        "M2",
      ),
    ], lib);

    expect(matrice[1].celle[0].piDopoEvento).toBeCloseTo(12, 8);
    expect(matrice[1].celle[0].hasTerremoto).toBe(true);
  });

  it("applies only the latest terremoto and recalculates intensity for every previous comparison", async () => {
    const celle = [
      createCellaTerremoto({ confrontoIndex: 0, labelPrimario: "M0", labelSecondario: "M1" }),
      createCellaTerremoto({ confrontoIndex: 1, labelPrimario: "M1", labelSecondario: "M2", hasTerremoto: true }),
      createCellaTerremoto({ confrontoIndex: 2, labelPrimario: "M2", labelSecondario: "M3" }),
      createCellaTerremoto({ confrontoIndex: 3, labelPrimario: "M3", labelSecondario: "M4", hasTerremoto: true }),
    ];
    const matrice: MatricePromo = celle.map((cella) => ({
      confrontoIndex: cella.confrontoIndex,
      labelPrimario: cella.labelPrimario,
      labelSecondario: cella.labelSecondario,
      terremotoDegradoMassimo: cella.confrontoIndex === 3 ? 50 : 80,
      celle: [cella],
    }));
    const calcolaIntensitaTerremoto = vi.fn((cella: CellaConfronto) => ({
      0: 20,
      1: 100,
      2: 60,
      3: 100,
    })[cella.confrontoIndex] ?? 0);

    await CoopfiAgenziaLib.prototype.calcolaTerremotoPerMatriceDiValori.call(
      { calcolaIntensitaTerremoto },
      matrice,
    );

    expect(calcolaIntensitaTerremoto.mock.calls.map(([cella]) => cella.confrontoIndex)).toEqual([2, 1, 0]);
    expect(matrice[0].celle[0].piDopoEvento).toBeCloseTo(90, 8);
    expect(matrice[1].celle[0].piDopoEvento).toBeCloseTo(50, 8);
    expect(matrice[2].celle[0].piDopoEvento).toBeCloseTo(70, 8);
    expect(matrice[3].celle[0].piDopoEvento).toBeCloseTo(100, 8);
  });

  it("removes singoli that are already covered by gruppo members in primario and secondario", () => {
    const pMap = new Map<string, { codice_referenza?: unknown; scatto_codice?: unknown; tipo?: unknown }>([
      ["A,B,C", { codice_referenza: "A", scatto_codice: "A,B,C", tipo: "gruppo" }],
      ["A", { codice_referenza: "A", scatto_codice: "A", tipo: "singolo" }],
      ["D", { codice_referenza: "D", scatto_codice: "D", tipo: "singolo" }],
    ]);
    const sMap = new Map<string, { codice_referenza?: unknown; scatto_codice?: unknown; tipo?: unknown }>([
      ["B", { codice_referenza: "B", scatto_codice: "B", tipo: "singolo" }],
      ["E", { codice_referenza: "E", scatto_codice: "E", tipo: "singolo" }],
    ]);

    TracciatoService.removeSinglesIncludedInGroups(pMap, sMap);

    expect([...pMap.keys()]).toEqual(["A,B,C", "D"]);
    expect([...sMap.keys()]).toEqual(["E"]);
  });

  it("keeps field history inside the rectangular matrix", () => {
    const lib = makeAgenziaLib(
      () => ({ contributoRaw: 10, hasTerremoto: false }),
      (a, b) => a.prezzo !== b.prezzo ? [{ campo: "prezzo_promo", valoreA: a.prezzo, valoreB: b.prezzo }] : [],
    );
    const matrice = TracciatoService._buildMatricePromo([
      createConfronto(
        [{ codiceKey: "K_AUDIT", codice_referenza: "A", scatto_codice: "A", reparto: "Audit", prezzo: 1 }],
        [{ codiceKey: "K_AUDIT", codice_referenza: "A", scatto_codice: "A", reparto: "Audit", prezzo: 2 }],
      ),
      createConfronto([], [], "Secondario", "Terzo"),
    ], lib);

    expect(matrice).toHaveLength(2);
    expect(matrice[0].celle).toHaveLength(1);
    expect(matrice[1].celle).toHaveLength(1);
    expect(matrice[0].celle[0].campiStoria.prezzo_promo.variazioni).toHaveLength(1);
    expect(matrice[1].celle[0].stato).toBe("non_esistente");
  });

  it("keeps scoreboard row numeric shape contract intact", () => {
    const codiceRow: TracciatoWidgetScoreboardCodiceRow = {
      codice: "TEST",
      percentualeIntegra: 75,
      score: 75,
      inalterati: 0,
      uscenti: 1,
      entranti: 0,
      modificati: 0,
      totale: 1,
    };
    const repartoRow: TracciatoWidgetScoreboardRow = {
      reparto: "No Food",
      percentualeIntegra: 75,
      score: 75,
      inalterati: 0,
      uscenti: 1,
      entranti: 0,
      modificati: 0,
      totale: 1,
      codici: [codiceRow],
    };

    expect(typeof repartoRow.score).toBe("number");
    expect(typeof repartoRow.totale).toBe("number");
    expect(typeof repartoRow.codici?.[0]?.score).toBe("number");
  });

  it("keeps the KPI variation count aligned with price diff detail rows", () => {
    const buildWidgets = (CoopfiAgenziaLib.prototype as unknown as {
      buildWidgets: (
        primarioRecords: DataFields[],
        secondarioRecords: DataFields[],
        labelPrimario: string,
        labelSecondario: string,
      ) => TracciatoReportWidget[];
    }).buildWidgets;

    const primarioRecords: DataFields[] = [
      { codice_referenza: "1046025", reparto: "SPORT", tipo: "singolo", nPunti: "10", prezzo: "4.99", descrizione_uno: "TELO MARE", descrizione_due: "", tema: "SPENDI PUNTI" },
      { codice_referenza: "4584254", reparto: "ORTOFRUTTA", tipo: "gruppo", prezzo: "2.49", descrizione_uno: "COC P.SEMI", descrizione_due: "", tema: "EX TRIPLA" },
      { codice_referenza: "4774891", reparto: "ORTOFRUTTA", tipo: "gruppo", prezzo: "1.99", descrizione_uno: "COCOMERO", descrizione_due: "", tema: "EX TRIPLA" },
      { codice_referenza: "9000000", reparto: "DROGHERIA", tipo: "singolo", prezzo: "3.00", descrizione_uno: "INVARIATO", descrizione_due: "", tema: "BASE" },
    ];
    const secondarioRecords: DataFields[] = [
      { codice_referenza: "1046025", reparto: "SPORT", tipo: "singolo", nPunti: "15", prezzo: "5.49", descrizione_uno: "TELO MARE", descrizione_due: "", tema: "SPENDI PUNTI" },
      { codice_referenza: "4584254", reparto: "ORTOFRUTTA", tipo: "gruppo", prezzo: "2.79", descrizione_uno: "COC P.SEMI", descrizione_due: "", tema: "EX TRIPLA" },
      { codice_referenza: "4774891", reparto: "ORTOFRUTTA", tipo: "gruppo", prezzo: "2.19", descrizione_uno: "COCOMERO", descrizione_due: "", tema: "EX TRIPLA" },
      { codice_referenza: "9000000", reparto: "DROGHERIA", tipo: "singolo", prezzo: "3.00", descrizione_uno: "INVARIATO", descrizione_due: "", tema: "BASE" },
      { codice_referenza: "1111111", reparto: "DROGHERIA", tipo: "singolo", prezzo: "1.00", descrizione_uno: "ENTRANTE", descrizione_due: "", tema: "BASE" },
    ];

    const widgets = buildWidgets.call({}, primarioRecords, secondarioRecords, "Terza importazione", "Quarta importazione");
    const kpiWidget = widgets.find((widget) => widget.id === "kpi-reparto-summary");
    const priceDiffWidget = widgets.find((widget) => widget.type === "price_diff");

    expect(kpiWidget?.type).toBe("kpi_grid");
    expect(priceDiffWidget?.type).toBe("price_diff");
    if (kpiWidget?.type !== "kpi_grid" || priceDiffWidget?.type !== "price_diff") return;

    const variationKpi = kpiWidget.items.find((item) => item.label === "Variazioni");
    // Le righe includono anche i campi prezzo collegati invariati come contesto (prima = dopo):
    // le variazioni reali sono solo quelle con valori diversi, ed è su quelle che si allinea il KPI.
    const totalRealChanges = priceDiffWidget.rows.reduce(
      (sum, row) => sum + row.changes.filter((change) => change.valoreA !== change.valoreB).length,
      0,
    );

    expect(priceDiffWidget.rows).toHaveLength(3);
    expect(totalRealChanges).toBe(4);
    expect(variationKpi?.value).toBe(totalRealChanges);
    // Se cambia uno dei campi prezzo collegati, la riga li mostra sempre tutti e quattro
    const linkedRow = priceDiffWidget.rows.find((row) => row.codice === "4584254");
    expect(linkedRow?.changes.map((change) => change.campo)).toEqual(
      expect.arrayContaining(["txt_sconto", "prezzo", "prezzo_continuo", "prezzo_promo_kgl"]),
    );
    expect(kpiWidget.description).toContain("1 ingressi/uscite");
    expect(kpiWidget.description).toContain("4 variazioni");
  });

  it("treats empty-to-valued N_Punti as a meaningful change", () => {
    const buildWidgets = (CoopfiAgenziaLib.prototype as unknown as {
      buildWidgets: (
        primarioRecords: DataFields[],
        secondarioRecords: DataFields[],
        labelPrimario: string,
        labelSecondario: string,
      ) => TracciatoReportWidget[];
    }).buildWidgets;

    const primarioRecords: DataFields[] = [
      {
        codice_referenza: "1046025",
        reparto: "SPORT",
        tipo: "singolo",
        nPunti: "",
        descrizione_uno: "TELO MARE",
        descrizione_due: "",
        tema: "SPENDI PUNTI",
      },
    ];
    const secondarioRecords: DataFields[] = [
      {
        codice_referenza: "1046025",
        reparto: "SPORT",
        tipo: "singolo",
        nPunti: "500",
        descrizione_uno: "TELO MARE",
        descrizione_due: "",
        tema: "SPENDI PUNTI",
      },
    ];

    const widgets = buildWidgets.call({}, primarioRecords, secondarioRecords, "Terza importazione", "Quarta importazione");
    const kpiWidget = widgets.find((widget) => widget.id === "kpi-reparto-summary");
    const priceDiffWidget = widgets.find((widget) => widget.type === "price_diff");

    expect(kpiWidget?.type).toBe("kpi_grid");
    expect(priceDiffWidget?.type).toBe("price_diff");
    if (kpiWidget?.type !== "kpi_grid" || priceDiffWidget?.type !== "price_diff") return;

    const variationKpi = kpiWidget.items.find((item) => item.label === "Variazioni");
    expect(variationKpi?.value).toBe(1);
    expect(priceDiffWidget.rows).toHaveLength(1);
    expect(priceDiffWidget.rows[0]?.changes).toEqual([
      expect.objectContaining({
        campo: "N_Punti",
        valoreA: "—",
        valoreB: "500",
      }),
    ]);
  });
});
