import config from '../config';
import { INGRESSO_SERVIZIO_GESTITO, type ServizioGestito } from '../../../lib/hubServiziGestiti';

export type { ServizioGestito };

/**
 * I servizi dell'hub che Fidelity gestisce da se' (Istanta e Correggo): li riconosce meta.gestito,
 * l'indirizzo lo ricava dalla configurazione e non dalla gestione dell'hub.
 */

const VALORI: readonly ServizioGestito[] = ['istanta', 'correggo'];

/** Il servizio gestito indicato da meta.gestito, o null per un servizio normale. */
export function servizioGestito(meta: unknown): ServizioGestito | null {
  const valore = meta && typeof meta === 'object' ? (meta as Record<string, unknown>).gestito : undefined;
  return VALORI.includes(valore as ServizioGestito) ? (valore as ServizioGestito) : null;
}

type ConfigIndirizzi = Pick<typeof config, 'FICO_BASE_URL' | 'ISTANTA_IP_ADDRESS' | 'CORREGGO_IP_ADDRESS'>;

/**
 * L'indirizzo dell'applicazione del servizio, senza la barra finale, dalle variabili che Fidelity ha
 * gia': Istanta da FICO_BASE_URL (la base dei servizi FICO) o, se manca, da ISTANTA_IP_ADDRESS;
 * Correggo da CORREGGO_IP_ADDRESS. Devono essere raggiungibili dal browser dell'utente.
 */
export function indirizzoApplicazione(gestito: ServizioGestito, cfg: ConfigIndirizzi = config): string | null {
  const base = gestito === 'istanta' ? (cfg.FICO_BASE_URL ?? cfg.ISTANTA_IP_ADDRESS) : cfg.CORREGGO_IP_ADDRESS;
  return base ? base.replace(/\/+$/, '') : null;
}

/** L'ingresso del servizio (pagina di accesso di Istanta, OAuthLanded.ashx di Correggo), o null se non configurato. */
export function urlServizioGestito(gestito: ServizioGestito, cfg?: ConfigIndirizzi): string | null {
  const base = indirizzoApplicazione(gestito, cfg);
  return base ? base + INGRESSO_SERVIZIO_GESTITO[gestito] : null;
}

/** Toglie meta.gestito da quello che arriva dalla gestione dell'hub: un servizio non diventa ne' smette di essere gestito da li'. */
export function senzaGestito<T extends { meta?: unknown }>(data: T): T {
  if (!data.meta || typeof data.meta !== 'object') return data;
  const { gestito: _gestito, ...meta } = data.meta as Record<string, unknown>;
  return { ...data, meta };
}

/**
 * Vero se il Superadmin ha dato al servizio gestito un indirizzo suo (meta.indirizzo_manuale): allora
 * valgono indirizzo e tipo salvati, non quelli calcolati dalla configurazione.
 */
export function indirizzoManuale(meta: unknown): boolean {
  return !!meta && typeof meta === 'object' && (meta as Record<string, unknown>).indirizzo_manuale === true;
}

/** Toglie il codice: e' la chiave del gruppo e non cambia dopo la creazione. */
export function senzaCodice<T extends Record<string, unknown>>(data: T): T {
  const { codice: _codice, ...resto } = data;
  return resto as T;
}

/**
 * I dati che la gestione dell'hub manda per un servizio gestito, con indirizzo e tipo secondo la scelta
 * del Superadmin (campo `indirizzo_manuale`, che non e' una colonna e finisce in meta):
 *  - true: valgono url e tipo_url mandati;
 *  - false: si torna all'indirizzo calcolato; in tabella resta l'ingresso, come alla creazione;
 *  - assente: resta la scelta di prima. Con l'indirizzo calcolato url e tipo_url mandati si ignorano,
 *    tranne alla creazione di una variante, che li prende dall'ingresso.
 */
export function datiServizioGestito<T extends Record<string, unknown>>(
  data: T,
  gestito: ServizioGestito,
  manualePrima: boolean,
  opzioni: { creazione?: boolean } = {},
): T {
  const { indirizzo_manuale: scelta, ...resto } = data as Record<string, unknown>;
  const manuale = typeof scelta === 'boolean' ? scelta : manualePrima;
  if (typeof scelta === 'boolean' || opzioni.creazione) {
    const meta = resto.meta && typeof resto.meta === 'object' ? (resto.meta as Record<string, unknown>) : {};
    resto.meta = { ...meta, indirizzo_manuale: manuale };
  }
  if (manuale) return resto as T;
  if (scelta === false || opzioni.creazione) {
    const calcolato: Record<string, unknown> = { ...resto, url: INGRESSO_SERVIZIO_GESTITO[gestito], tipo_url: 'external_fico' };
    return calcolato as T;
  }
  const { url: _url, tipo_url: _tipo, ...senzaIndirizzo } = resto;
  return senzaIndirizzo as T;
}

/** Toglie `indirizzo_manuale` da quello che arriva per un servizio normale: vale solo per i gestiti. */
export function senzaIndirizzoManuale<T extends Record<string, unknown>>(data: T): T {
  const { indirizzo_manuale: _manuale, ...resto } = data;
  return resto as T;
}
