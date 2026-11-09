import { describe, expect, it } from "vitest";
import { fogliDelCollage, ordinaPerCollage } from "./collage";
import { meseDiInizio, periodoPromo, tempoDellaPromo, testoVolantini } from "./testi";

const OGGI = new Date("2026-11-09T10:00:00+01:00");

describe("periodoPromo", () => {
  it("scrive il periodo in parole, con il mese una volta sola e senza l'anno in corso", () => {
    expect(periodoPromo("2026-11-05", "2026-11-18", { adesso: OGGI })).toBe("5 – 18 novembre");
    expect(periodoPromo("2026-10-26", "2026-11-12", { adesso: OGGI })).toBe("26 ottobre – 12 novembre");
    expect(periodoPromo("2026-11-05", "2026-11-05", { adesso: OGGI })).toBe("5 novembre");
  });

  it("aggiunge l'anno fuori dall'anno in corso, su richiesta o a cavallo di due anni", () => {
    expect(periodoPromo("2025-10-16", "2025-10-29", { adesso: OGGI })).toBe("16 – 29 ottobre 2025");
    expect(periodoPromo("2026-11-05", "2026-11-18", { adesso: OGGI, conAnno: true })).toBe("5 – 18 novembre 2026");
    expect(periodoPromo("2026-12-18", "2027-01-07", { adesso: OGGI })).toBe("18 dicembre 2026 – 7 gennaio 2027");
  });

  it("con una data sola o nessuna lo dice", () => {
    expect(periodoPromo("2026-11-05", null, { adesso: OGGI })).toBe("dal 5 novembre");
    expect(periodoPromo(null, "2026-11-18", { adesso: OGGI })).toBe("fino al 18 novembre");
    expect(periodoPromo(null, "2026-02-30", { adesso: OGGI })).toBe("Validità non indicata");
  });
});

describe("tempoDellaPromo", () => {
  it("negli Attivi conta i giorni alla scadenza e li evidenzia da tre in giù", () => {
    expect(tempoDellaPromo("attivi", { validitaDal: "2026-11-01", validitaAl: "2026-11-18" }, OGGI)).toMatchObject({
      testo: "Scade tra 9 giorni",
      tono: "neutral",
    });
    expect(tempoDellaPromo("attivi", { validitaDal: "2026-11-01", validitaAl: "2026-11-12" }, OGGI)).toMatchObject({
      testo: "Scade tra 3 giorni",
      tono: "warning",
    });
    expect(tempoDellaPromo("attivi", { validitaDal: null, validitaAl: null }, OGGI)).toBeNull();
  });

  it("nei Prossimi conta i giorni all'inizio, finché non è cominciata", () => {
    expect(tempoDellaPromo("prossimi", { validitaDal: "2026-11-10", validitaAl: "2026-11-23" }, OGGI)).toMatchObject({
      testo: "Inizia domani",
      tono: "info",
    });
    expect(tempoDellaPromo("prossimi", { validitaDal: "2026-11-01", validitaAl: "2026-11-23" }, OGGI)).toBeNull();
  });

  it("nello Storico dice quando è finita", () => {
    expect(tempoDellaPromo("storico", { validitaDal: "2026-10-22", validitaAl: "2026-11-04" }, OGGI)?.testo).toBe(
      "Conclusa il 4 novembre"
    );
    expect(tempoDellaPromo("storico", { validitaDal: "2025-12-18", validitaAl: "2025-12-31" }, OGGI)?.testo).toBe(
      "Conclusa il 31 dicembre 2025"
    );
    expect(tempoDellaPromo("storico", { validitaDal: "2026-10-22", validitaAl: null }, OGGI)).toBeNull();
  });
});

describe("meseDiInizio e testoVolantini", () => {
  it("il mese dello Storico è quello dell'inizio della validità", () => {
    expect(meseDiInizio("2026-10-22")).toEqual({ chiave: "2026-10", etichetta: "ottobre 2026" });
    expect(meseDiInizio(null)).toEqual({ chiave: "senza-data", etichetta: "Senza data di inizio" });
  });

  it("con i filtri dice quanti volantini su quanti", () => {
    expect(testoVolantini(1, 1)).toBe("1 volantino");
    expect(testoVolantini(12, 12)).toBe("12 volantini");
    expect(testoVolantini(2, 5)).toBe("2 di 5 volantini");
  });
});

describe("collage", () => {
  const kit = (id: string, canale: string) => ({ id, canale: { id: canale } });

  it("alterna le insegne nell'ordine in cui compaiono, e dentro un'insegna tiene l'ordine ricevuto", () => {
    const ordinati = ordinaPerCollage([kit("a1", "A"), kit("a2", "A"), kit("a3", "A"), kit("b1", "B"), kit("c1", "C")]);
    expect(ordinati.map((voce) => voce.id)).toEqual(["a1", "b1", "c1", "a2", "a3"]);
  });

  it("disegna al massimo i fogli richiesti, simmetrici intorno al centro, e conta gli altri", () => {
    const tanti = Array.from({ length: 9 }, (_, indice) => kit(`k${indice}`, indice % 2 ? "B" : "A"));

    const scheda = fogliDelCollage(tanti, 5);
    expect(scheda.fogli).toHaveLength(5);
    expect(scheda.altri).toBe(4);
    expect(scheda.fogli.map((foglio) => foglio.x)).toEqual([18, 34, 50, 66, 82]);
    // Il foglio centrale sta sopra e non si sposta quando il ventaglio si apre
    expect(scheda.fogli[2]).toMatchObject({ livello: 10, apertura: 0, rotazione: 0 });
    expect(scheda.fogli[0].livello).toBeLessThan(scheda.fogli[1].livello);

    expect(fogliDelCollage(tanti, 7).fogli).toHaveLength(7);
    expect(fogliDelCollage(tanti.slice(0, 2), 7)).toMatchObject({ altri: 0, fogli: [{ x: 37 }, { x: 63 }] });
    expect(fogliDelCollage([], 5)).toEqual({ fogli: [], altri: 0 });
  });
});
