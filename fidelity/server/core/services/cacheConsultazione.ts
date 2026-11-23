import { createHash } from 'node:crypto';
import type { BoxInsight, SintesiVolantino } from '../../../lib/insightVolantino/tipi';

/**
 * La cache delle pagine di consultazione di promo e volantini (Redis). Due usi:
 *
 * - gli insight di ogni kit del dettaglio della promozione: sintesi e box si calcolano dalle
 *   referenze del kit (centinaia di righe da circa 9 KB) e per una promo pubblicata non cambiano
 *   fra una richiesta e l'altra. La chiave porta con se' la versione di quello che il calcolo
 *   legge (referenze, kit, PDF, configurazione, reparti): se cambia, la chiave e' un'altra e il
 *   risultato vecchio non si usa piu' (scade da solo);
 * - i numeri dell'elenco Volantini che non dipendono dalla pagina (riepilogo, opzioni dei filtri,
 *   promo della tendina), per pochi secondi.
 *
 * Senza Redis, o se Redis fallisce, non c'e' cache: si calcola come prima.
 */

/** Da alzare quando cambia il modo di calcolare sintesi e box: i risultati gia' in cache non valgono piu'. */
export const VERSIONE_CALCOLO_INSIGHT_KIT = 1;

export const DURATA_CACHE_INSIGHT_KIT_SECONDI = 300;

/** I numeri dell'elenco durano poco: una pubblicazione si vede entro questo tempo. */
export const DURATA_CACHE_ELENCO_SECONDI = 30;

export interface InsightKitInCache {
  sintesi: SintesiVolantino;
  box: readonly BoxInsight[];
}

export interface CacheConsultazione {
  leggi<T>(chiave: string): Promise<T | null>;
  scrivi(chiave: string, valore: unknown, secondi: number): Promise<void>;
}

/** Impronta stabile di quello da cui dipende il risultato; le funzioni non entrano (JSON le salta). */
export function impronta(...parti: readonly unknown[]): string {
  return createHash('sha1').update(JSON.stringify(parti)).digest('hex');
}

export const improntaInsightKit = (...parti: readonly unknown[]): string => impronta(VERSIONE_CALCOLO_INSIGHT_KIT, ...parti);

export const chiaveCacheInsightKit = (idKit: string, improntaKit: string): string =>
  `consultazione:insight-kit:${idKit.toLowerCase()}:${improntaKit}`;

export const chiaveCacheElenco = (nome: string, ...parti: readonly unknown[]): string =>
  `consultazione:elenco:${nome}:${impronta(...parti)}`;

/** La cache su Redis: se non c'e' o fallisce, non c'e' cache (get e set non lanciano mai). */
export const CACHE_CONSULTAZIONE_REDIS: CacheConsultazione = {
  async leggi<T>(chiave: string) {
    const { get } = await import('../../src/shared/cache/cache.service.js');
    return get<T>(chiave);
  },
  async scrivi(chiave, valore, secondi) {
    const { set } = await import('../../src/shared/cache/cache.service.js');
    await set(chiave, valore, secondi);
  },
};

/** Il valore in cache, o quello calcolato (e messo in cache senza aspettare). Senza cache, sempre calcolato. */
export async function ricorda<T>(
  cache: CacheConsultazione | null,
  chiave: string,
  secondi: number,
  calcola: () => Promise<T>
): Promise<T> {
  if (!cache) return calcola();
  const inCache = await cache.leggi<T>(chiave).catch(() => null);
  if (inCache !== null && inCache !== undefined) return inCache;
  const valore = await calcola();
  void cache.scrivi(chiave, valore, secondi).catch(() => undefined);
  return valore;
}
