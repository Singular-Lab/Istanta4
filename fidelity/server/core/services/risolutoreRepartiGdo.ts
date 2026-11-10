import { log } from '../logger';
import type { RepartoAnagrafica } from '../utils/campiInsights';
import { type FonteRepartiGdo, RISOLUTORE_NEUTRO, type RisolutoreReparti, risolutoreReparti } from '../utils/repartiGdo';

/**
 * Il risolutore dei reparti della GDO di un kit o di un punto vendita (Impostazioni GDO: nome per il
 * marketing e colore). Una lettura sola per richiesta, sulla chiave primaria. Senza GDO, o se la
 * lettura fallisce (avviso nel log), i reparti restano quelli di sempre: niente si blocca per questo.
 */
export async function caricaRisolutoreReparti(
  fonte: FonteRepartiGdo,
  idGdo: string | null | undefined,
  anagrafica: readonly RepartoAnagrafica[],
  contesto: string,
): Promise<RisolutoreReparti> {
  if (!idGdo) return RISOLUTORE_NEUTRO;
  try {
    return risolutoreReparti(await fonte.repartiSalvati(idGdo), anagrafica);
  } catch (error) {
    log.warn(`${contesto}: reparti della GDO non disponibili, restano i nomi dei dati`, {
      idGdo,
      errore: error instanceof Error ? error.message : String(error),
    });
    return RISOLUTORE_NEUTRO;
  }
}
