/*
 * Quali richieste cambiano dei dati, e di che tipo (spec interfaccia-operatore, "Dati aggiornati in
 * tempo reale"). Una richiesta che cambia dei dati, riuscita, avvisa le pagine aperte della stessa GDO:
 * ognuna rilegge quello che mostra.
 *
 * - PUT, PATCH e DELETE cambiano sempre dei dati.
 * - POST di norma crea (o avvia) qualcosa, quindi cambia dei dati; fanno eccezione i POST che servono
 *   a leggere (ricerche con molti filtri, risultati, esportazioni, download, verifiche), a entrare o a
 *   provare qualcosa: un avviso a ogni lettura farebbe rileggere le pagine degli altri a vuoto.
 * - Un POST che non si riconosce vale come modifica: un avviso in piu' costa una rilettura, uno in meno
 *   lascia una pagina vecchia.
 */

export type AzioneDati = 'creato' | 'modificato' | 'eliminato';

/** I POST che leggono, provano o aprono una sessione: non cambiano dati. Si confrontano con il percorso senza query. */
const POST_CHE_NON_CAMBIANO_DATI = new RegExp(
  `(?:^|/)(?:${[
    'scoreboard/(?:query|multi-promo|promo)',
    'risultato',
    'query',
    'ricerca',
    'ricercareferenzepromo',
    'zip',
    'export',
    'export_users',
    'download[a-z_]*',
    'verifica',
    'validate',
    'validate-slug',
    'field-values',
    'get_[a-z_]+',
    'refs',
    'refs-html',
    'files',
    'mergefiles',
    'group-files-by-equality',
    'test',
    'invio_di_test_ad_utente',
    'heartbeat',
    'login_user',
    'check_login_for_multiple_users',
    'recupero-password',
    'reset-password',
    'hash-password',
    'acs',
  ].join('|')})(?:/|$)`,
  'i'
);

/** Percorsi che non cambiano mai dati visibili agli altri utenti, qualunque sia il metodo. */
const PERCORSI_ESCLUSI = /(?:^|\/)(?:csrf-token|heartbeat|logout|login_user|auth\/saml|analytics|metrics|health)(?:\/|$)/i;

const METODI_DI_SCRITTURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const senzaQuery = (percorso: string): string => percorso.split('?')[0].replace(/\/+$/, '') || '/';

/** La richiesta cambia dei dati che le altre pagine possono mostrare? */
export function cambiaDati(metodo: string, percorso: string): boolean {
  const verbo = metodo.toUpperCase();
  if (!METODI_DI_SCRITTURA.has(verbo)) return false;
  const pulito = senzaQuery(percorso);
  if (PERCORSI_ESCLUSI.test(pulito)) return false;
  if (verbo === 'POST' && POST_CHE_NON_CAMBIANO_DATI.test(pulito)) return false;
  return true;
}

export function azioneDi(metodo: string): AzioneDati {
  switch (metodo.toUpperCase()) {
    case 'DELETE': return 'eliminato';
    case 'PUT':
    case 'PATCH': return 'modificato';
    default: return 'creato';
  }
}

const SEGMENTO_ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{1,18})$/i;

/**
 * Il tipo di dato: il primo segmento del percorso dopo /api, in minuscolo ("/api/ACPV/salvaArea" ->
 * "acpv"). Serve solo a restringere le pagine che rileggono; chi non lo dichiara rilegge sempre.
 */
export function risorsaDi(percorso: string): string {
  const segmenti = senzaQuery(percorso).split('/').filter(Boolean);
  const inizio = segmenti[0]?.toLowerCase() === 'api' ? 1 : 0;
  const primo = segmenti.slice(inizio).find(segmento => !SEGMENTO_ID.test(segmento) && !segmento.startsWith(':'));
  return (primo ?? 'dati').toLowerCase();
}

/** L'identificativo del dato, se il percorso ne ha uno: l'ultimo segmento che e' un UUID o un numero. */
export function idDi(percorso: string): string | null {
  const segmenti = senzaQuery(percorso).split('/').filter(Boolean);
  for (let indice = segmenti.length - 1; indice >= 0; indice -= 1) {
    if (SEGMENTO_ID.test(segmenti[indice])) return segmenti[indice];
  }
  return null;
}
