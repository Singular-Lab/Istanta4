import { describe, expect, it } from "vitest";
import { PALETTE_REPORT_STANDARD } from "../../../../../lib/insightVolantino/report";
import type { IUserService } from "../../../interfaces/IUserService";
import { ConadcnoAgenziaLib } from "../../conadcno/index.js";
import { CoopfiAgenziaLib } from "../index.js";

// Spec insight-volantino: regole del report PDF di Coop Firenze.

const userService = {} as IUserService;

describe("CoopfiAgenziaLib: report del volantino", () => {
  const agenzia = new CoopfiAgenziaLib(userService);
  const { insightVolantino } = agenzia;

  it("palette sobria propria per primario e accento, diversa da quella di CONAD CNO; il resto dagli standard", () => {
    const conad = new ConadcnoAgenziaLib(userService).insightVolantino;

    expect(insightVolantino?.palette).toEqual({ primario: expect.stringMatching(/^#[0-9a-f]{6}$/i), accento: expect.stringMatching(/^#[0-9a-f]{6}$/i) });
    expect(insightVolantino?.palette?.primario).not.toBe(PALETTE_REPORT_STANDARD.primario);
    expect(insightVolantino?.palette).not.toEqual(conad?.palette);
  });

  it("intestazione col nome del cliente e la riservatezza, senza logo", () => {
    expect(insightVolantino?.intestazione).toEqual({ cliente: "Coop Firenze", riservatezza: "Riservato - uso interno" });
    expect(insightVolantino?.intestazione).not.toHaveProperty("logo");
  });

  it("le sezioni restano quelle standard, nell'ordine standard: nessun riordino proprio", () => {
    expect(insightVolantino?.sezioniReport).toBeUndefined();
    expect(Object.keys(insightVolantino ?? {}).sort()).toEqual(["intestazione", "palette"]);
  });

  it("nessun tracciato delle vendite", () => {
    expect(agenzia).not.toHaveProperty("importVendite");
  });
});
