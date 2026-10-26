import { describe, expect, it } from "vitest";
import type { StatoImportPuntiVenditaDTO } from "../../server/core/dto";
import {
  applicaIndirizzo,
  BADGE_PUNTEGGIO,
  canaliEAree,
  chiaveIndirizzo,
  classePunteggio,
  combinazioneDi,
  decodificaPayloadSocket,
  importAttivo,
  inserimentoCompleto,
  percentualeImport,
  riepilogoAnteprima,
  testoRiepilogoImport,
  type DatiInserimentoManuale,
} from "./importPuntiVendita";

// Spec import-punti-vendita: punteggio, inserimento manuale e avanzamento (proposte SGP-5B7E4A32F34A, SGP-28CFF8CE0AB3)

const stato = (campi: Partial<StatoImportPuntiVenditaDTO> = {}): StatoImportPuntiVenditaDTO => ({
  jobId: "j1",
  stato: "completato",
  totale: 10,
  elaborate: 10,
  creati: 5,
  aggiornati: 2,
  scartati: 1,
  inseritiAMano: 0,
  soloFp: 0,
  geolocalizzati: 0,
  senzaCoordinate: 0,
  erroriNominatim: 0,
  nonElaborate: 0,
  errori: [],
  avviatoIl: "2026-10-23T10:00:00.000Z",
  ...campi,
});

describe("classePunteggio", () => {
  it("sotto soglia rosso, fino a 90 giallo, sopra verde", () => {
    expect(classePunteggio(69)).toBe("danger");
    expect(classePunteggio(70)).toBe("warning");
    expect(classePunteggio(89)).toBe("warning");
    expect(classePunteggio(90)).toBe("success");
  });

  it("rispetta una soglia diversa", () => {
    expect(classePunteggio(75, 80)).toBe("danger");
  });

  it("ogni colore ha classi scritte per intero", () => {
    expect(BADGE_PUNTEGGIO.danger).toContain("text-danger");
    expect(Object.values(BADGE_PUNTEGGIO).every(c => !c.includes("${"))).toBe(true);
  });
});

describe("decodificaPayloadSocket", () => {
  it("decodifica JSON da ArrayBuffer, vista e stringa", () => {
    const testo = JSON.stringify({ jobId: "j1" });
    const byte = new TextEncoder().encode(testo);
    expect(decodificaPayloadSocket(byte.buffer)).toEqual({ jobId: "j1" });
    expect(decodificaPayloadSocket(byte)).toEqual({ jobId: "j1" });
    expect(decodificaPayloadSocket(testo)).toEqual({ jobId: "j1" });
  });

  it("lascia com'e un valore che non e JSON", () => {
    expect(decodificaPayloadSocket("ciao")).toBe("ciao");
    expect(decodificaPayloadSocket({ a: 1 })).toEqual({ a: 1 });
  });
});

describe("riepilogo dell'import", () => {
  it("conta importabili, da revisionare e scartate dell'anteprima", () => {
    expect(
      riepilogoAnteprima([
        { riga: 2, azione: "crea" } as any,
        { riga: 3, azione: "aggiorna" } as any,
        { riga: 4, azione: "revisiona" } as any,
        { riga: 5, azione: "scarta", errore: "x" },
      ])
    ).toEqual({ importabili: 2, daInserireAMano: 1, scartate: 1 });
  });

  it("percentuale delle righe elaborate, 100 per un file vuoto", () => {
    expect(percentualeImport({ elaborate: 1, totale: 3 })).toBe(33);
    expect(percentualeImport({ elaborate: 0, totale: 0 })).toBe(100);
  });

  it("un import annullato riporta anche le righe non elaborate", () => {
    expect(testoRiepilogoImport(stato())).toBe("5 creati, 2 aggiornati, 1 scartati");
    expect(testoRiepilogoImport(stato({ stato: "annullato", nonElaborate: 4 }))).toContain("4 non elaborati");
  });

  it("riporta i PV rimasti senza coordinate e gli errori di Nominatim", () => {
    expect(testoRiepilogoImport(stato({ senzaCoordinate: 4, erroriNominatim: 3 }))).toBe(
      "5 creati, 2 aggiornati, 1 scartati, 4 senza coordinate, 3 errori di Nominatim"
    );
  });

  it("un import fermato per errore riporta le righe non elaborate", () => {
    expect(testoRiepilogoImport(stato({ stato: "errore", nonElaborate: 590 }))).toContain("590 non elaborati");
  });

  it("riporta gli inserimenti a mano e i PV rimasti solo in FP", () => {
    expect(testoRiepilogoImport(stato({ inseritiAMano: 3, soloFp: 2 }))).toBe(
      "5 creati, 2 aggiornati, 1 scartati, 3 inseriti a mano, 2 salvati solo in FP (Istanta non raggiungibile)"
    );
  });

  it("un import in pausa e ancora attivo", () => {
    expect(importAttivo(stato({ stato: "in_attesa" }))).toBe(true);
    expect(importAttivo(stato({ stato: "in_corso" }))).toBe(true);
    expect(importAttivo(stato())).toBe(false);
    expect(importAttivo(null)).toBe(false);
  });
});

