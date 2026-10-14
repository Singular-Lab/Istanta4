import { cella, numero } from "../../services/importPuntiVendita.js";
import { normalizePuntoVenditaText } from "../../utils/puntoVenditaNormalization.js";
import type { ImportPuntiVenditaAgenzia } from "../types.js";

/*
 * Tracciato PROVVISORIO del file punti vendita di CONAD CNO: il file reale non c'e ancora.
 * Quando arriva si correggono solo queste tabelle. Le intestazioni si confrontano senza
 * maiuscole, accenti, punteggiatura e spazi ("Cod. ANACAN" = "cod anacan").
 */
const COLONNE = {
  idAnacan: ["id anacan", "anacan", "cod anacan", "codice anacan"],
  nome: ["nome pdv", "denominazione", "nome"],
  ragioneSociale: ["ragione sociale"],
  indirizzo: ["indirizzo"],
  cap: ["cap"],
  citta: ["comune", "localita", "citta"],
  provincia: ["provincia", "prov"],
  regione: ["regione"],
  telefono: ["telefono", "tel"],
  canale: ["insegna", "canale"],
  area: ["area", "zona"],
  lat: ["latitudine", "lat"],
  lon: ["longitudine", "lon"],
};

/*
 * Dicitura CONAD CNO → codice o nome del canale/area in FP, solo dove non coincidono gia
 * (FP riconosce da solo "CONAD CITY" se il canale si chiama "Conad City").
 * Es. { "C. CITY": "Conad City" }. Da compilare col file reale.
 */
const CANALI: Record<string, string> = {};
const AREE: Record<string, string> = {};

function traduci(tabella: Record<string, string>, valore: string): string {
  return Object.entries(tabella).find(([dicitura]) => normalizePuntoVenditaText(dicitura) === normalizePuntoVenditaText(valore))?.[1] ?? valore;
}

/** Il PV CONAD CNO si riconosce dall'id ANACAN, che resta nei meta del PV. */
export const importPuntiVenditaConadCno: ImportPuntiVenditaAgenzia = {
  chiaveMeta: "id_anacan",
  leggiRiga: riga => {
    const valore = (campo: keyof typeof COLONNE) => cella(riga, ...COLONNE[campo]);
    return {
      nome: valore("nome"),
      indirizzo: valore("indirizzo"),
      citta: valore("citta"),
      cap: valore("cap"),
      canale: traduci(CANALI, valore("canale")),
      area: traduci(AREE, valore("area")),
      ragioneSociale: valore("ragioneSociale") || undefined,
      provincia: valore("provincia") || undefined,
      regione: valore("regione") || undefined,
      telefono: valore("telefono") || undefined,
      lat: numero(valore("lat")),
      lon: numero(valore("lon")),
      meta: { id_anacan: valore("idAnacan") },
    };
  },
};
