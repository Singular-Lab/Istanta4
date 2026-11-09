import { TRACCIATO_VENDITE_GENERICO } from "../../vendite/tracciatoGenerico.js";
import type { ImportVenditeAgenzia } from "../types.js";

/*
 * Tracciato del file delle vendite di Coop Firenze (spec vendite-volantino). Per ora e' il
 * tracciato generico (colonne codice, punto_vendita, dal, al, pezzi, valore) con il nome del
 * cliente: quello vero si completera' quando il cliente mandera' un file d'esempio.
 * Coop Firenze non ha un proprio import dei punti vendita (importPuntiVendita), quindi nessuna
 * chiave nei meta: il punto vendita del file si riconosce dal nome, come per il tracciato generico.
 */
export const importVenditeCoopFirenze: ImportVenditeAgenzia = {
  ...TRACCIATO_VENDITE_GENERICO,
  nome: "Coop Firenze - tracciato generico",
};
