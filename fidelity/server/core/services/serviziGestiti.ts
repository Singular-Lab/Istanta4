import config from '../config';
import { INGRESSO_SERVIZIO_GESTITO, type ServizioGestito } from '../inizializzazione/datiPredefiniti';

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

/** I campi che per un servizio gestito decide Fidelity. */
export function senzaCampiGestiti<T extends Record<string, unknown>>(data: T): T {
  const { url: _url, tipo_url: _tipo, codice: _codice, ...resto } = data;
  return resto as T;
}
