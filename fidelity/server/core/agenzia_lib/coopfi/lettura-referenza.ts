import type { LetturaReferenzaAgenzia } from "../lettura-referenza.js";

/*
 * Come Coop Firenze scrive prezzo, barrato e sconto nei box (spec insight-volantino, "Lettura delle
 * referenze stampate dichiarata dalla libreria agenzia"; AgenziaLib/Coopfi.cs). Le etichette arrivano
 * gia' tradotte dalla mappa WebPliant (txt_sconto -> sconto): il barrato e' sempre scritto come
 * testo ("invece di € 19,80"), nel riquadro prezzo_continuo. Non ci sono i nomi di Edro21 (campo_offerta,
 * sconto_fid, ...) ne' il prezzo al kg stampato nel riquadro campo_offerta_kgl.
 */
export const letturaReferenzaCoopFirenze: LetturaReferenzaAgenzia = {
  etichettePrezzo: ["prezzo", "prezzo_promo"],
  etichetteBarrato: [],
  etichetteBarratoTesto: ["prezzo_continuo"],
  etichetteSconto: ["sconto"],
  stileSconto: /^sconto_/i,
  etichettaPrezzoAlKg: null,
};
