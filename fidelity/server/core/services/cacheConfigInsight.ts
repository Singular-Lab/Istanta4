/**
 * La cache della configurazione degli insight del volantino (ConfigService.getFlyerInsightsConfig):
 * una chiave per GDO, perche' ogni GDO puo' avere la sua (Impostazioni GDO); senza GDO quella del
 * file dell'installazione. Salvare o togliere la configurazione di una GDO dimentica la sua chiave.
 */

export const DURATA_CACHE_CONFIG_INSIGHT_SECONDI = 300;

export const chiaveCacheConfigInsight = (idGdo?: string | null): string => `config:flyer-insights:${idGdo || 'installazione'}`;

/** Dimentica la configurazione degli insight in cache per la GDO (Redis assente: niente da fare). */
export async function dimenticaConfigInsight(idGdo: string | null): Promise<void> {
  const { del } = await import('../../src/shared/cache/cache.service.js');
  await del(chiaveCacheConfigInsight(idGdo));
}
