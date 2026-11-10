/**
 * Pagine spostate: vecchio percorso → nuovo.
 *
 * I vecchi percorsi restano come redirect nel router e vengono riscritti nei menu
 * salvati, così i segnalibri e le voci già configurate continuano a funzionare.
 *
 * - Le pagine di amministrazione sono sotto /gestione-interna.
 * - WebPliant: l'elenco dei workspace è la pagina Workspace WebPliant, con l'editor sotto di sé;
 *   la vecchia configurazione WebPliant è passata nelle Impostazioni GDO.
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
  '/webliant/impostazioni-webpliant': '/webliant/workspace',
  '/webliant/impostazioni-webpliant/workspace': '/webliant/workspace/editor',
  '/webliant/impostazioni-webpliant/configurazione-webpliant': '/impostazioni-gdo',
};

/**
 * Titoli delle voci di menu spostate: una voce che ha ancora il titolo predefinito di prima prende
 * quello della pagina nuova; un titolo scelto a mano resta com'è. Serve perché il menu predefinito
 * (anche quello di seed-fidelity.sh) nasce ancora con il vecchio percorso e il vecchio titolo, e
 * viene portato alla pagina nuova all'avvio.
 */
export const TITOLI_SPOSTATI: Readonly<Record<string, { vecchio: string; nuovo: string }>> = {
  '/webliant/impostazioni-webpliant': { vecchio: 'Impostazioni WebPliant', nuovo: 'Workspace WebPliant' },
};

/** Titolo nuovo di una voce con il vecchio percorso esatto e il vecchio titolo predefinito, o undefined. */
export const titoloSpostato = (percorso: string, titolo: string | null | undefined): string | undefined => {
  const regola = TITOLI_SPOSTATI[percorso];
  return regola && titolo?.trim() === regola.vecchio ? regola.nuovo : undefined;
};

/**
 * Nuovo indirizzo di un vecchio percorso, sottopagine comprese
 * ("/aree-e-canali/42" → "/gestione-interna/aree-e-canali/42"), o undefined se non è stato spostato.
 * Il confronto è per segmenti interi: "/aree-e-canali-bis" non è spostato. Se più vecchi percorsi
 * corrispondono vince il più lungo: l'editor del workspace non diventa una sottopagina dell'elenco.
 */
export const percorsoSpostato = (percorso: string): string | undefined => {
  let trovato: [string, string] | undefined;
  for (const [vecchio, nuovo] of Object.entries(PERCORSI_SPOSTATI)) {
    const corrisponde = percorso === vecchio || percorso.startsWith(`${vecchio}/`);
    if (corrisponde && (!trovato || vecchio.length > trovato[0].length)) trovato = [vecchio, nuovo];
  }
  return trovato ? trovato[1] + percorso.slice(trovato[0].length) : undefined;
};
