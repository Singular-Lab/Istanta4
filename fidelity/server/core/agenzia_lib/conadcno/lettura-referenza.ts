import type { LetturaReferenzaAgenzia } from "../lettura-referenza.js";

/*
 * Come CONAD CNO scrive prezzo, barrato e sconto nei box (spec insight-volantino, "Lettura delle
 * referenze stampate dichiarata dalla libreria agenzia"): i nomi dei riquadri di Edro21 (AgenziaLib/Edro21.cs,
 * plugin/stili/mappaStili.json), quelli che arrivano nei suoi volantini di Istanta e dello storico.
 * Non ci sono i nomi di Coop (prezzo_continuo, prezzo_promo, sconto): non arrivano nei suoi dati.
 */
export const letturaReferenzaConadCno: LetturaReferenzaAgenzia = {
  etichettePrezzo: ["prezzo_offerta", "prezzo", "prezzo_offerta_EURprima", "prezzo_offerta_etto", "prezzo_offerta_etto_EURprima"],
  etichetteBarrato: ["campo_offerta", "campo_offerta_etto"],
  etichetteBarratoTesto: [],
  etichetteSconto: ["sconto_effettivo_grande", "sconto_norm", "sconto_fid", "sconto_effettivo", "val_sconto_grande", "val_sconto"],
  stileSconto: /^sconto_/i,
  etichettaPrezzoAlKg: /campo_offerta_kgl|^x_campo_offerta$/i,
};
