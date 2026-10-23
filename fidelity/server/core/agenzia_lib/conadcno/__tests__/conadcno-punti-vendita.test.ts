import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import type { IUserService } from "../../../interfaces/IUserService";
import { type ContestoImportPuntiVendita, preparaImportPuntiVendita, righeDaImportare } from "../../../services/importPuntiVendita";
import { DefaultAgenziaLib } from "../../default/index.js";
import { ConadcnoAgenziaLib } from "../index.js";
import { importPuntiVenditaConadCno } from "../punti-vendita.js";

// Spec import-punti-vendita: tracciato CONAD CNO del file "Elenco Muri" (dati sintetici, non del cliente)

const INTESTAZIONE_ATTIVI = ["Muro", "Nome", "Via", "Nr", "Città", "cap", "Prov", "Regione", "Insegna", "Tel.", "Fax.", "Tipo Pdv"];
const INTESTAZIONE_GOLD = ["ANACAN", "MURO", "DESCRIZIONE", "REGIONE", "INSEGNA"];

const muroAttivo = (campi: Partial<Record<string, string | number>> = {}) => ({
  Muro: 60001,
  Nome: "LUCCA VIA FILLUNGO 12",
  Via: "VIA FILLUNGO",
  Nr: "12",
  "Città": "LUCCA",
  cap: "55100",
  Prov: "Lucca",
  Regione: "Toscana",
  Insegna: "CONAD City",
  "Tel.": "0583 123456",
  "Fax.": "",
  "Tipo Pdv": "L - Conad City",
  ...campi,
});

const leggi = (campi: Partial<Record<string, string | number>> = {}) => {
  const letto = importPuntiVenditaConadCno.leggiRiga(muroAttivo(campi));
  if (typeof letto === "string") throw new Error(letto);
  return letto;
};

