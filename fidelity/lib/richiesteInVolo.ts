const inVolo = new Map<string, Promise<unknown>>();

/**
 * Se una richiesta con la stessa chiave e ancora in corso, restituisce la sua
 * promessa invece di eseguirne un'altra: un doppio click produce una sola chiamata.
 * Finita (anche con errore), la chiave si libera e la richiesta successiva riparte.
 */
export function condividiInVolo<T>(chiave: string, esegui: () => Promise<T>): Promise<T> {
  const inCorso = inVolo.get(chiave);
  if (inCorso) return inCorso as Promise<T>;
  const richiesta = esegui().finally(() => inVolo.delete(chiave));
  inVolo.set(chiave, richiesta);
  return richiesta;
}
