import { describe, expect, it } from "vitest";
import type { IUserService } from "../../interfaces/IUserService";
import { ConadcnoAgenziaLib } from "../conadcno/index.js";
import { CoopfiAgenziaLib } from "../coopfi/index.js";
import { DefaultAgenziaLib } from "../default/index.js";
import type { IAgenziaLib } from "../types.js";
import { LETTURA_REFERENZA_STANDARD, letturaReferenza } from "../lettura-referenza.js";

// Spec insight-volantino: lettura delle referenze stampate dichiarata dalla libreria agenzia.
// Spec import-storico-volantino: insegne nella lista dei punti vendita dichiarate dalla libreria.

const userService = {} as IUserService;

describe("letturaReferenza: dichiarazione sopra lo standard", () => {
  it("senza dichiarazione vale lo standard, che comprende i nomi di ogni agenzia", () => {
    expect(letturaReferenza()).toBe(LETTURA_REFERENZA_STANDARD);
    expect(LETTURA_REFERENZA_STANDARD.etichetteBarratoTesto).toContain("prezzo_continuo");
    expect(LETTURA_REFERENZA_STANDARD.etichetteBarrato).toContain("campo_offerta");
    expect(LETTURA_REFERENZA_STANDARD.etichetteSconto).toEqual(expect.arrayContaining(["sconto", "sconto_fid"]));
  });

  it("un campo dichiarato sostituisce quello standard, quelli che mancano restano standard", () => {
    const lettura = letturaReferenza({ etichetteSconto: ["sconto_x"] });

    expect(lettura.etichetteSconto).toEqual(["sconto_x"]);
    expect(lettura.etichettePrezzo).toBe(LETTURA_REFERENZA_STANDARD.etichettePrezzo);
    expect(lettura.stileSconto).toBe(LETTURA_REFERENZA_STANDARD.stileSconto);
  });

  it("un elenco vuoto dichiarato vuol dire che l'agenzia non usa quel riquadro, e null il prezzo al kg", () => {
    const lettura = letturaReferenza({ etichetteBarratoTesto: [], etichettaPrezzoAlKg: null });

    expect(lettura.etichetteBarratoTesto).toEqual([]);
    expect(lettura.etichettaPrezzoAlKg).toBeNull();
  });
});

describe("le librerie dichiarano i nomi del loro cliente", () => {
  it("CONAD CNO ha i nomi di Edro21 e non quelli di Coop", () => {
    const { letturaReferenza: dichiarata } = new ConadcnoAgenziaLib(userService);

    expect(dichiarata?.etichetteBarrato).toEqual(["campo_offerta", "campo_offerta_etto"]);
    expect(dichiarata?.etichetteSconto).toEqual(expect.arrayContaining(["sconto_fid", "sconto_norm", "sconto_effettivo_grande"]));
    expect(dichiarata?.etichetteBarratoTesto).toEqual([]);
    expect(dichiarata?.etichettePrezzo).not.toContain("prezzo_promo");
  });

  it("Coop Firenze ha prezzo_continuo come barrato scritto e nessun nome di Edro21", () => {
    const { letturaReferenza: dichiarata } = new CoopfiAgenziaLib(userService);

    expect(dichiarata?.etichetteBarratoTesto).toEqual(["prezzo_continuo"]);
    expect(dichiarata?.etichetteBarrato).toEqual([]);
    expect(dichiarata?.etichetteSconto).toEqual(["sconto"]);
    expect(dichiarata?.etichettaPrezzoAlKg).toBeNull();
  });

  it("il default non dichiara nulla: vale lo standard", () => {
    const agenzia = new DefaultAgenziaLib(userService) as IAgenziaLib;

    expect(agenzia.letturaReferenza).toBeUndefined();
    expect(agenzia.insegneListaPuntiVendita).toBeUndefined();
  });

  it("solo CONAD CNO dichiara le insegne della lista dei punti vendita", () => {
    expect(new ConadcnoAgenziaLib(userService).insegneListaPuntiVendita?.test("CONAD CITY")).toBe(true);
    expect((new CoopfiAgenziaLib(userService) as IAgenziaLib).insegneListaPuntiVendita).toBeUndefined();
  });
});
