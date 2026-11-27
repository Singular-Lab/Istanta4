/*
 * Come si leggono prezzo, prezzo barrato e sconto di una referenza stampata (spec insight-volantino,
 * "Lettura delle referenze stampate dichiarata dalla libreria agenzia").
 *
 * Lo stesso dato ha nomi diversi secondo l'agenzia: la libreria agenzia del cliente dichiara i suoi.
 * Un campo che la libreria non dichiara vale come lo standard, che comprende tutti i nomi in uso:
 * cosi' un cliente senza dichiarazione (libreria di default) legge come ha sempre letto.
 */

/** I nomi con cui un'agenzia scrive prezzo, barrato e sconto; un campo assente vale lo standard. */
export interface LetturaReferenzaAgenzia {
  /** Le etichette dei riquadri del prezzo in offerta, nell'ordine in cui si cercano. */
  etichettePrezzo?: readonly string[];
  /** I riquadri del barrato: un numero, o un riquadro con lo stile del barrato. */
  etichetteBarrato?: readonly string[];
  /** I riquadri del barrato scritto come testo ("invece di € 19,80"). */
  etichetteBarratoTesto?: readonly string[];
  /** Le etichette dei riquadri dello sconto, nell'ordine in cui si cercano. */
  etichetteSconto?: readonly string[];
  /** Lo stile di paragrafo di uno sconto: vale come sconto anche nel riquadro di un prezzo. */
  stileSconto?: RegExp;
  /** L'etichetta del riquadro con il prezzo al kg o al litro stampato; null: l'agenzia non lo usa. */
  etichettaPrezzoAlKg?: RegExp | null;
}

/** La lettura completa, con tutti i campi: quello che il codice comune usa. */
export type LetturaReferenza = Required<LetturaReferenzaAgenzia>;

/** L'elenco standard: tutti i nomi oggi riconosciuti, di ogni agenzia. */
export const LETTURA_REFERENZA_STANDARD: LetturaReferenza = {
  etichettePrezzo: ['prezzo_offerta', 'prezzo', 'prezzo_offerta_EURprima', 'prezzo_offerta_etto', 'prezzo_offerta_etto_EURprima', 'prezzo_promo'],
  etichetteBarrato: ['campo_offerta', 'campo_offerta_etto'],
  etichetteBarratoTesto: ['prezzo_continuo'],
  etichetteSconto: ['sconto_effettivo_grande', 'sconto_norm', 'sconto_fid', 'sconto_effettivo', 'val_sconto_grande', 'val_sconto', 'sconto'],
  stileSconto: /^sconto_/i,
  etichettaPrezzoAlKg: /campo_offerta_kgl|^x_campo_offerta$/i,
};

/** La dichiarazione della libreria sopra lo standard: ogni campo dichiarato sostituisce quello standard. */
export function letturaReferenza(dichiarata?: LetturaReferenzaAgenzia): LetturaReferenza {
  if (!dichiarata) return LETTURA_REFERENZA_STANDARD;
  return {
    etichettePrezzo: dichiarata.etichettePrezzo ?? LETTURA_REFERENZA_STANDARD.etichettePrezzo,
    etichetteBarrato: dichiarata.etichetteBarrato ?? LETTURA_REFERENZA_STANDARD.etichetteBarrato,
    etichetteBarratoTesto: dichiarata.etichetteBarratoTesto ?? LETTURA_REFERENZA_STANDARD.etichetteBarratoTesto,
    etichetteSconto: dichiarata.etichetteSconto ?? LETTURA_REFERENZA_STANDARD.etichetteSconto,
    stileSconto: dichiarata.stileSconto ?? LETTURA_REFERENZA_STANDARD.stileSconto,
    etichettaPrezzoAlKg: dichiarata.etichettaPrezzoAlKg === undefined
      ? LETTURA_REFERENZA_STANDARD.etichettaPrezzoAlKg
      : dichiarata.etichettaPrezzoAlKg,
  };
}
