/**
 * I servizi dell'hub che Fidelity gestisce da se' (Istanta e Correggo), condivisi fra server e
 * gestione dell'hub: il client mostra l'ingresso atteso quando il Superadmin sceglie un indirizzo.
 */

/** Codici dei servizi dell'hub che Fidelity gestisce da se' (meta.gestito). */
export type ServizioGestito = 'istanta' | 'correggo';

/** Il percorso di ingresso di ciascun servizio gestito, dopo l'indirizzo pubblico dell'applicazione. */
export const INGRESSO_SERVIZIO_GESTITO: Record<ServizioGestito, string> = {
  istanta: '/LoginController/oauth/landed',
  correggo: '/OAuthLanded.ashx',
};
