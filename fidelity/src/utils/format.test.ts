import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import {
  formatData,
  formatDataOra,
  formatDataOraEstesa,
  formatDataOraSecondi,
  formatNumero,
  formatRelativo,
  valoreOAssente,
  VALORE_ASSENTE,
} from "./format";

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

describe("formatDataOraSecondi", () => {
  it("aggiunge i secondi a data e ora", () => {
    expect(formatDataOraSecondi(new Date(2026, 8, 3, 10, 30, 5))).toBe("03/09/2026 10:30:05");
    expect(formatDataOraSecondi("2026-09-03T08:04:09")).toBe("03/09/2026 08:04:09");
  });

  it("una data mancante o non valida diventa N/D", () => {
    expect(formatDataOraSecondi(null)).toBe("N/D");
    expect(formatDataOraSecondi("2026-02-30T10:00:00")).toBe("N/D");
  });
});

describe("formatRelativo", () => {
  const ADESSO = new Date(2026, 9, 27, 12, 0);

  it("descrive in italiano il tempo passato e quello futuro", () => {
    expect(formatRelativo(new Date(2026, 9, 27, 9, 0), ADESSO)).toBe("3 ore fa");
    expect(formatRelativo(new Date(2026, 9, 27, 11, 55), ADESSO)).toBe("5 minuti fa");
    expect(formatRelativo(new Date(2026, 9, 29, 12, 0), ADESSO)).toBe("tra 2 giorni");
  });

  it("senza riferimento misura la distanza da adesso", () => {
    expect(formatRelativo(dayjs().subtract(2, "day").toDate())).toBe("2 giorni fa");
  });

  it("una data mancante o non valida diventa N/D", () => {
    expect(formatRelativo(null, ADESSO)).toBe("N/D");
    expect(formatRelativo("", ADESSO)).toBe("N/D");
    expect(formatRelativo("non-una-data", ADESSO)).toBe("N/D");
    expect(formatRelativo("2026-13-45", ADESSO)).toBe("N/D");
  });

  it("non cambia la lingua globale di dayjs", () => {
    const lingua = dayjs.locale();
    formatRelativo(new Date(2026, 9, 27, 9, 0), ADESSO);

    expect(dayjs.locale()).toBe(lingua);
    expect(formatDataOraEstesa(DATA)).toBe("03/09/2026 alle 10:30");
  });
});

describe("formatNumero", () => {
  it("separa le migliaia con il punto, anche sotto le diecimila", () => {
    expect(formatNumero(1234)).toBe("1.234");
    expect(formatNumero(1234567)).toBe("1.234.567");
    expect(formatNumero(0)).toBe("0");
    expect(formatNumero("2500")).toBe("2.500");
  });

  it("con i decimali usa la virgola e fissa le cifre", () => {
    expect(formatNumero(1234.5, 2)).toBe("1.234,50");
    expect(formatNumero(3.14159, 1)).toBe("3,1");
    expect(formatNumero(12.6, 0)).toBe("13");
  });

  it("un valore mancante o non numerico diventa N/D", () => {
    [null, undefined, "", "abc", Number.NaN, Number.POSITIVE_INFINITY].forEach((assente) => {
      expect(formatNumero(assente)).toBe("N/D");
    });
  });
});
