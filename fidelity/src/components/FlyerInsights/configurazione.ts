import type { FlyerInsightsConfig } from "@/types/flyerInsights";

/**
 * Le sezioni del dettaglio del volantino che la config della GDO puo' spegnere: reparti, meccaniche
 * e pagine (la distribuzione nelle pagine). Le analisi non dipendono piu' dalla config per i dati:
 * mentre si carica, se manca o se non nomina la sezione, la sezione c'e'. Solo enabled: false la toglie.
 */
export type SezioneConfigurabile = "reparti" | "meccaniche" | "pagine";

export const sezioneAttiva = (configurazione: FlyerInsightsConfig | undefined, sezione: SezioneConfigurabile): boolean =>
  configurazione?.[sezione]?.enabled !== false;
