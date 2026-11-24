/**
 * Codice dell'iniziativa di una promo di CONAD CNO: il valore del nome prima del primo «_»
 * (P2620_KIT_TOSCANA, codice P2620). Senza «_», o con il «_» all'inizio, la promo non ha un codice.
 */
export function codiceIniziativaConadCno(nomePromo: string): string | null {
  const nome = typeof nomePromo === 'string' ? nomePromo.trim() : '';
  const posizione = nome.indexOf('_');
  if (posizione <= 0) return null;
  const codice = nome.slice(0, posizione).trim();
  return codice === '' ? null : codice;
}
