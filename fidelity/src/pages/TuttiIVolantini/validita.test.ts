import { describe, expect, it } from "vitest";
import { statoValidita } from "./validita";

// Le 10 del 10 novembre 2026, in Italia
const OGGI = new Date("2026-11-10T09:00:00Z");

describe("statoValidita", () => {
  it("un volantino in corso è attivo e dice fra quanto scade, in evidenza negli ultimi giorni", () => {
    expect(statoValidita("2026-11-01", "2026-11-20", OGGI)).toEqual({ testo: "Attivo · scade tra 10 giorni", tono: "success", icona: "CalendarCheck" });
    expect(statoValidita("2026-11-01", "2026-11-12", OGGI)).toEqual({ testo: "Attivo · scade tra 2 giorni", tono: "warning", icona: "CalendarCheck" });
    expect(statoValidita("2026-11-01", "2026-11-10", OGGI)?.testo).toBe("Attivo · scade oggi");
  });

  it("un volantino che deve ancora iniziare lo dice; uno finito è concluso", () => {
    expect(statoValidita("2026-11-15", "2026-11-28", OGGI)).toEqual({ testo: "Inizia tra 5 giorni", tono: "info", icona: "CalendarClock" });
    expect(statoValidita("2026-10-01", "2026-10-14", OGGI)).toEqual({ testo: "Concluso", tono: "neutral", icona: "CalendarX" });
  });

  it("senza date valide non c'è stato; con il solo inizio passato è attivo", () => {
    expect(statoValidita(null, null, OGGI)).toBeNull();
    expect(statoValidita("2026-02-30", undefined, OGGI)).toBeNull();
    expect(statoValidita("2026-11-01", null, OGGI)).toEqual({ testo: "Attivo", tono: "success", icona: "CalendarCheck" });
  });
});
