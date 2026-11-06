import { describe, expect, it } from "vitest";
import { giorniAllaScadenza, giorniAllInizio, testoInizio, testoScadenza } from "./scadenza";

// La scadenza dei volantini attivi si conta in giorni del calendario italiano, qualunque sia il
// fuso del browser: a mezzanotte di Roma il giorno cambia anche se in UTC è ancora ieri.
describe("giorni alla scadenza di una promo", () => {
  it("conta i giorni del calendario fino all'ultimo giorno di validità", () => {
    const adesso = new Date("2026-10-27T10:00:00+01:00");

    expect(giorniAllaScadenza("2026-10-27", adesso)).toBe(0);
    expect(giorniAllaScadenza("2026-10-28", adesso)).toBe(1);
    expect(giorniAllaScadenza("2026-11-05", adesso)).toBe(9);
    expect(giorniAllaScadenza("2026-10-26", adesso)).toBe(-1);
  });

  it("usa il giorno di Roma: alle 23:30 UTC del 29 in Italia è già il 30", () => {
    expect(giorniAllaScadenza("2026-10-29", new Date("2026-10-29T22:30:00Z"))).toBe(0);
    expect(giorniAllaScadenza("2026-10-29", new Date("2026-10-29T23:30:00Z"))).toBe(-1);
  });

  it("il cambio dell'ora legale non toglie né aggiunge giorni", () => {
    // Il 25 ottobre 2026 l'Italia torna all'ora solare: quel giorno dura 25 ore
    expect(giorniAllaScadenza("2026-10-26", new Date("2026-10-24T23:30:00Z"))).toBe(1);
    expect(giorniAllaScadenza("2026-03-30", new Date("2026-03-28T23:30:00Z"))).toBe(1);
  });

  it("senza una data valida non c'è scadenza", () => {
    expect(giorniAllaScadenza(null)).toBeNull();
    expect(giorniAllaScadenza("")).toBeNull();
    expect(giorniAllaScadenza("29/10/2026")).toBeNull();
    expect(giorniAllaScadenza("2026-02-30")).toBeNull();
  });

  it("descrive la scadenza in italiano", () => {
    expect(testoScadenza(0)).toBe("Scade oggi");
    expect(testoScadenza(1)).toBe("Scade domani");
    expect(testoScadenza(12)).toBe("Scade tra 12 giorni");
    expect(testoScadenza(-2)).toBe("Scaduta");
  });
});

// I volantini Prossimi dicono quanto manca all'inizio della validità, con lo stesso calendario.
describe("giorni all'inizio di una promo", () => {
  it("conta i giorni del calendario di Roma fino al primo giorno di validità", () => {
    const adesso = new Date("2026-11-06T10:00:00+01:00");

    expect(giorniAllInizio("2026-11-06", adesso)).toBe(0);
    expect(giorniAllInizio("2026-11-07", adesso)).toBe(1);
    expect(giorniAllInizio("2026-11-20", adesso)).toBe(14);
    expect(giorniAllInizio("2026-11-05", adesso)).toBe(-1);
    // Alle 23:30 UTC del 6 in Italia è già il 7
    expect(giorniAllInizio("2026-11-07", new Date("2026-11-06T23:30:00Z"))).toBe(0);
  });

  it("senza una data valida non c'è inizio", () => {
    expect(giorniAllInizio(undefined)).toBeNull();
    expect(giorniAllInizio("2026-13-01")).toBeNull();
  });

  it("descrive l'inizio in italiano", () => {
    expect(testoInizio(0)).toBe("Inizia oggi");
    expect(testoInizio(1)).toBe("Inizia domani");
    expect(testoInizio(14)).toBe("Inizia tra 14 giorni");
    expect(testoInizio(-3)).toBe("Già iniziata");
  });
});
