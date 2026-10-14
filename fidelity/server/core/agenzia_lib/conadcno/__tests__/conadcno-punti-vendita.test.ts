import { describe, expect, it } from "vitest";
import type { IUserService } from "../../../interfaces/IUserService";
import { preparaImportPuntiVendita } from "../../../services/importPuntiVendita";
import { DefaultAgenziaLib } from "../../default/index.js";
import { ConadcnoAgenziaLib } from "../index.js";
import { importPuntiVenditaConadCno } from "../punti-vendita.js";

// Tracciato provvisorio: le intestazioni sono da confermare col file reale di CONAD CNO
const rigaConad = {
  "Cod. ANACAN": " 004512 ",
  "Nome PdV": "Conad City Lucca",
  "Ragione Sociale": "Lucca Market Srl",
  Indirizzo: "Via Fillungo 12",
  CAP: "55100",
  Comune: "Lucca",
  "Prov.": "LU",
  Insegna: "CONAD CITY",
  Zona: "toscana",
};

describe("ConadcnoAgenziaLib", () => {
  it("ha il proprio tracciato dei punti vendita, il default no", () => {
    const userService = {} as IUserService;
    expect(new ConadcnoAgenziaLib(userService).importPuntiVendita).toBe(importPuntiVenditaConadCno);
    expect(new DefaultAgenziaLib(userService).importPuntiVendita).toBeUndefined();
  });
});

describe("importPuntiVenditaConadCno", () => {
  it("riconosce il PV dall'id ANACAN", () => {
    expect(importPuntiVenditaConadCno.chiaveMeta).toBe("id_anacan");
  });

  it("legge le colonne CONAD CNO e mette l'id ANACAN nei meta", () => {
    expect(importPuntiVenditaConadCno.leggiRiga(rigaConad)).toMatchObject({
      nome: "Conad City Lucca",
      ragioneSociale: "Lucca Market Srl",
      indirizzo: "Via Fillungo 12",
      cap: "55100",
      citta: "Lucca",
      provincia: "LU",
      canale: "CONAD CITY",
      area: "toscana",
      meta: { id_anacan: "004512" },
    });
  });

  it("la dicitura CONAD CNO di canale e area si riconduce alla combinazione della GDO", () => {
    const [esito] = preparaImportPuntiVendita([rigaConad], importPuntiVenditaConadCno, {
      canali: [{ id: "c1", codice: "CC", nome: "Conad City" }],
      aree: [{ id: "a1", codice: "TO", nome: "Toscana" }],
      combinazioni: [{ id: "comb1", idCanale: "c1", idArea: "a1", sigla: "CC_TO" }],
      esistenti: [],
    }, "g1");

    expect(esito).toMatchObject({ azione: "crea", dati: { id_combinazione_canale_area: "comb1", meta: { id_anacan: "004512" } } });
  });
});
