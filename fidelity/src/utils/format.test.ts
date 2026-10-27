import { describe, expect, it } from "vitest";
import { formatData, formatDataOra, formatDataOraEstesa, valoreOAssente, VALORE_ASSENTE } from "./format";

const DATA = new Date(2026, 8, 3, 10, 30);

describe("formati comuni", () => {
  it("formatta data, data e ora, data e ora estesa", () => {
    expect(formatData(DATA)).toBe("03/09/2026");
    expect(formatDataOra(DATA)).toBe("03/09/2026 10:30");
    expect(formatDataOraEstesa(DATA)).toBe("03/09/2026 alle 10:30");
  });

  it("accetta anche le date come stringa ISO", () => {
    expect(formatData("2026-09-03")).toBe("03/09/2026");
    expect(formatDataOra("2026-09-03T10:30:00")).toBe("03/09/2026 10:30");
    expect(formatData("2028-02-29")).toBe("29/02/2028");
  });

  it("una data ISO con fuso orario resta valida", () => {
    expect(formatData("2026-09-03T10:30:00Z")).not.toBe("N/D");
    expect(formatData("2026-09-03T10:30:00+02:00")).not.toBe("N/D");
  });

  it("una data mancante diventa N/D", () => {
    expect(VALORE_ASSENTE).toBe("N/D");
    [undefined, null, ""].forEach((assente) => {
      expect(formatData(assente)).toBe("N/D");
      expect(formatDataOra(assente)).toBe("N/D");
      expect(formatDataOraEstesa(assente)).toBe("N/D");
    });
  });

  it("una data non valida diventa N/D, mai Invalid Date", () => {
    expect(formatData("non-una-data")).toBe("N/D");
    expect(formatDataOra("2026-13-45T99:99")).toBe("N/D");
    expect(formatData("2026-02-30")).toBe("N/D");
    expect(formatDataOra("2026-09-03T25:00")).toBe("N/D");
  });

  it("valoreOAssente sostituisce solo i valori mancanti", () => {
    expect(valoreOAssente("Roma")).toBe("Roma");
    expect(valoreOAssente(0)).toBe("0");
    expect(valoreOAssente(null)).toBe("N/D");
    expect(valoreOAssente(undefined)).toBe("N/D");
    expect(valoreOAssente("")).toBe("N/D");
  });
});
