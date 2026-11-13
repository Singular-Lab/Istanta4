/**
 * L'unità del prezzo da scrivere dopo l'importo (spec insight-volantino, "Prezzi, sconti, spazio e
 * marche del volantino"): " all'etto" per un prezzo stampato nel riquadro del prezzo all'etto,
 * altrimenti niente, perché il prezzo è a pezzo o a confezione. Così "€ 0,99" non si legge come un
 * prezzo al kg dieci volte più basso.
 */
export const UNITA_ETTO = "all'etto";

export const unitaPrezzo = (allEtto: boolean | null | undefined): string => (allEtto ? ` ${UNITA_ETTO}` : "");
