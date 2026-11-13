/**
 * Il ruolo di una referenza nel volantino (campo ruolo dei dati: "base", "STAR", "richiamo b&f"...),
 * leggibile e uguale comunque sia scritto (spec insight-volantino, "Ruolo della referenza leggibile").
 * Le etichette le dichiara la libreria agenzia del cliente; senza, iniziale maiuscola e resto minuscolo.
 */

/** La chiave di un ruolo: minuscole e spazi singoli, per riconoscerlo comunque sia scritto. */
export const chiaveRuolo = (valore: string): string => valore.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it-IT');

/** Il ruolo con l'iniziale maiuscola e il resto minuscolo ("RICHIAMO B&F" diventa "Richiamo b&f"). */
export const etichettaRuoloStandard = (valore: string): string => {
  const chiave = chiaveRuolo(valore);
  return chiave.charAt(0).toLocaleUpperCase('it-IT') + chiave.slice(1);
};

/**
 * L'etichetta di un ruolo: quella dichiarata per la sua chiave, altrimenti quella standard; null per
 * un ruolo vuoto, che non si mostra.
 */
export const etichettaRuolo = (valore: string | null | undefined, dichiarate?: Readonly<Record<string, string>>): string | null => {
  if (!valore || valore.trim() === '') return null;
  return dichiarate?.[chiaveRuolo(valore)] ?? etichettaRuoloStandard(valore);
};
