import type { Query, QueryClient } from '@tanstack/react-query';
import { ID_CLIENT } from '../../lib/identificativiRichiesta';

/*
 * Dati aggiornati in tempo reale (spec interfaccia-operatore, "Dati aggiornati in tempo reale").
 *
 * Il server avvisa, sul canale delle notifiche, che un tipo di dato e' cambiato: l'avviso non
 * contiene il dato. Qui l'avviso fa rileggere quello che le pagine aperte mostrano, con i permessi
 * dell'utente:
 * - le query di React Query attive si invalidano (si rileggono quelle in uso, le altre solo quando servono);
 *   una query puo' restringere gli avvisi che la riguardano con `meta: { risorse: ['promo', ...] }` o
 *   escludersi con `meta: { realtime: false }`; senza `meta` si rilegge a ogni avviso;
 * - chi legge i dati in altro modo (un loader del router, una richiesta nella pagina) si iscrive con
 *   `iscrivi` (hook `useCambioDati`).
 * Piu' avvisi ravvicinati danno una sola rilettura; l'avviso della scheda che ha agito si ignora, perche'
 * quella pagina ha gia' i dati; dopo una riconnessione si rilegge tutto, perche' gli avvisi persi non
 * si recuperano.
 *
 * Con molti utenti collegati, un avviso arriva a tutti nello stesso istante: per non sommergere il
 * server di richieste ogni scheda
 * - aspetta un tempo casuale prima di rileggere (le richieste si distribuiscono invece di arrivare insieme);
 * - non rilegge piu' spesso di una volta ogni RAFFREDDAMENTO_MS;
 * - se la scheda e' nascosta non rilegge: lo fa quando torna visibile;
 * - rilegge le query pesanti (consultazione, insight) al massimo ogni INTERVALLO_QUERY_PESANTI_MS: nel
 *   frattempo restano da rileggere, e lo sono alla prima apertura.
 */

export interface AvvisoDati {
  risorsa: string;
  azione: 'creato' | 'modificato' | 'eliminato';
  id: string | null;
  origine: string | null;
}

/** Tutti i tipi di dato: dopo una riconnessione, o quando l'avviso non si capisce. */
export const TUTTE_LE_RISORSE = '*';

export const FINESTRA_RILETTURA_MS = 300;
/** Ogni scheda aspetta un tempo casuale fra 0 e tanto: con mille schede le richieste si spalmano. */
export const DISPERSIONE_MAX_MS = 4000;
/** Fra una rilettura e la successiva passa almeno tanto. */
export const RAFFREDDAMENTO_MS = 5000;
/** Le query che calcolano molto sul server non si rileggono piu' spesso di cosi'. */
export const INTERVALLO_QUERY_PESANTI_MS = 30_000;
/** Primo elemento della chiave delle query pesanti (consultazione dei volantini, insight). */
const CHIAVI_QUERY_PESANTI = new Set(['consultazione', 'flyerInsights']);
/** Un flusso continuo di avvisi non rimanda la rilettura oltre tanto. */
export const ATTESA_MASSIMA_RILETTURA_MS = 2000;

const AZIONI = new Set(['creato', 'modificato', 'eliminato']);

/** L'avviso come arriva dal canale: un Buffer (ArrayBuffer), un testo JSON o un oggetto. */
export function leggiAvviso(dato: unknown): AvvisoDati | null {
  let valore: unknown = dato;
  try {
    // Il controllo per nome e' valido anche per un ArrayBuffer di un altro contesto (iframe, test)
    if (Object.prototype.toString.call(dato) === '[object ArrayBuffer]') valore = JSON.parse(new TextDecoder().decode(new Uint8Array(dato as ArrayBuffer)));
    else if (ArrayBuffer.isView(dato)) valore = JSON.parse(new TextDecoder().decode(dato as Uint8Array));
    else if (typeof dato === 'string') valore = JSON.parse(dato);
  } catch {
    return null;
  }
  if (!valore || typeof valore !== 'object') return null;
  const { risorsa, azione, id, origine } = valore as Record<string, unknown>;
  if (typeof risorsa !== 'string' || risorsa === '' || typeof azione !== 'string' || !AZIONI.has(azione)) return null;
  return {
    risorsa: risorsa.toLowerCase(),
    azione: azione as AvvisoDati['azione'],
    id: typeof id === 'string' ? id : null,
    origine: typeof origine === 'string' ? origine : null,
  };
}

