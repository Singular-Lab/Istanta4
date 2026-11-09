import { describe, expect, it } from "vitest";
import type { ImportVendite } from "../../../lib/vendite/tipi";
import {
  ACCEPT_VENDITE,
  conteggio,
  descriviAvanzamento,
  eFileVendite,
  esitoImport,
  formatPeriodo,
  fraseEsito,
  percentualeImport,
} from "./formato";

// Testi e calcoli della pagina Vendite (import delle vendite del cliente, spec vendite-volantino)

const importazione = (parziale: Partial<ImportVendite> = {}): ImportVendite => ({
  id: "imp-1",
  stato: "in_corso",
  nomeFile: "vendite.xlsx",
  righe: 200,
  elaborate: 50,
  scritte: 48,
  scartate: 2,
  errore: null,
  avviatoIl: "2026-11-09T10:00:00",
  terminatoIl: null,
  ...parziale,
});

describe("formato della pagina Vendite", () => {
  it("accetta Excel e CSV, in maiuscolo o minuscolo, e rifiuta il resto", () => {
    for (const nome of ["vendite.xlsx", "VENDITE.XLS", "sellout aprile.csv"]) expect(eFileVendite({ name: nome }), nome).toBe(true);
    for (const nome of ["foto.png", "vendite.xlsx.zip", "vendite", "csv"]) expect(eFileVendite({ name: nome }), nome).toBe(false);
    expect(ACCEPT_VENDITE).toContain(".xlsx");
    expect(ACCEPT_VENDITE).toContain("text/csv");
  });

  it("conta al singolare e al plurale, con il separatore delle migliaia", () => {
    expect(conteggio(1, "riga", "righe")).toBe("1 riga");
    expect(conteggio(0, "riga", "righe")).toBe("0 righe");
    expect(conteggio(12500, "riga", "righe")).toBe("12.500 righe");
  });

  it("scrive il periodo coperto, un giorno solo o N/D senza date", () => {
    expect(formatPeriodo("2026-01-01", "2026-03-31")).toBe("dal 01/01/2026 al 31/03/2026");
    expect(formatPeriodo("2026-04-07", "2026-04-07")).toBe("07/04/2026");
    expect(formatPeriodo(null, null)).toBe("N/D");
    expect(formatPeriodo("2026-01-01", undefined)).toBe("N/D");
  });

  it("calcola la percentuale delle righe lette, anche prima di sapere quante sono", () => {
    expect(percentualeImport({ elaborate: 50, righe: 200 })).toBe(25);
    expect(percentualeImport({ elaborate: 0, righe: 0 })).toBe(0);
    expect(percentualeImport({ elaborate: 210, righe: 200 })).toBe(100);
  });

  it("descrive l'avanzamento con righe lette, scritte e scartate", () => {
    expect(descriviAvanzamento(importazione())).toBe("50 di 200 righe · 48 scritte · 2 scartate");
    expect(descriviAvanzamento(importazione({ elaborate: 1, righe: 1, scritte: 1, scartate: 1 }))).toBe("1 di 1 riga · 1 scritta · 1 scartata");
  });

  it("ha un esito per ogni stato dell'import", () => {
    expect(esitoImport("in_corso")).toMatchObject({ etichetta: "In corso", tono: "info" });
    expect(esitoImport("completato")).toMatchObject({ etichetta: "Completato", tono: "success" });
    expect(esitoImport("annullato")).toMatchObject({ tono: "warning" });
    expect(esitoImport("fallito")).toMatchObject({ etichetta: "Non riuscito", tono: "danger" });
    expect(esitoImport("interrotto")).toMatchObject({ etichetta: "Interrotto", tono: "warning" });
  });

  it("dice com'e' finito l'import e cosa resta delle righe scritte", () => {
    expect(fraseEsito(importazione({ stato: "completato", scritte: 198, scartate: 2 }))).toBe("Import completato: 198 righe scritte, 2 scartate.");
    expect(fraseEsito(importazione({ stato: "annullato", scritte: 48 }))).toContain("Righe scritte prima dell'annullamento: 48");
    expect(fraseEsito(importazione({ stato: "fallito", errore: "Connessione al database persa", scritte: 10 })))
      .toBe("Import non riuscito: Connessione al database persa. Righe scritte prima dell'errore: 10.");
    expect(fraseEsito(importazione({ stato: "interrotto" }))).toContain("il server si è fermato");
  });
});
