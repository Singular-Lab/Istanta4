import { TRACCIATO_VENDITE_GENERICO } from "../../vendite/tracciatoGenerico.js";
import type { ImportVenditeAgenzia } from "../types.js";
import { importPuntiVenditaConadCno } from "./punti-vendita.js";

/*
 * Tracciato del file delle vendite di CONAD CNO (spec vendite-volantino). Per ora e' il tracciato
 * generico (colonne codice, punto_vendita, dal, al, pezzi, valore) con il nome del cliente: quello
 * vero si completera' quando il cliente mandera' un file d'esempio del suo sell-out.
 * Il punto vendita del file si riconosce dall'id ANACAN, la stessa chiave dell'import dei punti
 * vendita (importPuntiVenditaConadCno.chiaveMeta).
 */
export const importVenditeConadCno: ImportVenditeAgenzia = {
  ...TRACCIATO_VENDITE_GENERICO,
  nome: "CONAD CNO - tracciato generico",
  chiaveMetaPuntoVendita: importPuntiVenditaConadCno.chiaveMeta,
};