/** La query riguarda uno dei tipi di dato cambiati? */
export function queryInteressata(query: Pick<Query, 'meta'>, risorse: ReadonlySet<string>): boolean {
  const meta = query.meta as { realtime?: boolean; risorse?: unknown } | undefined;
  if (meta?.realtime === false) return false;
  if (risorse.has(TUTTE_LE_RISORSE)) return true;
  if (!Array.isArray(meta?.risorse)) return true;
  return meta.risorse.some((risorsa: unknown) => typeof risorsa === 'string' && risorse.has(risorsa.toLowerCase()));
}

/** Ogni quanto al massimo si rilegge la query: `meta.realtimeMinMs`, o l'intervallo delle query pesanti. */
export function intervalloMinimo(query: Pick<Query, 'meta' | 'queryKey'>): number {
  const meta = query.meta as { realtimeMinMs?: unknown } | undefined;
  if (typeof meta?.realtimeMinMs === 'number' && meta.realtimeMinMs >= 0) return meta.realtimeMinMs;
  const primo = Array.isArray(query.queryKey) ? query.queryKey[0] : undefined;
  return typeof primo === 'string' && CHIAVI_QUERY_PESANTI.has(primo) ? INTERVALLO_QUERY_PESANTI_MS : 0;
}

export type Ascoltatore = (risorse: ReadonlySet<string>) => void;

export interface Aggiornatore {
  onAvviso(avviso: AvvisoDati | null): void;
  onRiconnessione(): void;
  /** Chiamata a ogni rilettura, con i tipi di dato cambiati. Restituisce la funzione per smettere. */
  iscrivi(ascoltatore: Ascoltatore): () => void;
  chiudi(): void;
}

export interface OpzioniAggiornatore {
  idClient?: string;
  finestraMs?: number;
  attesaMassimaMs?: number;
  adesso?: () => number;
  dispersioneMaxMs?: number;
  /** Un numero casuale in [0, 1): si passa nei test. */
  casuale?: () => number;
  raffreddamentoMs?: number;
  /** La scheda e' visibile? Nascosta non rilegge. */
  visibile?: () => boolean;
}