const combinazioni = [
  { id: "k1", sigla_combinazione: "cy_TO", id_canale: "cy", id_area: "to", nome_canale: "City", nome_area: "Toscana", codice_canale: "cy", codice_area: "TO" },
  { id: "k2", sigla_combinazione: "tuday_LI", id_canale: "td", id_area: "li", nome_canale: "TuDay", nome_area: "Liguria", codice_canale: "tuday", codice_area: "LI" },
  { id: "k3", sigla_combinazione: "cy_LI", id_canale: "cy", id_area: "li", nome_canale: "City", nome_area: "Liguria", codice_canale: "cy", codice_area: "LI" },
];

const modulo = (campi: Partial<DatiInserimentoManuale> = {}): DatiInserimentoManuale => ({
  nome: "Conad Mantova",
  indirizzo: "Via Grayson 20",
  citta: "Mantova",
  cap: "46100",
  provincia: "MN",
  regione: "Lombardia",
  telefono: "",
  ragioneSociale: "",
  guidIDCombinazione: "k1",
  ...campi,
});

describe("inserimento manuale", () => {
  it("canali e aree si ricavano dalle combinazioni per codice, non per nome, senza doppioni e ordinati", () => {
    expect(canaliEAree(combinazioni)).toEqual({
      canali: [{ id: "cy", codice: "cy" }, { id: "td", codice: "tuday" }],
      aree: [{ id: "li", codice: "LI" }, { id: "to", codice: "TO" }],
    });
  });

  it("canale e area scelti danno la loro combinazione, se esiste", () => {
    expect(combinazioneDi(combinazioni, "td", "li")?.id).toBe("k2");
    expect(combinazioneDi(combinazioni, "td", "to")).toBeUndefined();
    expect(combinazioneDi(combinazioni, "", "to")).toBeUndefined();
  });

  it("il risultato di Nominatim scelto riempie indirizzo e coordinate, senza svuotare cio che non conosce", () => {
    const dati = applicaIndirizzo(modulo({ cap: "46100" }), {
      etichetta: "Via Grayson 20, Mantova", lat: 45.15, lon: 10.79, indirizzo: "Via Grayson 20", citta: "Mantova", regione: "Lombardia",
    });

    expect(dati).toMatchObject({ indirizzo: "Via Grayson 20", cap: "46100", provincia: "MN", lat: 45.15, lon: 10.79 });
  });

  it("si salva solo con indirizzo confermato, campi completi e combinazione", () => {
    const dati = modulo();
    const confermato = chiaveIndirizzo(dati);

    expect(inserimentoCompleto(dati, confermato)).toBe(true);
    expect(inserimentoCompleto(dati, null)).toBe(false);
    expect(inserimentoCompleto({ ...dati, guidIDCombinazione: "" }, confermato)).toBe(false);
    expect(inserimentoCompleto({ ...dati, cap: "4610" }, confermato)).toBe(false);
  });

  it("cambiare l'indirizzo dopo la conferma la annulla, cambiare il telefono no", () => {
    const dati = modulo();
    const confermato = chiaveIndirizzo(dati);

    expect(inserimentoCompleto({ ...dati, indirizzo: "Via Grayson 22" }, confermato)).toBe(false);
    expect(inserimentoCompleto({ ...dati, citta: "Curtatone" }, confermato)).toBe(false);
    expect(inserimentoCompleto({ ...dati, telefono: "0376 123456" }, confermato)).toBe(true);
  });
});
