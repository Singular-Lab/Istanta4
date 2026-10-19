import { describe, expect, it } from "vitest";
import { STATO_UTENTI } from "../../../lib/enums";
import { statoUtente } from "./statoUtente";

describe("statoUtente", () => {
  it("ogni stato previsto ha un'etichetta italiana", () => {
    for (const stato of Object.values(STATO_UTENTI)) {
      expect(statoUtente(stato).etichetta).not.toMatch(/Unknown|Non definito/);
    }
  });

  it("BLOCCATO si legge Bloccato, in rosso", () => {
    expect(statoUtente(STATO_UTENTI.BLOCCATO)).toMatchObject({ etichetta: "Bloccato", colore: "text-danger" });
  });

  it("uno stato sconosciuto non diventa Unknown", () => {
    expect(statoUtente("NUOVO").etichetta).toBe("NUOVO");
    expect(statoUtente(undefined).etichetta).toBe("Non definito");
  });
});