export function creaAggiornatore(queryClient: QueryClient, opzioni: OpzioniAggiornatore = {}): Aggiornatore {
  const idClient = opzioni.idClient ?? ID_CLIENT;
  const finestra = opzioni.finestraMs ?? FINESTRA_RILETTURA_MS;
  const attesaMassima = opzioni.attesaMassimaMs ?? ATTESA_MASSIMA_RILETTURA_MS;
  const adesso = opzioni.adesso ?? Date.now;
  const dispersione = opzioni.dispersioneMaxMs ?? DISPERSIONE_MAX_MS;
  const casuale = opzioni.casuale ?? Math.random;
  const raffreddamento = opzioni.raffreddamentoMs ?? RAFFREDDAMENTO_MS;
  const visibile = opzioni.visibile ?? (() => typeof document === 'undefined' || document.visibilityState !== 'hidden');

  const ascoltatori = new Set<Ascoltatore>();
  let inAttesa = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timerRinviate: ReturnType<typeof setTimeout> | null = null;
  let primoAvviso = 0;
  let ultimaRilettura = 0;
  // Le query pesanti lasciate indietro: hash -> quando si possono rileggere
  const rinviate = new Map<string, number>();

  const rileggiRinviate = () => {
    timerRinviate = null;
    const ora = adesso();
    const pronte = new Set([...rinviate].filter(([, quando]) => quando <= ora).map(([hash]) => hash));
    for (const hash of pronte) rinviate.delete(hash);
    if (pronte.size > 0) {
      void queryClient.invalidateQueries({ predicate: (query) => pronte.has(query.queryHash), refetchType: 'active' });
    }
    pianificaRinviate();
  };

  function pianificaRinviate() {
    if (timerRinviate || rinviate.size === 0) return;
    const prossima = Math.min(...rinviate.values());
    timerRinviate = setTimeout(rileggiRinviate, Math.max(0, prossima - adesso()) + 50 + casuale() * dispersione);
  }

  const rileggi = () => {
    timer = null;
    // Scheda nascosta: niente richieste, si rilegge quando torna visibile
    if (!visibile()) return;
    // Troppo presto dall'ultima rilettura: si aspetta, tenendo da parte gli avvisi
    const mancante = ultimaRilettura + raffreddamento - adesso();
    if (ultimaRilettura !== 0 && mancante > 0) {
      timer = setTimeout(rileggi, mancante + casuale() * dispersione);
      return;
    }
    primoAvviso = 0;
    ultimaRilettura = adesso();
    const risorse = inAttesa;
    inAttesa = new Set();
    if (risorse.size === 0) return;
    const ora = adesso();
    void queryClient.invalidateQueries({
      predicate: (query) => {
        if (!queryInteressata(query, risorse)) return false;
        // Una query pesante riletta da poco resta da rileggere piu' tardi
        const minimo = intervalloMinimo(query);
        const aggiornataAl = query.state.dataUpdatedAt;
        if (minimo > 0 && aggiornataAl > 0 && ora - aggiornataAl < minimo) {
          rinviate.set(query.queryHash, aggiornataAl + minimo);
          return false;
        }
        return true;
      },
      refetchType: 'active',
    });
    pianificaRinviate();
    for (const ascoltatore of [...ascoltatori]) {
      try {
        ascoltatore(risorse);
      } catch (errore) {
        // eslint-disable-next-line no-console -- un ascoltatore che sbaglia non deve fermare gli altri
        console.error('Aggiornamento in tempo reale: errore in un ascoltatore', errore);
      }
    }
  };

  const programma = (risorsa: string) => {
    inAttesa.add(risorsa);
    const ora = adesso();
    if (primoAvviso === 0) primoAvviso = ora;
    if (timer) clearTimeout(timer);
    const mancante = Math.max(0, attesaMassima - (ora - primoAvviso));
    // Il tempo casuale e' solo sulla prima attesa: gli avvisi successivi non lo ripetono
    timer = setTimeout(rileggi, Math.min(finestra, mancante) + casuale() * dispersione);
  };

  // Tornando visibile la scheda rilegge quello che ha lasciato indietro
  const alCambioDiVisibilita = () => {
    if (visibile() && inAttesa.size > 0 && !timer) {
      timer = setTimeout(rileggi, casuale() * dispersione);
    }
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', alCambioDiVisibilita);

  return {
    onAvviso(avviso) {
      if (!avviso) return;
      if (avviso.origine !== null && avviso.origine === idClient) return;
      programma(avviso.risorsa);
    },
    onRiconnessione() {
      programma(TUTTE_LE_RISORSE);
    },
    iscrivi(ascoltatore) {
      ascoltatori.add(ascoltatore);
      return () => { ascoltatori.delete(ascoltatore); };
    },
    chiudi() {
      if (timer) clearTimeout(timer);
      if (timerRinviate) clearTimeout(timerRinviate);
      timer = null;
      timerRinviate = null;
      inAttesa = new Set();
      rinviate.clear();
      ascoltatori.clear();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', alCambioDiVisibilita);
    },
  };
}

// Un aggiornatore per ogni QueryClient: SocketProvider puo' comparire piu' volte (una pagina ne ha uno suo)
// e gli avvisi arrivati da piu' canali si fondono in una sola rilettura
const aggiornatori = new WeakMap<QueryClient, Aggiornatore>();

export function aggiornatoreDi(queryClient: QueryClient): Aggiornatore {
  let aggiornatore = aggiornatori.get(queryClient);
  if (!aggiornatore) {
    aggiornatore = creaAggiornatore(queryClient);
    aggiornatori.set(queryClient, aggiornatore);
  }
  return aggiornatore;
}