function file(attivi: Array<Record<string, unknown>>, gold: unknown[][]): Buffer {
  const cartella = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    cartella,
    XLSX.utils.aoa_to_sheet([INTESTAZIONE_ATTIVI, ...attivi.map(r => INTESTAZIONE_ATTIVI.map(c => r[c] ?? ""))]),
    "01. Muri attivi correnti"
  );
  XLSX.utils.book_append_sheet(cartella, XLSX.utils.aoa_to_sheet([["MURO", "DESCRIZIONE"], [70001, "STORICO"]]), "Muri GOLD ultimi 10 anni");
  XLSX.utils.book_append_sheet(cartella, XLSX.utils.aoa_to_sheet([INTESTAZIONE_GOLD, ...gold]), "Tutti Muri GOLD con ANACAN");
  return XLSX.write(cartella, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const contesto: ContestoImportPuntiVendita = {
  canali: [
    { id: "cy", codice: "CY", nome: "City" },
    { id: "pt", codice: "PT", nome: "PetStore" },
    { id: "td", codice: "tuday", nome: "TuDay" },
  ],
  aree: [
    { id: "to", codice: "TO", nome: "Toscana" },
    { id: "em", codice: "EM", nome: "Emilia" },
  ],
  combinazioni: [
    { id: "cy_to", idCanale: "cy", idArea: "to", sigla: "CY_TO" },
    { id: "pt_em", idCanale: "pt", idArea: "em", sigla: "PT_EM" },
    { id: "td_to", idCanale: "td", idArea: "to", sigla: "TD_TO" },
    { id: "pt_to", idCanale: "pt", idArea: "to", sigla: "PT_TO" },
  ],
  esistenti: [],
};

describe("ConadcnoAgenziaLib", () => {
  it("ha il proprio tracciato dei punti vendita, il default no", () => {
    const userService = {} as IUserService;
    expect(new ConadcnoAgenziaLib(userService).importPuntiVendita).toBe(importPuntiVenditaConadCno);
    expect(new DefaultAgenziaLib(userService).importPuntiVendita).toBeUndefined();
  });
});

describe("importPuntiVenditaConadCno: lettura della riga", () => {
  it("riconosce il PV dall'id ANACAN e, se manca, dal Muro", () => {
    expect(importPuntiVenditaConadCno.chiaveMeta).toBe("id_anacan");
    expect(importPuntiVenditaConadCno.chiaveMetaRiserva).toBe("id_muro");
  });

  it("traduce insegna, regione e provincia nei codici di FP e compone l'indirizzo", () => {
    expect(leggi()).toMatchObject({
      nome: "LUCCA VIA FILLUNGO 12",
      indirizzo: "VIA FILLUNGO 12",
      citta: "LUCCA",
      cap: "55100",
      canale: "cy",
      area: "TO",
      provincia: "LU",
      regione: "Toscana",
      telefono: "0583 123456",
      meta: { id_muro: "60001", insegna: "CONAD City" },
      avvisi: [],
    });
  });

  it.each([
    ["CONAD Ins.", "A - Supermercati", "cn"],
    ["TuDay Conad", "L - Conad City", "tuday"],
    ["CONAD City", "L - Conad City", "cy"],
    ["Margherita", "B - Margherita", "margherita"],
    ["Spazio Conad", "I - Iper", "sc"],
    ["SuperStore", "S - Superstore", "ss"],
    ["Pet Store Conad", "J - Pet Store Conad", "PT"],
  ])("insegna %s → canale %s", (insegna, tipo, canale) => {
    expect(leggi({ Insegna: insegna, "Tipo Pdv": tipo })).toMatchObject({ canale, avvisi: [] });
  });

  it.each(["E_Commerce", "No insegna  - altri", "Bistrot", "Distributore", "Ottica", "Bar"])(
    "l'insegna %s non e un punto vendita da importare",
    insegna => {
      expect(importPuntiVenditaConadCno.leggiRiga(muroAttivo({ Insegna: insegna }))).toBe(`Insegna esclusa dall'import: ${insegna}`);
    }
  );

  it.each(["Parafarmacia", "Ingrosso", "Sapori & Dintorni", "Non definita", "Euronics"])(
    "l'insegna %s si inserisce a mano: canale da scegliere, punteggio a zero",
    insegna => {
      expect(leggi({ Insegna: insegna })).toMatchObject({
        canale: "",
        avvisi: [{ motivo: `Insegna ${insegna}: canale da scegliere a mano`, penalita: 100 }],
      });
    }
  );

  it("scarta i muri di test", () => {
    expect(importPuntiVenditaConadCno.leggiRiga(muroAttivo({ Nome: "Muro Roma Test 12" }))).toMatch(/test/);
  });

  it("le regioni d'Italia vanno nelle aree omonime, comprese quelle scritte con i codici GOLD", () => {
    expect(leggi({ Regione: "Emilia-Romagna" }).area).toBe("EM");
    expect(leggi({ Regione: "Valle d Aosta" }).area).toBe("AO");
    expect(leggi({ Regione: "3 - Sardegna" }).area).toBe("SA");
  });

  it("La Spezia resta in Liguria e Massa Carrara in Toscana", () => {
    expect(leggi({ Prov: "La Spezia", Regione: "Liguria" })).toMatchObject({ area: "LI", provincia: "SP" });
    expect(leggi({ Prov: "Massa Carrara", Regione: "Toscana" })).toMatchObject({ area: "TO", provincia: "MS" });
  });

  it("un punto vendita in Lombardia si inserisce a mano: non c'e un'area per la regione", () => {
    const city = leggi({ Regione: "Lombardia", Prov: "Mantova" });
    expect(city.area).toBe("");
    expect(city.avvisi).toEqual([{ motivo: "Area da decidere: nessuna area per la regione Lombardia", penalita: 100 }]);
  });

  it("civico SNC: l'indirizzo e solo la via", () => {
    expect(leggi({ Nr: "SNC" }).indirizzo).toBe("VIA FILLUNGO");
  });

  it("riconduce le province soppresse e segnala il dubbio", () => {
    expect(leggi({ Prov: "Olbia-Tempio", Regione: "Sardegna" })).toMatchObject({
      provincia: "SS",
      avvisi: [{ motivo: "Provincia Olbia-Tempio ricondotta a SS", penalita: 10 }],
    });
    expect(leggi({ Prov: "Civitavecchia", Regione: "Lazio" }).provincia).toBe("RM");
  });

  it("corregge il CAP con zeri in piu e lo segnala", () => {
    expect(leggi({ cap: "000053" })).toMatchObject({ cap: "00053", avvisi: [{ motivo: "CAP corretto da 000053", penalita: 15 }] });
  });

  it("un telefono non valido si ignora invece di scartare il punto vendita", () => {
    expect(leggi({ "Tel.": "540300" })).toMatchObject({ telefono: undefined, avvisi: [{ penalita: 5 }] });
  });

  it("insegna e tipo punto vendita discordi abbassano l'affidabilita", () => {
    expect(leggi({ "Tipo Pdv": "A - Supermercati" }).avvisi).toEqual([
      { motivo: "Insegna CONAD City ma tipo punto vendita A - Supermercati", penalita: 15 },
    ]);
  });
});

describe("importPuntiVenditaConadCno: file Elenco Muri", () => {
  it("importa il foglio dei muri attivi con l'id ANACAN preso dal foglio GOLD", () => {
    const righe = righeDaImportare(
      file([muroAttivo(), muroAttivo({ Muro: 60002, Nome: "PISA VIA ROMA 1" })], [[5001, 60001, "LUCCA", "1 - Toscana", "0 - CONAD City"]]),
      importPuntiVenditaConadCno
    );
    const esiti = preparaImportPuntiVendita(righe, importPuntiVenditaConadCno, contesto, "g1", 70);

    expect(esiti.map(e => e.riga)).toEqual([2, 3]);
    expect(esiti[0]).toMatchObject({ azione: "crea", punteggio: 100, dati: { id_combinazione_canale_area: "cy_to", meta: { id_anacan: "5001", id_muro: "60001" } } });
    // Senza id ANACAN: riconosciuto dal Muro, con un punteggio piu basso ma ancora sopra soglia
    expect(esiti[1]).toMatchObject({ azione: "crea", punteggio: 80, dati: { meta: { id_muro: "60002" } } });
    expect((esiti[1] as any).dati.meta.id_anacan).toBeUndefined();
  });

  it("un muro con due id ANACAN usa il piu alto e va in revisione", () => {
    const righe = righeDaImportare(
      file([muroAttivo()], [[10609, 60001, "A", "1 - Toscana", "0 - CONAD City"], [10658, 60001, "A", "1 - Toscana", "0 - CONAD City"], [0, 60001, "A", "", ""]]),
      importPuntiVenditaConadCno
    );
    const [esito] = preparaImportPuntiVendita(righe, importPuntiVenditaConadCno, contesto, "g1", 70);

    expect(esito).toMatchObject({
      azione: "revisiona",
      punteggio: 65,
      chiave: "10658",
      dati: { meta: { id_anacan: "10658", id_anacan_alternativi: ["10609"] } },
    });
  });

  it("un supermercato senza area va all'inserimento manuale, con il canale riconosciuto gia proposto", () => {
    const righe = righeDaImportare(file([muroAttivo({ Regione: "Veneto", Prov: "Rovigo", Insegna: "TuDay Conad" })], []), importPuntiVenditaConadCno);
    const [esito] = preparaImportPuntiVendita(righe, importPuntiVenditaConadCno, contesto, "g1", 70);

    expect(esito).toMatchObject({ azione: "revisiona", punteggio: 0, chiave: "60001", idCanale: "td" });
    expect((esito as any).dati.id_combinazione_canale_area).toBeUndefined();
    expect((esito as any).idArea).toBeUndefined();
  });

  it("un Pet Store in Toscana si importa in automatico sulla combinazione del canale PT", () => {
    const righe = righeDaImportare(
      file([muroAttivo({ Insegna: "Pet Store Conad", "Tipo Pdv": "J - Pet Store Conad" })], [[5001, 60001, "LUCCA", "1 - Toscana", "J - Pet Store Conad"]]),
      importPuntiVenditaConadCno
    );
    const [esito] = preparaImportPuntiVendita(righe, importPuntiVenditaConadCno, contesto, "g1", 70);

    expect(esito).toMatchObject({ azione: "crea", punteggio: 100, dati: { id_combinazione_canale_area: "pt_to", meta: { id_anacan: "5001" } } });
  });

  it("un Pet Store in Lombardia va all'inserimento manuale con il canale PT gia proposto", () => {
    const righe = righeDaImportare(
      file([muroAttivo({ Insegna: "Pet Store Conad", "Tipo Pdv": "J - Pet Store Conad", Regione: "Lombardia", Prov: "Mantova" })], []),
      importPuntiVenditaConadCno
    );
    const [esito] = preparaImportPuntiVendita(righe, importPuntiVenditaConadCno, contesto, "g1", 70);

    expect(esito).toMatchObject({ azione: "revisiona", idCanale: "pt" });
    expect((esito as any).idArea).toBeUndefined();
  });

  it("un Pet Store con un tipo punto vendita diverso da J abbassa l'affidabilita", () => {
    expect(leggi({ Insegna: "Pet Store Conad", "Tipo Pdv": "A - Supermercati" }).avvisi).toEqual([
      { motivo: "Insegna Pet Store Conad ma tipo punto vendita A - Supermercati", penalita: 15 },
    ]);
  });

  it("le insegne escluse non arrivano nemmeno all'inserimento manuale", () => {
    const righe = righeDaImportare(file([muroAttivo({ Insegna: "Bistrot" })], []), importPuntiVenditaConadCno);
    const [esito] = preparaImportPuntiVendita(righe, importPuntiVenditaConadCno, contesto, "g1", 70);

    expect(esito).toMatchObject({ azione: "scarta", errore: "Insegna esclusa dall'import: Bistrot" });
  });

  it("canale e area si riconoscono solo dal codice, mai dal nome", () => {
    expect(importPuntiVenditaConadCno.canaleEAreaPerCodice).toBe(true);
    // Un canale il cui nome e il codice di un altro: la riga TuDay deve andare sul canale con codice tuday
    const conNomeAmbiguo: ContestoImportPuntiVendita = {
      ...contesto,
      canali: [{ id: "trappola", codice: "XX", nome: "tuday" }, ...contesto.canali],
      combinazioni: [{ id: "xx_to", idCanale: "trappola", idArea: "to", sigla: "XX_TO" }, ...contesto.combinazioni],
    };
    const righe = righeDaImportare(file([muroAttivo({ Insegna: "TuDay Conad" })], []), importPuntiVenditaConadCno);
    const [esito] = preparaImportPuntiVendita(righe, importPuntiVenditaConadCno, conNomeAmbiguo, "g1", 70);

    expect(esito).toMatchObject({ azione: "crea", dati: { id_combinazione_canale_area: "td_to" } });
  });

  it("un'area scritta per nome nel file non si riconosce", () => {
    const soloNome: ContestoImportPuntiVendita = { ...contesto, aree: [{ id: "to", codice: "T1", nome: "TO" }, contesto.aree[1]] };
    const righe = righeDaImportare(file([muroAttivo()], []), importPuntiVenditaConadCno);
    const [esito] = preparaImportPuntiVendita(righe, importPuntiVenditaConadCno, soloNome, "g1", 70);

    expect(esito).toMatchObject({ azione: "scarta", errore: "Area non riconosciuta: TO" });
  });
});
