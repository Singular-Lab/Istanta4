import { Agent, type Dispatcher } from 'undici';
import { log } from '../logger';

// Il fetch globale di Node usa Undici: i limiti interni non devono scadere prima
// dell'AbortSignal applicativo, che resta l'unica autorita sul tempo massimo.
const DISPATCHER_HTTP = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
});

/**
 * Client HTTP comune delle chiamate che Fidelity fa verso altri servizi (Istanta, Olimpo,
 * Correggo, Meta, AI, webhook...): un tempo massimo per ogni chiamata, retry solo per le
 * chiamate dichiarate ripetibili ed errori che dicono se il servizio non era raggiungibile
 * o non ha risposto in tempo.
 *
 * Come fetch, restituisce la Response per qualunque stato HTTP: leggere l'esito resta a chi
 * chiama. Lancia ErroreHttp solo quando una risposta non arriva.
 */

/** Tempo massimo per tipo di chiamata. "lunga": upload, download binari, PDF, FTP, analisi. */
export type CategoriaChiamata = 'passaporto' | 'lettura' | 'scrittura' | 'lunga';

const TIMEOUT_FISSI_MS: Record<Exclude<CategoriaChiamata, 'lunga'>, number> = {
  passaporto: 10_000,
  lettura: 30_000,
  scrittura: 60_000,
};

/** La categoria "lunga" resta regolabile con FICO_API_TIMEOUT_MS, come il vecchio default. */
export function timeoutCategoria(categoria: CategoriaChiamata): number {
  if (categoria === 'lunga') {
    return Number(process.env.FICO_API_TIMEOUT_MS) || 600_000;
  }
  return TIMEOUT_FISSI_MS[categoria];
}

export type MotivoErroreHttp = 'rete' | 'timeout';

export class ErroreHttp extends Error {
  constructor(
    readonly motivo: MotivoErroreHttp,
    /** Origine e percorso, senza query: nei log non devono finire token o parametri. */
    readonly destinazione: string,
    /** Vero se la connessione e' fallita prima che la richiesta partisse. */
    readonly primaDellInvio: boolean,
    options?: { cause?: unknown },
  ) {
    super(motivo === 'timeout'
      ? `Nessuna risposta da ${destinazione} entro il tempo massimo`
      : `${destinazione} non raggiungibile`, options);
    this.name = 'ErroreHttp';
  }
}

export interface OpzioniHttp extends RequestInit {
  /** Default "scrittura": senza indicazioni si assume che la chiamata abbia effetti. */
  categoria?: CategoriaChiamata;
  /** Prevale sulla categoria. */
  timeoutMs?: number;
  /**
   * Solo una chiamata ripetibile senza effetti doppi viene ritentata. Si dichiara per
   * chiamata e non si deduce dal metodo: alcune GET scrivono e alcune POST leggono.
   */
  idempotente?: boolean;
  /** Tentativi complessivi di una chiamata idempotente (default 3). */
  tentativi?: number;
  /** Attesa base fra i tentativi, raddoppiata a ogni giro (default 250 ms). */
  ritardoBaseMs?: number;
}

const CODICI_PRIMA_DELL_INVIO = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT']);
const CODICI_CONNESSIONE = new Set([...CODICI_PRIMA_DELL_INVIO, 'ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET']);
const STATI_TEMPORANEI = new Set([429, 502, 503, 504]);
const ATTESA_MASSIMA_MS = 2_000;
const ATTESA_MASSIMA_RETRY_AFTER_MS = 5_000;

function codiceErrore(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } } | undefined;
  return e?.cause?.code ?? e?.code;
}

/** Vero se la connessione e' fallita prima di inviare la richiesta: ritentare non duplica nulla. */
export function erroreDiConnessionePrimaDellInvio(err: unknown): boolean {
  if (err instanceof ErroreHttp) return err.primaDellInvio;
  const codice = codiceErrore(err);
  return !!codice && CODICI_PRIMA_DELL_INVIO.has(codice);
}

export function destinazioneDi(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split('?')[0];
  }
}

const pausa = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function attesaPrimaDelTentativo(tentativo: number, base: number, risposta?: Response): number {
  const retryAfter = Number(risposta?.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, ATTESA_MASSIMA_RETRY_AFTER_MS);
  }
  const esponenziale = base * 2 ** (tentativo - 1);
  return Math.min(esponenziale + Math.random() * base, ATTESA_MASSIMA_MS);
}

/**
 * Esegue la chiamata con il tempo massimo della categoria. Un segnale passato da chi chiama
 * resta valido insieme al timeout. Il corpo deve poter essere rispedito (stringa, Buffer,
 * FormData) se la chiamata e' idempotente.
 */
export async function chiamaHttp(url: string, opzioni: OpzioniHttp = {}): Promise<Response> {
  const {
    categoria = 'scrittura',
    timeoutMs,
    idempotente = false,
    tentativi = 3,
    ritardoBaseMs = 250,
    signal,
    ...init
  } = opzioni;
  const destinazione = destinazioneDi(url);
  const massimoTentativi = idempotente ? Math.max(1, tentativi) : 1;

  for (let tentativo = 1; ; tentativo++) {
    const scadenza = AbortSignal.timeout(timeoutMs ?? timeoutCategoria(categoria));
    const segnale = signal ? AbortSignal.any([signal, scadenza]) : scadenza;
    try {
      const opzioniFetch: RequestInit & { dispatcher: Dispatcher } = {
        ...init,
        signal: segnale,
        dispatcher: DISPATCHER_HTTP,
      };
      const risposta = await fetch(url, opzioniFetch);
      if (STATI_TEMPORANEI.has(risposta.status) && tentativo < massimoTentativi) {
        log.warn('Risposta temporanea, nuovo tentativo', { destinazione, status: risposta.status, tentativo });
        await risposta.body?.cancel().catch(() => undefined);
        await pausa(attesaPrimaDelTentativo(tentativo, ritardoBaseMs, risposta));
        continue;
      }
      return risposta;
    } catch (err) {
      // Annullata da chi chiama: non e' un errore del servizio
      if (signal?.aborted) throw err;
      if (scadenza.aborted) {
        throw new ErroreHttp('timeout', destinazione, false, { cause: err });
      }
      const codice = codiceErrore(err);
      if (codice === 'UND_ERR_HEADERS_TIMEOUT') {
        throw new ErroreHttp('timeout', destinazione, false, { cause: err });
      }
      // fetch nativo: TypeError "fetch failed" con il codice nella cause (un URL non valido ha ERR_INVALID_URL)
      const connessione = codice
        ? CODICI_CONNESSIONE.has(codice)
        : err instanceof TypeError && err.message === 'fetch failed';
      if (!connessione) throw err;
      const primaDellInvio = !!codice && CODICI_PRIMA_DELL_INVIO.has(codice);
      if (tentativo < massimoTentativi) {
        log.warn('Servizio non raggiungibile, nuovo tentativo', { destinazione, codice, tentativo });
        await pausa(attesaPrimaDelTentativo(tentativo, ritardoBaseMs));
        continue;
      }
      throw new ErroreHttp('rete', destinazione, primaDellInvio, { cause: err });
    }
  }
}
