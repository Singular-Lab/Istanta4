/**
 * Pagine di amministrazione spostate sotto /gestione-interna: vecchio percorso → nuovo.
 *
 * I vecchi percorsi restano come redirect nel router e vengono riscritti nei menu
 * salvati, così i segnalibri e le voci già configurate continuano a funzionare.
 *
 * /punti-vendita non c'è più: è la pagina di consultazione dei punti vendita, separata dalla
 * gestione (/gestione-interna/punti-vendita). I menu già riscritti restano come sono.
 */
export const PERCORSI_SPOSTATI: Readonly<Record<string, string>> = {
  '/aree-e-canali': '/gestione-interna/aree-e-canali',
  '/gestione-utenti': '/gestione-interna/gestione-utenti',
  '/gestione-hub': '/gestione-interna/gestione-hub',
  '/gestione-metodi-accesso': '/gestione-interna/gestione-metodi-accesso',
  '/gestione-permessi': '/gestione-interna/gestione-permessi',
};

/**
 * Nuovo indirizzo di un vecchio percorso, sottopagine comprese
 * ("/aree-e-canali/42" → "/gestione-interna/aree-e-canali/42"), o undefined se non è stato spostato.
 * Il confronto è per segmenti interi: "/aree-e-canali-bis" non è spostato.
 */
export const percorsoSpostato = (percorso: string): string | undefined => {
  for (const [vecchio, nuovo] of Object.entries(PERCORSI_SPOSTATI)) {
    if (percorso === vecchio || percorso.startsWith(`${vecchio}/`)) {
      return nuovo + percorso.slice(vecchio.length);
    }
  }
  return undefined;
};
