/*
 * Gli identificativi che il client manda con ogni richiesta di scrittura:
 * - `Idempotency-Key`, nuova per ogni richiesta: il server esegue una sola volta le copie con la stessa
 *   chiave (doppio click, nuovo tentativo dopo un errore di rete) e risponde a tutte come alla prima;
 * - `X-Client-Id`, uno per scheda del browser: il server lo ripete nell'avviso di cambio dati, cosi' la
 *   scheda che ha agito riconosce il proprio avviso e non rilegge due volte.
 */

const nuovoCodice = (): string => {
  const cripto = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (cripto?.randomUUID) return cripto.randomUUID();
  const casuale = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${casuale()}-${casuale()}`;
};

/** Una scheda del browser, finche' resta aperta. */
export const ID_CLIENT: string = nuovoCodice();

/** Le intestazioni di una richiesta di scrittura, con una chiave nuova. */
export const intestazioniDiScrittura = (): Record<string, string> => ({
  'Idempotency-Key': nuovoCodice(),
  'X-Client-Id': ID_CLIENT,
});
