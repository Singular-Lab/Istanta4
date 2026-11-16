import { describe, expect, it } from "vitest";
import { aggiornatoDopoIlCaricamento, descriviAutore } from "./autoreTracciato";

// Spec ciclo-promozione-importazione, "Autore e date del tracciato" (TASK-f4e1fc7c)
describe("descriviAutore", () => {
  it("chi l'ha caricato, oppure che non e' registrato", () => {
    expect(descriviAutore({ id: "u1", nome: "Mario Rossi" })).toBe("Caricato da Mario Rossi");
    expect(descriviAutore({ id: "u1", nome: null })).toBe("Caricato da un utente non più presente");
    expect(descriviAutore(null)).toBe("Autore non registrato");
    expect(descriviAutore(undefined)).toBe("Autore non registrato");
  });
});

describe("aggiornatoDopoIlCaricamento", () => {
  it("solo se l'aggiornamento e' di un altro minuto", () => {
    expect(aggiornatoDopoIlCaricamento("2026-11-16T13:03:10Z", "2026-11-16T14:10:00Z")).toBe(true);
    expect(aggiornatoDopoIlCaricamento("2026-11-16T13:03:10Z", "2026-11-16T13:04:00Z")).toBe(true);
    // Stesso minuto: la scheda mostrerebbe due volte la stessa ora
    expect(aggiornatoDopoIlCaricamento("2026-11-16T13:03:10Z", "2026-11-16T13:03:50Z")).toBe(false);
    expect(aggiornatoDopoIlCaricamento("2026-11-16T13:03:10Z", "2026-11-16T13:03:10Z")).toBe(false);
  });

  it("senza date o con date non valide non mostra l'aggiornamento", () => {
    expect(aggiornatoDopoIlCaricamento(undefined, "2026-11-16T14:10:00Z")).toBe(false);
    expect(aggiornatoDopoIlCaricamento("2026-11-16T13:03:10Z", null)).toBe(false);
    expect(aggiornatoDopoIlCaricamento("non una data", "2026-11-16T14:10:00Z")).toBe(false);
  });
});
