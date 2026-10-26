import { ExternalApiError } from '../../../lib/errors';

/**
 * Esito delle chiamate verso Istanta e Correggo: un solo punto decide se la chiamata e
 * riuscita e, se no, quale messaggio vede l'operatore (vedi la spec errori-istanta-correggo).
 */
export type ServizioEsterno = 'ISTANTA' | 'CORREGGO';

const NOMI: Record<ServizioEsterno, string> = { ISTANTA: 'Istanta', CORREGGO: 'Correggo' };

// Codici che Istanta mette in `error` al posto di un testo leggibile
const CODICI_NOTI: Record<string, string> = {
  promo_not_found: 'promo non trovata',
  importazioni_esistenti_per_questa_promo: 'la promo ha delle importazioni collegate',
  tracciati_esistenti_per_questa_promo: 'la promo ha dei tracciati collegati',
  lavorazioni_esistenti_per_questa_promo: 'la promo ha delle lavorazioni collegate',
  impiegata_in_tipo_export: 'la naming convention è usata da un tipo di export',
};

/** Forma restituita da ServerUtils.sendToFICOApi e dagli upload axios. */
type RispostaServizio = { data: unknown; status: number | string; statusText?: string };

/** Istanta risponde un oggetto con `esito`; un esito false (anche con HTTP 200) e un fallimento. */
export const esitoIstanta = (data: any): boolean =>
  typeof data === 'object' && data !== null && data.esito !== false;

/**
 * Restituisce `data` se il servizio ha risposto 2xx e `riuscita(data)` e vera, altrimenti lancia
 * ExternalApiError (502) con un messaggio per l'operatore. Il testo grezzo del servizio, che puo
 * contenere stack trace, resta solo nella `cause`: va nei log e non arriva al client in produzione.
 */
export function verificaRisposta<T = any>(
  risposta: RispostaServizio,
  servizio: ServizioEsterno,
  endpoint: string,
  riuscita: (data: any) => boolean = esitoIstanta
): T {
  const { data, status } = risposta;
  const httpOk = typeof status === 'number' && status >= 200 && status < 300;
  if (httpOk && riuscita(data)) {
    return data as T;
  }
  // Con HTTP 2xx statusText e solo la reason phrase ("OK"), non un motivo
  const grezzo = testoErrore(data) || (httpOk ? '' : risposta.statusText ?? '');
  const codice = grezzo.trim();
  throw new ExternalApiError({
    message: messaggioPerOperatore(NOMI[servizio], status, grezzo, endpoint),
    service: servizio,
    endpoint,
    statusCode: typeof status === 'number' ? status : undefined,
    // Solo i codici noti arrivano al client: l'interfaccia ci decide sopra (es. eliminazione promo)
    details: Object.hasOwn(CODICI_NOTI, codice) ? { codice } : undefined,
    cause: new Error(grezzo || `HTTP ${status}`),
  });
}

function testoErrore(data: any): string {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';
  // Istanta usa error (o errors nelle analisi), Correggo errorDetails/error_detail o errore
  const testo = data.error || data.errors || data.errore || data.errorDetails || data.error_detail;
  if (Array.isArray(testo)) return testo.join('; ');
  return typeof testo === 'string' ? testo : '';
}

function messaggioPerOperatore(nome: string, status: number | string, grezzo: string, endpoint: string): string {
  // Nessuna risposta HTTP: rete, DNS o passaporto Olimpo non ottenuto
  if (typeof status !== 'number' || status === 0) return `Impossibile contattare ${nome}`;
  // LoginMiddleWare di Istanta risponde "no_login:" + stack per ogni eccezione non gestita
  if (grezzo.startsWith('no_login:')) return `Errore interno di ${nome}`;
  if (grezzo.startsWith('no_login')) return `${nome} non ha riconosciuto l'utente`;
  if (status === 404 && !grezzo.trim()) return `${nome} non espone la funzione richiesta (${endpoint})`;

  // ex.ToString() di .NET: la prima riga e il messaggio, le altre lo stack
  const motivo = grezzo.trim().split(/\r?\n/)[0].trim();
  if (!motivo || motivo.startsWith('<')) {
    return status >= 300 ? `${nome} ha risposto con un errore (HTTP ${status})` : `${nome} non ha confermato l'operazione`;
  }
  return `${nome}: ${Object.hasOwn(CODICI_NOTI, motivo) ? CODICI_NOTI[motivo] : motivo.slice(0, 300)}`;
}
